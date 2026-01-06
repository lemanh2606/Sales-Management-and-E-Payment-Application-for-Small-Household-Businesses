// models/OperatingExpense.js
const mongoose = require("mongoose");

const OperatingExpenseItemSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, trim: true, maxlength: 200, default: "" },
    isSaved: { type: Boolean, default: true },
  },
);

const OperatingExpenseSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },

    // month | quarter | year
    periodType: { type: String, required: true, enum: ["month", "quarter", "year"], index: true },

    // month: "YYYY-MM" | quarter: "YYYY-Qn" | year: "YYYY"
    periodKey: { type: String, required: true, trim: true, index: true },

    // Danh sách khoản chi ngoài (mặt bằng, điện nước, marketing...)
    items: { type: [OperatingExpenseItemSchema], default: [] },

    // Status để track
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },

    isDeleted: { type: Boolean, default: false, index: true },

    // Audit trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: true }
);

// 1 store + 1 periodType + 1 periodKey chỉ có 1 record (không tính deleted)
OperatingExpenseSchema.index(
  { storeId: 1, periodType: 1, periodKey: 1, isDeleted: 1 },
  { unique: true, name: "uniq_store_period_operating_expense" }
);

// Virtual: tổng tiền
OperatingExpenseSchema.virtual("totalAmount").get(function () {
  if (!Array.isArray(this.items)) return 0;
  return this.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
});

// Khi toJSON/toObject thì include virtuals
OperatingExpenseSchema.set("toJSON", { virtuals: true });
OperatingExpenseSchema.set("toObject", { virtuals: true });

// (Optional) Validation cơ bản cho format periodKey theo periodType
OperatingExpenseSchema.pre("validate", function (next) {
  if (!this.periodType || !this.periodKey) return next();
  const key = String(this.periodKey).trim();

  if (this.periodType === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) 
    return next(new Error("periodKey for month phải theo dạng YYYY-MM"));

  if (this.periodType === "quarter" && !/^\d{4}-Q[1-4]$/.test(key)) 
    return next(new Error("periodKey for quarter phải theo dạng YYYY-Qn (n=1..4)"));

  if (this.periodType === "year" && !/^\d{4}$/.test(key)) 
    return next(new Error("periodKey for year phải theo dạng YYYY"));

  next();
});

// Method: Soft delete
OperatingExpenseSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

// Method: Restore (undo soft delete)
OperatingExpenseSchema.methods.restore = function () {
  this.isDeleted = false;
  return this.save();
};

// Method: Format response
OperatingExpenseSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("OperatingExpense", OperatingExpenseSchema);
