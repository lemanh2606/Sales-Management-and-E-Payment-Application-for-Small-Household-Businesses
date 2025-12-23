const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    // ===== Thông tin cơ bản =====
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      // Mã kho unique trong store
      // VD: WH001, WH_MAIN, WH_BRANCH_01
    },

    name: {
      type: String,
      required: true,
      trim: true,
      // VD: Kho chính, Kho chi nhánh, Kho tạm...
    },

    description: {
      type: String,
      trim: true,
      default: "",
      // Mô tả chi tiết về kho
    },

    // ===== Vị trí địa lý =====
    address: {
      type: String,
      trim: true,
      default: "",
      // VD: 123 Đường Nguyễn Huệ, Q.1, TP.HCM
    },

    ward: {
      type: String,
      trim: true,
      default: "",
      // Phường/xã
    },

    district: {
      type: String,
      trim: true,
      default: "",
      // Quận/huyện
    },

    city: {
      type: String,
      trim: true,
      default: "",
      // Thành phố/tỉnh
    },

    country: {
      type: String,
      trim: true,
      default: "Việt Nam",
      // Quốc gia
    },

    postal_code: {
      type: String,
      trim: true,
      default: "",
      // Mã bưu điện
    },

    latitude: {
      type: Number,
      default: null,
      // Tọa độ GPS (nếu cần)
    },

    longitude: {
      type: Number,
      default: null,
      // Tọa độ GPS (nếu cần)
    },

    // ===== Thông tin liên hệ =====
    contact_person: {
      type: String,
      trim: true,
      default: "",
      // Người quản lý kho
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      // SĐT liên hệ
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      // Email kho
    },

    // ===== Thông tin đặc tính kho =====
    warehouse_type: {
      type: String,
      enum: ["normal", "cold_storage", "hazardous", "high_value", "other"],
      default: "normal",
      // Loại kho: bình thường, lạnh, chất nguy hiểm, giá trị cao, khác
    },

    capacity: {
      type: Number,
      default: null,
      // Sức chứa tối đa (m³ hoặc số lượng item)
    },

    capacity_unit: {
      type: String,
      enum: ["m3", "m2", "pallet", "items", "kg"],
      default: "m3",
      // Đơn vị dung tích
    },

    current_capacity_used: {
      type: Number,
      default: 0,
      // Dung tích hiện đang sử dụng
    },

    // ===== Cấu trúc kho =====
    zones: [
      {
        code: String, // A, B, C...
        name: String, // Khu A, Khu B...
        description: String,
        isActive: { type: Boolean, default: true },
      },
    ],
    // Chia kho thành các khu vực (tuỳ chọn)

    racks: [
      {
        code: String, // Kệ 01, Kệ 02...
        zone: String, // Thuộc khu nào
        level: Number, // Tầng (1, 2, 3...)
        position: String, // VD: A-01-L2 = Khu A, Kệ 01, Tầng 2
        isActive: { type: Boolean, default: true },
      },
    ],
    // Danh sách kệ/vị trí trong kho (tuỳ chọn)

    // ===== Thông tin quản lý =====
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance", "archived"],
      default: "active",
      // Trạng thái: hoạt động, không hoạt động, bảo trì, lưu trữ
    },

    is_default: {
      type: Boolean,
      default: false,
      // Là kho mặc định của cửa hàng
    },

    opening_hours: {
      monday_from: String, // VD: 08:00
      monday_to: String, // VD: 17:00
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
      // Giờ mở cửa theo từng ngày
    },

    // ===== Quản lý tồn kho =====
    allow_negative_stock: {
      type: Boolean,
      default: false,
      // Cho phép tồn âm (nợ hàng)
    },

    auto_reorder: {
      type: Boolean,
      default: false,
      // Tự động gợi ý đặt hàng khi dưới minimum
    },

    reorder_point: {
      type: Number,
      default: null,
      // Điểm gợi ý đặt hàng
    },

    // ===== Chính sách & Quy định =====
    barcode_enabled: {
      type: Boolean,
      default: true,
      // Sử dụng barcode/QR code
    },

    lot_tracking: {
      type: Boolean,
      default: false,
      // Theo dõi lô/số seri
    },

    expiry_tracking: {
      type: Boolean,
      default: false,
      // Theo dõi hạn sử dụng
    },

    fifo_enabled: {
      type: Boolean,
      default: true,
      // Sử dụng phương pháp FIFO (first in first out)
    },

    require_approval_for_transfer: {
      type: Boolean,
      default: false,
      // Yêu cầu phê duyệt khi chuyển kho
    },

    max_items_per_transaction: {
      type: Number,
      default: null,
      // Giới hạn số item trên 1 giao dịch
    },

    // ===== Người quản lý =====
    manager_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        // Danh sách quản lý kho
      },
    ],

    // ===== Khác =====
    notes: {
      type: String,
      trim: true,
      default: "",
      // Ghi chú thêm
    },

    metadata: {
      // Lưu trữ dữ liệu tuỳ chỉnh
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
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
