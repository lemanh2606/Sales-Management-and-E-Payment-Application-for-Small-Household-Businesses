// /backend/models/OrderItem.js - dễ report sản phẩm bán chạy
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    }, // Liên kết Order
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    }, // Sản phẩm
    quantity: { type: Number, required: true, min: 1 }, // Số lượng
    priceAtTime: { type: mongoose.Schema.Types.Decimal128, required: true }, // Giá lúc bán
    saleType: {
      type: String,
      enum: ["NORMAL", "AT_COST", "VIP", "CLEARANCE", "FREE"], //bán đúng giá niêm yết, bán = giá vốn, Giá ưu đãi, lời ít, Xả kho kiểu hoàn vốn, miễn phí 0đồng
      default: "NORMAL",
    }, // Loại bán hàng
    subtotal: { type: mongoose.Schema.Types.Decimal128, required: true }, // Tiền từng món (chưa bao gồm VAT riêng của dòng này nếu tính tách)
    tax_rate: { type: Number, default: 0 }, // % thuế của sản phẩm tại thời điểm bán
    vat_amount: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Tiền thuế của dòng này
    refundedQuantity: { type: Number, default: 0 }, // Số lượng đã hoàn trả
    cost_price_snapshot: { type: Number, default: 0 }, //  MỚI: Giá vốn lúc bán để tính COGS
    //  MỚI: Chi tiết lô hàng đã xuất cho item này
    batch_details: [
      {
        batch_no: { type: String },
        quantity: { type: Number }, // Số lượng lấy từ lô này
        cost_price: { type: Number }, // Giá vốn của lô này tại thời điểm bán
      },
    ],
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
