import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, required: true, unique: true, trim: true },
        email: { type: String, trim: true, lowercase: true },

        // Which districts / areas this boy covers
        zones: [{ type: String, trim: true }],

        isAvailable: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },

        // Orders currently assigned to this delivery boy
        currentOrders: [
            { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        ],

        totalDelivered: { type: Number, default: 0 },
        rating: { type: Number, default: 5, min: 1, max: 5 },

        // Last known GPS location (for real-time tracking)
        lastLocation: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
            updatedAt: { type: Date, default: null },
        },
    },
    { timestamps: true }
);

export default mongoose.model("DeliveryBoy", deliveryBoySchema);