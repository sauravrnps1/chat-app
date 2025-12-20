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

const allowedOrigins = [
  "http://localhost:5000", // local
  "http://localhost:3000", // just in case you test locally on 3000
  "https://chat-app-63rs.onrender.com", // your Render domain
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
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
import User from "./models/User.js";
import Message from "./models/Message.js";

// Fetch all users except current user
app.get("/api/users", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentEmail = decoded.email;

    const users = await User.find({}, "email -_id"); // get only email field
    const filteredUsers = users
      .map((u) => u.email)
      .filter((email) => email !== currentEmail);

    res.json(filteredUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/unread", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentEmail = decoded.email;

    const unreadMessages = await Message.aggregate([
      { $match: { receiver: currentEmail, isRead: false } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);

    const unreadMap = {};
    unreadMessages.forEach((u) => (unreadMap[u._id] = u.count));

    res.json(unreadMap);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// --- Socket.IO basic setup ---
import jwt from "jsonwebtoken";


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

  // mark unread messages as read
  await Message.updateMany(
    { sender: receiverEmail, receiver: sender, isRead: false },
    { $set: { isRead: true } }
  );

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
