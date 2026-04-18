import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import TryCatch from "../middlewares/TryCatch.js";
import { redisClint } from "../index.js";
import {
    getAllSessions,
    revokeRefreshToken,
    revokeSession,          // ✅ FIXED: was missing
} from "../config/generateToken.js";

// ── GET current user settings ──────────────────────────────
export const getSettings = TryCatch(async (req, res) => {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user });
});

// ── UPDATE PROFILE ─────────────────────────────────────────
export const updateProfile = TryCatch(async (req, res) => {
    const { name, avatar } = req.body;
    const updates = {};

    if (typeof name === "string") {
        const trimmedName = name.trim();
        if (trimmedName.length === 0)
            return res.status(400).json({ message: "Name cannot be empty" });
        updates.name = trimmedName;
    }

    if (avatar !== undefined) {
        updates.avatar = avatar || null;
    }

    if (Object.keys(updates).length === 0)
        return res.status(400).json({ message: "No data provided to update" });

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select("-password");

    // ✅ Invalidate user cache
    await redisClint.del(`user:${req.user._id}`);

    res.status(200).json({ message: "Profile updated", user });
});

// ── CHANGE PASSWORD ────────────────────────────────────────
export const changePassword = TryCatch(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
        return res.status(400).json({ message: "All fields are required" });

    if (newPassword.length < 6)
        return res.status(400).json({ message: "New password must be at least 6 characters" });

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
        return res.status(401).json({ message: "Current password is incorrect" });

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame)
        return res.status(400).json({ message: "New password cannot be same as current" });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save({ validateModifiedOnly: true });

    // ✅ Revoke all other sessions after password change (security best practice)
    const currentSessionId = req.sessionId;
    const allSessions = await redisClint.sMembers(`sessions:${req.user._id}`);
    for (const sid of allSessions) {
        if (sid !== currentSessionId) {
            await revokeSession(req.user._id, sid);
        }
    }

    res.status(200).json({ message: "Password changed successfully" });
});

// ── TOGGLE 2FA ─────────────────────────────────────────────
export const toggleTwoFactor = TryCatch(async (req, res, next) => {
    const userId = req.user._id; // Use optional chaining to prevent crashes
console.log("Toggling 2FA for user:", userId);
    console.log("USER:", req.user);
    console.log("SESSION:", req.sessionId);
    if (!userId) {
        return res.status(401).json({ message: "Not authorized, no user ID" });
    }

    const user = await User.findById(userId);

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    user.twoFactorEnabled = !user.twoFactorEnabled;
    await user.save();

    res.status(200).json({
        success: true,
        message: `Two-factor authentication ${user.twoFactorEnabled ? "enabled" : "disabled"}`,
        twoFactorEnabled: user.twoFactorEnabled,
    });
});

// ── UPDATE NOTIFICATIONS ───────────────────────────────────
export const updateNotifications = TryCatch(async (req, res) => {
    const allowed = ["emailNotifications", "smsNotifications", "orderUpdates", "promotionalNotifications"];
    const updates = {};

    for (const key of allowed) {
        if (typeof req.body[key] === "boolean") {
            updates[`notifications.${key}`] = req.body[key];
        }
    }

    if (Object.keys(updates).length === 0)
        return res.status(400).json({ message: "No valid notification field provided" });

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true }
    ).select("notifications");

    res.status(200).json({ message: "Notifications updated", notifications: user.notifications });
});

// ── GET ALL ACTIVE SESSIONS ────────────────────────────────
export const getActiveSessions = TryCatch(async (req, res) => {
    const userId = req.user._id;
    const currentSessionId = req.sessionId;
    const sessions = await getAllSessions(userId);

    const enriched = sessions.map((s) => ({
        ...s,
        isCurrent: s.sessionId === currentSessionId,
    }));

    res.json({ sessions: enriched });
});

// ── LOGOUT ONE DEVICE ──────────────────────────────────────
export const logoutSession = TryCatch(async (req, res) => {
    const userId = req.user._id;
    const { sessionId } = req.params;

    const isMember = await redisClint.sIsMember(`sessions:${userId}`, sessionId);
    if (!isMember)
        return res.status(403).json({ message: "Not your session" });

    await revokeSession(userId, sessionId);

    if (sessionId === req.sessionId) {
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.clearCookie("csrfToken");
    }

    res.json({ message: "Device logged out successfully" });
});

// ── LOGOUT ALL DEVICES ─────────────────────────────────────
export const logOutAllDevices = TryCatch(async (req, res) => {
    const userId = req.user._id;
    await revokeRefreshToken(userId);

    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    res.clearCookie("csrfToken");

    res.json({ message: "Logged out from all devices" });
});

// ── DELETE ACCOUNT ─────────────────────────────────────────
export const deleteAccount = TryCatch(async (req, res) => {
    const { password } = req.body;
    if (!password)
        return res.status(400).json({ message: "Password is required to delete your account" });

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
        return res.status(401).json({ message: "Incorrect password" });

    // ✅ Revoke all sessions before deleting
    await revokeRefreshToken(req.user._id);

    await User.findByIdAndDelete(req.user._id);

    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    res.clearCookie("csrfToken");

    res.status(200).json({ message: "Account deleted successfully" });
});