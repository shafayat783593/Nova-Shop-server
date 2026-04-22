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
    toggleFeatured,
    getCategories,
    getProductVariants,
    updateVariantStock,
} from "../controllers/product.controller.js";
import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/", getAllProducts);
router.get("/categories", getCategories);
router.get("/:slug", getProductById);
router.get("/:id/variants", getProductVariants);

// ─── Protected (Admin only) ───────────────────────────────────────────────────
router.post("/", isAuth, authorizeAdmin, createProduct);
router.put("/:slug", isAuth, authorizeAdmin, updateProduct);
router.delete("/:id", isAuth, authorizeAdmin, deleteProduct);
router.patch("/:id/toggle", isAuth, authorizeAdmin, toggleProductStatus);
router.patch("/:id/feature", isAuth, authorizeAdmin, toggleFeatured);
router.patch("/:id/variants/:variantId/stock", isAuth, authorizeAdmin, updateVariantStock);

export default router;