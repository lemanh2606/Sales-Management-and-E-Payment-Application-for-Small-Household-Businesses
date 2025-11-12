// routers/subscriptionRouters.js
const express = require("express");
const router = express.Router();
const { verifyToken, requirePermission } = require("../middlewares/authMiddleware");

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
  - Tất cả routes yêu cầu verifyToken + requirePermission
  - Chỉ MANAGER có đủ permissions subscription
  - STAFF không có subscription riêng
*/

/**
 * GET /api/subscriptions/plans
 * Lấy danh sách các gói subscription (public)
 */
router.get("/plans", getPlans);

/**
 * GET /api/subscriptions/current
 * Lấy thông tin subscription hiện tại của user
 * Yêu cầu: Đăng nhập + permission subscription:view
 */
router.get("/current", verifyToken, requirePermission("subscription:view"), getCurrentSubscription);

/**
 * POST /api/subscriptions/checkout
 * Tạo link thanh toán cho subscription
 * Body: { plan_duration: 1|3|6 }
 * Yêu cầu: Đăng nhập + permission subscription:manage
 */
router.post("/checkout", verifyToken, requirePermission("subscription:manage"), createCheckout);

/**
 * POST /api/subscriptions/activate
 * Activate premium sau payment thành công
 * Body: { plan_duration, amount, transaction_id }
 * Yêu cầu: Đăng nhập + permission subscription:activate
 */
router.post("/activate", verifyToken, requirePermission("subscription:activate"), activatePremium);

/**
 * POST /api/subscriptions/cancel
 * Hủy auto-renew
 * Yêu cầu: Đăng nhập + permission subscription:cancel
 */
router.post("/cancel", verifyToken, requirePermission("subscription:cancel"), cancelAutoRenew);

/**
 * GET /api/subscriptions/history
 * Lấy lịch sử thanh toán subscription
 * Yêu cầu: Đăng nhập + permission subscription:history
 */
router.get("/history", verifyToken, requirePermission("subscription:history"), getPaymentHistory);

/**
 * GET /api/subscriptions/usage
 * Thống kê sử dụng (stores, products, orders)
 * Yêu cầu: Đăng nhập + permission subscription:view
 */
router.get("/usage", verifyToken, requirePermission("subscription:view"), getUsageStats);

module.exports = router;
