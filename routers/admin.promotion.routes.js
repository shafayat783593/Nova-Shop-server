import express from "express";
import {
    createPromotion,
    getAllPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion,
    togglePromotion,
    getActivePromotions,
    getPromotionStats,
} from "../controllers/admin.promotion.controller.js";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js";

const router = express.Router();

// ─── Public ───────────────────────────────────────────────────────────────────
router.get("/active", getActivePromotions);          // GET active promotions (homepage)

// ─── Admin ────────────────────────────────────────────────────────────────────
router.get("/stats", isAuth, authorizeAdmin, getPromotionStats);         // GET stats
router.get("/", isAuth, authorizeAdmin, getAllPromotions);                // GET all
router.get("/:id", isAuth, authorizeAdmin, getPromotionById);            // GET one
router.post("/", isAuth, authorizeAdmin, createPromotion);               // CREATE
router.put("/:id", isAuth, authorizeAdmin, updatePromotion);             // UPDATE
router.delete("/:id", isAuth, authorizeAdmin, deletePromotion);          // DELETE
router.patch("/:id/toggle", isAuth, authorizeAdmin, togglePromotion);    // TOGGLE

export default router;