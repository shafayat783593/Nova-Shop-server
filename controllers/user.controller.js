import { forgotSchema, loginSchema, registerSchema } from "../config/zod.js";
import { redisClint } from "../index.js";
import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import sendMail from "../config/sendMail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../config/html.js";
import {
    generateToken,
    genetateAccessToken,
    revokeRefreshToken,
    revokeSession,
    verifyRefreshToken,
    getAllSessions,

} from "../config/generateToken.js";
import { generateCSRFToken } from "../middlewares/csrfMiddleware.js";

// ── Register ─────────────────────────────────────────────────────
export const registerUser = TryCatch(async (req, res) => {
    const sanitizedBody = sanitize(req.body);
    const validation = registerSchema.safeParse(sanitizedBody);

    if (!validation.success) {
        const allErrors = validation.error.issues.map((issue) => ({
            field: issue.path?.join(".") || "unknown",
            message: issue.message || "Validation error",
            code: issue.code,
        }));
        return res.status(400).json({ message: "Validation error", error: allErrors });
    }

    const { name, email, password } = validation.data;

    const rateLimitKey = `register-rate-limit:${req.ip}:${email}`;
    if (await redisClint.get(rateLimitKey)) {
        return res.status(429).json({ message: "Too many requests, try again later" });
    }

    if (await User.findOne({ email })) {
        return res.status(400).json({ message: "User already exists" });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString("hex");

    await redisClint.set(
        `verify:${verifyToken}`,
        JSON.stringify({ name, email, password: hashPassword }),
        { EX: 300 }
    );

    const html = getVerifyEmailHtml({ email, token: verifyToken });
    await sendMail({ email, subject: "Verify your email", html });
    await redisClint.set(rateLimitKey, "true", { EX: 60 });

    res.json({ message: "Verification link sent. Expires in 5 minutes." });
});

// ── Verify email ──────────────────────────────────────────────────
export const verifyUser = TryCatch(async (req, res) => {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: "Token required" });

    const userDataJson = await redisClint.get(`verify:${token}`);
    if (!userDataJson) return res.status(400).json({ message: "Link expired" });

    await redisClint.del(`verify:${token}`);
    const userData = JSON.parse(userDataJson);

    if (await User.findOne({ email: userData.email })) {
        return res.status(400).json({ message: "Email already registered" });
    }

    const newUser = await User.create(userData);
    res.status(201).json({
        message: "Email verified. Account created.",
        user: { _id: newUser._id, name: newUser.name, email: newUser.email },
    });
});

// ── Login ─────────────────────────────────────────────────────────
export const loginUser = TryCatch(async (req, res) => {
    const sanitizedBody = sanitize(req.body);
    const validation = loginSchema.safeParse(sanitizedBody);

    if (!validation.success) {
        const allErrors = validation.error.issues.map((i) => ({
            field: i.path?.join(".") || "unknown",
            message: i.message,
            code: i.code,
        }));
        return res.status(400).json({ message: "Validation error", error: allErrors });
    }

    const { email, password } = validation.data;
    const rateLimitKey = `login-rate-limit:${req.ip}:${email}`;

    if (await redisClint.get(rateLimitKey)) {
        return res.status(429).json({ message: "Too many requests, try again later" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) return res.status(400).json({ message: "Invalid credentials" });

    await redisClint.setEx(rateLimitKey, 60, "true");

    // 2FA flow
    if (user.twoFactorEnabled) {
        const otp = crypto.randomInt(100000, 999999);
        await redisClint.setEx(`otp:${email}`, 300, String(otp));
        await sendMail({ email, subject: "Your OTP", html: getOtpHtml({ email, otp }) });
        return res.status(200).json({
            twoFactorRequired: true,
            message: "OTP sent. Expires in 5 minutes.",
        });
    }

    // ✅ Multi-device check
    const result = await generateToken(user, res, req);

    if (result.limitReached) {
        // Return current sessions so frontend can show "logout a device" UI
        const sessions = await getAllSessions(user._id);
        return res.status(409).json({
            message: "Maximum devices reached. Please logout from another device first.",
            errorCode: "MAX_SESSIONS_REACHED",
            activeSessions: sessions,
        });
    }

    res.json({
        message: "Login successful",
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
        sessionId: result.sessionId,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
        },
    });
});

// ── Verify OTP ────────────────────────────────────────────────────
export const verifyOtp = TryCatch(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const stored = await redisClint.get(`otp:${email}`);
    if (!stored) return res.status(400).json({ message: "OTP expired" });

    // ✅ Compare as strings — no JSON.parse on an integer
    if (stored !== String(otp)) return res.status(400).json({ message: "Invalid OTP" });

    await redisClint.del(`otp:${email}`);

    const user = await User.findOne({ email }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const result = await generateToken(user, res, req);

    if (result.limitReached) {
        const sessions = await getAllSessions(user._id);
        return res.status(409).json({
            message: "Maximum devices reached. Please logout from another device first.",
            errorCode: "MAX_SESSIONS_REACHED",
            activeSessions: sessions,
        });
    }

    res.status(200).json({
        message: `Welcome ${user.name}`,
        user,
        csrfToken: result.csrfToken,
        sessionId: result.sessionId,
    });
});

// ── Forgot password ───────────────────────────────────────────────
export const forgotPassword = TryCatch(async (req, res) => {
    const sanitizedBody = sanitize(req.body);

    // ✅ correct validation (object pass করতে হবে)
    const validation = forgotSchema.safeParse(sanitizedBody);

    if (!validation.success) {
        const errors = validation.error.flatten();

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.fieldErrors,
        });
    }
    const { email } = validation.data;



    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ message: "Valid email required" });
    }

    const rateLimitKey = `forgot-rate:${req.ip}:${email}`;
    if (await redisClint.get(rateLimitKey)) {
        return res.status(429).json({ message: "Too many requests, try again later" });
    }

    const user = await User.findOne({ email });
    if (user) {
        const otp = crypto.randomInt(100000, 999999).toString();
        await redisClint.setEx(`reset:password:${email}`, 600, otp);
        await sendMail({ email, subject: "Password Reset OTP", html: getOtpHtml({ email, otp }) });
    }

    await redisClint.set(rateLimitKey, "true", { EX: 60 });
    res.status(200).json({ message: "If this email exists, a reset OTP has been sent." });
});

