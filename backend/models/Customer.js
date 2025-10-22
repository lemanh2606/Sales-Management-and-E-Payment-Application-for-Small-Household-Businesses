// models/Customer.js
const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    loyaltyPoints: { type: Number, default: 0 }, // 🎁 Tổng điểm hiện có
    totalSpent: { type: mongoose.Schema.Types.Decimal128, default: 0.0 }, // 💸 Tổng chi tiêu từ trước tới nay (dễ thống kê)
    totalOrders: { type: Number, default: 0 }, // 🛍️ Tổng số đơn hàng đã mua, không tính số mặt hàng trong đơn
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "customers",
  }
);

// Index cho query nhanh (theo phone cho search, theo name nếu cần)
customerSchema.index({ phone: 1 }, { unique: true }); // Unique phone tránh trùng
customerSchema.index({ name: 1 }); // Index name cho search theo tên

module.exports = mongoose.model("Customer", customerSchema);
