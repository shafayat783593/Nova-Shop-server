import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
    title: { type: String, required: false, default: "" },
    description: { type: String, required: false, default: "" },
    imageUrl: { type: String, required: false, default: "" },
    link: { type: String, default: '#' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;