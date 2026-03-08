const express = require("express");
const router = express.Router();
const { updatePromotion, getActivePromotion } = require("../controllers/promotionController");
const { protect, admin } = require("../middleware/authMiddleware"); // আপনার প্রোটেকশন মিডলওয়্যার অনুযায়ী

// পাবলিক রাউট - সবাই দেখতে পারবে
router.get("/active", getActivePromotion);

// প্রোটেক্টেড রাউট - শুধু লগইন করা অ্যাডমিন আপডেট করতে পারবে
// আপনার মিডলওয়্যার ফাংশনের নাম ভিন্ন হলে তা পরিবর্তন করে নিন
router.post("/update", protect, admin, updatePromotion);

module.exports = router;