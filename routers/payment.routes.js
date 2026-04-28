// ─── routes/payment.routes.js ─────────────────────────────────────────────────
import express from "express";
import { bkashCreatePayment, bkashCallback } from "../controllers/Baksh.controller.js"
import {
    sslcommerzInit,
    sslcommerzSuccess,
    sslcommerzFail,
    sslcommerzCancel,
    sslcommerzIPN,
} from "../controllers/sslcommerz.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const paymentRouter = express.Router();

// ── bKash ─────────────────────────────────────────────────────────────────────
paymentRouter.post("/bkash/create", isAuth, bkashCreatePayment);
paymentRouter.get("/bkash/callback", bkashCallback);     // bKash redirects here

// ── SSLCommerz ────────────────────────────────────────────────────────────────
paymentRouter.post("/sslcommerz/init", isAuth, sslcommerzInit);
paymentRouter.post("/sslcommerz/success", sslcommerzSuccess);
paymentRouter.post("/sslcommerz/fail", sslcommerzFail);
paymentRouter.post("/sslcommerz/cancel", sslcommerzCancel);
paymentRouter.post("/sslcommerz/ipn", sslcommerzIPN);

export { paymentRouter };