// ── Reset password ────────────────────────────────────────────────
export const resetPassword = TryCatch(async (req, res) => {

    const sanitizedBody = sanitize(req.body);

    // ✅ correct validation (object pass করতে হবে)
    const validation = forgotSchema.safeParse(sanitizedBody);

    if (!validation.success) {
        const errors = validation.error.flatten();

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.fieldErrors,
        });
    }
    const { email, otp, newPassword } = validation.data;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "All fields required" });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const stored = await redisClint.get(`reset:password:${email}`);
    if (!stored) return res.status(400).json({ message: "OTP expired or invalid" });
    if (stored !== String(otp)) return res.status(400).json({ message: "Incorrect OTP" });

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) return res.status(400).json({ message: "Cannot reuse current password" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save({ validateModifiedOnly: true });

    await redisClint.del(`reset:password:${email}`);
    await redisClint.del(`user:${user._id}`);

    // ✅ Revoke all sessions after password change (security)
    await revokeRefreshToken(user._id);

    res.status(200).json({ message: "Password changed. Please login again." });
});

// ── Refresh access token ──────────────────────────────────────────
export const refreshToken = TryCatch(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const decode = await verifyRefreshToken(token);
    if (!decode) {
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.clearCookie("csrfToken");
        return res.status(401).json({ message: "Session expired. Please login." });
    }

    const user = await User.findById(decode.id).select("_id role");
    if (!user) {
        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");
        res.clearCookie("csrfToken");
        return res.status(404).json({ message: "User not found" });
    }

    // ✅ role included
    await genetateAccessToken(user._id, user.role, decode.sessionId, res);
    return res.status(200).json({ message: "Token refreshed" });
});

// ── Refresh CSRF ──────────────────────────────────────────────────
export const refreshCSRF = TryCatch(async (req, res) => {
    const userId = req.user._id;
    const sessionId = req.sessionId;
    const newCSRF = await generateCSRFToken(userId, sessionId, res);
    res.json({ message: "CSRF refreshed", csrfToken: newCSRF });
});

// ── My profile ────────────────────────────────────────────────────
export const myProfile = TryCatch(async (req, res) => {
    const user = req.user;
    const sessionId = req.sessionId;
    const sessionData = await redisClint.get(`session:${sessionId}`);
    let sessionInfo = null;

    if (sessionData) {
        const p = JSON.parse(sessionData);
        sessionInfo = {
            sessionId,
            browser: p.browser,
            os: p.os,
            deviceType: p.deviceType,
            ip: p.ip,
            loginTime: p.createdAt,
            lastActivity: p.lastActivity,
        };
    }

    res.status(200).json({ user, sessionInfo });
});

// ── GET all active sessions (device list) ────────────────────────

