// backend/models/OrderRefund.js
const mongoose = require("mongoose");

const orderRefundSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    inventory_voucher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryVoucher",
      default: null,
    },
    refundedAt: { type: Date, default: Date.now },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    }, // null = Chủ cửa hàng xử lý
    refundedByName: { type: String, default: "Chủ cửa hàng" }, // Snapshot tên để hiển thị
    refundTransactionId: { type: String, default: null }, // nếu có, mà chắc đéo có đâu
    refundReason: { type: String, maxlength: 500, required: true },
    refundAmount: { type: mongoose.Schema.Types.Decimal128, required: true }, // Tiền hoàn thực tế (đã tính tỷ lệ chiết khấu)
    grossRefundAmount: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // Tiền hoàn gốc (chưa trừ chiết khấu)
    discountDeducted: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // Số tiền chiết khấu đã trừ
    refundSubtotal: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // Tiền hàng hoàn (chưa VAT)
    refundVATAmount: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // VAT hoàn
    refundItems: [
      //chi tiết từng mặt hàng được hoàn
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
        priceAtTime: { type: mongoose.Schema.Types.Decimal128, required: true },
        subtotal: { type: mongoose.Schema.Types.Decimal128, required: true },
        vatAmount: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // VAT của sản phẩm hoàn
        unitCost: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // Giá vốn để tính COGS hoàn
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
