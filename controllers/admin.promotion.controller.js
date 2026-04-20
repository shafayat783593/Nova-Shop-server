import { promotion } from '../models/Promotion.js';

// Create a new promotion
export const createPromotion = async (req, res) => {
    try {
        const { text, isActive, link } = req.body;
        const newPromotion = new promotion({ text, isActive, link });
        await newPromotion.save();
        res.status(201).json({ message: "Promotion created successfully", data: newPromotion });
    } catch (error) {
        res.status(500).json({ message: "Error creating promotion", error: error.message });
    }
};

// Get all promotions
export const getAllPromotions = async (req, res) => {
    try {
        const promotions = await promotion.find().sort({ createdAt: -1 });
        res.status(200).json(promotions);
    } catch (error) {
        res.status(500).json({ message: "Error fetching promotions", error: error.message });
    }
};

// Get single promotion by ID
export const getPromotionById = async (req, res) => {
    try {
        const promo = await promotion.findById(req.params.id);
        if (!promo) return res.status(404).json({ message: "Promotion not found" });
        res.status(200).json(promo);
    } catch (error) {
        res.status(500).json({ message: "Error fetching promotion", error: error.message });
    }
};

// Update promotion by ID
export const updatePromotion = async (req, res) => {
    try {
        const updatedPromo = await promotion.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedPromo) return res.status(404).json({ message: "Promotion not found" });
        res.status(200).json({ message: "Promotion updated successfully", data: updatedPromo });
    } catch (error) {
        res.status(500).json({ message: "Error updating promotion", error: error.message });
    }
};

// Delete promotion by ID
export const deletePromotion = async (req, res) => {
    try {
        const deletedPromo = await promotion.findByIdAndDelete(req.params.id);
        if (!deletedPromo) return res.status(404).json({ message: "Promotion not found" });
        res.status(200).json({ message: "Promotion deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting promotion", error: error.message });
    }
};