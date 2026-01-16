// models/Subscription.js
const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Subscription status
    status: { type: String, enum: ["TRIAL", "PENDING", "ACTIVE", "EXPIRED", "CANCELLED"], default: "TRIAL", required: true },
    // Trial info
    trial_started_at: { type: Date, default: null },
    trial_ends_at: { type: Date, default: null },
    // Premium info
    plan_duration: { type: Number, enum: [1, 3, 6], default: null },
    duration_months: { type: Number, enum: [1, 3, 6], default: null },
    started_at: { type: Date, default: null },
    expires_at: { type: Date, default: null, index: true },

    auto_renew: { type: Boolean, default: false },
    // Payment state
    pending_order_code: { type: String, default: null, index: true },
    pending_plan_duration: { type: Number, enum: [1, 3, 6], default: null },
    pending_amount: { type: Number, default: null },
    pending_checkout_url: { type: String, default: null },
    pending_qr_url: { type: String, default: null },
    pending_created_at: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "subscriptions",
  }
);

// Index compound cho query hiệu quả
subscriptionSchema.index({ user_id: 1, status: 1 });
subscriptionSchema.index({ expires_at: 1, status: 1 });
subscriptionSchema.index({ pending_created_at: 1 });

// Virtual: Kiểm tra còn trial không
subscriptionSchema.virtual("is_trial_active").get(function () {
  if (this.status !== "TRIAL") return false;
  if (!this.trial_ends_at) return false; // Handle null/undefined
  return new Date() < this.trial_ends_at;
});

// Virtual: Kiểm tra premium còn active không
subscriptionSchema.virtual("is_premium_active").get(function () {
  if (this.status !== "ACTIVE") return false;
  if (!this.expires_at) return false;
  return new Date() < this.expires_at;
});

// Virtual: Số ngày còn lại (Tính theo ngày lịch: NgàyHếtHạn - NgàyHiệnTại)
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

  const end = new Date(targetDate);
  end.setHours(0, 0, 0, 0);
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diff = end - now;
  // Sử dụng Math.round để tránh sai lệch nhỏ về mili giây khi chia
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
});

// Virtual: Tổng số ngày của gói (dùng cho Progress Bar)
subscriptionSchema.virtual("total_days").get(function () {
  // Xác định xem đây là Trial hay Premium (dựa trên các mốc thời gian có sẵn)
  const isTrialPeriod = this.trial_ends_at && (this.status === "TRIAL" || (this.status === "EXPIRED" && !this.expires_at));
  
  let start, end;
  if (isTrialPeriod) {
    if (this.trial_started_at && this.trial_ends_at) {
      start = this.trial_started_at;
      end = this.trial_ends_at;
    } else {
      return 14; // Mặc định trial 14 ngày
    }
  } else {
    if (this.started_at && this.expires_at) {
      start = this.started_at;
      end = this.expires_at;
    } else {
      return 0;
    }
  }

  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  const diff = endDate - startDate;
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
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
subscriptionSchema.methods.activatePremium = function (planDuration) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + planDuration);

  this.status = "ACTIVE";
  this.plan_duration = planDuration;
  this.duration_months = planDuration;
  this.started_at = now;
  this.expires_at = expiresAt;

  return this;
};

subscriptionSchema.methods.extendPremium = function (planDuration) {
  if (!this.expires_at || this.isExpired()) {
    return this.activatePremium(planDuration);
  }

  const newExpires = new Date(this.expires_at);
  newExpires.setMonth(newExpires.getMonth() + planDuration);

  this.status = "ACTIVE";
  this.plan_duration = planDuration;
  this.duration_months = planDuration;
  this.expires_at = newExpires;

  if (!this.started_at) {
    this.started_at = new Date();
  }

  return this;
};

subscriptionSchema.methods.markPendingPayment = function ({ orderCode, amount, planDuration, checkoutUrl, qrUrl }) {
  this.pending_order_code = orderCode ? orderCode.toString() : null;
  this.pending_amount = amount ?? null;
  this.pending_plan_duration = planDuration ?? null;
  this.pending_checkout_url = checkoutUrl ?? null;
  this.pending_qr_url = qrUrl ?? null;
  this.pending_created_at = new Date();
  return this;
};

subscriptionSchema.methods.clearPendingPayment = function () {
  this.pending_order_code = null;
  this.pending_amount = null;
  this.pending_plan_duration = null;
  this.pending_checkout_url = null;
  this.pending_qr_url = null;
  this.pending_created_at = null;
  return this;
};

// Static: Tạo trial cho user mới (sử dụng upsert để tránh race condition)
subscriptionSchema.statics.createTrial = async function (userId) {
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 14); // 14 ngày trial
  
  // Sử dụng findOneAndUpdate với upsert để tránh race condition
  // Nếu đã có subscription thì không tạo mới, return cái cũ
  const subscription = await this.findOneAndUpdate(
    { user_id: userId },
    {
      $setOnInsert: {
        user_id: userId,
        status: "TRIAL",
        trial_started_at: now,
        trial_ends_at: trialEnds,
      }
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
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