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

/**
 * ========================= 💡 VÍ DỤ THỰC TẾ: HỆ THỐNG TÍCH ĐIỂM =========================
 * 
 * 👉 Mục đích:
 *   - Giúp cửa hàng ghi nhận và tri ân khách hàng thân thiết.
 *   - Mỗi cửa hàng (store) có thể tự cài đặt tỉ lệ tích điểm & quy đổi điểm riêng.
 * 
 * ---------------------------------------------------------------------------------------
 * 🔹 1. Tích điểm:
 *   - Khi khách mua hàng, hệ thống sẽ cộng điểm dựa trên công thức:
 *        earnedPoints = totalAmount * pointsPerVND
 * 
 *   - Ví dụ: Cấu hình mặc định là 20.000đ = 1 điểm
 *        → pointsPerVND = 1 / 20000
 *        → Nếu khách mua đơn hàng trị giá 200.000đ
 *        → earnedPoints = 200.000 * (1 / 20000) = 10 điểm
 * 
 *   - Khi lưu Order, hệ thống sẽ:
 *        + Tìm customer theo số điện thoại
 *        + Tăng customer.loyaltyPoints += earnedPoints
 *        + Tăng customer.totalOrders += 1
 *        + Cộng dồn customer.totalSpent += totalAmount
 * 
 * ---------------------------------------------------------------------------------------
 * 🔹 2. Quy đổi điểm thành giảm giá:
 *   - Khi khách quay lại, họ có thể sử dụng điểm để giảm giá trực tiếp.
 *   - Hệ thống lấy tỉ lệ quy đổi vndPerPoint (mặc định 1 điểm = 200đ) - có thể chỉnh giá
 *        → discountAmount = usedPoints * vndPerPoint
 * 
 *   - Ví dụ:
 *        Khách có 100 điểm, muốn dùng 50 điểm
 *        → discountAmount = 50 * 200 = 10.000đ
 *        → Đơn hàng mới trị giá 200.000đ → giảm còn 190.000đ
 * 
 * ---------------------------------------------------------------------------------------
 * 🔹 3. Cho phép cửa hàng tự cài đặt:
 *   - Mỗi cửa hàng chỉ có 1 document Loyalty duy nhất (storeId unique).
 *   - Manager có thể chỉnh qua API, ví dụ cái API này, có thể thay API khác nếu quen code
 *        PATCH /api/loyaltys/:storeId
 *        {
 *          "pointsPerVND": 1/10000,  // nghĩa là 10.000đ = 1 điểm
 *          "vndPerPoint": 200,       // nghĩa là 1 điểm = 200đ giảm giá
 *          "minOrderValue": 50000,   // đơn tối thiểu để được tích điểm
 *          "isActive": true
 *        }
 * 
 * ---------------------------------------------------------------------------------------
 * 🔹 4. Tóm tắt lợi ích:
 *   ✅ Giúp khách hàng có động lực quay lại mua nhiều hơn.
 *   ✅ Giúp chủ cửa hàng theo dõi top khách hàng trung thành.
 * 
 * ========================= 🎉 Hệ thống Loyalty – Nhỏ gọn mà Đỉnh 🎉 =========================
 */
