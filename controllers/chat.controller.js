import { ChatMessage } from "../models/chatMessage.model.js";
import { Conversation } from "../models/conversation.model.js";
import { getIO } from "../socket/chat.socket.js"; // socket instance

// ─────────────────────────────────────────────
// Customer: নতুন মেসেজ পাঠাবে
// POST /api/chat/send
// ─────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const senderId = req.user._id; // auth middleware থেকে আসবে
    const senderRole = req.user.role;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // Conversation খোঁজো অথবা নতুন বানাও
    let conversation;

    if (senderRole === "customer") {
      // Customer নিজের conversation খুঁজবে
      conversation = await Conversation.findOne({ customerId: senderId });

      if (!conversation) {
        // প্রথমবার message, নতুন conversation তৈরি
        conversation = await Conversation.create({
          customerId: senderId,
          lastMessage: message,
          unreadCount: 1,
        });
      } else {
        // Existing conversation update করো
        conversation.lastMessage = message;
        conversation.unreadCount += 1;
        await conversation.save();
      }
    } else {
      // Admin reply করছে - conversationId body তে পাঠাতে হবে
      const { conversationId } = req.body;
      conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      conversation.lastMessage = message;
      conversation.adminId = senderId;
      await conversation.save();
    }

    // নতুন মেসেজ save করো
    const newMessage = await ChatMessage.create({
      sender: senderId,
      senderRole,
      message,
      conversationId: conversation._id.toString(),
    });

    // Socket দিয়ে real-time এ পাঠাও
    const io = getIO();
    io.to(conversation._id.toString()).emit("newMessage", {
      _id: newMessage._id,
      message: newMessage.message,
      senderRole: newMessage.senderRole,
      createdAt: newMessage.createdAt,
      conversationId: newMessage.conversationId,
    });

    // Admin কে notify করো (নতুন customer message এলে)
    if (senderRole === "customer") {
      io.to("admin-room").emit("newCustomerMessage", {
        conversationId: conversation._id,
        customerId: senderId,
        message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Message sent",
      data: newMessage,
    });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// একটি conversation এর সব মেসেজ দেখাও
// GET /api/chat/messages/:conversationId
// ─────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 }) // পুরনো থেকে নতুন
      .lean();

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("getMessages error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// Customer নিজের conversation দেখবে
// GET /api/chat/my-conversation
// ─────────────────────────────────────────────
export const getMyConversation = async (req, res) => {
  try {
    const customerId = req.user._id;

    let conversation = await Conversation.findOne({ customerId }).lean();

    if (!conversation) {
      return res.status(200).json({
        success: true,
        data: null, // এখনো কোনো conversation নেই
      });
    }

    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("getMyConversation error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// Admin: সব customer conversation দেখবে
// GET /api/chat/admin/conversations
// ─────────────────────────────────────────────
export const getAllConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ isActive: true })
      .populate("customerId", "name email avatar") // customer এর নাম, email দেখাবে
      .sort({ updatedAt: -1 }) // সর্বশেষ active আগে
      .lean();

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("getAllConversations error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// Admin: মেসেজ পড়া হয়েছে mark করো
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
    console.error("markAsRead error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};