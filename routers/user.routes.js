import express from "express"
import { loginUser, logOutUser, myProfile, refreshCSRF, refreshToken, registerUser, verifyOtp, verifyUser } from "../controllers/user.controller.js"
import { isAuth } from "../middlewares/isAuth.js";
import { verifyCSRFToken } from "../middlewares/csrfMiddleware.js";

const router= express.Router()
router.get("/me", isAuth , myProfile)
router.post("/verify-otp", verifyOtp);
router.post("/register",registerUser)
router.post("/verify/:token", verifyUser);
router.post("/login", loginUser);

router.post("/refresh-token",refreshToken)
router.post("/logout", isAuth, verifyCSRFToken, logOutUser)
router.post("/refresh-csrf", isAuth, refreshCSRF)

export default router

