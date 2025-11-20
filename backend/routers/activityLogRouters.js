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
router.get("/", verifyToken, isManager, checkStoreAccess, requirePermission("settings:activity-log"), getActivityLogs);

// BÁO CÁO VÀO CA HÔM NAY – KHÔNG CẦN checkStoreAccess
router.get(
  "/today-login",
  verifyToken,
  isManager,
  requirePermission("settings:activity-log"),
  async (req, res) => {
    try {
      const { storeId } = req.query;
      if (!storeId) return res.status(400).json({ success: false, message: "Thiếu storeId" });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const logs = await ActivityLog.find({
        store: storeId,
        action: "auth",
        entity: "Store",
        createdAt: { $gte: today, $lt: tomorrow },
      })
        .populate("user", "fullname email role image")
        .sort({ createdAt: -1 })
        .lean();

      // Thêm enrich như enrichedLogs
      const enrichedLogs = logs.map(log => ({
        ...log,
        time: new Date(log.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        badge: log.ip && ["192.168.", "10.0.", "172.16."].some(p => log.ip.startsWith(p)) ? "success" : "warning",
        badgeText: log.ip && ["192.168.", "10.0.", "172.16."].some(p => log.ip.startsWith(p)) ? "Máy quán" : "Máy khác",
      }));

      res.json({ success: true, data: { logs: enrichedLogs } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

module.exports = router;
