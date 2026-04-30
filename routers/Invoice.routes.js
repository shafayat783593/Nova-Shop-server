// routers/invoice.routes.js
import express from "express";
import {
    adminGetAllInvoices,
    getInvoiceByNo,
    downloadInvoicePDF,
    resendInvoiceEmail,
    getMyInvoices,
    adminInvoiceStats,
} from "../controllers/Invoice.controller.js";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";

const invoiceRouter = express.Router();

// ── Customer routes ───────────────────────────────────────────────────────────
invoiceRouter.get("/my", isAuth, getMyInvoices);
invoiceRouter.get("/:invoiceNo", isAuth, getInvoiceByNo);
invoiceRouter.get("/:invoiceNo/download", isAuth, downloadInvoicePDF);

// ── Admin routes ──────────────────────────────────────────────────────────────
invoiceRouter.get("/admin/stats", isAuth, authorizeAdmin, adminInvoiceStats);
invoiceRouter.get("/admin/all", isAuth, authorizeAdmin, adminGetAllInvoices);
invoiceRouter.post("/:invoiceNo/resend", isAuth, authorizeAdmin, resendInvoiceEmail);

export { invoiceRouter };