// models/Store.js
const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    taxCode: { type: String, default: "", trim: true },
    // Chủ cửa hàng (người tạo / quản lý chính)
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "" }, // Ảnh đại diện / banner cửa hàng
    isDefault: { type: Boolean, default: false }, // Cờ đánh dấu cửa hàng mặc định
    deleted: { type: Boolean, default: false }, // Soft delete (ẩn thay vì xóa vĩnh viễn)
    // Người phụ trách / nhân viên (tùy chọn)
    staff_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tags: [{ type: String, trim: true }], // Các tag / phân loại (ví dụ: "cà phê", "ăn vặt", "bán lẻ")
    // Tọa độ để sau này dễ tích hợp bản đồ
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Thời gian hoạt động (tùy chọn)
    openingHours: {
      open: { type: String, default: "" }, // "08:00"
      close: { type: String, default: "" }, // "22:00"
    },
    // Thêm 2 field này vào Store schema:
    default_warehouse_id: { type: mongoose.Schema.Types.ObjectId, ref: "Warehouse", default: null },
    default_warehouse_name: { type: String, trim: true, default: "Kho mặc định" },
    default_warehouse_location: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Index để tìm kiếm nhanh
storeSchema.index({ name: "text", address: "text", tags: "text" });
storeSchema.index({ owner_id: 1, isDefault: 1, deleted: 1 });
storeSchema.index({ default_warehouse_id: 1 });
storeSchema.index({ staff_ids: 1, deleted: 1 });
storeSchema.index({ owner_id: 1, deleted: 1 });

module.exports = mongoose.model("Store", storeSchema);
