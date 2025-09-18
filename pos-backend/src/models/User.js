const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, enum: ['Owner','Manager','Cashier','Stock','Accountant'], default: 'Cashier' },
  phone: String,
  email: String,
  address: String,
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
