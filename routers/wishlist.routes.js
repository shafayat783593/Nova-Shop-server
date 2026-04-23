import express from "express";
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    updateWishlistItem,
    clearWishlist,
    checkWishlisted,
    moveToCart,
} from "../controllers/wishlist.controller.js";
import { isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// All wishlist routes require login
router.use(isAuth);

// ─── Read ──────────────────────────────────────────────────────────────────
router.get("/", getWishlist);           // GET  full wishlist
router.get("/check/:productId", checkWishlisted);       // GET  is this product wishlisted?

// ─── Write ─────────────────────────────────────────────────────────────────
router.post("/add", addToWishlist);         // POST add product
router.post("/toggle", toggleWishlist);        // POST add or remove (toggle)
router.post("/move-to-cart/:productId", moveToCart);           // POST move item to cart

// ─── Update / Delete ────────────────────────────────────────────────────────
router.patch("/:productId", updateWishlistItem);    // PATCH update note/priority
router.delete("/", clearWishlist);         // DELETE clear all
router.delete("/:productId", removeFromWishlist);    // DELETE remove one

export default router;