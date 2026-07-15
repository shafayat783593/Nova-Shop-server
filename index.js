import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { createServer } from "http"; // যোগ করা হয়েছে
import cors from "cors";
import cookieParser from "cookie-parser";
import { createClient } from "redis";
import mongoose from "mongoose"; // ইমপোর্ট চেক করুন
import passport from "./config/passport.js";

// Routes
import connectDb from "./config/db.js";
import userRouter from "./routers/user.routes.js";
import getCloudinarySignature from "./routers/cloudinarysignature.routes.js";
import settingsRouter from "./routers/settings.routes.js";
import product from "./routers/product.routes.js";
import bannerRoute from "./routers/admin.banner.routes.js";
import promotionRoutes from "./routers/admin.promotion.routes.js";
import cartRouter from "./routers/cart.routes.js";
import wishlistRouter from "./routers/wishlist.routes.js";
import { paymentRouter } from "./routers/payment.routes.js";
import { orderRouter } from "./routers/order.routes.js";
import addressRouter from "./routers/address.routes.js";
import { initSocket } from "./socket/socket.js";
import { invoiceRouter } from "./routers/Invoice.routes.js";
import deliveryRoutes from "./routers/deliveryboy.routes.js";
import reviewRoutes from "./routers/review.routes.js"
import chatRouter from "./routers/chat.routes.js";
import contactRouter from "./routers/contact.routes.js"
import adminRoutes from "./routers/admin.routes.js"
// import dns from "dns";

// কনফিগারেশন


const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
// dns.setServers(["1.1.1.1", "8.8.8.8"]);

// মিডলওয়্যার
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: [
        "https://arinexa.vercel.app",
        "http://localhost:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
}));
// Redis সেটআপ
const redisUrl = process.env.REDIS_URL;
export const redisClint = createClient({ url: redisUrl });

if (redisUrl) {
    redisClint.connect()
        .then(() => console.log("Redis connected"))
        .catch(err => console.error("Redis error:", err));
} else {
    console.warn("Redis not found - continuing without cache");
}

// সকেট ইনিশিয়ালাইজেশন
initSocket(httpServer);

// রাউটস
app.use("/api/auth", userRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/cloudinary-sign", getCloudinarySignature);
app.use("/api/products", product);
app.use("/api/banners", bannerRoute);
app.use("/api/promotions", promotionRoutes);
app.use("/api/product/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/addresses", addressRouter);
app.use("/api/orders", orderRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/deliveryboys", deliveryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chat", chatRouter);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRouter)
// ডাটাবেস ও সার্ভার স্টার্ট
import { initPassport } from "./config/passport.js";
const startServer = async () => {
    try {
        await connectDb();

        initPassport(); // ✅ এখন dotenv already loaded, env vars available
        app.use(passport.initialize());

        httpServer.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        process.exit(1);
    }
};




app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "production" ? null : err.message
    });
});


startServer();