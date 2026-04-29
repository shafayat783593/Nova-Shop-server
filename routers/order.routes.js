
// ─── routes/order.routes.js ───────────────────────────────────────────────────
import express from "express";
import {
    placeOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    adminGetAllOrders,
    adminUpdateOrderStatus,
    adminAssignDeliveryBoy,
    adminGetOrderStats,
    buyNow,
} from "../controllers/order.controller.js";
import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

const orderRouter = express.Router();

// ── Customer routes ───────────────────────────────────────────────────────────
orderRouter.post("/", isAuth, placeOrder);
orderRouter.post("/buy-now", isAuth, buyNow);   // ← নতুন route

orderRouter.get("/my", isAuth, getMyOrders);

orderRouter.get("/:orderId", isAuth, getOrderById);

orderRouter.patch("/:orderId/cancel", isAuth, cancelOrder);

// ── Admin routes ──────────────────────────────────────────────────────────────
orderRouter.get("/admin/stats", isAuth, authorizeAdmin , adminGetOrderStats);
orderRouter.get("/admin/all", isAuth, authorizeAdmin, adminGetAllOrders);
orderRouter.patch("/admin/:orderId/status", isAuth, authorizeAdmin, adminUpdateOrderStatus);
orderRouter.patch("/admin/:orderId/assign", isAuth, authorizeAdmin, adminAssignDeliveryBoy);

export { orderRouter };