// models/Store.js
const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },

    // Chủ cửa hàng (người tạo / quản lý chính)
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Mô tả cửa hàng
    description: { type: String, default: "", trim: true },

    // Ảnh đại diện / banner cửa hàng
    imageUrl: { type: String, default: "" },

    // Cờ đánh dấu cửa hàng mặc định
    isDefault: { type: Boolean, default: false },

    // Soft delete (ẩn thay vì xóa vĩnh viễn)
    deleted: { type: Boolean, default: false },

    // Người phụ trách / nhân viên (tùy chọn)
    staff_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Các tag / phân loại (ví dụ: "cà phê", "ăn vặt", "bán lẻ")
    tags: [{ type: String, trim: true }],

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
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
  }
);

// Index để tìm kiếm nhanh
storeSchema.index({ name: "text", address: "text", tags: "text" });

module.exports = mongoose.model("Store", storeSchema);
