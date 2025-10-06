const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
name: { type: String, required: true, maxlength: 150 },
phone: { type: String, maxlength: 20 },
email: { type: String, maxlength: 100 },
address: { type: String, maxlength: 500 },
store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true }
},
{
  timestamps: true, // tự động thêm createdAt và updatedAt
}
);

module.exports = mongoose.model('Supplier', supplierSchema);