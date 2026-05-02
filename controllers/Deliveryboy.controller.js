// controllers/deliveryBoy.controller.js
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import Order from "../models/order.model.js";
import { redisClint } from "../index.js";
import sendMail from "../config/sendMail.js";
import { getIO } from "../socket/socket.js";
import TryCatch from "../middlewares/TryCatch.js";
import { generateToken } from "../config/generateToken.js";
import { getInviteHtml } from "../config/html.js";

const sendError = (res, msg, status = 400) =>
    res.status(status).json({ success: false, message: msg });

// ─── Invite Email HTML ────────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════════
//  ADMIN FUNCTIONS
// ══════════════════════════════════════════════════════════════════

// ─── 1. Admin: Invite delivery boy ───────────────────────────────────────────
// POST /api/admin/delivery-boys/invite
// Body: { name, email, phone, zones[] }
export const adminInviteDeliveryBoy = TryCatch(async (req, res) => {
    const { name, email, phone, zones } = req.body;

    if (!name || !email) {
        return sendError(res, "Name and email are required");
    }

    // Already registered check
    const existing = await User.findOne({ email });
    if (existing) {
        return sendError(res, "This email is already registered");
    }

    // Pending invite check
    const pendingKey = `delivery-invite-email:${email}`;
    if (await redisClint.get(pendingKey)) {
        return sendError(res, "An invitation was already sent to this email. Wait 24h.");
    }

    // Rate limit for admin
    const rateLimitKey = `invite-rate:${req.ip}`;
    const rateCount = await redisClint.get(rateLimitKey) || 0;
    if (Number(rateCount) >= 10) {
        return res.status(429).json({ success: false, message: "Too many invites. Try again later." });
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const TTL = 24 * 60 * 60; // 24 hours

    // Store invite data in Redis
    await redisClint.set(
        `delivery-invite:${inviteToken}`,
        JSON.stringify({
            name,
            email,
            phone: phone || "",
            zones: zones || [],
            role: "deliveryboy",
            invitedBy: req.user._id.toString(),
            invitedAt: new Date().toISOString(),
        }),
        { EX: TTL }
    );

    // Store email → token mapping (to prevent duplicate invites)
    await redisClint.set(pendingKey, inviteToken, { EX: TTL });

    // Rate limit increment
    await redisClint.set(rateLimitKey, Number(rateCount) + 1, { EX: 3600 });

    // Send invite email
    const inviteLink = `${process.env.FRONTEND_URL}/delivery/setup?token=${inviteToken}`;
    await sendMail({
        email,
        subject: "Nova Shop — Delivery Partner Invitation",
        html: getInviteHtml({ name, inviteLink }),
    });

    return res.json({
        success: true,
        message: `Invitation sent to ${email}. Expires in 24 hours.`,
    });
});

// ─── 2. Admin: Get all delivery boys ─────────────────────────────────────────
// GET /api/admin/delivery-boys
export const adminGetDeliveryBoys = TryCatch(async (req, res) => {
    const { search, isActive, isAvailable } = req.query;

    // DeliveryBoy collection এ filter করো
    const dbFilter = {};
    if (isActive !== undefined) dbFilter.isActive = isActive === "true";
    if (isAvailable !== undefined) dbFilter.isAvailable = isAvailable === "true";

    const deliveryBoys = await DeliveryBoy.find(dbFilter)
        .populate({
            path: "user",
            select: "name email avatar createdAt",
            match: search
                ? {
                    $or: [
                        { name: { $regex: search, $options: "i" } },
                        { email: { $regex: search, $options: "i" } },
                    ]
                }
                : {},
        })
        .lean();

    // user populate null হলে filter out করো
    const result = deliveryBoys
        .filter(d => d.user !== null)
        .map(d => ({
            _id: d._id,
            userId: d.user._id,
            name: d.user.name,
            email: d.user.email,
            avatar: d.user.avatar,
            phone: d.phone,
            zones: d.zones,
            isAvailable: d.isAvailable,
            isActive: d.isActive,
            totalDelivered: d.totalDelivered,
            rating: d.rating,
            currentOrders: d.currentOrders?.length || 0,
            lastLocation: d.lastLocation,
            joinedAt: d.user.createdAt,
        }));

    return res.json({ success: true, data: result, total: result.length });
});

// ─── 3. Admin: Get single delivery boy ───────────────────────────────────────
// GET /api/admin/delivery-boys/:deliveryBoyId
export const adminGetDeliveryBoyById = TryCatch(async (req, res) => {
    const deliveryBoy = await DeliveryBoy.findById(req.params.deliveryBoyId)
        .populate("user", "name email avatar createdAt")
        .populate("currentOrders", "orderId orderStatus total shippingAddress createdAt")
        .lean();

    if (!deliveryBoy || !deliveryBoy.user) {
        return sendError(res, "Delivery boy not found", 404);
    }

    return res.json({ success: true, data: deliveryBoy });
});

// ─── 4. Admin: Toggle active status ──────────────────────────────────────────
// PATCH /api/admin/delivery-boys/:deliveryBoyId/toggle-active
export const adminToggleActive = TryCatch(async (req, res) => {
    const deliveryBoy = await DeliveryBoy.findById(req.params.deliveryBoyId);
    if (!deliveryBoy) return sendError(res, "Not found", 404);

    deliveryBoy.isActive = !deliveryBoy.isActive;
    await deliveryBoy.save();

    // User ও deactivate করো (login block করতে)
    await User.findByIdAndUpdate(deliveryBoy.user, {
        // Custom field না থাকলে এভাবে track করতে পারো
    });

    return res.json({
        success: true,
        message: `Delivery boy ${deliveryBoy.isActive ? "activated ✅" : "deactivated 🔴"}`,
        data: { isActive: deliveryBoy.isActive },
    });
});

// ─── 5. Admin: Update zones/phone ────────────────────────────────────────────
// PATCH /api/admin/delivery-boys/:deliveryBoyId
// Body: { phone, zones[] }
export const adminUpdateDeliveryBoy = TryCatch(async (req, res) => {
    const { phone, zones } = req.body;

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(
        req.params.deliveryBoyId,
        { ...(phone && { phone }), ...(zones && { zones }) },
        { new: true }
    ).populate("user", "name email");

    if (!deliveryBoy) return sendError(res, "Not found", 404);

    return res.json({ success: true, message: "Updated", data: deliveryBoy });
});

// ─── 6. Admin: Delete delivery boy ───────────────────────────────────────────
// DELETE /api/admin/delivery-boys/:deliveryBoyId
export const adminDeleteDeliveryBoy = TryCatch(async (req, res) => {
    const deliveryBoy = await DeliveryBoy.findById(req.params.deliveryBoyId);
    if (!deliveryBoy) return sendError(res, "Not found", 404);

    if (deliveryBoy.currentOrders?.length > 0) {
        return sendError(res, "Cannot delete — has active orders assigned", 400);
    }

    await User.findByIdAndDelete(deliveryBoy.user);
    await DeliveryBoy.findByIdAndDelete(req.params.deliveryBoyId);

    return res.json({ success: true, message: "Delivery boy removed" });
});

// ══════════════════════════════════════════════════════════════════
//  SETUP (Delivery Boy sets their password via invite link)
// ══════════════════════════════════════════════════════════════════

// ─── 7. Validate invite token ─────────────────────────────────────────────────
// GET /api/delivery/setup/:token
export const validateInviteToken = TryCatch(async (req, res) => {
    const { token } = req.params;

    const data = await redisClint.get(`delivery-invite:${token}`);
    if (!data) {
        return res.status(400).json({
            success: false,
            message: "This invitation has expired or is invalid.",
        });
    }

    const { name, email, zones } = JSON.parse(data);
    return res.json({ success: true, data: { name, email, zones } });
});

// ─── 8. Setup account (set password) ─────────────────────────────────────────
// POST /api/delivery/setup
// Body: { token, password }
export const deliveryBoySetup = TryCatch(async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return sendError(res, "Token and password are required");
    }

    if (password.length < 6) {
        return sendError(res, "Password must be at least 6 characters");
    }

    // Redis থেকে invite data নাও
    const inviteData = await redisClint.get(`delivery-invite:${token}`);
    if (!inviteData) {
        return sendError(res, "Invitation expired or invalid. Ask admin to re-invite.");
    }

    const { name, email, phone, zones } = JSON.parse(inviteData);

    // Already registered check
    if (await User.findOne({ email })) {
        await redisClint.del(`delivery-invite:${token}`);
        await redisClint.del(`delivery-invite-email:${email}`);
        return sendError(res, "Account already exists. Please login.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ User তৈরি করো — same User model, role: "deliveryboy"
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "deliveryboy",
    });

    // ✅ DeliveryBoy extra info তৈরি করো
    await DeliveryBoy.create({
        user: user._id,
        phone: phone || "",
        zones: zones || [],
    });

    // Token cleanup
    await redisClint.del(`delivery-invite:${token}`);
    await redisClint.del(`delivery-invite-email:${email}`);

    return res.status(201).json({
        success: true,
        message: "Account created successfully! You can now login.",
        data: { name: user.name, email: user.email },
    });
});

