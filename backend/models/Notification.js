//backend/models/Notification.js
const mongoose = require("mongoose");

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["order", "payment", "service", "system", "inventory"],
      default: "system",
      index: true, // lọc nhanh theo type
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    read: { type: Boolean, default: false, index: true }, // lọc unread
  },
  { timestamps: true }
);

// Tự động xóa sau 60 ngày
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });
notificationSchema.index({ storeId: 1, read: 1 });
notificationSchema.index({ storeId: 1, type: 1 });


module.exports = mongoose.model("Notification", notificationSchema);
