import Notification from "../models/Notification.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { sendPushToManager } from "../services/pushNotificationService.js";

/**
 * Lấy danh sách thông báo (phân trang, lọc)
 * - Luôn giới hạn theo cửa hàng đang chọn (từ middleware checkStoreAccess)
 * - Hỗ trợ lọc theo type, trạng thái đã đọc, sắp xếp
 */
export const listNotifications = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId; // checkStoreAccess gắn vào req
    const { type, read, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    if (!storeId)
      return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    const filter = { storeId };

    // PHÂN QUYỀN:
    // - MANAGER: được xem tất cả thông báo thuộc storeId (bao gồm cả inventory)
    // - Các role khác: chỉ xem thông báo của chính mình (userId) và KHÔNG được xem inventory
    if (req.user?.role !== "MANAGER") {
      filter.userId = req.user?._id;
      filter.type = { $ne: "inventory" };
    }

    if (type) {
      // Nếu user lọc theo type, ta vẫn phải tôn trọng logic phân quyền ở trên
      if (req.user?.role !== "MANAGER" && type === "inventory") {
        // Staff cố tình lọc inventory -> Không trả về gì hoặc ép $ne
        filter.type = "none";
      } else {
        filter.type = type;
      }
    }

    if (read === "true") filter.read = true;
    if (read === "false") filter.read = false;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [total, items] = await Promise.all([
      Notification.countDocuments(filter),
      Notification.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate({ path: "userId", select: "fullname" })
        .lean(),
    ]);

    return res.json({
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit) || 1),
      },
    });
  } catch (err) {
    console.error("⚠️ Lỗi khi tải danh sách thông báo:", err);
    return res.status(500).json({ message: "Lỗi tải thông báo" });
  }
};

/**
 * Đếm số thông báo chưa đọc
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId || req.query.storeId;
    if (!storeId)
      return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    const filter = { storeId, read: false };

    // PHÂN QUYỀN: Giống như listNotifications
    if (req.user?.role !== "MANAGER") {
      filter.userId = req.user?._id;
      filter.type = { $ne: "inventory" };
    }

    const count = await Notification.countDocuments(filter);

    return res.json({
      count,
      unreadCount: count, // alias cho compatibility
    });
  } catch (err) {
    console.error("⚠️ Lỗi khi đếm thông báo chưa đọc:", err);
    return res.status(500).json({ message: "Lỗi đếm thông báo" });
  }
};

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { read = true } = req.body;
    const storeId = req.store?._id || req.storeId;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, storeId },
      { read },
      { new: true }
    );

    if (!notif)
      return res.status(404).json({ message: "Không tìm thấy thông báo" });
    return res.json({ data: notif });
  } catch (err) {
    console.error("⚠️ Lỗi khi cập nhật thông báo:", err);
    return res.status(500).json({ message: "Lỗi cập nhật thông báo" });
  }
};

/**
 * Đánh dấu tất cả thông báo trong cửa hàng hiện tại là đã đọc
 */
export const markAllRead = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId || req.query.storeId;
    if (!storeId)
      return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    const filter = { storeId };
    if (req.user?.role !== "MANAGER") {
      filter.userId = req.user?._id;
      filter.type = { $ne: "inventory" };
    }

    const result = await Notification.updateMany(filter, {
      $set: { read: true },
    });

    return res.json({
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
      modifiedCount: result.modifiedCount ?? result.nModified ?? 0,
    });
  } catch (err) {
    console.error("⚠️ Lỗi khi đánh dấu tất cả đã đọc:", err);
    return res.status(500).json({ message: "Lỗi đánh dấu tất cả đã đọc" });
  }
};

/**
 * Xóa hẳn 1 thông báo (xóa cứng)
 */
export const deleteNotification = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId;
    const { id } = req.params;

    const notif = await Notification.findOneAndDelete({ _id: id, storeId });
    if (!notif)
      return res.status(404).json({ message: "Không tìm thấy thông báo" });

    return res.json({ message: "Đã xóa thông báo" });
  } catch (err) {
    console.error("⚠️ Lỗi khi xóa thông báo:", err);
    return res.status(500).json({ message: "Lỗi xóa thông báo" });
  }
};
/**
 * Quét thủ công hàng hết hạn/sắp hết hạn để tạo thông báo cho store hiện tại
 */
export const scanExpiryNotifications = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId;
    if (!storeId)
      return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    // Chỉ manager mới được chạy quét
    if (req.user?.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện thao tác này" });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // 1. Quét sản phẩm sắp/đã hết hạn (có tồn kho)
    const products = await Product.find({
      store_id: storeId,
      status: "Đang kinh doanh",
      isDeleted: false,
      "batches.expiry_date": { $lte: thirtyDaysFromNow },
      "batches.quantity": { $gt: 0 },
    });

    let createdCount = 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (const p of products) {
      const expiringBatches = p.batches.filter(
        (b) =>
          b.expiry_date &&
          new Date(b.expiry_date) <= thirtyDaysFromNow &&
          b.quantity > 0
      );
      const expiredBatches = expiringBatches.filter(
        (b) => new Date(b.expiry_date) <= now
      );

      if (expiringBatches.length > 0) {
        const title =
          expiredBatches.length > 0
            ? "Cảnh báo hàng HẾT HẠN"
            : "Cảnh báo hàng sắp hết hạn";
        const message =
          expiredBatches.length > 0
            ? `Sản phẩm "${p.name}" có ${expiredBatches.length} lô ĐÃ HẾT HẠN. Vui lòng xử lý!`
            : `Sản phẩm "${p.name}" có ${expiringBatches.length} lô sắp hết hạn trong 30 ngày tới.`;

        // Check trùng trong ngày
        const existing = await Notification.findOne({
          storeId,
          userId: req.user._id,
          title,
          message: { $regex: p.name, $options: "i" },
          createdAt: { $gte: startOfDay },
        });

        if (!existing) {
          await Notification.create({
            storeId,
            userId: req.user._id,
            type: "inventory",
            title,
            message,
          });
          createdCount++;

          // 📱 Gửi Push Notification cho Manager
          try {
            await sendPushToManager(storeId, {
              title,
              body: message,
              type: "inventory",
              data: {
                productId: p._id.toString(),
                productName: p.name,
                screen: "ProductDetail",
              },
            });
          } catch (pushErr) {
            console.warn("⚠️ Push notification failed:", pushErr.message);
          }
        }
      }
    }

    return res.json({
      message: `Quét hoàn tất. Đã tạo thêm ${createdCount} thông báo mới.`,
      foundProducts: products.length,
    });
  } catch (err) {
    console.error("⚠️ Lỗi khi quét thông báo hết hạn:", err);
    return res.status(500).json({ message: "Lỗi khi quét thông báo" });
  }
};

/**
 * Test g?i push notification
 * POST /api/notifications/test-push
 */
export const testPushNotification = async (req, res) => {
  const { sendPushToUser } = await import("../services/pushNotificationService.js");
  try {
    const userId = req.user._id;
    console.log(" Testing push notification for user:", userId);

    const result = await sendPushToUser(userId, {
      title: " Test Push Notification",
      body: "��y l� th�ng b�o ki?m tra t? h? th?ng!",
      data: { type: "system" },
    });

    return res.json({
      message: "�� g?i test push notification",
      result,
    });
  } catch (err) {
    console.error(" L?i test push:", err);
    return res.status(500).json({ message: "L?i test push" });
  }
};
