import Cart from "../models/cart.modle.js";
import Product from "../models/product.model.js";
import Promotion from "../models/promotion.model.js";
import { v4 as uuidv4 } from "uuid";

// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── NaN-safe number helper ───────────────────────────────────────────────────
// Every numeric operation goes through this — converts undefined/null/NaN → 0
const n = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

// ─── PROMOTION ENGINE ─────────────────────────────────────────────────────────
async function runPromotionEngine(items, userId, paymentMethod) {
    const now = new Date();

    // Fetch active, in-schedule promotions
    const promotions = await Promotion.find({
        isActive: true,
        $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
    }).lean();

    // ── Step 1: per-item subtotal (NaN-safe) ──────────────────────────────────
    const subtotal = items.reduce((s, i) => s + n(i.priceAtAdd) * n(i.quantity), 0);

    let cartDiscount = 0;
    let shippingFee = 80; // default BDT

    // ── Step 2: product-level promotions ─────────────────────────────────────
    const enrichedItems = items.map((item) => {
        let itemDiscount = 0;
        const itemPromos = [];

        promotions
            .filter((p) => p.type === "product")
            .forEach((promo) => {
                if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return;

                const productIdStr = item.product?.toString();
                const inProducts =
                    !promo.scope?.products?.length ||
                    promo.scope.products.some((id) => id?.toString() === productIdStr);
                const inCategories =
                    !promo.scope?.categories?.length; // extend if you have item.category
                const excluded = promo.scope?.excludeProducts?.some(
                    (id) => id?.toString() === productIdStr
                );

                if ((!inProducts && !inCategories) || excluded) return;

                const lineTotal = n(item.priceAtAdd) * n(item.quantity);
                let discount = 0;

                if (promo.discountType === "percent")
                    discount = (lineTotal * n(promo.value)) / 100;
                else if (promo.discountType === "fixed")
                    discount = Math.min(n(promo.value), lineTotal);
                else if (promo.discountType === "free")
                    discount = lineTotal;

                discount = n(discount); // NaN guard
                if (discount > 0) {
                    itemDiscount += discount;
                    itemPromos.push({ promotionId: promo._id, discountAmount: discount });
                }
            });

        const qty = n(item.quantity);
        const perUnitDiscount = qty > 0 ? itemDiscount / qty : 0;
        const finalPrice = Math.max(0, n(item.priceAtAdd) - perUnitDiscount);

        return {
            ...item,
            finalPrice: n(finalPrice),   // ← always a clean number
            appliedPromotions: itemPromos,
        };
    });

    // ── Step 3: recalc discounted subtotal ────────────────────────────────────
    const discountedSubtotal = enrichedItems.reduce(
        (s, i) => s + n(i.finalPrice) * n(i.quantity),
        0
    );
    const itemLevelDiscount = subtotal - discountedSubtotal;

    // ── Step 4: cart-level & free-shipping promotions ─────────────────────────
    const cartPromos = promotions
        .filter((p) => p.type === "cart" || p.type === "free_shipping")
        .sort((a, b) => n(b.priority) - n(a.priority));

    for (const promo of cartPromos) {
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit) continue;
        if (
            promo.conditions?.minCartValue &&
            discountedSubtotal < n(promo.conditions.minCartValue)
        ) continue;
        if (
            promo.conditions?.paymentMethod &&
            paymentMethod &&
            promo.conditions.paymentMethod !== paymentMethod
        ) continue;

        if (promo.type === "free_shipping") {
            shippingFee = 0;
            continue;
        }

        let discount = 0;
        if (promo.discountType === "percent")
            discount = (discountedSubtotal * n(promo.value)) / 100;
        else if (promo.discountType === "fixed")
            discount = Math.min(n(promo.value), discountedSubtotal);

        discount = n(discount); // NaN guard
        if (discount > 0) {
            cartDiscount += discount;
            if (!promo.stackable) break; // stop at highest-priority non-stackable
        }
    }

    // ── Step 5: BXGY promotions ───────────────────────────────────────────────
    let bxgyDiscount = 0;
    promotions.filter((p) => p.type === "bxgy").forEach((promo) => {
        const buy = n(promo.bxgy?.buy) || 1;
        const get = n(promo.bxgy?.get) || 1;
        const eligibleItems = enrichedItems.filter((item) =>
            promo.bxgy?.productIds?.some(
                (id) => id?.toString() === item.product?.toString()
            )
        );
        if (!eligibleItems.length) return;

        const totalQty = eligibleItems.reduce((s, i) => s + n(i.quantity), 0);
        const freeQty = Math.floor(totalQty / (buy + get)) * get;
        if (freeQty <= 0) return;

        const cheapest = [...eligibleItems].sort(
            (a, b) => n(a.priceAtAdd) - n(b.priceAtAdd)
        )[0];
        bxgyDiscount += n(cheapest.priceAtAdd) * freeQty;
    });

    // ── Step 6: final totals (all NaN-safe) ───────────────────────────────────
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
        total: n(finalTotal),   // ← guaranteed clean number, never NaN
    };
}

