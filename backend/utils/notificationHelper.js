/**
 * File: utils/notificationHelper.js
 * -------------------------------------------------
 * Helper function để tạo notification trong DB
 * và gửi push notification cùng lúc
 * -------------------------------------------------
 */

const Notification = require("../models/Notification");
const {
  sendPushToUser,
  sendPushToStore,
  sendPushToManager,
} = require("../services/pushNotificationService");

/**
 * Tạo notification trong DB và gửi push notification
 * @param {object} notificationData - { storeId, userId, type, title, message, data }
 * @param {object} options - { sendPush, pushToStore, pushToManager, excludeUserId }
 * @returns {Promise<object>} - Notification document
 */
const createAndPushNotification = async (notificationData, options = {}) => {
  const {
    storeId,
    userId,
    type = "system",
    title,
    message,
    data = {},
  } = notificationData;

  const {
    sendPush = true,
    pushToStore = false,
    pushToManager = false,
    excludeUserId = null,
    io = null, // Socket.IO instance để emit real-time
  } = options;

  try {
    // 1. Tạo notification trong DB
    const notification = await Notification.create({
      storeId,
      userId,
      type,
      title,
      message,
    });

    console.log(`📬 Notification created: ${title}`);

    // 2. Emit qua Socket.IO (real-time cho app đang mở)
    if (io) {
      io.to(`store_${storeId}`).emit("new_notification", {
        _id: notification._id,
        storeId,
        type,
        title,
        message,
        read: false,
        createdAt: notification.createdAt,
      });
    }

    // 3. Gửi Push Notification (thông báo hệ thống)
    if (sendPush) {
      const pushData = {
        title,
        body: message,
        type,
        data: {
          notificationId: notification._id.toString(),
          ...data,
        },
      };

      if (pushToStore) {
        // Gửi đến tất cả users trong store
        await sendPushToStore(storeId, pushData, { excludeUserId });
      } else if (pushToManager) {
        // Chỉ gửi đến Manager
        await sendPushToManager(storeId, pushData);
      } else if (userId) {
        // Gửi đến user cụ thể
        await sendPushToUser(userId, pushData);
      }
    }

    return notification;
  } catch (error) {
    console.error("❌ Lỗi createAndPushNotification:", error);
    throw error;
  }
};

/**
 * Tạo notification đơn hàng mới
 */
const createOrderNotification = async (storeId, order, io = null) => {
  const orderCode = order.orderCode || order._id.toString().slice(-6);
  const amount = formatCurrency(order.totalAmount);

  return createAndPushNotification(
    {
      storeId,
      userId: order.employee || order.createdBy,
      type: "order",
      title: "🛒 Đơn hàng mới",
      message: `Đơn #${orderCode} - ${amount}`,
      data: {
        orderId: order._id.toString(),
        orderCode,
        screen: "OrderDetail",
      },
    },
    {
      sendPush: true,
      pushToStore: true,
      io,
    }
  );
};

/**
 * Tạo notification thanh toán thành công
 */
const createPaymentNotification = async (storeId, order, io = null) => {
  const orderCode = order.orderCode || order._id.toString().slice(-6);
  const amount = formatCurrency(order.totalAmount);

  return createAndPushNotification(
    {
      storeId,
      userId: order.employee || order.createdBy,
      type: "payment",
      title: "💳 Thanh toán thành công",
      message: `Đơn #${orderCode} đã thanh toán ${amount}`,
      data: {
        orderId: order._id.toString(),
        orderCode,
        screen: "OrderDetail",
      },
    },
    {
      sendPush: true,
      pushToStore: true,
      io,
    }
  );
};

/**
 * Tạo notification cảnh báo tồn kho/hết hạn
 */
const createInventoryNotification = async (
  storeId,
  userId,
  title,
  message,
  io = null
) => {
  return createAndPushNotification(
    {
      storeId,
      userId,
      type: "inventory",
      title,
      message,
    },
    {
      sendPush: true,
      pushToManager: true,
      io,
    }
  );
};

/**
 * Tạo notification hệ thống
 */
const createSystemNotification = async (
  storeId,
  userId,
  title,
  message,
  options = {}
) => {
  return createAndPushNotification(
    {
      storeId,
      userId,
      type: "system",
      title,
      message,
    },
    {
      sendPush: true,
      ...options,
    }
  );
};

// Helper format tiền
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
};

module.exports = {
  createAndPushNotification,
  createOrderNotification,
  createPaymentNotification,
  createInventoryNotification,
  createSystemNotification,
};
