// models/Product.js (xóa alertCount không dùng, giữ lowStockAlerted + pre-save hook reset - paste thay schema)
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 150, trim: true },
    description: { type: String, maxlength: 500, trim: true },
    sku: { type: String, maxlength: 100, trim: true }, // Mã SKU sản phẩm - unique per store
    price: { type: mongoose.Schema.Types.Decimal128, required: true },
    cost_price: { type: mongoose.Schema.Types.Decimal128, required: true },
    stock_quantity: { type: Number, required: true, default: 0 },
    min_stock: { type: Number, default: 0 }, // Tồn kho tối thiểu
    max_stock: { type: Number, default: null }, // Tồn kho tối đa
    unit: { type: String, maxlength: 50, trim: true },
    status: {
      type: String,
      enum: ["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"],
      default: "Đang kinh doanh",
    }, // Trạng thái sản phẩm
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: "ProductGroup" }, // Nhóm sản phẩm
    image: {
      url: { type: String, default: null }, // Cloudinary URL
      public_id: { type: String, default: null }, // Cloudinary public_id for deletion
    },
    lowStockAlerted: { type: Boolean, default: false }, // False = không báo, true = báo (reset về false khi update stock > min_stock)
    isDeleted: { type: Boolean, default: false }, // Xóa mềm
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
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

// Index compound cho SKU unique per store
productSchema.index({ sku: 1, store_id: 1 }, { unique: true });

// Index cho query low stock nhanh
productSchema.index({
  stock_quantity: 1,
  min_stock: 1,
  status: 1,
  lowStockAlerted: 1,
});

module.exports = mongoose.model("Product", productSchema);
