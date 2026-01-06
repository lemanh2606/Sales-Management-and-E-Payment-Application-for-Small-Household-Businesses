// models/InventoryVoucher.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Item schema (dòng hàng)
const InventoryVoucherItemSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    // đối tác theo dòng (tuỳ chọn)
    supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplier_name_snapshot: { type: String, default: "" },

    // snapshot bắt buộc để in phiếu/đối chiếu về sau
    sku_snapshot: { type: String, default: "" },
    name_snapshot: { type: String, default: "" },
    unit_snapshot: { type: String, default: "" },

    // ===== Thông tin kho ở level item (nếu mỗi dòng có thể ở kho khác) =====
    warehouse_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },
    warehouse_name: { type: String, trim: true, default: "" },

    // thêm phục vụ quản lý lô/hạn dùng (tuỳ chọn)
    batch_no: { type: String, default: "" },
    expiry_date: { type: Date, default: null },

    qty_document: { type: Number, default: 0 }, // SL theo chứng từ
    qty_actual: { type: Number, required: true, min: 1 }, // SL thực nhập/xuất

    unit_cost: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString("0"),
    },
    line_cost: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString("0"),
    },

    note: { type: String, default: "" },
  },
  { _id: false }
);

// Header schema (phiếu)
const InventoryVoucherSchema = new Schema(
  {
    store_id: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    type: { type: String, enum: ["IN", "OUT"], required: true, index: true },

    voucher_code: { type: String, required: true, index: true },
    voucher_date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    // địa điểm lập chứng từ (hay có trên mẫu chứng từ)
    document_place: { type: String, default: "" },

    // Trong InventoryVoucher schema, thay phần warehouse:
    warehouse_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
    },

    warehouse_name: {
      type: String,
      trim: true,
      default: "",
    },

    warehouse_location: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "POSTED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },

    reason: { type: String, default: "" },

    // người giao / người nhận (phần chữ ký)
    deliverer_name: { type: String, default: "" },
    deliverer_phone: { type: String, default: "" },
    receiver_name: { type: String, default: "" },
    receiver_phone: { type: String, default: "" },

    // đối tác (cửa hàng nhỏ lẻ hay cần in ra)
    partner_name: { type: String, default: "" },
    partner_phone: { type: String, default: "" },
    partner_address: { type: String, default: "" },

    attached_docs: { type: Number, default: 0 },

    // ====== chứng từ gốc (theo ... số ... ngày ...) ======
    ref_type: { type: String, default: "" }, // VD: PURCHASE_INVOICE / SALE_ORDER / ADJUSTMENT / REVERSAL ...
    ref_id: { type: Schema.Types.ObjectId, default: null },
    ref_no: { type: String, default: "" },
    ref_date: { type: Date, default: null },

    // ====== tuỳ chọn kế toán ======
    // (nếu cửa hàng nhỏ lẻ không dùng tài khoản kế toán thì để trống)
    debit_account: { type: String, default: "" },
    credit_account: { type: String, default: "" },

    currency: { type: String, default: "VND" },
    exchange_rate: { type: Number, default: 1 },

    // ====== dấu vết người lập/duyệt/ghi sổ ======
    created_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approved_at: { type: Date, default: null },

    posted_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    posted_at: { type: Date, default: null },

    // tuỳ chọn: thủ kho / kế toán xác nhận
    warehouse_keeper_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    accountant_id: { type: Schema.Types.ObjectId, ref: "User", default: null },

    cancelled_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelled_at: { type: Date, default: null },
    cancel_reason: { type: String, default: "" },

    reversal_of: {
      type: Schema.Types.ObjectId,
      ref: "InventoryVoucher",
      default: null,
    },
    reversal_voucher_id: {
      type: Schema.Types.ObjectId,
      ref: "InventoryVoucher",
      default: null,
    },

    // supplier header-level (tuỳ bạn có dùng hay không)
    supplier_id: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplier_name_snapshot: { type: String, default: "" },

    items: { type: [InventoryVoucherItemSchema], default: [] },

    total_qty: { type: Number, default: 0 },
    total_cost: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString("0"),
    },
  },
  { timestamps: true, collection: "inventory_vouchers" }
);

InventoryVoucherSchema.index(
  { store_id: 1, voucher_code: 1 },
  { unique: true }
);
InventoryVoucherSchema.index({ store_id: 1, voucher_date: -1 });
InventoryVoucherSchema.index({ store_id: 1, status: 1, voucher_date: -1 });
InventoryVoucherSchema.index({ store_id: 1, type: 1, voucher_date: -1 });

// auto-calc totals + line_cost
InventoryVoucherSchema.pre("validate", function (next) {
  let totalQty = 0;
  let totalCost = 0;

  (this.items || []).forEach((it) => {
    const qty = Number(it.qty_actual || 0);
    const unitCost = it.unit_cost ? Number(it.unit_cost.toString()) : 0;

    totalQty += qty;

    const line = qty * unitCost;
    it.line_cost = mongoose.Types.Decimal128.fromString(String(line || 0));
    totalCost += line;
  });

  this.total_qty = totalQty;
  this.total_cost = mongoose.Types.Decimal128.fromString(
    String(totalCost || 0)
  );

  next();
});

module.exports = mongoose.model("InventoryVoucher", InventoryVoucherSchema);
