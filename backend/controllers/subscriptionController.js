// controllers/subscriptionController.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const PaymentHistory = require("../models/PaymentHistory");
const { generateQRWithPayOS } = require("../services/payOSService");

// Pricing config
const PRICING = {
  1: { price: 5000, discount: 0, label: "1 tháng" },
  3: { price: 499000, discount: 98000, label: "3 tháng", badge: "Phổ biến" },
  6: { price: 899000, discount: 295000, label: "6 tháng", badge: "Tiết kiệm nhất" },
};

const FRONTEND_BASE_URL = resolveBaseUrl(process.env.APP_PORTAL_URL || process.env.FRONTEND_URL, "http://localhost:5173");
const API_BASE_URL = resolveBaseUrl(
  process.env.PAYOS_PUBLIC_API_URL || process.env.PUBLIC_API_URL || process.env.API_BASE_URL,
  "http://localhost:9999"
);
const SUB_RETURN_URL = process.env.PAYOS_SUB_RETURN_URL || `${FRONTEND_BASE_URL}/subscription/checkout?status=success`;
const SUB_CANCEL_URL = process.env.PAYOS_SUB_CANCEL_URL || `${FRONTEND_BASE_URL}/subscription/checkout?status=cancel`;
const SUB_WEBHOOK_URL = process.env.PAYOS_SUBSCRIPTION_WEBHOOK_URL || `${API_BASE_URL}/api/subscriptions/webhook`;
const DISABLE_WEBHOOK_SIM = process.env.PAYOS_DISABLE_SIMULATION === "true";
const PENDING_TIMEOUT_MS = parseInt(process.env.SUBSCRIPTION_PENDING_TIMEOUT, 10) || 15 * 60 * 1000;

/**
 * GET /api/subscriptions/plans
 * Lấy danh sách gói subscription
 */
