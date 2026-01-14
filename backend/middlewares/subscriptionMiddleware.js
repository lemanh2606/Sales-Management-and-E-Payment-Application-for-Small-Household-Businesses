// middlewares/subscriptionMiddleware.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");

/**
 * Middleware kiểm tra subscription đã hết hạn chưa
 * Check từ Subscription model thay vì User model
 * Auto-create trial nếu không có subscription (chỉ cho MANAGER)
 * STAFF kế thừa subscription từ Manager của store
 * 
 * Whitelist: Manager được truy cập activity log và profile khi expired
 */
const checkSubscriptionExpiry = async (req, res, next) => {
  const user = req.user;
  
  console.log(`📋 [checkSubscriptionExpiry] ${req.method} ${req.originalUrl} | user: ${user?.role || 'NO_USER'} ${user?._id || ''}`);
  
  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  // Whitelist: Các endpoint Manager ĐƯỢC TRUY CẬP khi subscription expired
  const alwaysAllowedPaths = [
    "/api/activity-logs",
    "/api/users/profile",
    "/api/users/password",
    "/api/subscriptions",
  ];

  const storeReadOnlyPrefixes = [
    "/api/orders",
    "/api/financials",
    "/api/revenues",
    "/api/products",
    "/api/customers",
    "/api/notifications",
    "/api/stock",
    "/api/purchase",
    "/api/suppliers",
  ];

  const startsWithAny = (paths = []) =>
    paths.some((path) => req.path.startsWith(path) || req.originalUrl.startsWith(path));

  const isAlwaysAllowed = startsWithAny(alwaysAllowedPaths);
  const isReadOnlyStoreRequest =
    req.method === "GET" && startsWithAny(storeReadOnlyPrefixes);
  const isStoreDetailsRequest =
    req.method === "GET" &&
    req.baseUrl === "/api/stores" &&
    /^\/[^/]+$/.test(req.path || "") &&
    req.params?.storeId;

  // Whitelist: MANAGER & STAFF ĐƯỢC TRUY CẬP (Read-only) khi subscription expired
  if ((user.role === "MANAGER" || user.role === "STAFF") &&
      (isAlwaysAllowed || isReadOnlyStoreRequest || isStoreDetailsRequest)) {
    return next();
  }

  try {
    let subscription;
    let managerId = user._id;

    // STAFF kế thừa subscription từ Manager của store
    if (user.role === "STAFF") {
      // Tìm storeId từ nhiều nguồn (giống checkStoreAccess)
      const storeId = req.query.storeId || req.query.shopId || req.params.storeId || req.body?.storeId || user.current_store;
      
      const Store = require("../models/Store");
      const store = await Store.findById(storeId);
      
      if (!store) {
        // Nếu không xác định được store, nhưng route yêu cầu check sub => block
        // Tuy nhiên nếu là GET request cơ bản thì đã pass ở whitelist trên
        return res.status(403).json({ 
          message: "Không xác định được cửa hàng để kiểm tra gói dịch vụ",
          subscription_required: true
        });
      }

      // Lấy subscription của Manager (owner)
      managerId = store.owner_id;
      subscription = await Subscription.findActiveByUser(managerId);

      if (!subscription || subscription.isExpired()) {
        return res.status(403).json({
          message: "Chủ cửa hàng đã hết hạn gói đăng ký. Vui lòng liên hệ quản lý để gia hạn.",
          subscription_status: "EXPIRED",
          is_staff: true,
          manager_expired: true,
          upgrade_required: true,
        });
      }

      // STAFF pass nếu Manager còn subscription active
      return next();
    }

    // MANAGER - Tìm subscription của chính mình
    subscription = await Subscription.findActiveByUser(user._id);
    console.log("📋 findActiveByUser result for", user._id, ":", subscription ? `Found ${subscription.status}` : "Not found");

    // Auto-create trial CHỈ nếu CHƯA TỪNG có subscription (chỉ cho MANAGER)
    if (!subscription) {
      if (user.role !== "MANAGER") {
        return res.status(403).json({ 
          message: "Chỉ MANAGER mới có subscription",
          subscription_required: true
        });
      }
      
      // Kiểm tra xem có subscription cũ (EXPIRED/CANCELLED) không
      const anySubscription = await Subscription.findOne({ user_id: user._id });
      console.log("📋 anySubscription result:", anySubscription ? `Found ${anySubscription.status}` : "Not found (creating trial)");
      
      if (!anySubscription) {
        // Chưa từng có → Tạo trial mới
        console.log("🎁 Auto-creating trial for MANAGER:", user._id);
        subscription = await Subscription.createTrial(user._id);
        console.log("✅ Trial created:", subscription._id, "trial_ends_at:", subscription.trial_ends_at);
      } else {
        // Đã từng có → Dùng subscription cũ
        subscription = anySubscription;
        console.log("📋 Using existing subscription:", subscription._id, subscription.status);
      }
    }

    const now = new Date();
    console.log("📋 Subscription status:", subscription.status, "| trial_ends_at:", subscription.trial_ends_at, "| now:", now);

    // Case 1: TRIAL
    if (subscription.status === "TRIAL") {
      const isActive = subscription.is_trial_active;
      console.log("📋 TRIAL check - is_trial_active:", isActive, "| trial_ends_at:", subscription.trial_ends_at);
      
      if (isActive) {
        // Trial còn hạn → OK
        console.log("✅ TRIAL active, allowing access");
        return next();
      } else {
        // Trial hết hạn
        console.log("❌ TRIAL expired, blocking access");
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
        
        // Update user is_premium flag - sử dụng findByIdAndUpdate vì user là lean object
        await User.findByIdAndUpdate(user._id, { is_premium: false });
        
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
/**
 * Middleware check chỉ Premium mới dùng được
 * STAFF kế thừa từ Manager
 */
const checkPremiumOnly = async (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  try {
    let subscription;
    let managerId = user._id;

    // STAFF kế thừa subscription từ Manager
    if (user.role === "STAFF") {
      const Store = require("../models/Store");
      const store = await Store.findById(user.current_store);
      
      if (!store) {
        return res.status(403).json({ 
          message: "Không tìm thấy cửa hàng",
        });
      }

      managerId = store.owner_id;
      subscription = await Subscription.findActiveByUser(managerId);
    } else {
      subscription = await Subscription.findActiveByUser(user._id);
    }

    if (subscription && subscription.status === "ACTIVE" && subscription.is_premium_active) {
      return next();
    }

    return res.status(403).json({
      message: user.role === "STAFF" 
        ? "Chủ cửa hàng cần nâng cấp Premium để sử dụng tính năng này"
        : "Tính năng này chỉ dành cho Premium",
      is_premium: false,
      subscription_status: subscription?.status || "NONE",
      upgrade_url: "/settings/subscription/pricing",
      is_staff: user.role === "STAFF",
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
