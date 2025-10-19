const mongoose = require('mongoose');

const productGroupSchema = new mongoose.Schema({
    name: {type: String, required: true, maxlength: 150, trim: true},
    description: {type: String, maxlength: 500, trim: true},
    storeId: {type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true},
    isDeleted: { type: Boolean, default: false } // Xóa mềm
}, {
    timestamps: true, // Tự động tạo createdAt và updatedAt
    collection: 'product_groups'
});

// Middleware: Tự động thêm isDeleted = false cho documents không có field này
productGroupSchema.pre(/^find/, function(next) {
    // Chỉ áp dụng filter nếu query chưa có điều kiện isDeleted
    if (this.getQuery().isDeleted === undefined) {
        this.where({ isDeleted: false });
    }
    next();
});

// Middleware: Đảm bảo isDeleted được set khi save document cũ
productGroupSchema.pre('save', function(next) {
    if (this.isDeleted === undefined || this.isDeleted === null) {
        this.isDeleted = false;
    }
    next();
});

module.exports = mongoose.model('ProductGroup', productGroupSchema);