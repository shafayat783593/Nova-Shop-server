// import express from "express";
// import {
//     getCart,
//     addToCart,
//     updateCartItem,
//     removeCartItem,
//     clearCart,
//     mergeCart,
//     applyCoupon,
//     removeCoupon,
// } from "../controllers/cart.controller.js";
// import { isAuth } from "../middlewares/isAuth.js";

// const router = express.Router();

// // Works for both guests (x-session-id header) and logged-in users
// router.get("/", isAuth, getCart);                          // GET  /api/cart
// router.post("/add",isAuth, addToCart);                    // POST /api/cart/add
// router.patch("/item/:itemId",isAuth, updateCartItem);     // PATCH /api/cart/item/:id
// router.delete("/item/:itemId", isAuth, removeCartItem);    // DELETE /api/cart/item/:id
// router.delete("/", isAuth, clearCart);                     // DELETE /api/cart
// router.post("/coupon", isAuth, applyCoupon);               // POST /api/cart/coupon
// router.delete("/coupon", isAuth, removeCoupon);            // DELETE /api/cart/coupon

// // Auth required
// router.post("/merge", isAuth, mergeCart);          // POST /api/cart/merge (after login)

// export default router;













import express from "express";
import {
    getCart, addToCart, updateCartItem,
    removeCartItem, clearCart, mergeCart,
    applyCoupon, removeCoupon,
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

// merge এ isAuth থাকবেই — login ছাড়া merge হবে না
router.post("/merge", isAuth, mergeCart);

export default router;