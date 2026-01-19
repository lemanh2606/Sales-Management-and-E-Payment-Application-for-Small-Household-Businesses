// src/screens/reports/RevenueReportScreen.tsx
import React, { useCallback, useMemo, useState, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
  Modal,
  Linking,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import { BarChart } from "react-native-gifted-charts";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

// =====================
// TYPES
// =====================
interface RevenueSummary {
  totalRevenue: number | { $numberDecimal: string };
  countOrders: number;
}

interface EmployeeRevenue {
  _id: string;
  employeeInfo: {
    fullName: string;
    username: string;
  };
  countOrders: number;
  totalRevenue: number | { $numberDecimal: string };
}

interface RevenueResponse {
  revenue: RevenueSummary;
}

interface EmployeeRevenueResponse {
  data: EmployeeRevenue[];
}

type PeriodType = "" | "month" | "quarter" | "year";
type QuickPreset = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear";
type PickerTarget = "month" | "quarter" | "year";

// =====================
// SMALL UI COMPONENTS
// =====================

function PresetChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.presetChip, active && styles.presetChipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={16} color={active ? "#1890ff" : "#6b7280"} />
      <Text
        style={[styles.presetChipText, active && styles.presetChipTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PeriodTypePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.typePill, active && styles.typePillActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DateFieldButton({
  label,
  valueText,
  subText,
  onPress,
  icon = "calendar-outline",
}: {
  label: string;
  valueText: string;
  subText?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      style={styles.dateFieldBtn}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.dateFieldLeft}>
        <View style={styles.dateFieldIconWrap}>
          <Ionicons name={icon} size={18} color="#1890ff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.dateFieldLabel}>{label}</Text>
          <Text style={styles.dateFieldValue}>{valueText}</Text>
          {!!subText && <Text style={styles.dateFieldSub}>{subText}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
}

// =====================
// MAIN SCREEN
// =====================
const RevenueReportScreen: React.FC = () => {
  const { currentStore, token } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // Loading states
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeRevenue[]>([]);

  // Filter collapse
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);
  
  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("");
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    dayjs().month() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    dayjs().quarter()
  );

  // Track preset đang chọn
  const [activePreset, setActivePreset] = useState<QuickPreset | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<"orders" | "revenue">("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // =====================
  // DATE PICKER (expo-friendly)
  // =====================
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>("month");
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // =====================
  // HELPERS
  // =====================
  const toNumber = (
    value: number | { $numberDecimal: string } | undefined | null
  ): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "object" && "$numberDecimal" in value) {
      const n = parseFloat(value.$numberDecimal);
      return Number.isFinite(n) ? n : 0;
    }
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  const formatVND = (
    value: number | { $numberDecimal: string } | undefined | null
  ): string => {
    const num = toNumber(value);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const buildPeriodKey = useCallback(
    (type: PeriodType, y: number, m: number, q: number): string => {
      if (!type) return "";
      if (type === "month") return `${y}-${String(m).padStart(2, "0")}`;
      if (type === "quarter") return `${y}-Q${q}`;
      if (type === "year") return String(y);
      return "";
    },
    []
  );

  const periodKey = useMemo(() => {
    return buildPeriodKey(
      periodType,
      selectedYear,
      selectedMonth,
      selectedQuarter
    );
  }, [
    buildPeriodKey,
    periodType,
    selectedMonth,
    selectedQuarter,
    selectedYear,
  ]);

  const periodDisplayText = useMemo((): string => {
    if (!periodType) return "Chưa chọn kỳ";
    if (periodType === "month") return `Tháng ${selectedMonth}/${selectedYear}`;
    if (periodType === "quarter")
      return `Quý ${selectedQuarter}/${selectedYear}`;
    if (periodType === "year") return `Năm ${selectedYear}`;
    return "";
  }, [periodType, selectedMonth, selectedQuarter, selectedYear]);

  const canFetch = useMemo(() => {
    return !!storeId && !!periodType && !!periodKey && !loading;
  }, [storeId, periodType, periodKey, loading]);

  const pickerPreview = useMemo(() => {
    const d = dayjs(tempDate);
    if (pickerTarget === "month") return `Tháng ${d.month() + 1}/${d.year()}`;
    if (pickerTarget === "quarter") return `Quý ${d.quarter()}/${d.year()}`;
    return `Năm ${d.year()}`;
  }, [pickerTarget, tempDate]);

  const pickerSubPreview = useMemo(() => {
    const d = dayjs(tempDate);
    if (pickerTarget === "month")
      return `Mã kỳ: ${buildPeriodKey("month", d.year(), d.month() + 1, d.quarter())}`;
    if (pickerTarget === "quarter")
      return `Mã kỳ: ${buildPeriodKey("quarter", d.year(), d.month() + 1, d.quarter())}`;
    return `Mã kỳ: ${buildPeriodKey("year", d.year(), d.month() + 1, d.quarter())}`;
  }, [buildPeriodKey, pickerTarget, tempDate]);

  // =====================
  // FETCH (centralized)
  // =====================
  const fetchReport = useCallback(
    async ({
      type,
      key,
      isRefresh = false,
      collapseOnSuccess = false,
    }: {
      type: PeriodType;
      key: string;
      isRefresh?: boolean;
      collapseOnSuccess?: boolean;
    }) => {
      if (!storeId || !type || !key) {
        setSummary(null);
        setEmployeeData([]);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const totalRes = await apiClient.get<RevenueResponse>("/revenues", {
          params: { storeId, periodType: type, periodKey: key },
        });
        setSummary(totalRes.data.revenue);

        const empRes = await apiClient.get<EmployeeRevenueResponse>(
          "/revenues/employee",
          {
            params: { storeId, periodType: type, periodKey: key },
          }
        );
        setEmployeeData(empRes.data.data || []);

        if (collapseOnSuccess) setIsFilterExpanded(false);
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Lỗi tải báo cáo doanh thu";
        setError(errorMessage);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId]
  );

  const fetchCurrent = useCallback(
    async (options?: { isRefresh?: boolean; collapseOnSuccess?: boolean }) => {
      return fetchReport({
        type: periodType,
        key: periodKey,
        isRefresh: options?.isRefresh ?? false,
        collapseOnSuccess: options?.collapseOnSuccess ?? false,
      });
    },
    [fetchReport, periodKey, periodType]
  );

  // =====================
  // ACTIONS
  // =====================
  const changePeriodType = useCallback((type: PeriodType) => {
    setActivePreset(null);
    setPeriodType(type);

    const now = dayjs();
    setSelectedYear(now.year());
    setSelectedMonth(now.month() + 1);
    setSelectedQuarter(now.quarter());

    setSummary(null);
    setEmployeeData([]);
    setError(null);
  }, []);

  const applyPreset = useCallback(
    async (preset: QuickPreset) => {
      const now = dayjs();
      setActivePreset(preset);
      setError(null);

      let nextType: PeriodType = "month";
      let y = now.year();
      let m = now.month() + 1;
      let q = now.quarter();

      if (preset === "thisMonth") {
        nextType = "month";
      } else if (preset === "lastMonth") {
        const last = now.subtract(1, "month");
        nextType = "month";
        y = last.year();
        m = last.month() + 1;
        q = last.quarter();
      } else if (preset === "thisQuarter") {
        nextType = "quarter";
      } else if (preset === "thisYear") {
        nextType = "year";
      }

      setPeriodType(nextType);
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedQuarter(q);

      const key = buildPeriodKey(nextType, y, m, q);
      await fetchReport({ type: nextType, key, collapseOnSuccess: true });
    },
    [buildPeriodKey, fetchReport]
  );

  const shiftPeriod = useCallback(
    (direction: -1 | 1) => {
      setActivePreset(null);
      if (!periodType) return;

      if (periodType === "month") {
        const base = dayjs(
          `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`
        );
        const next = base.add(direction, "month");
        setSelectedYear(next.year());
        setSelectedMonth(next.month() + 1);
        setSelectedQuarter(next.quarter());
        return;
      }

      if (periodType === "quarter") {
        const startMonth = (selectedQuarter - 1) * 3;
        const quarterBase = dayjs()
          .year(selectedYear)
          .month(startMonth)
          .date(1);
        const next = quarterBase.add(direction, "quarter");
        setSelectedYear(next.year());
        setSelectedQuarter(next.quarter());
        setSelectedMonth(next.month() + 1);
        return;
      }

      setSelectedYear((y) => y + direction);
    },
    [periodType, selectedMonth, selectedQuarter, selectedYear]
  );

  const openPicker = useCallback(
    (target: PickerTarget) => {
      setActivePreset(null);
      setPickerTarget(target);

      if (target === "month") {
        setTempDate(
          dayjs()
            .year(selectedYear)
            .month(Math.max(0, selectedMonth - 1))
            .date(1)
            .toDate()
        );
      } else if (target === "quarter") {
        const startMonth = (selectedQuarter - 1) * 3;
        setTempDate(
          dayjs().year(selectedYear).month(startMonth).date(1).toDate()
        );
      } else {
        setTempDate(dayjs().year(selectedYear).month(0).date(1).toDate());
      }

      setShowDatePicker(true);
    },
    [selectedMonth, selectedQuarter, selectedYear]
  );

  const applyPickedDate = useCallback((date: Date, target: PickerTarget) => {
    const d = dayjs(date);

    if (target === "month") {
      setSelectedYear(d.year());
      setSelectedMonth(d.month() + 1);
      setSelectedQuarter(d.quarter());
      return;
    }

    if (target === "quarter") {
      setSelectedYear(d.year());
      setSelectedQuarter(d.quarter());
      setSelectedMonth(d.month() + 1);
      return;
    }

    setSelectedYear(d.year());
  }, []);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "dismissed") {
          setShowDatePicker(false);
          return;
        }
        const picked = date ?? tempDate;
        applyPickedDate(picked, pickerTarget);
        setShowDatePicker(false);
        return;
      }
      if (date) setTempDate(date);
    },
    [applyPickedDate, pickerTarget, tempDate]
  );

  const closePickerIOS = useCallback(() => setShowDatePicker(false), []);
  const confirmPickerIOS = useCallback(() => {
    applyPickedDate(tempDate, pickerTarget);
    setShowDatePicker(false);
  }, [applyPickedDate, pickerTarget, tempDate]);

  // =====================
  // EXPORT
  // =====================
  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!storeId || !periodType || !periodKey) {
      alert("Vui lòng chọn kỳ báo cáo trước");
      return;
    }

    try {
      const url = `${apiClient.defaults.baseURL}/revenues/export?storeId=${storeId}&periodType=${periodType}&periodKey=${periodKey}&format=${format}&token=${token}`;
      await Linking.openURL(url);
      setShowExportModal(false);
    } catch (error) {
      alert("Không thể mở liên kết tải về");
    }
  };

  // =====================
  // SORTING
  // =====================
  const toggleSort = (type: "orders" | "revenue"): void => {
    if (sortBy === type)
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortBy(type);
      setSortOrder("desc");
    }
  };

  const sortedEmployeeData = useMemo((): EmployeeRevenue[] => {
    return [...employeeData].sort((a, b) => {
      const aValue =
        sortBy === "orders" ? a.countOrders : toNumber(a.totalRevenue);
      const bValue =
        sortBy === "orders" ? b.countOrders : toNumber(b.totalRevenue);
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [employeeData, sortBy, sortOrder]);

  // =====================
  // RENDER ITEM
  // =====================
  const renderEmployeeItem = ({
    item,
    index,
  }: {
    item: EmployeeRevenue;
    index: number;
  }): JSX.Element => {
    const rankColors = ["#fbbf24", "#94a3b8", "#d97706"];
    const rankColor = index < 3 ? rankColors[index] : "#cbd5e1";
    const maxRevenue = Math.max(...employeeData.map(e => toNumber(e.totalRevenue)), 1);
    const progress = (toNumber(item.totalRevenue) / maxRevenue) * 100;

    return (
      <View style={styles.employeeCard}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        <View style={styles.employeeInfo}>
          <View style={styles.employeeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeName}>{item.employeeInfo.fullName}</Text>
              <Text style={styles.employeeUsername}>@{item.employeeInfo.username}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Hoá đơn</Text>
              <Text style={styles.statValue}>{item.countOrders}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Doanh thu</Text>
              <Text style={[styles.statValue, { color: "#1890ff" }]}>
                {formatVND(item.totalRevenue)}
              </Text>
            </View>
          </View>
          
          <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>
    );
  };

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
          <Ionicons name="trending-up" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>D.Thu Nhân viên</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{storeName}</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerBtn}
          onPress={() => setShowExportModal(true)}
        >
          <Ionicons name="download-outline" size={20} color="#1890ff" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterSection}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setIsFilterExpanded((p) => !p)}
          activeOpacity={0.7}
        >
          <View style={styles.filterToggleLeft}>
            <Ionicons name="funnel" size={18} color="#1890ff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.filterToggleText}>
                {isFilterExpanded ? "Thu gọn bộ lọc" : "Bộ lọc thời gian"}
              </Text>
              {!isFilterExpanded && periodType && (
                <Text style={styles.filterTogglePeriod}>{periodDisplayText}</Text>
              )}
            </View>
          </View>
          <Ionicons
            name={isFilterExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#1890ff"
          />
        </TouchableOpacity>

        {isFilterExpanded && (
          <View style={styles.filterContent}>
            <Text style={styles.filterLabel}>Chọn nhanh</Text>
            <View style={styles.presetRow}>
              <PresetChip label="Tháng này" icon="calendar" active={activePreset === "thisMonth"} onPress={() => applyPreset("thisMonth")} />
              <PresetChip label="Tháng trước" icon="time" active={activePreset === "lastMonth"} onPress={() => applyPreset("lastMonth")} />
              <PresetChip label="Quý này" icon="albums" active={activePreset === "thisQuarter"} onPress={() => applyPreset("thisQuarter")} />
              <PresetChip label="Năm nay" icon="flag" active={activePreset === "thisYear"} onPress={() => applyPreset("thisYear")} />
            </View>

            <Text style={styles.filterLabel}>Kỳ báo cáo</Text>
            <View style={styles.typeRow}>
              <PeriodTypePill label="Tháng" active={periodType === "month"} onPress={() => changePeriodType("month")} />
              <PeriodTypePill label="Quý" active={periodType === "quarter"} onPress={() => changePeriodType("quarter")} />
              <PeriodTypePill label="Năm" active={periodType === "year"} onPress={() => changePeriodType("year")} />
            </View>

            {!!periodType && (
              <View style={{ marginTop: 12 }}>
                <View style={styles.navRow}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => shiftPeriod(-1)}>
                    <Ionicons name="chevron-back" size={16} color="#1890ff" />
                    <Text style={styles.navBtnText}>Trước</Text>
                  </TouchableOpacity>
                  <View style={styles.navCenter}>
                    <Text style={styles.navCenterText}>{periodDisplayText}</Text>
                    <Text style={styles.navCenterSub}>{periodKey}</Text>
                  </View>
                  <TouchableOpacity style={styles.navBtn} onPress={() => shiftPeriod(1)}>
                    <Text style={styles.navBtnText}>Sau</Text>
                    <Ionicons name="chevron-forward" size={16} color="#1890ff" />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={styles.actionBtn} onPress={() => fetchCurrent({ collapseOnSuccess: true })} disabled={!canFetch}>
                  <LinearGradient colors={["#1890ff", "#096dd9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtnGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Áp dụng bộ lọc</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCurrent({ isRefresh: true })} colors={["#1890ff"]} />
        }
      >
        {summary && (
          <View style={styles.summaryContainer}>
            <LinearGradient colors={["#1890ff", "#096dd9"]} style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Tổng doanh thu kỳ này</Text>
                <View style={styles.summaryBadge}><Text style={styles.summaryBadgeText}>{periodDisplayText}</Text></View>
              </View>
              <Text style={styles.summaryValue}>{formatVND(summary.totalRevenue)}</Text>
              <View style={styles.summaryFooter}>
                <Ionicons name="receipt-outline" size={16} color="#fff" opacity={0.8} />
                <Text style={styles.summarySubValue}>{summary.countOrders} vận đơn thành công</Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {!loading && sortedEmployeeData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Top Doanh Thu (Top 5)</Text>
            <View style={{ marginTop: 16 }}>
              <BarChart
                data={sortedEmployeeData.slice(0, 5).map(e => ({
                  value: toNumber(e.totalRevenue),
                  label: e.employeeInfo.fullName.split(" ").pop() || "NV",
                  frontColor: "#1890ff",
                  topLabelComponent: () => <Text style={{ fontSize: 9, color: "#64748b" }}>{Math.round(toNumber(e.totalRevenue)/1000000)}M</Text>
                }))}
                barWidth={32} barBorderRadius={6} height={150} yAxisTextStyle={{ fontSize: 10 }} xAxisLabelTextStyle={{ fontSize: 10 }} noOfSections={3} hideRules isAnimated
              />
            </View>
          </View>
        )}

        <View style={styles.sortBar}>
          <Text style={styles.sortTitle}>Chi tiết nhân viên</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity style={[styles.sortBtn, sortBy === "orders" && styles.sortBtnActive]} onPress={() => toggleSort("orders")}>
              <Text style={[styles.sortBtnText, sortBy === "orders" && styles.sortBtnTextActive]}>HĐ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortBtn, sortBy === "revenue" && styles.sortBtnActive]} onPress={() => toggleSort("revenue")}>
              <Text style={[styles.sortBtnText, sortBy === "revenue" && styles.sortBtnTextActive]}>D.Thu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && !refreshing && <ActivityIndicator style={{ marginTop: 20 }} color="#1890ff" />}
        
        <FlatList
          data={sortedEmployeeData}
          keyExtractor={(item) => item._id}
          renderItem={renderEmployeeItem}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />

        {sortedEmployeeData.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>Chưa có dữ liệu giao dịch</Text>
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {showDatePicker && Platform.OS === "ios" && (
        <Modal transparent visible animationType="fade">
            <View style={styles.pickerModalBackdrop}>
                <View style={styles.pickerModalCard}>
                    <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={onPickerChange} />
                    <View style={styles.pickerModalFooter}>
                        <TouchableOpacity style={styles.modalBtn} onPress={closePickerIOS}><Text style={styles.modalBtnText}>Huỷ</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={confirmPickerIOS}><Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Chọn</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
      )}

      {/* EXPORT MODAL */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.exportModal}>
            <Text style={styles.exportTitle}>Xuất báo cáo</Text>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport("xlsx")}>
              <Ionicons name="document-outline" size={24} color="#16a34a" />
              <Text style={styles.exportText}>Excel (.xlsx)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport("pdf")}>
              <Ionicons name="document-text-outline" size={24} color="#ef4444" />
              <Text style={styles.exportText}>PDF (.pdf)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExportModal(false)}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RevenueReportScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 12 },
  headerIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#1e293b" },
  headerSubtitle: { fontSize: 12, color: "#64748b" },
  
  filterSection: { backgroundColor: "#fff", margin: 16, borderRadius: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  filterToggle: { flexDirection: "row", alignItems: "center", padding: 14 },
  filterToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  filterToggleText: { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  filterTogglePeriod: { fontSize: 11, color: "#1890ff", marginTop: 2, fontWeight: "700" },
  filterContent: { padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  filterLabel: { fontSize: 12, fontWeight: "800", color: "#64748b", marginVertical: 8, textTransform: "uppercase" },
  
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  presetChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  presetChipActive: { backgroundColor: "#eff6ff", borderColor: "#1890ff" },
  presetChipText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  presetChipTextActive: { color: "#1890ff" },
  
  typeRow: { flexDirection: "row", gap: 8 },
  typePill: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  typePillActive: { backgroundColor: "#eff6ff", borderColor: "#1890ff" },
  typePillText: { fontSize: 12, fontWeight: "800", color: "#64748b" },
  typePillTextActive: { color: "#1890ff" },
  
  navRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 8, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  navBtnText: { fontSize: 12, fontWeight: "800", color: "#1890ff" },
  navCenter: { flex: 1, alignItems: "center" },
  navCenterText: { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  navCenterSub: { fontSize: 10, color: "#64748b", fontWeight: "700" },
  
  actionBtn: { borderRadius: 10, overflow: "hidden" },
  actionBtnGradient: { paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  
  scrollView: { flex: 1 },
  summaryContainer: { marginHorizontal: 16, marginTop: 8 },
  summaryCard: { padding: 16, borderRadius: 16, elevation: 4, shadowColor: "#1890ff", shadowOpacity: 0.15, shadowRadius: 10 },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTitle: { fontSize: 12, color: "#fff", opacity: 0.9, fontWeight: "700" },
  summaryBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  summaryBadgeText: { fontSize: 10, color: "#fff", fontWeight: "800" },
  summaryValue: { fontSize: 24, fontWeight: "900", color: "#fff", marginVertical: 8 },
  summaryFooter: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
  
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  exportModal: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  exportTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", textAlign: "center", marginBottom: 16 },
  exportOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: "#f8fafc", marginBottom: 8 },
  exportText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  cancelBtn: { marginTop: 8, padding: 14, alignItems: "center" },
  cancelText: { color: "#64748b", fontSize: 15, fontWeight: "600" },

  summarySubValue: { fontSize: 12, color: "#fff", fontWeight: "600" },
  
  chartCard: { backgroundColor: "#fff", margin: 16, padding: 16, borderRadius: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05 },
  chartTitle: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  
  sortBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginBottom: 12 },
  sortTitle: { fontSize: 15, fontWeight: "900", color: "#1e293b" },
  sortButtons: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 8, padding: 2 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  sortBtnActive: { backgroundColor: "#fff", elevation: 1 },
  sortBtnText: { fontSize: 11, fontWeight: "800", color: "#64748b" },
  sortBtnTextActive: { color: "#1890ff" },
  
  listContent: { paddingHorizontal: 16, gap: 10 },
  employeeCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "flex-start", borderWidth: 1, borderColor: "#f1f5f9" },
  rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rankText: { fontSize: 11, color: "#fff", fontWeight: "900" },
  employeeInfo: { flex: 1 },
  employeeHeader: { marginBottom: 10 },
  employeeName: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  employeeUsername: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 16 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "800", marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  progressBarBackground: { height: 4, backgroundColor: "#f1f5f9", borderRadius: 2, marginTop: 12, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#1890ff" },
  
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: "900", color: "#1e293b", marginTop: 16 },
  errorText: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8 },
  
  emptyBox: { alignItems: "center", padding: 48 },
  emptyText: { fontSize: 14, fontWeight: "700", color: "#64748b", marginTop: 12 },
  
  pickerModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  pickerModalCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16 },
  pickerModalFooter: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, backgroundColor: "#f1f5f9" },
  modalBtnPrimary: { backgroundColor: "#1890ff" },
  modalBtnText: { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  modalBtnTextPrimary: { color: "#fff" },

  dateFieldBtn: { backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", alignItems: "center", marginTop: 8 },
  dateFieldLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  dateFieldIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center" },
  dateFieldLabel: { fontSize: 10, color: "#64748b", fontWeight: "800" },
  dateFieldValue: { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  dateFieldSub: { fontSize: 10, color: "#94a3b8" },
});
