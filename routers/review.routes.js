import express from "express";
import {
    addReview,
    updateReview,
    getReviewsByProduct,
    canReview,
    getMyReview,
    deleteReview,
    toggleVisibility,
} from "../controllers/review.controller.js";
import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/product/:productId", getReviewsByProduct);

// ─── Auth required ────────────────────────────────────────────────────────────
router.use(isAuth);

router.post("/", addReview);
router.patch("/:reviewId", updateReview);
router.delete("/:reviewId", deleteReview);
router.get("/can-review", canReview);
router.get("/my", getMyReview);

// ─── Admin only ───────────────────────────────────────────────────────────────
router.patch("/:reviewId/visibility", authorizeAdmin, toggleVisibility);

export default router;