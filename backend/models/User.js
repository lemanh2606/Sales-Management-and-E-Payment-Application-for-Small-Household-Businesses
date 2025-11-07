// backend/models/User.js
const mongoose = require("mongoose");

const storeRoleSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    role: { type: String, enum: ["OWNER", "STAFF"], required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    image: {
      type: String,
      default: "/default-avatar.png", // 👈 Thêm default value
      trim: true,
    },
    fullname: { type: String, default: "" },

    // role global (MANAGER: có thể tạo store; STAFF: nhân viên)
    role: {
      type: String,
      enum: ["MANAGER", "STAFF"],
      required: true,
      default: "MANAGER",
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: function () {
        return this.role === "MANAGER";
      },
    },
    phone: { type: String, default: "" },

    // Store-related
    stores: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
    current_store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    store_roles: { type: [storeRoleSchema], default: [] },

    // Menu permissions (phân quyền chức năng)
    menu: {
      type: [String], // ví dụ: ["dashboard", "orders", "products", "staff"]
      default: [],
    },

    // OTP / verification
    otp_hash: { type: String, default: null },
    otp_expires: { type: Date, default: null },
    otp_attempts: { type: Number, default: 0 },

    // Verification flag
    isVerified: { type: Boolean, default: false },

    // Login security
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    alertCount: { type: Number, default: 0 },

    // === SUBSCRIPTION INFO ===
    subscription_status: {
      type: String,
      enum: ["TRIAL", "PREMIUM", "EXPIRED"],
      default: "TRIAL",
    },
    trial_started_at: {
      type: Date,
      default: null,
    },
    trial_ends_at: {
      type: Date,
      default: null,
    },
    premium_expires_at: {
      type: Date,
      default: null,
    },
    is_premium: {
      type: Boolean,
      default: false,
    },

    // Other
    last_login: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    restoredAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

userSchema.index({ current_store: 1, role: 1, isDeleted: 1 });

module.exports = mongoose.model("User", userSchema);
