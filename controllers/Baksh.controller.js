import axios from "axios";
import Order from "../models/order.model.js";
import { sendInvoiceEmail } from "../services/Invoice.service.js";

import { getIO } from "../socket/socket.js";

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ✅ Lazy — প্রতিবার call হলে fresh env পড়বে
const getBKASH = () => ({
    username: process.env.bkash_username,
    password: process.env.bkash_password,
    apiKey: process.env.bkash_api_key,
    secretKey: process.env.bkash_secret_key,
    grantTokenUrl: process.env.bkash_grant_token_url,
    createPaymentUrl: process.env.bkash_create_payment_url,
    executePaymentUrl: process.env.bkash_execute_payment_url,
});

const getBkashToken = async () => {
    const BKASH = getBKASH();
    console.log("🔐 Getting bKash token...");
    console.log("   username:", BKASH.username);
    console.log("   grantTokenUrl:", BKASH.grantTokenUrl);

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

    console.log("🔐 Token response:", JSON.stringify(data, null, 2));
    if (!data?.id_token) throw new Error("Failed to get bKash token");
    return data.id_token;
};

export const bkashCreatePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return sendError(res, "orderId is required", 400);

        const order = await Order.findOne({ orderId });
        if (!order) return sendError(res, "Order not found", 404);
        if (order.paymentStatus === "paid") return sendError(res, "Order is already paid", 400);

        let token;
        try {
            token = await getBkashToken();
            console.log("✅ bKash token received");
        } catch (tokenErr) {
            console.error("❌ Token Error:", tokenErr.response?.data || tokenErr.message);
            return sendError(res, "bKash token failed: " + (tokenErr.response?.data?.statusMessage || tokenErr.message), 400);
        }

        const BKASH = getBKASH();
        const callbackURL = `${process.env.BACKEND_URL}/api/payments/bkash/callback`;
        console.log("📍 Callback URL:", callbackURL);

        let createData;
        try {
            const response = await axios.post(
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
            createData = response.data;
            console.log("📦 bKash Create Response:", JSON.stringify(createData, null, 2));
        } catch (createErr) {
            console.error("❌ Create Payment Error:", createErr.response?.data || createErr.message);
            return sendError(res, "bKash create failed: " + (createErr.response?.data?.statusMessage || createErr.message), 400);
        }

        if (createData?.statusCode !== "0000") {
            return sendError(res, createData?.statusMessage || "bKash payment creation failed", 400);
        }

        return res.status(200).json({
            success: true,
            data: { bkashURL: createData.bkashURL, paymentID: createData.paymentID },
        });
    } catch (err) {
        console.error("❌ bKash Unexpected Error:", err.response?.data || err.message);
        return sendError(res, "bKash payment initiation failed");
    }
};


export const bkashCallback = async (req, res) => {
    const { paymentID, status } = req.query;
    const SUCCESS_URL = `${process.env.FRONTEND_URL}/payment/success`;
    const FAIL_URL = `${process.env.FRONTEND_URL}/payment/failed`;

    if (status !== "success" || !paymentID) {
        return res.redirect(`${FAIL_URL}?reason=cancelled`);
    }

    try {
        const BKASH = getBKASH();
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

        // ✅ সম্পূর্ণ response লগ করো — আসলে কী আসছে দেখো
        console.log("🔍 bKash Execute Response:", JSON.stringify(data, null, 2));

        // ✅ statusCode চেক করো, transactionStatus "Complete" বা "Completed" দুটোই accept করো
        if (data?.statusCode !== "0000") {
            console.error("❌ bKash statusCode:", data?.statusCode, data?.statusMessage);
            return res.redirect(`${FAIL_URL}?reason=payment_not_completed`);
        }

        // ✅ transactionStatus "Complete" এবং "Completed" দুটোই handle করো
        const txStatus = data?.transactionStatus || "";
        const isCompleted = txStatus === "Completed" || txStatus === "Complete";

        if (!isCompleted) {
            console.error("❌ bKash transactionStatus:", txStatus);
            return res.redirect(`${FAIL_URL}?reason=payment_not_completed`);
        }

        // ✅ merchantInvoiceNumber দিয়ে order খোঁজো
        const invoiceNumber = data.merchantInvoiceNumber;
        if (!invoiceNumber) {
            console.error("❌ merchantInvoiceNumber missing in response");
            return res.redirect(`${FAIL_URL}?reason=order_not_found`);
        }

        const order = await Order.findOne({ orderId: invoiceNumber })
            .populate("user", "email name");

        if (!order) {
            console.error("❌ Order not found for orderId:", invoiceNumber);
            return res.redirect(`${FAIL_URL}?reason=order_not_found`);
        }

        // ✅ Already paid হলে double processing এড়াও
        if (order.paymentStatus === "paid") {
            return res.redirect(`${SUCCESS_URL}?orderId=${order.orderId}`);
        }

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

        const io = getIO();
        io.to("adminRoom").emit("order:paid", { orderId: order.orderId, total: order.total });
        io.to(`user_${order.user?._id}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: "confirmed",
            message: "Payment confirmed! Your order is being processed.",
        });

        const userEmail = order.user?.email || order.guestInfo?.email || "";
        try {
            await sendInvoiceEmail(order, userEmail);
            console.log("✅ Invoice email sent to:", userEmail);
            order.invoiceSentAt = new Date();
            await order.save();
        } catch (emailErr) {
            console.error("❌ Invoice email failed:", emailErr.message);
            // email fail হলেও payment success redirect করো
        }

        return res.redirect(`${SUCCESS_URL}?orderId=${order.orderId}`);

    } catch (err) {
        console.error("bKash Callback Error:", err.response?.data || err.message);
        return res.redirect(`${FAIL_URL}?reason=server_error`);
    }
};
