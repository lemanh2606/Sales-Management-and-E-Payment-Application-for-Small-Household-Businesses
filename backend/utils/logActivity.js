// utils/logActivity.js
const ActivityLog = require("../models/ActivityLog");

/**
 * Ghi lại hoạt động của user
 * @param {Object} params
 * @param {Object} params.user - req.user (phải có _id, fullName, role)
 * @param {String} params.action - create | update | delete | restore | other
 * @param {String} params.entity - Order, Product, PaymentMethod,...
 * @param {ObjectId|String} params.entityId
 * @param {String} params.entityName
 * @param {Object} [params.changes] - { old: ..., new: ... } (tùy chọn)
 * @param {Object} params.store - req.store (phải có _id)
 * @param {Object} [params.req] - để lấy IP, userAgent
 * @param {String} [params.description] - mô tả thêm
 */
const logActivity = async ({
  user,
  action,
  entity,
  entityId,
  entityName,
  changes = null,
  store, // ← có thể null
  req = null,
  description = null,
}) => {
  try {
    // Validate required
    if (!user?._id) {
      console.warn("Thiếu user khi ghi log");
      return;
    }

    // Nếu không có store VÀ action là "auth" → cho phép ghi log (login/logout toàn hệ thống)
    if (!store && action !== "auth") {
      console.warn("Thiếu store khi ghi log (không phải auth)");
      return;
    }

    const log = new ActivityLog({
      user: user._id,
      userName: user.fullName || user.email || "Unknown",
      userRole: user.role,
      action,
      entity,
      entityId,
      entityName,
      description: description || (action === "auth" ? "Đăng nhập vào hệ thống" : undefined),
      store: store?._id || null, // ← cho phép null
      ip: req?.ip || req?.connection?.remoteAddress || req?.headers["x-forwarded-for"]?.split(",")[0] || "unknown",
      userAgent: req?.headers["user-agent"] || "unknown",
    });

    // Nếu có changes → lưu vào description hoặc để riêng - tuỳ
    if (changes && !description) {
      log.description = JSON.stringify(changes);
    }

    
    // Trong logActivity.js – THÊM DÒNG NÀY
console.log("ĐANG GHI LOG:", {
 userName: user.fullname || user.username || user.email || "Unknown",
  action,
  store: store?._id || null
});


    await log.save();
  } catch (error) {
    console.error("Lỗi ghi Activity Log:", error.message);
    // Không throw -> không làm crash API
  }
};

module.exports = logActivity;
