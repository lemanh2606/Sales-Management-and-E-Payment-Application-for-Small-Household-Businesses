const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 150, trim: true },
  description: { type: String, maxlength: 500, trim: true },
  sku: { type: String, unique: true, maxlength: 100, trim: true }, // Mã SKU sản phẩm
  price: { type: mongoose.Schema.Types.Decimal128, required: true },
  cost_price: { type: mongoose.Schema.Types.Decimal128, required: true },
  stock_quantity: { type: Number, required: true, default: 0 },
  min_stock: { type: Number, default: 0 }, // Tồn kho tối thiểu
  max_stock: { type: Number, default: null }, // Tồn kho tối đa
  unit: { type: String, maxlength: 50, trim: true },
  status: { 
    type: String, 
    enum: ['Đang kinh doanh', 'Ngừng kinh doanh', 'Ngừng bán'], 
    default: 'Đang kinh doanh' 
  }, // Trạng thái sản phẩm
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductGroup' } // Nhóm sản phẩm
},
{
  timestamps: true // Tự động thêm createdAt và updatedAt
}
);

module.exports = mongoose.model('Product', productSchema);
