import Cart from "../models/cart.modle.js";
import Product from "../models/product.model.js";
import Promotion from "../models/promotion.model.js";
import { v4 as uuidv4 } from "uuid";
import { recalculate } from "../utils/runPromotionEngine.js";
// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── NaN-safe number helper ───────────────────────────────────────────────────
const n = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

// ─── PROMOTION ENGINE ─────────────────────────────────────────────────────────
// items MUST be plain objects (use toObject() before calling)
async function runPromotionEngine(items, paymentMethod) {
    const now = new Date();

    const rawPromotions = await Promotion.find({
        isActive: true,
        $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
    }).lean();

    // Extra safety — DB isActive undefined হলেও ধরবে
    const promotions = rawPromotions.filter((p) => p.isActive === true);

    // ── Step 1: subtotal ──────────────────────────────────────────────────────
    const subtotal = items.reduce(
        (s, i) => s + n(i.priceAtAdd) * n(i.quantity),
        0
    );

    let cartDiscount = 0;
    let shippingFee = 80;

    // ── Step 2: product-level promotions ─────────────────────────────────────
    const enrichedItems = items.map((item) => {
        // item is a plain object — safe to read
        const priceAtAdd = n(item.priceAtAdd);
        const qty = n(item.quantity);
        const productIdStr = item.product?._id?.toString() || item.product?.toString();

        let itemDiscount = 0;
        const itemPromos = [];

        promotions
            .filter((p) => p.type === "product")
            .forEach((promo) => {
                if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return;

                const hasProductScope = promo.scope?.products?.length > 0;
                const hasCategoryScope = promo.scope?.categories?.length > 0;

                const inProducts = hasProductScope
                    ? promo.scope.products.some((id) => id?.toString() === productIdStr)
                    : false;

                const inCategories = hasCategoryScope
                    ? promo.scope.categories.includes(item.category || "")
                    : false;

                const noScope = !hasProductScope && !hasCategoryScope;
                const excluded = promo.scope?.excludeProducts?.some(
                    (id) => id?.toString() === productIdStr
                );

                if (excluded) return;
                if (!noScope && !inProducts && !inCategories) return;

                const lineTotal = priceAtAdd * qty;
                let discount = 0;

                if (promo.discountType === "percent")
                    discount = (lineTotal * n(promo.value)) / 100;
                else if (promo.discountType === "fixed")
                    discount = Math.min(n(promo.value), lineTotal);
                else if (promo.discountType === "free")
                    discount = lineTotal;

                discount = n(discount);
                if (discount > 0) {
                    itemDiscount += discount;
                    itemPromos.push({ promotionId: promo._id, discountAmount: discount });
                }
            });

        const perUnitDiscount = qty > 0 ? itemDiscount / qty : 0;
        const finalPrice = Math.max(0, priceAtAdd - perUnitDiscount);

        return {
            ...item,                        // plain object spread — safe ✓
            finalPrice: n(finalPrice),
            appliedPromotions: itemPromos,
        };
    });

    // ── Step 3: discounted subtotal ───────────────────────────────────────────
    const discountedSubtotal = enrichedItems.reduce(
        (s, i) => s + n(i.finalPrice) * n(i.quantity),
        0
    );
    const itemLevelDiscount = n(subtotal) - n(discountedSubtotal);

    // ── Step 4: cart-level & free-shipping ────────────────────────────────────
    const cartPromos = promotions
        .filter((p) => p.type === "cart" || p.type === "free_shipping")
        .sort((a, b) => n(b.priority) - n(a.priority));

    for (const promo of cartPromos) {
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit) continue;
        if (promo.conditions?.minCartValue &&
            discountedSubtotal < n(promo.conditions.minCartValue)) continue;
        if (promo.conditions?.paymentMethod && paymentMethod &&
            promo.conditions.paymentMethod !== paymentMethod) continue;

        if (promo.type === "free_shipping") {
            shippingFee = 0;
            continue;
        }

        let discount = 0;
        if (promo.discountType === "percent")
            discount = (discountedSubtotal * n(promo.value)) / 100;
        else if (promo.discountType === "fixed")
            discount = Math.min(n(promo.value), discountedSubtotal);

        discount = n(discount);
        if (discount > 0) {
            cartDiscount += discount;
            if (!promo.stackable) break;
        }
    }

    // ── Step 5: BXGY ─────────────────────────────────────────────────────────
    let bxgyDiscount = 0;
    promotions.filter((p) => p.type === "bxgy").forEach((promo) => {
        const buy = n(promo.bxgy?.buy) || 1;
        const get = n(promo.bxgy?.get) || 1;
        const eligibleItems = enrichedItems.filter((item) => {
            const pid = item.product?._id?.toString() || item.product?.toString();
            return promo.bxgy?.productIds?.some((id) => id?.toString() === pid);
        });
        if (!eligibleItems.length) return;

        const totalQty = eligibleItems.reduce((s, i) => s + n(i.quantity), 0);
        const freeQty = Math.floor(totalQty / (buy + get)) * get;
        if (freeQty <= 0) return;

        const cheapest = [...eligibleItems].sort(
            (a, b) => n(a.priceAtAdd) - n(b.priceAtAdd)
        )[0];
        bxgyDiscount += n(cheapest.priceAtAdd) * freeQty;
    });

    // ── Step 6: totals ────────────────────────────────────────────────────────
    const totalDiscount = n(itemLevelDiscount) + n(cartDiscount) + n(bxgyDiscount);
    const finalTotal = Math.max(
        0,
        n(discountedSubtotal) - n(cartDiscount) - n(bxgyDiscount) + n(shippingFee)
    );

    return {
        enrichedItems,
        subtotal: n(subtotal),
        discount: n(totalDiscount),
        shippingFee: n(shippingFee),
        total: n(finalTotal),
    };
}


