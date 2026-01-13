// backend/models/OrderRefund.js
const mongoose = require("mongoose");
 
const orderRefundSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    inventory_voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryVoucher", default: null },
    refundedAt: { type: Date, default: Date.now },
    refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, // null = Chủ cửa hàng xử lý
    refundedByName: { type: String, default: "Chủ cửa hàng" }, // Snapshot tên để hiển thị
    refundTransactionId: { type: String, default: null }, // nếu có, mà chắc đéo có đâu
    refundReason: { type: String, maxlength: 500, required: true },
    refundAmount: { type: mongoose.Schema.Types.Decimal128, required: true }, // tổng số tiền hoàn
    refundItems: [
      //chi tiết từng mặt hàng được hoàn
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true },
        priceAtTime: { type: mongoose.Schema.Types.Decimal128, required: true },
        subtotal: { type: mongoose.Schema.Types.Decimal128, required: true },
      },
    ],
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
