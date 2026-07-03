import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import { redisClint } from "../index.js";
import { getAllSessions, revokeSession, revokeRefreshToken } from "../config/generateToken.js";

// ── GET all users with active device count ────────────────────────
// GET /api/admin/users?search=&role=&page=&limit=
export const getAllUsers = TryCatch(async (req, res) => {
    const search = sanitize(req.query.search || "");
    const role = sanitize(req.query.role || "");
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const filter = {};
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
        User.find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    const usersWithDeviceCount = await Promise.all(
        users.map(async (u) => {
            const sessionIds = await redisClint.sMembers(`sessions:${u._id}`);
            return { ...u.toObject(), activeDevices: sessionIds.length };
        })
    );

    res.status(200).json({
        users: usersWithDeviceCount,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
    });
});

// ── GET all sessions/devices for one user ──────────────────────────
// GET /api/admin/users/:userId/sessions
export const getUserSessionsAdmin = TryCatch(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select("name email role avatar");
    if (!user) return res.status(404).json({ message: "User not found" });

    const sessions = await getAllSessions(userId);
    // newest activity first
    sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.status(200).json({ user, sessions });
});

// ── Logout ONE specific device for a user ──────────────────────────
// DELETE /api/admin/users/:userId/sessions/:sessionId
export const logoutUserDeviceAdmin = TryCatch(async (req, res) => {
    const { userId, sessionId } = req.params;

    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    await revokeSession(userId, sessionId);
    await redisClint.del(`user:${userId}`); // clear cached profile

    res.status(200).json({ message: "Device logged out successfully" });
});

// ── Logout ALL devices for a user ───────────────────────────────────
// DELETE /api/admin/users/:userId/sessions
export const logoutAllUserDevicesAdmin = TryCatch(async (req, res) => {
    const { userId } = req.params;

    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ message: "User not found" });

    await revokeRefreshToken(userId);

    res.status(200).json({ message: "All devices logged out successfully" });
});