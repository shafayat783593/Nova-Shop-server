import { productSchema, productUpdateSchema } from "../config/zod.js";
import Product from "../models/product.model.js";

// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500, errors = null) => {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(status).json(body);
};

// ─── CREATE PRODUCT ───────────────────────────────────────────────────────────
export const createProduct = async (req, res) => {
    try {
        const validation = productSchema.safeParse(req.body);

        if (!validation.success) {
            const allErrors = validation.error.issues.map((issue) => ({
                field: issue.path?.join(".") || "unknown",
                message: issue.message,
                code: issue.code,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: allErrors,
            });
        }

        const productData = validation.data;

        // Extra Safety: যদি hasVariants true হয় কিন্তু variants খালি থাকে
        if (productData.hasVariants && (!productData.variants || productData.variants.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "At least one variant is required when hasVariants is true",
            });
        }

        const product = new Product(productData);
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
export const updateProduct = async (req, res) => {
    try {
        // For update we use a more flexible approach because partial() breaks superRefine
        const validation = productSchema.partial().safeParse(req.body);

        if (!validation.success) {
            const allErrors = validation.error.issues.map((issue) => ({
                field: issue.path?.join(".") || "unknown",
                message: issue.message,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: allErrors,
            });
        }

        const updateData = validation.data;

        // Manual check for hasVariants logic during update
        if (updateData.hasVariants === true) {
            if (updateData.variants && updateData.variants.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "At least one variant is required when hasVariants is true",
                });
            }
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
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
        console.error("Update Product Error:", err);
        return sendError(res, err.message || "Something went wrong");
    }
};

// ─── GET ALL PRODUCTS ─────────────────────────────────────────────────────────
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
        } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
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

// ─── GET ONE ──────────────────────────────────────────────────────────────────
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        if (!product) return sendError(res, "Product not found", 404);

        return res.status(200).json({ success: true, data: product });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
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

// ─── TOGGLE STATUS ────────────────────────────────────────────────────────────
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

// ─── GET CATEGORIES ───────────────────────────────────────────────────────────
export const getCategories = async (req, res) => {
    try {
        const categories = await Product.distinct("category");
        return res.status(200).json({ success: true, data: categories });
    } catch (err) {
        return sendError(res, err.message);
    }
};