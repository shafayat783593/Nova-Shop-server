import Wishlist from "../models/wishlist.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.modle.js";
import { recalculate } from "../utils/runPromotionEngine.js";

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── GET WISHLIST ──────────────────────────────────────────────────────────────
export const getWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const wishlist = await Wishlist.findOne({ user: userId })
            .populate("items.product", "name slug images basePrice discountedPrice isActive category averageRating totalReviews")
            .lean();

        if (!wishlist) return res.status(200).json({ success: true, data: { items: [], totalItems: 0 } });
        return res.status(200).json({ success: true, data: wishlist });
    } catch (err) { return sendError(res, err.message); }
};

// ─── ADD TO WISHLIST ───────────────────────────────────────────────────────────
export const addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variantId = null, note = "", priority = 1 } = req.body;

        if (!productId) return sendError(res, "productId is required", 400);

        const product = await Product.findById(productId);
        if (!product || !product.isActive) return sendError(res, "Product not found or inactive", 404);

        const priceAtAdd = product.discountedPrice ?? product.basePrice;

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) wishlist = new Wishlist({ user: userId, items: [] });

        const alreadyExists = wishlist.items.some(item => {
            const sameProduct = item.product.toString() === productId;
            const sameVariant = variantId ? item.variant?.toString() === variantId : !item.variant;
            return sameProduct && sameVariant;
        });

        if (alreadyExists) return res.status(200).json({ success: true, message: "Already in wishlist", data: wishlist });

        wishlist.items.push({ product: productId, variant: variantId, note: note.trim(), priority, priceAtAdd });
        await wishlist.save();

        return res.status(201).json({ success: true, message: "Added to wishlist", data: wishlist });
    } catch (err) { return sendError(res, err.message); }
};

// ─── REMOVE FROM WISHLIST ──────────────────────────────────────────────────────
export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) return sendError(res, "Wishlist not found", 404);

        const beforeCount = wishlist.items.length;
        wishlist.items = wishlist.items.filter(item => item.product.toString() !== productId);

        if (wishlist.items.length === beforeCount) return sendError(res, "Product not in wishlist", 404);

        await wishlist.save();
        return res.status(200).json({ success: true, message: "Removed from wishlist", data: wishlist });
    } catch (err) { return sendError(res, err.message); }
};

// ─── TOGGLE WISHLIST ───────────────────────────────────────────────────────────
export const toggleWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variantId = null } = req.body;

        if (!productId) return sendError(res, "productId is required", 400);

        const product = await Product.findById(productId);
        if (!product || !product.isActive) return sendError(res, "Product not found", 404);

        let wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) wishlist = new Wishlist({ user: userId, items: [] });

        const existingIndex = wishlist.items.findIndex(item => {
            const sameProduct = item.product.toString() === productId;
            const sameVariant = variantId ? item.variant?.toString() === variantId : !item.variant;
            return sameProduct && sameVariant;
        });

        let action;
        if (existingIndex > -1) {
            wishlist.items.splice(existingIndex, 1);
            action = "removed";
        } else {
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
    } catch (err) { return sendError(res, err.message); }
};

// ─── UPDATE WISHLIST ITEM ──────────────────────────────────────────────────────
export const updateWishlistItem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        const { note, priority } = req.body;

        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) return sendError(res, "Wishlist not found", 404);

        const item = wishlist.items.find(i => i.product.toString() === productId);
        if (!item) return sendError(res, "Product not in wishlist", 404);

        if (note !== undefined) item.note = note.trim();
        if (priority !== undefined) item.priority = priority;

        await wishlist.save();
        return res.status(200).json({ success: true, message: "Wishlist item updated", data: wishlist });
    } catch (err) { return sendError(res, err.message); }
};

// ─── CLEAR WISHLIST ────────────────────────────────────────────────────────────
export const clearWishlist = async (req, res) => {
    try {
        await Wishlist.findOneAndDelete({ user: req.user._id });
        return res.status(200).json({ success: true, message: "Wishlist cleared" });
    } catch (err) { return sendError(res, err.message); }
};

// ─── CHECK IF WISHLISTED ───────────────────────────────────────────────────────
export const checkWishlisted = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        const wishlist = await Wishlist.findOne({ user: userId }).lean();
        const wishlisted = wishlist ? wishlist.items.some(i => i.product.toString() === productId) : false;
        return res.status(200).json({ success: true, wishlisted });
    } catch (err) { return sendError(res, err.message); }
};

// ─── MOVE TO CART (with stock check) ──────────────────────────────────────────
export const moveToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId } = req.params;
        const quantity = req.body && req.body.quantity ? Number(req.body.quantity) : 1;        // 1. Product check
        const product = await Product.findById(productId);
        if (!product || !product.isActive) return sendError(res, "Product not found or inactive", 404);

        // 2. Wishlist check
        const wishlist = await Wishlist.findOne({ user: userId });
        if (!wishlist) return sendError(res, "Wishlist not found", 404);

        const wishlistItem = wishlist.items.find(
            i => i.product.toString() === productId
        );
        if (!wishlistItem) return sendError(res, "Product not in wishlist", 404);

        // 3. Stock check
        // moveToCart এ এই অংশটা replace করো

        // 3. Stock check
        let stock = null;
        let price = Number(product.discountedPrice ?? product.basePrice);
        let variantObjId = null;

        if (product.hasVariants && wishlistItem.variant) {
            const variant = product.variants.id(wishlistItem.variant);
            if (!variant) return sendError(res, "Variant not found", 404);
            stock = Number(variant.stock ?? 0);
            price = Number(variant.price);
            variantObjId = variant._id;
        } else if (product.stock !== undefined && product.stock !== null) {
            stock = Number(product.stock);
        }

        if (stock !== null && stock < 1) {
            return res.status(400).json({
                success: false,
                outOfStock: true,
                message: "This product is out of stock",
            });
        }

        // 4. Cart
        let cart = await Cart.findOne({ user: userId, isCheckedOut: false });
        if (!cart) cart = new Cart({ user: userId, items: [] });

        // ← KEY FIX: stock null হলে qty = quantity, না হলে stock এর মধ্যে clamp করো
        const qty = stock !== null ? Math.min(Number(quantity), stock) : Number(quantity);

        if (qty < 1) {
            return res.status(400).json({
                success: false,
                outOfStock: true,
                message: "This product is out of stock",
            });
        }

        const existingIdx = cart.items.findIndex(i => {
            const sameProduct = i.product?.toString() === productId;
            const sameVariant = variantObjId
                ? i.variant?.toString() === variantObjId.toString()
                : !i.variant;
            return sameProduct && sameVariant;
        });

        if (existingIdx > -1) {
            const newQty = Number(cart.items[existingIdx].quantity) + qty;
            cart.items[existingIdx].quantity = stock ? Math.min(newQty, stock) : newQty;
        } else {
            cart.items.push({
                product: product._id,
                variant: variantObjId || undefined,
                nameSnapshot: product.name,
                imageSnapshot: product.images?.[0] || "",
                quantity: qty,
                priceAtAdd: price,
                finalPrice: price,
                stockSnapshot: stock,
                isAvailable: true,
            });
        }

        // 5. recalculate করো (promotion engine চালাও)
        await recalculate(cart, null); // ← cart.save() এর বদলে এটা

        // 6. Wishlist থেকে remove
        wishlist.items = wishlist.items.filter(
            i => i.product.toString() !== productId
        );
        await wishlist.save();

        return res.status(200).json({
            success: true,
            message: "Moved to cart",
            productId: product._id,
        });
    } catch (err) {
        console.error("moveToCart error:", err);
        return sendError(res, err.message);
    }
};


