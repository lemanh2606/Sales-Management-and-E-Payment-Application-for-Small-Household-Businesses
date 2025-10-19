// models/OrderItem.js
// Model chi tiết từng món trong hóa đơn — dễ report sản phẩm bán chạy 😎
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }, // Liên kết Order
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // Sản phẩm
    quantity: { type: Number, required: true, min: 1, max: 999 }, // Số lượng
    priceAtTime: { type: mongoose.Schema.Types.Decimal128, required: true }, // Giá lúc bán
    subtotal: { type: mongoose.Schema.Types.Decimal128, required: true }, // Tiền từng món
  },
  {
    timestamps: true,
    collection: "order_items",
  }
);

// Index nhanh cho report
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 });

module.exports = mongoose.model("OrderItem", orderItemSchema);
