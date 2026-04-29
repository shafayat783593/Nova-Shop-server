import { Server } from "socket.io";

let io;

// ─── Initialize Socket.io ─────────────────────────────────────────────────────
// Call this once in server.js / app.js after creating the HTTP server
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // ── User joins their personal room ────────────────────────────────
        socket.on("join:user", (userId) => {
            if (userId) {
                socket.join(`user_${userId}`);
                console.log(`User ${userId} joined room user_${userId}`);
            }
        });

        // ── Admin joins admin room ─────────────────────────────────────────
        socket.on("join:admin", () => {
            socket.join("adminRoom");
            console.log(`Admin joined adminRoom`);
        });

        // ── Delivery boy joins their room ─────────────────────────────────
        socket.on("join:delivery", (deliveryBoyId) => {
            if (deliveryBoyId) {
                socket.join(`delivery_${deliveryBoyId}`);
                console.log(`Delivery boy ${deliveryBoyId} joined`);
            }
        });

        // ── Delivery boy sends location update ────────────────────────────
        // Emitted by delivery boy's mobile app while on route
        socket.on("delivery:locationUpdate", async ({ orderId, lat, lng, deliveryBoyId }) => {
            if (!orderId || !lat || !lng) return;

            // Forward to the order's customer and to admin
            io.to("adminRoom").emit("delivery:location", { orderId, lat, lng });

            // We need the order's user ID to target their room
            try {
                const { default: Order } = await import("./models/order.model.js");
                const { default: DeliveryBoy } = await import("./models/deliveryBoy.model.js");

                const order = await Order.findOne({ orderId }).select("user").lean();
                if (order?.user) {
                    io.to(`user_${order.user}`).emit("delivery:location", { orderId, lat, lng });
                }

                // Persist last known location to DB
                if (deliveryBoyId) {
                    await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                        lastLocation: { lat, lng, updatedAt: new Date() },
                    });
                }
            } catch (err) {
                console.error("Socket locationUpdate error:", err.message);
            }
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

// ─── Get the io instance (use in controllers) ─────────────────────────────────
export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
    return io;
};