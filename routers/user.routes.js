import express from "express"
import { forgotPassword,  loginUser,   myProfile, refreshCSRF, refreshToken, registerUser, resetPassword, verifyOtp, verifyUser } from "../controllers/user.controller.js"
import { isAuth } from "../middlewares/isAuth.js";
import { verifyCSRFToken } from "../middlewares/csrfMiddleware.js";

const router= express.Router()
router.get("/me", isAuth , myProfile)
router.post("/verify-otp", verifyOtp);
router.post("/register",registerUser)
router.post("/verify/:token", verifyUser);
router.post("/login", loginUser);

router.post("/refresh-token",refreshToken)
// router.post("/logout", isAuth, verifyCSRFToken, logOutUser)
router.post("/refresh-csrf", isAuth, refreshCSRF)
// POST /api/auth/forgot-password  →  sends OTP to email
router.post("/forgot-password", forgotPassword);

// POST /api/auth/reset-password   →  verifies OTP + sets new password
router.post("/reset-password", resetPassword);


export default router