// ══════════════════════════════════════════════════════════════════
//  DELIVERY BOY AUTH
// ══════════════════════════════════════════════════════════════════

// ─── 9. Login — same as customer login ───────────────────────────────────────
// POST /api/delivery/login
// Body: { email, password }
// NOTE: Same /api/auth/login endpoint use করো — role check হবে frontend এ
// কিন্তু যদি আলাদা endpoint চাও:
export const deliveryBoyLogin = TryCatch(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendError(res, "Email and password required");
    }

    const user = await User.findOne({ email, role: "deliveryboy" });
    if (!user) return sendError(res, "Invalid credentials", 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendError(res, "Invalid credentials", 401);

    // DeliveryBoy info check
    const deliveryBoy = await DeliveryBoy.findOne({ user: user._id });
    if (!deliveryBoy || !deliveryBoy.isActive) {
        return sendError(res, "Your account is deactivated. Contact admin.", 403);
    }

    // Same generateToken function use করো
    const result = await generateToken(user, res, req);

    if (result.limitReached) {
        return res.status(409).json({
            message: "Maximum devices reached.",
            errorCode: "MAX_SESSIONS_REACHED",
        });
    }

    return res.json({
        success: true,
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
            // DeliveryBoy extra info
            deliveryBoyId: deliveryBoy._id,
            phone: deliveryBoy.phone,
            zones: deliveryBoy.zones,
            isAvailable: deliveryBoy.isAvailable,
        },
    });
});

