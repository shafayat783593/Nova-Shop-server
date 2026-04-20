import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    link: { type: String, default: '#' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;