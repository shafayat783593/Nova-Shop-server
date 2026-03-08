import jwt from "jsonwebtoken";
import { redisClint } from "../index.js";
import { httpUrl } from "zod";
import { generateCSRFToken, revokeCSRFTOKEN } from "../middlewares/csrfMiddleware.js";
import crypto from "crypto";
export const generateToken = async (id, res) => {
    const sessionId = crypto.randomBytes(16).toString("hex");

    const accessToken = jwt.sign(
        { id, sessionId },
        process.env.JWT_SECRET,
        { expiresIn: "1m" }
    );

    const refreshToken = jwt.sign(
        { id, sessionId },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" }
    );

    const refreshTokenKey = `refreshToken:${id}`;
    const activeSessionKey = `activeSession:${id}`;
    const sessionDatakey = `session:${sessionId}`;
    const existingsessions = await redisClint.get(activeSessionKey);
    if (existingsessions) {
        await redisClint.del(`session:${existingsessions}`);
        await redisClint.del(refreshToken)

    }
    const sessionData = {
        userId: id,
        sessionId: sessionId,
        createdAt: Date.now().toString(),
        lastActivity: new Date().toISOString(),
    }


    await redisClint.setEx(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken);
    await redisClint.setEx(sessionDatakey, 7 * 24 * 60 * 60, JSON.stringify(sessionData));
    await redisClint.setEx(activeSessionKey, 7 * 24 * 60 * 60, sessionId);
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const csrfToken = await generateCSRFToken(id, res);

    return { accessToken, refreshToken, csrfToken, sessionId };
};



export const verifyRefreshToken = async (refreshToken) => {
    try {
        console.log("veri refreshtoken", refreshToken)
        const userData = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        console.log("userData", userData)
        const storedToken = await redisClint.get(`refreshToken:${userData.id}`);

        if (storedToken !== refreshToken) {
            return null;
        }
        const acitveSessionId = await redisClint.get(`activeSession:${userData.id}`);
        if (acitveSessionId !== userData.sessionId) {
            return null;
        }
        const sessionData = await redisClint.get(`session:${userData.sessionId}`);
        if (!sessionData) {
            return null;
        }
        const parsedSessionData = JSON.parse(sessionData);
        parsedSessionData.lastActivity = new Date().toISOString();
        await redisClint.setEx(`session:${userData.sessionId}`, 7 * 24 * 60 * 60, JSON.stringify(parsedSessionData));
        return userData;
    } catch (error) {
        return null;
    }
};


export const genetateAccessToken = (id, sessionId, res) => {
    const accessToken = jwt.sign({ id, sessionId }, process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );

    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 1 * 60 * 1000,
    });

    return accessToken;
};

export const revokeRefreshToken = async (userId) => {
    const activeSessionId = await redisClint.get(`activeSession:${userId}`);
    await redisClint.del(`refreshToken:${userId}`)
    if (activeSessionId) {
        await redisClint.del(`session:${activeSessionId}`);
    }
    await redisClint.del(`activeSession:${userId}`);
    await revokeCSRFTOKEN(userId);

}

export const isSessionActive = async (userId, sessionId) => {
    const activeSessionId = await redisClint.get(`activeSession:${userId}`);
    return activeSessionId === sessionId;
}