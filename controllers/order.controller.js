import Order from "../models/order.model.js";
import Cart from "../models/cart.modle.js";
import Product from "../models/product.model.js";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import Address from "../models/address.model.js";
import { sendInvoiceEmail } from "../services/Invoice.service.js";
import { getIO } from "../socket/socket.js";
import SSLCommerzPayment from "sslcommerz-lts";
import axios from "axios";
import { recalculate, runPromotionEngine } from "../utils/runPromotionEngine.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

const pushTimeline = (order, status, message, userId = null) => {
    order.timeline.push({ status, message, changedBy: userId });
};

const getBKASH = () => ({
    username: process.env.bkash_username,
    password: process.env.bkash_password,
    apiKey: process.env.bkash_api_key,
    secretKey: process.env.bkash_secret_key,
    grantTokenUrl: process.env.bkash_grant_token_url,
    createPaymentUrl: process.env.bkash_create_payment_url,
    executePaymentUrl: process.env.bkash_execute_payment_url,
});

const getBkashToken = async () => {
    const BKASH = getBKASH();
    const { data } = await axios.post(
        BKASH.grantTokenUrl,
        { app_key: BKASH.apiKey, app_secret: BKASH.secretKey },
        {
            headers: {
                "Content-Type": "application/json",
                username: BKASH.username,
                password: BKASH.password,
            },
        }
    );
    if (!data?.id_token) throw new Error("Failed to get bKash token");
    return data.id_token;
};

// ─── PLACE ORDER ──────────────────────────────────────────────────────────────
// POST /api/orders
export const placeOrder = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const {
            shippingAddressId,
            shippingAddress,
            paymentMethod,
            customerNote,
            customerLocation, // { lat, lng } — optional, sent from frontend
        } = req.body;

        if (!paymentMethod)
            return sendError(res, "paymentMethod is required", 400);
        if (!shippingAddressId && !shippingAddress)
            return sendError(res, "Shipping address is required", 400);

        // ── Resolve shipping address ───────────────────────────────────────
        let resolvedAddress;
        if (shippingAddressId) {
            const saved = await Address.findOne({ _id: shippingAddressId, user: userId }).lean();
            if (!saved) return sendError(res, "Address not found", 404);
            resolvedAddress = saved;
        } else {
            resolvedAddress = shippingAddress;
        }

        // ── Load cart ──────────────────────────────────────────────────────
        const cartFilter = userId
            ? { user: userId, isCheckedOut: false }
            : { sessionId, isCheckedOut: false };

        const cart = await Cart.findOne(cartFilter).populate("items.product");
        if (!cart || cart.items.length === 0)
            return sendError(res, "Cart is empty", 400);

        // ── Validate stock & build order items ─────────────────────────────
        const orderItems = [];

        for (const item of cart.items) {
            const product = item.product;

            if (!product || !product.isActive)
                return sendError(res, `Product "${item.nameSnapshot}" is no longer available`, 400);

            if (product.hasVariants && item.variant) {
                const variant = product.variants.id(item.variant);
                if (!variant || variant.stock < item.quantity)
                    return sendError(res, `Insufficient stock for "${item.nameSnapshot}"`, 400);
                variant.stock -= item.quantity;
                await product.save();
            }

            orderItems.push({
                product: product._id,
                variant: item.variant || null,
                nameSnapshot: item.nameSnapshot,
                imageSnapshot: item.imageSnapshot,
                priceAtOrder: item.priceAtAdd,
                finalPrice: item.finalPrice,
                quantity: item.quantity,
                appliedPromotions: item.appliedPromotions || [],
            });
        }

        // ── Create order ───────────────────────────────────────────────────
        const order = new Order({
            user: userId || null,
            items: orderItems,
            shippingAddress: {
                fullName: resolvedAddress.fullName,
                phone: resolvedAddress.phone,
                addressLine: resolvedAddress.addressLine,
                area: resolvedAddress.area,
                district: resolvedAddress.district,
                division: resolvedAddress.division,
                postalCode: resolvedAddress.postalCode || "",
            },
            customerLocation: customerLocation || { lat: null, lng: null },
            paymentMethod,
            paymentStatus: "pending",
            subtotal: cart.subtotal,
            discount: cart.discount,
            shippingFee: cart.shippingFee,
            total: cart.total,
            appliedCoupon: cart.appliedCoupon || undefined,
            customerNote: customerNote || "",
        });

        pushTimeline(order, "pending", "Order placed by customer", userId);
        await order.save();

        cart.isCheckedOut = true;
        await cart.save();

        // ── Notify admin ───────────────────────────────────────────────────
        const io = getIO();
        io.to("adminRoom").emit("order:new", {
            orderId: order.orderId,
            _id: order._id,
            total: order.total,
            createdAt: order.createdAt,
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: {
                orderId: order.orderId,
                _id: order._id,
                paymentMethod: order.paymentMethod,
                total: order.total,
            },
        });
    } catch (err) {
        console.error("PlaceOrder Error:", err);
        return sendError(res, err.message);
    }
};

