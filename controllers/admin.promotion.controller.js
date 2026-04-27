import Promotion from "../models/promotion.model.js";

// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500, errors = null) => {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(status).json(body);
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
// POST /api/promotions
export const createPromotion = async (req, res) => {
    try {
        // couponCode uppercase enforce
        if (req.body.couponCode) {
            req.body.couponCode = req.body.couponCode.trim().toUpperCase();
        }

        const promotion = new Promotion(req.body);
        await promotion.save();
        return res.status(201).json({
            success: true,
            message: "Promotion created successfully",
            data: promotion,
        });
    } catch (err) {
        if (err.code === 11000) {
            return sendError(res, "Coupon code already exists", 409);
        }
        if (err.name === "ValidationError") {
            const errors = Object.values(err.errors).map((e) => ({
                field: e.path,
                message: e.message,
            }));
            return sendError(res, "Validation error", 400, errors);
        }
        console.error("Create Promotion Error:", err);
        return sendError(res, err.message || "Something went wrong");
    }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
// GET /api/promotions?page=1&limit=10&type=coupon&isActive=true&search=summer
export const getAllPromotions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            type,
            isActive,
            search,
            sort = "-createdAt",
            hasCoupon,          // NEW: filter only coupon-code promos
        } = req.query;

        const filter = {};

        if (type) filter.type = type;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        // hasCoupon=true → only promos with a couponCode set
        if (hasCoupon === "true") filter.couponCode = { $exists: true, $ne: null };
        if (hasCoupon === "false") filter.couponCode = { $exists: false };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { couponCode: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [promotions, total] = await Promise.all([
            Promotion.find(filter)
                .populate("scope.products", "name slug images")
                .populate("scope.excludeProducts", "name slug")
                .populate("bxgy.productIds", "name slug images")
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Promotion.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: promotions,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET ONE ──────────────────────────────────────────────────────────────────
// GET /api/promotions/:id
export const getPromotionById = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id)
            .populate("scope.products", "name slug images basePrice")
            .populate("scope.excludeProducts", "name slug")
            .populate("bxgy.productIds", "name slug images");

        if (!promotion) return sendError(res, "Promotion not found", 404);

        return res.status(200).json({ success: true, data: promotion });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
// PUT /api/promotions/:id
export const updatePromotion = async (req, res) => {
    try {
        if (req.body.couponCode) {
            req.body.couponCode = req.body.couponCode.trim().toUpperCase();
        }

        const promotion = await Promotion.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!promotion) return sendError(res, "Promotion not found", 404);

        return res.status(200).json({
            success: true,
            message: "Promotion updated successfully",
            data: promotion,
        });
    } catch (err) {
        if (err.code === 11000) {
            return sendError(res, "Coupon code already exists", 409);
        }
        if (err.name === "ValidationError") {
            const errors = Object.values(err.errors).map((e) => ({
                field: e.path,
                message: e.message,
            }));
            return sendError(res, "Validation error", 400, errors);
        }
        return sendError(res, err.message);
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
// DELETE /api/promotions/:id
export const deletePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findByIdAndDelete(req.params.id);
        if (!promotion) return sendError(res, "Promotion not found", 404);

        return res.status(200).json({
            success: true,
            message: "Promotion deleted successfully",
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────
// PATCH /api/promotions/:id/toggle
export const togglePromotion = async (req, res) => {
    try {
        const promotion = await Promotion.findById(req.params.id);
        if (!promotion) return sendError(res, "Promotion not found", 404);

        promotion.isActive = !promotion.isActive;
        await promotion.save();

        return res.status(200).json({
            success: true,
            message: `Promotion is now ${promotion.isActive ? "active" : "inactive"}`,
            data: { isActive: promotion.isActive },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET ACTIVE PROMOTIONS (homepage / public — auto-apply only) ──────────────
// GET /api/promotions/active
export const getActivePromotions = async (req, res) => {
    try {
        const now = new Date();
        const promotions = await Promotion.find({
            isActive: true,
            // Auto-apply promos don't have a couponCode
            couponCode: { $exists: false },
            $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
            $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
        })
            .sort("-priority")
            .lean();

        return res.status(200).json({ success: true, data: promotions });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── VALIDATE COUPON (public — called by cart/checkout UI) ───────────────────
// POST /api/promotions/validate-coupon
// Body: { code: "SUMMER20", cartTotal: 1000 }
export const validateCoupon = async (req, res) => {
    try {
        const { code, cartTotal = 0 } = req.body;

        if (!code) return sendError(res, "Coupon code is required", 400);

        const now = new Date();
        const promo = await Promotion.findOne({
            couponCode: code.trim().toUpperCase(),
            isActive: true,
            $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
            $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
        });

        if (!promo) return sendError(res, "Invalid or expired coupon code", 404);

        // Usage limit check
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit) {
            return sendError(res, "This coupon has reached its usage limit", 400);
        }

        // Min cart value check
        if (promo.conditions?.minCartValue && cartTotal < promo.conditions.minCartValue) {
            return sendError(
                res,
                `Minimum cart value of ৳${promo.conditions.minCartValue} required`,
                400
            );
        }

        // Calculate discount
        const total = Number(cartTotal) || 0;
        let discountAmount = 0;

        if (promo.discountType === "percent") {
            discountAmount = (total * (promo.value || 0)) / 100;
        } else if (promo.discountType === "fixed") {
            discountAmount = Math.min(promo.value || 0, total);
        } else if (promo.discountType === "free") {
            discountAmount = total;
        }

        discountAmount = Math.max(0, discountAmount);

        return res.status(200).json({
            success: true,
            message: "Coupon is valid!",
            data: {
                code: promo.couponCode,
                promotionId: promo._id,
                name: promo.name,
                discountType: promo.discountType,
                value: promo.value,
                discountAmount: Math.round(discountAmount * 100) / 100,
                type: promo.type,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET STATS (admin dashboard) ─────────────────────────────────────────────
// GET /api/promotions/stats
export const getPromotionStats = async (req, res) => {
    try {
        const now = new Date();

        const [total, active, expired, byType, coupons] = await Promise.all([
            Promotion.countDocuments(),
            Promotion.countDocuments({
                isActive: true,
                $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
            }),
            Promotion.countDocuments({ endDate: { $lt: now } }),
            Promotion.aggregate([
                {
                    $group: {
                        _id: "$type",
                        count: { $sum: 1 },
                        totalUsed: { $sum: "$usedCount" },
                    },
                },
            ]),
            // Separate coupon stats
            Promotion.countDocuments({ couponCode: { $exists: true, $ne: null } }),
        ]);

        return res.status(200).json({
            success: true,
            data: { total, active, expired, byType, coupons },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};