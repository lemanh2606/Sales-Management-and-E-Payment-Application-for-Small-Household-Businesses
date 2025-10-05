const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
salary: { type: mongoose.Schema.Types.Decimal128, required: true },
shift: { type: String, maxlength: 50 },
commission_rate: { type: mongoose.Schema.Types.Decimal128 },
hired_date: { type: Date, default: Date.now },
user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
});

module.exports = mongoose.model('Employee', employeeSchema);