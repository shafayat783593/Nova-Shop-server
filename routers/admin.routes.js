import express from "express";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";
import {
    getAllUsers,
    getUserSessionsAdmin,
    logoutUserDeviceAdmin,
    logoutAllUserDevicesAdmin,
} from "../controllers/admin.controller.js";
import { getDashboardOverview } from "../controllers/admin.dashboard.controller.js";

const router = express.Router();

// ✅ সব admin route auth + admin role check করবে
router.use(isAuth, authorizeAdmin);

router.get("/users", getAllUsers);
router.get("/overview", isAuth,authorizeAdmin, getDashboardOverview);

router.get("/users/:userId/sessions", getUserSessionsAdmin);
router.delete("/users/:userId/sessions/:sessionId", logoutUserDeviceAdmin);
router.delete("/users/:userId/sessions", logoutAllUserDevicesAdmin);


export default router;