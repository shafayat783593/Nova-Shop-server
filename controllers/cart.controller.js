import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";
import Promotion from "../models/promotion.model.js";
import { v4 as uuidv4 } from "uuid";

// ─── Utility ──────────────────────────────────────────────────────────────────
const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── PROMOTION ENGINE ─────────────────────────────────────────────────────────
async function runPromotionEngine(items, userId, paymentMethod) {
    const now = new Date();

    const promotions = await Promotion.find({
        isActive: true,
        $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
    }).lean();

    let subtotal = items.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0);
    let totalDiscount = 0;
    let shippingFee = 80; // default shipping in BDT
    const appliedOnCart = [];

    // Per-item promotions (product type)
    const enrichedItems = items.map((item) => {
        let itemDiscount = 0;
        const itemPromos = [];

        promotions
            .filter((p) => p.type === "product")
            .forEach((promo) => {
                // Scope check
                const inProducts = !promo.scope?.products?.length ||
                    promo.scope.products.some((id) => id.toString() === item.product.toString());
                const inCategories = !promo.scope?.categories?.length; // simplified
                const excluded = promo.scope?.excludeProducts?.some(
                    (id) => id.toString() === item.product.toString()
                );
                if ((!inProducts && !inCategories) || excluded) return;

                // Usage check
                if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return;

                // Role check
                if (promo.conditions?.userRoles?.length && userId) {
                    // skipped without user role data — add your own role check
                }

                let discount = 0;
                const lineTotal = item.priceAtAdd * item.quantity;

                if (promo.discountType === "percent") discount = (lineTotal * promo.value) / 100;
                else if (promo.discountType === "fixed") discount = Math.min(promo.value, lineTotal);
                else if (promo.discountType === "free") discount = lineTotal;

                if (discount > 0) {
                    itemDiscount += discount;
                    itemPromos.push({ promotionId: promo._id, discountAmount: discount });
                }
            });

        return {
            ...item,
            finalPrice: Math.max(0, item.priceAtAdd - itemDiscount / Math.max(item.quantity, 1)),
            appliedPromotions: itemPromos,
        };
    });

    // Recalculate subtotal with item-level discounts
    const discountedSubtotal = enrichedItems.reduce(
        (s, i) => s + i.finalPrice * i.quantity, 0
    );
    totalDiscount += subtotal - discountedSubtotal;

    // Cart-level promotions
    promotions
        .filter((p) => p.type === "cart" || p.type === "free_shipping")
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .forEach((promo) => {
            // Min cart value
            if (promo.conditions?.minCartValue && discountedSubtotal < promo.conditions.minCartValue) return;

            // Payment method
            if (promo.conditions?.paymentMethod && paymentMethod &&
                promo.conditions.paymentMethod !== paymentMethod) return;

            // Usage limit
            if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return;

            if (promo.type === "free_shipping") {
                shippingFee = 0;
                appliedOnCart.push({ promotionId: promo._id, discountAmount: shippingFee });
                return;
            }

            let discount = 0;
            if (promo.discountType === "percent") discount = (discountedSubtotal * promo.value) / 100;
            else if (promo.discountType === "fixed") discount = Math.min(promo.value, discountedSubtotal);

            if (discount > 0) {
                totalDiscount += discount;
                appliedOnCart.push({ promotionId: promo._id, discountAmount: discount });

                // Non-stackable: stop after first
                if (!promo.stackable) return;
            }
        });

    // BXGY promotions
    promotions
        .filter((p) => p.type === "bxgy")
        .forEach((promo) => {
            const buy = promo.bxgy?.buy || 1;
            const get = promo.bxgy?.get || 1;
            const eligibleItems = enrichedItems.filter((item) =>
                promo.bxgy?.productIds?.some((id) => id.toString() === item.product.toString())
            );
            if (!eligibleItems.length) return;

            const totalQty = eligibleItems.reduce((s, i) => s + i.quantity, 0);
            const freeQty = Math.floor(totalQty / (buy + get)) * get;
            if (freeQty <= 0) return;

            // Give cheapest items free
            const cheapest = [...eligibleItems].sort((a, b) => a.priceAtAdd - b.priceAtAdd)[0];
            const bxgyDiscount = cheapest.priceAtAdd * freeQty;
            totalDiscount += bxgyDiscount;
            appliedOnCart.push({ promotionId: promo._id, discountAmount: bxgyDiscount });
        });

    const finalTotal = Math.max(0, discountedSubtotal - Math.max(0, totalDiscount - (subtotal - discountedSubtotal)) + shippingFee);

    return {
        enrichedItems,
        subtotal,
        discount: totalDiscount,
        shippingFee,
        total: finalTotal,
        appliedOnCart,
    };
}

