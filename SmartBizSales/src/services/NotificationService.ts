/**
 * File: src/services/NotificationService.ts
 * -------------------------------------------------
 * Unified Notification Service sử dụng:
 * - expo-notifications: Push notifications hệ thống
 * - react-native-toast-message: In-app toast notifications
 * -------------------------------------------------
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Toast from "react-native-toast-message";
import Constants from "expo-constants";
import apiClient from "../api/apiClient";

// Types
export interface NotificationData {
  _id?: string;
  type: "order" | "payment" | "service" | "system" | "inventory";
  title: string;
  message: string;
  storeId?: string;
  data?: Record<string, any>;
}

export type NotificationHandler = (notification: NotificationData) => void;

// Configure notification behavior khi app ở foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,    // Show alert even when app is in foreground
    shouldPlaySound: true,    // Play sound
    shouldSetBadge: true,     // Update badge count
    shouldShowBanner: true,   // Show banner (iOS 14+)
    shouldShowList: true,     // Show in notification list (iOS 14+)
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private handlers: NotificationHandler[] = [];

  /**
   * Đăng ký push notifications và lấy Expo Push Token
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    // Push notifications chỉ hoạt động trên physical devices
    if (!Device.isDevice) {
      console.log("⚠️ Push notifications require a physical device");
      return null;
    }

    // Kiểm tra và yêu cầu quyền
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("❌ Push notification permission not granted");
      return null;
    }

    try {
      // Lấy Expo Push Token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId 
        ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.warn("⚠️ No projectId found for push notifications");
      }

      const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      token = pushTokenResponse.data;
      this.expoPushToken = token;
      console.log("✅ Expo Push Token:", token);
    } catch (error) {
      console.error("❌ Error getting push token:", error);
      return null;
    }

    // Android: Setup notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Thông báo mặc định",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1890ff",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // Channel cho đơn hàng
      await Notifications.setNotificationChannelAsync("orders", {
        name: "Đơn hàng",
        description: "Thông báo về đơn hàng mới và cập nhật",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#1890ff",
        sound: "default",
      });

      // Channel cho kho hàng
      await Notifications.setNotificationChannelAsync("inventory", {
        name: "Kho hàng",
        description: "Cảnh báo hết hạn, tồn kho thấp",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#ff4d4f",
        sound: "default",
      });
    }

    return token;
  }

  /**
   * Gửi push token lên server để lưu trữ
   */
  async savePushTokenToServer(userId: string): Promise<void> {
    if (!this.expoPushToken) {
      console.warn("⚠️ No push token to save");
      return;
    }

    try {
      await apiClient.post("/users/push-token", {
        userId,
        pushToken: this.expoPushToken,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      });
      console.log("✅ Push token saved to server");
    } catch (error: any) {
      // Không block nếu endpoint chưa có
      console.warn("⚠️ Could not save push token:", error?.response?.data?.message || error.message);
    }
  }

  /**
   * Setup listeners cho notifications
   */
  setupNotificationListeners(
    onReceived?: NotificationHandler,
    onTapped?: NotificationHandler
  ): void {
    // Cleanup existing listeners
    this.removeListeners();

    // Listener khi notification được nhận (app đang mở)
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("📬 Notification received:", notification.request.content.title);
        
        const data: NotificationData = {
          _id: notification.request.identifier,
          type: (notification.request.content.data?.type as NotificationData["type"]) || "system",
          title: notification.request.content.title || "Thông báo mới",
          message: notification.request.content.body || "",
          data: notification.request.content.data as Record<string, any>,
        };

        // Notify handlers
        this.handlers.forEach(handler => handler(data));
        onReceived?.(data);
      }
    );

    // Listener khi user tap vào notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("👆 Notification tapped:", response.notification.request.content.title);
        
        const data: NotificationData = {
          _id: response.notification.request.identifier,
          type: (response.notification.request.content.data?.type as NotificationData["type"]) || "system",
          title: response.notification.request.content.title || "Thông báo mới",
          message: response.notification.request.content.body || "",
          data: response.notification.request.content.data as Record<string, any>,
        };

        onTapped?.(data);
      }
    );
  }

  /**
   * Hiển thị Toast notification trong app
   */
  showToast(notification: NotificationData): void {
    const typeConfig: Record<string, { color: string; icon: string }> = {
      order: { color: "#1890ff", icon: "🛒" },
      payment: { color: "#52c41a", icon: "💳" },
      service: { color: "#faad14", icon: "🔧" },
      system: { color: "#722ed1", icon: "⚙️" },
      inventory: { color: "#ff4d4f", icon: "📦" },
    };

    const config = typeConfig[notification.type] || typeConfig.system;

    Toast.show({
      type: "success", // Use custom type if needed
      text1: `${config.icon} ${notification.title}`,
      text2: notification.message,
      position: "top",
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
      onPress: () => {
        Toast.hide();
        // Có thể trigger navigation hoặc action khác
      },
      props: {
        notificationId: notification._id,
        notificationType: notification.type,
      },
    });
  }

  /**
   * Schedule local notification (để test)
   */
  async scheduleLocalNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const channelId = notification.type === "order" 
      ? "orders" 
      : notification.type === "inventory" 
        ? "inventory" 
        : "default";

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.message,
        data: {
          type: notification.type,
          ...notification.data,
        },
        sound: true,
        badge: 1,
      },
      trigger: trigger || null, // null = immediate
    });

    return id;
  }

  /**
   * Register handler for notifications
   */
  addHandler(handler: NotificationHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync();
  }

  /**
   * Remove listeners when cleaning up
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    this.removeListeners();
    this.handlers = [];
    this.expoPushToken = null;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
