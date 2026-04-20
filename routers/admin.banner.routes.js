import express from "express";
import {
    createBanner,
    getActiveBanners,
    getBannerById,
    updateBanner,
    deleteBanner
} from "../controllers/admin.banner.controller.js";

const router = express.Router();

// Admin routes
router.post('/add', createBanner);
router.get('/:id', getBannerById);   // Fetch for edit
router.put('/:id', updateBanner);     // Update banner
router.delete('/:id', deleteBanner);  // Delete banner

// Public route
router.get('/', getActiveBanners);

export default router;