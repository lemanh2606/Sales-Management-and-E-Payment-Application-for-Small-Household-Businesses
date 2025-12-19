// controllers/subscriptionController.js
const Subscription = require("../models/Subscription");
const User = require("../models/User");
const PaymentHistory = require("../models/PaymentHistory");
const { generateQRWithPayOS } = require("../services/payOSService");

// Pricing config
const PRICING = {
  1: { price: 5000, discount: 0, label: "1 tháng", badge: "Rẻ nhất" },
  3: { price: 499000, discount: 98000, label: "3 tháng", badge: "Phổ biến" },
  6: {
    price: 899000,
    discount: 295000,
    label: "6 tháng",
    badge: "Tiết kiệm nhất",
  },
};
//Hàm chuyển tiếng Việt → không dấu
function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim();
}

const FRONTEND_BASE_URL = resolveBaseUrl(
  process.env.APP_PORTAL_URL || process.env.FRONTEND_URL,
  "http://localhost:3000"
);
const API_BASE_URL = resolveBaseUrl(
  process.env.PAYOS_PUBLIC_API_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.API_BASE_URL,
  "http://localhost:9999"
);
const SUB_RETURN_URL = process.env.PAYOS_RETURN_URL;
const SUB_CANCEL_URL = process.env.PAYOS_CANCEL_URL;
const SUB_WEBHOOK_URL = process.env.PAYOS_WEBHOOK_URL;

const DISABLE_WEBHOOK_SIM = process.env.PAYOS_DISABLE_SIMULATION === "true";
const PENDING_TIMEOUT_MS =
  parseInt(process.env.SUBSCRIPTION_PENDING_TIMEOUT, 10) || 15 * 60 * 1000;

/**
 * GET /api/subscriptions/plans
 * Lấy danh sách gói subscription
 */
