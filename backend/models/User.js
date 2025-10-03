const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["MANAGER", "STAFF"], required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, default: null },
    created_at: { type: Date, default: Date.now },
    last_login: { type: Date, default: null },
  },
  { timestamps: false }
);

module.exports = mongoose.model("User", userSchema);
