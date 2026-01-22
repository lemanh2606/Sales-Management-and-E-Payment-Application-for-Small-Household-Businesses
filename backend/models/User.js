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
    // === AUTH INFO ===
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },

    // === PROFILE ===
    fullname: { type: String, default: "" },
    image: { type: String, default: "/default-avatar.png", trim: true },
    image_thumb: { type: String },
    image_delete_url: { type: String },

    // === GLOBAL ROLE ===
    role: {
      type: String,
      enum: ["MANAGER", "STAFF"],
      default: "MANAGER",
      required: true,
    },

    // === CONTACT ===
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

    // === STORE CONTEXT ===
    stores: [{ type: mongoose.Schema.Types.ObjectId, ref: "Store" }],
    current_store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    store_roles: { type: [storeRoleSchema], default: [] },

    // === PERMISSION ===
    menu: { type: [String], default: [] },

    // === OTP / VERIFY ===
    otp_hash: { type: String, default: null },
    otp_expires: { type: Date, default: null },
    otp_attempts: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },

    // === SECURITY ===
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    alertCount: { type: Number, default: 0 },

    // === SUBSCRIPTION ===
    is_premium: { type: Boolean, default: false },

    // === PUSH NOTIFICATIONS ===
    pushToken: { type: String, default: null }, // Expo Push Token
    pushTokenPlatform: {
      type: String,
      enum: ["android", "ios", null],
      default: null,
    },
    pushTokenDeviceName: { type: String, default: null },
    pushTokenUpdatedAt: { type: Date, default: null },

    // === ACTIVITY ===
    last_login: { type: Date, default: null },
    last_logout: { type: Date },
    last_ip: { type: String },
    last_user_agent: { type: String },
    online_duration_today: { type: Number, default: 0 },

    // === SOFT DELETE ===
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    restoredAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
);

userSchema.index({ current_store: 1, role: 1, isDeleted: 1 });

module.exports = mongoose.model("User", userSchema);
