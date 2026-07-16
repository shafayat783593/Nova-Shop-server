import express from "express";
import {
    addReview,
    updateReview,
    getReviewsByProduct,
    canReview,
    getMyReview,
    deleteReview,
    toggleVisibility,
    getFeaturedReviews,
} from "../controllers/review.controller.js";
import { authorizeAdmin, isAuth } from "../middlewares/isAuth.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/product/:productId", getReviewsByProduct);

// ─── Auth required ────────────────────────────────────────────────────────────

router.post("/", isAuth,addReview);
router.patch("/:reviewId",isAuth, updateReview);
router.delete("/:reviewId",isAuth, deleteReview);
router.get("/can-review",isAuth, canReview);
router.get("/my",isAuth, getMyReview);
router.get("/featured", getFeaturedReviews);

// ─── Admin only ───────────────────────────────────────────────────────────────
router.patch("/:reviewId/visibility",isAuth, authorizeAdmin, toggleVisibility);

export default router;