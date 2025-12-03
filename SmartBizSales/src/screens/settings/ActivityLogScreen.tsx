// src/screens/settings/ActivityLogScreen.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  memo,
  FC,
  useRef,
  JSX,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  TextInput,
  Modal,
  ListRenderItem,
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import "dayjs/locale/vi";

import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import { useCleanup } from "../../hooks/useCleanup";

dayjs.locale("vi");

const { width } = Dimensions.get("window");

// ==================== TYPES ====================
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

interface Pagination {
  current: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

interface LogsApiResponse {
  data: ActivityLog[];
  pagination: Pagination;
}

interface StatsApiResponse {
  data: {
    stats: ActivityStats;
  };
}

interface LogDetailApiResponse {
  data: ActivityLog;
}

interface ApiError {
  message?: string;
  error?: string;
}

type ViewMode = "table" | "attendance" | "timeline";

interface LogItemProps {
  item: ActivityLog;
  onPress: () => void;
  getActionColor: (action: string) => string;
}

interface AttendanceItemProps {
  item: ActivityLog;
}

interface TimelineItemProps {
  item: ActivityLog;
  isLast: boolean;
  getActionColor: (action: string) => string;
}

interface FetchOptions {
  page?: number;
  append?: boolean;
  signal?: AbortSignal;
}

// ==================== MEMOIZED COMPONENTS ====================
const LogItem = memo<LogItemProps>(({ item, onPress, getActionColor }) => (
  <TouchableOpacity
    style={styles.logCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
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

    <View style={styles.logTags}>
      <View
        style={[
          styles.tag,
          { backgroundColor: `${getActionColor(item.action)}20` },
        ]}
      >
        <Text style={[styles.tagText, { color: getActionColor(item.action) }]}>
          {item.action.toUpperCase()}
        </Text>
      </View>
      <View style={[styles.tag, { backgroundColor: "#e6f7ff" }]}>
        <Text style={[styles.tagText, { color: "#1890ff" }]}>
          {item.entity}
        </Text>
      </View>
    </View>

    <Text style={styles.logEntityName} numberOfLines={1}>
      {item.entityName}
    </Text>
    {item.description && (
      <Text style={styles.logDescription} numberOfLines={2}>
        {item.description}
      </Text>
    )}
  </TouchableOpacity>
));

LogItem.displayName = "LogItem";

const AttendanceItem = memo<AttendanceItemProps>(({ item }) => {
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
          <Text style={styles.attendanceRole}>
            {item.userDetail?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
          </Text>
          <Text style={styles.attendanceEmail}>
            {item.userDetail?.email || "-"}
          </Text>
        </View>
        <View style={styles.attendanceRight}>
          <View style={styles.attendanceTimeContainer}>
            <Ionicons name="time-outline" size={16} color="#1890ff" />
            <Text style={styles.attendanceTime}>
              {dayjs(item.createdAt).format("HH:mm")}
            </Text>
          </View>
          {item.storeDetail?.name && (
            <View style={styles.storeTag}>
              <Text style={styles.storeTagText}>{item.storeDetail.name}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.attendanceInfo}>
        <View
          style={[
            styles.deviceBadge,
            { backgroundColor: isStoreIP ? "#f6ffed" : "#fff7e6" },
          ]}
        >
          <Ionicons
            name={isStoreIP ? "desktop-outline" : "phone-portrait-outline"}
            size={14}
            color={isStoreIP ? "#52c41a" : "#fa8c16"}
          />
          <Text
            style={[
              styles.deviceText,
              { color: isStoreIP ? "#52c41a" : "#fa8c16" },
            ]}
          >
            {isStoreIP ? "Máy tại quán" : "Thiết bị lạ"}
          </Text>
        </View>
        {item.ip && (
          <View style={styles.ipContainer}>
            <Ionicons name="location-outline" size={12} color="#8c8c8c" />
            <Text style={styles.ipText}>{item.ip}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

AttendanceItem.displayName = "AttendanceItem";

const TimelineItem = memo<TimelineItemProps>(
  ({ item, isLast, getActionColor }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: getActionColor(item.action) },
          ]}
        />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineTime}>
          {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm:ss")}
        </Text>
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineUser}>{item.userName}</Text>
            <View
              style={[
                styles.timelineRoleBadge,
                {
                  backgroundColor:
                    item.userRole === "MANAGER" ? "#e6f4ff" : "#f6ffed",
                },
              ]}
            >
              <Text
                style={[
                  styles.timelineRoleText,
                  {
                    color: item.userRole === "MANAGER" ? "#1890ff" : "#52c41a",
                  },
                ]}
              >
                {item.userRole}
              </Text>
            </View>
          </View>
          <View style={styles.timelineTags}>
            <View
              style={[
                styles.timelineActionTag,
                { backgroundColor: `${getActionColor(item.action)}20` },
              ]}
            >
              <Text
                style={[
                  styles.timelineActionText,
                  { color: getActionColor(item.action) },
                ]}
              >
                {item.action.toUpperCase()}
              </Text>
            </View>
            <View style={styles.timelineEntityTag}>
              <Text style={styles.timelineEntityText}>{item.entity}</Text>
            </View>
          </View>
          <Text style={styles.timelineEntityName}>{item.entityName}</Text>
          {item.description && (
            <Text style={styles.timelineDescription}>{item.description}</Text>
          )}
        </View>
      </View>
    </View>
  )
);

TimelineItem.displayName = "TimelineItem";

// ==================== MAIN COMPONENT ====================
const ActivityLogScreen: FC = () => {
  const { createAbortController } = useCleanup("ActivityLogScreen");
  const { currentStore } = useAuth();
  const storeId: string | undefined = currentStore?._id;
  const storeName: string = currentStore?.name || "Chưa chọn cửa hàng";

  // Refs
  const isMountedRef = useRef<boolean>(true);
  const isLoadingMoreRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [attendance, setAttendance] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);

  // UI States
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
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
  const actions: string[] = [
    "create",
    "update",
    "delete",
    "restore",
    "auth",
    "other",
  ];

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const pageSize: number = 20;

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==================== FETCH STATS ====================
  const fetchStats = useCallback(async (): Promise<void> => {
    if (!storeId) return;

    const controller = createAbortController();
    const signal: AbortSignal = controller.signal;

    try {
      const response = await apiClient.get<StatsApiResponse>(
        `/activity-logs/stats`,
        {
          params: { storeId },
          signal,
        } as any
      );

      if (isMountedRef.current) {
        setStats(response.data.data.stats);
      }
    } catch (err) {
      const error = err as any;
      if (
        error.name !== "AbortError" &&
        error.name !== "CanceledError" &&
        isMountedRef.current
      ) {
        console.error(
          "❌ Lỗi lấy thống kê:",
          error.response?.data?.message || error.message
        );
      }
    }
  }, [storeId, createAbortController]);

  // ==================== FETCH FILTER OPTIONS ====================
  const fetchFilterOptions = useCallback(async (): Promise<void> => {
    if (!storeId) return;

    const controller = createAbortController();
    const signal: AbortSignal = controller.signal;

    try {
      const response = await apiClient.get<LogsApiResponse>(`/activity-logs`, {
        params: { storeId, limit: 1000 },
        signal,
      } as any);

      if (isMountedRef.current) {
        const logsData: ActivityLog[] = Array.isArray(response.data.data)
          ? response.data.data
          : [];

        if (logsData.length === 0) {
          return;
        }

        const uniqueEntities: string[] = [
          ...new Set(logsData.map((l) => l.entity).filter(Boolean)),
        ];
        const uniqueUsers: string[] = [
          ...new Set(logsData.map((l) => l.userName).filter(Boolean)),
        ];

        setEntities(uniqueEntities);
        setUsers(uniqueUsers);
      }
    } catch (err) {
      const error = err as any;
      if (
        error.name !== "AbortError" &&
        error.name !== "CanceledError" &&
        isMountedRef.current
      ) {
        console.error(
          "❌ Lỗi lấy filter options:",
          error.response?.data?.message || error.message
        );
      }
    }
  }, [storeId, createAbortController]);

  // ==================== FETCH LOGS ====================
  const fetchLogs = useCallback(
    async (options: FetchOptions = {}): Promise<void> => {
      if (!storeId) {
        Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
        return;
      }

      const { page = 1, append = false, signal } = options;

      if (append && isLoadingMoreRef.current) {
        return;
      }

      if (append) {
        isLoadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const controller = createAbortController();
      const abortSignal: AbortSignal = signal || controller.signal;

      try {
        const params: Record<string, string | number> = {
          storeId,
          page,
          limit: pageSize,
          sort: "-createdAt",
        };

        if (userName) params.userName = userName;
        if (action) params.action = action;
        if (entity) params.entity = entity;
        if (keyword) params.keyword = keyword;

        const response = await apiClient.get<LogsApiResponse>(
          `/activity-logs`,
          {
            params,
            signal: abortSignal,
          } as any
        );

        if (!isMountedRef.current) return;

        const newLogs: ActivityLog[] = Array.isArray(response.data.data)
          ? response.data.data
          : [];
        const pagination: Pagination = response.data.pagination || {
          current: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
        };

        if (append) {
          setLogs((prevLogs) => {
            const existingIds = new Set(prevLogs.map((log) => log._id));
            const uniqueNewLogs = newLogs.filter(
              (log) => !existingIds.has(log._id)
            );
            return [...prevLogs, ...uniqueNewLogs];
          });
        } else {
          setLogs(newLogs);
          setIsFilterExpanded(false);
        }

        setCurrentPage(pagination.current);
        setTotalPages(
          pagination.totalPages ||
            Math.ceil(pagination.total / pagination.pageSize)
        );
        setTotalLogs(pagination.total);
        setHasMore(
          pagination.current <
            (pagination.totalPages ||
              Math.ceil(pagination.total / pagination.pageSize))
        );
      } catch (err) {
        const error = err as any;
        if (
          error.name !== "AbortError" &&
          error.name !== "CanceledError" &&
          isMountedRef.current
        ) {
          console.error(
            "❌ Lỗi lấy logs:",
            error.response?.data?.message || error.message
          );
          if (!append) {
            Alert.alert("Lỗi", "Không thể tải nhật ký hoạt động");
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
          isLoadingMoreRef.current = false;
        }
      }
    },
    [
      storeId,
      userName,
      action,
      entity,
      keyword,
      pageSize,
      createAbortController,
    ]
  );

  // ==================== FETCH ATTENDANCE ====================
  const fetchAttendance = useCallback(async (): Promise<void> => {
    if (!storeId) return;

    setLoading(true);
    const controller = createAbortController();
    const signal: AbortSignal = controller.signal;

    try {
      const response = await apiClient.get<LogsApiResponse>(`/activity-logs`, {
        params: {
          storeId,
          action: "auth",
          entity: "Store",
          fromDate: dayjs().format("YYYY-MM-DD"),
          toDate: dayjs().format("YYYY-MM-DD"),
          page: 1,
          limit: 100,
          sort: "-createdAt",
        },
        signal,
      } as any);

      if (isMountedRef.current) {
        const attendanceData: ActivityLog[] = Array.isArray(response.data.data)
          ? response.data.data
          : [];
        setAttendance(attendanceData);
      }
    } catch (err) {
      const error = err as any;
      if (
        error.name !== "AbortError" &&
        error.name !== "CanceledError" &&
        isMountedRef.current
      ) {
        console.error(
          "❌ Lỗi lấy điểm danh:",
          error.response?.data?.message || error.message
        );
        Alert.alert("Lỗi", "Không thể tải dữ liệu điểm danh");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [storeId, createAbortController]);

  // ==================== FETCH LOG DETAIL ====================
  const fetchLogDetail = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      const controller = createAbortController();
      const signal: AbortSignal = controller.signal;

      try {
        const response = await apiClient.get<LogDetailApiResponse>(
          `/activity-logs/${id}`,
          {
            params: { storeId },
            signal,
          } as any
        );

        if (isMountedRef.current) {
          setSelectedLog(response.data.data);
          setDetailModalVisible(true);
        }
      } catch (err) {
        const error = err as any;
        if (
          error.name !== "AbortError" &&
          error.name !== "CanceledError" &&
          isMountedRef.current
        ) {
          console.error(
            "❌ Lỗi lấy chi tiết:",
            error.response?.data?.message || error.message
          );
          Alert.alert("Lỗi", "Không thể tải chi tiết log");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [storeId, createAbortController]
  );

  // ==================== INIT ====================
  useEffect(() => {
    if (storeId && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchStats();
      fetchFilterOptions();
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      setCurrentPage(1);
      setLogs([]);
      setAttendance([]);

      if (viewMode === "table" || viewMode === "timeline") {
        fetchLogs({ page: 1, append: false });
      } else if (viewMode === "attendance") {
        fetchAttendance();
      }
    }
  }, [storeId, viewMode]);

  useEffect(() => {
    hasInitializedRef.current = false;
  }, [storeId]);

  // ==================== HELPER FUNCTIONS ====================
  const getFilterDisplayText = useCallback((): string => {
    const parts: string[] = [];
    if (userName) parts.push(`User: ${userName}`);
    if (action) parts.push(`Action: ${action}`);
    if (entity) parts.push(`Entity: ${entity}`);
    if (keyword) parts.push(`Keyword: ${keyword}`);
    return parts.length > 0 ? parts.join(" • ") : "Chưa áp dụng bộ lọc";
  }, [userName, action, entity, keyword]);

  const getActionColor = useCallback((actionType: string): string => {
    const colorMap: Record<string, string> = {
      create: "#52c41a",
      update: "#1890ff",
      delete: "#ff4d4f",
      restore: "#722ed1",
      auth: "#fa8c16",
      other: "#8c8c8c",
    };
    return colorMap[actionType] || "#8c8c8c";
  }, []);

  // ==================== HANDLERS ====================
  const handleRefresh = useCallback((): void => {
    setRefreshing(true);
    setCurrentPage(1);
    setLogs([]);
    setAttendance([]);

    if (viewMode === "table" || viewMode === "timeline") {
      fetchLogs({ page: 1, append: false });
    } else {
      fetchAttendance();
    }
  }, [viewMode, fetchLogs, fetchAttendance]);

  const handleLoadMore = useCallback((): void => {
    if (
      !loading &&
      !loadingMore &&
      !refreshing &&
      hasMore &&
      (viewMode === "table" || viewMode === "timeline")
    ) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchLogs({ page: nextPage, append: true });
    }
  }, [
    loading,
    loadingMore,
    refreshing,
    hasMore,
    currentPage,
    viewMode,
    fetchLogs,
  ]);

  const handleApplyFilters = useCallback((): void => {
    setCurrentPage(1);
    setLogs([]);
    setIsFilterExpanded(false);
    fetchLogs({ page: 1, append: false });
  }, [fetchLogs]);

  const handleResetFilters = useCallback((): void => {
    setUserName("");
    setAction("");
    setEntity("");
    setKeyword("");
    setCurrentPage(1);
    setLogs([]);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode): void => {
    setViewMode(mode);
  }, []);

  const handleCloseModal = useCallback((): void => {
    setDetailModalVisible(false);
  }, []);

  // ==================== RENDER FUNCTIONS ====================
  const renderLogItem: ListRenderItem<ActivityLog> = useCallback(
    ({ item }) => (
      <LogItem
        item={item}
        onPress={() => fetchLogDetail(item._id)}
        getActionColor={getActionColor}
      />
    ),
    [fetchLogDetail, getActionColor]
  );

  const renderAttendanceItem: ListRenderItem<ActivityLog> = useCallback(
    ({ item }) => <AttendanceItem item={item} />,
    []
  );

  const renderTimelineItem: ListRenderItem<ActivityLog> = useCallback(
    ({ item, index }) => (
      <TimelineItem
        item={item}
        isLast={index === logs.length - 1}
        getActionColor={getActionColor}
      />
    ),
    [logs.length, getActionColor]
  );

  const keyExtractor = useCallback((item: ActivityLog): string => item._id, []);

  const renderListFooter = useCallback((): JSX.Element | null => {
    if (!loadingMore) return null;

    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color="#1890ff" />
        <Text style={styles.loadMoreText}>Đang tải thêm...</Text>
      </View>
    );
  }, [loadingMore]);

  const renderListEmpty = useCallback((): JSX.Element | null => {
    if (loading || refreshing) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name={
            viewMode === "attendance"
              ? "people-outline"
              : viewMode === "timeline"
                ? "time-outline"
                : "document-outline"
          }
          size={64}
          color="#d9d9d9"
        />
        <Text style={styles.emptyText}>
          {viewMode === "attendance"
            ? "Chưa có nhân viên nào vào ca hôm nay"
            : "Chưa có nhật ký hoạt động"}
        </Text>
        <Text style={styles.emptySubtext}>
          Dữ liệu sẽ xuất hiện khi có hoạt động mới
        </Text>
      </View>
    );
  }, [loading, refreshing, viewMode]);

  // ==================== RENDER ====================
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconCircle}>
          <Ionicons name="alert-circle-outline" size={64} color="#ff4d4f" />
        </View>
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>
          Vui lòng chọn cửa hàng để xem nhật ký hoạt động
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#1890ff", "#096dd9"]} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="document-text" size={28} color="#ffffff" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>📋 Nhật ký hoạt động</Text>
            <Text style={styles.headerSubtitle}>{storeName}</Text>
          </View>
        </View>

        {/* View Mode Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, viewMode === "table" && styles.tabActive]}
            onPress={() => handleViewModeChange("table")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={viewMode === "table" ? "#1890ff" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === "table" && styles.tabTextActive,
              ]}
            >
              Nhật ký chung
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, viewMode === "attendance" && styles.tabActive]}
            onPress={() => handleViewModeChange("attendance")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={viewMode === "attendance" ? "#1890ff" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === "attendance" && styles.tabTextActive,
              ]}
            >
              Vào ca hôm nay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, viewMode === "timeline" && styles.tabActive]}
            onPress={() => handleViewModeChange("timeline")}
            activeOpacity={0.7}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={viewMode === "timeline" ? "#1890ff" : "#ffffff"}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === "timeline" && styles.tabTextActive,
              ]}
            >
              Timeline
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Content */}
      <FlatList
        data={viewMode === "attendance" ? attendance : logs}
        renderItem={
          viewMode === "attendance"
            ? renderAttendanceItem
            : viewMode === "timeline"
              ? renderTimelineItem
              : renderLogItem
        }
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Filter Section */}
            {(viewMode === "table" || viewMode === "timeline") && (
              <View style={styles.filterSection}>
                <TouchableOpacity
                  style={styles.filterToggle}
                  onPress={() => setIsFilterExpanded(!isFilterExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterToggleLeft}>
                    <Ionicons name="funnel-outline" size={20} color="#1890ff" />
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

                    <Text style={styles.filterLabel}>Hành động</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={action}
                        onValueChange={(value: string) => setAction(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="Tất cả hành động" value="" />
                        {actions.map((a) => (
                          <Picker.Item
                            key={a}
                            label={a.toUpperCase()}
                            value={a}
                          />
                        ))}
                      </Picker>
                    </View>

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

                    <Text style={styles.filterLabel}>Tìm kiếm</Text>
                    <TextInput
                      style={styles.keywordInput}
                      value={keyword}
                      onChangeText={setKeyword}
                      placeholder="Nhập từ khóa..."
                      placeholderTextColor="#bfbfbf"
                    />

                    <View style={styles.filterActions}>
                      <TouchableOpacity
                        style={styles.filterResetBtn}
                        onPress={handleResetFilters}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.filterResetText}>Đặt lại</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.filterApplyBtn}
                        onPress={handleApplyFilters}
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={["#1890ff", "#096dd9"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.filterApplyGradient}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <Text style={styles.filterApplyText}>
                              Xem nhật ký
                            </Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Stats Section */}
            {stats && (viewMode === "table" || viewMode === "timeline") && (
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
                    color="#595959"
                  />
                </TouchableOpacity>

                {isStatsExpanded && (
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#e6f7ff" },
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={24}
                          color="#1890ff"
                        />
                      </View>
                      <Text style={styles.statValue}>{stats.totalLogs}</Text>
                      <Text style={styles.statLabel}>Tổng nhật ký</Text>
                    </View>

                    <View style={styles.statCard}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#f6ffed" },
                        ]}
                      >
                        <Ionicons
                          name="people-outline"
                          size={24}
                          color="#52c41a"
                        />
                      </View>
                      <Text style={styles.statValue}>{stats.uniqueUsers}</Text>
                      <Text style={styles.statLabel}>Người dùng</Text>
                    </View>

                    <View style={styles.statCard}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#fff7e6" },
                        ]}
                      >
                        <Ionicons
                          name="flash-outline"
                          size={24}
                          color="#fa8c16"
                        />
                      </View>
                      <Text style={styles.statValue}>
                        {Object.keys(stats.actionCounts)[0]?.toUpperCase() ||
                          "N/A"}
                      </Text>
                      <Text style={styles.statLabel}>Hành động phổ biến</Text>
                    </View>

                    <View style={styles.statCard}>
                      <View
                        style={[
                          styles.statIcon,
                          { backgroundColor: "#f9f0ff" },
                        ]}
                      >
                        <Ionicons
                          name="cube-outline"
                          size={24}
                          color="#722ed1"
                        />
                      </View>
                      <Text style={styles.statValue}>
                        {Object.keys(stats.entityCounts)[0] || "N/A"}
                      </Text>
                      <Text style={styles.statLabel}>Đối tượng phổ biến</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Pagination Info */}
            {(viewMode === "table" || viewMode === "timeline") &&
              logs.length > 0 && (
                <View style={styles.paginationInfo}>
                  <Text style={styles.paginationText}>
                    Đang xem{" "}
                    <Text style={styles.paginationHighlight}>
                      {logs.length}
                    </Text>{" "}
                    / <Text style={styles.paginationTotal}>{totalLogs}</Text>{" "}
                    nhật ký
                  </Text>
                  {hasMore && (
                    <View style={styles.paginationSubtextContainer}>
                      <Ionicons
                        name="arrow-down-circle-outline"
                        size={14}
                        color="#8c8c8c"
                      />
                      <Text style={styles.paginationSubtext}>
                        Kéo xuống để tải thêm
                      </Text>
                    </View>
                  )}
                </View>
              )}

            {/* Attendance Header */}
            {viewMode === "attendance" && (
              <View style={styles.attendanceHeader}>
                <View style={styles.attendanceTitleContainer}>
                  <Ionicons name="people" size={24} color="#1890ff" />
                  <Text style={styles.attendanceTitle}>
                    Nhân viên vào ca hôm nay
                  </Text>
                </View>
                <View style={styles.attendanceDateTag}>
                  <Text style={styles.attendanceDateText}>
                    {dayjs().format("DD/MM/YYYY")}
                  </Text>
                </View>
              </View>
            )}
          </>
        }
        ListFooterComponent={renderListFooter}
        ListEmptyComponent={renderListEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#1890ff"]}
            tintColor="#1890ff"
            title="Đang làm mới..."
            titleColor="#8c8c8c"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        showsVerticalScrollIndicator={true}
      />

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết nhật ký</Text>
              <TouchableOpacity onPress={handleCloseModal} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color="#8c8c8c" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {selectedLog ? (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Người dùng</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.userName}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Vai trò</Text>
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
                    <Text style={styles.detailLabel}>Hành động</Text>
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
                    <Text style={styles.detailLabel}>Đối tượng</Text>
                    <View
                      style={[
                        styles.detailBadge,
                        { backgroundColor: "#e6f7ff" },
                      ]}
                    >
                      <Text
                        style={[styles.detailBadgeText, { color: "#1890ff" }]}
                      >
                        {selectedLog.entity}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Tên đối tượng</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.entityName}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Mô tả</Text>
                    <Text style={styles.detailValue}>
                      {selectedLog.description || "Không có mô tả"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Địa chỉ IP</Text>
                    <Text style={[styles.detailValue, styles.detailValueCode]}>
                      {selectedLog.ip || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>
                      Thiết bị & Trình duyệt
                    </Text>
                    <Text style={styles.detailValue} numberOfLines={3}>
                      {selectedLog.userAgent || "-"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Thời gian</Text>
                    <Text style={styles.detailValue}>
                      {dayjs(selectedLog.createdAt).format(
                        "DD/MM/YYYY HH:mm:ss"
                      )}
                    </Text>
                  </View>
                </>
              ) : (
                <ActivityIndicator
                  size="large"
                  color="#1890ff"
                  style={{ marginTop: 40 }}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ActivityLogScreen;

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  header: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#ffffff",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  tabTextActive: {
    color: "#1890ff",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  filterSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
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
  filterToggleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1890ff",
  },
  filterTogglePeriod: {
    fontSize: 11,
    color: "#8c8c8c",
    marginTop: 2,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#262626",
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    height: 48,
  },
  keywordInput: {
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#262626",
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  filterResetText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#595959",
  },
  filterApplyBtn: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  filterApplyGradient: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterApplyText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  statsSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statsToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsToggleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#262626",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fafafa",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#262626",
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#8c8c8c",
    textAlign: "center",
    fontWeight: "600",
  },
  paginationInfo: {
    backgroundColor: "#e6f7ff",
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    alignItems: "center",
  },
  paginationText: {
    fontSize: 13,
    color: "#595959",
    textAlign: "center",
  },
  paginationHighlight: {
    fontWeight: "800",
    color: "#1890ff",
  },
  paginationTotal: {
    fontWeight: "800",
    color: "#ff4d4f",
  },
  paginationSubtextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  paginationSubtext: {
    fontSize: 11,
    color: "#8c8c8c",
  },
  attendanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  attendanceTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#262626",
  },
  attendanceDateTag: {
    backgroundColor: "#e6f7ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  attendanceDateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1890ff",
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  logUser: {
    fontSize: 15,
    fontWeight: "700",
    color: "#262626",
    marginBottom: 2,
  },
  logTime: {
    fontSize: 11,
    color: "#8c8c8c",
    fontWeight: "500",
  },
  roleBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  logTags: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  tag: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  logEntityName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 4,
  },
  logDescription: {
    fontSize: 12,
    color: "#595959",
    lineHeight: 18,
  },
  attendanceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  attendanceName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#262626",
    marginBottom: 2,
  },
  attendanceRole: {
    fontSize: 11,
    color: "#595959",
    fontWeight: "600",
    marginBottom: 2,
  },
  attendanceEmail: {
    fontSize: 11,
    color: "#8c8c8c",
  },
  attendanceRight: {
    alignItems: "flex-end",
  },
  attendanceTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e6f7ff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  attendanceTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1890ff",
  },
  storeTag: {
    backgroundColor: "#f9f0ff",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  storeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#722ed1",
  },
  attendanceInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  deviceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  deviceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  ipContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ipText: {
    fontSize: 10,
    color: "#8c8c8c",
    fontFamily: "monospace",
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  timelineLeft: {
    width: 32,
    alignItems: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: "#ffffff",
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#d9d9d9",
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 12,
  },
  timelineTime: {
    fontSize: 11,
    color: "#8c8c8c",
    fontWeight: "600",
    marginBottom: 6,
  },
  timelineCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineUser: {
    fontSize: 14,
    fontWeight: "700",
    color: "#262626",
    flex: 1,
  },
  timelineRoleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  timelineRoleText: {
    fontSize: 10,
    fontWeight: "700",
  },
  timelineTags: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  timelineActionTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  timelineActionText: {
    fontSize: 10,
    fontWeight: "700",
  },
  timelineEntityTag: {
    backgroundColor: "#e6f7ff",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  timelineEntityText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1890ff",
  },
  timelineEntityName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 11,
    color: "#595959",
    lineHeight: 16,
  },
  loadMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: "#8c8c8c",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: "#595959",
    marginTop: 16,
    marginBottom: 4,
    textAlign: "center",
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: 12,
    color: "#8c8c8c",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f2f5",
    padding: 32,
  },
  errorIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff1f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#262626",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#595959",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#262626",
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8c8c8c",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    color: "#262626",
    fontWeight: "500",
    lineHeight: 20,
  },
  detailValueCode: {
    fontFamily: "monospace",
    backgroundColor: "#fafafa",
    padding: 8,
    borderRadius: 6,
  },
  detailBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
