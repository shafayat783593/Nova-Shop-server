import express from "express";
// import { isAuth } from "../middleware/isAuth.js";
import { getCloudinarySignature } from "../controllers/cloudinarySignature.controller.js";
const router = express.Router();

router.get("/", getCloudinarySignature);

export default router;
