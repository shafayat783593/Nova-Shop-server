import express from "express";
import {
    getMyAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from "../controllers/address.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect); // All address routes require login

router.get("/", getMyAddresses);
router.post("/", addAddress);
router.put("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.patch("/:id/default", setDefaultAddress);

export default router;
