//backend/routers/notificationRouters.js
const express = require("express");
const {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  scanExpiryNotifications,
} = require("../controllers/notificationController");
const {
  verifyToken,
  checkStoreAccess,
} = require("../middlewares/authMiddleware");
const router = express.Router();

/**
 * 📬 Lấy danh sách thông báo
 * GET /api/notifications
 * Query hỗ trợ:
 *  - type (order | payment | service | system)
 *  - read=true/false
 *  - page, limit
 */
router.get("/", verifyToken, checkStoreAccess, listNotifications);

// Đếm số thông báo chưa đọc - cần đặt trước các route có params
router.get("/unread-count", verifyToken, checkStoreAccess, getUnreadCount);

// quét thủ công hàng hết hạn
router.post(
  "/scan-expiry",
  verifyToken,
  checkStoreAccess,
  scanExpiryNotifications
);

//đánh dấu tất cả thông báo là đã đọc
router.patch("/read-all", verifyToken, checkStoreAccess, markAllRead);

//đánh dấu 1 thông báo là đã đọc
router.patch("/:id/read", verifyToken, checkStoreAccess, markNotificationRead);

//xoá thông báo nếu cần, xoá cứng không phải xoá mềm
router.delete("/:id", verifyToken, checkStoreAccess, deleteNotification);

module.exports = router;
