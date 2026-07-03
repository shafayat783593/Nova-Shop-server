import Banner from '../models/Banner.js';
import sanitize from "mongo-sanitize";

// ── Create banner ───────────────────────────────────────────────
export const createBanner = async (req, res) => {
    try {
        const body = sanitize(req.body);
        const { title, description, imageUrl, link, isActive } = body;

        // ✅ কোনো field না দিলেও চলবে — শুধু যা আসছে সেটাই set হবে
        const newBanner = new Banner({
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(link !== undefined && { link }),
            ...(isActive !== undefined && { isActive }),
        });

        await newBanner.save();
        res.status(201).json({ message: "Banner created successfully", data: newBanner });
    } catch (error) {
        res.status(500).json({ message: "Error creating banner", error: error.message });
    }
};

// ── Get all active banners ──────────────────────────────────────
export const getActiveBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
        res.status(200).json(banners);
    } catch (error) {
        res.status(500).json({ message: "Error fetching banners", error: error.message });
    }
};

// ── Get all banners (admin — active + inactive) ────────────────
export const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ createdAt: -1 });
        res.status(200).json(banners);
    } catch (error) {
        res.status(500).json({ message: "Error fetching banners", error: error.message });
    }
};

// ── Get banner by ID ────────────────────────────────────────────
export const getBannerById = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json(banner);
    } catch (error) {
        res.status(500).json({ message: "Error fetching banner", error: error.message });
    }
};

// ── Update banner by ID ─────────────────────────────────────────
export const updateBanner = async (req, res) => {
    try {
        const body = sanitize(req.body);

        // ✅ শুধু যেগুলো body-তে পাঠানো হয়েছে সেগুলোই update হবে
        const allowedFields = ["title", "description", "imageUrl", "link", "isActive"];
        const updateData = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) updateData[field] = body[field];
        }

        const updatedBanner = await Banner.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        if (!updatedBanner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json({ message: "Banner updated successfully", data: updatedBanner });
    } catch (error) {
        res.status(500).json({ message: "Error updating banner", error: error.message });
    }
};

// ── Delete banner by ID ─────────────────────────────────────────
export const deleteBanner = async (req, res) => {
    try {
        const deletedBanner = await Banner.findByIdAndDelete(req.params.id);
        if (!deletedBanner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json({ message: "Banner deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting banner", error: error.message });
    }
};