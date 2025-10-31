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
  store,
  req = null,
  description = null,
}) => {
  try {
    // Validate required
    if (!user?._id || !store?._id) {
      console.warn("Thiếu user hoặc store khi ghi log");
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
      description,
      store: store._id,
      ip: req?.ip || req?.connection?.remoteAddress || req?.headers["x-forwarded-for"]?.split(",")[0] || "unknown",
      userAgent: req?.headers["user-agent"] || "unknown",
    });

    // Nếu có changes → lưu vào description hoặc để riêng - tuỳ
    if (changes && !description) {
      log.description = JSON.stringify(changes);
    }

    await log.save();
  } catch (error) {
    console.error("Lỗi ghi Activity Log:", error.message);
    // Không throw -> không làm crash API
  }
};

module.exports = logActivity;