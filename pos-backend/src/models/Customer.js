const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  customerCode: { type: String, unique: true, sparse: true },
  fullName: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  debt: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('Customer', schema);
