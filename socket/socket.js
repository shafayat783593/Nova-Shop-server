import { Server } from "socket.io";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import LocationHistory from "../models/locationHistory.model.js";
import Order from "../models/order.model.js";

let io;

// ─── Initialize Socket.io ─────────────────────────────────────────────────────
// Call once in server.js after creating the HTTP server
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(`✅ Socket connected: ${socket.id}`);

        // ── Customer joins their personal room ────────────────────────────
        socket.on("join:user", (userId) => {
            if (!userId) return;
            socket.join(`user_${userId}`);
            socket.data.userId = userId;
            console.log(`👤 User ${userId} joined room`);
        });

        // ── Admin joins admin room ─────────────────────────────────────────
        socket.on("join:admin", () => {
            socket.join("adminRoom");
            console.log(`🛡️  Admin joined adminRoom`);
        });

        // ── Delivery boy joins their room & marks online ──────────────────
        socket.on("join:delivery", async (deliveryBoyId) => {
            if (!deliveryBoyId) return;

            socket.join(`delivery_${deliveryBoyId}`);
            socket.data.deliveryBoyId = deliveryBoyId;

            await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                socketId: socket.id,
                isOnline: true,
            });

            console.log(`🚴 DeliveryBoy ${deliveryBoyId} joined & marked online`);
        });

        // ── Delivery boy sends real-time location ─────────────────────────
        // Payload: { orderId, deliveryBoyId, lat, lng }
        socket.on("delivery:locationUpdate", async ({ orderId, deliveryBoyId, lat, lng }) => {
            if (!orderId || !deliveryBoyId || lat == null || lng == null) return;

            try {
                // 1. Find the order to get customer's userId
                const order = await Order.findOne({ orderId })
                    .select("user customerLocation")
                    .lean();

                if (!order) return;

                const now = new Date();

                // 2. Update delivery boy's last known location
                await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                    lastLocation: { lat, lng, updatedAt: now },
                });

                // 3. Save to location history (24h TTL via index)
                await LocationHistory.create({
                    deliveryBoy: deliveryBoyId,
                    order: order._id,
                    lat,
                    lng,
                    recordedAt: now,
                });

                // 4. Build payload for client
                const payload = {
                    orderId,
                    lat,
                    lng,
                    updatedAt: now,
                    customerLat: order.customerLocation?.lat,
                    customerLng: order.customerLocation?.lng,
                };

                // 5. Emit to customer
                if (order.user) {
                    io.to(`user_${order.user}`).emit("delivery:locationUpdate", payload);
                }

                // 6. Emit to admin
                io.to("adminRoom").emit("delivery:locationUpdate", payload);

            } catch (err) {
                console.error("❌ Socket locationUpdate error:", err.message);
            }
        });

        // ── Delivery boy disconnects ──────────────────────────────────────
        socket.on("disconnect", async () => {
            console.log(`❌ Socket disconnected: ${socket.id}`);

            const deliveryBoyId = socket.data.deliveryBoyId;
            if (!deliveryBoyId) return;

            await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                socketId: null,
                isOnline: false,
            });

            console.log(`🔴 DeliveryBoy ${deliveryBoyId} marked offline`);
        });
    });

    return io;
};

// ─── Get the io instance (use in controllers) ─────────────────────────────────
export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
    return io;
};