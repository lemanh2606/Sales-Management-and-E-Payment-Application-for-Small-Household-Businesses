/**
 * File: services/pushNotificationService.js
 * -------------------------------------------------
 * Push Notification Service sử dụng Expo Server SDK
 * Gửi push notifications đến thiết bị Android/iOS
 * -------------------------------------------------
 */

const { Expo } = require("expo-server-sdk");
const User = require("../models/User");

// Tạo Expo client instance
const expo = new Expo();

/**
 * Gửi push notification đến một user cụ thể
 * @param {string} userId - ID của user
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Kết quả gửi notification
 */
const sendPushToUser = async (userId, notification) => {
  try {
    // Tìm user và lấy push token
    const user = await User.findById(userId).select("pushToken username");

    if (!user || !user.pushToken) {
      console.log(`⚠️ User ${userId} không có push token`);
      return { success: false, reason: "no_push_token" };
    }

    // Validate Expo push token
    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.log(
        `❌ Push token không hợp lệ cho user ${userId}: ${user.pushToken}`
      );
      return { success: false, reason: "invalid_token" };
    }

    // Tạo message
    const message = {
      to: user.pushToken,
      sound: "default",
      title: notification.title,
      body: notification.body || notification.message,
      data: notification.data || {},
      priority: "high",
      channelId: notification.channelId || "default",
    };

    // Gửi notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("❌ Lỗi gửi push notification chunk:", error);
      }
    }

    console.log(
      `✅ Push notification sent to user ${user.username}:`,
      notification.title
    );
    return { success: true, tickets };
  } catch (error) {
    console.error("❌ Lỗi sendPushToUser:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi push notification đến nhiều users (theo storeId)
 * @param {string} storeId - ID của store
 * @param {object} notification - { title, body, data, type }
 * @param {object} options - { excludeUserId, roles }
 * @returns {Promise<object>} - Kết quả gửi notification
 */
const sendPushToStore = async (storeId, notification, options = {}) => {
  try {
    const { excludeUserId, roles } = options;

    // Tìm tất cả users thuộc store có push token
    const query = {
      storeId: storeId,
      pushToken: { $exists: true, $ne: null },
    };

    // Loại trừ user cụ thể nếu cần
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    // Lọc theo role nếu cần
    if (roles && roles.length > 0) {
      query.role = { $in: roles };
    }

    const users = await User.find(query).select("pushToken username role");

    if (users.length === 0) {
      console.log(`⚠️ Không có user nào trong store ${storeId} có push token`);
      return { success: false, reason: "no_users_with_token" };
    }

    // Lọc các push token hợp lệ
    const validTokens = users
      .filter((user) => Expo.isExpoPushToken(user.pushToken))
      .map((user) => user.pushToken);

    if (validTokens.length === 0) {
      console.log(`⚠️ Không có push token hợp lệ trong store ${storeId}`);
      return { success: false, reason: "no_valid_tokens" };
    }

    // Tạo messages
    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title: notification.title,
      body: notification.body || notification.message,
      data: {
        type: notification.type || "system",
        storeId: storeId,
        ...notification.data,
      },
      priority: "high",
      channelId: getChannelId(notification.type),
    }));

    // Gửi notifications theo chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("❌ Lỗi gửi push notification chunk:", error);
      }
    }

    console.log(
      `✅ Push notification sent to ${validTokens.length} users in store:`,
      notification.title
    );

    return {
      success: true,
      sentCount: validTokens.length,
      tickets,
    };
  } catch (error) {
    console.error("❌ Lỗi sendPushToStore:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Gửi push notification đến Manager của store
 * @param {string} storeId - ID của store
 * @param {object} notification - { title, body, data }
 */
const sendPushToManager = async (storeId, notification) => {
  return sendPushToStore(storeId, notification, {
    roles: ["MANAGER"],
  });
};

/**
 * Gửi push notification khi có đơn hàng mới
 * @param {string} storeId - ID của store
 * @param {object} order - Order object
 */
const sendOrderNotification = async (storeId, order) => {
  const notification = {
    title: "🛒 Đơn hàng mới",
    body: `Đơn #${
      order.orderCode || order._id.toString().slice(-6)
    } - ${formatCurrency(order.totalAmount)}`,
    type: "order",
    data: {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      screen: "OrderDetail",
    },
  };

  return sendPushToStore(storeId, notification);
};

/**
 * Gửi push notification khi thanh toán thành công
 * @param {string} storeId - ID của store
 * @param {object} order - Order object
 */
const sendPaymentSuccessNotification = async (storeId, order) => {
  const notification = {
    title: "💳 Thanh toán thành công",
    body: `Đơn #${
      order.orderCode || order._id.toString().slice(-6)
    } đã thanh toán ${formatCurrency(order.totalAmount)}`,
    type: "payment",
    data: {
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      screen: "OrderDetail",
    },
  };

  return sendPushToStore(storeId, notification);
};

/**
 * Gửi push notification cảnh báo tồn kho
 * @param {string} storeId - ID của store
 * @param {object} product - Product object
 * @param {string} alertType - "low_stock" | "expired" | "expiring_soon"
 */
const sendInventoryAlertNotification = async (storeId, product, alertType) => {
  let title, body;

  switch (alertType) {
    case "low_stock":
      title = "📦 Cảnh báo tồn kho thấp";
      body = `Sản phẩm "${product.name}" sắp hết hàng (còn ${product.quantity})`;
      break;
    case "expired":
      title = "⚠️ Hàng hết hạn";
      body = `Sản phẩm "${product.name}" đã hết hạn sử dụng!`;
      break;
    case "expiring_soon":
      title = "⏰ Hàng sắp hết hạn";
      body = `Sản phẩm "${product.name}" sắp hết hạn trong 30 ngày`;
      break;
    default:
      title = "📦 Cảnh báo kho hàng";
      body = `Sản phẩm "${product.name}" cần kiểm tra`;
  }

  const notification = {
    title,
    body,
    type: "inventory",
    data: {
      productId: product._id.toString(),
      alertType,
      screen: "ProductDetail",
    },
  };

  // Chỉ gửi cho Manager
  return sendPushToManager(storeId, notification);
};

/**
 * Gửi push notification tùy chỉnh
 * @param {string} storeId - ID của store
 * @param {object} notification - { title, body, type, data }
 * @param {object} options - { excludeUserId, roles, userId }
 */
const sendCustomNotification = async (storeId, notification, options = {}) => {
  // Nếu chỉ gửi cho 1 user cụ thể
  if (options.userId) {
    return sendPushToUser(options.userId, notification);
  }

  // Gửi cho store
  return sendPushToStore(storeId, notification, options);
};

// ===================== HELPER FUNCTIONS =====================

/**
 * Lấy channel ID dựa trên type
 */
const getChannelId = (type) => {
  const channelMap = {
    order: "orders",
    payment: "orders",
    inventory: "inventory",
    system: "default",
    service: "default",
  };
  return channelMap[type] || "default";
};

/**
 * Format số tiền VND
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
};

/**
 * Xử lý receipts từ Expo (kiểm tra trạng thái gửi)
 * Nên chạy định kỳ để clear invalid tokens
 */
const handlePushReceipts = async (tickets) => {
  const receiptIds = tickets
    .filter((ticket) => ticket.id)
    .map((ticket) => ticket.id);

  if (receiptIds.length === 0) return;

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const receiptId in receipts) {
        const { status, message, details } = receipts[receiptId];

        if (status === "error") {
          console.error(`❌ Push notification error: ${message}`);

          if (details && details.error === "DeviceNotRegistered") {
            // Token không còn valid - có thể xóa khỏi database
            console.log("⚠️ Device not registered - should remove token");
          }
        }
      }
    } catch (error) {
      console.error("❌ Lỗi khi lấy push receipts:", error);
    }
  }
};

module.exports = {
  sendPushToUser,
  sendPushToStore,
  sendPushToManager,
  sendOrderNotification,
  sendPaymentSuccessNotification,
  sendInventoryAlertNotification,
  sendCustomNotification,
  handlePushReceipts,
};
