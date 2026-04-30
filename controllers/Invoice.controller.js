// controllers/invoice.controller.js
import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import {  sendInvoiceEmail } from "../services/invoice.service.js";
import { buildInvoiceHTML } from "../config/html.js";
import generateInvoicePDF from "../services/invoice.service.js";

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── ADMIN: GET ALL INVOICES ──────────────────────────────────────────────────
// GET /api/invoices?page=1&limit=20&search=NS&status=paid
export const adminGetAllInvoices = async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            search, paymentStatus,
            sort = "-createdAt",
        } = req.query;

        const filter = {};
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { invoiceNo: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                { customerEmail: { $regex: search, $options: "i" } },
                { customerPhone: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .populate("order", "orderId orderStatus paymentMethod")
                .populate("user", "name email")
                .lean(),
            Invoice.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            data: invoices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: GET SINGLE INVOICE ────────────────────────────────────────────────
// GET /api/invoices/:invoiceNo
export const getInvoiceByNo = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo })
            .populate("order", "orderId orderStatus")
            .populate("user", "name email")
            .lean();

        if (!invoice) return sendError(res, "Invoice not found", 404);

        // Non-admin can only see their own
        if (req.user.role !== "admin" && invoice.user?._id?.toString() !== req.user._id.toString()) {
            return sendError(res, "Forbidden", 403);
        }

        return res.json({ success: true, data: invoice });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── DOWNLOAD INVOICE PDF ─────────────────────────────────────────────────────
// GET /api/invoices/:invoiceNo/download
export const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo }).lean();
        if (!invoice) return sendError(res, "Invoice not found", 404);

        // Permission check
        if (req.user.role !== "admin" && invoice.user?.toString() !== req.user._id.toString()) {
            return sendError(res, "Forbidden", 403);
        }

        // Build HTML data from invoice doc
        const htmlData = {
            invoiceNo: invoice.invoiceNo,
            dateIssued: invoice.dateIssued,
            dueDate: invoice.dueDate,
            paymentStatus: invoice.paymentStatus,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            customerPhone: invoice.customerPhone,
            customerAddress: "",
            items: invoice.items,
            subtotal: invoice.subtotal,
            discount: invoice.discount,
            shippingFee: invoice.shippingFee,
            total: invoice.total,
            paymentMethod: invoice.paymentMethod,
            transactionId: invoice.transactionId,
            paidAt: invoice.paidAt,
        };

        const pdfBuffer = await generateInvoicePDF(htmlData);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`);
        res.setHeader("Content-Length", pdfBuffer.length);
        return res.send(pdfBuffer);
    } catch (err) {
        console.error("PDF Download Error:", err.message);
        return sendError(res, "PDF generation failed");
    }
};

// ─── RESEND INVOICE EMAIL ─────────────────────────────────────────────────────
// POST /api/invoices/:invoiceNo/resend
export const resendInvoiceEmail = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo });
        if (!invoice) return sendError(res, "Invoice not found", 404);

        const order = await Order.findById(invoice.order).lean();
        if (!order) return sendError(res, "Order not found", 404);

        const email = invoice.customerEmail || req.body.email;
        if (!email) return sendError(res, "Customer email not found", 400);

        await sendInvoiceEmail(order, email);

        return res.json({ success: true, message: "Invoice email resent successfully" });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── CUSTOMER: GET MY INVOICES ────────────────────────────────────────────────
// GET /api/invoices/my
export const getMyInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [invoices, total] = await Promise.all([
            Invoice.find({ user: req.user._id })
                .sort("-createdAt")
                .skip(skip)
                .limit(Number(limit))
                .populate("order", "orderId orderStatus")
                .lean(),
            Invoice.countDocuments({ user: req.user._id }),
        ]);

        return res.json({
            success: true,
            data: invoices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: STATS ─────────────────────────────────────────────────────────────
// GET /api/invoices/stats
export const adminInvoiceStats = async (req, res) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [total, thisMonth, byStatus, revenue] = await Promise.all([
            Invoice.countDocuments(),
            Invoice.countDocuments({ createdAt: { $gte: monthStart } }),
            Invoice.aggregate([{ $group: { _id: "$paymentStatus", count: { $sum: 1 } } }]),
            Invoice.aggregate([
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),
        ]);

        return res.json({
            success: true,
            data: {
                total,
                thisMonth,
                byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
                totalRevenue: revenue[0]?.total || 0,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};