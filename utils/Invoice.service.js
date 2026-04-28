import nodemailer from "nodemailer";
import Order from "../models/order.model.js";

// ─── Email transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ─── Format currency ──────────────────────────────────────────────────────────
const taka = (amount) => `৳${Number(amount || 0).toLocaleString("en-BD")}`;

// ─── Format date ──────────────────────────────────────────────────────────────
const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

// ─── Generate invoice HTML ────────────────────────────────────────────────────
export const generateInvoiceHTML = (order) => {
    const itemRows = order.items
        .map(
            (item) => `
            <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">
                    <div style="font-weight:600;color:#1a1a1a;">${item.nameSnapshot}</div>
                    ${item.variant ? `<div style="font-size:12px;color:#888;">Variant: ${item.variant}</div>` : ""}
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#555;">
                    ${item.quantity}
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#555;">
                    ${taka(item.priceAtOrder)}
                </td>
                <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#1a1a1a;">
                    ${taka(item.finalPrice * item.quantity)}
                </td>
            </tr>
        `
        )
        .join("");

    const paymentMethodLabel = {
        bkash: "bKash",
        sslcommerz: "SSL Commerce (Card/Mobile)",
        cod: "Cash on Delivery",
    }[order.paymentMethod] || order.paymentMethod;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>Invoice ${order.orderId}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">

<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1a1a2e;padding:36px 40px;color:#ffffff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
                <h1 style="margin:0 0 4px;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                    ${process.env.STORE_NAME || "Your Store"}
                </h1>
                <p style="margin:0;color:#a0a0c0;font-size:14px;">
                    ${process.env.STORE_ADDRESS || ""}
                </p>
            </div>
            <div style="text-align:right;">
                <div style="font-size:13px;color:#a0a0c0;margin-bottom:4px;">INVOICE</div>
                <div style="font-size:20px;font-weight:700;letter-spacing:1px;">${order.orderId}</div>
                <div style="font-size:13px;color:#a0a0c0;margin-top:4px;">${formatDate(order.createdAt)}</div>
            </div>
        </div>
    </div>

    <!-- Status badge -->
    <div style="background:#f0faf4;padding:14px 40px;border-bottom:1px solid #e8f5e9;">
        <span style="display:inline-block;background:#22c55e;color:#fff;font-size:12px;font-weight:700;letter-spacing:0.5px;padding:4px 14px;border-radius:20px;text-transform:uppercase;">
            Payment Confirmed
        </span>
        <span style="margin-left:12px;color:#555;font-size:13px;">
            via ${paymentMethodLabel}
            ${order.transactionId ? `&nbsp;·&nbsp; TrxID: <strong>${order.transactionId}</strong>` : ""}
        </span>
    </div>

    <!-- Billing & Shipping -->
    <div style="display:flex;gap:0;padding:32px 40px;border-bottom:1px solid #f0f0f0;">
        <div style="flex:1;padding-right:24px;">
            <h3 style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;">
                Ship To
            </h3>
            <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">${order.shippingAddress.fullName}</p>
            <p style="margin:4px 0 0;color:#555;font-size:14px;line-height:1.6;">
                ${order.shippingAddress.addressLine}<br/>
                ${order.shippingAddress.area}, ${order.shippingAddress.district}<br/>
                ${order.shippingAddress.division}
                ${order.shippingAddress.postalCode ? ` - ${order.shippingAddress.postalCode}` : ""}
            </p>
            <p style="margin:8px 0 0;color:#555;font-size:14px;">
                Phone: ${order.shippingAddress.phone}
            </p>
        </div>
        <div style="flex:1;padding-left:24px;border-left:1px solid #f0f0f0;">
            <h3 style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;">
                Order Details
            </h3>
            <table style="width:100%;font-size:14px;color:#555;">
                <tr>
                    <td style="padding:3px 0;">Order ID</td>
                    <td style="padding:3px 0;text-align:right;font-weight:600;color:#1a1a1a;">${order.orderId}</td>
                </tr>
                <tr>
                    <td style="padding:3px 0;">Date</td>
                    <td style="padding:3px 0;text-align:right;">${formatDate(order.createdAt)}</td>
                </tr>
                <tr>
                    <td style="padding:3px 0;">Payment</td>
                    <td style="padding:3px 0;text-align:right;">${paymentMethodLabel}</td>
                </tr>
                <tr>
                    <td style="padding:3px 0;">Status</td>
                    <td style="padding:3px 0;text-align:right;color:#22c55e;font-weight:600;">Paid</td>
                </tr>
            </table>
        </div>
    </div>

    <!-- Items table -->
    <div style="padding:0 40px 8px;">
        <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <thead>
                <tr style="background:#f8f8f8;">
                    <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Product</th>
                    <th style="padding:12px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Qty</th>
                    <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Unit Price</th>
                    <th style="padding:12px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#888;font-weight:600;">Total</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>
    </div>

    <!-- Totals -->
    <div style="padding:8px 40px 32px;">
        <table style="width:100%;border-collapse:collapse;">
            <tr>
                <td colspan="2" style="border-top:2px solid #f0f0f0;"></td>
            </tr>
            <tr>
                <td style="padding:6px 12px 6px 0;color:#555;font-size:14px;">Subtotal</td>
                <td style="padding:6px 0;text-align:right;font-size:14px;color:#1a1a1a;">${taka(order.subtotal)}</td>
            </tr>
            ${order.discount > 0 ? `
            <tr>
                <td style="padding:6px 12px 6px 0;color:#22c55e;font-size:14px;">Discount</td>
                <td style="padding:6px 0;text-align:right;font-size:14px;color:#22c55e;">-${taka(order.discount)}</td>
            </tr>` : ""}
            ${order.appliedCoupon?.code ? `
            <tr>
                <td style="padding:6px 12px 6px 0;color:#22c55e;font-size:14px;">Coupon (${order.appliedCoupon.code})</td>
                <td style="padding:6px 0;text-align:right;font-size:14px;color:#22c55e;">-${taka(order.appliedCoupon.discountAmount)}</td>
            </tr>` : ""}
            <tr>
                <td style="padding:6px 12px 6px 0;color:#555;font-size:14px;">Shipping</td>
                <td style="padding:6px 0;text-align:right;font-size:14px;color:#1a1a1a;">
                    ${order.shippingFee === 0 ? '<span style="color:#22c55e;">FREE</span>' : taka(order.shippingFee)}
                </td>
            </tr>
            <tr>
                <td style="padding:14px 12px 14px 0;font-size:18px;font-weight:700;color:#1a1a1a;border-top:2px solid #1a1a2e;">
                    Total
                </td>
                <td style="padding:14px 0;text-align:right;font-size:20px;font-weight:700;color:#1a1a2e;border-top:2px solid #1a1a2e;">
                    ${taka(order.total)}
                </td>
            </tr>
        </table>
    </div>

    <!-- Footer -->
    <div style="background:#f8f8f8;padding:24px 40px;text-align:center;border-top:1px solid #f0f0f0;">
        <p style="margin:0;color:#888;font-size:13px;">
            Thank you for shopping with us! For support, contact
            <a href="mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}" style="color:#4f46e5;">
                ${process.env.SUPPORT_EMAIL || "support@example.com"}
            </a>
        </p>
        <p style="margin:8px 0 0;color:#bbb;font-size:12px;">
            This is a computer-generated invoice. No signature required.
        </p>
    </div>

</div>
</body>
</html>
    `.trim();
};

// ─── Send invoice email ───────────────────────────────────────────────────────
export const sendInvoiceEmail = async (order) => {
    // Populate user email if not present
    let email = order.user?.email || order.guestInfo?.email;

    if (!email && order.user) {
        const { default: User } = await import("../models/user.model.js");
        const user = await User.findById(order.user).select("email name").lean();
        email = user?.email;
    }

    if (!email) {
        console.warn(`No email found for order ${order.orderId} — invoice not sent`);
        return;
    }

    const html = generateInvoiceHTML(order);

    await transporter.sendMail({
        from: `"${process.env.STORE_NAME || "Store"}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Invoice for Order ${order.orderId} — Payment Confirmed`,
        html,
    });

    console.log(`Invoice sent to ${email} for order ${order.orderId}`);
};