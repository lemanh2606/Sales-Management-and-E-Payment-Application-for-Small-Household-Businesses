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

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "OrderRefund",
      default: null,
    }, // Hoàn trả (Phiếu hoàn cuối cùng)
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
    discountAmount: { type: Schema.Types.Decimal128, default: "0" }, // Số tiền giảm giá từ điểm (VND)
    grossAmount: { type: Schema.Types.Decimal128, default: "0" }, // Tổng tiền hàng (trước khi trừ giảm giá)

    inventory_voucher_id: {
      type: Schema.Types.ObjectId,
      ref: "InventoryVoucher",
      default: null,
    },
    isLoyaltyProcessed: { type: Boolean, default: false }, // Đánh dấu đã xử lý điểm tích lũy chưa
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

// Helper xử lý Loyalty (đã chuyển vào model để dùng chung)
// NOTE: usedPoints đã được trừ TẠM khi tạo pending order (Reserve Points)
// Khi order chuyển sang PAID, chỉ cần cộng thêm earnedPoints
orderSchema.statics.processLoyalty = async function (orderId, session = null) {
  const Order = this;
  const Customer = mongoose.model("Customer");
  const LoyaltySetting = mongoose.model("LoyaltySetting");

  const order = await Order.findById(orderId).session(session);
  if (!order || order.isLoyaltyProcessed || !order.customer) return null;

  const storeId = order.storeId;
  const loyaltySetting = await LoyaltySetting.findOne({ storeId }).session(
    session
  );
  if (!loyaltySetting || !loyaltySetting.isActive) return null;

  // 1. Tính điểm thưởng
  let earnedPoints = 0;
  const totalAmount = parseFloat(order.totalAmount.toString());
  if (totalAmount >= (loyaltySetting.minOrderValue || 0)) {
    earnedPoints = Math.round(totalAmount * loyaltySetting.pointsPerVND);
  }

  // 2. Điểm sử dụng (đã được trừ TẠM khi tạo pending order, không cần trừ lại)
  const usedPoints = order.usedPoints || 0;

  // 3. Cập nhật khách hàng - CHỈ CỘNG ĐIỂM THƯỞNG (không trừ usedPoints vì đã reserve)
  const customer = await Customer.findById(order.customer).session(session);
  if (customer) {
    const prevSpent = parseFloat(customer.totalSpent?.toString() || 0);
    const newSpent = prevSpent + totalAmount;

    //  CHỈ CỘNG earnedPoints, KHÔNG TRỪ usedPoints (đã reserve khi tạo pending)
    customer.loyaltyPoints = (customer.loyaltyPoints || 0) + earnedPoints;
    customer.totalSpent = mongoose.Types.Decimal128.fromString(
      newSpent.toFixed(2)
    );
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    await customer.save({ session });

    console.log(
      ` [processLoyalty] Order ${orderId}: +${earnedPoints} điểm thưởng (usedPoints=${usedPoints} đã reserve trước)`
    );

    // 4. Đánh dấu đơn hàng đã xử lý
    order.earnedPoints = earnedPoints;
    order.isLoyaltyProcessed = true;
    await order.save({ session });

    return { earnedPoints, usedPoints };
  }
  return null;
};

module.exports = mongoose.model("Order", orderSchema);
