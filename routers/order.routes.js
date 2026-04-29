import express from "express";
import {
    placeOrder,
    buyNow,
    getMyOrders,
    getOrderById,
    cancelOrder,
    adminGetAllOrders,
    adminUpdateOrderStatus,
    adminAssignDeliveryBoy,
    adminGetOrderStats,
} from "../controllers/order.controller.js";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";

const orderRouter = express.Router();

// ─── Customer routes ──────────────────────────────────────────────────────────

// ✅ Static routes MUST come before /:orderId param routes
orderRouter.get("/my", isAuth, getMyOrders);
orderRouter.post("/", isAuth, placeOrder);
orderRouter.post("/buy-now", isAuth, buyNow);          // ✅ before /:orderId

// ✅ Param routes after static ones
orderRouter.get("/:orderId", isAuth, getOrderById);
orderRouter.patch("/:orderId/cancel", isAuth, cancelOrder);

// ─── Admin routes ─────────────────────────────────────────────────────────────

// ✅ admin/stats and admin/all must be before admin/:orderId
orderRouter.get("/admin/stats", isAuth, authorizeAdmin, adminGetOrderStats);
orderRouter.get("/admin/all", isAuth, authorizeAdmin, adminGetAllOrders);
orderRouter.patch("/admin/:orderId/status", isAuth, authorizeAdmin, adminUpdateOrderStatus);
orderRouter.patch("/admin/:orderId/assign", isAuth, authorizeAdmin, adminAssignDeliveryBoy);

export { orderRouter };