const getPlans = async (req, res) => {
  try {
    const plans = Object.keys(PRICING).map((duration) => {
      const plan = PRICING[duration];
      const originalPrice = 5000 * parseInt(duration);
      const discountPercent =
        plan.discount > 0
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
 * GET /api/subscriptions/curren
 * Lấy thông tin subscription hiện tại của user
 */
const getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Chưa đăng nhập hoặc token không hợp lệ" });
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
        message:
          "STAFF không có subscription riêng. Subscription do Manager quản lý.",
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
        console.log(
          "🎁 No subscription found, creating trial for MANAGER:",
          userId
        );
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
        console.log(
          "📋 Found expired/cancelled subscription:",
          subscription._id,
          subscription.status
        );
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

    if (
      subscription.pending_order_code &&
      isPendingPaymentFresh(subscription)
    ) {
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
    const user = await User.findById(userId).select("role fullname");

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
    if (
      subscription.pending_order_code &&
      !isPendingPaymentFresh(subscription)
    ) {
      subscription.clearPendingPayment();
      await subscription.save();
    }

    if (
      subscription.pending_order_code &&
      isPendingPaymentFresh(subscription)
    ) {
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

    const isRenewal =
      subscription.status === "ACTIVE" && !subscription.isExpired();

    // Convert fullname
    const rawFullname = user.fullname || "";
    const fullnameNoAccent = removeVietnameseTones(rawFullname);
    //lấy 6 ký tự cuối của ObjectId
    const shortId = String(userId).slice(-6);

    // Tạo order description. Mô tả thanh toán mới
    const orderInfo = `Premium ${plan.label} UID ${shortId} ${fullnameNoAccent}`;
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
      return res
        .status(401)
        .json({ message: "Chưa đăng nhập hoặc token không hợp lệ" });
    }

    const { plan_duration, amount, transaction_id } = req.body;
    const parsedDuration = parseInt(plan_duration, 10);

    console.log("Activate premium request:", {
      userId,
      plan_duration,
      amount,
      transaction_id,
    });

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
      return res.status(400).json({
        message: "Thiếu thông tin plan_duration, amount hoặc transaction_id",
      });
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
      console.log(
        "Found existing subscription:",
        subscription._id,
        "status:",
        subscription.status
      );
    }

    // Clear pending payment metadata nếu có
    if (subscription.pending_order_code) {
      subscription.clearPendingPayment();
    }

    // Check nếu đang ACTIVE và chưa expired -> Gia hạn
    const isRenewal =
      subscription.status === "ACTIVE" && !subscription.isExpired();

    if (isRenewal) {
      subscription.extendPremium(parsedDuration);
      subscription.auto_renew = false;
      console.log(
        `🔄 GIA HẠN: +${parsedDuration} tháng cho subscription ${subscription._id}`
      );
    } else {
      subscription.activatePremium(parsedDuration);
      console.log(
        `✨ ${
          subscription._id ? "KÍCH HOẠT LẠI" : "KÍCH HOẠT MỚI"
        }: ${parsedDuration} tháng`
      );
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
      notes: isRenewal
        ? `Gia hạn thêm ${parsedDuration} tháng - MANUAL`
        : `Kích hoạt gói ${parsedDuration} tháng - MANUAL`,
    });
    await paymentHistory.save();
    console.log(
      "💾 Saved PaymentHistory:",
      paymentHistory._id,
      "for user_id:",
      userId
    );

    console.log(
      `✅ ${
        isRenewal ? "GIA HẠN" : "KÍCH HOẠT"
      } premium cho user ${userId}, expires ${subscription.expires_at}`
    );

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
    console.log(
      "🔍 getPaymentHistory - userId:",
      userId,
      "type:",
      typeof userId
    );

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
// controllers/subscriptionController.js
// Assumptions:
// - PaymentHistory.transaction_id có unique index
// - PaymentHistory.status enum có 'FAILED' (vì bạn chưa có 'CANCELLED')
// - Subscription có các field: pending_order_code, pending_amount, pending_checkout_url, pending_plan_duration, pending_created_at, pending_qr_code

const clearPendingPayment = async (req, res) => {
  try {
    let userId;

    // 1) From req.user
    if (req.user && req.user._id) userId = req.user._id;
    // 2) From body
    else if (req.body && req.body.userId) userId = req.body.userId;
    // 3) From query
    else if (req.query && req.query.userId) userId = req.query.userId;

    console.log(`🔍 Processing userId: ${userId || "ALL"}`);

    // =============== CASE 1: clear theo user ===============
    if (userId) {
      // 0) Lấy subscription TRƯỚC khi clear để còn pending_order_code
      const subscription = await Subscription.findOne({
        user_id: userId,
      }).lean();
      if (!subscription) {
        return res
          .status(404)
          .json({ success: false, message: "Subscription not found" });
      }

      const pendingOrderCode = subscription?.pending_order_code;
      const pendingAmount = subscription?.pending_amount ?? 0;
      const pendingPlanDuration = subscription?.pending_plan_duration ?? null;
      const pendingCreatedAt = subscription?.pending_created_at ?? new Date();

      // 1) Nếu có pending order => update PaymentHistory status = FAILED (idempotent, không duplicate)
      if (pendingOrderCode) {
        await PaymentHistory.updateOne(
          // filter theo unique transaction_id
          { transaction_id: String(pendingOrderCode) },
          {
            // luôn update thành FAILED (bạn có thể map FAILED -> "Đã hủy" ở UI)
            $set: {
              status: "FAILED",
              updatedAt: new Date(),
              notes: `Giao dịch bị hủy - PayOS (${pendingOrderCode})`,
            },
            // chỉ set khi insert lần đầu
            $setOnInsert: {
              user_id: userId,
              subscription_id: subscription._id,
              transaction_id: String(pendingOrderCode),
              amount: pendingAmount,
              plan_duration: pendingPlanDuration,
              payment_method: "PAYOS",
              createdAt: pendingCreatedAt,
              paid_at: null,
            },
          },
          { upsert: true }
        );
      }

      // 2) Clear pending_* (sau khi đã ghi history)
      const result = await Subscription.updateOne(
        { user_id: userId },
        {
          $set: {
            pending_order_code: null,
            pending_amount: null,
            pending_checkout_url: null,
            pending_plan_duration: null,
            pending_created_at: null,
            pending_qr_code: null,
          },
        }
      );

      console.log(
        `🗑️ Cleared pending for user: ${userId}. matched=${result.matchedCount}, modified=${result.modifiedCount}`
      );

      return res.json({
        success: true,
        message: `Đã clear pending payment cho user ${userId}${
          pendingOrderCode
            ? ` + cập nhật PaymentHistory(${pendingOrderCode})=FAILED`
            : ""
        }`,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        pendingOrderCode: pendingOrderCode || null,
      });
    }

    // =============== CASE 2: clear ALL expired (> 30 phút) ===============
    console.log("🧹 Clearing ALL expired pending payments");
    const cleared = await clearAllExpiredPendingPayments();

    return res.json({
      success: true,
      message:
        "Đã dọn tất cả pending payment quá hạn + cập nhật PaymentHistory",
      ...cleared,
    });
  } catch (error) {
    console.error("Clear pending error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// const clearPendingPayment = async (req, res) => {
//   try {
//     let userId;

//     // 1. Từ req.user (middleware)
//     if (req.user && req.user._id) {
//       userId = req.user._id;
//     }
//     // 2. Từ req.body
//     else if (req.body && req.body.userId) {
//       userId = req.body.userId;
//     }
//     // 3. Từ query
//     else if (req.query && req.query.userId) {
//       userId = req.query.userId;
//     }

//     console.log(`🔍 Processing userId: ${userId || "ALL"}`);

//     if (userId) {
//       // ✅ SPECIFIC USER - XÓA TẤT CẢ pending của user (không check expired)
//       const result = await Subscription.updateOne(
//         { user_id: userId },
//         {
//           pending_order_code: null,
//           pending_amount: null,
//           pending_checkout_url: null,
//           pending_plan_duration: null,
//           pending_created_at: null,
//           pending_qr_code: null,
//         }
//       );

//       console.log(
//         `🗑️ Cleared ${result.modifiedCount} pending records for user: ${userId}`
//       );

//       if (result.modifiedCount > 0) {
//         // Tạo FAILED PaymentHistory nếu có orderCode
//         const subscription = await Subscription.findOne({ user_id: userId });
//         const pendingOrderCode = subscription?.pending_order_code;

//         if (pendingOrderCode) {
//           // ... logic PaymentHistory như cũ
//           console.log(`📝 Created FAILED history for: ${pendingOrderCode}`);
//         }
//       }

//       return res.json({
//         success: true,
//         message: `Đã xóa ${result.modifiedCount} pending payment cho user ${userId}`,
//         modifiedCount: result.modifiedCount,
//       });
//     }

//     // 4. FALLBACK - Clear ALL expired (> 30 phút)
//     console.log("🧹 Clearing ALL expired pending payments");
//     await clearAllExpiredPendingPayments();

//     res.json({
//       success: true,
//       message: "Đã dọn tất cả pending payment quá hạn",
//     });
//   } catch (error) {
//     console.error("Clear pending error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// // ✅ Helper - chỉ clear expired
// const clearAllExpiredPendingPayments = async () => {
//   const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

//   const result = await Subscription.updateMany(
//     {
//       pending_order_code: { $ne: null },
//       pending_created_at: { $lt: thirtyMinutesAgo },
//     },
//     {
//       $unset: {
//         // ✅ $unset thay vì set null
//         pending_order_code: "",
//         pending_amount: "",
//         pending_checkout_url: "",
//         pending_plan_duration: "",
//         pending_created_at: "",
//         pending_qr_code: "",
//       },
//     }
//   );

//   console.log(
//     `🧹 Auto-cleared ${result.modifiedCount} expired pending payments`
//   );
// };

module.exports = {
  getPlans,
  getCurrentSubscription,
  createCheckout,
  activatePremium,
  cancelAutoRenew,
  getPaymentHistory,
  getUsageStats,
  createPending,
  clearPendingPayment,
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
