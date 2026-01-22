/**
 * File: src/services/SocketService.ts
 * -------------------------------------------------
 * Socket.IO client service để nhận real-time notifications
 * Sử dụng cách tiếp cận mới nhất với singleton pattern
 * -------------------------------------------------
 */

import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";

// Types
export interface SocketNotification {
  _id: string;
  storeId: string;
  type: "order" | "payment" | "service" | "system" | "inventory";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

type NotificationCallback = (notification: SocketNotification) => void;
type ConnectionCallback = (status: ConnectionStatus) => void;

function getDevHost(): string {
    // EAS Build / Expo Go mới
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) return hostUri.split(":")[0];

    // Legacy Expo CLI
    const debuggerHost = (Constants.manifest as any)?.debuggerHost;
    if (debuggerHost) return debuggerHost.split(":")[0];

    // Fallback localhost (chỉ chạy trên dev machine)
    return "localhost";
}
class SocketService {
  private socket: Socket | null = null;
  private notificationCallbacks: NotificationCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private currentStatus: ConnectionStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;


  
  /**
   * Lấy WebSocket URL từ API URL
   */
  private getSocketUrl(): string {

    const API_PORT = 9999;
// const API_URL =
//     // process.env.EXPO_PUBLIC_API_URL
//     // ||
//     `http://${getDevHost()}:${API_PORT}/api`
//     ;
    const apiUrl =
    //  process.env.EXPO_PUBLIC_API_URL 
    // || 
    `http://${getDevHost()}:${API_PORT}/api`;
    // Chuyển từ http://host:port/api thành ws://host:port
    const baseUrl = apiUrl.replace("/api", "").replace("http://", "").replace("https://", "");
    const protocol = apiUrl.startsWith("https") ? "wss" : "ws";
    return `${protocol}://${baseUrl}`;
  }

  /**
   * Kết nối tới Socket.IO server
   */
  connect(storeId: string, token: string): void {
    if (this.socket?.connected) {
      console.log("🔌 Socket already connected");
      return;
    }

    this.updateStatus("connecting");
    const socketUrl = this.getSocketUrl();
    console.log("🔌 Connecting to Socket:", socketUrl);

    this.socket = io(socketUrl, {
      auth: {
        token: token,
        storeId: storeId,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupListeners(storeId);
  }

  /**
   * Setup các event listeners
   */
  private setupListeners(storeId: string): void {
    if (!this.socket) return;

    // Connection successful
    this.socket.on("connect", () => {
      console.log("✅ Socket connected successfully");
      this.reconnectAttempts = 0;
      this.updateStatus("connected");

      // Join store room để nhận notifications của store
      this.socket?.emit("join_store", storeId);
    });

    // Connection error
    this.socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      this.reconnectAttempts++;
      this.updateStatus("error");
    });

    // Disconnected
    this.socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      this.updateStatus("disconnected");
    });

    // Reconnecting
    this.socket.on("reconnect_attempt", (attempt) => {
      console.log(`🔄 Reconnecting... attempt ${attempt}`);
      this.updateStatus("connecting");
    });

    // Reconnected
    this.socket.on("reconnect", () => {
      console.log("✅ Socket reconnected");
      this.updateStatus("connected");
      this.socket?.emit("join_store", storeId);
    });

    // ========== NOTIFICATION EVENTS ==========
    
    // New notification received
    this.socket.on("new_notification", (notification: SocketNotification) => {
      console.log("🔔 New notification received:", notification.title);
      this.notifyNotificationCallbacks(notification);
    });

    // Alternative event names (backend flexibility)
    this.socket.on("notification", (notification: SocketNotification) => {
      console.log("🔔 Notification received:", notification.title);
      this.notifyNotificationCallbacks(notification);
    });

    // Broadcast notification to all store members
    this.socket.on("store_notification", (notification: SocketNotification) => {
      console.log("🔔 Store notification received:", notification.title);
      this.notifyNotificationCallbacks(notification);
    });
  }

  /**
   * Ngắt kết nối Socket
   */
  disconnect(): void {
    if (this.socket) {
      console.log("🔌 Disconnecting socket...");
      this.socket.off("connect");
      this.socket.off("disconnect");
      this.socket.off("connect_error");
      this.socket.off("new_notification");
      this.socket.off("notification");
      this.socket.off("store_notification");
      this.socket.disconnect();
      this.socket = null;
      this.updateStatus("disconnected");
    }
  }

  /**
   * Subscribe to new notifications
   */
  onNewNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.notificationCallbacks = this.notificationCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    // Immediately notify current status
    callback(this.currentStatus);
    // Return unsubscribe function
    return () => {
      this.connectionCallbacks = this.connectionCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Update status and notify callbacks
   */
  private updateStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.connectionCallbacks.forEach(cb => cb(status));
  }

  /**
   * Notify all notification callbacks
   */
  private notifyNotificationCallbacks(notification: SocketNotification): void {
    this.notificationCallbacks.forEach(cb => cb(notification));
  }

  /**
   * Emit custom event to server
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn("⚠️ Cannot emit - socket not connected");
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
