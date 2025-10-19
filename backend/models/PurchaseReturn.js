const mongoose = require("mongoose");

// Schema for items within a purchase return
const purchaseReturnItemSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0.01 },
    // import_price is the original price from the product collection at time of return
    import_price: { type: Number, required: true, min: 0 },
    // return_price is the actual price the item is being returned at (could be different)
    return_price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    purchase_return_code: { type: String, unique: true, sparse: true }, // Use sparse for optional unique fields
    purchase_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: false,
    }, // Link to the original purchase order
    return_date: { type: Date, default: Date.now, required: true }, // Thời gian
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    }, // Nhà cung cấp
    store_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    }, // Cửa hàng
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Người tạo

    total_amount: { type: Number, required: true, min: 0 }, // Tổng giá trị hàng trả

    supplier_refund: { type: Number, default: 0, min: 0 }, // Nhà cung cấp đã trả

    status: {
      type: String,
      enum: ["phiếu tạm", "đã trả hàng"],
      default: "phiếu tạm",
    }, // Trạng thái

    items: [purchaseReturnItemSchema], // Danh sách sản phẩm trả lại

    notes: { type: String, maxlength: 1000 }, // Ghi chú
  },
  {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    collection: "purchase_returns",
  }
);

// Virtual field tính số tiền nhà cung cấp còn phải trả lại
purchaseReturnSchema.virtual("remaining_refund").get(function () {
  return this.total_amount - this.supplier_refund;
});

module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
