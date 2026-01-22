/**
 * File: src/context/NotificationContext.tsx
 * -------------------------------------------------
 * Context Provider tích hợp:
 * - Push Notifications (expo-notifications)
 * - In-app Toast (react-native-toast-message)
 * - Real-time WebSocket (socket.io-client)
 * -------------------------------------------------
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import notificationService, {
  NotificationData,
} from "../services/NotificationService";
import socketService, {
  SocketNotification,
  ConnectionStatus,
} from "../services/SocketService";
import apiClient from "../api/apiClient";

// Types
export interface NotificationContextValue {
  // State
  unreadCount: number;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;

  // Actions
  refreshUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;

  // Manual trigger (for testing)
  triggerTestNotification: () => void;
}

// Default context value
const defaultContextValue: NotificationContextValue = {
  unreadCount: 0,
  isConnected: false,
  connectionStatus: "disconnected",
  refreshUnreadCount: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  triggerTestNotification: () => {},
};

// Create context
const NotificationContext =
  createContext<NotificationContextValue>(defaultContextValue);

// Provider component
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, token, currentStore } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isInitialized = useRef(false);

  // ========== INITIALIZE NOTIFICATIONS ==========
  useEffect(() => {
    const initializeNotifications = async () => {
      if (!user || !token || isInitialized.current) return;

      console.log("🔔 Initializing notification system...");
      isInitialized.current = true;

      try {
        // 1. Register for push notifications
        const pushToken =
          await notificationService.registerForPushNotificationsAsync();

        if (pushToken && user.id) {
          // 2. Save push token to server
          await notificationService.savePushTokenToServer(user.id);
        }

        // 3. Setup notification listeners
        notificationService.setupNotificationListeners(
          // On notification received (foreground)
          (notification) => {
            console.log("📬 Foreground notification:", notification.title);
            // Show toast for foreground notifications
            notificationService.showToast(notification);
            // Refresh unread count
            refreshUnreadCount();
          },
          // On notification tapped
          (notification) => {
            console.log("👆 User tapped notification:", notification.title);
            // Navigate to notification detail or panel
            // navigationRef.navigate('NotificationSettings');
          }
        );

        console.log("✅ Notification system initialized");
      } catch (error) {
        console.error("❌ Failed to initialize notifications:", error);
      }
    };

    initializeNotifications();

    return () => {
      notificationService.removeListeners();
      isInitialized.current = false;
    };
  }, [user, token]);

  // ========== CONNECT WEBSOCKET ==========
  useEffect(() => {
    if (!currentStore?._id || !token) {
      socketService.disconnect();
      return;
    }

    console.log("🔌 Connecting WebSocket for store:", currentStore.name);
    socketService.connect(currentStore._id, token);

    // Subscribe to connection status
    const unsubConnection = socketService.onConnectionChange((status) => {
      console.log("🔌 Socket status:", status);
      setConnectionStatus(status);
    });

    // Subscribe to new notifications
    const unsubNotification = socketService.onNewNotification(
      (notification: SocketNotification) => {
        console.log("🔔 Real-time notification:", notification.title);

        // Show toast
        notificationService.showToast({
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        });

        // Update unread count
        setUnreadCount((prev) => prev + 1);
      }
    );

    // Cleanup
    return () => {
      unsubConnection();
      unsubNotification();
      socketService.disconnect();
    };
  }, [currentStore?._id, token]);

  // ========== HANDLE APP STATE CHANGES ==========
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // App came to foreground
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("📱 App came to foreground");
        refreshUnreadCount();

        // Reconnect socket if needed
        if (currentStore?._id && token && !socketService.isConnected()) {
          socketService.connect(currentStore._id, token);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [currentStore?._id, token]);

  // ========== FETCH INITIAL UNREAD COUNT ==========
  useEffect(() => {
    if (currentStore?._id) {
      refreshUnreadCount();
    }
  }, [currentStore?._id]);

  // ========== ACTIONS ==========

  /**
   * Refresh unread notification count từ server
   */
  const refreshUnreadCount = useCallback(async () => {
    if (!currentStore?._id) return;

    try {
      const response = await apiClient.get(`/notifications/unread-count`, {
        params: { storeId: currentStore._id },
      });

      const count =
        (response.data as any)?.count ??
        (response.data as any)?.unreadCount ??
        (response.data as any)?.data?.count ??
        0;

      setUnreadCount(count);

      // Update badge
      await notificationService.setBadgeCount(count);
    } catch (error) {
      console.warn("⚠️ Could not fetch unread count:", error);
    }
  }, [currentStore?._id]);

  /**
   * Mark single notification as read
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`, { read: true });
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("❌ Failed to mark as read:", error);
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.patch(`/notifications/read-all`, {});
      setUnreadCount(0);
      await notificationService.setBadgeCount(0);
    } catch (error) {
      console.error("❌ Failed to mark all as read:", error);
    }
  }, []);

  /**
   * Trigger test notification (for development)
   */
  const triggerTestNotification = useCallback(() => {
    console.log("🧪 Triggering test notification...");

    const testNotification: NotificationData = {
      _id: `test-${Date.now()}`,
      type: "order",
      title: "🎉 Test Notification",
      message: "Đây là thông báo test để kiểm tra hệ thống hoạt động",
    };

    // Show toast
    notificationService.showToast(testNotification);

    // Schedule local push notification (immediate - for testing)
    notificationService.scheduleLocalNotification(testNotification, null);
  }, []);

  // ========== CONTEXT VALUE ==========
  const contextValue: NotificationContextValue = {
    unreadCount,
    isConnected: connectionStatus === "connected",
    connectionStatus,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    triggerTestNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook for consuming context
export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};

export default NotificationContext;
