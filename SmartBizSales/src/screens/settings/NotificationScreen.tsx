// src/screens/settings/NotificationScreen.tsx
import React, { useState, useEffect, useCallback, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.extend(relativeTime);
dayjs.locale("vi");

// ========== TYPES ==========
interface UserInfo {
  _id: string;
  fullname: string;
  email?: string;
}

interface NotificationItem {
  _id: string;
  storeId: string;
  userId: UserInfo;
  type: "order" | "payment" | "service" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NotificationResponse {
  data: NotificationItem[];
  meta: NotificationMeta;
}

type NotificationType = "all" | "order" | "payment" | "service" | "system";
type ReadStatus = "all" | "true" | "false";

// ========== CONSTANTS ==========
const NOTIFICATION_TYPES: Record<
  "order" | "payment" | "service" | "system",
  { label: string; color: string; icon: string }
> = {
  order: { label: "Đơn hàng", color: "#1890ff", icon: "receipt" },
  payment: { label: "Thanh toán", color: "#52c41a", icon: "card" },
  service: { label: "Dịch vụ", color: "#faad14", icon: "construct" },
  system: { label: "Hệ thống", color: "#722ed1", icon: "settings" },
};

// ========== MAIN COMPONENT ==========
const NotificationScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<
    NotificationItem[]
  >([]);

  // Filters
  const [searchText, setSearchText] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<NotificationType>("all");
  const [readFilter, setReadFilter] = useState<ReadStatus>("all");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalNotifications, setTotalNotifications] = useState<number>(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  // Detail Modal
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);

  // ========== FETCH NOTIFICATIONS ==========
  const fetchNotifications = useCallback(
    async (page: number = 1, isRefresh: boolean = false): Promise<void> => {
      if (!storeId) {
        Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          storeId,
          page: String(page),
          limit: String(pageSize),
          sort: "-createdAt",
        });

        if (typeFilter !== "all") params.append("type", typeFilter);
        if (readFilter !== "all") params.append("read", readFilter);

        const response = await apiClient.get<NotificationResponse>(
          `/notifications?${params.toString()}`
        );

        const data = response.data.data || [];
        setNotifications(data);
        setTotalNotifications(response.data.meta.total);
        setCurrentPage(response.data.meta.page);

        console.log("✅ Lấy thông báo thành công");
      } catch (err: any) {
        console.error("❌ Lỗi tải thông báo:", err);
        Alert.alert(
          "Lỗi",
          err?.response?.data?.message || "Không thể tải thông báo"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, typeFilter, readFilter, pageSize]
  );

  useEffect(() => {
    if (storeId) {
      fetchNotifications(1, false);
    }
  }, [storeId, typeFilter, readFilter]);

  // ========== SEARCH & FILTER ==========
  useEffect(() => {
    let filtered = [...notifications];

    // Search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.message.toLowerCase().includes(search)
      );
    }

    setFilteredNotifications(filtered);
  }, [notifications, searchText]);

  // ========== MARK AS READ ==========
  const markAsRead = async (id: string, read: boolean): Promise<void> => {
    try {
      await apiClient.patch(`/notifications/${id}/read`, { read });
      Alert.alert(
        "Thành công",
        read ? "Đã đánh dấu đã đọc" : "Đã đánh dấu chưa đọc"
      );
      fetchNotifications(currentPage, false);
    } catch (err: any) {
      console.error("❌ Lỗi cập nhật:", err);
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể cập nhật");
    }
  };

  // ========== MARK ALL AS READ ==========
  const markAllAsRead = async (): Promise<void> => {
    Alert.alert("Xác nhận", "Đánh dấu tất cả thông báo là đã đọc?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: async () => {
          try {
            setLoading(true);
            await apiClient.patch(`/notifications/read-all`, {});
            Alert.alert("Thành công", "Đã đánh dấu tất cả là đã đọc");
            fetchNotifications(currentPage, false);
          } catch (err: any) {
            console.error("❌ Lỗi:", err);
            Alert.alert("Lỗi", "Không thể đánh dấu tất cả");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // ========== DELETE NOTIFICATION ==========
  const deleteNotification = async (id: string): Promise<void> => {
    Alert.alert("Xác nhận xóa", "Bạn có chắc muốn xóa thông báo này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient.delete(`/notifications/${id}`);
            Alert.alert("Thành công", "Đã xóa thông báo");
            fetchNotifications(currentPage, false);
          } catch (err: any) {
            console.error("❌ Lỗi xóa:", err);
            Alert.alert("Lỗi", "Không thể xóa thông báo");
          }
        },
      },
    ]);
  };

  // ========== BULK DELETE ==========
  const bulkDelete = async (): Promise<void> => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      "Xác nhận xóa",
      `Xóa ${selectedIds.length} thông báo đã chọn?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await Promise.all(
                selectedIds.map((id) =>
                  apiClient.delete(`/notifications/${id}`)
                )
              );
              Alert.alert(
                "Thành công",
                `Đã xóa ${selectedIds.length} thông báo`
              );
              setSelectedIds([]);
              setIsSelectionMode(false);
              fetchNotifications(currentPage, false);
            } catch (err: any) {
              console.error("❌ Lỗi xóa hàng loạt:", err);
              Alert.alert("Lỗi", "Không thể xóa thông báo");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ========== SELECTION ==========
  const toggleSelection = (id: string): void => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = (): void => {
    setSelectedIds(filteredNotifications.map((item) => item._id));
  };

  const deselectAll = (): void => {
    setSelectedIds([]);
  };

  // ========== CLEAR FILTERS ==========
  const clearFilters = (): void => {
    setSearchText("");
    setTypeFilter("all");
    setReadFilter("all");
  };

  const hasActiveFilters = (): boolean => {
    return searchText !== "" || typeFilter !== "all" || readFilter !== "all";
  };

  // ========== STATS ==========
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ========== GET TYPE ICON ==========
  const getTypeIcon = (type: keyof typeof NOTIFICATION_TYPES): string => {
    return NOTIFICATION_TYPES[type]?.icon || "notifications";
  };

  const getTypeColor = (type: keyof typeof NOTIFICATION_TYPES): string => {
    return NOTIFICATION_TYPES[type]?.color || "#6b7280";
  };

  // ========== RENDER NOTIFICATION ITEM ==========
  const renderNotificationItem = ({
    item,
  }: {
    item: NotificationItem;
  }): JSX.Element => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.read && styles.notificationCardUnread,
        selectedIds.includes(item._id) && styles.notificationCardSelected,
      ]}
      onPress={() => {
        if (isSelectionMode) {
          toggleSelection(item._id);
        } else {
          setSelectedNotification(item);
          setDetailModalVisible(true);
          if (!item.read) {
            markAsRead(item._id, true);
          }
        }
      }}
      onLongPress={() => {
        setIsSelectionMode(true);
        toggleSelection(item._id);
      }}
      activeOpacity={0.7}
    >
      {/* Selection Checkbox */}
      {isSelectionMode && (
        <View style={styles.checkbox}>
          {selectedIds.includes(item._id) ? (
            <Ionicons name="checkbox" size={24} color="#1890ff" />
          ) : (
            <Ionicons name="square-outline" size={24} color="#d1d5db" />
          )}
        </View>
      )}

      {/* Icon */}
      <View
        style={[
          styles.notificationIcon,
          { backgroundColor: `${getTypeColor(item.type)}20` },
        ]}
      >
        <Ionicons
          name={getTypeIcon(item.type) as any}
          size={24}
          color={getTypeColor(item.type)}
        />
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[
              styles.notificationTitle,
              !item.read && styles.notificationTitleUnread,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={styles.notificationFooter}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: `${getTypeColor(item.type)}20` },
            ]}
          >
            <Text
              style={[styles.typeBadgeText, { color: getTypeColor(item.type) }]}
            >
              {NOTIFICATION_TYPES[item.type]?.label}
            </Text>
          </View>

          <Text style={styles.notificationTime}>
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {!isSelectionMode && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => deleteNotification(item._id)}
        >
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  // ========== RENDER ==========
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>Vui lòng chọn cửa hàng trước</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="notifications" size={32} color="#1890ff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Thông báo</Text>
            <Text style={styles.headerSubtitle}>{storeName}</Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchNotifications(1, true)}
        >
          <Ionicons name="refresh" size={20} color="#1890ff" />
        </TouchableOpacity>
      </View>

      {/* Selection Mode Bar */}
      {isSelectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={styles.selectionBtn}
            onPress={() => {
              setIsSelectionMode(false);
              deselectAll();
            }}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>

          <Text style={styles.selectionText}>
            Đã chọn {selectedIds.length} thông báo
          </Text>

          <View style={styles.selectionActions}>
            {selectedIds.length === 0 ? (
              <TouchableOpacity style={styles.selectionBtn} onPress={selectAll}>
                <Text style={styles.selectionBtnText}>Chọn tất cả</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectionBtn}
                  onPress={deselectAll}
                >
                  <Text style={styles.selectionBtnText}>Bỏ chọn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectionBtn, styles.deleteBtn]}
                  onPress={bulkDelete}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.deleteBtnText}>Xóa</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotifications(1, true)}
            colors={["#1890ff"]}
          />
        }
      >
        {/* Quick Actions */}
        {unreadCount > 0 && !isSelectionMode && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={markAllAsRead}
            >
              <Ionicons name="checkmark-done" size={18} color="#52c41a" />
              <Text style={styles.quickActionText}>Đánh dấu tất cả đã đọc</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Section */}
        <View style={styles.filterSection}>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.filterToggleLeft}>
              <Ionicons name="funnel" size={20} color="#1890ff" />
              <Text style={styles.filterToggleText}>
                {isFilterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
              </Text>
              {hasActiveFilters() && !isFilterExpanded && (
                <View style={styles.activeFilterDot} />
              )}
            </View>
            <Ionicons
              name={isFilterExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color="#1890ff"
            />
          </TouchableOpacity>

          {isFilterExpanded && (
            <View style={styles.filterContent}>
              {/* Search */}
              <Text style={styles.filterLabel}>Tìm kiếm</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Tìm kiếm theo tiêu đề, nội dung..."
                  placeholderTextColor="#9ca3af"
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Type Filter */}
              <Text style={styles.filterLabel}>Loại thông báo</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={typeFilter}
                  onValueChange={(value: NotificationType) =>
                    setTypeFilter(value)
                  }
                  style={styles.picker}
                >
                  <Picker.Item label="Tất cả loại" value="all" />
                  <Picker.Item label="📦 Đơn hàng" value="order" />
                  <Picker.Item label="💳 Thanh toán" value="payment" />
                  <Picker.Item label="🔧 Dịch vụ" value="service" />
                  <Picker.Item label="⚙️ Hệ thống" value="system" />
                </Picker>
              </View>

              {/* Read Status Filter */}
              <Text style={styles.filterLabel}>Trạng thái</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={readFilter}
                  onValueChange={(value: ReadStatus) => setReadFilter(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Tất cả" value="all" />
                  <Picker.Item label="Đã đọc" value="true" />
                  <Picker.Item label="Chưa đọc" value="false" />
                </Picker>
              </View>

              {/* Clear Filters */}
              {hasActiveFilters() && (
                <TouchableOpacity
                  style={styles.clearFiltersBtn}
                  onPress={clearFilters}
                >
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={styles.clearFiltersText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Notifications List */}
        <View style={styles.listSection}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Đang tải thông báo...</Text>
            </View>
          ) : filteredNotifications.length > 0 ? (
            <FlatList
              data={filteredNotifications}
              renderItem={renderNotificationItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.notificationList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="notifications-off-outline"
                size={64}
                color="#d1d5db"
              />
              <Text style={styles.emptyText}>
                {hasActiveFilters()
                  ? "Không tìm thấy thông báo nào"
                  : "Chưa có thông báo nào"}
              </Text>
            </View>
          )}
        </View>

        {/* Pagination Info */}
        {filteredNotifications.length > 0 && (
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Hiển thị {filteredNotifications.length} / {totalNotifications}{" "}
              thông báo
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết thông báo</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {selectedNotification && (
              <ScrollView style={styles.modalBody}>
                {/* Type Badge */}
                <View
                  style={[
                    styles.detailTypeBadge,
                    {
                      backgroundColor: `${getTypeColor(selectedNotification.type)}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getTypeIcon(selectedNotification.type) as any}
                    size={20}
                    color={getTypeColor(selectedNotification.type)}
                  />
                  <Text
                    style={[
                      styles.detailTypeBadgeText,
                      { color: getTypeColor(selectedNotification.type) },
                    ]}
                  >
                    {NOTIFICATION_TYPES[selectedNotification.type]?.label}
                  </Text>
                </View>

                {/* Title */}
                <Text style={styles.detailTitle}>
                  {selectedNotification.title}
                </Text>

                {/* Message */}
                <Text style={styles.detailMessage}>
                  {selectedNotification.message}
                </Text>

                {/* Info */}
                <View style={styles.detailInfo}>
                  <View style={styles.detailInfoRow}>
                    <Ionicons name="person" size={16} color="#6b7280" />
                    <Text style={styles.detailInfoLabel}>Người tạo:</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedNotification.userId?.fullname || "—"}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Ionicons name="time" size={16} color="#6b7280" />
                    <Text style={styles.detailInfoLabel}>Thời gian:</Text>
                    <Text style={styles.detailInfoValue}>
                      {dayjs(selectedNotification.createdAt).format(
                        "DD/MM/YYYY HH:mm"
                      )}
                    </Text>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <Ionicons
                      name={
                        selectedNotification.read
                          ? "checkmark-circle"
                          : "ellipse"
                      }
                      size={16}
                      color={selectedNotification.read ? "#52c41a" : "#faad14"}
                    />
                    <Text style={styles.detailInfoLabel}>Trạng thái:</Text>
                    <Text style={styles.detailInfoValue}>
                      {selectedNotification.read ? "Đã đọc" : "Chưa đọc"}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[
                      styles.detailActionBtn,
                      styles.detailActionBtnSecondary,
                    ]}
                    onPress={() => {
                      markAsRead(
                        selectedNotification._id,
                        !selectedNotification.read
                      );
                      setDetailModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name={selectedNotification.read ? "eye-off" : "checkmark"}
                      size={18}
                      color="#1890ff"
                    />
                    <Text style={styles.detailActionBtnTextSecondary}>
                      {selectedNotification.read
                        ? "Đánh dấu chưa đọc"
                        : "Đánh dấu đã đọc"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.detailActionBtn,
                      styles.detailActionBtnDanger,
                    ]}
                    onPress={() => {
                      deleteNotification(selectedNotification._id);
                      setDetailModalVisible(false);
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#fff" />
                    <Text style={styles.detailActionBtnTextDanger}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default NotificationScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 13, color: "#6b7280" },
  unreadBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: "center",
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e6f4ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#91caff",
  },
  selectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1890ff",
    flex: 1,
    marginLeft: 8,
  },
  selectionActions: {
    flexDirection: "row",
    gap: 8,
  },
  selectionBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1890ff",
  },
  deleteBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  quickActions: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f6ffed",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#b7eb8f",
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#52c41a",
  },
  filterSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  filterToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  filterToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  filterToggleText: { fontSize: 16, fontWeight: "700", color: "#1890ff" },
  activeFilterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    marginLeft: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { height: 50 },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 16,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  listSection: { marginHorizontal: 16, marginTop: 16 },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  notificationList: { gap: 12 },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
  },
  notificationCardUnread: {
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 4,
    borderLeftColor: "#1890ff",
  },
  notificationCardSelected: {
    backgroundColor: "#e6f4ff",
    borderWidth: 2,
    borderColor: "#1890ff",
  },
  checkbox: {
    marginRight: 4,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: {
    flex: 1,
    gap: 8,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
  },
  notificationTitleUnread: {
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1890ff",
    marginTop: 6,
  },
  notificationMessage: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  typeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  notificationTime: {
    fontSize: 12,
    color: "#9ca3af",
  },
  actionBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },
  paginationInfo: {
    alignItems: "center",
    paddingVertical: 16,
  },
  paginationText: {
    fontSize: 14,
    color: "#6b7280",
  },
  bottomSpacer: { height: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  modalBody: {
    padding: 20,
  },
  detailTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  detailTypeBadgeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    lineHeight: 28,
  },
  detailMessage: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 24,
  },
  detailInfo: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 24,
  },
  detailInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailInfoLabel: {
    fontSize: 14,
    color: "#6b7280",
    flex: 1,
  },
  detailInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  detailActions: {
    flexDirection: "row",
    gap: 12,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  detailActionBtnSecondary: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#1890ff",
  },
  detailActionBtnDanger: {
    backgroundColor: "#ef4444",
  },
  detailActionBtnTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1890ff",
  },
  detailActionBtnTextDanger: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
