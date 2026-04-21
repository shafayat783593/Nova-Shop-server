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
        const promotion = new Promotion(req.body);
        await promotion.save();
        return res.status(201).json({
            success: true,
            message: "Promotion created successfully",
            data: promotion,
        });
    } catch (err) {
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
// GET /api/promotions?page=1&limit=10&type=cart&isActive=true&search=summer
export const getAllPromotions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            type,
            isActive,
            search,
            sort = "-createdAt",
        } = req.query;

        const filter = {};

        if (type) filter.type = type;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
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

// ─── GET ACTIVE PROMOTIONS (for homepage / public) ───────────────────────────
// GET /api/promotions/active
export const getActivePromotions = async (req, res) => {
    try {
        const now = new Date();
        const promotions = await Promotion.find({
            isActive: true,
            $or: [
                { startDate: { $exists: false } },
                { startDate: { $lte: now } },
            ],
            $and: [
                {
                    $or: [
                        { endDate: { $exists: false } },
                        { endDate: { $gte: now } },
                    ],
                },
            ],
        })
            .sort("-priority")
            .lean();

        return res.status(200).json({ success: true, data: promotions });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET STATS (admin dashboard) ─────────────────────────────────────────────
// GET /api/promotions/stats
export const getPromotionStats = async (req, res) => {
    try {
        const now = new Date();

        const [total, active, expired, byType] = await Promise.all([
            Promotion.countDocuments(),
            Promotion.countDocuments({ isActive: true, $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }),
            Promotion.countDocuments({ endDate: { $lt: now } }),
            Promotion.aggregate([
                { $group: { _id: "$type", count: { $sum: 1 }, totalUsed: { $sum: "$usedCount" } } },
            ]),
        ]);

        return res.status(200).json({
            success: true,
            data: { total, active, expired, byType },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};


