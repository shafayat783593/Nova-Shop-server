import { Server } from "socket.io";
import DeliveryBoy from "../models/deliveryBoy.model.js";
import LocationHistory from "../models/locationHistory.model.js";
import Order from "../models/order.model.js";

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: "*", // dev এ সব allow, production এ restrict করো
            credentials: true,
            methods: ["GET", "POST"],
        },
        transports: ["websocket", "polling"],
        pingTimeout:  60000,
        pingInterval: 25000,
        allowEIO3: true, // older clients support
    });

    io.on("connection", (socket) => {
        console.log(`✅ Socket connected: ${socket.id} | transport: ${socket.conn.transport.name}`);

        // ── Customer ───────────────────────────────────────────────────────
        socket.on("join:user", (userId) => {
            if (!userId) return;
            const uid   = String(userId);
            const room  = `user_${uid}`;
            socket.join(room);
            socket.data.userId = uid;
            socket.emit("joined:user", { room });
            console.log(`👤 User ${uid} → room [${room}]`);
        });

        // ── Admin ──────────────────────────────────────────────────────────
        socket.on("join:admin", () => {
            socket.join("adminRoom");
            socket.emit("joined:admin", { room: "adminRoom" });
            console.log(`🛡️  Admin joined adminRoom`);
        });

        // ── Delivery boy ───────────────────────────────────────────────────
    socket.on("join:delivery", async (deliveryBoyId) => {
    if (!deliveryBoyId) {
        console.warn("⚠️ join:delivery: no deliveryBoyId received");
        return;
    }
    
    console.log("🚴 join:delivery received, raw value:", deliveryBoyId, "type:", typeof deliveryBoyId);
    
    try {
        const dbId = String(deliveryBoyId);
        const room = `delivery_${dbId}`;
        socket.join(room);
        socket.data.deliveryBoyId = dbId;

        // ✅ isActive check ছাড়া update করো — না থাকলে error হতে পারে
        await DeliveryBoy.findByIdAndUpdate(dbId, {
            socketId: socket.id,
            isOnline: true,
        });

        socket.emit("joined:delivery", { deliveryBoyId: dbId, room });
        console.log(`🚴 DeliveryBoy ${dbId} → room [${room}]`);
    } catch (err) {
        console.error("join:delivery error:", err.message, "| deliveryBoyId:", deliveryBoyId);
    }
});

        // ── Real-time GPS from delivery boy ────────────────────────────────
        // Payload: { orderId, deliveryBoyId, lat, lng }
        socket.on("delivery:locationUpdate", async (payload) => {
            console.log("📍 locationUpdate received:", JSON.stringify(payload));

            const { orderId, deliveryBoyId, lat, lng } = payload || {};

            if (!orderId || !deliveryBoyId || lat == null || lng == null) {
                console.warn("⚠️  locationUpdate: missing fields", { orderId, deliveryBoyId, lat, lng });
                return;
            }

            try {
                // Find order — match by orderId string (e.g. "ORD-XXXXXXXX")
                const order = await Order.findOne({ orderId })
                    .select("user customerLocation _id")
                    .lean();

                if (!order) {
                    console.warn("⚠️  locationUpdate: order not found:", orderId);
                    return;
                }

console.log("order.user:", order.user, "type:", typeof order.user);
                const now = new Date();

                // Update delivery boy's last known location
                await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                    lastLocation: { lat, lng, updatedAt: now },
                });

                // Save to history (auto-delete after 24h via TTL index)
                await LocationHistory.create({
                    deliveryBoy: deliveryBoyId,
                    order:       order._id,
                    lat, lng,
                    recordedAt: now,
                });

                const emitPayload = {
                    orderId,
                    lat,
                    lng,
                    updatedAt:   now,
                    customerLat: order.customerLocation?.lat ?? null,
                    customerLng: order.customerLocation?.lng ?? null,
                };

                // ✅ KEY: emit to customer room using STRING userId
                if (order.user) {
                    const userRoom = `user_${String(order.user)}`;
                    console.log(`📡 Emitting to customer room [${userRoom}]`);
                    io.to(userRoom).emit("delivery:locationUpdate", emitPayload);
                }

                // Emit to admin
                io.to("adminRoom").emit("delivery:locationUpdate", emitPayload);

                console.log(`✅ Location broadcast done for order ${orderId}`);

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