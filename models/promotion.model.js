// models/Promotion.js
import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    link: { type: String, default: "" } 
}, { timestamps: true });

export const promotion = mongoose.model('Promotion', promotionSchema);