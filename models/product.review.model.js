import mongoose from "mongoose";

const reviewMongoSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: [true, "Product ID is required"]
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", 
            required: [true, "User ID is required"]
        },
        rating: {
            type: Number,
            required: [true, "Rating is required"],
            min: [1, "Rating must be at least 1"],
            max: [5, "Rating cannot be more than 5"]
        },
        comment: {
            type: String,
            trim: true,
            required: [true, "Comment is required"]
        },
        images: [{ type: String }] 
    },
    {
        timestamps: true // রিভিউ কবে দেওয়া হয়েছে তা ট্র্যাক করার জন্য
    }
);

// ইন্ডেক্সিং: একজন ইউজার যেন একটি প্রোডাক্টে একবারই রিভিউ দিতে পারে
reviewMongoSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.models.Review || mongoose.model("Review", reviewMongoSchema);

export default Review;