// ─── BUY NOW ──────────────────────────────────────────────────────────────────
// POST /api/orders/buy-now
export const buyNow = async (req, res) => {
    try {
        const userId = req.user?._id;
        const {
            productId, variantId, quantity = 1,
            shippingAddressId, shippingAddress,
            paymentMethod, customerNote,
            customerLocation,
        } = req.body;

        if (!productId) return sendError(res, "productId is required", 400);
        if (!paymentMethod) return sendError(res, "paymentMethod is required", 400);
        if (!shippingAddressId && !shippingAddress)
            return sendError(res, "Shipping address is required", 400);

        // ── Resolve address ────────────────────────────────────────────────
        let resolvedAddress;
        if (shippingAddressId) {
            const saved = await Address.findOne({ _id: shippingAddressId, user: userId }).lean();
            if (!saved) return sendError(res, "Address not found", 404);
            resolvedAddress = saved;
        } else {
            resolvedAddress = shippingAddress;
        }

        // ── Load product ───────────────────────────────────────────────────
        const product = await Product.findById(productId);
        if (!product || !product.isActive)
            return sendError(res, "Product is not available", 400);

        // ── Validate stock & price ─────────────────────────────────────────
 // ── নতুন code (এটা দিয়ে replace করো) ─────────────────────
// ── Validate stock ─────────────────────────────────────────────────────
let basePrice = product.discountedPrice ?? product.basePrice;

if (product.hasVariants && variantId) {
    const variant = product.variants.id(variantId);
    if (!variant) return sendError(res, "Variant not found", 404);
    if (variant.stock < quantity)
        return sendError(res, `Only ${variant.stock} items left in stock`, 400);
    basePrice = variant.price ?? basePrice;
    variant.stock -= quantity;
    await product.save();
}

// ── Promotion engine চালাও ─────────────────────────────────────────────
const fakeItems = [{
    product: product._id,
    priceAtAdd: basePrice,
    quantity,
    category: product.category || "",
    variant: variantId || null,
    nameSnapshot: product.name,
    imageSnapshot: product.images?.[0] || "",
}];

let finalPrice = basePrice;
let appliedPromotions = [];
let subtotal, discount, shippingFee, total;

try {
    const result = await runPromotionEngine(fakeItems, paymentMethod);
    finalPrice = result.enrichedItems[0]?.finalPrice ?? basePrice;
    appliedPromotions = result.enrichedItems[0]?.appliedPromotions || [];
    subtotal = result.subtotal;        // basePrice * qty
    discount = result.discount;        // total discount amount
    shippingFee = result.shippingFee;  // 0 or 80 (promotion engine decide করবে)
    total = result.total;
} catch (e) {
    console.warn("Promotion engine failed for buyNow:", e.message);
    subtotal = basePrice * quantity;
    discount = 0;
    shippingFee = subtotal >= 500 ? 0 : 80;
    total = subtotal + shippingFee;
    finalPrice = basePrice;
}

      const order = new Order({
    user: userId || null,
    items: [{
        product: product._id,
        variant: variantId || null,
        nameSnapshot: product.name,
        imageSnapshot: product.images?.[0] || "",
        priceAtOrder: basePrice,      // ✅ basePrice (original)
        finalPrice,                    // ✅ promotion-adjusted price
        quantity,
        appliedPromotions,             // ✅ applied promotions
    }],
    shippingAddress: {
    fullName: resolvedAddress.fullName,
    phone: resolvedAddress.phone,
    addressLine: resolvedAddress.addressLine,
    area: resolvedAddress.area,
    district: resolvedAddress.district,
    division: resolvedAddress.division,
    postalCode: resolvedAddress.postalCode || "",
},    // same as before
    customerLocation: customerLocation || { lat: null, lng: null },
    paymentMethod,
    paymentStatus: "pending",
    subtotal,     // ✅ from promotion engine
    discount,     // ✅ from promotion engine (আর 0 না)
    shippingFee,  // ✅ from promotion engine
    total,        // ✅ from promotion engine
    customerNote: customerNote || "",
});

        pushTimeline(order, "pending", "Order placed via Buy Now", userId);
        await order.save();

        const io = getIO();
        io.to("adminRoom").emit("order:new", {
            orderId: order.orderId,
            _id: order._id,
            total: order.total,
            createdAt: order.createdAt,
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: {
                orderId: order.orderId,
                _id: order._id,
                paymentMethod: order.paymentMethod,
                total: order.total,
            },
        });
    } catch (err) {
        console.error("BuyNow Error:", err);
        return sendError(res, err.message);
    }
};

