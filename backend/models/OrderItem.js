// /backend/models/OrderItem.js - dễ report sản phẩm bán chạy
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }, // Liên kết Order
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true }, // Sản phẩm
    quantity: { type: Number, required: true, min: 1, max: 999 }, // Số lượng
    priceAtTime: { type: mongoose.Schema.Types.Decimal128, required: true }, // Giá lúc bán
    saleType: {
      type: String,
      enum: ["NORMAL", "AT_COST", "VIP", "CLEARANCE", "FREE"], //bán đúng giá niêm yết, bán = giá vốn, Giá ưu đãi, lời ít, Xả kho kiểu hoàn vốn, miễn phí 0đồng
      default: "NORMAL",
    }, // Loại bán hàng
    subtotal: { type: mongoose.Schema.Types.Decimal128, required: true }, // Tiền từng món
  },
  {
    timestamps: true,
    collection: "order_items",
  }
);

// Index nhanh cho report
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 })

module.exports = mongoose.model("OrderItem", orderItemSchema);
