import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        phone:           { type: String,  trim: true, default: "" },
        zones:           [{ type: String, trim: true }],
        isAvailable:     { type: Boolean, default: true  },
        isActive:        { type: Boolean, default: true  },
        isOnline:        { type: Boolean, default: false },

        // ─── Socket ───────────────────────────────────────────────────────
        socketId: { type: String, default: null },

        // ─── Currently active order (single delivery in progress) ─────────
        activeOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },

        // ─── All assigned orders (pending + completed) ────────────────────
        currentOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],

        // ─── Stats ────────────────────────────────────────────────────────
        totalDelivered: { type: Number, default: 0 },
        rating:         { type: Number, default: 5, min: 1, max: 5 },

        // ─── Last known GPS location ──────────────────────────────────────
        lastLocation: {
            lat:       { type: Number, default: null },
            lng:       { type: Number, default: null },
            updatedAt: { type: Date,   default: null },
        },
    },
    { timestamps: true }
);

export default mongoose.model("DeliveryBoy", deliveryBoySchema);