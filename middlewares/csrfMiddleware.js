import crypto from "crypto";
import { redisClint } from "../index.js";

// ✅ Now per-session CSRF
export const generateCSRFToken = async (userId, sessionId, res) => {
    const csrfToken = crypto.randomBytes(32).toString("hex");
    const key = `csrf:${userId}:${sessionId}`;
    await redisClint.setEx(key, 7 * 24 * 60 * 60, csrfToken);
const isProduction = process.env.NODE_ENV === "production";

res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax", // ✅ none → lax
    maxAge: 7 * 24 * 60 * 60 * 1000,
});
    return csrfToken;
};

export const verifyCSRFToken = async (req, res, next) => {
    try {
        if (req.method === "GET") {
            return next();
        }

        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                message: "User not authenticated!",
            });
        }

        const clientToken = req.headers["x-csrf-token"];
        if (!clientToken) {
            return res.status(403).json({
                message: "CSRF token missing. Please refresh the page",
                code: "CSRF_TOKEN_MISSING",
            });
        }
        const csrfKey = `csrf:${userId}`;
        const storedToken = await redisClint.get(csrfKey);
        if (!storedToken) {
            return res.status(403).json({
                message: "CSRF token Expired. Please try again.",
                code: "CSRF_TOKEN_EXPIRED",
            });
        }
        if (storedToken !== clientToken) {
            return res.status(403).json({
                message: "Invalid CSRF token. Please refresh the page.",
                code: "CSRF_TOKEN_INVALID",
            });
        }
        next();
    } catch (error) {
        console.log("CSRF verification error: ", error);
        res.status(500).json({
            message: "CSRF verification failed",
            code: "CSRF_VERIFICATION_ERROR",
        });
    }
};

export const revokeCSRFTOKEN = async (userId, sessionId) => {
    if (sessionId) {
        await redisClint.del(`csrf:${userId}:${sessionId}`);
    }
};

export const refreshCSRFToken = async (userId, res) => {
    await revokeCSRFTOKEN(userId);
    return await generateCSRFToken(userId, res);
};
