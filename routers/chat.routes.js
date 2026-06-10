import express from "express";
import {
  sendMessage,
  getMessages,
  getMyConversation,
  getAllConversations,
  markAsRead,
} from "../controllers/chat.controller.js";
import { isAuth, authorizeAdmin } from "../middlewares/isAuth.js"; 
// তোমার existing auth middleware ব্যবহার করো

const chatRouter = express.Router();

// ── Customer Routes ──────────────────────────

// মেসেজ পাঠাও (customer এবং admin দুজনেই ব্যবহার করবে)
chatRouter.post("/send", isAuth, sendMessage);

// Customer নিজের conversation দেখবে
chatRouter.get("/my-conversation", isAuth, getMyConversation);

// একটি conversation এর সব message দেখো
chatRouter.get("/messages/:conversationId", isAuth, getMessages);

// ── Admin Routes ─────────────────────────────

// সব customer conversation দেখো (admin only)
chatRouter.get("/admin/conversations", isAuth, authorizeAdmin, getAllConversations);

// মেসেজ read করা mark করো (admin only)
chatRouter.patch("/admin/read/:conversationId", isAuth, authorizeAdmin, markAsRead);

export default chatRouter;