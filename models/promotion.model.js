// models/Promotion.js
const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    link: { type: String, default: "" } // চাইলে লিংকের অপশনও রাখতে পারেন
}, { timestamps: true });

module.exports = mongoose.model('Promotion', promotionSchema);