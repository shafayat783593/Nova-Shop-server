

import express from "express";
import {
    getCart, addToCart, updateCartItem,
    removeCartItem, clearCart, mergeCart,
    applyCoupon, removeCoupon,
    countCartitme,
} from "../controllers/cart.controller.js";
import { isAuth } from "../middlewares/isAuth.js";
 const router = express.Router();

// optionalAuth → logged-in হলে req.user থাকবে, না হলেও block হবে না
router.get("/", isAuth, getCart);

router.post("/add", isAuth, addToCart);
router.patch("/item/:itemId", isAuth, updateCartItem);
router.delete("/item/:itemId", isAuth, removeCartItem);
router.delete("/", isAuth, clearCart);
router.post("/coupon", isAuth, applyCoupon);
router.delete("/coupon", isAuth, removeCoupon);
router.get("/countCartitme",isAuth, countCartitme)


// merge এ isAuth থাকবেই — login ছাড়া merge হবে না
router.post("/merge", isAuth, mergeCart);

export default router;