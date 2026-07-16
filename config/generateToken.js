import jwt from "jsonwebtoken";
import { redisClint } from "../index.js";
import { generateCSRFToken } from "../middlewares/csrfMiddleware.js";
import crypto from "crypto";

const MAX_SESSIONS = 4;
const isProduction = process.env.NODE_ENV === "production"; // ✅ এখানে declare করো

const cookieOptions = (maxAge) => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "lax", // ✅ none → lax, rewrite এর কারণে same-site এখন
    maxAge,
});
// ─── Helper: device info from request ───────────────────────────
export const extractDeviceInfo = (req) => {
    const ua = req.headers["user-agent"] || "Unknown";
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket?.remoteAddress
        || "Unknown";

    // Simple UA parsing (no library needed)
    let browser = "Unknown browser";
    let os = "Unknown OS";
    let deviceType = "Desktop";

    if (/mobile/i.test(ua)) deviceType = "Mobile";
    else if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";

    if (/chrome\/[\d.]+/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
    else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/firefox\/[\d.]+/i.test(ua)) browser = "Firefox";
    else if (/edg\/[\d.]+/i.test(ua)) browser = "Edge";
    else if (/opr\/|opera/i.test(ua)) browser = "Opera";

    if (/windows nt/i.test(ua)) os = "Windows";
    else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
    else if (/iphone|ipad/i.test(ua)) os = "iOS";
    else if (/android/i.test(ua)) os = "Android";
    else if (/linux/i.test(ua)) os = "Linux";

    return { browser, os, deviceType, ip, userAgent: ua };
};

// ─── generateToken: multi-device aware ──────────────────────────
export const generateToken = async (user, res, req) => {
    const sessionId = crypto.randomBytes(16).toString("hex");
    const device = extractDeviceInfo(req);

    const accessToken = jwt.sign(
        { id: user._id, role: user.role, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    const refreshToken = jwt.sign(
        { id: user._id, role: user.role, sessionId },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" }
    );

    const TTL = 7 * 24 * 60 * 60;
    const sessionsKey = `sessions:${user._id}`;

    // ✅ Stale session cleanup
    const existingSessions = await redisClint.sMembers(sessionsKey);
    const validSessions = [];
    for (const sid of existingSessions) {
        const exists = await redisClint.exists(`session:${sid}`);
        if (exists) {
            validSessions.push(sid);
        } else {
            await redisClint.sRem(sessionsKey, sid);
        }
    }

    if (validSessions.length >= MAX_SESSIONS) {
        return { limitReached: true, sessions: validSessions };
    }

    const sessionData = {
        userId: user._id.toString(),
        sessionId,
        browser: device.browser,
        os: device.os,
        deviceType: device.deviceType,
        ip: device.ip,
        userAgent: device.userAgent,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
    };

    await redisClint.sAdd(sessionsKey, sessionId);
    await redisClint.expire(sessionsKey, TTL);
    await redisClint.setEx(`session:${sessionId}`, TTL, JSON.stringify(sessionData));
    await redisClint.setEx(`refreshToken:${user._id}:${sessionId}`, TTL, refreshToken);

    // ✅ isProduction use হচ্ছে properly
    res.cookie("accessToken", accessToken, cookieOptions(24 * 60 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(TTL * 1000));

    const csrfToken = await generateCSRFToken(user._id, sessionId, res);

    return { accessToken, refreshToken, csrfToken, sessionId, limitReached: false };
};
// ─── verifyRefreshToken ──────────────────────────────────────────
export const verifyRefreshToken = async (refreshToken) => {
    try {
        const userData = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        const storedToken = await redisClint.get(`refreshToken:${userData.id}:${userData.sessionId}`);

        if (storedToken !== refreshToken) return null;

        // Check session still exists in the set
        const isMember = await redisClint.sIsMember(`sessions:${userData.id}`, userData.sessionId);
        if (!isMember) return null;

        const sessionData = await redisClint.get(`session:${userData.sessionId}`);
        if (!sessionData) return null;

        // Update lastActivity
        const parsed = JSON.parse(sessionData);
        parsed.lastActivity = new Date().toISOString();
        await redisClint.setEx(`session:${userData.sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(parsed));

        return userData;
    } catch {
        return null;
    }
};

// ─── Generate new access token (keep role) ───────────────────────
export const genetateAccessToken = (id, role, sessionId, res) => {
    const accessToken = jwt.sign(
        { id, role, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    // ✅ এখানেও isProduction use করো
    res.cookie("accessToken", accessToken, cookieOptions(24 * 60 * 60 * 1000));

    return accessToken;
};
// ─── Revoke ONE session (logout single device) ───────────────────
export const revokeSession = async (userId, sessionId) => {
    await redisClint.sRem(`sessions:${userId}`, sessionId);
    await redisClint.del(`session:${sessionId}`);
    await redisClint.del(`refreshToken:${userId}:${sessionId}`);
    await redisClint.del(`csrf:${userId}:${sessionId}`);
    await redisClint.del(`user:${userId}`); 
};
// ─── Revoke ALL sessions (logout all devices) ────────────────────
export const revokeRefreshToken = async (userId) => {
    const sessions = await redisClint.sMembers(`sessions:${userId}`);
    for (const sid of sessions) {
        await revokeSession(userId, sid);
    }
    await redisClint.del(`sessions:${userId}`);
    await redisClint.del(`user:${userId}`);
};

// ─── isSessionActive ─────────────────────────────────────────────
export const isSessionActive = async (userId, sessionId) => {
    return await redisClint.sIsMember(`sessions:${userId}`, sessionId);
};

// ─── getAllSessions (for /sessions endpoint) ─────────────────────
export const getAllSessions = async (userId) => {
    const sessionIds = await redisClint.sMembers(`sessions:${userId}`);
    const sessions = [];

    for (const sid of sessionIds) {
        const data = await redisClint.get(`session:${sid}`);
        if (data) sessions.push(JSON.parse(data));
    }

    return sessions;
};