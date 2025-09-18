const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  purchaseCode: { type: String, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  purchaseDate: { type: Date, default: Date.now },
  items: [itemSchema],
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft','Ordered','Received','Cancelled'], default: 'Draft' },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
