import { loginSchema, registerSchema } from "../config/zod.js";
import { redisClint } from "../index.js";
import TryCatch from "../middlewares/TryCatch.js";
import sanitize from "mongo-sanitize";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto"
import sendMail from "../config/sendMail.js";
import { getOtpHtml, getVerifyEmailHtml } from "../config/html.js";
import { email } from "zod";
import { generateToken, genetateAccessToken, revokeRefreshToken, verifyRefreshToken } from "../config/generateToken.js";
import { generateCSRFToken } from "../middlewares/csrfMiddleware.js";
export const registerUser = TryCatch(async (req, res) => {

    // const { name, email, password } = sanitize(req.body)
    const sanitezedBody = sanitize(req.body)
    console.log("sanitezbody", sanitezedBody)
    const validation = registerSchema.safeParse(sanitezedBody)
    console.log("validation", validation)
    if (!validation.success) {
        const zodError = validation.error
        console.log("zodError", zodError.issues)
        let firstErrorMessage = "Validation failed";
        let allErrors = []
        if (zodError?.issues && Array.isArray(zodError.issues)) {
            allErrors = zodError.issues.map((issue) => ({
                field: issue.path ? issue.path.join(".") : "unknown",
                massage: issue.message || "validatin Error",
                code: issue.code,
            }))
            firstErrorMessage = allErrors[0]?.massage || "Validation failed";
        }
        return res.status(400).json({
            massage: "validationn error",
            error: allErrors
        })

    }
    const { name, email, password } = validation.data


    const rateLimitKey = ` register-rate-limit:${req.ip}:${email}`
    if (await redisClint.get(rateLimitKey)) {
        return res.status(429).json({
            massage: "Too many requests, try again tater",
        })
    }
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        return res.status(400).json({
            massage: "user already exists",

        })
    }

    const hashPassword = await bcrypt.hash(password, 10)
    const verifyToken = crypto.randomBytes(32).toString("hex")
    const verifykey = `verify:${verifyToken}`
    const datatoStore = JSON.stringify({
        name,
        email,
        password: hashPassword
    })
    // await redisClint.set(`verify:${verifyToken}`, JSON.stringify({ ...}), { EX: 300 })

    await redisClint.set(verifykey, datatoStore, { EX: 300 })
    const subject = "verify Your eamil for Accoount creation"

    const html = getVerifyEmailHtml({ email, token: verifyToken, })
    console.log("verifyToken", verifyToken)
    console.log("Sending email to:", email);
    await sendMail({ email, subject, html });
    console.log("Email sent successfully");
    await redisClint.set(rateLimitKey, "true", { EX: 60 })

    res.json({
        message: "if your email is valid, a verification link has been sent. It will expire in 5 minutes"
    })
})


export const verifyUser = TryCatch(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        return res.status(400).json({
            massage: "Verification token is required"
        })
    }
    const verifyKey = `verify:${token}`
    const userDatajson = await redisClint.get(verifyKey);
    if (!userDatajson) {
        return res.status(400).json({
            massage: "verification link is expired"

        })

    }
    await redisClint.del(verifyKey);
    const userData = JSON.parse(userDatajson);

    const existingUser = await User.findOne({ email: userData.email })
    if (existingUser) {
        return res.status(400).json({
            massage: "This eamil address is already registered"

        })
    }
    const newUser = await User.create({
        name: userData.name,
        email: userData.email,
        password: userData.password
    })
    res.status(201).json({
        massage: "Email verified successfully ,Your acount have been created",
        userData: { _id: newUser._id, name: newUser.name, email: newUser.email }
    })
})





// export const loginUser = TryCatch(async (req, res) => {
//     const sanitezedBody = sanitize(req.body)
//     console.log(req.body)
//     const validation = loginSchema.safeParse(sanitezedBody)

//     if (!validation.success) {
//         const zodError = validation.error
//         console.log("zodError", zodError.issues)
//         let firstErrorMessage = "Validation failed";

//         let allErrors = []
//         if (zodError?.issues && Array.isArray(zodError.issues)) {
//             allErrors = zodError.issues.map((issue) => ({
//                 field: issue.path ? issue.path.join(".") : "unknown",
//                 massage: issue.message || "validatin Error",
//                 code: issue.code,
//             }))
//             firstErrorMessage = allErrors[0]?.massage || "Validation failed";
//         }
//         return res.status(400).json({
//             massage: "validationn error",
//             error: allErrors
//         })

//     }
//     const { email, password } = validation.data


//     const rateLimitKey = `login-rate-limit:${req.ip}:${email}`

//     const checkRateLimit = await redisClint.get(rateLimitKey);

//     if (checkRateLimit) {
//         return res.status(429).json({
//             massage: "Too many requests, try again tater",
//         })
//     }

//     const user = await User.findOne({ email });
//     if (!user) {
//         return res.status(400).json({
//             message: "Invalid credentials",
//             errorCode: "INVALID_CREDENTIALS",
//         });
//     }
//     const comparePwd = await bcrypt.compare(password, user.password);

