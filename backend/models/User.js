// backend/models/User.js
const mongoose = require("mongoose");

// Schema nhỏ để map quyền theo từng store (không cần _id riêng)
const storeRoleSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
    role: { type: String, enum: ["OWNER", "STAFF"], required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },

    // role global (MANAGER: có thể tạo store; STAFF: nhân viên)
    role: { type: String, enum: ["MANAGER", "STAFF"], required: true, default: "MANAGER" },

    email: { 
      type: String, 
      unique: true, 
      lowercase: true, 
      trim: true,
      required: function() {  // 👈 Tweak: Conditional required - chỉ bắt buộc cho MANAGER (register cần OTP email), STAFF optional null/empty
        return this.role === "MANAGER";
      }
    },
    phone: { type: String, default: "" },

    // Store-related fields
    stores: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }], // stores owner sở hữu (Manager)
    current_store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", default: null }, // store đang active
    store_roles: { type: [storeRoleSchema], default: [] }, // mapping per-store roles (OWNER/STAFF)

    // OTP / verification (nếu bạn dùng cơ chế hash OTP trong DB)
    otp_hash: { type: String, default: null },
    otp_expires: { type: Date, default: null },
    otp_attempts: { type: Number, default: 0 },

    // Verification flag
    isVerified: { type: Boolean, default: false },

    // Login security
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    alertCount: { type: Number, default: 0 },
    // Other
    last_login: { type: Date, default: null },
    isDeleted: {type: Boolean, default: false},
  },
  {
    timestamps: true, // createdAt, updatedAt tự động
  }
);

// Nếu cần, bạn có thể thêm index hoặc pre-save hook ở đây
// ví dụ: userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
