// models/PaymentHistory.js
const mongoose = require("mongoose");

const paymentHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    transaction_id: { type: String, required: true, trim: true },
    plan_duration: { type: Number, required: true, enum: [1, 3, 6] },
    amount: { type: Number, required: true, min: 0 },
    payment_method: {
      type: String,
      required: true,
      enum: ["PAYOS", "MANUAL", "BANK_TRANSFER"],
      default: "MANUAL",
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "CANCELLED"],
      default: "SUCCESS",
    },
    paid_at: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true, collection: "payment_histories" }
);
paymentHistorySchema.index({ user_id: 1, createdAt: -1 });
paymentHistorySchema.index({ user_id: 1, paid_at: -1 });
paymentHistorySchema.index({ transaction_id: 1 });

module.exports = mongoose.model("PaymentHistory", paymentHistorySchema);
