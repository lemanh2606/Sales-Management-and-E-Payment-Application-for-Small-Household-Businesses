const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
name: { type: String, required: true, maxlength: 150 },
description: { type: String },
price: { type: mongoose.Schema.Types.Decimal128, required: true },
cost_price: { type: mongoose.Schema.Types.Decimal128, required: true },
stock_quantity: { type: Number, required: true, default: 0 },
unit: { type: String, maxlength: 50 },
created_at: { type: Date, default: Date.now },
store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }
});

module.exports = mongoose.model('Product', productSchema);
