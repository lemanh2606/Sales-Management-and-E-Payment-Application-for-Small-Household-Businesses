const mongoose = require('mongoose');

const productGroupSchema = new mongoose.Schema({
    name: {type: String, required: true, maxlength: 150, trim: true},
    description: {type: String, maxlength: 500, trim: true},
    storeId: {type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true}
}, {
    timestamps: true // Tự động tạo createdAt và updatedAt
});

module.exports = mongoose.model('ProductGroup', productGroupSchema);