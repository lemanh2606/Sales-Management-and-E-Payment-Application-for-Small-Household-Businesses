// src/screens/settings/NotificationScreen.tsx
import React, { useState, useEffect, useCallback, JSX, memo } from "react";
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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
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
  type: "order" | "payment" | "service" | "system" | "inventory";
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

type NotificationType =
  | "all"
  | "order"
  | "payment"
  | "service"
  | "system"
  | "inventory";
type ReadStatus = "all" | "true" | "false";

// ========== CONSTANTS ==========
const NOTIFICATION_TYPES: Record<
  "order" | "payment" | "service" | "system" | "inventory",
  { label: string; color: string; icon: string }
> = {
  order: { label: "Đơn hàng", color: "#1890ff", icon: "receipt" },
  payment: { label: "Thanh toán", color: "#52c41a", icon: "card" },
  service: { label: "Dịch vụ", color: "#faad14", icon: "construct" },
  system: { label: "Hệ thống", color: "#722ed1", icon: "settings" },
  inventory: { label: "Kho hàng", color: "#ff4d4f", icon: "cube" },
};

// ========== SMALL HELPERS ==========
type SelectOption<T extends string> = { label: string; value: T };

const formatDateLabel = (d?: Date | null) =>
  d ? dayjs(d).format("DD/MM/YYYY") : "";
const isSameOrAfterDay = (aISO: string, b: Date) =>
  dayjs(aISO).startOf("day").valueOf() >= dayjs(b).startOf("day").valueOf();
const isSameOrBeforeDay = (aISO: string, b: Date) =>
  dayjs(aISO).startOf("day").valueOf() <= dayjs(b).startOf("day").valueOf();

const clampDateRange = (from: Date | null, to: Date | null) => {
  if (from && to && dayjs(from).isAfter(to, "day")) return { from, to: from };
  return { from, to };
};

// ========== UI: FILTER CHIP ==========
const FilterChip = memo(
  ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <View style={styles.filterChip}>
      <Text style={styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={16} color="#1890ff" />
      </TouchableOpacity>
    </View>
  )
);
FilterChip.displayName = "FilterChip";