const getPlans = async (req, res) => {
  try {
    const plans = Object.keys(PRICING).map((duration) => {
      const plan = PRICING[duration];
      const originalPrice = 5000 * parseInt(duration);
      const discountPercent = plan.discount > 0 ? Math.round((plan.discount / originalPrice) * 100) : 0;

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
        user_role: "STAFF",
      });
    }

    // Chỉ MANAGER mới có subscription
    if (user.role !== "MANAGER") {
      return res.status(403).json({
        message: "Chỉ MANAGER mới có subscription",
        user_role: user.role,
      });
    }

    // Tìm subscription active
    let subscription = await Subscription.findActiveByUser(userId);

    // 🎁 Auto-create trial CHỈ nếu CHƯA TỪNG có subscription nào
    if (!subscription) {
      // Kiểm tra xem có subscription cũ (EXPIRED/CANCELLED) không
      const anySubscription = await Subscription.findOne({ user_id: userId });

      if (!anySubscription) {
        // Chưa từng có subscription → Tạo trial mới
        console.log("🎁 No subscription found, creating trial for MANAGER:", userId);
        try {
          subscription = await Subscription.createTrial(userId);
          console.log("✅ Trial subscription created:", subscription._id);
        } catch (trialErr) {
          console.error("❌ Failed to create trial:", trialErr);
          return res.status(500).json({
            message: "Không thể tạo trial subscription",
            error: trialErr.message,
          });
        }
      } else {
        // Đã từng có subscription → Trả về subscription cũ (EXPIRED/CANCELLED)
        subscription = anySubscription;
        console.log("📋 Found expired/cancelled subscription:", subscription._id, subscription.status);
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

    if (subscription.pending_order_code && isPendingPaymentFresh(subscription)) {
      response.pending_payment = {
        order_code: subscription.pending_order_code,
        plan_duration: subscription.pending_plan_duration,
        amount: subscription.pending_amount,
        checkout_url: subscription.pending_checkout_url,
        qr_data_url: subscription.pending_qr_url,
        created_at: subscription.pending_created_at,
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
    const parsedDuration = parseInt(plan_duration, 10);

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({
        message: "Chỉ MANAGER mới có thể mua subscription",
        user_role: user.role,
      });
    }

    // Validate plan
    if (!PRICING[parsedDuration]) {
      return res.status(400).json({ message: "Gói không hợp lệ" });
    }

    const plan = PRICING[parsedDuration];

    // Lấy hoặc tạo subscription record
    let subscription = await Subscription.findOne({ user_id: userId });
    if (!subscription) {
      subscription = await Subscription.createTrial(userId);
    }

    // Clear pending payment nếu đã quá hạn
    if (subscription.pending_order_code && !isPendingPaymentFresh(subscription)) {
      subscription.clearPendingPayment();
      await subscription.save();
    }

    if (subscription.pending_order_code && isPendingPaymentFresh(subscription)) {
      return res.status(200).json({
        message: "Bạn đang có giao dịch đang chờ thanh toán",
        checkout_url: subscription.pending_checkout_url,
        qr_data_url: subscription.pending_qr_url,
        amount: subscription.pending_amount,
        plan: {
          duration: subscription.pending_plan_duration,
          label: PRICING[subscription.pending_plan_duration]?.label,
          discount: PRICING[subscription.pending_plan_duration]?.discount,
        },
        transaction_id: subscription.pending_order_code,
        pending: true,
      });
    }

    const isRenewal = subscription.status === "ACTIVE" && !subscription.isExpired();

    // Tạo order description
    const orderInfo = `Premium ${plan.label} - User ${userId}`;
    const amount = plan.price;

    // Generate payment link với PayOS
    const paymentData = await generateQRWithPayOS({
      amount,
      orderInfo,
      description: orderInfo,
      returnUrl: SUB_RETURN_URL,
      cancelUrl: SUB_CANCEL_URL,
      webhookUrl: SUB_WEBHOOK_URL,
      simulateWebhook: !DISABLE_WEBHOOK_SIM,
    });

    subscription
      .markPendingPayment({
        orderCode: paymentData.txnRef,
        amount,
        planDuration: parsedDuration,
        checkoutUrl: paymentData.paymentLink,
        qrUrl: paymentData.qrDataURL,
      })
      .set({ duration_months: parsedDuration });

    await subscription.save();

    await PaymentHistory.create({
      user_id: userId,
      subscription_id: subscription._id,
      transaction_id: paymentData.txnRef.toString(),
      plan_duration: parsedDuration,
      amount,
      payment_method: "PAYOS",
      status: "PENDING",
      paid_at: null,
      notes: isRenewal
        ? `Gia hạn gói ${parsedDuration} tháng - PayOS (chờ xác nhận)`
        : `Kích hoạt gói ${parsedDuration} tháng - PayOS (chờ xác nhận)`,
    });

    res.json({
      message: "Đã tạo link thanh toán",
      checkout_url: paymentData.paymentLink,
      qr_data_url: paymentData.qrDataURL,
      amount: plan.price,
      plan: {
        duration: parsedDuration,
        label: plan.label,
        discount: plan.discount,
      },
      transaction_id: paymentData.txnRef.toString(),
      pending: true,
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
    const parsedDuration = parseInt(plan_duration, 10);

    console.log("Activate premium request:", { userId, plan_duration, amount, transaction_id });

    // Check role MANAGER
    const user = await User.findById(userId).select("role");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    if (user.role !== "MANAGER") {
      return res.status(403).json({
        message: "Chỉ MANAGER mới có thể kích hoạt subscription",
        user_role: user.role,
      });
    }

    if (!parsedDuration || !amount || !transaction_id) {
      return res.status(400).json({ message: "Thiếu thông tin plan_duration, amount hoặc transaction_id" });
    }

    // Validate plan
    if (!PRICING[parsedDuration]) {
      return res.status(400).json({ message: "Gói không hợp lệ" });
    }

    // Check subscription hiện tại (bao gồm cả EXPIRED)
    let subscription = await Subscription.findOne({ user_id: userId });

    if (!subscription) {
      console.log("Creating new subscription for user:", userId);
      subscription = await Subscription.createTrial(userId);
    } else {
      console.log("Found existing subscription:", subscription._id, "status:", subscription.status);
    }

    // Clear pending payment metadata nếu có
    if (subscription.pending_order_code) {
      subscription.clearPendingPayment();
    }

    // Check nếu đang ACTIVE và chưa expired -> Gia hạn
    const isRenewal = subscription.status === "ACTIVE" && !subscription.isExpired();

    if (isRenewal) {
      subscription.extendPremium(parsedDuration);
      subscription.auto_renew = false;
      console.log(`🔄 GIA HẠN: +${parsedDuration} tháng cho subscription ${subscription._id}`);
    } else {
      subscription.activatePremium(parsedDuration);
      console.log(`✨ ${subscription._id ? "KÍCH HOẠT LẠI" : "KÍCH HOẠT MỚI"}: ${parsedDuration} tháng`);
    }

    await subscription.save();

    // Update user is_premium flag (direct update - không cần load lại document)
    await User.findByIdAndUpdate(userId, { is_premium: true });

    // ✅ Lưu vào lịch sử thanh toán
    const paymentHistory = new PaymentHistory({
      user_id: userId,
      subscription_id: subscription._id,
      transaction_id,
      plan_duration: parsedDuration,
      amount,
      payment_method: "MANUAL",
      status: "SUCCESS",
      paid_at: new Date(),
      notes: isRenewal ? `Gia hạn thêm ${parsedDuration} tháng - MANUAL` : `Kích hoạt gói ${parsedDuration} tháng - MANUAL`,
    });
    await paymentHistory.save();
    console.log("💾 Saved PaymentHistory:", paymentHistory._id, "for user_id:", userId);

    console.log(`✅ ${isRenewal ? "GIA HẠN" : "KÍCH HOẠT"} premium cho user ${userId}, expires ${subscription.expires_at}`);

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
        user_role: user.role,
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
        user_role: user.role,
      });
    }

    // Query từ PaymentHistory collection - Mongoose tự cast string sang ObjectId
    const history = await PaymentHistory.find({ user_id: userId })
      .sort({ paid_at: -1 }) // Sắp xếp mới nhất lên đầu
      .lean();

    // console.log("📊 Found payment history:", history.length, "records");
    // if (history.length > 0) {
    //   console.log("Sample record:", JSON.stringify(history[0], null, 2));
    // }

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
        user_role: user.role,
      });
    }

    // Đếm số lượng stores, products, orders của user
    const Store = require("../models/Store");
    const Product = require("../models/Product");
    const Order = require("../models/Order");

    const stores = await Store.find({ owner_id: userId }).countDocuments();

    // Lấy tất cả store IDs của user
    const userStores = await Store.find({ owner_id: userId }).select("_id");
    const storeIds = userStores.map((s) => s._id);

    const products = await Product.find({
      store_id: { $in: storeIds },
      isDeleted: false,
    }).countDocuments();

    const orders = await Order.find({
      storeId: { $in: storeIds },
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

const createPending = async (req, res) => {
  try {
    const userId = req.user._id;
    const { plan_duration } = req.body;

    const amount = plan_duration * 5000;
    const orderCode = Date.now();

    const pending = await Subscription.create({
      user_id: userId,
      status: "PENDING",
      pending_plan_duration: plan_duration, // thêm dòng này
      pending_amount: amount, // thêm dòng này
      pending_order_code: orderCode, // đổi từ order_code → pending_order_code
      pending_created_at: new Date(), // thêm dòng này (tùy chọn, để timeout sau)
    });

    return res.json({
      success: true,
      data: {
        order_code: orderCode,
        plan_duration,
        amount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating pending subscription" });
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
  createPending,
};

function resolveBaseUrl(value, fallback) {
  const base = value || fallback || "";
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function isPendingPaymentFresh(subscription) {
  if (!subscription || !subscription.pending_order_code) {
    return false;
  }

  if (!subscription.pending_created_at) {
    return true;
  }

  const age = Date.now() - subscription.pending_created_at.getTime();
  return age < PENDING_TIMEOUT_MS;
}
