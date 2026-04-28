import Order from "../models/order.model.js";
import Cart from "../models/cart.modle.js";
import Product from "../models/product.model.js";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import { sendInvoiceEmail } from "../services/invoice.service.js";
import { getIO } from "../socket.js";
import address from("../models/address.model.js");
const sendError = (res, message, status = 500) =>
    res.status(status).json({ success: false, message });

// ─── Utility: push a timeline entry ──────────────────────────────────────────
const pushTimeline = (order, status, message, userId = null) => {
    order.timeline.push({ status, message, changedBy: userId });
};

// ─── PLACE ORDER ─────────────────────────────────────────────────────────────
// POST /api/orders
// Called after payment is initiated (bKash / SSLCommerz) or for COD
export const placeOrder = async (req, res) => {
    try {
        const userId = req.user?._id;
        const sessionId = req.headers["x-session-id"];

        const { shippingAddressId, shippingAddress, paymentMethod, customerNote } = req.body;

        if (!paymentMethod) return sendError(res, "paymentMethod is required", 400);
        if (!shippingAddressId && !shippingAddress) {
            return sendError(res, "Shipping address is required", 400);
        }

        // ── Resolve shipping address ───────────────────────────────────────
        let resolvedAddress;

        if (shippingAddressId) {
            const { default: Address } = await address;
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
        if (!cart || cart.items.length === 0) {
            return sendError(res, "Cart is empty", 400);
        }

        // ── Validate stock & build order items ─────────────────────────────
        const orderItems = [];

        for (const item of cart.items) {
            const product = item.product;
            if (!product || !product.isActive) {
                return sendError(res, `Product "${item.nameSnapshot}" is no longer available`, 400);
            }

            // Check stock if product has variants
            if (product.hasVariants && item.variant) {
                const variant = product.variants.id(item.variant);
                if (!variant || variant.stock < item.quantity) {
                    return sendError(res, `Insufficient stock for "${item.nameSnapshot}"`, 400);
                }
                // Decrement variant stock
                variant.stock -= item.quantity;
            }

            await product.save();

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
            paymentMethod,
            paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
            subtotal: cart.subtotal,
            discount: cart.discount,
            shippingFee: cart.shippingFee,
            total: cart.total,
            appliedCoupon: cart.appliedCoupon || undefined,
            customerNote: customerNote || "",
        });

        pushTimeline(order, "pending", "Order placed by customer", userId);
        await order.save();

        // ── Mark cart as checked out ───────────────────────────────────────
        cart.isCheckedOut = true;
        await cart.save();

        // ── Notify admin via Socket.io ─────────────────────────────────────
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
                .select("orderId orderStatus paymentStatus total createdAt items shippingAddress paymentMethod")
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
            .populate("deliveryBoy", "name phone")
            .lean();

        if (!order) return sendError(res, "Order not found", 404);

        // Customers can only see their own orders
        if (req.user.role !== "admin" && order.user?.toString() !== req.user._id.toString()) {
            return sendError(res, "Forbidden", 403);
        }

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

        const order = await Order.findOne({
            orderId: req.params.orderId,
            user: req.user._id,
        });
        if (!order) return sendError(res, "Order not found", 404);

        const cancellableStatuses = ["pending", "confirmed"];
        if (!cancellableStatuses.includes(order.orderStatus)) {
            return sendError(res, `Cannot cancel an order with status "${order.orderStatus}"`, 400);
        }

        order.orderStatus = "cancelled";
        order.cancelledAt = new Date();
        order.cancellationReason = reason || "Cancelled by customer";

        pushTimeline(order, "cancelled", reason || "Cancelled by customer", req.user._id);
        await order.save();

        // Notify admin
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
// GET /api/admin/orders?page=1&limit=20&status=pending&search=ORD-
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
                .populate("deliveryBoy", "name phone")
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
// PATCH /api/admin/orders/:orderId/status
export const adminUpdateOrderStatus = async (req, res) => {
    try {
        const { status, adminNote } = req.body;

        const validStatuses = ["confirmed", "processing", "shipped", "delivered", "cancelled"];
        if (!validStatuses.includes(status)) {
            return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
        }

        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return sendError(res, "Order not found", 404);

        order.orderStatus = status;
        if (adminNote) order.adminNote = adminNote;

        const statusMessages = {
            confirmed: "Order confirmed by admin",
            processing: "Order is being packed",
            shipped: "Order shipped",
            delivered: "Order delivered successfully",
            cancelled: "Order cancelled by admin",
        };

        pushTimeline(order, status, statusMessages[status], req.user._id);

        if (status === "delivered") {
            order.paymentStatus = order.paymentMethod === "cod" ? "paid" : order.paymentStatus;
        }

        await order.save();

        // ── Real-time update to customer ──────────────────────────────────
        const io = getIO();
        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
            message: statusMessages[status],
            updatedAt: new Date(),
        });

        // Notify all admins too
        io.to("adminRoom").emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: order.orderStatus,
        });

        // Send invoice email if delivered and not already sent
        if (status === "delivered" && !order.invoiceSentAt) {
            await sendInvoiceEmail(order).catch(console.error);
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
// PATCH /api/admin/orders/:orderId/assign
export const adminAssignDeliveryBoy = async (req, res) => {
    try {
        const { deliveryBoyId } = req.body;

        const [order, deliveryBoy] = await Promise.all([
            Order.findOne({ orderId: req.params.orderId }),
            DeliveryBoy.findById(deliveryBoyId),
        ]);

        if (!order) return sendError(res, "Order not found", 404);
        if (!deliveryBoy) return sendError(res, "Delivery boy not found", 404);
        if (!deliveryBoy.isAvailable) {
            return sendError(res, "Delivery boy is not available", 400);
        }

        order.deliveryBoy = deliveryBoy._id;
        order.orderStatus = "shipped";

        pushTimeline(
            order,
            "shipped",
            `Assigned to ${deliveryBoy.name} (${deliveryBoy.phone})`,
            req.user._id
        );

        deliveryBoy.currentOrders.push(order._id);

        await Promise.all([order.save(), deliveryBoy.save()]);

        // ── Notify customer ────────────────────────────────────────────────
        const io = getIO();
        io.to(`user_${order.user}`).emit("order:statusUpdate", {
            orderId: order.orderId,
            orderStatus: "shipped",
            deliveryBoyName: deliveryBoy.name,
            deliveryBoyPhone: deliveryBoy.phone,
            message: `Your order is out for delivery with ${deliveryBoy.name}`,
        });

        // Notify delivery boy
        io.to(`delivery_${deliveryBoy._id}`).emit("delivery:assigned", {
            orderId: order.orderId,
            _id: order._id,
            address: order.shippingAddress,
        });

        return res.status(200).json({
            success: true,
            message: `Order assigned to ${deliveryBoy.name}`,
            data: {
                orderId: order.orderId,
                deliveryBoyName: deliveryBoy.name,
            },
        });
    } catch (err) {
        return sendError(res, err.message);
    }
};

// ─── ADMIN: GET ORDER STATS ───────────────────────────────────────────────────
// GET /api/admin/orders/stats
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