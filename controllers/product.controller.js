import mongoose from "mongoose";
import Product from "../models/product.model.js";

// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500, errors = null) => {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(status).json(body);
};

// ─── CREATE PRODUCT ───────────────────────────────────────────────────────────
// POST /api/products
export const createProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            tags,
            basePrice,
            discountedPrice,
            images,
            gallery,
            hasVariants,
            variants,
            isActive,
            isFeatured,
        } = req.body;

        // Basic required field check
        if (!name || !description || !category || !basePrice) {
            return sendError(res, "name, description, category, and basePrice are required", 400);
        }

        // hasVariants true হলে variants লাগবেই
        if (hasVariants === true && (!variants || variants.length === 0)) {
            return sendError(res, "At least one variant is required when hasVariants is true", 400);
        }

        const product = new Product({
            name,
            description,
            category,
            tags,
            basePrice,
            discountedPrice,
            images,
            gallery,
            hasVariants,
            variants,
            isActive,
            isFeatured,
        });

        await product.save();

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            data: product,
        });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue || {})[0];
            return sendError(res, `${field} already exists`, 409);
        }
        console.error("Create Product Error:", err);
        return sendError(res, err.message || "Something went wrong");
    }
};

// ─── UPDATE PRODUCT ───────────────────────────────────────────────────────────
// PUT /api/products/:id
export const updateProduct = async (req, res) => {
    try {
        const updateData = req.body;
        const { slug } = req.params; // ✅ slug ধরো

        // ── Validation ─────────────────────
        if (updateData.hasVariants === true) {
            if (updateData.variants && updateData.variants.length === 0) {
                return sendError(res, "At least one variant is required when hasVariants is true", 400);
            }
        }

        if (updateData.hasVariants === false) {
            updateData.variants = [];
        }

        // ── Slug regenerate (if name changed) ─────────────────
        if (updateData.name) {
            updateData.slug = updateData.name
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
        }

        // ── Update by slug ─────────────────
        const product = await Product.findOneAndUpdate(
            { slug: slug },   // ✅ এখানে slug use করো
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!product) return sendError(res, "Product not found", 404);

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product,
        });

    } catch (err) {
        if (err.code === 11000) {
            return sendError(res, "A product with this name/slug already exists", 409);
        }
        console.error("Update Product Error:", err);
        return sendError(res, err.message || "Something went wrong");
    }
};

// ─── GET ALL PRODUCTS ─────────────────────────────────────────────────────────
// GET /api/products?page=1&limit=12&category=shoes&search=nike&sort=-createdAt&isActive=true&isFeatured=true
export const getAllProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            category,
            search,
            sort = "-createdAt",
            isActive,
            isFeatured,
            minPrice,
            maxPrice,
            hasVariants,
        } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
        if (hasVariants !== undefined) filter.hasVariants = hasVariants === "true";

        // Price range filter
        if (minPrice || maxPrice) {
            filter.basePrice = {};
            if (minPrice) filter.basePrice.$gte = Number(minPrice);
            if (maxPrice) filter.basePrice.$lte = Number(maxPrice);
        }

        // Search across name, description, category, tags
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
                { tags: { $in: [new RegExp(search, "i")] } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Product.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: products,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        console.error("Get All Products Error:", err);
        return sendError(res, err.message);
    }
};

// ─── GET ONE BY SLUG ──────────────────────────────────────────────────────────
// GET /api/products/:slug
export const getProductById = async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await Product.findOne({ slug }).lean();

        if (!product) return sendError(res, "Product not found", 404);

        return res.status(200).json({ success: true, data: product });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return sendError(res, "Product not found", 404);

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── TOGGLE ACTIVE STATUS ─────────────────────────────────────────────────────
// PATCH /api/products/:id/toggle
export const toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return sendError(res, "Product not found", 404);

        product.isActive = !product.isActive;
        await product.save();

        return res.status(200).json({
            success: true,
            message: `Product is now ${product.isActive ? "active" : "inactive"}`,
            data: { isActive: product.isActive },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── TOGGLE FEATURED ──────────────────────────────────────────────────────────
// PATCH /api/products/:id/feature
export const toggleFeatured = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return sendError(res, "Product not found", 404);

        product.isFeatured = !product.isFeatured;
        await product.save();

        return res.status(200).json({
            success: true,
            message: `Product is now ${product.isFeatured ? "featured" : "unfeatured"}`,
            data: { isFeatured: product.isFeatured },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET CATEGORIES ───────────────────────────────────────────────────────────
// GET /api/products/categories
export const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct("category");
        return res.status(200).json({ success: true, data: categories });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET VARIANTS OF A PRODUCT ────────────────────────────────────────────────
// GET /api/products/:id/variants
export const getProductVariants = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).select("name variants hasVariants").lean();
        if (!product) return sendError(res, "Product not found", 404);

        return res.status(200).json({
            success: true,
            data: {
                productName: product.name,
                hasVariants: product.hasVariants,
                variants: product.variants,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── UPDATE STOCK OF A SINGLE VARIANT ────────────────────────────────────────
// PATCH /api/products/:id/variants/:variantId/stock
export const updateVariantStock = async (req, res) => {
    try {
        const { id, variantId } = req.params;
        const { stock } = req.body;

        if (stock === undefined || stock < 0) {
            return sendError(res, "Valid stock value is required", 400);
        }

        const product = await Product.findOneAndUpdate(
            { _id: id, "variants._id": variantId },
            { $set: { "variants.$.stock": stock } },
            { new: true }
        );

        if (!product) return sendError(res, "Product or variant not found", 404);

        const updatedVariant = product.variants.find(
            (v) => v._id.toString() === variantId
        );

        return res.status(200).json({
            success: true,
            message: "Variant stock updated",
            data: updatedVariant,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};




// GET /api/categories for promotion ....
// controllers/product.controller.js
export const getCategoriesPromotion = async (req, res) => {
    try {
        const { search, isActive } = req.query;

        // যদি ক্যাটাগরিগুলো প্রোডাক্ট মডেলের অংশ হয়:
        let matchQuery = {};
        if (isActive === "true") matchQuery.isActive = true;
        if (search) matchQuery.name = { $regex: search, $options: "i" };

        // যদি আলাদা ক্যাটাগরি কালেকশন থাকে:
        const categories = await Product.find(matchQuery).select("_id name").limit(50);

        res.status(200).json({ success: true, data: categories });
    } catch (error) {
        console.error("DEBUG - getCategoriesPromotion Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};






export const getCategoriesWithImages = async (req, res) => {
    try {
        const categories = await Product.aggregate([
            // Only active products with at least one image
            {
                $match: {
                    isActive: true,
                    images: { $exists: true, $not: { $size: 0 } },
                    category: { $exists: true, $ne: "" },
                },
            },
            // Sort so featured products come first (better representative image)
            { $sort: { isFeatured: -1, averageRating: -1, createdAt: -1 } },
            // Group by category
            {
                $group: {
                    _id: "$category",
                    image: { $first: { $arrayElemAt: ["$images", 0] } },
                    productCount: { $sum: 1 },
                    // Grab up to 4 extra images for the mosaic effect
                    extraImages: { $push: { $arrayElemAt: ["$images", 0] } },
                    topProduct: { $first: "$name" },
                },
            },
            // Clean up extraImages to max 4
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    image: 1,
                    productCount: 1,
                    extraImages: { $slice: ["$extraImages", 1, 3] },
                    topProduct: 1,
                },
            },
            { $sort: { productCount: -1 } },
        ]);

        return res.status(200).json({ success: true, data: categories });
    } catch (err) {
        console.error("getCategoriesWithImages error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};