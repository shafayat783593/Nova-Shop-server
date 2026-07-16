import mongoose from "mongoose";
import Review from "../models/review.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

// ─── Helper: recalculate & persist product rating stats ──────────────────────
// ✅ FIX: mongoose import সরাসরি top-level, dynamic import নয়
async function syncProductRating(productId) {
    const objectId = new mongoose.Types.ObjectId(productId);

    const [stats] = await Review.aggregate([
        { $match: { product: objectId, isVisible: true } },
        {
            $group: {
                _id: "$product",
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    await Product.findByIdAndUpdate(productId, {
        averageRating: stats ? parseFloat(stats.avgRating.toFixed(1)) : 0,
        totalReviews: stats ? stats.totalReviews : 0,
    });
}

// ─── CREATE REVIEW ────────────────────────────────────────────────────────────
// POST /api/reviews
export const addReview = async (req, res) => {
    try {
        const { productId, orderId, rating, comment } = req.body;
        const userId = req.user._id;

        // ── 1. Validate ────────────────────────────────────────────────────
        if (!productId || !orderId || !rating) {
            return res.status(400).json({
                success: false,
                message: "productId, orderId, and rating are required",
            });
        }

        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5",
            });
        }

        // ── 2. Order must be delivered and belong to this user ─────────────
        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            orderStatus: "delivered",
        }).lean();

        if (!order) {
            return res.status(403).json({
                success: false,
                message: "You can only review products from your delivered orders",
            });
        }

        // ── 3. Product must exist in this order ────────────────────────────
        // ✅ FIX: item.product may be ObjectId — toString() করে compare
        const boughtItem = order.items.find(
            (item) => String(item.product) === String(productId)
        );

        if (!boughtItem) {
            return res.status(403).json({
                success: false,
                message: "This product is not part of the specified order",
            });
        }

        // ── 4. Duplicate check ─────────────────────────────────────────────
        const existing = await Review.findOne({
            product: productId,
            user: userId,
            order: orderId,
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product for this order",
            });
        }

        // ── 5. Create ──────────────────────────────────────────────────────
        const review = await Review.create({
            product: productId,
            user: userId,
            order: orderId,
            rating: ratingNum,
            comment: comment?.trim() || "",
        });

        await syncProductRating(productId);
        await review.populate("user", "name avatar");

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            data: review,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "You have already reviewed this product for this order",
            });
        }
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── UPDATE REVIEW ────────────────────────────────────────────────────────────
// PATCH /api/reviews/:reviewId
export const updateReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const userId = req.user._id;

        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        if (String(review.user) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (rating !== undefined) {
            const r = Number(rating);
            if (isNaN(r) || r < 1 || r > 5) {
                return res.status(400).json({ success: false, message: "Rating must be 1–5" });
            }
            review.rating = r;
        }

        if (comment !== undefined) review.comment = comment.trim();

        await review.save();
        await syncProductRating(review.product);
        await review.populate("user", "name avatar");

        return res.status(200).json({ success: true, message: "Review updated", data: review });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET REVIEWS BY PRODUCT ───────────────────────────────────────────────────
// GET /api/reviews/product/:productId?page=1&limit=10
export const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const filter = { product: productId, isVisible: true };

        const [reviews, total, breakdown] = await Promise.all([
            Review.find(filter)
                .populate("user", "name avatar")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(filter),
            Review.aggregate([
                { $match: { product: new mongoose.Types.ObjectId(productId), isVisible: true } },
                { $group: { _id: "$rating", count: { $sum: 1 } } },
            ]),
        ]);

        const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        breakdown.forEach(({ _id, count }) => { ratingBreakdown[_id] = count; });

        return res.status(200).json({
            success: true,
            data: reviews,
            ratingBreakdown,
            pagination: { total, page, pages: Math.ceil(total / limit), limit },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── CHECK IF USER CAN REVIEW ─────────────────────────────────────────────────
// GET /api/reviews/can-review?productId=...&orderId=...
export const canReview = async (req, res) => {
    try {
        const { productId, orderId } = req.query;
        const userId = req.user._id;

        if (!productId || !orderId) {
            return res.status(400).json({
                success: false,
                message: "productId and orderId are required",
            });
        }

        // ── 1. Order delivered & belongs to user ───────────────────────────
        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            orderStatus: "delivered",
        }).lean();

        if (!order) {
            return res.status(200).json({
                success: true,
                data: { canReview: false, reason: "order_not_delivered" },
            });
        }

        // ── 2. Product in order ────────────────────────────────────────────
        // ✅ FIX: String compare করতে হবে, ObjectId vs string issue
        const inOrder = order.items.some(
            (item) => String(item.product) === String(productId)
        );

        if (!inOrder) {
            return res.status(200).json({
                success: true,
                data: { canReview: false, reason: "product_not_in_order" },
            });
        }

        // ── 3. Already reviewed? ───────────────────────────────────────────
        const alreadyReviewed = await Review.findOne({
            product: productId,
            user: userId,
            order: orderId,
        }).lean();

        if (alreadyReviewed) {
            return res.status(200).json({
                success: true,
                data: {
                    canReview: false,
                    reason: "already_reviewed",
                    reviewId: alreadyReviewed._id,
                },
            });
        }

        return res.status(200).json({ success: true, data: { canReview: true } });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET MY REVIEW ────────────────────────────────────────────────────────────
// GET /api/reviews/my?productId=...&orderId=...
export const getMyReview = async (req, res) => {
    try {
        const { productId, orderId } = req.query;
        const userId = req.user._id;

        const review = await Review.findOne({
            product: productId,
            user: userId,
            order: orderId,
        })
            .populate("user", "name avatar")
            .lean();

        return res.status(200).json({ success: true, data: review || null });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE REVIEW ────────────────────────────────────────────────────────────
// DELETE /api/reviews/:reviewId
export const deleteReview = async (req, res) => {
    try {
        const userId = req.user._id;
        const isAdmin = req.user.role === "admin";

        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        if (!isAdmin && String(review.user) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        const productId = review.product;
        await review.deleteOne();
        await syncProductRating(productId);

        return res.status(200).json({ success: true, message: "Review deleted" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── ADMIN: TOGGLE VISIBILITY ─────────────────────────────────────────────────
// PATCH /api/reviews/:reviewId/visibility
export const toggleVisibility = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        review.isVisible = !review.isVisible;
        await review.save();
        await syncProductRating(review.product);

        return res.status(200).json({
            success: true,
            message: `Review ${review.isVisible ? "shown" : "hidden"}`,
            data: { isVisible: review.isVisible },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};



// ─── GET FEATURED/TOP REVIEWS (site-wide, for homepage) ──────────────────────
// GET /api/reviews/featured?limit=8
export const getFeaturedReviews = async (req, res) => {
    try {
        const limit = Math.min(20, parseInt(req.query.limit) || 8);

        const reviews = await Review.find({ isVisible: true, rating: { $gte: 2 }, comment: { $ne: "" } })
            .populate("user", "name avatar")
            .populate("product", "name images slug")
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return res.status(200).json({ success: true, data: reviews });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};