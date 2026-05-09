import { Server } from "socket.io";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import LocationHistory from "../models/locationHistory.model.js";
import Order from "../models/order.model.js";

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: [
                process.env.FRONTEND_URL || "http://localhost:3000",
                "http://localhost:3000",
                "http://localhost:3001",
            ],
            credentials: true,
            methods: ["GET", "POST"],
        },
        transports: ["websocket", "polling"],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.on("connection", (socket) => {
        console.log(`✅ Socket connected: ${socket.id}`);

        // ── Customer ───────────────────────────────────────────────────────
        socket.on("join:user", (userId) => {
            if (!userId) return;
            socket.join(`user_${userId}`);
            socket.data.userId = String(userId);
            socket.emit("joined:user", { room: `user_${userId}` });
            console.log(`👤 User ${userId} joined`);
        });

        // ── Admin ──────────────────────────────────────────────────────────
        socket.on("join:admin", () => {
            socket.join("adminRoom");
            socket.emit("joined:admin", { room: "adminRoom" });
            console.log(`🛡️  Admin joined adminRoom`);
        });

        // ── Delivery boy ───────────────────────────────────────────────────
        socket.on("join:delivery", async (deliveryBoyId) => {
            if (!deliveryBoyId) return;
            try {
                socket.join(`delivery_${deliveryBoyId}`);
                socket.data.deliveryBoyId = String(deliveryBoyId);

                await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                    socketId: socket.id,
                    isOnline: true,
                });

                socket.emit("joined:delivery", { deliveryBoyId });
                console.log(`🚴 DeliveryBoy ${deliveryBoyId} online`);
            } catch (err) {
                console.error("join:delivery error:", err.message);
            }
        });

        // ── Real-time GPS from delivery boy ────────────────────────────────
        // { orderId, deliveryBoyId, lat, lng }
        socket.on("delivery:locationUpdate", async ({ orderId, deliveryBoyId, lat, lng }) => {
            if (!orderId || !deliveryBoyId || lat == null || lng == null) return;

            try {
                const order = await Order.findOne({ orderId })
                    .select("user customerLocation _id")
                    .lean();
                if (!order) return;

                const now = new Date();

                await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                    lastLocation: { lat, lng, updatedAt: now },
                });

                await LocationHistory.create({
                    deliveryBoy: deliveryBoyId,
                    order: order._id,
                    lat, lng,
                    recordedAt: now,
                });

                const payload = {
                    orderId, lat, lng,
                    updatedAt: now,
                    customerLat: order.customerLocation?.lat ?? null,
                    customerLng: order.customerLocation?.lng ?? null,
                };

                if (order.user) io.to(`user_${order.user}`).emit("delivery:locationUpdate", payload);
                io.to("adminRoom").emit("delivery:locationUpdate", payload);

            } catch (err) {
                console.error("❌ locationUpdate error:", err.message);
            }
        });

        // ── Disconnect ─────────────────────────────────────────────────────
        socket.on("disconnect", async (reason) => {
            console.log(`❌ Disconnected: ${socket.id} — ${reason}`);
            const deliveryBoyId = socket.data.deliveryBoyId;
            if (!deliveryBoyId) return;
            try {
                await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                    socketId: null,
                    isOnline: false,
                });
                console.log(`🔴 DeliveryBoy ${deliveryBoyId} offline`);
            } catch (err) {
                console.error("disconnect update error:", err.message);
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
    return io;
};