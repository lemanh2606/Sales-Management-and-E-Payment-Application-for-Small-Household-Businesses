const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: null },
  phone: { type: String, default: null },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Store", storeSchema);
