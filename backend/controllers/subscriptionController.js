// controllers/subscriptionController.js
const mongoose = require("mongoose");
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const PaymentHistory = require("../models/PaymentHistory");
const { generateQRWithPayOS } = require("../services/payOSService");

// Pricing config
const PRICING = {
  1: { price: 199000, discount: 0, label: "1 tháng" },
  3: { price: 499000, discount: 98000, label: "3 tháng", badge: "Phổ biến" },
  6: { price: 899000, discount: 295000, label: "6 tháng", badge: "Tiết kiệm nhất" },
};

/**
 * GET /api/subscriptions/plans
 * Lấy danh sách gói subscription
 */
const getPlans = async (req, res) => {
  try {
    const plans = Object.keys(PRICING).map((duration) => {
      const plan = PRICING[duration];
      const originalPrice = 199000 * parseInt(duration);
      const discountPercent = plan.discount > 0 
        ? Math.round((plan.discount / originalPrice) * 100)
        : 0;

      return {
        duration: parseInt(duration),
        label: plan.label,
        price: plan.price,
        original_price: originalPrice,
        discount: plan.discount,
        discount_percent: discountPercent,
        price_per_month: Math.round(plan.price / parseInt(duration)),
        badge: plan.badge || null,
      };
    });

    res.json({
      plans,
      trial_days: 14,
      message: "Mua càng dài, tiết kiệm càng nhiều!",
    });
  } catch (error) {
    console.error("Lỗi getPlans:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * GET /api/subscriptions/current
 * Lấy thông tin subscription hiện tại của user
 */
const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ" });
    }

    console.log("Get current subscription for user:", userId);

    // Lấy user info (cần is_premium và role)
    const user = await User.findById(userId).select("is_premium role");

    if (!user) {
      console.log("User not found:", userId);
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    // STAFF không có subscription riêng
    if (user.role === "STAFF") {
      return res.status(403).json({ 
        message: "STAFF không có subscription riêng. Subscription do Manager quản lý.",
        user_role: "STAFF"
      });
    }

    // Chỉ MANAGER mới có subscription
    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có subscription",
        user_role: user.role
      });
    }

    // Tìm subscription active
    let subscription = await Subscription.findActiveByUser(userId);

    // 🎁 Auto-create trial nếu không tìm thấy subscription (chỉ cho MANAGER)
    if (!subscription) {
      console.log("🎁 No subscription found, creating trial for MANAGER:", userId);
      try {
        subscription = await Subscription.createTrial(userId);
        console.log("✅ Trial subscription created:", subscription._id);
      } catch (trialErr) {
        console.error("❌ Failed to create trial:", trialErr);
        return res.status(500).json({ 
          message: "Không thể tạo trial subscription",
          error: trialErr.message 
        });
      }
    }

    // Build response từ Subscription model
    const response = {
      subscription_id: subscription._id,
      status: subscription.status,
      is_premium: user.is_premium,
      days_remaining: subscription.days_remaining,
    };

    if (subscription.status === "TRIAL") {
      response.trial = {
        started_at: subscription.trial_started_at,
        ends_at: subscription.trial_ends_at,
        is_active: subscription.is_trial_active,
      };
    }

    if (subscription.status === "ACTIVE") {
      response.premium = {
        plan_duration: subscription.plan_duration,
        started_at: subscription.started_at,
        expires_at: subscription.expires_at,
        is_active: subscription.is_premium_active,
        auto_renew: subscription.auto_renew,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Lỗi getCurrentSubscription:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * POST /api/subscriptions/checkout
 * Tạo link thanh toán subscription
 * Body: { plan_duration: 1|3|6 }
 * Cái này chưa dùng vì chưa có key PayOS
 */
const createCheckout = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan_duration } = req.body;

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có thể mua subscription",
        user_role: user.role
      });
    }

    // Validate plan
    if (!PRICING[plan_duration]) {
      return res.status(400).json({ message: "Gói không hợp lệ" });
    }

    const plan = PRICING[plan_duration];

    // Kiểm tra subscription hiện tại
    const currentSub = await Subscription.findActiveByUser(userId);
    if (currentSub && currentSub.status === "ACTIVE" && !currentSub.isExpired()) {
      return res.status(400).json({
        message: "Bạn đang có gói Premium active",
        expires_at: currentSub.expires_at,
      });
    }

    // Tạo order description
    const orderInfo = `Premium ${plan.label} - User ${userId}`;
    const amount = plan.price;

    // Generate payment link với PayOS
    const paymentData = await generateQRWithPayOS({
      body: {
        amount,
        orderInfo,
        // Metadata để webhook biết đây là subscription payment
        metadata: {
          type: "SUBSCRIPTION",
          user_id: userId,
          plan_duration,
        },
      },
    });

    // Tạo pending subscription (chờ payment)
    const subscription = new Subscription({
      user_id: userId,
      status: "PENDING", // Chờ payment thành công
      payment_method: "PAYOS",
      plan_duration: plan_duration,
      duration_months: plan_duration, // Alias để webhook query
      price_paid: plan.price,
      discount_amount: plan.discount,
      transaction_id: paymentData.txnRef,
    });

    await subscription.save();

    res.json({
      message: "Đã tạo link thanh toán",
      checkout_url: paymentData.paymentLink,
      qr_data_url: paymentData.qrDataURL,
      amount: plan.price,
      plan: {
        duration: plan_duration,
        label: plan.label,
        discount: plan.discount,
      },
      transaction_id: paymentData.txnRef,
    });
  } catch (error) {
    console.error("Lỗi createCheckout:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * POST /api/subscriptions/activate
 * Activate premium (MANUAL - skip PayOS)
 * Body: { plan_duration, amount, transaction_id }
 * Chỉ cho MANAGER
 */
const activatePremium = async (req, res) => {
  try {
    const userId = req.user?._id; // Từ auth middleware
    
    if (!userId) {
      return res.status(401).json({ message: "Chưa đăng nhập hoặc token không hợp lệ" });
    }

    const { plan_duration, amount, transaction_id } = req.body;

    console.log("Activate premium request:", { userId, plan_duration, amount, transaction_id });

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có thể kích hoạt subscription",
        user_role: user.role
      });
    }

    if (!plan_duration || !amount || !transaction_id) {
      return res.status(400).json({ message: "Thiếu thông tin plan_duration, amount hoặc transaction_id" });
    }

    // Validate plan
    if (!PRICING[plan_duration]) {
      return res.status(400).json({ message: "Gói không hợp lệ" });
    }

    // Check subscription hiện tại
    const currentSub = await Subscription.findActiveByUser(userId);
    
    // ✅ CHO PHÉP GIA HẠN - Nếu đang ACTIVE thì cộng thêm thời gian
    const isRenewal = currentSub && currentSub.status === "ACTIVE" && !currentSub.isExpired();

    // Tạo hoặc update subscription
    let subscription = currentSub;
    if (!subscription) {
      subscription = new Subscription({
        user_id: userId,
        status: "TRIAL",
      });
    }

    if (isRenewal) {
      // ✅ GIA HẠN: Cộng thêm thời gian vào expires_at hiện tại
      const currentExpires = new Date(subscription.expires_at);
      const additionalMonths = plan_duration;
      const newExpires = new Date(currentExpires);
      newExpires.setMonth(newExpires.getMonth() + additionalMonths);
      
      subscription.expires_at = newExpires;
      subscription.plan_duration = plan_duration; // Update plan duration
      subscription.payment_method = "MANUAL";
      
      // Update premium info
      if (!subscription.premium) {
        subscription.premium = {};
      }
      subscription.premium.plan_duration = plan_duration;
      subscription.premium.amount_paid = amount;
      subscription.premium.activated_at = subscription.premium.activated_at || new Date();
      subscription.premium.is_active = true;
      
      console.log(`🔄 GIA HẠN: Cộng thêm ${additionalMonths} tháng. Expires: ${currentExpires} → ${newExpires}`);
    } else {
      // ✅ KÍCH HOẠT MỚI: Dùng method cũ
      subscription.activatePremium(plan_duration, amount, transaction_id);
      subscription.payment_method = "MANUAL";
      console.log(`✨ KÍCH HOẠT MỚI: ${plan_duration} tháng`);
    }
    
    await subscription.save();

    // Update user is_premium flag (direct update - không cần load lại document)
    await User.findByIdAndUpdate(userId, { is_premium: true });

    // ✅ Lưu vào lịch sử thanh toán
    const paymentHistory = new PaymentHistory({
      user_id: userId,
      subscription_id: subscription._id,
      transaction_id,
      plan_duration,
      amount,
      payment_method: "MANUAL",
      status: "SUCCESS",
      paid_at: new Date(),
      notes: isRenewal 
        ? `Gia hạn thêm ${plan_duration} tháng - MANUAL` 
        : `Kích hoạt gói ${plan_duration} tháng - MANUAL`,
    });
    await paymentHistory.save();
    console.log("💾 Saved PaymentHistory:", paymentHistory._id, "for user_id:", userId);

    console.log(`✅ ${isRenewal ? 'GIA HẠN' : 'KÍCH HOẠT'} premium cho user ${userId}, expires ${subscription.expires_at}`);

    res.json({
      message: "Đã kích hoạt Premium thành công",
      subscription: {
        status: subscription.status,
        plan_duration: subscription.plan_duration,
        expires_at: subscription.expires_at,
        days_remaining: subscription.days_remaining,
      },
    });
  } catch (error) {
    console.error("Lỗi activatePremium:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * POST /api/subscriptions/cancel
 * Hủy auto-renew
 */
const cancelAutoRenew = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có thể quản lý subscription",
        user_role: user.role
      });
    }

    const subscription = await Subscription.findActiveByUser(userId);
    if (!subscription) {
      return res.status(404).json({ message: "Không tìm thấy subscription" });
    }

    subscription.auto_renew = false;
    await subscription.save();

    res.json({
      message: "Đã tắt tự động gia hạn",
      subscription: {
        auto_renew: subscription.auto_renew,
        expires_at: subscription.expires_at,
      },
    });
  } catch (error) {
    console.error("Lỗi cancelAutoRenew:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * GET /api/subscriptions/history
 * Lịch sử thanh toán subscription
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("🔍 getPaymentHistory - userId:", userId, "type:", typeof userId);

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có lịch sử thanh toán",
        user_role: user.role
      });
    }

    // Query từ PaymentHistory collection - Mongoose tự cast string sang ObjectId
    const history = await PaymentHistory.find({ user_id: userId })
      .sort({ paid_at: -1 }) // Sắp xếp mới nhất lên đầu
      .lean();

    console.log("📊 Found payment history:", history.length, "records");
    if (history.length > 0) {
      console.log("Sample record:", JSON.stringify(history[0], null, 2));
    }

    // Chuyển đổi format cho frontend
    const formattedHistory = history.map((item) => ({
      plan_duration: item.plan_duration,
      amount: item.amount ? item.amount.toString() : "0",
      paid_at: item.paid_at,
      transaction_id: item.transaction_id,
      payment_method: item.payment_method,
      status: item.status,
      notes: item.notes,
    }));

    res.json({ data: formattedHistory });
  } catch (error) {
    console.error("Lỗi getPaymentHistory:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

/**
 * GET /api/subscriptions/usage
 * Thống kê sử dụng (cho trial users - nếu cần)
 */
const getUsageStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check role MANAGER
    const user = await User.findById(userId).select("role is_premium");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({ 
        message: "Chỉ MANAGER mới có thống kê sử dụng",
        user_role: user.role
      });
    }

    // Đếm số lượng stores, products, orders của user
    const Store = require("../models/Store");
    const Product = require("../models/Product");
    const Order = require("../models/Order");

    const stores = await Store.find({ owner_id: userId }).countDocuments();
    
    // Lấy tất cả store IDs của user
    const userStores = await Store.find({ owner_id: userId }).select("_id");
    const storeIds = userStores.map(s => s._id);

    const products = await Product.find({ 
      store_id: { $in: storeIds },
      isDeleted: false 
    }).countDocuments();

    const orders = await Order.find({ 
      storeId: { $in: storeIds } 
    }).countDocuments();

    res.json({
      usage: {
        stores,
        products,
        orders,
      },
      is_premium: user.is_premium,
    });
  } catch (error) {
    console.error("Lỗi getUsageStats:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  getPlans,
  getCurrentSubscription,
  createCheckout,
  activatePremium,
  cancelAutoRenew,
  getPaymentHistory,
  getUsageStats,
};
