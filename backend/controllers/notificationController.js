//backend/controllers/notificationController.js
import Notification from "../models/Notification.js";

/**
 * Lấy danh sách thông báo (phân trang, lọc)
 * - Luôn giới hạn theo cửa hàng đang chọn (từ middleware checkStoreAccess)
 * - Hỗ trợ lọc theo type, trạng thái đã đọc, sắp xếp
 */
export const listNotifications = async (req, res) => {
  try {
    const storeId = req.store?._id || req.storeId; // checkStoreAccess gắn vào req
    const { type, read, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    if (!storeId) return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    const filter = { storeId };
    if (type) filter.type = type;
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

    if (!notif) return res.status(404).json({ message: "Không tìm thấy thông báo" });
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
    const storeId = req.store?._id || req.storeId;
    if (!storeId) return res.status(400).json({ message: "Thiếu thông tin cửa hàng" });

    const result = await Notification.updateMany({ storeId }, { $set: { read: true } });

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
    if (!notif) return res.status(404).json({ message: "Không tìm thấy thông báo" });

    return res.json({ message: "Đã xóa thông báo" });
  } catch (err) {
    console.error("⚠️ Lỗi khi xóa thông báo:", err);
    return res.status(500).json({ message: "Lỗi xóa thông báo" });
  }
};
