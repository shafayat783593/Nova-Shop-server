import mongoose from "mongoose";

const locationHistorySchema = new mongoose.Schema(
    {
        deliveryBoy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DeliveryBoy",
            required: true,
            index: true,
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true,
        },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        recordedAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

// ─── Auto-delete after 24 hours ───────────────────────────────────────────────
locationHistorySchema.index({ recordedAt: 1 }, { expireAfterSeconds: 86400 });

export default mongoose.model("LocationHistory", locationHistorySchema);