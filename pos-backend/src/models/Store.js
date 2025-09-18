const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  storeCode: { type: String, unique: true },
  storeName: { type: String, required: true },
  address: String,
  phone: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Store', storeSchema);
