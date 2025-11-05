// routers/subscriptionRouters.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");

const {
  getPlans,
  getCurrentSubscription,
  createCheckout,
  activatePremium,
  cancelAutoRenew,
  getPaymentHistory,
  getUsageStats,
} = require("../controllers/subscriptionController");

/*
  GHI CHÚ VỀ PHÂN QUYỀN SUBSCRIPTION ROUTES:
  - Hầu hết routes yêu cầu verifyToken (user đã đăng nhập)
  - activatePremium có thể gọi từ webhook (internal) nên có thể public
    hoặc protect bằng secret key
*/

/**
 * GET /api/subscriptions/plans
 * Lấy danh sách các gói subscription (public)
 */
router.get("/plans", getPlans);

/**
 * GET /api/subscriptions/current
 * Lấy thông tin subscription hiện tại của user
 * Yêu cầu: Đăng nhập
 */
router.get("/current", verifyToken, getCurrentSubscription);

/**
 * POST /api/subscriptions/checkout
 * Tạo link thanh toán cho subscription
 * Body: { plan_duration: 1|3|6 }
 * Yêu cầu: Đăng nhập
 */
router.post("/checkout", verifyToken, createCheckout);

/**
 * POST /api/subscriptions/activate
 * Activate premium sau payment thành công
 * Body: { plan_duration, amount, transaction_id }
 * Note: Yêu cầu đăng nhập (user_id lấy từ req.user)
 */
router.post("/activate", verifyToken, activatePremium);

/**
 * POST /api/subscriptions/cancel
 * Hủy auto-renew
 * Yêu cầu: Đăng nhập
 */
router.post("/cancel", verifyToken, cancelAutoRenew);

/**
 * GET /api/subscriptions/history
 * Lấy lịch sử thanh toán subscription
 * Yêu cầu: Đăng nhập
 */
router.get("/history", verifyToken, getPaymentHistory);

/**
 * GET /api/subscriptions/usage
 * Thống kê sử dụng (stores, products, orders)
 * Yêu cầu: Đăng nhập
 */
router.get("/usage", verifyToken, getUsageStats);

module.exports = router;
