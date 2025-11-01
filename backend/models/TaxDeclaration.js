// models/TaxDeclaration.js
const mongoose = require("mongoose");

const TaxDeclarationSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true }, // nếu multi-store
    periodType: { type: String, enum: ["month", "quarter", "year", "custom"], required: true },
    periodKey: { type: String, required: true }, // e.g. "2025-01" or "2025-Q1" or "2025"
    systemRevenue: { type: mongoose.Types.Decimal128, required: true, default: "0.00" }, // từ các Bill đã in
    declaredRevenue: { type: mongoose.Types.Decimal128, required: true }, // người dùng có thể EDIT
    taxRates: {
      gtgt: { type: Number, default: 1.0 }, // phần trăm, Ví dụ 1 là 1%, thông số chuẩn của pháp luật Việt Nam
      tncn: { type: Number, default: 0.5 }, // phần trăm, Ví dụ 0.5 là 0.5%, thông số chuẩn của pháp luật Việt Nam
    },
    taxAmounts: {
      gtgt: { type: mongoose.Types.Decimal128, default: "0.00" },
      tncn: { type: mongoose.Types.Decimal128, default: "0.00" },
      total: { type: mongoose.Types.Decimal128, default: "0.00" },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    originalId: { type: mongoose.Schema.Types.ObjectId, ref: "TaxDeclaration", default: null },
    isClone: { type: Boolean, default: false }, // Có phải là bản clone không?
    version: { type: Number, default: 1 }, // version: v1, v2, v3 ...
    //Trạng thái tờ khai: "saved" là chỉ lưu nội bộ, chưa nộp thuế - "sumbitted" là Đã xuất file và xác nhận “Tôi đã nộp”
    status: { type: String, enum: ["saved", "submitted"], default: "saved" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaxDeclaration", TaxDeclarationSchema);
