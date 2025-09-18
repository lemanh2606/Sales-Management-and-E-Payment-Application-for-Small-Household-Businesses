const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  lineDiscount: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderCode: { type: String, unique: true },
  orderType: { type: String, enum: ['Sale','Return'], default: 'Sale' },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  orderDate: { type: Date, default: Date.now },
  items: [orderItemSchema],
  subTotal: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  vatRate: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['Cash','QR','EWallet','Card','Bank','Credit'], default: 'Cash' },
  status: { type: String, enum: ['Draft','Pending','Paid','Cancelled','Returned'], default: 'Draft' },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
