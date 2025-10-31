// models/ActivityLog.js
const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true, trim: true }, // ở model Employee thì là fullName,
    userRole: { type: String, enum: ["MANAGER", "STAFF"], required: true },
    action: {
      type: String,
      required: true,
      enum: [
        "create",
        "update",
        "delete",
        "restore",
        "other",
      ],
    }, //hành động gì
    entity: { type: String, required: true }, // Đối tượng bị tác động Ví dụ: 'Order', 'Product', 'Store', 'Customer', 'Employee',....
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    entityName: { type: String, required: true },
    description: { type: String }, // ví dụ: "Đã hủy đơn hàng do khách không nhận"
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ user: 1, store: 1, createdAt: -1 });
activityLogSchema.index({ store: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);