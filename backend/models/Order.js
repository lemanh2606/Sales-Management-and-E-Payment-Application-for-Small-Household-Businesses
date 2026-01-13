// backend/models/Order.js
const mongoose = require("mongoose");

const { Schema } = mongoose;

const orderSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true }, // Cửa hàng
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null }, // Nhân viên bán
    customer: { type: Schema.Types.ObjectId, ref: "Customer", default: null }, // Khách hàng

    totalAmount: { type: Schema.Types.Decimal128, required: true, min: 0 }, // Tổng tiền

    paymentMethod: { type: String, enum: ["cash", "qr"], required: true }, // Hình thức TT
    paymentRef: { type: String, trim: true }, // Mã giao dịch QR
    qrExpiry: { type: Date, default: null }, // Hết hạn QR (15p)

    status: {
      type: String,
      enum: ["pending", "paid", "refunded", "partially_refunded", "cancelled"],
      default: "pending",
    }, // Trạng thái

    refundId: { type: Schema.Types.ObjectId, ref: "OrderRefund", default: null }, // Hoàn trả (Phiếu hoàn cuối cùng)
    refundedAmount: { type: Schema.Types.Decimal128, default: "0" }, // Tổng tiền đã hoàn
    totalRefundedQuantity: { type: Number, default: 0 }, // Tổng số lượng đã hoàn

    printDate: { type: Date, default: null }, // Ngày in bill
    printCount: { type: Number, default: 0 }, // Số lần in bill

    isVATInvoice: { type: Boolean, default: false }, // Có xuất hóa đơn VAT không?
    vatInfo: {
      companyName: { type: String, trim: true },
      taxCode: { type: String, trim: true },
      companyAddress: { type: String, trim: true },
    },

    vatAmount: { type: Schema.Types.Decimal128, default: "0" }, // VAT
    beforeTaxAmount: { type: Schema.Types.Decimal128, default: "0" }, // Trước thuế

    earnedPoints: { type: Number, default: 0, min: 0 }, // Điểm tích lũy
    usedPoints: { type: Number, default: 0, min: 0 }, // Điểm đã dùng

    inventory_voucher_id: {
      type: Schema.Types.ObjectId,
      ref: "InventoryVoucher",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "orders",
  }
);

// Index cho report
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ employeeId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
