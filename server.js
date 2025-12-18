// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // allow all origins for now (safe in dev)
});

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serve your frontend files


// --- Connect to MongoDB ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Test Route ---
app.get("/api", (req, res) => {
  res.json({ message: "Server is running successfully!" });
});




app.get("/api/conversations", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    // Get unique users from messages involving this user
    const messages = await Message.find({
      $or: [{ sender: email }, { receiver: email }],
    });

    const users = new Set();
    messages.forEach((msg) => {
      if (msg.sender !== email) users.add(msg.sender);
      if (msg.receiver !== email) users.add(msg.receiver);
    });

    res.json([...users]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// --- Socket.IO basic setup ---
import jwt from "jsonwebtoken";
import Message from "./models/Message.js";
import User from "./models/User.js";

const JWT_SECRET = process.env.JWT_SECRET;

// --- Map to track online users ---
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  // Expect the client to immediately send its token after connecting
  socket.on("authenticate", (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      onlineUsers.set(decoded.email, socket.id);
      socket.user = decoded.email;
      console.log(`✅ ${decoded.email} authenticated`);
    } catch (err) {
      console.log("❌ Invalid token:", err.message);
      socket.disconnect();
    }
  });

  // Handle incoming messages
  socket.on("sendMessage", async (data) => {
    const { receiver, content } = data;
    const sender = socket.user;
    if (!sender) return;

    // Save the message in MongoDB
    const message = new Message({ sender, receiver, content });
    await message.save();

    // If the receiver is online, send it instantly
    const receiverSocket = onlineUsers.get(receiver);
    if (receiverSocket) {
      io.to(receiverSocket).emit("receiveMessage", message);
    }
  });

  // Provide chat history
  socket.on("getMessages", async (receiverEmail, callback) => {
    const sender = socket.user;
    const messages = await Message.find({
      $or: [
        { sender, receiver: receiverEmail },
        { sender: receiverEmail, receiver: sender },
      ],
    }).sort({ createdAt: 1 });
    callback(messages);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
    onlineUsers.delete(socket.user);
  });
});


import authRoutes from "./routes/auth.js";
app.use("/api/auth", authRoutes);

// --- Start Server ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
