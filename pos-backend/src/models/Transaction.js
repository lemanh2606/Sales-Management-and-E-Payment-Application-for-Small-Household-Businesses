const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionCode: { type: String, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['Cash','QR','EWallet','Card','Bank','Credit'], default: 'Cash' },
  transactionDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending','Success','Failed'], default: 'Pending' },
  reference: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  voiceConfirmed: { type: Boolean, default: false },
  voiceConfirmData: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
