const mongoose = require("mongoose");

const orderRefundSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    refundedAt: { type: Date, default: Date.now },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    refundTransactionId: { type: String, default: null }, // nếu có, mà chắc đéo có đâu
    refundReason: { type: String, maxlength: 500, required: true },
    evidenceMedia: [
      {
        url: String,
        type: { type: String, enum: ["image", "video"], default: "image" },
        public_id: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: "order_refunds",
  }
);

module.exports = mongoose.model("OrderRefund", orderRefundSchema);
