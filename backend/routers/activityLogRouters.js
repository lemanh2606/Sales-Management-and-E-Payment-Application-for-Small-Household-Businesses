// routers/activityLogRouters.js
const express = require("express");
const router = express.Router();
const {
  getActivityLogs,
  getActivityLogDetail,
  getUserActivity,
  getEntityActivity,
  getActivityStats,
} = require("../controllers/activityLogController");
const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");

// 5️⃣ GET /api/activity-logs/stats - Thống kê nhanh
// Query: ?dateFrom=2025-01-01&dateTo=2025-12-31&storeId=...
router.get("/stats", verifyToken, isManager, checkStoreAccess, requirePermission("settings:activity-log"), getActivityStats);
// 3️⃣ GET /api/activity-logs/user/:userId - Log của 1 user
// Query: ?storeId=...&page=1&limit=20&sort=-createdAt
router.get("/user/:userId", verifyToken, isManager, checkStoreAccess, requirePermission("settings:activity-log"), getUserActivity);

// 4️⃣ GET /api/activity-logs/entity/:entity/:entityId - Lịch sử 1 entity
// Query: ?storeId=...&page=1&limit=20&sort=-createdAt
router.get(
  "/entity/:entity",
  verifyToken,
  isManager,
  checkStoreAccess,
  requirePermission("settings:activity-log"),
  getEntityActivity
);
// 2️⃣ GET /api/activity-logs/:id - Chi tiết 1 log
router.get("/:id", verifyToken, isManager, checkStoreAccess, requirePermission("settings:activity-log"), getActivityLogDetail);
// 1️⃣ GET /api/activity-logs - Danh sách log (filter, pagination, sort)
// Query: ?userName=John&action=create&entity=Order&fromDate=2025-01-01&toDate=2025-12-31&keyword=update&page=1&limit=20&sort=-createdAt
router.get("/", verifyToken, isManager, checkStoreAccess, requirePermission("settings:activity-log"), getActivityLogs);

module.exports = router;
