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
  createPending,
} = require("../controllers/subscriptionController");

//Tất cả routes yêu cầu verifyToken + requirePermission / Chỉ MANAGER có đủ permissions subscription / STAFF không có subscription riêng

// GET /api/subscriptions/plans – Lấy danh sách gói subscription (public)
router.get("/plans", getPlans);
//MỚI: tạo thêm router post để tạo subscription có trạng thái pending
router.post("/create-pending", verifyToken, requirePermission("subscription:view"), createPending);
// GET /api/subscriptions/current – Subscription hiện tại của user (cần login + subscription:view)
router.get("/current", verifyToken, requirePermission("subscription:view"), getCurrentSubscription);
// POST /api/subscriptions/checkout – Tạo link thanh toán { plan_duration: 1|3|6 } (cần subscription:manage)
router.post("/checkout", verifyToken, requirePermission("subscription:manage"), createCheckout);
// POST /api/subscriptions/activate – Activate premium { plan_duration, amount, transaction_id } (subscription:activate)
router.post("/activate", verifyToken, requirePermission("subscription:activate"), activatePremium);
// POST /api/subscriptions/cancel – Hủy auto-renew (subscription:cancel)
router.post("/cancel", verifyToken, requirePermission("subscription:cancel"), cancelAutoRenew);
// GET /api/subscriptions/history – Lịch sử thanh toán (subscription:history)
router.get("/history", verifyToken, requirePermission("subscription:history"), getPaymentHistory);
// GET /api/subscriptions/usage – Thống kê usage (subscription:view)
router.get("/usage", verifyToken, requirePermission("subscription:view"), getUsageStats);

module.exports = router;
