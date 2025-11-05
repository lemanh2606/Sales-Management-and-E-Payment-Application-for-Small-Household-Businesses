// models/Subscription.js
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Trạng thái subscription
    status: {
      type: String,
      enum: ["TRIAL", "PENDING", "ACTIVE", "EXPIRED", "CANCELLED"],
      default: "TRIAL",
      required: true,
    },

    // === TRIAL INFO ===
    trial_started_at: {
      type: Date,
      default: null,
    },
    trial_ends_at: {
      type: Date,
      default: null,
    },

    // === PREMIUM INFO ===
    plan_duration: {
      type: Number, // 1, 3, hoặc 6 (tháng)
      enum: [1, 3, 6],
      default: null,
    },
    duration_months: {
      type: Number, // Alias cho plan_duration để webhook query
      enum: [1, 3, 6],
      default: null,
    },
    price_paid: {
      type: mongoose.Schema.Types.Decimal128, // Số tiền đã trả
      default: null,
    },
    discount_amount: {
      type: mongoose.Schema.Types.Decimal128, // Số tiền được giảm
      default: 0,
    },

    started_at: {
      type: Date, // Khi nào bắt đầu premium
      default: null,
    },
    expires_at: {
      type: Date, // Khi nào hết hạn premium
      default: null,
      index: true, // Index để query expiry
    },

    auto_renew: {
      type: Boolean,
      default: false,
    },

    // === PAYMENT INFO ===
    payment_method: {
      type: String,
      enum: ["VNPAY", "MOMO", "ZALOPAY", "PAYOS", "BANK_TRANSFER", "MANUAL"],
      default: "PAYOS",
    },
    transaction_id: {
      type: String,
      default: null,
    },
    paid_at: {
      type: Date,
      default: null,
    },

    // === PAYMENT HISTORY ===
    payment_history: [
      {
        plan_duration: Number,
        amount: mongoose.Schema.Types.Decimal128,
        paid_at: Date,
        transaction_id: String,
        expires_at: Date,
        payment_method: String,
      },
    ],

    // === METADATA ===
    notes: {
      type: String,
      default: "",
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
    cancelled_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "subscriptions",
  }
);

// Index compound cho query hiệu quả
subscriptionSchema.index({ user_id: 1, status: 1 });
subscriptionSchema.index({ expires_at: 1, status: 1 });

// Virtual: Kiểm tra còn trial không
subscriptionSchema.virtual("is_trial_active").get(function () {
  if (this.status !== "TRIAL") return false;
  return new Date() < this.trial_ends_at;
});

// Virtual: Kiểm tra premium còn active không
subscriptionSchema.virtual("is_premium_active").get(function () {
  if (this.status !== "ACTIVE") return false;
  if (!this.expires_at) return false;
  return new Date() < this.expires_at;
});

// Virtual: Số ngày còn lại
subscriptionSchema.virtual("days_remaining").get(function () {
  let targetDate;
  if (this.status === "TRIAL") {
    targetDate = this.trial_ends_at;
  } else if (this.status === "ACTIVE") {
    targetDate = this.expires_at;
  } else {
    return 0;
  }

  if (!targetDate) return 0;

  const now = new Date();
  const diff = targetDate - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Method: Kiểm tra đã hết hạn chưa
subscriptionSchema.methods.isExpired = function () {
  const now = new Date();
  if (this.status === "TRIAL") {
    return now >= this.trial_ends_at;
  }
  if (this.status === "ACTIVE") {
    return now >= this.expires_at;
  }
  return true;
};

// Method: Activate premium
subscriptionSchema.methods.activatePremium = function (planDuration, pricePaid, transactionId) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + planDuration);

  this.status = "ACTIVE";
  this.plan_duration = planDuration;
  this.price_paid = pricePaid;
  this.started_at = now;
  this.expires_at = expiresAt;
  this.transaction_id = transactionId;
  this.paid_at = now;

  // Thêm vào history
  this.payment_history.push({
    plan_duration: planDuration,
    amount: pricePaid,
    paid_at: now,
    transaction_id: transactionId,
    expires_at: expiresAt,
    payment_method: this.payment_method,
  });

  return this;
};

// Static: Tạo trial cho user mới
subscriptionSchema.statics.createTrial = async function (userId) {
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 14); // 14 ngày trial

  const subscription = new this({
    user_id: userId,
    status: "TRIAL",
    trial_started_at: now,
    trial_ends_at: trialEnds,
  });

  await subscription.save();
  return subscription;
};

// Static: Tìm subscription active của user
subscriptionSchema.statics.findActiveByUser = async function (userId) {
  return await this.findOne({
    user_id: userId,
    status: { $in: ["TRIAL", "ACTIVE"] },
  });
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;