// ══════════════════════════════════════════════════════════════════
//  DELIVERY BOY DASHBOARD FUNCTIONS
// ══════════════════════════════════════════════════════════════════

// ─── 10. Get my assigned orders ──────────────────────────────────────────────
// GET /api/delivery/orders
// ─── 10. Get my assigned orders ──────────────────────────────────────────────
// GET /api/delivery/orders
export const getMyDeliveries = TryCatch(async (req, res) => {
    const orders = await Order.find({
        deliveryBoy: req.deliveryBoy._id,
        // ✅ assigned, accepted, shipped সব include করো
        $or: [
            { deliveryAssignStatus: { $in: ["assigned", "accepted"] } },
            { orderStatus: { $in: ["shipped", "delivered"] } },
        ],
    })
        .sort("-updatedAt")
        .select("orderId orderStatus deliveryAssignStatus shippingAddress total paymentMethod paymentStatus createdAt items timeline")
        .lean();

    return res.json({
        success: true,
        data: {
            // pending = assigned + accepted + shipped (not yet delivered)
            pending: orders.filter(o => o.orderStatus !== "delivered"),
            completed: orders.filter(o => o.orderStatus === "delivered"),
            total: orders.length,
        },
    });
});

// ─── 11. Update GPS location ──────────────────────────────────────────────────
// PATCH /api/delivery/location
// Body: { lat, lng }
export const updateLocation = TryCatch(async (req, res) => {
    const { lat, lng } = req.body;
    if (!lat || !lng) return sendError(res, "lat and lng required");

    await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy._id, {
        lastLocation: { lat, lng, updatedAt: new Date() },
    });

    // Active orders এর customers কে notify করো
    const activeOrders = await Order.find({
        deliveryBoy: req.deliveryBoy._id,
        orderStatus: "shipped",
    }).select("user orderId").lean();

    const io = getIO();
    activeOrders.forEach(order => {
        io.to(`user_${order.user}`).emit("delivery:locationUpdate", {
            orderId: order.orderId,
            lat,
            lng,
            updatedAt: new Date(),
        });
    });

    return res.json({ success: true, message: "Location updated" });
});