// ─── RECALCULATE & SAVE ───────────────────────────────────────────────────────
async function recalculate(cart, paymentMethod) {
    const { enrichedItems, subtotal, discount, shippingFee, total } =
        await runPromotionEngine(cart.items, cart.user, paymentMethod);

    cart.items = enrichedItems;
    cart.subtotal = subtotal;
    cart.discount = discount;
    cart.shippingFee = shippingFee;
    cart.total = total;
    cart.totalItems = cart.items.reduce((s, i) => s + i.quantity, 0);
    cart.lastActivityAt = new Date();
    await cart.save();
    return cart;
}

// ─── GET OR CREATE CART ───────────────────────────────────────────────────────
async function getOrCreateCart(userId, sessionId) {
    if (userId) {
        let cart = await Cart.findOne({ user: userId, isCheckedOut: false });
        if (!cart) cart = new Cart({ user: userId });
        return cart;
    }
    if (sessionId) {
        let cart = await Cart.findOne({ sessionId, isCheckedOut: false });
        if (!cart) cart = new Cart({ sessionId });
        return cart;
    }
    // New guest
    const newSessionId = uuidv4();
    return { cart: new Cart({ sessionId: newSessionId }), newSessionId };
}

// ─── GET CART ─────────────────────────────────────────────────────────────────
// GET /api/cart
export const getCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const filter = userId
            ? { user: userId, isCheckedOut: false }
            : { sessionId, isCheckedOut: false };

        const cart = await Cart.findOne(filter)
            .populate("items.product", "name images basePrice discountedPrice isActive slug")
            .lean();

        if (!cart) return res.status(200).json({ success: true, data: null });

        return res.status(200).json({ success: true, data: cart });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADD TO CART ──────────────────────────────────────────────────────────────
// POST /api/cart/add
export const addToCart = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { productId, variantId, quantity = 1 } = req.body;

        if (!productId) return sendError(res, "productId is required", 400);

        // Fetch product
        const product = await Product.findById(productId);
        if (!product || !product.isActive) return sendError(res, "Product not found or inactive", 404);

        // Get price (variant or base)
        let price = product.discountedPrice ?? product.basePrice;
        let stock = null;
        let variantObjId = null;

        if (product.hasVariants && variantId) {
            const variant = product.variants.id(variantId);
            if (!variant) return sendError(res, "Variant not found", 404);
            price = variant.price;
            stock = variant.stock;
            variantObjId = variant._id;
        }

        if (stock !== null && stock < quantity) {
            return sendError(res, `Only ${stock} in stock`, 400);
        }

        // Get cart
        let cart = userId
            ? await Cart.findOne({ user: userId, isCheckedOut: false })
            : sessionId
                ? await Cart.findOne({ sessionId, isCheckedOut: false })
                : null;

        let newSessionId = sessionId;
        if (!cart) {
            newSessionId = userId ? null : (sessionId || uuidv4());
            cart = new Cart(userId ? { user: userId } : { sessionId: newSessionId });
        }

        // Check if same item already in cart
        const existingIdx = cart.items.findIndex((i) => {
            const sameProduct = i.product.toString() === productId;
            const sameVariant = variantObjId
                ? i.variant?.toString() === variantObjId.toString()
                : !i.variant;
            return sameProduct && sameVariant;
        });

        if (existingIdx > -1) {
            cart.items[existingIdx].quantity += quantity;
            if (stock !== null) {
                cart.items[existingIdx].quantity = Math.min(cart.items[existingIdx].quantity, stock);
            }
        } else {
            cart.items.push({
                product: product._id,
                variant: variantObjId,
                nameSnapshot: product.name,
                imageSnapshot: product.images?.[0] || "",
                quantity,
                priceAtAdd: price,
                finalPrice: price,
                stockSnapshot: stock,
                isAvailable: true,
            });
        }

        await recalculate(cart, req.body.paymentMethod);

        const headers = {};
        if (newSessionId && !sessionId) headers["x-session-id"] = newSessionId;

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
// PATCH /api/cart/item/:itemId
export const updateCartItem = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];
        const { quantity } = req.body;
        const { itemId } = req.params;

        if (!quantity || quantity < 1) return sendError(res, "Quantity must be >= 1", 400);

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        const item = cart.items.id(itemId);
        if (!item) return sendError(res, "Item not found in cart", 404);

        // Stock check
        if (item.stockSnapshot !== null && quantity > item.stockSnapshot) {
            return sendError(res, `Only ${item.stockSnapshot} in stock`, 400);
        }

        item.quantity = quantity;
        await recalculate(cart, req.body.paymentMethod);

        return res.status(200).json({ success: true, message: "Cart updated", data: cart });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── REMOVE ITEM ──────────────────────────────────────────────────────────────