// ─── GET MY ORDERS (customer) ─────────────────────────────────────────────────
// GET /api/orders/my?page=1&limit=10&status=pending
export const getMyOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const filter = { user: req.user._id };
        if (status) filter.orderStatus = status;

        const skip = (Number(page) - 1) * Number(limit);

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort("-createdAt")
                .skip(skip)
                .limit(Number(limit))
                .select("orderId orderStatus paymentStatus total createdAt items shippingAddress paymentMethod deliveryAssignStatus deliveryBoySnapshot estimatedMinutes")
                .lean(),
            Order.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── GET SINGLE ORDER ─────────────────────────────────────────────────────────
// GET /api/orders/:orderId
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId })
            .populate("deliveryBoy", "lastLocation isOnline")
            .lean();

        if (!order) return sendError(res, "Order not found", 404);

        if (req.user.role !== "admin" && order.user?.toString() !== req.user._id.toString())
            return sendError(res, "Forbidden", 403);

        return res.status(200).json({ success: true, data: order });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── CANCEL ORDER (customer) ──────────────────────────────────────────────────
// PATCH /api/orders/:orderId/cancel
export const cancelOrder = async (req, res) => {
    try {
        const { reason } = req.body;

        const order = await Order.findOne({ orderId: req.params.orderId, user: req.user._id });
        if (!order) return sendError(res, "Order not found", 404);

        const cancellableStatuses = ["pending", "confirmed"];
        if (!cancellableStatuses.includes(order.orderStatus))
            return sendError(res, `Cannot cancel an order with status "${order.orderStatus}"`, 400);

        order.orderStatus = "cancelled";
        order.cancelledAt = new Date();
        order.cancellationReason = reason || "Cancelled by customer";

        pushTimeline(order, "cancelled", reason || "Cancelled by customer", req.user._id);
        await order.save();

        const io = getIO();
        io.to("adminRoom").emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
        });

        return res.status(200).json({ success: true, message: "Order cancelled" });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: GET ALL ORDERS ────────────────────────────────────────────────────
