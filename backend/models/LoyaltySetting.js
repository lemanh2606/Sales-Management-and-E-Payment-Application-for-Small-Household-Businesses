const mongoose = require("mongoose");

const loyaltySchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true }, // 🔗 Gắn với cửa hàng cụ thể
    pointsPerVND: { type: Number, default: 1 / 20000, min: 0 }, // 💰 Tỉ lệ tích điểm: Bao nhiêu VNĐ = 1 điểm (mặc định: 20,000 VNĐ = 1 điểm)
    vndPerPoint: { type: Number, default: 100, min: 0 }, // 💵 Tỉ lệ quy đổi ngược: 1 điểm = bao nhiêu VNĐ giảm giá (default: 100đ)
    minOrderValue: { type: Number, default: 0, min: 0 }, // 🧾 Điều kiện tối thiểu: tổng tiền đơn hàng tối thiểu để được tích điểm
    isActive: { type: Boolean, default: true }, // ⚙️ Trạng thái cấu hình (cho phép bật/tắt nhanh)
  },
  {
    timestamps: true,
    collection: "loyalty_settings",
  }
);

loyaltySchema.index({ storeId: 1 }, { unique: true }); // 🧠 Đảm bảo mỗi cửa hàng chỉ có 1 cấu hình loyalty duy nhất

module.exports = mongoose.model("LoyaltySetting", loyaltySchema);