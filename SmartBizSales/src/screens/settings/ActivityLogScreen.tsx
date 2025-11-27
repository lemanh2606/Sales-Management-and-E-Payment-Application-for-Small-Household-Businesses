// src/screens/settings/ActivityLogScreen.tsx
import React, { useState, useEffect, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.locale("vi");

// ========== TYPES ==========
interface ActivityLog {
  _id: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityName: string;
  description: string;
  ip: string;
  userAgent: string;
  createdAt: string;
  userDetail?: {
    fullname: string;
    email: string;
    image: string;
    role: string;
  };
  storeDetail?: {
    name: string;
  };
}

interface ActivityStats {
  totalLogs: number;
  uniqueUsers: number;
  actionCounts: Record<string, number>;
  entityCounts: Record<string, number>;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface LogsResponse {
  data: {
    logs: ActivityLog[];
    pagination: {
      current: number;
      pageSize: number;
      total: number;
    };
  };
}

interface StatsResponse {
  data: {
    stats: ActivityStats;
  };
}

type ViewMode = "logs" | "attendance";

// ========== MAIN COMPONENT ==========
const ActivityLogScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [attendance, setAttendance] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);

  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>("logs");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  const [isStatsExpanded, setIsStatsExpanded] = useState<boolean>(true);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Filters
  const [userName, setUserName] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [entity, setEntity] = useState<string>("");
  const [keyword, setKeyword] = useState<string>("");

  // Filter options
  const [users, setUsers] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const actions = ["create", "update", "delete", "restore", "auth", "other"];

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [totalLogs, setTotalLogs] = useState<number>(0);

  // ========== FETCH STATS ==========
  const fetchStats = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const response = await apiClient.get<StatsResponse>(
        `/activity-logs/stats?storeId=${storeId}`
      );
      setStats(response.data.data.stats);
      console.log("✅ Lấy thống kê thành công");
    } catch (err) {
      console.error("❌ Lỗi lấy thống kê:", err);
    }
  };

  // ========== FETCH FILTER OPTIONS ==========
  const fetchFilterOptions = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const response = await apiClient.get<LogsResponse>(
        `/activity-logs?storeId=${storeId}&limit=1000`
      );
      const logsData = response.data.data.logs || [];

      // Extract unique values
      const uniqueEntities = [
        ...new Set(logsData.map((l) => l.entity).filter(Boolean)),
      ];
      const uniqueUsers = [
        ...new Set(logsData.map((l) => l.userName).filter(Boolean)),
      ];

      setEntities(uniqueEntities);
      setUsers(uniqueUsers);
    } catch (err) {
      console.error("❌ Lỗi lấy filter options:", err);
    }
  };

  // ========== FETCH LOGS ==========
  const fetchLogs = async (isRefresh: boolean = false): Promise<void> => {
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
      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("page", currentPage.toString());
      params.append("limit", pageSize.toString());
      params.append("sort", "-createdAt");

      if (userName) params.append("userName", userName);
      if (action) params.append("action", action);
      if (entity) params.append("entity", entity);
      if (keyword) params.append("keyword", keyword);

      const response = await apiClient.get<LogsResponse>(
        `/activity-logs?${params.toString()}`
      );

      const respLogs = response.data.data.logs || [];
      const pagination = response.data.data.pagination || {};

      setLogs(respLogs);
      setCurrentPage(pagination.current || 1);
      setTotalLogs(pagination.total || 0);

      // Auto collapse filter after successful fetch
      setIsFilterExpanded(false);

      console.log("✅ Lấy logs thành công");
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy logs:", axiosError);
      Alert.alert("Lỗi", "Không thể tải nhật ký hoạt động");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== FETCH ATTENDANCE ==========
  const fetchAttendance = async (): Promise<void> => {
    if (!storeId) return;

    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("action", "auth");
      params.append("entity", "Store");
      params.append("fromDate", dayjs().format("YYYY-MM-DD"));
      params.append("toDate", dayjs().format("YYYY-MM-DD"));
      params.append("page", "1");
      params.append("limit", "100");
      params.append("sort", "-createdAt");

      const response = await apiClient.get<LogsResponse>(
        `/activity-logs?${params.toString()}`
      );

      setAttendance(response.data.data.logs || []);
      console.log("✅ Lấy điểm danh thành công");
    } catch (err) {
      console.error("❌ Lỗi lấy điểm danh:", err);
      Alert.alert("Lỗi", "Không thể tải dữ liệu điểm danh");
    } finally {
      setLoading(false);
    }
  };

  // ========== FETCH LOG DETAIL ==========
  const fetchLogDetail = async (id: string): Promise<void> => {
    setLoading(true);

    try {
      const response = await apiClient.get<{ data: ActivityLog }>(
        `/activity-logs/${id}?storeId=${storeId}`
      );
      setSelectedLog(response.data.data);
      setDetailModalVisible(true);
    } catch (err) {
      console.error("❌ Lỗi lấy chi tiết:", err);
      Alert.alert("Lỗi", "Không thể tải chi tiết log");
    } finally {
      setLoading(false);
    }
  };

  // ========== INIT ==========
  useEffect(() => {
    if (storeId) {
      fetchStats();
      fetchFilterOptions();
      if (viewMode === "logs") {
        fetchLogs();
      } else {
        fetchAttendance();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, viewMode]);

  // ========== GET FILTER DISPLAY TEXT ==========
  const getFilterDisplayText = (): string => {
    const parts: string[] = [];
    if (userName) parts.push(`User: ${userName}`);
    if (action) parts.push(`Action: ${action}`);
    if (entity) parts.push(`Entity: ${entity}`);
    if (keyword) parts.push(`Keyword: ${keyword}`);
    return parts.length > 0 ? parts.join(" • ") : "Chưa áp dụng bộ lọc";
  };

  // ========== GET ACTION COLOR ==========
  const getActionColor = (action: string): string => {
    const colorMap: Record<string, string> = {
      create: "#52c41a",
      update: "#1890ff",
      delete: "#ef4444",
      restore: "#722ed1",
      auth: "#faad14",
      other: "#6b7280",
    };
    return colorMap[action] || "#6b7280";
  };

  // ========== RENDER LOG ITEM ==========
  const renderLogItem = ({ item }: { item: ActivityLog }): JSX.Element => (
    <TouchableOpacity
      style={styles.logCard}
      onPress={() => fetchLogDetail(item._id)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.logHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.logUser}>{item.userName}</Text>
          <Text style={styles.logTime}>
            {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm:ss")}
          </Text>
        </View>
        <View
          style={[
            styles.roleBadge,
            {
              backgroundColor:
                item.userRole === "MANAGER" ? "#e6f4ff" : "#f6ffed",
            },
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              { color: item.userRole === "MANAGER" ? "#1890ff" : "#52c41a" },
            ]}
          >
            {item.userRole}
          </Text>
        </View>
      </View>

      {/* Action & Entity */}
      <View style={styles.logTags}>
        <View
          style={[
            styles.tag,
            { backgroundColor: `${getActionColor(item.action)}20` },
          ]}
        >
          <Text
            style={[styles.tagText, { color: getActionColor(item.action) }]}
          >
            {item.action.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: "#e6f7ff" }]}>
          <Text style={[styles.tagText, { color: "#1890ff" }]}>
            {item.entity}
          </Text>
        </View>
      </View>

      {/* Entity Name & Description */}
      <Text style={styles.logEntityName} numberOfLines={1}>
        {item.entityName}
      </Text>
      {item.description && (
        <Text style={styles.logDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  // ========== RENDER ATTENDANCE ITEM ==========
  const renderAttendanceItem = ({
    item,
  }: {
    item: ActivityLog;
  }): JSX.Element => {
    const isStoreIP =
      item.ip &&
      ["192.168.", "10.0.", "172.16."].some((p) => item.ip.startsWith(p));

    return (
      <View style={styles.attendanceCard}>
        <View style={styles.attendanceHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.attendanceName}>
              {item.userDetail?.fullname || item.userName}
            </Text>
            <Text style={styles.attendanceEmail}>
              {item.userDetail?.email || "-"}
            </Text>
          </View>
          <View style={styles.attendanceTime}>
            <Ionicons name="time" size={16} color="#1890ff" />
            <Text style={styles.attendanceTimeText}>
              {dayjs(item.createdAt).format("HH:mm")}
            </Text>
          </View>
        </View>

        <View style={styles.attendanceInfo}>
          <View style={styles.attendanceInfoItem}>
            <Ionicons name="business" size={14} color="#722ed1" />
            <Text style={styles.attendanceInfoText}>
              {item.storeDetail?.name || "-"}
            </Text>
          </View>
          <View style={styles.attendanceInfoItem}>
            <Ionicons
              name={isStoreIP ? "desktop" : "phone-portrait"}
              size={14}
              color={isStoreIP ? "#52c41a" : "#faad14"}
            />
            <Text style={styles.attendanceInfoText}>
              {isStoreIP ? "Máy tại quán" : "Thiết bị lạ"}
            </Text>
          </View>
          {item.ip && (
            <View style={styles.attendanceInfoItem}>
              <Ionicons name="location" size={14} color="#6b7280" />
              <Text
                style={[styles.attendanceInfoText, { fontFamily: "monospace" }]}
              >
                {item.ip}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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
        <View style={styles.headerIcon}>
          <Ionicons name="document-text" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Nhật ký hoạt động</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeSection}>
        <TouchableOpacity
          style={[
            styles.viewModeBtn,
            viewMode === "logs" && styles.viewModeBtnActive,
          ]}
          onPress={() => setViewMode("logs")}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === "logs" ? "#1890ff" : "#6b7280"}
          />
          <Text
            style={[
              styles.viewModeBtnText,
              viewMode === "logs" && styles.viewModeBtnTextActive,
            ]}
          >
            Nhật ký chung
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.viewModeBtn,
            viewMode === "attendance" && styles.viewModeBtnActive,
          ]}
          onPress={() => setViewMode("attendance")}
        >
          <Ionicons
            name="people"
            size={18}
            color={viewMode === "attendance" ? "#1890ff" : "#6b7280"}
          />
          <Text
            style={[
              styles.viewModeBtnText,
              viewMode === "attendance" && styles.viewModeBtnTextActive,
            ]}
          >
            Vào ca hôm nay
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              viewMode === "logs" ? fetchLogs(true) : fetchAttendance()
            }
            colors={["#1890ff"]}
          />
        }
      >
        {/* Filter Section - Only for logs mode */}
        {viewMode === "logs" && (
          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setIsFilterExpanded(!isFilterExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.filterToggleLeft}>
                <Ionicons name="funnel" size={20} color="#1890ff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.filterToggleText}>
                    {isFilterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
                  </Text>
                  {!isFilterExpanded && (
                    <Text style={styles.filterTogglePeriod}>
                      {getFilterDisplayText()}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons
                name={isFilterExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#1890ff"
              />
            </TouchableOpacity>

            {isFilterExpanded && (
              <View style={styles.filterContent}>
                {/* User Filter */}
                <Text style={styles.filterLabel}>Người dùng</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={userName}
                    onValueChange={(value: string) => setUserName(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Tất cả người dùng" value="" />
                    {users.map((u) => (
                      <Picker.Item key={u} label={u} value={u} />
                    ))}
                  </Picker>
                </View>

                {/* Action Filter */}
                <Text style={styles.filterLabel}>Hành động</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={action}
                    onValueChange={(value: string) => setAction(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Tất cả hành động" value="" />
                    {actions.map((a) => (
                      <Picker.Item key={a} label={a.toUpperCase()} value={a} />
                    ))}
                  </Picker>
                </View>

                {/* Entity Filter */}
                <Text style={styles.filterLabel}>Đối tượng</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={entity}
                    onValueChange={(value: string) => setEntity(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Tất cả đối tượng" value="" />
                    {entities.map((e) => (
                      <Picker.Item key={e} label={e} value={e} />
                    ))}
                  </Picker>
                </View>

                {/* Keyword Search */}
                <Text style={styles.filterLabel}>Tìm kiếm</Text>
                <TextInput
                  style={styles.keywordInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="Nhập từ khóa..."
                  placeholderTextColor="#9ca3af"
                />

                {/* Action Button */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    loading && styles.actionBtnDisabled,
                  ]}
                  onPress={() => fetchLogs(false)}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#1890ff", "#096dd9"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionBtnGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="search" size={18} color="#fff" />
                        <Text style={styles.actionBtnText}>Xem nhật ký</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Stats Section */}
        {stats && viewMode === "logs" && (
          <View style={styles.statsSection}>
            <TouchableOpacity
              style={styles.statsToggle}
              onPress={() => setIsStatsExpanded(!isStatsExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.statsToggleText}>
                {isStatsExpanded ? "Thu gọn thống kê" : "Mở rộng thống kê"}
              </Text>
              <Ionicons
                name={isStatsExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#1890ff"
              />
            </TouchableOpacity>

            {isStatsExpanded && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="document-text" size={24} color="#1890ff" />
                  <Text style={styles.statValue}>{stats.totalLogs}</Text>
                  <Text style={styles.statLabel}>Tổng nhật ký</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="people" size={24} color="#52c41a" />
                  <Text style={styles.statValue}>{stats.uniqueUsers}</Text>
                  <Text style={styles.statLabel}>Người dùng</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="flash" size={24} color="#faad14" />
                  <Text style={styles.statValue}>
                    {Object.keys(stats.actionCounts)[0]?.toUpperCase() || "N/A"}
                  </Text>
                  <Text style={styles.statLabel}>Hành động phổ biến</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="cube" size={24} color="#722ed1" />
                  <Text style={styles.statValue}>
                    {Object.keys(stats.entityCounts)[0] || "N/A"}
                  </Text>
                  <Text style={styles.statLabel}>Đối tượng phổ biến</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.contentSection}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          ) : viewMode === "logs" ? (
            logs.length > 0 ? (
              <>
                <FlatList
                  data={logs}
                  renderItem={renderLogItem}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.logList}
                />
                {totalLogs > logs.length && (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => {
                      setCurrentPage((prev) => prev + 1);
                      fetchLogs();
                    }}
                  >
                    <Text style={styles.loadMoreText}>Xem thêm</Text>
                    <Ionicons name="chevron-down" size={16} color="#1890ff" />
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyText}>Chưa có nhật ký hoạt động</Text>
              </View>
            )
          ) : attendance.length > 0 ? (
            <FlatList
              data={attendance}
              renderItem={renderAttendanceItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.attendanceList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>
                Chưa có nhân viên nào vào ca hôm nay
              </Text>
            </View>
          )}
        </View>

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
              <Text style={styles.modalTitle}>Chi tiết nhật ký</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedLog && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Người dùng:</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.userName}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Vai trò:</Text>
                    <View
                      style={[
                        styles.detailBadge,
                        {
                          backgroundColor:
                            selectedLog.userRole === "MANAGER"
                              ? "#e6f4ff"
                              : "#f6ffed",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailBadgeText,
                          {
                            color:
                              selectedLog.userRole === "MANAGER"
                                ? "#1890ff"
                                : "#52c41a",
                          },
                        ]}
                      >
                        {selectedLog.userRole}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hành động:</Text>
                    <View
                      style={[
                        styles.detailBadge,
                        {
                          backgroundColor: `${getActionColor(selectedLog.action)}20`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailBadgeText,
                          { color: getActionColor(selectedLog.action) },
                        ]}
                      >
                        {selectedLog.action.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Đối tượng:</Text>
                    <Text style={styles.detailValue}>{selectedLog.entity}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tên đối tượng:</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.entityName}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mô tả:</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.description || "Không có mô tả"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Địa chỉ IP:</Text>
                    <Text
                      style={[styles.detailValue, { fontFamily: "monospace" }]}
                    >
                      {selectedLog.ip || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Thiết bị:</Text>
                    <Text style={styles.detailValue} numberOfLines={3}>
                      {selectedLog.userAgent || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Thời gian:</Text>
                    <Text style={styles.detailValue}>
                      {dayjs(selectedLog.createdAt).format(
                        "DD/MM/YYYY HH:mm:ss"
                      )}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ActivityLogScreen;

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
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 14,
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
  viewModeSection: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    gap: 12,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  viewModeBtnActive: {
    backgroundColor: "#e6f4ff",
    borderColor: "#1890ff",
  },
  viewModeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  viewModeBtnTextActive: { color: "#1890ff" },
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
  filterTogglePeriod: { fontSize: 12, color: "#6b7280", marginTop: 4 },
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
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: { height: 50 },
  keywordInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  actionBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    shadowColor: "#1890ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  statsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statsToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsToggleText: { fontSize: 16, fontWeight: "700", color: "#111827" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginVertical: 8,
  },
  statLabel: { fontSize: 12, color: "#6b7280", textAlign: "center" },
  contentSection: { marginHorizontal: 16, marginTop: 16 },
  loadingContainer: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  logList: { gap: 12 },
  logCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logUser: { fontSize: 16, fontWeight: "700", color: "#111827" },
  logTime: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  roleBadgeText: { fontSize: 12, fontWeight: "700" },
  logTags: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tagText: { fontSize: 12, fontWeight: "700" },
  logEntityName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  logDescription: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  attendanceList: { gap: 12 },
  attendanceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  attendanceName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  attendanceEmail: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  attendanceTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e6f4ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  attendanceTimeText: { fontSize: 14, fontWeight: "700", color: "#1890ff" },
  attendanceInfo: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  attendanceInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendanceInfoText: { fontSize: 12, color: "#6b7280" },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 12,
  },
  loadMoreText: { fontSize: 14, fontWeight: "600", color: "#1890ff" },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
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
    maxHeight: "90%",
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
  detailRow: { marginBottom: 20 },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  detailValue: { fontSize: 15, color: "#111827", lineHeight: 22 },
  detailBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  detailBadgeText: { fontSize: 13, fontWeight: "700" },
});