// ─── GET CART ─────────────────────────────────────────────────────────────────
export const getCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        if (!userId && !sessionId) {
            return res.status(200).json({ success: true, data: null });
        }

        const filter = userId
            ? { user: userId, isCheckedOut: false }
            : { sessionId, isCheckedOut: false };

        // Fetch as Mongoose doc (not lean) so recalculate can call toObject()
        let cart = await Cart.findOne(filter);
        if (!cart) return res.status(200).json({ success: true, data: null });

        // Always recalculate on GET — keeps promotions fresh
        cart = await recalculate(cart, null);

        // Populate after save
        await cart.populate(
            "items.product",
            "name images basePrice discountedPrice isActive slug"
        );

        const cartObj = cart.toObject();

        // Normalize snapshots from populated product if missing
        cartObj.items = cartObj.items.map((item) => ({
            ...item,
            nameSnapshot: item.nameSnapshot || item.product?.name || "Unknown",
            imageSnapshot: item.imageSnapshot || item.product?.images?.[0] || "",
        }));

        return res.status(200).json({ success: true, data: cartObj });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADD TO CART ──────────────────────────────────────────────────────────────
export const addToCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { productId, variantId, quantity = 1 } = req.body;

        if (!productId) return sendError(res, "productId is required", 400);

        const qty = Math.max(1, n(quantity));

        const product = await Product.findById(productId);
        if (!product || !product.isActive)
            return sendError(res, "Product not found or inactive", 404);

        let price = n(product.discountedPrice ?? product.basePrice);
        let stock = null;
        let variantObjId = null;

        if (product.hasVariants && variantId) {
            const variant = product.variants.id(variantId);
            if (!variant) return sendError(res, "Variant not found", 404);
            price = n(variant.price);
            stock = n(variant.stock);
            variantObjId = variant._id;
        }

        if (!price || isNaN(price))
            return sendError(res, "Product price is not set correctly", 400);

        if (stock !== null && stock < qty)
            return sendError(res, `Only ${stock} in stock`, 400);

        let newSessionId = sessionId;
        let cart = userId
            ? await Cart.findOne({ user: userId, isCheckedOut: false })
            : sessionId
                ? await Cart.findOne({ sessionId, isCheckedOut: false })
                : null;

        if (!cart) {
            if (!userId) newSessionId = sessionId || uuidv4();
            cart = new Cart(userId ? { user: userId } : { sessionId: newSessionId });
        }

        const existingIdx = cart.items.findIndex((i) => {
            const sameProduct = i.product?.toString() === productId;
            const sameVariant = variantObjId
                ? i.variant?.toString() === variantObjId.toString()
                : !i.variant;
            return sameProduct && sameVariant;
        });

        if (existingIdx > -1) {
            let newQty = n(cart.items[existingIdx].quantity) + qty;
            if (stock !== null) newQty = Math.min(newQty, stock);
            cart.items[existingIdx].quantity = newQty;
        } else {
            cart.items.push({
                product: product._id,
                variant: variantObjId,
                nameSnapshot: product.name,
                imageSnapshot: product.images?.[0] || "",
                quantity: qty,
                priceAtAdd: price,
                finalPrice: price,
                stockSnapshot: stock,
                isAvailable: true,
            });
        }

        await recalculate(cart, req.body.paymentMethod);

        // Populate for response
        await cart.populate(
            "items.product",
            "name images basePrice discountedPrice isActive slug"
        );

        const cartObj = cart.toObject();
        cartObj.items = cartObj.items.map((item) => ({
            ...item,
            nameSnapshot: item.nameSnapshot || item.product?.name || "Unknown",
            imageSnapshot: item.imageSnapshot || item.product?.images?.[0] || "",
        }));

        return res.status(200).json({
            success: true,
            message: "Added to cart",
            data: cartObj,
            sessionId: newSessionId,
        });
    } catch (err) {
        console.error("AddToCart Error:", err);
        return sendError(res, err.message);
    }
};

