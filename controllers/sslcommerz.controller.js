import SSLCommerzPayment from "sslcommerz-lts";
import Order from "../models/order.model.js";
import { sendInvoiceEmail } from "../services/Invoice.service.js";
import { getIO } from "../socket/socket.js";

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
            total_amount: parseFloat(order.total), // নিশ্চিত করুন এটি Number
            currency: "BDT",
            tran_id: order.orderId, // এটি ইউনিক হতে হবে
            success_url: `${backendURL}/api/payments/sslcommerz/success`,
            fail_url: `${backendURL}/api/payments/sslcommerz/fail`,
            cancel_url: `${backendURL}/api/payments/sslcommerz/cancel`,
            ipn_url: `${backendURL}/api/payments/sslcommerz/ipn`,

            // Customer info (নিশ্চিত করুন এই ভ্যালুগুলো ফাঁকা নেই)
            cus_name: order.shippingAddress.fullName || "Customer Name",
            cus_email: order.user?.email || "guest@example.com",
            cus_add1: order.shippingAddress.addressLine || "Address Line 1",
            cus_city: order.shippingAddress.district || "Dhaka",
            cus_state: order.shippingAddress.division || "Dhaka",
            cus_postcode: order.shippingAddress.postalCode || "1000",
            cus_country: "Bangladesh",
            cus_phone: order.shippingAddress.phone || "01700000000",

            // Shipping info
            ship_name: order.shippingAddress.fullName || "Customer Name",
            ship_add1: order.shippingAddress.addressLine || "Address Line 1",
            ship_city: order.shippingAddress.district || "Dhaka",
            ship_state: order.shippingAddress.division || "Dhaka",
            ship_postcode: order.shippingAddress.postalCode || "1000",
            ship_country: "Bangladesh",

            // Product info
            product_name: "Order Items",
            product_category: "Electronic", // ক্যাটাগরি ফিক্সড রাখুন
            product_profile: "general",
        };

        // const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_SANDBOX);
        const sslcz = new SSLCommerzPayment('testbox', 'qwerty', true);

        console.log("........", sslcz);
        const apiResponse = await sslcz.init(data);
        console.log("SSLCommerz Full Response:", apiResponse);
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
        const { tran_id, val_id, status } = req.body;

        if (status !== "VALID") {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=invalid`);
        }

        const sslcz = new SSLCommerzPayment('testbox', 'qwerty', true);
        const validation = await sslcz.validate({ val_id });

        if (validation?.status !== "VALID") {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=validation_failed`);
        }

        // ✅ orderId দিয়ে খোঁজো, অথবা retryTranIds এ আছে কিনা দেখো
        const order = await Order.findOne({
            $or: [
                { orderId: tran_id },
                { retryTranIds: tran_id },   // ← retry এর জন্য
            ]
        });

        if (!order) {
            return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=order_not_found`);
        }

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

        const io = getIO();
        io.to("adminRoom").emit("order:paid", { orderId: order.orderId, total: order.total });
        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: "confirmed",
            message: "Payment confirmed! Your order is being processed.",
        });

        const userEmail = order.user?.email || "";
        await sendInvoiceEmail(order, userEmail).catch(console.error);
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
// export const sslcommerzFail = async (req, res) => {
//     const { tran_id } = req.body;
//     if (tran_id) {
//         await Order.findOneAndUpdate(
//             { orderId: tran_id },
//             { paymentStatus: "failed" }
//         ).catch(console.error);
//     }
//     return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=payment_failed`);
// };

// ─── SSLCommerz CANCEL callback ───────────────────────────────────────────────
// POST /api/payments/sslcommerz/cancel
export const sslcommerzCancel = async (req, res) => {
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=cancelled`);
};

// ─── SSLCommerz IPN (server-to-server notification) ──────────────────────────
// POST /api/payments/sslcommerz/ipn
// export const sslcommerzIPN = async (req, res) => {
//     try {
//         const { tran_id, val_id, status } = req.body;

//         if (status !== "VALID") return res.status(200).json({ received: true });

//         const sslcz = new SSLCommerzPayment(STORE_ID, STORE_PASS, IS_SANDBOX);
//         const validation = await sslcz.validate({ val_id });

//         if (validation?.status !== "VALID") return res.status(200).json({ received: true });

//         const order = await Order.findOne({ orderId: tran_id });
//         if (!order || order.paymentStatus === "paid") {
//             return res.status(200).json({ received: true });
//         }

//         order.paymentStatus = "paid";
//         order.transactionId = val_id;
//         order.paidAt = new Date();
//         order.orderStatus = "confirmed";
//         order.timeline.push({ status: "confirmed", message: "IPN payment confirmed", changedAt: new Date() });
//         await order.save();

//         return res.status(200).json({ received: true });
//     } catch (err) {
//         console.error("SSLCommerz IPN Error:", err.message);
//         return res.status(200).json({ received: true });
//     }
// };



export const sslcommerzFail = async (req, res) => {
    const { tran_id } = req.body;
    if (tran_id) {
        await Order.findOneAndUpdate(
            {
                $or: [
                    { orderId: tran_id },
                    { retryTranIds: tran_id }, // ← retry এর জন্য
                ]
            },
            { paymentStatus: "failed" }
        ).catch(console.error);
    }
    return res.redirect(`${process.env.FRONTEND_URL}/payment/failed?reason=payment_failed`);
};



export const sslcommerzIPN = async (req, res) => {
    try {
        const { tran_id, val_id, status } = req.body;
        if (status !== "VALID") return res.status(200).json({ received: true });

        const sslcz = new SSLCommerzPayment('testbox', 'qwerty', true);
        const validation = await sslcz.validate({ val_id });
        if (validation?.status !== "VALID") return res.status(200).json({ received: true });

        // ← retry support
        const order = await Order.findOne({
            $or: [
                { orderId: tran_id },
                { retryTranIds: tran_id },
            ]
        });

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