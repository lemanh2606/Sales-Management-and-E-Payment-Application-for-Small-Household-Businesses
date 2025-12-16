// backend/models/StockCheck.js
const mongoose = require('mongoose');

// Schema cho item trong phiếu kiểm kho
const stockCheckItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Mã hàng
  product_name: { type: String, required: true, maxlength: 150, trim: true }, // Tên hàng (lưu snapshot)
  book_quantity: { type: Number, required: true, default: 0 }, // Tồn kho (theo sổ sách)
  actual_quantity: { type: Number, required: true, default: 0 }, // Thực tế (kiểm đếm)
  cost_price: { type: mongoose.Schema.Types.Decimal128, required: true }, // Giá vốn để tính giá trị lệch
  price: { type: mongoose.Schema.Types.Decimal128, required: true } // Giá bán
}, { _id: false });

const stockCheckSchema = new mongoose.Schema({
  check_code: { type: String, required: true, unique: true, maxlength: 50, trim: true }, // Mã kiểm kho
  check_date: { type: Date, required: true }, // Thời gian kiểm kho
  balance_date: { type: Date }, // Ngày cân bằng kho (khi status = "Đã cân bằng")
  notes: { type: String, maxlength: 1000, trim: true }, // Ghi chú
  status: { type: String, enum: ['phiếu tạm', 'Đã cân bằng'], default: 'phiếu tạm' }, // Trạng thái
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }, // Cửa hàng
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người tạo phiếu
  items: [stockCheckItemSchema], // Danh sách hàng hóa được kiểm
  isDeleted: { type: Boolean, default: false } // Xóa mềm
}, {
  timestamps: true, // Tự động tạo createdAt và updatedAt
  collection: 'stock_checks'
});

// Tạo index để tìm kiếm nhanh (check_code đã có unique index)
stockCheckSchema.index({ store_id: 1, status: 1 });
stockCheckSchema.index({ created_by: 1 });
stockCheckSchema.index({ check_date: -1 });

// Middleware: Tự động thêm isDeleted = false cho documents không có field này
stockCheckSchema.pre(/^find/, function(next) {
  // Chỉ áp dụng filter nếu query chưa có điều kiện isDeleted
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});
// Middleware: Đảm bảo isDeleted được set khi save document cũ
stockCheckSchema.pre('save', function(next) {
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

// Middleware để tự động cập nhật balance_date khi status chuyển thành 'Đã cân bằng'
stockCheckSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'Đã cân bằng' && !this.balance_date) {
    this.balance_date = new Date();
  }
  // Đảm bảo isDeleted được set khi save document cũ
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

module.exports = mongoose.model('StockCheck', stockCheckSchema);