import { Server } from "socket.io";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import LocationHistory from "../models/locationHistory.model.js";
import Order from "../models/order.model.js";

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "*", // Fallback for dev environment
            credentials: true,
            methods: ["GET", "POST"],
        },
        transports: ["websocket", "polling"],
        pingTimeout: 60000,
        pingInterval: 25000,
        allowEIO3: true, // Supports older clients if needed
    });

    io.on("connection", (socket) => {
        console.log(`✅ Socket connected: ${socket.id} | transport: ${socket.conn.transport.name}`);

        // ── 1. CUSTOMER & ADMIN (TRACKING) ──────────────────────────────────
        socket.on("join:user", (userId) => {
            if (!userId) return;
            const uid = String(userId);
            const room = `user_${uid}`;
            socket.join(room);
            socket.data.userId = uid;
            socket.emit("joined:user", { room });
            console.log(`👤 User ${uid} → room [${room}]`);
        });

        socket.on("join:admin", () => {
            socket.join("adminRoom");
            socket.emit("joined:admin", { room: "adminRoom" });
            console.log(`🛡️ Admin joined adminRoom`);
        });

        // ── 2. DELIVERY BOY (TRACKING) ──────────────────────────────────────
        socket.on("join:delivery", async (deliveryBoyId) => {
            if (!deliveryBoyId) {
                console.warn("⚠️ join:delivery: no deliveryBoyId received");
                return;
            }
            try {
                const dbId = String(deliveryBoyId);
                const room = `delivery_${dbId}`;
                socket.join(room);
                socket.data.deliveryBoyId = dbId;

                await DeliveryBoy.findByIdAndUpdate(dbId, {
                    socketId: socket.id,
                    isOnline: true,
                });

                socket.emit("joined:delivery", { deliveryBoyId: dbId, room });
                console.log(`🚴 DeliveryBoy ${dbId} → room [${room}]`);
            } catch (err) {
                console.error("join:delivery error:", err.message);
            }
        });

        // ── 3. REAL-TIME GPS BROADCAST ──────────────────────────────────────
        socket.on("delivery:locationUpdate", async (payload) => {
            const { orderId, deliveryBoyId, lat, lng } = payload || {};
            if (!orderId || !deliveryBoyId || lat == null || lng == null) return;

            try {
                const order = await Order.findOne({ orderId }).select("user customerLocation _id").lean();
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

                const emitPayload = {
                    orderId, lat, lng, updatedAt: now,
                    customerLat: order.customerLocation?.lat ?? null,
                    customerLng: order.customerLocation?.lng ?? null,
                };

                if (order.user) {
                    io.to(`user_${String(order.user)}`).emit("delivery:locationUpdate", emitPayload);
                }
                io.to("adminRoom").emit("delivery:locationUpdate", emitPayload);
                
                // Also emitting to admin-room just in case you use the chat admin room layout
                io.to("admin-room").emit("delivery:locationUpdate", emitPayload);

            } catch (err) {
                console.error("❌ locationUpdate error:", err.message);
            }
        });

        // ── 4. CHAT SYSTEM ──────────────────────────────────────────────────
        socket.on("joinConversation", (conversationId) => {
            console.log(`🔗 joinConversation: ${conversationId}`);
            const roomId = conversationId?.toString();
            if (!roomId) return;
            socket.join(roomId);
            console.log(`💬 User joined chat room: ${roomId}`);
            socket.emit("joinedConversation", roomId);
        });

        socket.on("joinAdminRoom", () => {
            socket.join("admin-room");
            console.log("🛡️ Admin joined admin-room (Chat)");
        });

        socket.on("joinConversationAsAdmin", (conversationId) => {
            const roomId = conversationId?.toString();
            if (!roomId) return;
            socket.join(roomId);
            console.log(`🛡️ Admin joined conversation chat: ${roomId}`);
        });

        // ── 5. DISCONNECT ───────────────────────────────────────────────────
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

// Unified getter function
export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
    return io;
};