import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        description: String,

        // ─── Type ───────────────────────────────────────────────────────────
        type: {
            type: String,
            enum: ["product", "cart", "bxgy", "free_shipping", "coupon"],
            required: true,
        },

        // ─── Coupon Code (optional — only for coupon-type or manual apply) ──
        // Admin creates a coupon code that customers enter at checkout
        couponCode: {
            type: String,
            uppercase: true,
            trim: true,
            sparse: true,   // allows multiple docs without couponCode (null ≠ unique)
            index: true,
        },

        // ─── Discount ───────────────────────────────────────────────────────
        discountType: {
            type: String,
            enum: ["percent", "fixed", "free"],
        },
        value: Number,

        // ─── Conditions ─────────────────────────────────────────────────────
        conditions: {
            minCartValue: Number,
            userRoles: [String],        // "admin" | "customer" | "vip"
            firstOrderOnly: Boolean,
            paymentMethod: String,      // "bkash" | "card" etc.
        },

        // ─── Scope ──────────────────────────────────────────────────────────
        scope: {
            products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
            categories: [String],
            excludeProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        },

        // ─── BXGY ───────────────────────────────────────────────────────────
        bxgy: {
            buy: Number,
            get: Number,
            productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        },

        // ─── Usage Control ───────────────────────────────────────────────────
        usageLimit: Number,
        usedCount: { type: Number, default: 0 },
        perUserLimit: Number,

        // ─── Priority & Stacking ─────────────────────────────────────────────
        priority: { type: Number, default: 0 },
        stackable: { type: Boolean, default: false },

        // ─── Schedule ────────────────────────────────────────────────────────
        startDate: Date,
        endDate: Date,

        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Ensure couponCode uniqueness only when it exists
promotionSchema.index(
    { couponCode: 1 },
    { unique: true, sparse: true }
);

export default mongoose.model("Promotion", promotionSchema);