//     if (!comparePwd) {
//         return res.status(400).json({
//             message: "Invalid credentials",
//             errorCode: "INVALID_CREDENTIALS",
//         });
//     }
//     const otp = crypto.randomInt(100000, 999999);
//     const otpKey = `otp:${email}`;
//     await redisClint.setEx(otpKey, 300, JSON.stringify(otp));

//     const subject = "OTP for verification";
//     const html = getOtpHtml({ email, otp });
//     await sendMail({ email, subject, html });
//     await redisClint.setEx(rateLimitKey, 60, "true");


//     res.json({
//         message:
//             "If your email is valid, a verification link has been sent. It will expire in 5 minutes.",
//     });
// });



export const loginUser = TryCatch(async (req, res) => {
    const sanitezedBody = sanitize(req.body);
    const validation = loginSchema.safeParse(sanitezedBody);

    if (!validation.success) {
        const allErrors = validation.error.issues.map((issue) => ({
            field: issue.path ? issue.path.join(".") : "unknown",
            message: issue.message || "Validation error",
            code: issue.code,
        }));
        return res.status(400).json({
            message: "Validation error",
            error: allErrors,
        });
    }

    const { email, password } = validation.data;
    const rateLimitKey = `login-rate-limit:${req.ip}:${email}`;
    const checkRateLimit = await redisClint.get(rateLimitKey);

    if (checkRateLimit) {
        return res.status(429).json({
            message: "Too many requests, try again later",
        });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({
            message: "Invalid credentials",
            errorCode: "INVALID_CREDENTIALS",
        });
    }

    const comparePwd = await bcrypt.compare(password, user.password);
    if (!comparePwd) {
        return res.status(400).json({
            message: "Invalid credentials",
            errorCode: "INVALID_CREDENTIALS",
        });
    }

    // 2FA enabled
    if (user.twoFactorEnabled) {
        const otp = crypto.randomInt(100000, 999999);
        const otpKey = `otp:${email}`;
        await redisClint.setEx(otpKey, 300, String(otp));

        const subject = "OTP for verification";
        const html = getOtpHtml({ email, otp });
        await sendMail({ email, subject, html });
        await redisClint.setEx(rateLimitKey, 60, "true");

        return res.status(200).json({
            twoFactorRequired: true,
            message: "OTP sent to your email, it will expire in 5 minutes",
        });
    }

    // 2FA is off → log in directly
    const { accessToken, refreshToken, csrfToken, sessionId } = await generateToken(user._id, res);

    await redisClint.setEx(rateLimitKey, 60, "true"); // rate limit

    res.json({
        message: "Login successful",
        accessToken,
        refreshToken,
        csrfToken,
        sessionId,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
        },
    });
});

export const verifyOtp = TryCatch(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({
            message: "Please Provide all details",
        });
    }

    const otpKey = `otp:${email}`;
    const storeOtpString = await redisClint.get(otpKey);

    if (!storeOtpString) {
        return res.status(400).json({
            message: "OTP is expired!",
        });
    }

    const storedOtp = JSON.parse(storeOtpString);

    if (storedOtp !== Number(otp)) {
        return res.status(400).json({
            message: "Invalid OTP",
        });
    }

    await redisClint.del(otpKey);

    const user = await User.findOne({ email }).select("-password");

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const tokenData = await generateToken(user._id, res);

    res.status(200).json({
        message: `Welcome ${user.email}`,
        user,
        sessionInfo: {
            sessionId: tokenData.sessionId,
            loginTime: new Date().toISOString(),
            csrfToken: tokenData.csrfToken,
        }
    });
});


export const refreshToken = TryCatch(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    console.log(refreshToken)
    if (!refreshToken) {
        return res.status(401).json({ message: 'Invalid refresh token!' });
    }

    const decode = await verifyRefreshToken(refreshToken);
    console.log(decode)
    if (!decode) {

        res.clearCookie("refreshToken")
        res.clearCookie("accessToken")
        res.clearCookie("csrfToken")

        return res.status(401).json({
            message: 'Session Expired. Please login.',
        });
    }

    await genetateAccessToken(decode.id, decode.sessionId, res);


    return res.status(200).json({
        message: 'Token refreshed',
    });
});



export const refreshCSRF = TryCatch(async (req, res) => {
    const userId = req.user._id;
    const newCSFToken = await generateCSRFToken(userId, res);
    res.json({
        message: 'CSRF token refreshed successfully!',
        csrfToken: newCSFToken,
    });
});






export const myProfile = TryCatch(async (req, res) => {
    const user = req.user;
    console.log("User", user)
    const sessionId = req.sessionId;
    const sessionData = await redisClint.get(`session:${sessionId}`);
    let sessionInfo = null;
    if (sessionData) {
        const parsedSession = JSON.parse(sessionData);
        sessionInfo = {
            sessionId,
            loginTime: parsedSession.createdAt,
            lastActivity: parsedSession.lastActivity,
        };
    }
    res.status(200).json({
        user,

        sessionInfo,
    });
});



export const logOutUser = TryCatch(async (req, res) => {
    const userId = req.user._id
    await revokeRefreshToken(userId)
    res.clearCookie("refreshToken")
    res.clearCookie("accessToken")
    res.clearCookie("csrfToken")
    await redisClint.del(`user:${userId}`)
    res.json({
        message: "Logged out successfully"
    })
})