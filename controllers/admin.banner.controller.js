import Banner from '../models/Banner.js';

export const createBanner = async (req, res) => {
    try {
        const { title, description, imageUrl, link } = req.body;
        const newBanner = new Banner({ title, description, imageUrl, link });
        await newBanner.save();
        res.status(201).json({ message: "Banner created successfully", data: newBanner });
    } catch (error) {
        res.status(500).json({ message: "Error creating banner", error: error.message });
    }
};

export const getActiveBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true });
        res.status(200).json(banners);
    } catch (error) {
        res.status(500).json({ message: "Error fetching banners", error: error.message });
    }
};



export const getBannerById = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json(banner);
    } catch (error) {
        res.status(500).json({ message: "Error fetching banner", error: error.message });
    }
};

// Update banner by ID
export const updateBanner = async (req, res) => {
    try {
        const updatedBanner = await Banner.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedBanner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json({ message: "Banner updated successfully", data: updatedBanner });
    } catch (error) {
        res.status(500).json({ message: "Error updating banner", error: error.message });
    }
};

// Delete banner by ID
export const deleteBanner = async (req, res) => {
    try {
        const deletedBanner = await Banner.findByIdAndDelete(req.params.id);
        if (!deletedBanner) return res.status(404).json({ message: "Banner not found" });
        res.status(200).json({ message: "Banner deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting banner", error: error.message });
    }
};