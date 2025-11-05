// middlewares/subscriptionMiddleware.js

/**
 * Middleware kiểm tra subscription đã hết hạn chưa
 * Chặn user nếu:
 * - Trial đã hết hạn
 * - Premium đã hết hạn
 * Cho phép nếu:
 * - Trial còn hạn
 * - Premium còn hạn
 */
const checkSubscriptionExpiry = (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  const now = new Date();

  // Case 1: TRIAL
  if (user.subscription_status === "TRIAL") {
    if (!user.trial_ends_at || now < user.trial_ends_at) {
      // Trial còn hạn → OK
      return next();
    } else {
      // Trial hết hạn
      return res.status(403).json({
        message: "Bản dùng thử đã hết hạn. Vui lòng nâng cấp lên Premium.",
        subscription_status: "EXPIRED",
        trial_ended_at: user.trial_ends_at,
        upgrade_required: true,
      });
    }
  }

  // Case 2: PREMIUM
  if (user.subscription_status === "PREMIUM") {
    if (user.is_premium && user.premium_expires_at && now < user.premium_expires_at) {
      // Premium còn hạn → OK
      return next();
    } else {
      // Premium hết hạn
      return res.status(403).json({
        message: "Gói Premium đã hết hạn. Vui lòng gia hạn.",
        subscription_status: "EXPIRED",
        premium_expired_at: user.premium_expires_at,
        renew_required: true,
      });
    }
  }

  // Case 3: EXPIRED hoặc status khác
  return res.status(403).json({
    message: "Tài khoản đã hết hạn. Vui lòng nâng cấp hoặc gia hạn.",
    subscription_status: user.subscription_status,
    upgrade_required: true,
  });
};

/**
 * Middleware check premium (nếu cần feature chỉ premium)
 * Hiện tại theo concept "trial dùng hết", có thể không cần
 * Nhưng giữ lại để sau này có thể dùng cho premium-only features
 */
const checkPremiumOnly = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  if (user.is_premium && user.subscription_status === "PREMIUM") {
    const now = new Date();
    if (user.premium_expires_at && now < user.premium_expires_at) {
      return next();
    }
  }

  return res.status(403).json({
    message: "Tính năng này chỉ dành cho Premium",
    is_premium: user.is_premium,
    subscription_status: user.subscription_status,
    upgrade_url: "/pricing",
  });
};

/**
 * Middleware thêm thông tin subscription vào response
 * Để frontend biết còn bao nhiêu ngày
 */
const attachSubscriptionInfo = (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return next();
  }

  // Attach subscription info
  req.subscription_info = {
    status: user.subscription_status,
    is_premium: user.is_premium,
  };

  const now = new Date();

  if (user.subscription_status === "TRIAL" && user.trial_ends_at) {
    const daysRemaining = Math.max(
      0,
      Math.ceil((user.trial_ends_at - now) / (1000 * 60 * 60 * 24))
    );
    req.subscription_info.trial_days_remaining = daysRemaining;
    req.subscription_info.trial_ends_at = user.trial_ends_at;
  }

  if (user.subscription_status === "PREMIUM" && user.premium_expires_at) {
    const daysRemaining = Math.max(
      0,
      Math.ceil((user.premium_expires_at - now) / (1000 * 60 * 60 * 24))
    );
    req.subscription_info.premium_days_remaining = daysRemaining;
    req.subscription_info.premium_expires_at = user.premium_expires_at;
  }

  next();
};

module.exports = {
  checkSubscriptionExpiry,
  checkPremiumOnly,
  attachSubscriptionInfo,
};