// ─── RECALCULATE & SAVE ───────────────────────────────────────────────────────
async function recalculate(cart, paymentMethod) {
    const { enrichedItems, subtotal, discount, shippingFee, total } =
        await runPromotionEngine(cart.items, cart.user, paymentMethod);

    cart.items = enrichedItems;
    cart.subtotal = n(subtotal);
    cart.discount = n(discount);
    cart.shippingFee = n(shippingFee);
    cart.total = n(total);
    cart.totalItems = cart.items.reduce((s, i) => s + n(i.quantity), 0);
    cart.lastActivityAt = new Date();

    await cart.save();
    return cart;
}

// ─── GET CART ─────────────────────────────────────────────────────────────────
export const getCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const filter = userId
            ? { user: userId, isCheckedOut: false }
            : { sessionId, isCheckedOut: false };

        if (!userId && !sessionId) {
            return res.status(200).json({ success: true, data: null });
        }

        const cart = await Cart.findOne(filter)
            .populate("items.product", "name images basePrice discountedPrice isActive slug")
            .lean();

        return res.status(200).json({ success: true, data: cart || null });
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

        const qty = Math.max(1, n(quantity)); // guard: never 0 or NaN

        // ── Fetch product ─────────────────────────────────────────────────────
        const product = await Product.findById(productId);
        if (!product || !product.isActive)
            return sendError(res, "Product not found or inactive", 404);

        // ── Resolve price + stock ──────────────────────────────────────────────
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

        // price must be a valid positive number
        if (!price || isNaN(price)) {
            return sendError(res, "Product price is not set correctly", 400);
        }

        if (stock !== null && stock < qty) {
            return sendError(res, `Only ${stock} in stock`, 400);
        }

        // ── Get or create cart ────────────────────────────────────────────────
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

        // ── Upsert item ───────────────────────────────────────────────────────
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
                finalPrice: price,  // promotion engine will update
                stockSnapshot: stock,
                isAvailable: true,
            });
        }

        await recalculate(cart, req.body.paymentMethod);

        return res.status(200).json({
            success: true,
            message: "Added to cart",
            data: cart,
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
        return res.status(200).json({ success: true, message: "Cart updated", data: cart });
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

        return res.status(200).json({ success: true, message: "Item removed", data: cart });
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
            return res.status(200).json({ success: true, message: "Cart merged", data: guestCart });
        }

        for (const guestItem of guestCart.items) {
            const existIdx = userCart.items.findIndex((i) => {
                const sameProduct = i.product?.toString() === guestItem.product?.toString();
                const sameVariant = guestItem.variant
                    ? i.variant?.toString() === guestItem.variant?.toString()
                    : !i.variant;
                return sameProduct && sameVariant;
            });

            if (existIdx > -1) {
                let newQty = n(userCart.items[existIdx].quantity) + n(guestItem.quantity);
                const maxStock = n(guestItem.stockSnapshot);
                if (maxStock > 0) newQty = Math.min(newQty, maxStock);
                userCart.items[existIdx].quantity = newQty;
            } else {
                userCart.items.push(guestItem);
            }
        }

        await recalculate(userCart, null);
        await Cart.findOneAndDelete({ sessionId, isCheckedOut: false });

        return res.status(200).json({ success: true, message: "Cart merged", data: userCart });
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

        discountAmount = n(discountAmount); // NaN guard

        cart.appliedCoupon = { code: code.trim().toUpperCase(), discountAmount };
        cart.discount = n(cart.discount) + discountAmount;
        cart.total = Math.max(0, n(cart.total) - discountAmount);
        cart.lastActivityAt = new Date();
        await cart.save();

        return res.status(200).json({ success: true, message: "Coupon applied", data: cart });
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

        return res.status(200).json({ success: true, message: "Coupon removed", data: cart });
    } catch (err) {
        return sendError(res, err.message);
    }
};