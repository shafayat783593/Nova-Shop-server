import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Customer যে chat শুরু করেছে
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Admin যে reply করছে
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // সর্বশেষ মেসেজ (preview এর জন্য)
    lastMessage: {
      type: String,
      default: "",
    },

    // Admin কতটা unread মেসেজ আছে
    unreadCount: {
      type: Number,
      default: 0,
    },

    // Conversation active আছে কিনা
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;