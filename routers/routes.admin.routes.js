import express from "express";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";
import {
    getAllUsers,
    getUserSessionsAdmin,
    logoutUserDeviceAdmin,
    logoutAllUserDevicesAdmin,
} from "../controllers/admin.controller.js";

const router = express.Router();

// ✅ সব admin route auth + admin role check করবে
router.use(isAuth, authorizeAdmin);

router.get("/users", getAllUsers);
router.get("/users/:userId/sessions", getUserSessionsAdmin);
router.delete("/users/:userId/sessions/:sessionId", logoutUserDeviceAdmin);
router.delete("/users/:userId/sessions", logoutAllUserDevicesAdmin);

export default router;