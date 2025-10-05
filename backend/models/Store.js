const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    owner_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true, // tự động thêm createdAt và updatedAt
  }
);

module.exports = mongoose.model("Store", storeSchema);
