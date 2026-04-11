import mongoose from "mongoose";

const shopSchema = new mongoose.Schema({
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    shopName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    }, // Zod schema অনুযায়ী অ্যাড করা হয়েছে
    logo: {
        type: String,
        default: ""
    },

    // KYC & Documents
    legalInfo: {
        tradeLicense: { type: String, default: "" },
        nidNumber: { type: String, default: "" }, // tinNumber এর বদলে nidNumber (Zod অনুযায়ী)
        nidFront: { type: String, default: "" },
        nidBack: { type: String, default: "" }
    },

    // Contact & Logistics
    contact: {
        businessEmail: { type: String, default: "" },
        businessPhone: { type: String, required: true },
        pickupAddress: { type: String, required: true },
        city: { type: String, default: "" }, // Zod schema অনুযায়ী অ্যাড করা হয়েছে
        area: { type: String, default: "" }, // Zod schema অনুযায়ী অ্যাড করা হয়েছে
        location: {
            lat: { type: Number, default: 0 },
            lng: { type: Number, default: 0 }
        }
    },

    // Financials
    payoutDetails: {
        payoutMethod: {
            type: String,
            enum: ['bank', 'bkash', 'nagad'],
            default: 'bank'
        },
        bankName: { type: String, default: "" },
        accountHolder: { type: String, default: "" },
        accountNumber: { type: String, default: "" }, // এটা MFS নম্বর হিসেবেও কাজ করবে logic অনুযায়ী
        routingNumber: { type: String, default: "" }
    },

    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'suspended'],
        default: 'pending'
    }
}, { timestamps: true });

const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);
export default Shop;