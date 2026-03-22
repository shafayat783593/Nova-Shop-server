import express from "express";
import {
    getSettings,
    changePassword,
    toggleTwoFactor,
    updateProfile,
    updateNotifications,   // ✅ added
    deleteAccount,
    logOutAllDevices,
    logoutSession,
    getActiveSessions,
} from "../controllers/settings.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

router.get("/", isAuth, getSettings);
router.put("/profile", isAuth, updateProfile);
router.put("/password", isAuth, changePassword);
router.put("/2fa", isAuth, toggleTwoFactor);
router.put("/notifications", isAuth, updateNotifications);   // ✅ added
router.get("/sessions", isAuth, getActiveSessions);
router.delete("/sessions/:sessionId", isAuth, logoutSession);
router.delete("/logout-all", isAuth, logOutAllDevices);
router.delete("/account", isAuth, deleteAccount);

export default router;