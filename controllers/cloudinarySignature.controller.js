

import { v2 as cloudinary } from 'cloudinary';
export const getCloudinarySignature = async (req, res) => {
    try {
        const requestedFolder = req.query.folder ;

        const allowedBaseFolders = ["profiles", "vendor-shop-info","products"];
        const isAllowed = allowedBaseFolders.some(base => requestedFolder.startsWith(base));

        if (!isAllowed) {
            return res.status(403).json({ message: "Folder access denied" });
        }

        const timestamp = Math.floor(Date.now() / 1000);

        // এখানে folder অবশ্যই requestedFolder হতে হবে যা ফ্রন্টএন্ড পাঠাচ্ছে
        const signature = cloudinary.utils.api_sign_request(
            {
                timestamp,
                folder: requestedFolder
            },
            process.env.CLOUDINARY_API_SECRET
        );

        res.status(200).json({
            timestamp,
            signature,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder: requestedFolder,
        });
    } catch (err) {
        console.error("Signature Error:", err);
        res.status(500).json({ message: "Cloudinary signature error" });
    }
};