// ─── UPDATE QUANTITY ──────────────────────────────────────────────────────────
export const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { quantity } = req.body;
        const { itemId } = req.params;

        const qty = n(quantity);
        if (!qty || qty < 1) return sendError(res, "Quantity must be >= 1", 400);

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        const item = cart.items.id(itemId);
        if (!item) return sendError(res, "Item not found in cart", 404);

        const maxStock = n(item.stockSnapshot);
        item.quantity = maxStock > 0 ? Math.min(qty, maxStock) : qty;

        await recalculate(cart, req.body.paymentMethod);
        const cartObj = cart.toObject();

        return res.status(200).json({ success: true, message: "Cart updated", data: cartObj });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── REMOVE ITEM ──────────────────────────────────────────────────────────────
export const removeCartItem = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { itemId } = req.params;

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        cart.items = cart.items.filter((i) => i._id.toString() !== itemId);
        await recalculate(cart, null);

        return res.status(200).json({ success: true, message: "Item removed", data: cart.toObject() });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── CLEAR CART ───────────────────────────────────────────────────────────────
export const clearCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        await Cart.findOneAndDelete(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        return res.status(200).json({ success: true, message: "Cart cleared" });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── MERGE GUEST → USER ───────────────────────────────────────────────────────
export const mergeCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { sessionId } = req.body;

        if (!sessionId) return sendError(res, "sessionId required", 400);

        const guestCart = await Cart.findOne({ sessionId, isCheckedOut: false });
        if (!guestCart || !guestCart.items.length) {
            return res.status(200).json({ success: true, message: "No guest cart to merge" });
        }

        let userCart = await Cart.findOne({ user: userId, isCheckedOut: false });
        if (!userCart) {
            guestCart.user = userId;
            guestCart.sessionId = undefined;
            await recalculate(guestCart, null);
            return res.status(200).json({ success: true, message: "Cart merged", data: guestCart.toObject() });
        }

        for (const guestItem of guestCart.items) {
            const guestPlain = guestItem.toObject ? guestItem.toObject() : { ...guestItem };
            const existIdx = userCart.items.findIndex((i) => {
                const sameProduct = i.product?.toString() === guestPlain.product?.toString();
                const sameVariant = guestPlain.variant
                    ? i.variant?.toString() === guestPlain.variant?.toString()
                    : !i.variant;
                return sameProduct && sameVariant;
            });

            if (existIdx > -1) {
                let newQty = n(userCart.items[existIdx].quantity) + n(guestPlain.quantity);
                const maxStock = n(guestPlain.stockSnapshot);
                if (maxStock > 0) newQty = Math.min(newQty, maxStock);
                userCart.items[existIdx].quantity = newQty;
            } else {
                userCart.items.push(guestPlain);
            }
        }

        await recalculate(userCart, null);
        await Cart.findOneAndDelete({ sessionId, isCheckedOut: false });

        return res.status(200).json({ success: true, message: "Cart merged", data: userCart.toObject() });
    } catch (err) {
        return sendError(res, err.message);
    }
};



// ─── APPLY COUPON ─────────────────────────────────────────────────────────────
export const applyCoupon = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { code } = req.body;

        if (!code) return sendError(res, "Coupon code required", 400);

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        const promo = await Promotion.findOne({
            name: code.trim().toUpperCase(),
            isActive: true,
        });
        if (!promo) return sendError(res, "Invalid coupon code", 404);
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
            return sendError(res, "Coupon usage limit reached", 400);

        let discountAmount = 0;
        if (promo.discountType === "percent")
            discountAmount = (n(cart.subtotal) * n(promo.value)) / 100;
        else if (promo.discountType === "fixed")
            discountAmount = Math.min(n(promo.value), n(cart.subtotal));

        discountAmount = n(discountAmount);

        cart.appliedCoupon = { code: code.trim().toUpperCase(), discountAmount };
        cart.discount = n(cart.discount) + discountAmount;
        cart.total = Math.max(0, n(cart.total) - discountAmount);
        cart.lastActivityAt = new Date();
        await cart.save();

        return res.status(200).json({ success: true, message: "Coupon applied", data: cart.toObject() });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── REMOVE COUPON ────────────────────────────────────────────────────────────
export const removeCoupon = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        const couponDiscount = n(cart.appliedCoupon?.discountAmount);
        cart.discount = Math.max(0, n(cart.discount) - couponDiscount);
        cart.total = n(cart.total) + couponDiscount;
        cart.appliedCoupon = undefined;
        cart.lastActivityAt = new Date();
        await cart.save();

        return res.status(200).json({ success: true, message: "Coupon removed", data: cart.toObject() });
    } catch (err) {
        return sendError(res, err.message);
    }
};






export const countCartitme = async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id, isCheckedOut: false }).lean();
    const count = cart?.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
    res.json({ success: true, count });
}