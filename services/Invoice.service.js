// services/invoice.service.js
import puppeteer from "puppeteer-core";
import Invoice, { buildInvoiceNo } from "../models/invoice.model.js";
import { buildInvoiceHTML } from "../config/html.js";
import sendMail from "../config/sendMail.js";

// ─── Chrome path ──────────────────────────────────────────────────────────────
function getChromePath() {
    return (
        process.env.CHROME_PATH ||
        (process.platform === "win32"
            ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            : process.platform === "darwin"
                ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                : "/usr/bin/google-chrome-stable")
    );
}

// ─── Generate PDF Buffer ──────────────────────────────────────────────────────
export  async function generateInvoicePDF(htmlData) {
    const html = buildInvoiceHTML(htmlData);

    const browser = await puppeteer.launch({
        executablePath: getChromePath(),
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

// ─── Build invoice data from Order ───────────────────────────────────────────
function buildInvoiceData(order, invoiceNo, userEmail = "") {
    const address = order.shippingAddress;
    const addressStr = [
        address?.addressLine,
        address?.area,
        address?.district,
        address?.division,
    ].filter(Boolean).join(", ");

    const items = (order.items || []).map(item => ({
        name: item.nameSnapshot,
        description: item.variant ? `Variant ID: ${item.variant}` : "",
        quantity: item.quantity,
        unitPrice: item.finalPrice,
        amount: item.finalPrice * item.quantity,
    }));

    return {
        invoiceNo,
        dateIssued: order.createdAt || new Date(),
        dueDate: null,
        paymentStatus: order.paymentStatus,
        customerName: address?.fullName || "Customer",
        customerEmail: userEmail,
        customerPhone: address?.phone || "",
        customerAddress: addressStr,
        items,
        subtotal: order.subtotal,
        discount: order.discount || 0,
        shippingFee: order.shippingFee || 0,
        total: order.total,
        paymentMethod: order.paymentMethod,
        transactionId: order.transactionId || null,
        paidAt: order.paidAt || null,
    };
}

// ─── Create & Save Invoice ────────────────────────────────────────────────────
export async function createInvoice(order, userEmail = "") {
    // Get last invoice to build sequential number
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 }).lean();
    const invoiceNo = buildInvoiceNo(lastInvoice?.invoiceNo);

    const invoiceDoc = await Invoice.create({
        invoiceNo,
        order: order._id,
        user: order.user || null,
        customerName: order.shippingAddress?.fullName || "",
        customerEmail: userEmail,
        customerPhone: order.shippingAddress?.phone || "",
        items: (order.items || []).map(item => ({
            name: item.nameSnapshot,
            quantity: item.quantity,
            unitPrice: item.finalPrice,
            amount: item.finalPrice * item.quantity,
        })),
        subtotal: order.subtotal,
        discount: order.discount || 0,
        shippingFee: order.shippingFee || 0,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        transactionId: order.transactionId || null,
        paidAt: order.paidAt || null,
        dateIssued: order.createdAt || new Date(),
    });

    return { invoiceDoc, invoiceNo };
}

// ─── Send Invoice Email ───────────────────────────────────────────────────────
export async function sendInvoiceEmail(order, userEmail = "") {
    try {
        // 1. Create invoice record
        const { invoiceDoc, invoiceNo } = await createInvoice(order, userEmail);

        // 2. Build HTML data
        const htmlData = buildInvoiceData(order, invoiceNo, userEmail);

        // 3. Generate PDF
        const pdfBuffer = await generateInvoicePDF(htmlData);

        // 4. Send email with attachment
        const toEmail = userEmail || order.guestInfo?.email;
        if (toEmail) {
            await sendMail({
                email: toEmail,
                subject: `Invoice #${invoiceNo} — Nova Shop`,
                html: `
                    <div style="font-family: 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff;">
                        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 40px; border-radius: 0 0 0 0;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: white;">N</div>
                                <span style="font-size: 20px; font-weight: 800; color: #ffffff;">Nova Shop</span>
                            </div>
                            <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin-top: 16px;">Your Invoice is Ready 🎉</h1>
                            <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Invoice #${invoiceNo}</p>
                        </div>
                        <div style="padding: 32px 40px;">
                            <p style="font-size: 15px; color: #334155; line-height: 1.6;">
                                Hi <strong>${order.shippingAddress?.fullName || "there"}</strong>,<br/><br/>
                                Thank you for your order! Your payment has been confirmed and your invoice is attached to this email as a PDF.
                            </p>
                            <div style="background: #f8fafc; border-radius: 12px; padding: 20px 24px; margin: 24px 0; border-left: 4px solid #ef4444;">
                                <p style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Order Summary</p>
                                <p style="font-size: 13px; color: #334155; margin: 3px 0;">Order ID: <strong style="color: #0f172a;">${order.orderId}</strong></p>
                                <p style="font-size: 13px; color: #334155; margin: 3px 0;">Invoice: <strong style="color: #0f172a;">#${invoiceNo}</strong></p>
                                <p style="font-size: 13px; color: #334155; margin: 3px 0;">Amount Paid: <strong style="color: #ef4444; font-size: 16px;">৳${Number(order.total).toFixed(2)}</strong></p>
                                <p style="font-size: 13px; color: #334155; margin: 3px 0;">Payment Method: <strong style="color: #0f172a; text-transform: uppercase;">${order.paymentMethod}</strong></p>
                            </div>
                            <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
                                The PDF invoice is attached below. If you have any questions, please contact us at 
                                <a href="mailto:support@novashop.com" style="color: #ef4444;">support@novashop.com</a>
                            </p>
                        </div>
                        <div style="background: #f8fafc; padding: 20px 40px; border-top: 1px solid #f1f5f9; text-align: center;">
                            <p style="font-size: 12px; color: #94a3b8;">© Nova Shop · Bangladesh</p>
                        </div>
                    </div>
                `,
                attachments: [
                    {
                        filename: `invoice-${invoiceNo}.pdf`,
                        content: pdfBuffer,
                        contentType: "application/pdf",
                    },
                ],
            });
        }

        // 5. Mark email sent
        await Invoice.findByIdAndUpdate(invoiceDoc._id, { emailSentAt: new Date() });

        return invoiceDoc;
    } catch (err) {
        console.error("Invoice Service Error:", err.message);
        throw err;
    }
}
