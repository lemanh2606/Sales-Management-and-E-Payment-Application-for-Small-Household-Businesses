const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 150 },
    phone: { type: String, maxlength: 20 },
    email: { type: String, maxlength: 100 },
    address: { type: String, maxlength: 500 },
    status: { type: String, enum: ["đang hoạt động", "ngừng hoạt động"], default: "đang hoạt động" },
    store_id: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    isDeleted: { type: Boolean, default: false } // Xóa mềm
  },
  {
    timestamps: true, // tự động thêm createdAt và updatedAt
  }
);

// Middleware: Tự động thêm isDeleted = false cho documents không có field này
supplierSchema.pre(/^find/, function(next) {
  // Chỉ áp dụng filter nếu query chưa có điều kiện isDeleted
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

// Middleware: Đảm bảo isDeleted được set khi save document cũ
supplierSchema.pre('save', function(next) {
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

module.exports = mongoose.model("Supplier", supplierSchema);
