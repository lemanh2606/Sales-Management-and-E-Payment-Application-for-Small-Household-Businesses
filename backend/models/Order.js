// backend/models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true }, // Cửa hàng
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true }, // Nhân viên bán
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: false, default: null }, // Khách hàng
    totalAmount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 }, // Tổng tiền
    paymentMethod: { type: String, enum: ["cash", "qr"], required: true }, // Hình thức TT
    paymentRef: { type: String, trim: true }, // Mã giao dịch QR
    qrExpiry: { type: Date, default: null }, // Hết hạn QR 15p (Date.now() + 15*60*1000, chỉ cho qr method, FE countdown)
    status: { type: String, enum: ["pending", "paid", "refunded", "partially_refunded"], default: "pending" }, // Trạng thái
    refundId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRefund", default: null }, // sản phẩm bị hoàn trả
    printDate: { type: Date, default: null }, // Ngày in bill
    printCount: { type: Number, default: 0 }, // Số lần in bill (stock chỉ trừ lần 1, khách muốn in lại hoá đơn làm kỉ niệm không trừ nữa)
    isVATInvoice: { type: Boolean, default: false }, // Có xuất hóa đơn VAT không? Đối với doanh nghiệp
    vatInfo: {
      companyName: { type: String, trim: true },
      taxCode: { type: String, trim: true },
      companyAddress: { type: String, trim: true },
    },
    vatAmount: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // VAT thu (lưu sẵn, default 0)
    beforeTaxAmount: { type: mongoose.Schema.Types.Decimal128, default: "0" }, // Tiền trước thuế (lưu sẵn, default 0)
  },
  {
    timestamps: true,
    collection: "orders",
  }
);

// Index nhanh cho report
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ employeeId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
