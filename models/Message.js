import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, required: true },   // sender's email
    receiver: { type: String, required: true }, // receiver's email
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

export default mongoose.model("Message", messageSchema);
