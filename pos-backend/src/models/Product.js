const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: { type: String, default: null },
  barcode: { type: String, default: null },
  name: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
  costPrice: { type: Number, default: 0 },
  sellPrice: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
