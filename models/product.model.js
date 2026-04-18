

import mongoose from "mongoose";

const variantMongoSchema = new mongoose.Schema(
    {
        size: { type: String, trim: true },
        color: { type: String, trim: true },
        stock: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        sku: { type: String, trim: true },
    },
    { _id: true }
);

const productMongoSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            trim: true,
            lowercase: true,
            unique: true,
            index: true,
        },
        description: { type: String, required: true },
        category: { type: String, required: true, trim: true },
        tags: [{ type: String, trim: true }],
        basePrice: { type: Number, required: true, min: 0 },
        discountedPrice: { type: Number, min: 0 },
        images: [{ type: String }],
        gallery: [{ type: String }],
        averageRating: { type: Number, default: 0 },
        totalReviews: { type: Number, default: 0 },

        hasVariants: {
            type: Boolean,
            default: false
        },
        variants: {
            type: [variantMongoSchema],
            default: []
        },

        isActive: { type: Boolean, default: true },
        isFeatured: { type: Boolean, default: false },
    },
    {
        timestamps: true
    }
);


productMongoSchema.pre('save', async function () {
    // ১. স্লাগ তৈরি করা (name থেকে)
    if (this.isModified('name') && this.name) {
        this.slug = this.name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }

    // ২. ভ্যারিয়েন্ট চেক লজিক (Throw Error ব্যবহার করুন)
    if (this.hasVariants === true) {
        if (!this.variants || this.variants.length === 0) {
            throw new Error("At least one variant is required when hasVariants is true");
        }

        this.variants.forEach((variant, index) => {
            if (!variant.size || variant.size.trim() === "") {
                throw new Error(`Variant ${index + 1}: Size is required`);
            }
            if (!variant.color || variant.color.trim() === "") {
                throw new Error(`Variant ${index + 1}: Color is required`);
            }
        });
    }

    // ৩. hasVariants false হলে variants খালি করা
    if (this.hasVariants === false) {
        this.variants = [];
    }
});

const Product = mongoose.models.Product || mongoose.model("Product", productMongoSchema);

export default Product;




