import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    variant: {
        type: mongoose.Schema.Types.ObjectId, // যদি variant select করে
    },

    note: {
        type: String,
        trim: true
    },

    priority: {
        type: Number,
        default: 1 // 1 = low, 5 = high
    },

    priceAtAdd: {
        type: Number // wishlist add করার সময় price snapshot
    }
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },

    items: [wishlistItemSchema],

    // 👉 analytics
    totalItems: {
        type: Number,
        default: 0
    },

    lastUpdatedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

export default mongoose.models.Wishlist ||
    mongoose.model("Wishlist", wishlistSchema);