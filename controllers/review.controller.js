import Review from "../models/review.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

// ─── Helper: recalculate & persist product rating stats ──────────────────────
async function syncProductRating(productId) {
    const [stats] = await Review.aggregate([
        { $match: { product: new (await import("mongoose")).default.Types.ObjectId(productId), isVisible: true } },
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
// Auth required — only the buyer can review, only after delivery
export const addReview = async (req, res) => {
    try {
        const { productId, orderId, rating, comment } = req.body;
        const userId = req.user._id;

        // ── 1. Validate required fields ────────────────────────────────────
        if (!productId || !orderId || !rating) {
            return res.status(400).json({
                success: false,
                message: "productId, orderId, and rating are required",
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5",
            });
        }

        // ── 2. Verify the order belongs to this user AND is delivered ──────
        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            orderStatus: "delivered",          // must be delivered
        });

        if (!order) {
            return res.status(403).json({
                success: false,
                message: "You can only review products from your delivered orders",
            });
        }

        // ── 3. Verify the product exists in this order ─────────────────────
        const boughtItem = order.items.find(
            (item) => String(item.product) === String(productId)
        );

        if (!boughtItem) {
            return res.status(403).json({
                success: false,
                message: "This product is not part of the specified order",
            });
        }

        // ── 4. Check for duplicate review (same user + product + order) ────
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

        // ── 5. Save review ─────────────────────────────────────────────────
        const review = await Review.create({
            product: productId,
            user: userId,
            order: orderId,
            rating: Number(rating),
            comment: comment?.trim() || "",
        });

        // ── 6. Sync product rating stats ───────────────────────────────────
        await syncProductRating(productId);

        // ── 7. Populate user info for the response ─────────────────────────
        await review.populate("user", "name avatar");

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully",
            data: review,
        });
    } catch (err) {
        // Duplicate key from MongoDB (race condition fallback)
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

        // Only the author can edit
        if (String(review.user) !== String(userId)) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        if (rating !== undefined) {
            if (rating < 1 || rating > 5) {
                return res.status(400).json({ success: false, message: "Rating must be 1–5" });
            }
            review.rating = Number(rating);
        }

        if (comment !== undefined) {
            review.comment = comment.trim();
        }

        await review.save();
        await syncProductRating(review.product);
        await review.populate("user", "name avatar");

        return res.status(200).json({
            success: true,
            message: "Review updated",
            data: review,
        });
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

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("user", "name avatar")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Review.countDocuments(filter),
        ]);

        // Rating breakdown (1–5 star counts)
        const breakdown = await Review.aggregate([
            { $match: { product: new (await import("mongoose")).default.Types.ObjectId(productId), isVisible: true } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
        ]);

        const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        breakdown.forEach(({ _id, count }) => {
            ratingBreakdown[_id] = count;
        });

        return res.status(200).json({
            success: true,
            data: reviews,
            ratingBreakdown,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── CHECK IF USER CAN REVIEW A PRODUCT FROM A SPECIFIC ORDER ────────────────
// GET /api/reviews/can-review?productId=...&orderId=...
// Used by the frontend to show/hide the review button
export const canReview = async (req, res) => {
    try {
        const { productId, orderId } = req.query;
        const userId = req.user._id;

        if (!productId || !orderId) {
            return res.status(400).json({ success: false, message: "productId and orderId required" });
        }

        // 1. Order delivered and belongs to user?
        const order = await Order.findOne({
            _id: orderId,
            user: userId,
            orderStatus: "delivered",
        }).lean();

        if (!order) {
            return res.status(200).json({ success: true, data: { canReview: false, reason: "order_not_delivered" } });
        }

        // 2. Product in order?
        const inOrder = order.items.some(
            (item) => String(item.product) === String(productId)
        );

        if (!inOrder) {
            return res.status(200).json({ success: true, data: { canReview: false, reason: "product_not_in_order" } });
        }

        // 3. Already reviewed?
        const alreadyReviewed = await Review.exists({
            product: productId,
            user: userId,
            order: orderId,
        });

        if (alreadyReviewed) {
            return res.status(200).json({ success: true, data: { canReview: false, reason: "already_reviewed", reviewId: alreadyReviewed._id } });
        }

        return res.status(200).json({ success: true, data: { canReview: true } });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET MY REVIEW FOR A PRODUCT+ORDER ────────────────────────────────────────
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

        // Only the author or admin can delete
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
// PATCH /api/reviews/:reviewId/visibility  (admin only)
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