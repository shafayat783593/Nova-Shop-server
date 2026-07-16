import express from "express"
import { forgotPassword,  loginUser,   myProfile, refreshCSRF, refreshToken, registerUser, resetPassword, verifyOtp, verifyUser } from "../controllers/user.controller.js"
import { isAuth } from "../middlewares/isAuth.js";
import { verifyCSRFToken } from "../middlewares/csrfMiddleware.js";
import passport from "../config/passport.js";
import { generateToken } from "../config/generateToken.js"; // ✅ এটা add করো

const router = express.Router()

router.get("/google", (req, res, next) => {
    const returnUrl = req.query.returnUrl || '';
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
        state: returnUrl ? Buffer.from(returnUrl).toString('base64') : '',
        prompt: "select_account", // ✅ ei line ta add koro
    })(req, res, next);
});


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
const usedGoogleCodes = new Set();


// user.routes.js callback-এ
router.get(
    "/google/callback",
    (req, res, next) => {
        const code = req.query.code;
        if (code && usedGoogleCodes.has(code)) {
            console.warn("Duplicate Google OAuth code blocked:", code.slice(0, 15));
            // ✅ token chara e success page e pathao, frontend nijei check korবে
            return res.redirect(`${process.env.FRONTEND_URL}/google/success?duplicate=true`);
        }
        if (code) {
            usedGoogleCodes.add(code);
            setTimeout(() => usedGoogleCodes.delete(code), 2 * 60 * 1000);
        }
        next();
    },
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_failed`,
    }),
    
    async (req, res) => {
        try {
            const user = req.user;
            const result = await generateToken(user, res, req);

            const state = req.query.state || '';
            let returnUrl = '';
            if (state) {
                try { returnUrl = Buffer.from(state, 'base64').toString('utf-8'); }
                catch { returnUrl = ''; }
            }

            if (result.limitReached) {
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=MAX_SESSIONS_REACHED`);
            }

            const destination = returnUrl || (
                { admin: '/admin', vendor: '/vendor', deliveryboy: '/deliveryboy' }[user.role] || '/'
            );

            // ✅ token URL-এ pass করো — frontend-এ cookie set হবে
            
            const params = new URLSearchParams({
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                csrfToken: result.csrfToken,
                sessionId: result.sessionId,
                returnUrl: destination,
            });

            res.redirect(`${process.env.FRONTEND_URL}/google/success?${params.toString()}`);

        } catch (err) {
            console.error("Google callback error:", err);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
        }
    }
);
export default router

