// src/components/NotificationPanel.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Modal,
  Dimensions,
  Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import apiClient from "../api/apiClient";
import { useNotifications } from "../context/NotificationContext";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ========== TYPES ==========
interface NotificationItem {
  _id: string;
  type: "order" | "payment" | "service" | "system" | "inventory";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  storeId: string | undefined;
  visible: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

// ========== CONSTANTS ==========
const NOTIFICATION_CONFIG = {
  order: { icon: "receipt", color: "#1890ff", label: "Đơn hàng" },
  payment: { icon: "card", color: "#52c41a", label: "Thanh toán" },
  service: { icon: "construct", color: "#faad14", label: "Dịch vụ" },
  system: { icon: "settings", color: "#722ed1", label: "Hệ thống" },
  inventory: { icon: "cube", color: "#ff4d4f", label: "Kho hàng" },
};

// ========== COMPONENT ==========
const NotificationPanel: React.FC<NotificationPanelProps> = ({
  storeId,
  visible,
  onClose,
  onUnreadCountChange,
}) => {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const slideAnim = useState(new Animated.Value(SCREEN_WIDTH))[0];

  // ========== REALTIME NOTIFICATIONS ==========
  // Subscribe to NotificationContext for real-time updates
  const {
    unreadCount: globalUnreadCount,
    isConnected,
    connectionStatus,
    refreshUnreadCount,
  } = useNotifications();

  // Track previous unread count to detect new notifications
  const prevUnreadCount = useRef(globalUnreadCount);

  // Sync unread count to parent
  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(localUnreadCount);
    }
  }, [localUnreadCount, onUnreadCountChange]);

  // ========== AUTO REFRESH ON NEW NOTIFICATION ==========
  useEffect(() => {
    // If global unread count increased and panel is visible, refresh
    if (globalUnreadCount > prevUnreadCount.current && visible) {
      console.log("🔔 New notification detected, refreshing panel...");
      fetchNotifications();
    }
    prevUnreadCount.current = globalUnreadCount;
  }, [globalUnreadCount, visible]);

  // ========== FETCH ==========
  const fetchNotifications = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        storeId,
        limit: "20",
        sort: "-createdAt",
      });
      if (tab === "unread") params.append("read", "false");

      const res = await apiClient.get<any>(`/notifications?${params}`);
      const data = res.data.data || [];
      setNotifications(data);
      const count =
        res.data.meta?.totalUnread ||
        data.filter((n: NotificationItem) => !n.read).length;
      setLocalUnreadCount(count);
    } catch (err) {
      console.error("Lỗi tải thông báo:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId, tab]);

  useEffect(() => {
    if (visible) {
      fetchNotifications();
      // Animate slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      // Reset position when closed
      slideAnim.setValue(SCREEN_WIDTH);
    }
  }, [visible, storeId, tab]);

  // ========== ACTIONS ==========
  const markAsRead = async (id: string, read: boolean) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`, { read });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read } : n))
      );
      setLocalUnreadCount((prev: number) => {
        const wasUnread =
          notifications.find((n) => n._id === id)?.read === false;
        const willBeUnread = !read;
        if (wasUnread && !willBeUnread) return prev - 1;
        if (!wasUnread && willBeUnread) return prev + 1;
        return prev;
      });
    } catch (err) {
      Alert.alert("Lỗi", "Không thể cập nhật trạng thái");
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.patch(`/notifications/read-all`, {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setLocalUnreadCount(0);
      Alert.alert("Thành công", "Đã đánh dấu tất cả là đã đọc");
    } catch (err) {
      Alert.alert("Lỗi", "Không thể đánh dấu tất cả");
    }
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const goToAllNotifications = () => {
    handleClose();
    navigation.navigate("NotificationSettings");
  };

  // ========== RENDER ITEM ==========
  const renderItem = ({ item }: { item: NotificationItem }) => {
    const config = NOTIFICATION_CONFIG[item.type] || NOTIFICATION_CONFIG.system;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.notificationItemUnread,
        ]}
        onPress={() => {
          if (!item.read) markAsRead(item._id, true);
        }}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: `${config.color}20` },
          ]}
        >
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, !item.read && styles.titleUnread]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.time}>
            {dayjs(item.createdAt).fromNow()} •{" "}
            {dayjs(item.createdAt).format("HH:mm, DD/MM")}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => markAsRead(item._id, !item.read)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={item.read ? "mail-unread-outline" : "checkmark-done"}
            size={18}
            color="#8c8c8c"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          onPress={handleClose}
        />

        <Animated.View
          style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}
        >
          {/* Header */}
          <LinearGradient colors={["#ffffff", "#f8fafc"]} style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="notifications" size={22} color="#1890ff" />
              <Text style={styles.headerTitle}>Thông báo</Text>
              {/* Connection status indicator */}
              <View
                style={[
                  styles.connectionDot,
                  { backgroundColor: isConnected ? "#52c41a" : "#d1d5db" },
                ]}
              />
              {localUnreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{localUnreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerRight}>
              {localUnreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllBtn}
                  onPress={markAllAsRead}
                >
                  <Ionicons name="checkmark-done" size={16} color="#1890ff" />
                  <Text style={styles.markAllText}>Đọc hết</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#8c8c8c" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, tab === "all" && styles.tabActive]}
              onPress={() => setTab("all")}
            >
              <Text
                style={[styles.tabText, tab === "all" && styles.tabTextActive]}
              >
                Tất cả
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === "unread" && styles.tabActive]}
              onPress={() => setTab("unread")}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === "unread" && styles.tabTextActive,
                ]}
              >
                Chưa đọc
              </Text>
              {localUnreadCount > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    tab === "unread" && styles.tabBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      tab === "unread" && styles.tabBadgeTextActive,
                    ]}
                  >
                    {localUnreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1890ff" />
                <Text style={styles.loadingText}>Đang tải...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={48}
                  color="#d1d5db"
                />
                <Text style={styles.emptyText}>
                  {tab === "unread"
                    ? "Không có thông báo chưa đọc"
                    : "Không có thông báo"}
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>

          {/* Footer */}
          <TouchableOpacity
            style={styles.footer}
            onPress={goToAllNotifications}
          >
            <Text style={styles.footerText}>Xem tất cả thông báo</Text>
            <Ionicons name="chevron-forward" size={18} color="#1890ff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ========== STYLES ==========
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  panel: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    height: SCREEN_HEIGHT,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50, // Safe area
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  badge: {
    backgroundColor: "#ff4d4f",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#e6f7ff",
  },
  markAllText: {
    fontSize: 12,
    color: "#1890ff",
    fontWeight: "600",
  },
  closeBtn: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#1890ff",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  tabTextActive: {
    color: "#fff",
  },
  tabBadge: {
    backgroundColor: "#1890ff",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  tabBadgeTextActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    backgroundColor: "#fafafa",
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#8c8c8c",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    marginTop: 12,
    color: "#8c8c8c",
    fontSize: 14,
    textAlign: "center",
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationItemUnread: {
    backgroundColor: "#e6f7ff",
    borderLeftWidth: 3,
    borderLeftColor: "#1890ff",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
    flex: 1,
    lineHeight: 20,
  },
  titleUnread: {
    fontWeight: "700",
    color: "#000",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1890ff",
  },
  message: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: "#1890ff",
    marginTop: 6,
    fontWeight: "500",
  },
  moreBtn: {
    padding: 6,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
    gap: 4,
    paddingBottom: 32, // Safe area bottom
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1890ff",
  },
});

export default NotificationPanel;
