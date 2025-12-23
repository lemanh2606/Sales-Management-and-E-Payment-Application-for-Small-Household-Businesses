// backend/models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 150, trim: true },
    description: { type: String, maxlength: 500, trim: true },
    sku: { type: String, maxlength: 100, trim: true },
    price: { type: mongoose.Schema.Types.Decimal128, required: true },
    cost_price: { type: mongoose.Schema.Types.Decimal128, required: true },
    stock_quantity: { type: Number, required: true, default: 0 },
    min_stock: { type: Number, default: 0 },
    max_stock: { type: Number, default: null },
    unit: { type: String, maxlength: 50, trim: true },
    status: {
      type: String,
      enum: ["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"],
      default: "Đang kinh doanh",
    },

    // ===== Cửa hàng & kho =====
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    /**
     * Kho mặc định của sản phẩm (khi tạo phiếu nhập auto chọn)
     * Có thể null => dùng default_warehouse_id của Store
     */
    default_warehouse_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    // Snapshot tên kho mặc định tại thời điểm gán (phòng sau này đổi tên kho)
    default_warehouse_name: {
      type: String,
      trim: true,
      default: "",
    },

    // ===== Liên kết NCC & nhóm =====
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductGroup" },

    image: {
      url: { type: String, default: null },
      public_id: { type: String, default: null },
    },

    lowStockAlerted: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook reset lowStockAlerted nếu stock > min_stock khi update
productSchema.pre("save", function (next) {
  if (
    this.isModified("stock_quantity") &&
    this.stock_quantity > this.min_stock
  ) {
    this.lowStockAlerted = false; // Reset cảnh báo nếu stock tăng > min_stock
  }
  // Đảm bảo isDeleted được set khi save document cũ
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

// Middleware: Tự động thêm isDeleted = false cho documents không có field này
productSchema.pre(/^find/, function (next) {
  // Chỉ áp dụng filter nếu query chưa có điều kiện isDeleted
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

// Index compound để đảm bảo SKU unique trong phạm vi cửa hàng
productSchema.index(
  { store_id: 1, sku: 1 },
  { unique: true, name: "store_sku_unique" }
);
productSchema.index({
  stock_quantity: 1,
  min_stock: 1,
  status: 1,
  lowStockAlerted: 1,
});

module.exports = mongoose.model("Product", productSchema);
