import Review from "../models/review.model.js"; // আপনার রিভিউ মডেল
import Product from "../models/product.model.js";

// ─── CREATE / UPDATE REVIEW ──────────────────────────────────────────────────
export const addReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;
        const userId = req.user._id; // মিডলওয়্যার থেকে ইউজার আইডি

        // ১. রিভিউ সেভ বা আপডেট করা
        const review = await Review.findOneAndUpdate(
            { product: productId, user: userId },
            { rating, comment },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // ২. প্রোডাক্টের গড় রেটিং এবং টোটাল রিভিউ আপডেট করা
        const stats = await Review.aggregate([
            { $match: { product: productId } },
            {
                $group: {
                    _id: "$product",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            await Product.findByIdAndUpdate(productId, {
                averageRating: stats[0].avgRating.toFixed(1), // ১ ঘর পর্যন্ত দশমিক
                totalReviews: stats[0].totalReviews
            });
        }

        return res.status(201).json({
            success: true,
            message: "Review added/updated successfully",
            data: review
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET REVIEWS BY PRODUCT ──────────────────────────────────────────────────
export const getReviewsByProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const reviews = await Review.find({ product: productId })
            .populate("user", "name avatar").sort("-createdAt");

        return res.status(200).json({ success: true, data: reviews });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE REVIEW ──────────────────────────────────────────────────────────
export const deleteReview = async (req, res) => {
    try {
        const review = await Review.findByIdAndDelete(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: "Review not found" });

        // রিভিউ ডিলিট করার পর আবার গড় রেটিং আপডেট করা
        const stats = await Review.aggregate([
            { $match: { product: review.product } },
            {
                $group: {
                    _id: "$product",
                    avgRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        await Product.findByIdAndUpdate(review.product, {
            averageRating: stats.length > 0 ? stats[0].avgRating.toFixed(1) : 0,
            totalReviews: stats.length > 0 ? stats[0].totalReviews : 0
        });

        return res.status(200).json({ success: true, message: "Review deleted" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};