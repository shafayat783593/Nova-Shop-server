import Wishlist from "../models/wishlist.model.js";
import Product from "../models/product.model.js";

// ─── Helper: send error response ─────────────────────────────────────────────
const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─────────────────────────────────────────────────────────────────────────────
// GET WISHLIST
// Route: GET /api/wishlist
// Who can use: logged-in user only
// What it does: returns the user's full wishlist with product details
// ─────────────────────────────────────────────────────────────────────────────
export const getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find this user's wishlist and fill in product details
        const wishlist = await Wishlist.findOne({ user: userId })
            .populate(
                "items.product",
                "name slug images basePrice discountedPrice isActive category averageRating totalReviews"
            )
            .lean();

        // If no wishlist exists yet, return empty
        if (!wishlist) {
            return res.status(200).json({
                success: true,
                data: { items: [], totalItems: 0 },
            });
        }

        return res.status(200).json({ success: true, data: wishlist });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO WISHLIST
// Route: POST /api/wishlist/add
// Body: { productId, variantId?, note?, priority? }
// What it does: adds a product to wishlist (ignores if already there)
// ─────────────────────────────────────────────────────────────────────────────
export const addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variantId = null, note = "", priority = 1 } = req.body;

        // Validate required field
        if (!productId) {
            return sendError(res, "productId is required", 400);
        }

        // Make sure the product exists and is active
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return sendError(res, "Product not found or inactive", 404);
        }

        // Get the price to snapshot
        const priceAtAdd = product.discountedPrice ?? product.basePrice;

        // Find or create wishlist for this user
        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, items: [] });
        }

        // Check if this product (+ variant) is already in the wishlist
        const alreadyExists = wishlist.items.some((item) => {
            const sameProduct = item.product.toString() === productId;
            const sameVariant = variantId
                ? item.variant?.toString() === variantId
                : !item.variant;
            return sameProduct && sameVariant;
        });

        if (alreadyExists) {
            return res.status(200).json({
                success: true,
                message: "Already in wishlist",
                data: wishlist,
            });
        }

        // Add the new item
        wishlist.items.push({
            product: productId,
            variant: variantId,
            note: note.trim(),
            priority,
            priceAtAdd,
        });

        await wishlist.save(); // pre-save hook updates totalItems

        return res.status(201).json({
            success: true,
            message: "Added to wishlist",
            data: wishlist,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE FROM WISHLIST
// Route: DELETE /api/wishlist/:productId
// What it does: removes a product from wishlist
// ─────────────────────────────────────────────────────────────────────────────
export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            return sendError(res, "Wishlist not found", 404);
        }

        // Remove item that matches this product
        const beforeCount = wishlist.items.length;
        wishlist.items = wishlist.items.filter(
            (item) => item.product.toString() !== productId
        );

        // If nothing was removed, product wasn't in wishlist
        if (wishlist.items.length === beforeCount) {
            return sendError(res, "Product not in wishlist", 404);
        }

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Removed from wishlist",
            data: wishlist,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE WISHLIST  (add if not there, remove if already there)
// Route: POST /api/wishlist/toggle
// Body: { productId, variantId? }
// What it does: one button handles both add and remove
// ─────────────────────────────────────────────────────────────────────────────
export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variantId = null } = req.body;

        if (!productId) {
            return sendError(res, "productId is required", 400);
        }

        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return sendError(res, "Product not found", 404);
        }

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, items: [] });
        }

        // Check if item is already in wishlist
        const existingIndex = wishlist.items.findIndex((item) => {
            const sameProduct = item.product.toString() === productId;
            const sameVariant = variantId
                ? item.variant?.toString() === variantId
                : !item.variant;
            return sameProduct && sameVariant;
        });

        let action;

        if (existingIndex > -1) {
            // Already in wishlist → remove it
            wishlist.items.splice(existingIndex, 1);
            action = "removed";
        } else {
            // Not in wishlist → add it
            wishlist.items.push({
                product: productId,
                variant: variantId,
                priceAtAdd: product.discountedPrice ?? product.basePrice,
            });
            action = "added";
        }

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: action === "added" ? "Added to wishlist" : "Removed from wishlist",
            wishlisted: action === "added",
            data: wishlist,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE WISHLIST ITEM  (change note or priority)
// Route: PATCH /api/wishlist/:productId
// Body: { note?, priority? }
// ─────────────────────────────────────────────────────────────────────────────
export const updateWishlistItem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        const { note, priority } = req.body;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) {
            return sendError(res, "Wishlist not found", 404);
        }

        // Find the item
        const item = wishlist.items.find(
            (i) => i.product.toString() === productId
        );
        if (!item) {
            return sendError(res, "Product not in wishlist", 404);
        }

        // Update only the fields that were sent
        if (note !== undefined) item.note = note.trim();
        if (priority !== undefined) item.priority = priority;

        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Wishlist item updated",
            data: wishlist,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR WISHLIST  (remove everything)
// Route: DELETE /api/wishlist
// ─────────────────────────────────────────────────────────────────────────────
export const clearWishlist = async (req, res) => {
    try {
        const userId = req.user._id;

        await Wishlist.findOneAndDelete({ user: userId });

        return res.status(200).json({
            success: true,
            message: "Wishlist cleared",
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF PRODUCT IS WISHLISTED
// Route: GET /api/wishlist/check/:productId
// Returns: { wishlisted: true/false }
// ─────────────────────────────────────────────────────────────────────────────
export const checkWishlisted = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ user: userId }).lean();

        const wishlisted = wishlist
            ? wishlist.items.some((i) => i.product.toString() === productId)
            : false;

        return res.status(200).json({ success: true, wishlisted });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MOVE TO CART  (add to cart and remove from wishlist)
// Route: POST /api/wishlist/move-to-cart/:productId
// ─────────────────────────────────────────────────────────────────────────────
export const moveToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) return sendError(res, "Wishlist not found", 404);

        const item = wishlist.items.find(
            (i) => i.product.toString() === productId
        );
        if (!item) return sendError(res, "Product not in wishlist", 404);

        // Remove from wishlist
        wishlist.items = wishlist.items.filter(
            (i) => i.product.toString() !== productId
        );
        await wishlist.save();

        // NOTE: Actual cart add should be done from the frontend
        // by calling POST /api/cart/add separately after this succeeds.
        // This endpoint just removes the item from wishlist.

        return res.status(200).json({
            success: true,
            message: "Moved to cart — please add to cart from frontend",
            productId: item.product,
            variantId: item.variant,
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};