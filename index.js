import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import userRouter from "./routers/user.routes.js"
import { createClient } from "redis"
import cookieParser from "cookie-parser"
import getCloudinarySignature  from "./routers/cloudinarysignature.routes.js";
import settingsRouter from "./routers/settings.routes.js"
import product from "./routers/product.routes.js"
import bannerRoute from "./routers/admin.banner.routes.js"
import promotionRoutes from "./routers/admin.promotion.routes.js"
import cartRouter from "./routers/cart.routes.js"
import wishlistRouter from "./routers/wishlist.routes.js"
import cors from "cors"
dotenv.config()
await connectDb()


const redisUrl = process.env.REDIS_URL
if (!redisUrl) {
    console.log("Missing redis Url");
    process.exit(1)

}

export const redisClint = createClient({
    url: redisUrl
})

redisClint
    .connect().then(() => {
        console.log("connected to redi")

    }).catch(console.error)

const app = express()


app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: process.env.FRONTEND_URL, 
    credentials: true,               
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
}));
const PORT = process.env.PORT || 5000

app.use("/api/auth", userRouter)
app.use("/api/settings", settingsRouter)
// app.use("/api/promotion", promotionRoutes);
app.use("/api/cloudinary-sign", getCloudinarySignature);
app.use("/api/products", product);
app.use("/api/banners", bannerRoute);
app.use("/api/promotions",promotionRoutes);
app.use("/api/product/cart", cartRouter);
app.use("/api/wishlist", wishlistRouter);

app.listen(PORT, () => {
    console.log(`server is running on the port ${PORT}`)
})


