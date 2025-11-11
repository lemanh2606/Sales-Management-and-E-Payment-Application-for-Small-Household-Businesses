// middlewares/subscriptionMiddleware.js
const Subscription = require("../models/Subscription");

/**
 * Middleware kiểm tra subscription đã hết hạn chưa
 * Check từ Subscription model thay vì User model
 * Auto-create trial nếu không có subscription (chỉ cho MANAGER)
 */
const checkSubscriptionExpiry = async (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  // STAFF không cần subscription check, kế thừa từ Manager
  if (user.role === "STAFF") {
    return next();
  }

  try {
    // Tìm subscription active
    let subscription = await Subscription.findActiveByUser(user._id);

    // Auto-create trial nếu không có (chỉ cho MANAGER)
    if (!subscription) {
      if (user.role !== "MANAGER") {
        return res.status(403).json({ 
          message: "Chỉ MANAGER mới có subscription",
          subscription_required: true
        });
      }
      console.log("🎁 Auto-creating trial for MANAGER:", user._id);
      subscription = await Subscription.createTrial(user._id);
    }

    const now = new Date();

    // Case 1: TRIAL
    if (subscription.status === "TRIAL") {
      if (subscription.is_trial_active) {
        // Trial còn hạn → OK
        return next();
      } else {
        // Trial hết hạn
        subscription.status = "EXPIRED";
        await subscription.save();
        
        return res.status(403).json({
          message: "Bản dùng thử đã hết hạn. Vui lòng nâng cấp lên Premium.",
          subscription_status: "EXPIRED",
          trial_ended_at: subscription.trial_ends_at,
          upgrade_required: true,
        });
      }
    }

    // Case 2: ACTIVE (Premium)
    if (subscription.status === "ACTIVE") {
      if (subscription.is_premium_active) {
        // Premium còn hạn → OK
        return next();
      } else {
        // Premium hết hạn
        subscription.status = "EXPIRED";
        await subscription.save();
        
        // Update user is_premium flag
        user.is_premium = false;
        await user.save();
        
        return res.status(403).json({
          message: "Gói Premium đã hết hạn. Vui lòng gia hạn.",
          subscription_status: "EXPIRED",
          premium_expired_at: subscription.expires_at,
          renew_required: true,
        });
      }
    }

    // Case 3: EXPIRED hoặc status khác
    return res.status(403).json({
      message: "Tài khoản đã hết hạn. Vui lòng nâng cấp hoặc gia hạn.",
      subscription_status: subscription.status,
      upgrade_required: true,
    });
    
  } catch (error) {
    console.error("Error in checkSubscriptionExpiry:", error);
    return res.status(500).json({ message: "Lỗi server khi kiểm tra subscription" });
  }
};

/**
 * Middleware check premium (nếu cần feature chỉ premium)
 * Check từ Subscription model
 */
const checkPremiumOnly = async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  try {
    const subscription = await Subscription.findActiveByUser(user._id);

    if (subscription && subscription.status === "ACTIVE" && subscription.is_premium_active) {
      return next();
    }

    return res.status(403).json({
      message: "Tính năng này chỉ dành cho Premium",
      is_premium: user.is_premium,
      subscription_status: subscription?.status || "NONE",
      upgrade_url: "/settings/subscription/pricing",
    });
  } catch (error) {
    console.error("Error in checkPremiumOnly:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Middleware thêm thông tin subscription vào response
 * Để frontend biết còn bao nhiêu ngày
 */
const attachSubscriptionInfo = async (req, res, next) => {
  const user = req.user;
  
  if (!user) {
    return next();
  }

  try {
    const subscription = await Subscription.findActiveByUser(user._id);

    // Attach subscription info
    req.subscription_info = {
      status: subscription?.status || "NONE",
      is_premium: user.is_premium,
    };

    // Add days remaining
    if (subscription) {
      if (subscription.status === "TRIAL" && subscription.trial_ends_at) {
        req.subscription_info.trial_days_remaining = subscription.days_remaining;
        req.subscription_info.trial_ends_at = subscription.trial_ends_at;
      }

      if (subscription.status === "ACTIVE" && subscription.expires_at) {
        req.subscription_info.premium_days_remaining = subscription.days_remaining;
        req.subscription_info.premium_expires_at = subscription.expires_at;
      }
    }

    next();
  } catch (error) {
    console.error("Error in attachSubscriptionInfo:", error);
    next(); // Continue even if error
  }
};

module.exports = {
  checkSubscriptionExpiry,
  checkPremiumOnly,
  attachSubscriptionInfo,
};
