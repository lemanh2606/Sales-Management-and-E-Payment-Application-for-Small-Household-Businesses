// backend/models/Supplier.js
const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 150 }, // Tên NCC
    phone: { type: String, maxlength: 20 },
    email: { type: String, maxlength: 100 },
    address: { type: String, maxlength: 500 },
    taxcode: { type: String, maxlength: 50 }, // Mã số thuế
    contact_person: { type: String, maxlength: 150 }, // Người liên hệ chính
    bank_name: { type: String, maxlength: 150 }, // Ngân hàng
    bank_account_no: { type: String, maxlength: 50 }, // Số TK
    bank_account_name: { type: String, maxlength: 150 }, // Chủ TK
    notes: { type: String, maxlength: 1000 },
    status: {
      type: String,
      enum: ["đang hoạt động", "ngừng hoạt động"],
      default: "đang hoạt động",
    },
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Default: hide deleted. Allow bypass via query option { withDeleted: true }
supplierSchema.pre(/^find/, function (next) {
  const opts = this.getOptions?.() || {};
  if (opts.withDeleted) return next();

  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

supplierSchema.pre("save", function (next) {
  if (this.isDeleted === undefined || this.isDeleted === null) {
    this.isDeleted = false;
  }
  next();
});

module.exports = mongoose.model("Supplier", supplierSchema);
