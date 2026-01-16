//backend/models/Warehouse.js
const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    // ===== Thông tin cơ bản =====
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },

    code: { type: String, required: true, trim: true }, // VD: WH001, WH_MAIN
    name: { type: String, required: true, trim: true }, // VD: Kho chính, Kho chi nhánh
    description: { type: String, trim: true, default: "" },

    // ===== Vị trí địa lý =====
    address: { type: String, trim: true, default: "" },
    ward: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "Việt Nam" },
    postal_code: { type: String, trim: true, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    // ===== Thông tin liên hệ =====
    contact_person: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },

    // ===== Thông tin đặc tính kho =====
    warehouse_type: {
      type: String,
      //kho thường, kho đồ lạnh, kho hàng nguy hiểm, kho hàng giá trị cao, kho khác
      enum: ["normal", "cold_storage", "hazardous", "high_value", "other"],
      default: "normal",
    },
    capacity: { type: Number, default: null },
    capacity_unit: {
      type: String,
      // Đơn vị sức chứa kho:
      // m3: mét khối | m2: mét vuông | pallet: số pallet | items: số item | kg: khối lượng
      enum: ["m3", "m2", "pallet", "items", "kg"],
      default: "m3",
    },
    current_capacity_used: { type: Number, default: 0 },

    // ===== Cấu trúc kho =====
    zones: [
      {
        code: String,
        name: String,
        description: String,
        isActive: { type: Boolean, default: true },
      },
    ],

    racks: [
      {
        code: String,
        zone: String,
        level: Number,
        position: String,
        isActive: { type: Boolean, default: true },
      },
    ],

    // ===== Thông tin quản lý =====
    status: {
      type: String,
      // active: hoạt động | inactive: tạm ngưng | maintenance: bảo trì | archived: lưu trữ (không dùng nữa)
      enum: ["active", "inactive", "maintenance", "archived"],
      default: "active",
    },
    is_default: { type: Boolean, default: false },

    opening_hours: {
      monday_from: String,
      monday_to: String,
      tuesday_from: String,
      tuesday_to: String,
      wednesday_from: String,
      wednesday_to: String,
      thursday_from: String,
      thursday_to: String,
      friday_from: String,
      friday_to: String,
      saturday_from: String,
      saturday_to: String,
      sunday_from: String,
      sunday_to: String,
    },

    // ===== Quản lý tồn kho =====
    allow_negative_stock: { type: Boolean, default: false }, // Cho phép tồn kho âm
    auto_reorder: { type: Boolean, default: false }, // Tự động gợi ý đặt hàng khi tồn thấp
    reorder_point: { type: Number, default: null }, // Ngưỡng tồn kho để gợi ý đặt hàng

    // ===== Chính sách & Quy định =====
    barcode_enabled: { type: Boolean, default: true }, // Sử dụng barcode / QR code
    lot_tracking: { type: Boolean, default: false }, // Theo dõi lô / batch
    expiry_tracking: { type: Boolean, default: false }, // Theo dõi hạn sử dụng
    fifo_enabled: { type: Boolean, default: true }, // Áp dụng FIFO (nhập trước xuất trước)
    require_approval_for_transfer: { type: Boolean, default: false }, // Yêu cầu duyệt khi chuyển kho
    max_items_per_transaction: { type: Number, default: null }, // Giới hạn số item mỗi giao dịch

    // ===== Người quản lý =====
    manager_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ===== Khác =====
    notes: { type: String, trim: true, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: "warehouses",
  }
);

// ===== Indexes =====
warehouseSchema.index({ store_id: 1, code: 1 }, { unique: true }); // code unique per store
warehouseSchema.index({ store_id: 1, status: 1 });
warehouseSchema.index({ store_id: 1, is_default: 1 });
warehouseSchema.index({ isDeleted: 1 });
warehouseSchema.index({ createdAt: -1 });

// ===== Virtual: Full Address =====
warehouseSchema.virtual("full_address").get(function () {
  const parts = [];
  if (this.address) parts.push(this.address);
  if (this.ward) parts.push(this.ward);
  if (this.district) parts.push(this.district);
  if (this.city) parts.push(this.city);
  if (this.country) parts.push(this.country);
  return parts.join(", ");
});

// ===== Pre-save: Validate =====
warehouseSchema.pre("save", async function (next) {
  // Nếu set is_default = true, unset các warehouse khác trong store
  if (this.is_default && !this.isDeleted) {
    const Warehouse = mongoose.model("Warehouse");
    await Warehouse.updateMany(
      {
        store_id: this.store_id,
        _id: { $ne: this._id },
      },
      { is_default: false }
    );
  }
  next();
});

module.exports = mongoose.model("Warehouse", warehouseSchema);
