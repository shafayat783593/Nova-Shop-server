import mongoose from "mongoose";
const wishlistItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    variant: {
        type: mongoose.Schema.Types.ObjectId,
        default: null // যদি ভেরিয়েন্ট না থাকে
    },
    note: {
        type: String,
        trim: true,
        default: ""
    },
    priority: {
        type: Number,
        enum: [1, 2, 3, 4, 5], // ভ্যালিডেশন যোগ করা হলো
        default: 1
    },
    priceAtAdd: {
        type: Number,
        required: true // দাম অবশ্যই থাকা উচিত
    }
}, { _id: false });
const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true, // একজন ইউজারের জন্য একটিই উইশলিস্ট
        index: true   // সার্চ দ্রুত করার জন্য
    },
    items: [wishlistItemSchema],
    totalItems: {
        type: Number,
        default: 0
    }
}, { timestamps: true });
// Middleware: সেভ করার আগে অটোমেটিক totalItems আপডেট হবে
// wishlistSchema.pre('save', function (next) {
//     this.totalItems = this.items.length;
//     next();
// });

wishlistSchema.pre('save', async function () {
    
    this.totalItems = this.items.length;
});


const Wishlist = mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);
export default Wishlist;