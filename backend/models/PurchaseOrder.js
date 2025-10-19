const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  discount: { type: Number, default: 0, min: 0 }
}, { 
  _id: false,
  toJSON: { virtuals: false, transform: function(doc, ret) { delete ret.id; return ret; } }
});

const purchaseOrderSchema = new mongoose.Schema({
  purchase_order_code: { type: String, required: true, unique: true }, // Mã nhập hàng tự động theo format NHXXXXXX
  purchase_order_date: { type: Date, default: Date.now, required: true }, // Thời gian tạo đơn
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true }, // Nhà cung cấp
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }, // Cửa hàng
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Người tạo đơn
  total_amount: { type: Number, required: true, min: 0 }, // Tổng tiền cần trả nhà cung cấp
  paid_amount: { type: Number, default: 0, min: 0 }, // Số tiền đã trả nhà cung cấp
  status: { 
    type: String, 
    enum: ['phiếu tạm', 'đã nhập hàng', 'đã hủy'], 
    default: 'phiếu tạm' 
  }, // Trạng thái đơn hàng
  items: [purchaseOrderItemSchema], // Danh sách sản phẩm trong đơn
  notes: { type: String, maxlength: 1000 } // Ghi chú
},
{
  timestamps: true, // Tự động thêm createdAt và updatedAt
  toJSON: { 
    virtuals: true, // Include virtuals khi convert to JSON
    transform: function(doc, ret) {
      delete ret.id; // Remove virtual id field
      delete ret.__v; // Remove version key
      return ret;
    }
  },
  toObject: { virtuals: true }, // Include virtuals khi convert to Object
  collection: 'purchase_orders' 
}
);
// Middleware để xử lý logic trước khi lưu
purchaseOrderSchema.pre('save', function(next) {
  next();
});
// Virtual field để tính tổng tiền từ items (cần populate product để có cost_price)
purchaseOrderSchema.virtual('calculated_total').get(function() {
  return this.items.reduce((total, item) => {
    if (item.product_id && item.product_id.cost_price) {
      const costPrice = parseFloat(item.product_id.cost_price.toString());
      const itemTotal = (item.quantity * costPrice) - item.discount;
      return total + itemTotal;
    }
    return total;
  }, 0);
});


purchaseOrderSchema.virtual('remaining_amount').get(function() {
  return Math.max(0, this.total_amount - this.paid_amount);
});

purchaseOrderSchema.methods.calculateTotalFromItems = function() {
  this.total_amount = this.calculated_total;
  return this.total_amount;
};

// Tạo compound index để purchase_order_code unique trong từng store
purchaseOrderSchema.index({ store_id: 1, purchase_order_code: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);