import mongoose from "mongoose";
import { nanoid } from "nanoid";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const orderItemSchema = new mongoose.Schema(
    {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        variant: { type: mongoose.Schema.Types.ObjectId, default: null },

        // Snapshots so order history never breaks if product changes
        nameSnapshot: { type: String, required: true },
        imageSnapshot: { type: String, default: "" },
        priceAtOrder: { type: Number, required: true },
        finalPrice: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },

        // Applied promotion details (for invoice breakdown)
        appliedPromotions: [
            {
                promotionId: mongoose.Schema.Types.ObjectId,
                promotionName: String,
                discountAmount: Number,
            },
        ],
    },
    { _id: true }
);

const shippingAddressSchema = new mongoose.Schema(
    {
        fullName: String,
        phone: String,
        addressLine: String,
        area: String,
        district: String,
        division: String,
        postalCode: String,
    },
    { _id: false }
);

const timelineSchema = new mongoose.Schema(
    {
        status: String,
        message: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

// ─── Main Order Schema ────────────────────────────────────────────────────────

const orderSchema = new mongoose.Schema(
    {
        // Human-readable order ID (e.g. ORD-AB12CD)
        orderId: {
            type: String,
            unique: true,
            default: () => `ORD-${nanoid(8).toUpperCase()}`,
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true,
        },

        // Guest orders (not logged in)
        guestInfo: {
            name: String,
            email: String,
            phone: String,
        },

        items: [orderItemSchema],
        shippingAddress: shippingAddressSchema,

        // ─── Payment ──────────────────────────────────────────────────────
        paymentMethod: {
            type: String,
            enum: ["bkash", "sslcommerz", "cod"],
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
        },
        transactionId: { type: String, default: null },
        paidAt: { type: Date, default: null },

        // ─── Applied coupon ───────────────────────────────────────────────
        appliedCoupon: {
            code: String,
            promotionId: mongoose.Schema.Types.ObjectId,
            discountAmount: { type: Number, default: 0 },
        },

        // ─── Financials ───────────────────────────────────────────────────
        subtotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        shippingFee: { type: Number, default: 80 },
        total: { type: Number, required: true },

        // ─── Order status lifecycle ───────────────────────────────────────
        orderStatus: {
            type: String,
            enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
            default: "pending",
            index: true,
        },

        deliveryBoy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DeliveryBoy",
            default: null,
        },

        // ─── Status history ───────────────────────────────────────────────
        timeline: [timelineSchema],

        // ─── Notes ────────────────────────────────────────────────────────
        customerNote: { type: String, default: "" },
        adminNote: { type: String, default: "" },

        // ─── Invoice ──────────────────────────────────────────────────────
        invoiceSentAt: { type: Date, default: null },

        // ─── Cancellation ─────────────────────────────────────────────────
        cancelledAt: { type: Date, default: null },
        cancellationReason: { type: String, default: "" },
    },
    { timestamps: true }
);

// ─── Indexes for common queries ───────────────────────────────────────────────
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ "shippingAddress.district": 1 });

export default mongoose.model("Order", orderSchema);