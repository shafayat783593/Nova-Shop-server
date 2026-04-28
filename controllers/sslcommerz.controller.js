import SSLCommerzPayment from "sslcommerz-lts";
import Order from "../models/order.model.js";
import { sendInvoiceEmail } from "../services/invoice.service.js";
import { getIO } from "../socket.js";

const IS_SANDBOX = process.env.NODE_ENV !== "production";
const STORE_ID = process.env.STORE_ID;
const STORE_PASS = process.env.STORE_PASS;

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── INITIATE SSLCommerz payment ──────────────────────────────────────────────
// POST /api/payments/sslcommerz/init
// Body: { orderId: "ORD-XXXXXX" }
export const sslcommerzInit = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return sendError(res, "orderId is required", 400);

        const order = await Order.findOne({ orderId }).populate("user", "name email phone");
        if (!order) return sendError(res, "Order not found", 404);

        if (order.paymentStatus === "paid") {
            return sendError(res, "Order is already paid", 400);
        }

        const backendURL = process.env.BACKEND_URL;
        const frontendURL = process.env.FRONTEND_URL;

        const data = {
            total_amount: order.total,
            currency: "BDT",
            tran_id: order.orderId,
            success_url: `${backendURL}/api/payments/sslcommerz/success`,
            fail_url: `${backendURL}/api/payments/sslcommerz/fail`,
            cancel_url: `${backendURL}/api/payments/sslcommerz/cancel`,
            ipn_url: `${backendURL}/api/payments/sslcommerz/ipn`,

            // Customer info
            cus_name: order.shippingAddress.fullName,
            cus_email: order.user?.email || "guest@example.com",
            cus_add1: order.shippingAddress.addressLine,
            cus_city: order.shippingAddress.district,
            cus_state: order.shippingAddress.division,
            cus_postcode: order.shippingAddress.postalCode || "1000",
            cus_country: "Bangladesh",
            cus_phone: order.shippingAddress.phone,

            // Shipping info
            ship_name: order.shippingAddress.fullName,
            ship_add1: order.shippingAddress.addressLine,
            ship_city: order.shippingAddress.district,
            ship_state: order.shippingAddress.division,
            ship_postcode: order.shippingAddress.postalCode || "1000",
            ship_country: "Bangladesh",

            // Product info
            product_name: "Order Items",
            product_category: "ecommerce",
            product_profile: "general",
            num_of_item: order.items.length,
            product_amount: order.subtotal,
            discount_amount: order.discount,
            shipping_method: "Courier",
        };

        const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_SANDBOX);
        const apiResponse = await sslcz.init(data);

        if (!apiResponse?.GatewayPageURL) {
            return sendError(res, "SSLCommerz gateway URL not received", 400);
        }

        return res.status(200).json({
            success: true,
            data: { gatewayURL: apiResponse.GatewayPageURL },
        });
    } catch (err) {
        console.error("SSLCommerz Init Error:", err.message);
        return sendError(res, "Payment initiation failed");
    }
};

// ─── SSLCommerz SUCCESS callback ─────────────────────────────────────────────
// POST /api/payments/sslcommerz/success
export const sslcommerzSuccess = async (req, res) => {
    try {
        const { tran_id, val_id, amount, status } = req.body;

        if (status !== "VALID") {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=invalid`);
        }

        // ── Validate with SSLCommerz ───────────────────────────────────────
        const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_SANDBOX);
        const validation = await sslcz.validate({ val_id });

        if (validation?.status !== "VALID") {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=validation_failed`);
        }

        const order = await Order.findOne({ orderId: tran_id });
        if (!order) {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=order_not_found`);
        }

        // ── Update order ───────────────────────────────────────────────────
        order.paymentStatus = "paid";
        order.transactionId = val_id;
        order.paidAt = new Date();
        order.orderStatus = "confirmed";

        order.timeline.push({
            status: "confirmed",
            message: `Payment received via SSLCommerz. ValID: ${val_id}`,
            changedAt: new Date(),
        });

        await order.save();

        // ── Real-time notifications ────────────────────────────────────────
        const io = getIO();
        io.to("adminRoom").emit("order:paid", { orderId: order.orderId, total: order.total });
        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: "confirmed",
            message: "Payment confirmed! Your order is being processed.",
        });

        // ── Send invoice ───────────────────────────────────────────────────
        await sendInvoiceEmail(order).catch(console.error);
        order.invoiceSentAt = new Date();
        await order.save();

        return res.redirect(`${process.env.FRONTEND_URL}/payment/success?orderId=${order.orderId}`);
    } catch (err) {
        console.error("SSLCommerz Success Error:", err.message);
        return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=server_error`);
    }
};

// ─── SSLCommerz FAIL callback ─────────────────────────────────────────────────
// POST /api/payments/sslcommerz/fail
export const sslcommerzFail = async (req, res) => {
    const { tran_id } = req.body;
    if (tran_id) {
        await Order.findOneAndUpdate(
            { orderId: tran_id },
            { paymentStatus: "failed" }
        ).catch(console.error);
    }
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=payment_failed`);
};

// ─── SSLCommerz CANCEL callback ───────────────────────────────────────────────
// POST /api/payments/sslcommerz/cancel
export const sslcommerzCancel = async (req, res) => {
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=cancelled`);
};

// ─── SSLCommerz IPN (server-to-server notification) ──────────────────────────
// POST /api/payments/sslcommerz/ipn
export const sslcommerzIPN = async (req, res) => {
    try {
        const { tran_id, val_id, status } = req.body;

        if (status !== "VALID") return res.status(200).json({ received: true });

        const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_SANDBOX);
        const validation = await sslcz.validate({ val_id });

        if (validation?.status !== "VALID") return res.status(200).json({ received: true });

        const order = await Order.findOne({ orderId: tran_id });
        if (!order || order.paymentStatus === "paid") {
            return res.status(200).json({ received: true });
        }

        order.paymentStatus = "paid";
        order.transactionId = val_id;
        order.paidAt = new Date();
        order.orderStatus = "confirmed";
        order.timeline.push({ status: "confirmed", message: "IPN payment confirmed", changedAt: new Date() });
        await order.save();

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error("SSLCommerz IPN Error:", err.message);
        return res.status(200).json({ received: true });
    }
};