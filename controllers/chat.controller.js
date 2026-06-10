import { ChatMessage } from "../models/chatMessage.model.js";
import { Conversation } from "../models/conversation.model.js";
import { getIO } from "../socket/socket.js";

// ─────────────────────────────────────────────
// Customer/Admin: মেসেজ পাঠাবে
// POST /api/chat/send
// ─────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const senderId = req.user._id;
    const senderRole = req.user.role;

    if (!message || message.trim() === "") {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    let conversation;

    if (senderRole === "customer") {
      conversation = await Conversation.findOne({ customerId: senderId });

      if (!conversation) {
        conversation = await Conversation.create({
          customerId: senderId,
          lastMessage: message,
          unreadCount: 1,
        });
      } else {
        conversation.lastMessage = message;
        conversation.unreadCount += 1;
        await conversation.save();
      }
    } else {
      if (!conversationId) {
        return res.status(400).json({ success: false, message: "conversationId is required for admin" });
      }
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ success: false, message: "Conversation not found" });
      }
      conversation.lastMessage = message;
      conversation.adminId = senderId;
      await conversation.save();
    }

    const newMessage = await ChatMessage.create({
      sender: senderId,
      senderRole,
      message,
      conversationId: conversation._id.toString(), // ✅ string
    });

    // ✅ Response আগে পাঠাও — তাহলে client আগে room join করতে পারবে
    // কিন্তু এখানে আমরা response পাঠানোর আগেই emit করছি
    // সমাধান: emit এ সঠিক string roomId ব্যবহার করো
    const roomId = conversation._id.toString(); // ✅ একবার string করো

    try {
      const io = getIO();

      const messagePayload = {
        _id: newMessage._id.toString(),
        message: newMessage.message,
        senderRole: newMessage.senderRole,
        createdAt: newMessage.createdAt,
        conversationId: roomId,
      };

      // ✅ Room এ emit
      io.to(roomId).emit("newMessage", messagePayload);

      if (senderRole === "customer") {
        io.to("admin-room").emit("newCustomerMessage", {
          conversationId: roomId,
          customerId: senderId.toString(),
          lastMessage: message,
        });
      }
    } catch (socketErr) {
      console.error("Socket emit error:", socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: {
        _id: newMessage._id.toString(),
        message: newMessage.message,
        senderRole: newMessage.senderRole,
        createdAt: newMessage.createdAt,
        conversationId: roomId,
      },
      conversationId: roomId, // ✅ string হিসেবে পাঠাও
    });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// একটি conversation এর সব message
// GET /api/chat/messages/:conversationId
// ─────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// Customer নিজের conversation
// GET /api/chat/my-conversation
// ─────────────────────────────────────────────
export const getMyConversation = async (req, res) => {
  try {
    const customerId = req.user._id;
    const conversation = await Conversation.findOne({ customerId }).lean();
    return res.status(200).json({ success: true, data: conversation || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// Admin: সব customer conversation
// GET /api/chat/admin/conversations
// ─────────────────────────────────────────────
export const getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ isActive: true })
      .populate("customerId", "name email avatar")
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
// ─────────────────────────────────────────────
// Admin: read mark করো
// PATCH /api/chat/admin/read/:conversationId
// ─────────────────────────────────────────────
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    await Conversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });
    await ChatMessage.updateMany(
      { conversationId, senderRole: "customer" },
      { isRead: true }
    );
    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};