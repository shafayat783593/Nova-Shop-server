import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import { generateInvoicePDF } from "../services/invoice.service.js";
import { sendInvoiceEmail } from "../services/invoice.service.js";

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── GET /api/invoices/by-order/:orderId ──────────────────────────────────────
// orderId here is the MongoDB _id of the order (not the human-readable ORD-XXXX)
// Called from order detail page to find the invoice for a specific order
export const getInvoiceByOrderId = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ order: req.params.orderId })
            .populate("order", "orderId")
            .lean();

        if (!invoice) {
            // Not an error — invoice just doesn't exist yet
            return res.status(200).json({ success: true, data: null });
        }

        // Security: customers can only see their own invoices
        if (
            req.user.role !== "admin" &&
            invoice.user?.toString() !== req.user._id.toString()
        ) {
            return sendError(res, "Forbidden", 403);
        }

        return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET /api/invoices/:invoiceNo ─────────────────────────────────────────────
export const getInvoiceByNo = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo })
            .populate("order", "orderId")
            .lean();

        if (!invoice) return sendError(res, "Invoice not found", 404);

        if (
            req.user.role !== "admin" &&
            invoice.user?.toString() !== req.user._id.toString()
        ) {
            return sendError(res, "Forbidden", 403);
        }

        return res.status(200).json({ success: true, data: invoice });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET /api/invoices/:invoiceNo/download ────────────────────────────────────
export const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo })
            .populate("order", "orderId paymentMethod")
            .lean();

        if (!invoice) return sendError(res, "Invoice not found", 404);

        if (
            req.user.role !== "admin" &&
            invoice.user?.toString() !== req.user._id.toString()
        ) {
            return sendError(res, "Forbidden", 403);
        }

        // Generate fresh PDF on demand
        const pdfBuffer = await generateInvoicePDF(invoice);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (err) {
        console.error("PDF generation error:", err.message);
        return sendError(res, "Failed to generate PDF");
    }
};

// ─── POST /api/invoices/:invoiceNo/resend ─────────────────────────────────────
export const resendInvoiceEmail = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ invoiceNo: req.params.invoiceNo })
            .populate("order")
            .lean();

        if (!invoice) return sendError(res, "Invoice not found", 404);

        const toEmail = invoice.customerEmail;
        if (!toEmail) return sendError(res, "No email address on record", 400);

        await sendInvoiceEmail(invoice.order, toEmail);

        return res.status(200).json({ success: true, message: "Invoice email resent" });
    } catch (err) {
        console.error("Resend error:", err.message);
        return sendError(res, "Failed to resend invoice email");
    }
};

// ─── GET /api/invoices/my ─────────────────────────────────────────────────────
export const getMyInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 15, paymentStatus, search } = req.query;

        const filter = { user: req.user._id };
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { invoiceNo: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort("-createdAt")
                .skip(skip)
                .limit(Number(limit))
                .populate("order", "orderId")
                .lean(),
            Invoice.countDocuments(filter),
        ]);

        return res.status(200).json({
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

// ─── GET /api/invoices/admin/all ──────────────────────────────────────────────
export const adminGetAllInvoices = async (req, res) => {
    try {
        const {
            page = 1, limit = 15,
            paymentStatus, search,
            sort = "-createdAt",
        } = req.query;

        const filter = {};
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { invoiceNo: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
                { customerPhone: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .populate("order", "orderId")
                .lean(),
            Invoice.countDocuments(filter),
        ]);

        return res.status(200).json({
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

// ─── GET /api/invoices/admin/stats ────────────────────────────────────────────
export const adminInvoiceStats = async (req, res) => {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [total, thisMonth, byStatus, revenueAgg] = await Promise.all([
            Invoice.countDocuments(),
            Invoice.countDocuments({ createdAt: { $gte: monthStart } }),
            Invoice.aggregate([
                { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
            ]),
            Invoice.aggregate([
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),
        ]);

        const statusMap = Object.fromEntries(byStatus.map(s => [s._id, s.count]));

        return res.status(200).json({
            success: true,
            data: {
                total,
                thisMonth,
                byStatus: statusMap,
                totalRevenue: revenueAgg[0]?.total || 0,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};