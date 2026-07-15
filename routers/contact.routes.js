import express from "express";
import { handleContactForm } from "../controllers/contact.controller.js";

const router = express.Router();

// POST /api/contact
router.post("/", handleContactForm);

export default router;