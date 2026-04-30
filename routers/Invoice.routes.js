import express from "express";
import {
    getInvoiceByOrderId,     // ✅ NEW — for order detail page
    getInvoiceByNo,
    downloadInvoicePDF,
    resendInvoiceEmail,
    getMyInvoices,
    adminGetAllInvoices,
    adminInvoiceStats,
} from "../controllers/Invoice.controller.js";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";

const invoiceRouter = express.Router();

// ── Static routes first (before /:invoiceNo param) ───────────────────────────
invoiceRouter.get("/my", isAuth, getMyInvoices);
invoiceRouter.get("/admin/stats", isAuth, authorizeAdmin, adminInvoiceStats);
invoiceRouter.get("/admin/all", isAuth, authorizeAdmin, adminGetAllInvoices);

// ✅ by-order/:orderId — order detail page uses this to find invoice
// orderId = MongoDB _id of the order
invoiceRouter.get("/by-order/:orderId", isAuth, getInvoiceByOrderId);

// ── Param routes last ─────────────────────────────────────────────────────────
invoiceRouter.post("/:invoiceNo/resend", isAuth, authorizeAdmin, resendInvoiceEmail);
invoiceRouter.get("/:invoiceNo/download", isAuth, downloadInvoicePDF);
invoiceRouter.get("/:invoiceNo", isAuth, getInvoiceByNo);

export { invoiceRouter };