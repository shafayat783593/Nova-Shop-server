import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema({
    name: String,
    description: String,

    type: {
        type: String,
        enum: ["product", "cart", "bxgy", "free_shipping"],
        required: true
    },

    discountType: {
        type: String,
        enum: ["percent", "fixed", "free"],
    },

    value: Number,

    // 👉 Conditions (Rule Engine)
    conditions: {
        minCartValue: Number,
        userRoles: [String], // admin, customer, vip
        firstOrderOnly: Boolean,
        paymentMethod: String, // bkash, card
    },

    // 👉 Scope (কোথায় apply হবে)
    scope: {
        products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        categories: [String],
        excludeProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    },

    // 👉 BOGO / BXGY
    bxgy: {
        buy: Number,
        get: Number,
        productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
    },

    // 👉 Usage Control
    usageLimit: Number,
    usedCount: { type: Number, default: 0 },
    perUserLimit: Number,

    // 👉 Priority & stacking
    priority: { type: Number, default: 0 },
    stackable: { type: Boolean, default: false },

    // 👉 Schedule
    startDate: Date,
    endDate: Date,

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("Promotion", promotionSchema);