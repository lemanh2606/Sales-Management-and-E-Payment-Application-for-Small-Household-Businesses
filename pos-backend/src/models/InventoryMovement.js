const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  quantity: { type: Number, required: true },
  movementType: { type: String, enum: ['Sale','Purchase','ReturnIn','ReturnOut','Adjustment','TransferIn','TransferOut'], required: true },
  referenceCode: String,
  moveDate: { type: Date, default: Date.now },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryMovement', schema);
