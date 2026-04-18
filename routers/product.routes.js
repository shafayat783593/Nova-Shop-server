// import express from "express";
// import { createProduct, getAllProducts, getProductBySlug } from "../controllers/product.controller.js";
// import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

// const router = express.Router();



// router.post("/", isAuth, authorizeAdmin, createProduct );

// router.get("/", isAuth, getAllProducts);

// router.get("/:slug", isAuth, getProductBySlug);

// // Optional Routes
// // router.route("/:id")
// //     .patch(productController.updateProduct)
// //     .delete(productController.deleteProduct);

// export default router;




import express from "express";
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    getCategories,
} from "../controllers/product.controller.js";

import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/",isAuth, getAllProducts);
router.get("/categories", isAuth, getCategories);
router.get("/:id", isAuth, getProductById);

// ─── Protected (Admin only) ───────────────────────────────────────────────────
router.post("/", isAuth, authorizeAdmin, createProduct);
router.put("/:id", isAuth, authorizeAdmin, updateProduct);
router.delete("/:id", isAuth, authorizeAdmin, deleteProduct);
router.patch("/:id/toggle", isAuth, authorizeAdmin, toggleProductStatus);

export default router;