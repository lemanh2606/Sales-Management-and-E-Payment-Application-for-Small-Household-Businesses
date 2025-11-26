//backend/models/storePaymentConfigS.js
const mongoose = require("mongoose");

const bankConnectionSchema = new mongoose.Schema(
  {
    bankCode: { type: String, required: true }, // MB, BIDV, VTB, ACB...
    bankName: { type: String, required: true }, // MB Bank, VietinBank,...
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    qrTemplate: { type: String, default: "compact2" }, // compact, compact2, print, vertical,...
    logo: { type: String, default: "" }, // logo để FE render (optional)
    isDefault: { type: Boolean, default: false }, // ngân hàng mặc định. Khi tạo đơn = chọn ngân hàng mặc định, có thể chọn ngân hàng khác.
    connectedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
); // dòng này để không sinh _id cho từng bank (nhìn gọn hơn)

const storePaymentConfigSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, unique: true }, // mỗi store chỉ có 1 config tổng
    banks: { type: [bankConnectionSchema], default: [] },
    payos: {
      isEnabled: { type: Boolean, default: false },
      clientId: { type: String, default: "" },
      apiKey: { type: String, default: "" },
      checksumKey: { type: String, default: "" }, // dùng luôn làm secret để verify webhook
      webhookRegisteredAt: { type: Date },
    },
    webhook: {
      isEnabled: { type: Boolean, default: false },
      url: { type: String, default: "" },
      secretKey: { type: String, default: "" },
      updatedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    collection: "storepaymentconfigs",
  }
);

module.exports = mongoose.model("StorePaymentConfig", storePaymentConfigSchema);
