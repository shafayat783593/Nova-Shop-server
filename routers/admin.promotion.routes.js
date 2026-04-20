import express from "express";
import {
    createPromotion,
    getAllPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion
} from "../controllers/admin.promotion.controller.js";

const router = express.Router();

router.post('/add', createPromotion);
router.get('/', getAllPromotions);
router.get('/:id', getPromotionById);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);

export default router;