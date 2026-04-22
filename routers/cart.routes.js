import express from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    mergeCart,
    applyCoupon,
    removeCoupon,
} from "../controllers/cart.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// Works for both guests (x-session-id header) and logged-in users
router.get("/", getCart);                          // GET  /api/cart
router.post("/add", addToCart);                    // POST /api/cart/add
router.patch("/item/:itemId", updateCartItem);     // PATCH /api/cart/item/:id
router.delete("/item/:itemId", removeCartItem);    // DELETE /api/cart/item/:id
router.delete("/", clearCart);                     // DELETE /api/cart
router.post("/coupon", applyCoupon);               // POST /api/cart/coupon
router.delete("/coupon", removeCoupon);            // DELETE /api/cart/coupon

// Auth required
router.post("/merge", isAuth, mergeCart);          // POST /api/cart/merge (after login)

export default router;