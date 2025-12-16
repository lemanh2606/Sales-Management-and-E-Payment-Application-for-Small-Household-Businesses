// models/TaxDeclaration.js - Thêm các trường theo mẫu 01/CNKD
const mongoose = require("mongoose");

const TaxDeclarationSchema = new mongoose.Schema(
  {
    // ===== THÔNG TIN CƠ BẢN =====
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    // [01] Kỳ tính thuế
    periodType: {
      type: String,
      enum: ["month", "quarter", "year", "custom", "adhoc"], // adhoc = lần phát sinh
      required: true,
    },
    periodKey: { type: String, required: true }, // "2024-01", "Q1-2024", "2024", "2024-01_2024-03"

    // [02][03] Lần khai
    isFirstTime: { type: Boolean, default: true },
    supplementNumber: { type: Number, default: 0 }, // Bổ sung lần thứ

    // ===== THÔNG TIN NGƯỜI NỘP THUẾ (từ Store) =====
    taxpayerInfo: {
      name: String, // [04] Người nộp thuế
      storeName: String, // [05] Tên cửa hàng/thương hiệu
      bankAccount: String, // [06] Tài khoản ngân hàng
      taxCode: String, // [07] Mã số thuế
      businessSector: String, // [08] Ngành nghề kinh doanh
      businessArea: Number, // [09] Diện tích kinh doanh (m²)
      isRented: Boolean, // [09a] Đi thuê
      employeeCount: Number, // [10] Số lượng lao động
      workingHours: {
        // [11] Thời gian hoạt động
        from: String, // "08:00"
        to: String, // "22:00"
      },
      businessAddress: {
        // [12] Địa chỉ kinh doanh
        full: String,
        street: String, // [12b]
        ward: String, // [12c]
        district: String, // [12d]
        province: String, // [12đ]
      },
      residenceAddress: {
        // [13] Địa chỉ cư trú
        full: String,
        street: String,
        ward: String,
        district: String,
        province: String,
      },
      phone: String, // [14]
      fax: String, // [15]
      email: String, // [16]
    },

    // ===== A. KÊ KHAI THUẾ GTGT & TNCN =====
    revenueByCategory: [
      {
        category: {
          type: String,
          enum: [
            "goods_distribution", // [28] Phân phối, cung cấp hàng hóa
            "service_construction", // [29] Dịch vụ, xây dựng không bao thầu NVL
            "manufacturing_transport", // [30] Sản xuất, vận tải, dịch vụ có gắn hàng hóa
            "other_business", // [31] Hoạt động kinh doanh khác
          ],
        },
        revenue: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Doanh thu
        gtgtTax: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Thuế GTGT
        tncnTax: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Thuế TNCN
      },
    ],

    // Doanh thu & thuế tổng hợp
    systemRevenue: { type: mongoose.Schema.Types.Decimal128, default: 0 }, // Doanh thu hệ thống
    declaredRevenue: { type: mongoose.Schema.Types.Decimal128, required: true }, // Doanh thu kê khai [32]

    taxRates: {
      gtgt: { type: Number, default: 1.0 }, // % GTGT
      tncn: { type: Number, default: 0.5 }, // % TNCN
    },

    taxAmounts: {
      gtgt: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      tncn: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      total: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    },

    // ===== B. THUẾ TTĐB (Tiêu thụ đặc biệt) - Optional =====
    specialConsumptionTax: [
      {
        itemName: String, // Tên hàng hóa/dịch vụ
        unit: String, // Đơn vị tính
        revenue: { type: mongoose.Schema.Types.Decimal128, default: 0 },
        taxRate: Number, // % thuế
        taxAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      },
    ],

    // ===== C. THUẾ TÀI NGUYÊN / PHÍ BVMT - Optional =====
    environmentalTax: [
      {
        type: {
          type: String,
          enum: ["resource", "environmental_tax", "environmental_fee"],
        },
        itemName: String,
        unit: String,
        quantity: Number,
        unitPrice: { type: mongoose.Schema.Types.Decimal128, default: 0 },
        taxRate: Number,
        taxAmount: { type: mongoose.Schema.Types.Decimal128, default: 0 },
      },
    ],

    // ===== METADATA =====
    status: {
      type: String,
      enum: ["draft", "saved", "submitted", "approved", "rejected"],
      default: "draft",
    },

    submittedAt: Date, // Ngày nộp
    approvedAt: Date, // Ngày duyệt
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: String,

    // Version control
    version: { type: Number, default: 1 },
    isClone: { type: Boolean, default: false },
    originalId: { type: mongoose.Schema.Types.ObjectId, ref: "TaxDeclaration" },

    // Người tạo
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Notes
    notes: String,
    internalNotes: String, // Ghi chú nội bộ (chỉ manager xem)
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index để tránh duplicate
TaxDeclarationSchema.index({
  shopId: 1,
  periodType: 1,
  periodKey: 1,
  isClone: 1,
});

module.exports = mongoose.model("TaxDeclaration", TaxDeclarationSchema);
