import axios from "axios";
import Order from "../models/order.model.js";
import { sendInvoiceEmail } from "../services/invoice.service.js";
import { getIO } from "../socket.js";

// ─── bKash credentials from environment ──────────────────────────────────────
const BKASH = {
    username: process.env.bkash_username,
    password: process.env.bkash_password,
    apiKey: process.env.bkash_api_key,
    secretKey: process.env.bkash_secret_key,
    grantTokenUrl: process.env.bkash_grant_token_url,
    createPaymentUrl: process.env.bkash_create_payment_url,
    executePaymentUrl: process.env.bkash_execute_payment_url,
};

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── Step 1: Get bKash token ──────────────────────────────────────────────────
const getBkashToken = async () => {
    const { data } = await axios.post(
        BKASH.grantTokenUrl,
        { app_key: BKASH.apiKey, app_secret: BKASH.secretKey },
        {
            headers: {
                "Content-Type": "application/json",
                username: BKASH.username,
                password: BKASH.password,
            },
        }
    );

    if (!data?.id_token) throw new Error("Failed to get bKash token");
    return data.id_token;
};

// ─── Step 2: Create payment ───────────────────────────────────────────────────
// POST /api/payments/bkash/create
// Body: { orderId: "ORD-XXXXXX" }
export const bkashCreatePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return sendError(res, "orderId is required", 400);

        const order = await Order.findOne({ orderId });
        if (!order) return sendError(res, "Order not found", 404);

        if (order.paymentStatus === "paid") {
            return sendError(res, "Order is already paid", 400);
        }

        const token = await getBkashToken();

        const callbackURL = `${process.env.BACKEND_URL}/api/payments/bkash/callback`;

        const { data } = await axios.post(
            BKASH.createPaymentUrl,
            {
                mode: "0011",
                payerReference: order.orderId,
                callbackURL,
                amount: String(order.total),
                currency: "BDT",
                intent: "sale",
                merchantInvoiceNumber: order.orderId,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token,
                    "X-APP-Key": BKASH.apiKey,
                },
            }
        );

        if (data?.statusCode !== "0000") {
            return sendError(res, data?.statusMessage || "bKash payment creation failed", 400);
        }

        return res.status(200).json({
            success: true,
            data: {
                bkashURL: data.bkashURL,
                paymentID: data.paymentID,
            },
        });
    } catch (err) {
        console.error("bKash Create Error:", err.response?.data || err.message);
        return sendError(res, "bKash payment initiation failed");
    }
};

// ─── Step 3: Execute payment (callback from bKash) ────────────────────────────
// GET /api/payments/bkash/callback?paymentID=xxx&status=success
export const bkashCallback = async (req, res) => {
    const { paymentID, status } = req.query;

    // Redirect URLs (Next.js frontend pages)
    const SUCCESS_URL = `${process.env.FRONTEND_URL}/payment/success`;
    const FAIL_URL = `${process.env.FRONTEND_URL}/payment/failed`;

    if (status !== "success" || !paymentID) {
        return res.redirect(`${FAIL_URL}?reason=cancelled`);
    }

    try {
        const token = await getBkashToken();

        const { data } = await axios.post(
            BKASH.executePaymentUrl,
            { paymentID },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token,
                    "X-APP-Key": BKASH.apiKey,
                },
            }
        );

        if (data?.statusCode !== "0000" || data?.transactionStatus !== "Completed") {
            return res.redirect(`${FAIL_URL}?reason=payment_not_completed`);
        }

        // ── Mark order as paid ────────────────────────────────────────────
        const order = await Order.findOne({ orderId: data.merchantInvoiceNumber });
        if (!order) return res.redirect(`${FAIL_URL}?reason=order_not_found`);

        order.paymentStatus = "paid";
        order.transactionId = data.trxID;
        order.paidAt = new Date();
        order.orderStatus = "confirmed";

        order.timeline.push({
            status: "confirmed",
            message: `Payment received via bKash. TrxID: ${data.trxID}`,
            changedAt: new Date(),
        });

        await order.save();

        // ── Notify admin + customer via Socket ────────────────────────────
        const io = getIO();
        io.to("adminRoom").emit("order:paid", { orderId: order.orderId, total: order.total });
        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: "confirmed",
            message: "Payment confirmed! Your order is being processed.",
        });

        // ── Generate & send invoice ───────────────────────────────────────
        await sendInvoiceEmail(order).catch(console.error);
        order.invoiceSentAt = new Date();
        await order.save();

        return res.redirect(`${SUCCESS_URL}?orderId=${order.orderId}`);
    } catch (err) {
        console.error("bKash Callback Error:", err.response?.data || err.message);
        return res.redirect(`${FAIL_URL}?reason=server_error`);
    }
};