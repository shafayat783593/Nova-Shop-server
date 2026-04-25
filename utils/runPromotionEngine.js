// utils/recalculate.js
import Promotion from "../models/promotion.model.js";

const n = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

async function runPromotionEngine(items, paymentMethod) {
    const now = new Date();

    const rawPromotions = await Promotion.find({
        isActive: true,
        $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }],
        $and: [{ $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }],
    }).lean();

    const promotions = rawPromotions.filter((p) => p.isActive === true);

    const subtotal = items.reduce((s, i) => s + n(i.priceAtAdd) * n(i.quantity), 0);

    let cartDiscount = 0;
    let shippingFee = 80;

    // ── Product-level promotions ───────────────────────────────────────────────
    const enrichedItems = items.map((item) => {
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
            ...item,
            finalPrice: n(finalPrice),
            appliedPromotions: itemPromos,
        };
    });

    // ── Discounted subtotal ────────────────────────────────────────────────────
    const discountedSubtotal = enrichedItems.reduce(
        (s, i) => s + n(i.finalPrice) * n(i.quantity), 0
    );
    const itemLevelDiscount = n(subtotal) - n(discountedSubtotal);

    // ── Cart-level & free-shipping ─────────────────────────────────────────────
    const cartPromos = promotions
        .filter((p) => p.type === "cart" || p.type === "free_shipping")
        .sort((a, b) => n(b.priority) - n(a.priority));

    for (const promo of cartPromos) {
        if (promo.usageLimit && promo.usedCount >= promo.usageLimit) continue;
        if (promo.conditions?.minCartValue &&
            discountedSubtotal < n(promo.conditions.minCartValue)) continue;
        if (promo.conditions?.paymentMethod && paymentMethod &&
            promo.conditions.paymentMethod !== paymentMethod) continue;

        if (promo.type === "free_shipping") { shippingFee = 0; continue; }

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

    // ── BXGY ──────────────────────────────────────────────────────────────────
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

    // ── Totals ─────────────────────────────────────────────────────────────────
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

export async function recalculate(cart, paymentMethod) {
    const plainItems = cart.items.map((item) =>
        item.toObject ? item.toObject() : { ...item }
    );

    const { enrichedItems, subtotal, discount, shippingFee, total } =
        await runPromotionEngine(plainItems, paymentMethod);

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