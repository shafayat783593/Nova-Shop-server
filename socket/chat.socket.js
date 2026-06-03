import { Server } from "socket.io";

let io; // global io instance

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // ── Customer: নিজের conversation room এ join করো ──
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`User joined room: ${conversationId}`);
    });

    // ── Admin: admin-room এ join করো ──
    socket.on("joinAdminRoom", () => {
      socket.join("admin-room");
      console.log("Admin joined admin-room");
    });

    // ── Admin: একটি specific conversation এ join করো ──
    socket.on("joinConversationAsAdmin", (conversationId) => {
      socket.join(conversationId);
      console.log(`Admin joined conversation: ${conversationId}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

// Controller থেকে io ব্যবহার করার জন্য
export const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};