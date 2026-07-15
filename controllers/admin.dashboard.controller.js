import mongoose from "mongoose";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import Promotion from "../models/promotion.model.js";

// ─── GET /api/admin/dashboard ──────────────────────────────────────────────────
// Full overview: counts, revenue, order-status breakdown, recent orders,
// top-selling products, delivery-boy snapshot, promotion snapshot.
export const getDashboardOverview = async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            usersByRole,
            totalProducts,
            activeProducts,
            deliveryBoyStats,
            activePromotions,
            totalOrders,
            ordersByStatus,
            revenueAgg,
            monthRevenueAgg,
            recentOrders,
            topProducts,
            dailyRevenue,
        ] = await Promise.all([
            User.countDocuments(),

            User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),

            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),

            DeliveryBoy.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        online: { $sum: { $cond: ["$isOnline", 1, 0] } },
                        available: { $sum: { $cond: ["$isAvailable", 1, 0] } },
                    },
                },
            ]),

            Promotion.countDocuments({
                isActive: true,
                $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
            }),

            Order.countDocuments(),

            Order.aggregate([{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),

            Order.aggregate([
                { $match: { paymentStatus: "paid" } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),

            Order.aggregate([
                { $match: { paymentStatus: "paid", createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: "$total" } } },
            ]),

            Order.find()
                .sort({ createdAt: -1 })
                .limit(8)
                .populate("user", "name email avatar")
                .select("orderId user guestInfo total orderStatus paymentStatus paymentMethod createdAt")
                .lean(),

            Order.aggregate([
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.product",
                        name: { $first: "$items.nameSnapshot" },
                        image: { $first: "$items.imageSnapshot" },
                        totalSold: { $sum: "$items.quantity" },
                        revenue: { $sum: { $multiply: ["$items.finalPrice", "$items.quantity"] } },
                    },
                },
                { $sort: { totalSold: -1 } },
                { $limit: 5 },
            ]),

            Order.aggregate([
                { $match: { paymentStatus: "paid", createdAt: { $gte: last7Days } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        total: { $sum: "$total" },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        // ── Normalize role counts ──────────────────────────────────────────
        const roleMap = { customer: 0, vendor: 0, deliveryboy: 0, admin: 0, owner: 0 };
        usersByRole.forEach(({ _id, count }) => { roleMap[_id] = count; });

        // ── Normalize order status counts ──────────────────────────────────
        const statusMap = {
            pending: 0, confirmed: 0, processing: 0,
            prepared: 0, shipped: 0, delivered: 0, cancelled: 0,
        };
        ordersByStatus.forEach(({ _id, count }) => { statusMap[_id] = count; });

        return res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    totalCustomers: roleMap.customer,
                    totalVendors: roleMap.vendor,
                    totalProducts,
                    activeProducts,
                    totalOrders,
                    totalRevenue: revenueAgg[0]?.total || 0,
                    monthRevenue: monthRevenueAgg[0]?.total || 0,
                    deliveryBoys: {
                        total: deliveryBoyStats[0]?.total || 0,
                        online: deliveryBoyStats[0]?.online || 0,
                        available: deliveryBoyStats[0]?.available || 0,
                    },
                    activePromotions,
                },
                usersByRole: roleMap,
                ordersByStatus: statusMap,
                recentOrders,
                topProducts,
                dailyRevenue,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};