import mongoose from "mongoose";

// ─── Review Schema ────────────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
            index: true,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // The specific order this review is tied to
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        comment: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        // Soft-delete / admin moderation
        isVisible: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    { timestamps: true }
);

// ─── Compound unique index: one review per user per product per order ─────────
// This prevents a user from reviewing the same product twice from the same order.
// If they bought the same product in two different orders they CAN review both.
reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);