// ─── 12. Mark order as delivered ─────────────────────────────────────────────
// PATCH /api/delivery/orders/:orderId/delivered
export const markDelivered = TryCatch(async (req, res) => {
    const order = await Order.findOne({
        orderId: req.params.orderId,
        deliveryBoy: req.deliveryBoy._id,
        orderStatus: "shipped",
    });

    if (!order) return sendError(res, "Order not found or not assigned to you", 404);

    order.orderStatus = "delivered";
    if (order.paymentMethod === "cod") order.paymentStatus = "paid";

    order.timeline.push({
        status: "delivered",
        message: `Delivered by ${req.user.name}`,
        changedAt: new Date(),
    });

    await order.save();

    // currentOrders থেকে সরাও, totalDelivered বাড়াও
    await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy._id, {
        $pull: { currentOrders: order._id },
        $inc: { totalDelivered: 1 },
    });

    const io = getIO();
    io.to(`user_${order.user}`).emit("order:statusUpdate", {
        orderId: order.orderId,
        orderStatus: "delivered",
        message: "Your order has been delivered! 🎉",
    });
    io.to("adminRoom").emit("order:statusUpdate", {
        orderId: order.orderId,
        orderStatus: "delivered",
    });

    // Invoice email
    if (!order.invoiceSentAt) {
        const { sendInvoiceEmail } = await import("../services/invoice.service.js");
        const populated = await Order.findById(order._id).populate("user", "email").lean();
        await sendInvoiceEmail(order, populated.user?.email || "").catch(console.error);
        order.invoiceSentAt = new Date();
        await order.save();
    }

    return res.json({ success: true, message: "Order marked as delivered ✅" });
});

// ─── 13. Toggle availability ──────────────────────────────────────────────────
// PATCH /api/delivery/availability
// Body: { isAvailable: true/false }
export const toggleAvailability = TryCatch(async (req, res) => {
    const { isAvailable } = req.body;
    if (isAvailable === undefined) return sendError(res, "isAvailable required");

    await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy._id, { isAvailable });

    return res.json({
        success: true,
        message: isAvailable ? "You are now available 🟢" : "You are now offline 🔴",
        data: { isAvailable },
    });
});

// ─── 14. Get my profile ───────────────────────────────────────────────────────
// GET /api/delivery/profile
export const getDeliveryProfile = TryCatch(async (req, res) => {
    const deliveryBoy = await DeliveryBoy.findById(req.deliveryBoy._id)
        .populate("user", "name email avatar createdAt")
        .lean();

    return res.json({
        success: true,
        data: {
            name: deliveryBoy.user.name,
            email: deliveryBoy.user.email,
            avatar: deliveryBoy.user.avatar,
            phone: deliveryBoy.phone,
            zones: deliveryBoy.zones,
            isAvailable: deliveryBoy.isAvailable,
            isActive: deliveryBoy.isActive,
            totalDelivered: deliveryBoy.totalDelivered,
            rating: deliveryBoy.rating,
            lastLocation: deliveryBoy.lastLocation,
            joinedAt: deliveryBoy.user.createdAt,
        },
    });
});




// ─── 15. Respond to assignment (accept / reject) ──────────────────────────────
// PATCH /api/delivery/orders/:orderId/respond
// Body: { action: "accept" | "reject" }
export const respondToAssignment = TryCatch(async (req, res) => {
    const { action } = req.body;
    if (!["accept", "reject"].includes(action)) {
        return sendError(res, "action must be 'accept' or 'reject'");
    }

    const order = await Order.findOne({
        orderId: req.params.orderId,
        deliveryBoy: req.deliveryBoy._id,
        deliveryAssignStatus: "assigned",
    });

    if (!order) return sendError(res, "Order not found or already responded", 404);

    if (action === "accept") {
        order.deliveryAssignStatus = "accepted";
        order.orderStatus = "shipped";
        order.deliveryAcceptedAt = new Date();
        order.timeline.push({
            status: "shipped",
            message: `Accepted by delivery partner`,
            changedAt: new Date(),
        });
    } else {
        // reject — unassign করো
        order.deliveryAssignStatus = "rejected";
        order.deliveryBoy = null;
        order.deliveryBoySnapshot = { name: null, phone: null, avatar: null };
        order.timeline.push({
            status: "prepared",
            message: `Delivery rejected, pending reassignment`,
            changedAt: new Date(),
        });

        // DeliveryBoy এর currentOrders থেকে সরাও
        await DeliveryBoy.findByIdAndUpdate(req.deliveryBoy._id, {
            $pull: { currentOrders: order._id },
            activeOrderId: null,
        });
    }

    await order.save();

    // Admin কে notify করো
    const io = getIO();
    io.to("adminRoom").emit("order:statusUpdate", {
        orderId: order.orderId,
        deliveryAssignStatus: order.deliveryAssignStatus,
        orderStatus: order.orderStatus,
    });

    return res.json({
        success: true,
        message: action === "accept"
            ? "Order accepted! Head to the customer 🚴"
            : "Order rejected. Admin will reassign.",
        data: { deliveryAssignStatus: order.deliveryAssignStatus },
    });
});