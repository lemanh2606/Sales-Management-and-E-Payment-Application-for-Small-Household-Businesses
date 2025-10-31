// backend/models/StockDisposal.js
const mongoose = require('mongoose');

// Schema cho item trong phiếu xuất hủy
const stockDisposalItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Sản phẩm xuất hủy
  quantity: { type: Number, required: true, min: 1 }, // Số lượng xuất hủy
  unit_cost_price: { type: mongoose.Schema.Types.Decimal128, required: true } // Giá vốn tại thời điểm xuất hủy
}, { _id: false });

const stockDisposalSchema = new mongoose.Schema({
  disposal_code: { type: String, required: true, unique: true, maxlength: 50, trim: true }, // Mã xuất hủy
  disposal_date: { type: Date, required: true }, // Thời gian xuất hủy
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người xuất hủy (tạo phiếu)
  note: { type: String, maxlength: 1000, trim: true }, // Ghi chú
  status: { type: String, enum: ['phiếu tạm', 'hoàn thành'], default: 'phiếu tạm' }, // Trạng thái
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }, // Cửa hàng
  items: [stockDisposalItemSchema], // Danh sách sản phẩm xuất hủy
  isDeleted: { type: Boolean, default: false } // Xóa mềm
}, {
  timestamps: true, // Tự động tạo createdAt (thời gian tạo) và updatedAt (thời gian cập nhật)
  collection: 'stock_disposals'
});

// Tạo index để tìm kiếm nhanh
stockDisposalSchema.index({ store_id: 1, status: 1 });
stockDisposalSchema.index({ created_by: 1 });
stockDisposalSchema.index({ disposal_date: -1 });

// Middleware: Tự động thêm isDeleted = false cho documents không có field này
stockDisposalSchema.pre(/^find/, function(next) {
  // Chỉ áp dụng filter nếu query chưa có điều kiện isDeleted
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

// Middleware: Đảm bảo isDeleted được set khi save document cũ
stockDisposalSchema.pre('save', function(next) {
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

module.exports = mongoose.model('StockDisposal', stockDisposalSchema);