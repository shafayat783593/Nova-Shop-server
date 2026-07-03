import jwt from "jsonwebtoken";
import { redisClint } from "../index.js";
import { User } from "../models/user.model.js";
import { isSessionActive } from "../config/generateToken.js";
import DeliveryBoyModel from "../models/deliveryBoy.model.js";

export const isAuth = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({
                message: "Please login - no token"
            });
        }

        // ✅ jwt.verify আলাদা try/catch এ wrap করা হলো
        // কারণ expired/invalid token হলে এটা throw করে, return করে না
        let userData;
        try {
            userData = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtErr) {
            return res.status(401).json({
                message: jwtErr.name === "TokenExpiredError" ? "Token expired" : "Invalid token"
            });
        }

        const sessionActive = await isSessionActive(userData.id, userData.sessionId);
        if (!sessionActive) {
            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");
            res.clearCookie("csrfToken");
            return res.status(401).json({
                message: "Session expired. You have logged in another device."
            });
        }

        // Check Redis cache
        const cachedUser = await redisClint.get(`user:${userData.id}`);
        if (cachedUser) {
            req.user = JSON.parse(cachedUser);
            req.sessionId = userData.sessionId;
            return next();
        }

        // Get from DB
        const user = await User.findById(userData.id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "No user with this id"
            });
        }

        // Cache user
        await redisClint.setEx(`user:${user._id}`, 3600, JSON.stringify(user));

        req.user = user;
        req.sessionId = userData.sessionId;

        next();

    } catch (err) {
        // এখন শুধু genuinely unexpected errors (DB down, Redis down ইত্যাদি) এখানে আসবে
        console.log("isAuth error:", err.message);
        return res.status(500).json({
            message: "Token verification error"
        });
    }
};

export const authorizeAdmin = async (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== "admin") {
        return res.status(401).json({
            message: "Opps! You are not allowed for this activity.",
        });
    }
    next();
};

export const authorizeVendor = async (req, res, next) => {
    const user = req.user;

    if (!user || user.role !== "vendor") {
        return res.status(401).json({
            message: "Opps! You are not allowed for this activity.",
        });
    }
    next();
};

export const isDeliveryBoy = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (req.user.role !== "deliveryboy") {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        const dbRecord = await DeliveryBoyModel.findOne({ user: req.user._id });

        if (!dbRecord) {
            return res.status(403).json({ success: false, message: "Delivery profile not found" });
        }

        if (!dbRecord.isActive) {
            return res.status(403).json({ success: false, message: "Account deactivated. Contact admin." });
        }

        req.deliveryBoy = dbRecord;
        next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};