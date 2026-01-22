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
const { sendPushToUser } = require("../services/pushNotificationService"); // Import service trực tiếp
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
router.post("/test-push", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    console.log("🧪 Testing push notification for user:", userId);
    const result = await sendPushToUser(userId, {
      title: "🔔 Test Push Notification",
      body: "Đây là thông báo kiểm tra từ hệ thống! (Nếu thấy thông báo này tức là Push hoạt động)",
      data: { type: "system" },
    });
    return res.json({ message: "Đã gửi test push", result });
  } catch (err) {
    console.error("❌ Lỗi test push:", err);
    return res.status(500).json({ message: "Lỗi test push" });
  }
});

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