// ========== UI: SEARCHABLE SELECT ==========
const SelectField = <T extends string>({
  label,
  value,
  placeholder,
  options,
  onChange,
  leftIcon = "options-outline",
}: {
  label: string;
  value: T;
  placeholder?: string;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
}) => {
  const [visible, setVisible] = useState(false);
  const [q, setQ] = useState("");

  const currentLabel = options.find((o) => o.value === value)?.label || "";
  const filtered = (() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.label.toLowerCase().includes(query));
  })();

  return (
    <>
      <Text style={styles.filterLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.selectField}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flex: 1,
          }}
        >
          <Ionicons name={leftIcon} size={18} color="#9ca3af" />
          <Text
            style={[
              styles.selectValue,
              !currentLabel && styles.selectPlaceholder,
            ]}
          >
            {currentLabel || placeholder || "Chọn..."}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.selectOverlay}>
          <View style={styles.selectModal}>
            <View style={styles.selectHeader}>
              <Text style={styles.selectTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <View style={styles.selectSearchRow}>
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Tìm nhanh..."
                placeholderTextColor="#9ca3af"
                style={styles.selectSearchInput}
              />
              {!!q && (
                <TouchableOpacity onPress={() => setQ("")}>
                  <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(it) => it.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.selectItem,
                      active && styles.selectItemActive,
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setVisible(false);
                      setQ("");
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.selectItemText,
                        active && styles.selectItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Ionicons
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={20}
                      color={active ? "#1890ff" : "#d1d5db"}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ paddingVertical: 22, alignItems: "center" }}>
                  <Ionicons name="search-outline" size={28} color="#d1d5db" />
                  <Text
                    style={{
                      marginTop: 8,
                      color: "#6b7280",
                      fontWeight: "700",
                    }}
                  >
                    Không tìm thấy dữ liệu
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
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

  // Filters (applied)
  const [searchText, setSearchText] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<NotificationType>("all");
  const [readFilter, setReadFilter] = useState<ReadStatus>("all");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // UI: Filter sheet
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  // Draft filters (in sheet)
  const [draftSearchText, setDraftSearchText] = useState<string>("");
  const [draftTypeFilter, setDraftTypeFilter] =
    useState<NotificationType>("all");
  const [draftReadFilter, setDraftReadFilter] = useState<ReadStatus>("all");
  const [draftFromDate, setDraftFromDate] = useState<Date | null>(null);
  const [draftToDate, setDraftToDate] = useState<Date | null>(null);

  // Date picker
  const [datePickerTarget, setDatePickerTarget] = useState<
    "from" | "to" | null
  >(null);

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

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

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
      } catch (err: any) {
        console.error(" Lỗi tải thông báo:", err);
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
    if (storeId) fetchNotifications(1, false);
  }, [storeId, typeFilter, readFilter, pageSize, fetchNotifications]);

  // ========== SEARCH & FILTER (client-side) ==========
  useEffect(() => {
    let filtered = [...notifications];

    // Search
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(search) ||
          item.message.toLowerCase().includes(search)
      );
    }

    // Date range (createdAt)
    if (fromDate)
      filtered = filtered.filter((n) =>
        isSameOrAfterDay(n.createdAt, fromDate)
      );
    if (toDate)
      filtered = filtered.filter((n) => isSameOrBeforeDay(n.createdAt, toDate));

    setFilteredNotifications(filtered);
  }, [notifications, searchText, fromDate, toDate]);

  // ========== SCAN EXPIRY ==========
  const scanExpiry = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await apiClient.post(`/notifications/scan-expiry`, {});
      Alert.alert("Thành công", (res.data as any).message);
      fetchNotifications(1, false);
    } catch (err: any) {
      console.error(" Lỗi quét:", err);
      Alert.alert("Lỗi", "Không thể thực hiện quét lúc này");
    } finally {
      setLoading(false);
    }
  };

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
      console.error(" Lỗi cập nhật:", err);
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
            console.error(" Lỗi:", err);
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
            console.error(" Lỗi xóa:", err);
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
              console.error(" Lỗi xóa hàng loạt:", err);
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
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const selectAll = (): void =>
    setSelectedIds(filteredNotifications.map((item) => item._id));
  const deselectAll = (): void => setSelectedIds([]);

  // ========== FILTER HELPERS ==========
  const clearFilters = (): void => {
    setSearchText("");
    setTypeFilter("all");
    setReadFilter("all");
    setFromDate(null);
    setToDate(null);
  };

  const hasActiveFilters = (): boolean =>
    searchText.trim() !== "" ||
    typeFilter !== "all" ||
    readFilter !== "all" ||
    !!fromDate ||
    !!toDate;

  const activeFilterCount = (): number => {
    let c = 0;
    if (searchText.trim()) c += 1;
    if (typeFilter !== "all") c += 1;
    if (readFilter !== "all") c += 1;
    if (fromDate || toDate) c += 1;
    return c;
  };

  const buildActiveFilterChips = (): Array<{ key: string; label: string }> => {
    const chips: Array<{ key: string; label: string }> = [];
    if (searchText.trim())
      chips.push({ key: "search", label: `Từ khóa: "${searchText.trim()}"` });
    if (typeFilter !== "all")
      chips.push({
        key: "type",
        label: `Loại: ${NOTIFICATION_TYPES[typeFilter as keyof typeof NOTIFICATION_TYPES]?.label || typeFilter}`,
      });
    if (readFilter !== "all")
      chips.push({
        key: "read",
        label: `Trạng thái: ${readFilter === "true" ? "Đã đọc" : "Chưa đọc"}`,
      });
    if (fromDate || toDate) {
      const fromLbl = fromDate ? formatDateLabel(fromDate) : "—";
      const toLbl = toDate ? formatDateLabel(toDate) : "—";
      chips.push({ key: "date", label: `Ngày: ${fromLbl} → ${toLbl}` });
    }
    return chips;
  };

  const removeFilterChip = (key: string) => {
    if (key === "search") setSearchText("");
    if (key === "type") setTypeFilter("all");
    if (key === "read") setReadFilter("all");
    if (key === "date") {
      setFromDate(null);
      setToDate(null);
    }
  };

  const openFilterSheet = () => {
    setDraftSearchText(searchText);
    setDraftTypeFilter(typeFilter);
    setDraftReadFilter(readFilter);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setFilterModalVisible(true);
  };

  const resetDraft = () => {
    setDraftSearchText("");
    setDraftTypeFilter("all");
    setDraftReadFilter("all");
    setDraftFromDate(null);
    setDraftToDate(null);
  };

  const applyDraft = () => {
    const fixed = clampDateRange(draftFromDate, draftToDate);

    setSearchText(draftSearchText);
    setTypeFilter(draftTypeFilter);
    setReadFilter(draftReadFilter);
    setFromDate(fixed.from);
    setToDate(fixed.to);

    setFilterModalVisible(false);
    // type/read thay đổi sẽ tự fetch qua useEffect
  };

  const onChangeDate = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // Android: dismiss => đóng, không set
      if (Platform.OS !== "ios") {
        if (event.type === "dismissed") {
          setDatePickerTarget(null);
          return;
        }
      }
      if (!selected) return;

      if (datePickerTarget === "from") {
        const fixed = clampDateRange(selected, draftToDate);
        setDraftFromDate(fixed.from);
        setDraftToDate(fixed.to);
      } else if (datePickerTarget === "to") {
        const fixed = clampDateRange(draftFromDate, selected);
        setDraftFromDate(fixed.from);
        setDraftToDate(fixed.to);
      }

      // iOS: chọn xong đóng luôn cho gọn
      setDatePickerTarget(null);
    },
    [datePickerTarget, draftFromDate, draftToDate]
  );

  // ========== STATS ==========
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ========== GET TYPE ICON / COLOR ==========
  const getTypeIcon = (type: keyof typeof NOTIFICATION_TYPES): string =>
    NOTIFICATION_TYPES[type]?.icon || "notifications";

  const getTypeColor = (type: keyof typeof NOTIFICATION_TYPES): string =>
    NOTIFICATION_TYPES[type]?.color || "#6b7280";

  // ========== OPTIONS ==========
  const typeOptions: SelectOption<NotificationType>[] = [
    { label: "Tất cả loại", value: "all" },
    { label: "Đơn hàng", value: "order" },
    { label: "Thanh toán", value: "payment" },
    { label: "Dịch vụ", value: "service" },
    { label: "Hệ thống", value: "system" },
    { label: "Kho hàng", value: "inventory" },
  ];

  const readOptions: SelectOption<ReadStatus>[] = [
    { label: "Tất cả", value: "all" },
    { label: "Đã đọc", value: "true" },
    { label: "Chưa đọc", value: "false" },
  ];

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
          if (!item.read) markAsRead(item._id, true);
        }
      }}
      onLongPress={() => {
        setIsSelectionMode(true);
        toggleSelection(item._id);
      }}
      activeOpacity={0.7}
    >
      {isSelectionMode && (
        <View style={styles.checkbox}>
          {selectedIds.includes(item._id) ? (
            <Ionicons name="checkbox" size={24} color="#1890ff" />
          ) : (
            <Ionicons name="square-outline" size={24} color="#d1d5db" />
          )}
        </View>
      )}

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

  const chips = buildActiveFilterChips();

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

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={async () => {
              try {
                setLoading(true);
                const res = await apiClient.post(
                  "/notifications/test-push",
                  {}
                );
                Alert.alert("Thành công", (res.data as any).message);
              } catch (err: any) {
                console.error("Test Push Error:", err);
                Alert.alert("Lỗi", "Không thể gửi test push");
              } finally {
                setLoading(false);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="color-wand-outline" size={20} color="#722ed1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={scanExpiry}
            activeOpacity={0.8}
          >
            <Ionicons name="cube-outline" size={20} color="#ff4d4f" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={openFilterSheet}
            activeOpacity={0.8}
          >
            <Ionicons name="funnel-outline" size={20} color="#1890ff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchNotifications(1, true)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#1890ff" />
          </TouchableOpacity>
        </View>
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
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={18} color="#52c41a" />
              <Text style={styles.quickActionText}>Đánh dấu tất cả đã đọc</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter summary card */}
        <View style={styles.filterSummaryCard}>
          <View style={styles.filterSummaryTop}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <View style={styles.filterSummaryIcon}>
                <Ionicons name="funnel" size={18} color="#1890ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.filterSummaryTitle}>Bộ lọc</Text>
                <Text style={styles.filterSummarySub}>
                  {hasActiveFilters()
                    ? `Đang áp dụng ${activeFilterCount()} bộ lọc`
                    : "Chưa áp dụng bộ lọc"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.filterOpenBtn}
              onPress={openFilterSheet}
              activeOpacity={0.85}
            >
              <Text style={styles.filterOpenBtnText}>Mở</Text>
              <Ionicons name="chevron-forward" size={16} color="#1890ff" />
            </TouchableOpacity>
          </View>

          {chips.length > 0 && (
            <View style={styles.filterChipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {chips.map((c) => (
                  <FilterChip
                    key={c.key}
                    label={c.label}
                    onRemove={() => removeFilterChip(c.key)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {hasActiveFilters() && (
            <TouchableOpacity
              style={styles.clearInlineBtn}
              onPress={clearFilters}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle" size={16} color="#ef4444" />
              <Text style={styles.clearInlineText}>Xóa tất cả bộ lọc</Text>
            </TouchableOpacity>
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

      {/* FILTER SHEET */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.sheetHeaderIcon}>
                  <Ionicons name="funnel" size={18} color="#1890ff" />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Bộ lọc thông báo</Text>
                  <Text style={styles.sheetSubTitle}>
                    Tùy chỉnh để tìm nhanh hơn
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.sheetBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Search */}
              <Text style={styles.filterLabel}>Tìm kiếm</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="#9ca3af" />
                <TextInput
                  style={styles.searchInput}
                  value={draftSearchText}
                  onChangeText={setDraftSearchText}
                  placeholder="Tìm theo tiêu đề hoặc nội dung..."
                  placeholderTextColor="#9ca3af"
                  returnKeyType="search"
                />
                {!!draftSearchText && (
                  <TouchableOpacity onPress={() => setDraftSearchText("")}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Type */}
              <SelectField<NotificationType>
                label="Loại thông báo"
                value={draftTypeFilter}
                placeholder="Chọn loại"
                options={typeOptions}
                onChange={setDraftTypeFilter}
                leftIcon="pricetag-outline"
              />

              {/* Read */}
              <SelectField<ReadStatus>
                label="Trạng thái"
                value={draftReadFilter}
                placeholder="Chọn trạng thái"
                options={readOptions}
                onChange={setDraftReadFilter}
                leftIcon="eye-outline"
              />

              {/* Date presets */}
              <Text style={styles.filterLabel}>Lọc theo thời gian</Text>
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const today = dayjs().startOf("day").toDate();
                    const end = dayjs().endOf("day").toDate();
                    setDraftFromDate(today);
                    setDraftToDate(end);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>Hôm nay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const from = dayjs()
                      .subtract(7, "day")
                      .startOf("day")
                      .toDate();
                    const to = dayjs().endOf("day").toDate();
                    const fixed = clampDateRange(from, to);
                    setDraftFromDate(fixed.from);
                    setDraftToDate(fixed.to);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>7 ngày</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => {
                    const from = dayjs()
                      .subtract(30, "day")
                      .startOf("day")
                      .toDate();
                    const to = dayjs().endOf("day").toDate();
                    const fixed = clampDateRange(from, to);
                    setDraftFromDate(fixed.from);
                    setDraftToDate(fixed.to);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.quickDateText}>30 ngày</Text>
                </TouchableOpacity>
              </View>

              {/* Date range */}
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setDatePickerTarget("from")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateFieldLabel}>Từ ngày</Text>
                    <Text
                      style={[
                        styles.dateFieldValue,
                        !draftFromDate && styles.dateFieldPlaceholder,
                      ]}
                    >
                      {draftFromDate
                        ? formatDateLabel(draftFromDate)
                        : "Chọn ngày bắt đầu"}
                    </Text>
                  </View>
                  {!!draftFromDate && (
                    <TouchableOpacity
                      onPress={() => setDraftFromDate(null)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateField}
                  onPress={() => setDatePickerTarget("to")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateFieldLabel}>Đến ngày</Text>
                    <Text
                      style={[
                        styles.dateFieldValue,
                        !draftToDate && styles.dateFieldPlaceholder,
                      ]}
                    >
                      {draftToDate
                        ? formatDateLabel(draftToDate)
                        : "Chọn ngày kết thúc"}
                    </Text>
                  </View>
                  {!!draftToDate && (
                    <TouchableOpacity
                      onPress={() => setDraftToDate(null)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              {/* DateTimePicker modal */}
              {datePickerTarget && (
                <Modal
                  transparent
                  animationType="fade"
                  visible
                  onRequestClose={() => setDatePickerTarget(null)}
                >
                  <View style={styles.pickerOverlay}>
                    <View style={styles.pickerModal}>
                      <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>
                          {datePickerTarget === "from"
                            ? "Chọn từ ngày"
                            : "Chọn đến ngày"}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setDatePickerTarget(null)}
                        >
                          <Ionicons
                            name="close-circle"
                            size={26}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      </View>

                      <DateTimePicker
                        value={
                          datePickerTarget === "from"
                            ? draftFromDate || new Date()
                            : draftToDate || new Date()
                        }
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onChangeDate}
                        maximumDate={dayjs().endOf("day").toDate()}
                        textColor="#000000"
                        themeVariant="light"
                        locale="vi-VN"
                      />

                      {Platform.OS === "ios" && (
                        <View style={styles.pickerFooter}>
                          <TouchableOpacity
                            style={styles.pickerDoneBtn}
                            onPress={() => setDatePickerTarget(null)}
                            activeOpacity={0.9}
                          >
                            <Text style={styles.pickerDoneText}>Xong</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>
              )}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.sheetResetBtn}
                onPress={resetDraft}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-outline" size={18} color="#374151" />
                <Text style={styles.sheetResetText}>Đặt lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetApplyBtn}
                onPress={applyDraft}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#1890ff", "#096dd9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sheetApplyGradient}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.sheetApplyText}>Áp dụng</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

                <Text style={styles.detailTitle}>
                  {selectedNotification.title}
                </Text>
                <Text style={styles.detailMessage}>
                  {selectedNotification.message}
                </Text>

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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
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
  unreadBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
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
  selectionActions: { flexDirection: "row", gap: 8 },
  selectionBtnText: { fontSize: 14, fontWeight: "600", color: "#1890ff" },
  deleteBtn: { backgroundColor: "#ef4444", paddingHorizontal: 16 },
  deleteBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  quickActions: { marginHorizontal: 16, marginTop: 16 },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f6ffed",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#b7eb8f",
  },
  quickActionText: { fontSize: 14, fontWeight: "700", color: "#52c41a" },

  // Filter summary card
  filterSummaryCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  filterSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterSummaryTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  filterSummarySub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },

  filterOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
  },
  filterOpenBtnText: { fontSize: 13, fontWeight: "800", color: "#1890ff" },

  filterChipsRow: { marginTop: 12 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f4ff",
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 999,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1890ff",
    maxWidth: 220,
  },

  clearInlineBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  clearInlineText: { fontSize: 13, fontWeight: "800", color: "#ef4444" },

  // list
  listSection: { marginHorizontal: 16, marginTop: 16 },
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  notificationList: { gap: 12 },

  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
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

  checkbox: { marginRight: 4 },

  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: { flex: 1, gap: 8 },
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
  notificationTitleUnread: { fontWeight: "800" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1890ff",
    marginTop: 6,
  },
  notificationMessage: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  typeBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: "800" },
  notificationTime: { fontSize: 12, color: "#9ca3af" },
  actionBtn: { padding: 8 },

  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },

  paginationInfo: { alignItems: "center", paddingVertical: 16 },
  paginationText: { fontSize: 14, color: "#6b7280" },
  bottomSpacer: { height: 40 },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  sheetSubTitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },

  sheetBody: { paddingHorizontal: 16, paddingBottom: 12 },

  filterLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    marginBottom: 8,
    marginTop: 14,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#111827", fontWeight: "600" },

  selectField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selectValue: { fontSize: 14, fontWeight: "800", color: "#111827" },
  selectPlaceholder: { color: "#9ca3af" },

  selectOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
    justifyContent: "center",
  },
  selectModal: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    maxHeight: "80%",
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  selectTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  selectSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    margin: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    gap: 8,
  },
  selectSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  selectItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectItemActive: { backgroundColor: "#e6f4ff" },
  selectItemText: { fontSize: 14, fontWeight: "800", color: "#111827" },
  selectItemTextActive: { color: "#1890ff" },

  quickDateRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickDateBtn: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickDateText: { fontSize: 13, fontWeight: "800", color: "#374151" },

  dateRow: { gap: 10, marginTop: 6 },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dateFieldLabel: { fontSize: 11, color: "#6b7280", fontWeight: "800" },
  dateFieldValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  dateFieldPlaceholder: { color: "#9ca3af" },

  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  pickerModal: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerTitle: { fontSize: 15, fontWeight: "900", color: "#111827" },
  pickerFooter: { padding: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  pickerDoneBtn: {
    backgroundColor: "#1890ff",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  pickerDoneText: { color: "#fff", fontWeight: "900" },

  sheetFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
  },
  sheetResetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  sheetResetText: { fontSize: 14, fontWeight: "900", color: "#374151" },
  sheetApplyBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  sheetApplyGradient: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetApplyText: { fontSize: 14, fontWeight: "900", color: "#fff" },

  // Detail modal
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
  modalBody: { padding: 20 },

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
  detailTypeBadgeText: { fontSize: 14, fontWeight: "700" },
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
  detailInfoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailInfoLabel: { fontSize: 14, color: "#6b7280", flex: 1 },
  detailInfoValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  detailActions: { flexDirection: "row", gap: 12 },
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
  detailActionBtnDanger: { backgroundColor: "#ef4444" },
  detailActionBtnTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1890ff",
  },
  detailActionBtnTextDanger: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