// DELETE /api/cart/item/:itemId
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
// DELETE /api/cart
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

// ─── MERGE GUEST CART → USER CART (call after login) ─────────────────────────
// POST /api/cart/merge
export const mergeCart = async (req, res) => {
    try {
        const userId = req.user._id; // must be authenticated
        const { sessionId } = req.body;

        if (!sessionId) return sendError(res, "sessionId required", 400);

        const guestCart = await Cart.findOne({ sessionId, isCheckedOut: false });
        if (!guestCart || guestCart.items.length === 0) {
            return res.status(200).json({ success: true, message: "No guest cart to merge" });
        }

        let userCart = await Cart.findOne({ user: userId, isCheckedOut: false });
        if (!userCart) {
            // Simply re-own the guest cart
            guestCart.user = userId;
            guestCart.sessionId = undefined;
            await recalculate(guestCart, null);
            return res.status(200).json({ success: true, message: "Cart merged", data: guestCart });
        }

        // Merge items
        for (const guestItem of guestCart.items) {
            const existIdx = userCart.items.findIndex((i) => {
                const sameProduct = i.product.toString() === guestItem.product.toString();
                const sameVariant = guestItem.variant
                    ? i.variant?.toString() === guestItem.variant.toString()
                    : !i.variant;
                return sameProduct && sameVariant;
            });

            if (existIdx > -1) {
                userCart.items[existIdx].quantity += guestItem.quantity;
                if (guestItem.stockSnapshot !== null) {
                    userCart.items[existIdx].quantity = Math.min(
                        userCart.items[existIdx].quantity, guestItem.stockSnapshot
                    );
                }
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
// POST /api/cart/coupon
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

        // Find promotion by name (used as coupon code)
        const promo = await Promotion.findOne({
            name: code.trim().toUpperCase(),
            isActive: true,
        });

        if (!promo) return sendError(res, "Invalid coupon code", 404);
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit)
            return sendError(res, "Coupon usage limit reached", 400);

        let discountAmount = 0;
        if (promo.discountType === "percent") discountAmount = (cart.subtotal * promo.value) / 100;
        else if (promo.discountType === "fixed") discountAmount = Math.min(promo.value, cart.subtotal);

        cart.appliedCoupon = { code: code.trim().toUpperCase(), discountAmount };
        cart.discount += discountAmount;
        cart.total = Math.max(0, cart.total - discountAmount);
        cart.lastActivityAt = new Date();
        await cart.save();

        return res.status(200).json({ success: true, message: "Coupon applied", data: cart });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── REMOVE COUPON ────────────────────────────────────────────────────────────
// DELETE /api/cart/coupon
export const removeCoupon = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const cart = await Cart.findOne(
            userId ? { user: userId, isCheckedOut: false } : { sessionId, isCheckedOut: false }
        );
        if (!cart) return sendError(res, "Cart not found", 404);

        if (cart.appliedCoupon?.discountAmount) {
            cart.discount -= cart.appliedCoupon.discountAmount;
            cart.total += cart.appliedCoupon.discountAmount;
        }
        cart.appliedCoupon = undefined;
        cart.lastActivityAt = new Date();
        await cart.save();

        return res.status(200).json({ success: true, message: "Coupon removed", data: cart });
    } catch (err) {
        return sendError(res, err.message);
    }
};