// GET /api/orders/admin/all?page=1&limit=20&status=pending&search=ORD-
export const adminGetAllOrders = async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            status, paymentStatus,
            search, sort = "-createdAt",
        } = req.query;

        const filter = {};
        if (status) filter.orderStatus = status;
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (search) {
            filter.$or = [
                { orderId: { $regex: search, $options: "i" } },
                { "shippingAddress.phone": { $regex: search, $options: "i" } },
                { "shippingAddress.fullName": { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .populate("user", "name email")
                .populate("deliveryBoy", "lastLocation isOnline")
                .lean(),
            Order.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: UPDATE ORDER STATUS ───────────────────────────────────────────────
// PATCH /api/orders/admin/:orderId/status
// Now includes "prepared" status — emits real-time to customer
export const adminUpdateOrderStatus = async (req, res) => {
    try {
        const { status, adminNote } = req.body;

        const validStatuses = ["confirmed", "processing", "prepared", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(status))
            return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);

        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return sendError(res, "Order not found", 404);

        order.orderStatus = status;
        if (adminNote) order.adminNote = adminNote;

        const statusMessages = {
            confirmed: "Order confirmed by admin",
            processing: "Order is being packed",
            prepared: "Order is ready for pickup",
            shipped: "Order shipped",
            delivered: "Order delivered successfully",
            cancelled: "Order cancelled by admin",
        };

        pushTimeline(order, status, statusMessages[status], req.user._id);

        if (status === "delivered" && order.paymentMethod === "cod")
            order.paymentStatus = "paid";

        await order.save();

        // ── Real-time update ───────────────────────────────────────────────
        const io = getIO();

        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            message: statusMessages[status],
            updatedAt: new Date(),
        });

        io.to("adminRoom").emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
        });

        // Send invoice email on delivery (only once)
        if (status === "delivered" && !order.invoiceSentAt) {
            const populatedOrder = await Order.findById(order._id)
                .populate("user", "email name")
                .lean();
            await sendInvoiceEmail(populatedOrder, populatedOrder.user?.email || "");
            order.invoiceSentAt = new Date();
            await order.save();
        }

        return res.status(200).json({
            success: true,
            message: `Order status updated to "${status}"`,
            data: { orderId: order.orderId, orderStatus: order.orderStatus },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: ASSIGN DELIVERY BOY ───────────────────────────────────────────────
// PATCH /api/orders/admin/:orderId/assign
// Status becomes "assigned" — NOT "shipped" yet. Delivery boy must accept first.
export const adminAssignDeliveryBoy = async (req, res) => {
    try {
        const { deliveryBoyId } = req.body;

        const [order, deliveryBoy] = await Promise.all([
            Order.findOne({ orderId: req.params.orderId }),
            DeliveryBoy.findById(deliveryBoyId).populate("user", "name avatar"),
        ]);

        if (!order) return sendError(res, "Order not found", 404);
        if (!deliveryBoy) return sendError(res, "Delivery boy not found", 404);
        if (!deliveryBoy.isAvailable)
            return sendError(res, "Delivery boy is not available", 400);

        // ── Update order ───────────────────────────────────────────────────
        order.deliveryBoy = deliveryBoy._id;
        order.deliveryAssignStatus = "assigned";

        // Save snapshot so customer always sees the right info
        order.deliveryBoySnapshot = {
            name: deliveryBoy.user?.name || "",
            phone: deliveryBoy.phone || "",
            avatar: deliveryBoy.user?.avatar || null,
        };

        pushTimeline(
            order,
            "assigned",
            `Assigned to ${deliveryBoy.user?.name} (${deliveryBoy.phone})`,
            req.user._id
        );

        deliveryBoy.currentOrders.push(order._id);
        deliveryBoy.activeOrderId = order._id;

        await Promise.all([order.save(), deliveryBoy.save()]);

        // ── Notify delivery boy ────────────────────────────────────────────
        const io = getIO();

        io.to(`delivery_${deliveryBoy._id}`).emit("delivery:assigned", {
            orderId: order.orderId,
            _id: order._id,
            address: order.shippingAddress,
            customerLocation: order.customerLocation,
        });

        // ── Notify admin ───────────────────────────────────────────────────
        io.to("adminRoom").emit("order:statusUpdate", {
            orderId: order.orderId,
            deliveryAssignStatus: "assigned",
        });

        return res.status(200).json({
            success: true,
            message: `Order assigned to ${deliveryBoy.user?.name}. Waiting for acceptance.`,
            data: {
                orderId: order.orderId,
                deliveryAssignStatus: order.deliveryAssignStatus,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: GET ORDER STATS ───────────────────────────────────────────────────
// GET /api/orders/admin/stats
export const adminGetOrderStats = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));

        const [byStatus, todayOrders, totalRevenue] = await Promise.all([
            Order.aggregate([
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
            ]),
            Order.countDocuments({ createdAt: { $gte: todayStart } }),
            Order.aggregate([
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),
        ]);

        const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

        return res.status(200).json({
            success: true,
            data: {
                byStatus: statusMap,
                todayOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── RETRY PAYMENT ────────────────────────────────────────────────────────────
export const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return sendError(res, "orderId is required", 400);

        const order = await Order.findOne({ orderId, user: req.user._id });
        if (!order) return sendError(res, "Order not found", 404);

        if (order.paymentStatus === "paid")
            return sendError(res, "Order is already paid", 400);
        if (order.paymentMethod === "cod")
            return sendError(res, "COD order does not require online payment", 400);

        // ── bKash ──────────────────────────────────────────────────────────
        if (order.paymentMethod === "bkash") {
            const BKASH = getBKASH();
            const token = await getBkashToken();
            const callbackURL = `${process.env.BACKEND_URL}/api/payments/bkash/callback`;

            const { data } = await axios.post(
                BKASH.createPaymentUrl,
                {
                    mode: "0011",
                    payerReference: order.orderId,
                    callbackURL,
                    amount: String(order.total),
                    currency: "BDT",
                    intent: "sale",
                    merchantInvoiceNumber: order.orderId,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token,
                        "X-APP-Key": BKASH.apiKey,
                    },
                }
            );

            if (data?.statusCode !== "0000")
                return sendError(res, data?.statusMessage || "bKash payment creation failed", 400);

            order.paymentStatus = "pending";
            await order.save();

            return res.json({ success: true, data: { method: "bkash", bkashURL: data.bkashURL } });
        }

        // ── SSLCommerz ─────────────────────────────────────────────────────
        if (order.paymentMethod === "sslcommerz") {
            const sslcz = new SSLCommerzPayment("testbox", "qwerty", true);
            const retryTranId = `${order.orderId}-${Date.now()}`;

            const sslData = {
                total_amount: parseFloat(order.total),
                currency: "BDT",
                tran_id: retryTranId,
                success_url: `${process.env.BACKEND_URL}/api/payments/sslcommerz/success`,
                fail_url: `${process.env.BACKEND_URL}/api/payments/sslcommerz/fail`,
                cancel_url: `${process.env.BACKEND_URL}/api/payments/sslcommerz/cancel`,
                ipn_url: `${process.env.BACKEND_URL}/api/payments/sslcommerz/ipn`,
                cus_name: order.shippingAddress.fullName || "Customer",
                cus_email: "customer@example.com",
                cus_add1: order.shippingAddress.addressLine || "Address",
                cus_city: order.shippingAddress.district || "Dhaka",
                cus_state: order.shippingAddress.division || "Dhaka",
                cus_postcode: order.shippingAddress.postalCode || "1000",
                cus_country: "Bangladesh",
                cus_phone: order.shippingAddress.phone || "01700000000",
                ship_name: order.shippingAddress.fullName || "Customer",
                ship_add1: order.shippingAddress.addressLine || "Address",
                ship_city: order.shippingAddress.district || "Dhaka",
                ship_state: order.shippingAddress.division || "Dhaka",
                ship_postcode: order.shippingAddress.postalCode || "1000",
                ship_country: "Bangladesh",
                product_name: "Order Items",
                product_category: "ecommerce",
                product_profile: "general",
                num_of_item: order.items.length,
                product_amount: order.subtotal,
                discount_amount: order.discount || 0,
                shipping_method: "Courier",
            };

            const apiResponse = await sslcz.init(sslData);
            if (!apiResponse?.GatewayPageURL)
                return sendError(res, "SSL gateway URL not received", 400);

            order.paymentStatus = "pending";
            order.retryTranId = retryTranId;
            await order.save();

            return res.json({ success: true, data: { method: "sslcommerz", gatewayURL: apiResponse.GatewayPageURL } });
        }

        return sendError(res, "Unknown payment method", 400);
    } catch (err) {
        console.error("Retry Payment Error:", err.message);
        return sendError(res, "Payment retry failed");
    }
};



// order.controller.js
export const buyNowPreview = async (req, res) => {
    try {
        const { productId, variantId, quantity = 1, paymentMethod } = req.body;
        const product = await Product.findById(productId);
        if (!product || !product.isActive) return sendError(res, "Product not available", 400);

        let basePrice = product.discountedPrice ?? product.basePrice;
        if (product.hasVariants && variantId) {
            const variant = product.variants.id(variantId);
            if (variant) basePrice = variant.price ?? basePrice;
        }

        const fakeItems = [{
            product: product._id,
            priceAtAdd: basePrice,
            quantity,
            category: product.category || "",
        }];

        const result = await runPromotionEngine(fakeItems, paymentMethod || "cod");
        return res.json({
            success: true,
            data: {
                finalPrice: result.enrichedItems[0]?.finalPrice ?? basePrice,
                subtotal: result.subtotal,
                discount: result.discount,
                shippingFee: result.shippingFee,
                total: result.total,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};