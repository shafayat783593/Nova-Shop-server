import sanitize from "mongo-sanitize";
import Shop from "../models/Shop.model.js";
import User from "../models/user.model.js";
import { shopCreateSchema } from "../config/zod.js";

// ─── Get My Shop ───────────────────────────────────────────────
export const getMyShop = async (req, res) => {
    try {
        const shop = await Shop.findOne({ vendor: req.user._id });
        if (!shop) {
            return res.status(404).json({ success: false, message: "Shop not found" });
        }
        res.status(200).json({ success: true, data: shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Create Shop ───────────────────────────────────────────────
export const createShop = async (req, res) => {
    try {
        const sanitizedBody = sanitize(req.body);
        const parsed = shopCreateSchema.safeParse(sanitizedBody);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const existing = await Shop.findOne({ vendor: req.user._id });
        if (existing) {
            return res.status(409).json({ success: false, message: "Shop already exists." });
        }

        const data = parsed.data;

        // পেমেন্ট ডাটা প্রসেসিং (payoutMethod সহ)
        const payoutDetails = data.payoutMethod === "bank"
            ? {
                payoutMethod: "bank",
                bankName: data.bankName,
                accountHolder: data.accountHolder,
                accountNumber: data.accountNumber,
                routingNumber: data.routingNumber || ""
            }
            : {
                payoutMethod: data.payoutMethod, // bkash/nagad
                bankName: data.payoutMethod,
                accountHolder: "MFS",
                accountNumber: data.mfsNumber,
                routingNumber: ""
            };

        const shop = await Shop.create({
            vendor: req.user._id,
            shopName: data.shopName,
            category: data.category,
            description: data.description || "", // নতুন ফিল্ড
            logo: data.logo || "",
            legalInfo: {
                tradeLicense: data.tradeLicense || "",
                nidNumber: data.nidNumber, // এখানে tinNumber এর বদলে nidNumber হবে
                nidFront: data.nidFront,
                nidBack: data.nidBack
            },
            contact: {
                businessEmail: data.businessEmail,
                businessPhone: data.businessPhone,
                pickupAddress: data.pickupAddress,
                city: data.city || "", // নতুন ফিল্ড
                area: data.area || ""   // নতুন ফিল্ড
            },
            payoutDetails,
            status: 'pending'
        });

        await User.findByIdAndUpdate(req.user._id, { shop: shop._id });

        res.status(201).json({ success: true, data: shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── Update Shop ───────────────────────────────────────────────
export const updateShop = async (req, res) => {
    try {
        const sanitizedBody = sanitize(req.body);
        const parsed = shopCreateSchema.safeParse(sanitizedBody);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                errors: parsed.error.flatten().fieldErrors,
            });
        }

        const shop = await Shop.findOne({ vendor: req.user._id });
        if (!shop) return res.status(404).json({ success: false, message: "Shop not found" });

        const data = parsed.data;

        // ডাটা আপডেট
        shop.shopName = data.shopName;
        shop.category = data.category;
        shop.description = data.description || shop.description; // আপডেট লজিক
        if (data.logo) shop.logo = data.logo;

        shop.legalInfo = {
            tradeLicense: data.tradeLicense || shop.legalInfo.tradeLicense,
            nidNumber: data.nidNumber,
            nidFront: data.nidFront,
            nidBack: data.nidBack,
        };

        shop.contact = {
            businessEmail: data.businessEmail,
            businessPhone: data.businessPhone,
            pickupAddress: data.pickupAddress,
            city: data.city || shop.contact.city, // আপডেট লজিক
            area: data.area || shop.contact.area,  // আপডেট লজিক
        };

        shop.payoutDetails = data.payoutMethod === "bank"
            ? {
                payoutMethod: "bank",
                bankName: data.bankName,
                accountHolder: data.accountHolder,
                accountNumber: data.accountNumber,
                routingNumber: data.routingNumber || ""
            }
            : {
                payoutMethod: data.payoutMethod,
                bankName: data.payoutMethod,
                accountHolder: "MFS",
                accountNumber: data.mfsNumber,
                routingNumber: ""
            };

        shop.status = 'pending';

        await shop.save();
        res.status(200).json({ success: true, data: shop });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};