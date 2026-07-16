// routes/delivery.routes.js
import express from "express";
import {
    // Admin
    adminInviteDeliveryBoy,
    adminGetDeliveryBoys,
    adminGetDeliveryBoyById,
    adminToggleActive,
    adminUpdateDeliveryBoy,
    adminDeleteDeliveryBoy,
    // Setup (public — invite link)
    validateInviteToken,
    deliveryBoySetup,
    // Delivery boy auth
    deliveryBoyLogin,
    // Delivery boy dashboard
    getMyDeliveries,
    updateLocation,
    markDelivered,
    toggleAvailability,
    getDeliveryProfile,
    respondToAssignment,
    adminSearchUsers,
    adminPromoteToDeliveryBoy,
} from "../controllers/Deliveryboy.controller.js";
import { authorizeAdmin, isAuth, isDeliveryBoy } from "../middlewares/isAuth.js";



const router = express.Router();

// ══════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth needed)
// ══════════════════════════════════════════════════════════════════

// Delivery boy validates their invite token
// GET /api/delivery/setup/:token
router.get("/setup/:token", validateInviteToken);

// Delivery boy sets their password using invite token
// POST /api/delivery/setup
router.post("/setup", deliveryBoySetup);

// Delivery boy login
// POST /api/delivery/login
router.post("/login", deliveryBoyLogin);


// ══════════════════════════════════════════════════════════════════
//  DELIVERY BOY ROUTES (isAuth + isDeliveryBoy)
// ══════════════════════════════════════════════════════════════════

// GET /api/delivery/profile
router.get("/profile", isAuth, isDeliveryBoy, getDeliveryProfile);

// GET /api/delivery/orders
router.get("/orders", isAuth, isDeliveryBoy, getMyDeliveries);

// PATCH /api/delivery/location
router.patch("/location", isAuth, isDeliveryBoy, updateLocation);
router.patch("/orders/:orderId/respond", isAuth, isDeliveryBoy, respondToAssignment);

// PATCH /api/delivery/availability
router.patch("/availability", isAuth, isDeliveryBoy, toggleAvailability);

// PATCH /api/delivery/orders/:orderId/delivered
router.patch("/orders/:orderId/delivered", isAuth, isDeliveryBoy, markDelivered);


// ══════════════════════════════════════════════════════════════════
//  ADMIN ROUTES (isAuth + isAdmin)
// ══════════════════════════════════════════════════════════════════

// POST /api/admin/delivery-boys/invite
router.post("/admin/delivery-boys/invite", isAuth, authorizeAdmin, adminInviteDeliveryBoy);

// GET /api/admin/delivery-boys?search=&isActive=&isAvailable=
router.get("/admin/delivery-boys", isAuth, authorizeAdmin, adminGetDeliveryBoys);

// GET /api/admin/delivery-boys/:deliveryBoyId
router.get("/admin/delivery-boys/:deliveryBoyId", isAuth, authorizeAdmin, adminGetDeliveryBoyById);

// PATCH /api/admin/delivery-boys/:deliveryBoyId
router.patch("/admin/delivery-boys/:deliveryBoyId", isAuth, authorizeAdmin, adminUpdateDeliveryBoy);

// PATCH /api/admin/delivery-boys/:deliveryBoyId/toggle-active
router.patch("/admin/delivery-boys/:deliveryBoyId/toggle-active", isAuth, authorizeAdmin, adminToggleActive);

// DELETE /api/admin/delivery-boys/:deliveryBoyId
router.delete("/admin/delivery-boys/:deliveryBoyId", isAuth, authorizeAdmin, adminDeleteDeliveryBoy);

router.get("/admin/users/search", isAuth, authorizeAdmin, adminSearchUsers);
router.post("/admin/delivery-boys/promote", isAuth, authorizeAdmin, adminPromoteToDeliveryBoy);

export default router;
