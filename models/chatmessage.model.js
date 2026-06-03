import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    // কে পাঠিয়েছে
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // কার কাছে পাঠানো হয়েছে (admin হলে null রাখা যাবে)
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // মেসেজের টেক্সট
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // কে পাঠাচ্ছে - customer নাকি admin
    senderRole: {
      type: String,
      enum: ["customer", "admin", "owner"],
      required: true,
    },

    // মেসেজটি পড়া হয়েছে কিনা
    isRead: {
      type: Boolean,
      default: false,
    },

    // কোন conversation এর অংশ
    conversationId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;