import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variant: {
        type: mongoose.Schema.Types.ObjectId,
    },

    nameSnapshot: String,      // product name at add time
    imageSnapshot: String,     // thumbnail

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    priceAtAdd: Number,        // original price
    finalPrice: Number,        // after discount

    appliedPromotions: [
        {
            promotionId: mongoose.Schema.Types.ObjectId,
            discountAmount: Number
        }
    ],

    stockSnapshot: Number,     // stock at add time

    isAvailable: {
        type: Boolean,
        default: true
    },

    addedAt: {
        type: Date,
        default: Date.now
    }

}, { _id: true });


const cartSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    sessionId: {
        type: String // guest user tracking
    },

    items: [cartItemSchema],

    // 💰 Pricing Summary
    subtotal: {
        type: Number,
        default: 0
    },

    discount: {
        type: Number,
        default: 0
    },

    shippingFee: {
        type: Number,
        default: 0
    },

    tax: {
        type: Number,
        default: 0
    },

    total: {
        type: Number,
        default: 0
    },

    currency: {
        type: String,
        default: "BDT"
    },

    // 🎟️ Coupon
    appliedCoupon: {
        code: String,
        discountAmount: Number
    },

    // ⚙️ Meta
    totalItems: {
        type: Number,
        default: 0
    },

    isCheckedOut: {
        type: Boolean,
        default: false
    },

    lastActivityAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

export default mongoose.models.Cart || mongoose.model("Cart", cartSchema);