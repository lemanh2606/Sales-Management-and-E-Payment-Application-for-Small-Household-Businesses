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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";

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

/**
 * Field button: hiển thị rõ “Giá trị chính” + “Mã kỳ”.
 */
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
  const { currentStore } = useAuth();
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
    if (typeof value === "object") {
      const n = parseFloat(value.$numberDecimal);
      return Number.isFinite(n) ? n : 0;
    }
    return Number.isFinite(value) ? value : 0;
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

        // Chỉ thu gọn khi user bấm “Xem báo cáo” hoặc dùng “Chọn nhanh”
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

    // Không auto fetch, không auto collapse
    setSummary(null);
    setEmployeeData([]);
    setError(null);
  }, []);

  /**
   * Chọn nhanh: tự tải + tự thu gọn (đúng yêu cầu).
   */
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

      // Update UI state trước (để pill/label hiển thị đúng)
      setPeriodType(nextType);
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedQuarter(q);

      const key = buildPeriodKey(nextType, y, m, q);

      // Tải ngay + thu gọn sau khi tải OK
      await fetchReport({ type: nextType, key, collapseOnSuccess: true });
    },
    [buildPeriodKey, fetchReport]
  );

  /**
   * Điều hướng kỳ trước/sau: chỉ đổi selection, không fetch, không collapse.
   */
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

  // =====================
  // PICKER logic
  // =====================
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

      // iOS: update tempDate live
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
    const sorted = [...employeeData].sort((a, b) => {
      const aValue =
        sortBy === "orders" ? a.countOrders : toNumber(a.totalRevenue);
      const bValue =
        sortBy === "orders" ? b.countOrders : toNumber(b.totalRevenue);
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });
    return sorted;
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
    const rankColors = ["#fbbf24", "#d1d5db", "#f97316"];
    const rankColor = index < 3 ? rankColors[index] : "#6b7280";

    return (
      <View style={styles.employeeCard}>
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        <View style={styles.employeeInfo}>
          <View style={styles.employeeHeader}>
            <Ionicons name="person-circle" size={24} color="#1890ff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.employeeName}>
                {item.employeeInfo.fullName}
              </Text>
              <Text style={styles.employeeUsername}>
                @{item.employeeInfo.username}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="receipt-outline" size={20} color="#52c41a" />
              <Text style={styles.statLabel}>Số hoá đơn</Text>
              <Text style={styles.statValue}>{item.countOrders}</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="cash-outline" size={20} color="#1890ff" />
              <Text style={styles.statLabel}>Doanh thu</Text>
              <Text style={[styles.statValue, { color: "#1890ff" }]}>
                {formatVND(item.totalRevenue)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  // =====================
  // GUARD: NO STORE
  // =====================
  if (!storeId) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.errorText}>Vui lòng chọn cửa hàng trước</Text>
      </View>
    );
  }

  // =====================
  // RENDER
  // =====================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="trending-up" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Báo cáo doanh thu</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterSection}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setIsFilterExpanded((p) => !p)}
          activeOpacity={0.7}
        >
          <View style={styles.filterToggleLeft}>
            <Ionicons name="funnel" size={20} color="#1890ff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.filterToggleText}>
                {isFilterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
              </Text>
              {!isFilterExpanded && periodType && (
                <Text style={styles.filterTogglePeriod}>
                  {periodDisplayText}
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
            {/* Quick presets */}
            <Text style={styles.filterLabel}>Chọn nhanh</Text>
            <View style={styles.presetRow}>
              <PresetChip
                label="Tháng này"
                icon="calendar"
                active={activePreset === "thisMonth"}
                onPress={() => applyPreset("thisMonth")}
              />
              <PresetChip
                label="Tháng trước"
                icon="time"
                active={activePreset === "lastMonth"}
                onPress={() => applyPreset("lastMonth")}
              />
              <PresetChip
                label="Quý này"
                icon="albums"
                active={activePreset === "thisQuarter"}
                onPress={() => applyPreset("thisQuarter")}
              />
              <PresetChip
                label="Năm nay"
                icon="flag"
                active={activePreset === "thisYear"}
                onPress={() => applyPreset("thisYear")}
              />
            </View>

            {/* Period type */}
            <Text style={styles.filterLabel}>Kỳ báo cáo</Text>
            <View style={styles.typeRow}>
              <PeriodTypePill
                label="Tháng"
                active={periodType === "month"}
                onPress={() => changePeriodType("month")}
              />
              <PeriodTypePill
                label="Quý"
                active={periodType === "quarter"}
                onPress={() => changePeriodType("quarter")}
              />
              <PeriodTypePill
                label="Năm"
                active={periodType === "year"}
                onPress={() => changePeriodType("year")}
              />
            </View>

            {!!periodType && (
              <>
                <Text style={styles.filterLabel}>Chọn thời gian</Text>
                <Text style={styles.helperText}>
                  Chọn xong bấm “Xem báo cáo” để tải dữ liệu và thu gọn bộ lọc.
                </Text>

                {periodType === "month" && (
                  <DateFieldButton
                    label="Tháng báo cáo"
                    valueText={`Tháng ${selectedMonth}/${selectedYear}`}
                    subText={`Mã kỳ: ${periodKey}`}
                    onPress={() => openPicker("month")}
                    icon="calendar"
                  />
                )}

                {periodType === "quarter" && (
                  <>
                    <DateFieldButton
                      label="Quý báo cáo"
                      valueText={`Quý ${selectedQuarter}/${selectedYear}`}
                      subText={`Mã kỳ: ${periodKey}`}
                      onPress={() => openPicker("quarter")}
                      icon="albums"
                    />

                    <View style={styles.quarterQuickRow}>
                      {[1, 2, 3, 4].map((q) => {
                        const active = q === selectedQuarter;
                        return (
                          <TouchableOpacity
                            key={q}
                            style={[
                              styles.quarterPill,
                              active && styles.quarterPillActive,
                            ]}
                            onPress={() => {
                              setActivePreset(null);
                              setSelectedQuarter(q);
                            }}
                            activeOpacity={0.9}
                          >
                            <Text
                              style={[
                                styles.quarterPillText,
                                active && styles.quarterPillTextActive,
                              ]}
                            >
                              Quý {q}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <DateFieldButton
                      label="Năm áp dụng cho quý"
                      valueText={`Năm ${selectedYear}`}
                      subText={`Mã kỳ: ${selectedYear}`}
                      onPress={() => openPicker("year")}
                      icon="flag"
                    />
                  </>
                )}

                {periodType === "year" && (
                  <DateFieldButton
                    label="Năm báo cáo"
                    valueText={`Năm ${selectedYear}`}
                    subText={`Mã kỳ: ${periodKey}`}
                    onPress={() => openPicker("year")}
                    icon="flag"
                  />
                )}

                {/* Prev/Next navigation */}
                <View style={styles.navRow}>
                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => shiftPeriod(-1)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="chevron-back" size={18} color="#1890ff" />
                    <Text style={styles.navBtnText}>Trước</Text>
                  </TouchableOpacity>

                  <View style={styles.navCenter}>
                    <Text style={styles.navCenterText}>
                      {periodDisplayText}
                    </Text>
                    <Text style={styles.navCenterSub}>{periodKey}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.navBtn}
                    onPress={() => shiftPeriod(1)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.navBtnText}>Sau</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#1890ff"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Action Button: chỉ khi bấm mới fetch & mới collapse */}
            <TouchableOpacity
              style={[styles.actionBtn, !canFetch && styles.actionBtnDisabled]}
              onPress={() => fetchCurrent({ collapseOnSuccess: true })}
              disabled={!canFetch}
              activeOpacity={0.85}
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
                    <Text style={styles.actionBtnText}>Xem báo cáo</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Android picker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={onPickerChange}
        />
      )}

      {/* iOS modal picker (chữ rõ + preview + set themeVariant/textColor) */}
      <Modal
        visible={showDatePicker && Platform.OS === "ios"}
        transparent
        animationType="slide"
        onRequestClose={closePickerIOS}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={styles.pickerModalCard}>
            <View style={styles.pickerModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerModalTitle}>
                  {pickerTarget === "month"
                    ? "Chọn tháng"
                    : pickerTarget === "quarter"
                      ? "Chọn quý"
                      : "Chọn năm"}
                </Text>
                <Text style={styles.pickerModalDesc}>
                  {pickerTarget === "quarter"
                    ? "Chọn một ngày bất kỳ trong quý mong muốn (hệ thống sẽ tự suy ra quý)."
                    : "Chọn một ngày bất kỳ trong kỳ mong muốn (hệ thống sẽ tự lấy tháng/năm)."}
                </Text>
              </View>

              <View style={styles.previewPill}>
                <Text style={styles.previewPillText}>{pickerPreview}</Text>
              </View>
            </View>

            <Text style={styles.previewSub}>{pickerSubPreview}</Text>

            <View style={styles.pickerInlineWrap}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={onPickerChange}
                locale="vi-VN"
                // Làm rõ chữ trên iOS spinner (tránh mờ/khó nhìn) [web:77]
                {...(Platform.OS === "ios"
                  ? { themeVariant: "light" as const, textColor: "#111827" }
                  : {})}
              />
            </View>

            <View style={styles.pickerModalFooter}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={closePickerIOS}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnText}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={confirmPickerIOS}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                  Chọn
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            // Refresh không tự thu gọn bộ lọc
            onRefresh={() =>
              fetchCurrent({ isRefresh: true, collapseOnSuccess: false })
            }
            colors={["#1890ff"]}
          />
        }
      >
        {/* Error Alert */}
        {error && (
          <View style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorAlertText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Loading */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1890ff" />
            <Text style={styles.loadingText}>Đang tải báo cáo...</Text>
          </View>
        )}

        {/* Info Alert */}
        {!periodType && !loading && (
          <View style={styles.infoAlert}>
            <Ionicons name="information-circle" size={24} color="#1890ff" />
            <Text style={styles.infoAlertText}>
              Vui lòng chọn kỳ báo cáo (hoặc dùng “Chọn nhanh”) để xem dữ liệu
            </Text>
          </View>
        )}

        {/* Summary */}
        {summary && (
          <>
            <View style={styles.summaryGrid}>
              <LinearGradient
                colors={["#1890ff", "#096dd9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                <Ionicons name="cash" size={32} color="#fff" />
                <Text style={styles.summaryLabel}>Tổng doanh thu</Text>
                <Text style={styles.summaryValue}>
                  {formatVND(summary.totalRevenue)}
                </Text>
              </LinearGradient>

              <LinearGradient
                colors={["#52c41a", "#389e0d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                <Ionicons name="receipt" size={32} color="#fff" />
                <Text style={styles.summaryLabel}>Số hoá đơn</Text>
                <Text style={styles.summaryValue}>{summary.countOrders}</Text>
              </LinearGradient>
            </View>

            {/* Employee Revenue */}
            <View style={styles.employeeSection}>
              <View style={styles.employeeSectionHeader}>
                <Text style={styles.employeeSectionTitle}>
                  Doanh thu theo nhân viên
                </Text>
                <Text style={styles.employeeCount}>
                  {employeeData.length} nhân viên
                </Text>
              </View>

              {/* Sort */}
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[
                    styles.sortBtn,
                    sortBy === "orders" && styles.sortBtnActive,
                  ]}
                  onPress={() => toggleSort("orders")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.sortBtnText,
                      sortBy === "orders" && styles.sortBtnTextActive,
                    ]}
                  >
                    Số hoá đơn
                  </Text>

                  {sortBy === "orders" && (
                    <Ionicons
                      name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
                      size={16}
                      color="#1890ff"
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.sortBtn,
                    sortBy === "revenue" && styles.sortBtnActive,
                  ]}
                  onPress={() => toggleSort("revenue")}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.sortBtnText,
                      sortBy === "revenue" && styles.sortBtnTextActive,
                    ]}
                  >
                    Doanh thu
                  </Text>

                  {sortBy === "revenue" && (
                    <Ionicons
                      name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
                      size={16}
                      color="#1890ff"
                    />
                  )}
                </TouchableOpacity>
              </View>

              {/* List */}
              {employeeData.length > 0 ? (
                <FlatList
                  data={sortedEmployeeData}
                  renderItem={renderEmployeeItem}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  contentContainerStyle={styles.employeeList}
                />
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#d1d5db" />
                  <Text style={styles.emptyText}>
                    Không có dữ liệu nhân viên
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default RevenueReportScreen;

// =====================
// STYLES
// =====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },

  // Error (no store)
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

  // Header
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

  // Filter card
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
    fontWeight: "800",
    color: "#374151",
    marginBottom: 8,
    marginTop: 12,
  },
  helperText: { marginTop: -2, fontSize: 12, color: "#6b7280", lineHeight: 18 },

  // Presets
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  presetChipActive: { backgroundColor: "#e6f4ff", borderColor: "#1890ff" },
  presetChipText: { fontSize: 13, fontWeight: "700", color: "#6b7280" },
  presetChipTextActive: { color: "#1890ff" },

  // Type pills
  typeRow: { flexDirection: "row", gap: 10 },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  typePillActive: { backgroundColor: "#e6f4ff", borderColor: "#1890ff" },
  typePillText: { fontSize: 14, fontWeight: "800", color: "#6b7280" },
  typePillTextActive: { color: "#1890ff" },

  // Date-field button (clearer text)
  dateFieldBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  dateFieldLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dateFieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  dateFieldLabel: { fontSize: 12, color: "#6b7280", fontWeight: "800" },
  dateFieldValue: {
    marginTop: 3,
    fontSize: 16,
    color: "#111827",
    fontWeight: "900",
  },
  dateFieldSub: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },

  // Quick quarter
  quarterQuickRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  quarterPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  quarterPillActive: { backgroundColor: "#e6f4ff", borderColor: "#1890ff" },
  quarterPillText: { fontSize: 13, fontWeight: "900", color: "#6b7280" },
  quarterPillTextActive: { color: "#1890ff" },

  // Prev/Next nav
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    alignItems: "center",
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  navBtnText: { fontSize: 13, fontWeight: "800", color: "#1890ff" },
  navCenter: { flex: 1, alignItems: "center", paddingVertical: 6 },
  navCenterText: { fontSize: 13, fontWeight: "900", color: "#111827" },
  navCenterSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },

  // Date picker modal (iOS) - clearer typography
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerModalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pickerModalTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  pickerModalDesc: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
    fontWeight: "600",
  },

  previewPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e6f4ff",
    borderWidth: 1,
    borderColor: "#1890ff",
  },
  previewPillText: { fontSize: 12, fontWeight: "900", color: "#1890ff" },
  previewSub: {
    marginTop: 10,
    fontSize: 12,
    color: "#374151",
    fontWeight: "800",
  },

  pickerInlineWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickerModalFooter: { flexDirection: "row", gap: 12, marginTop: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
  },
  modalBtnPrimary: { borderColor: "#1890ff", backgroundColor: "#e6f4ff" },
  modalBtnText: { fontSize: 14, fontWeight: "900", color: "#374151" },
  modalBtnTextPrimary: { color: "#1890ff" },

  // Action button
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
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // Alerts
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: "#991b1b",
    fontWeight: "700",
  },

  infoAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    gap: 12,
  },
  infoAlertText: {
    flex: 1,
    fontSize: 14,
    color: "#1e40af",
    lineHeight: 20,
    fontWeight: "600",
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },

  // Summary
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#fff",
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.9,
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
  },

  // Employee section
  employeeSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  employeeSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  employeeSectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  employeeCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
  },

  // Sort
  sortRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  sortBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sortBtnActive: {
    backgroundColor: "#e6f4ff",
    borderColor: "#1890ff",
  },
  sortBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6b7280",
  },
  sortBtnTextActive: {
    color: "#1890ff",
  },

  // Employee cards
  employeeList: {
    gap: 12,
  },
  employeeCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    position: "relative",
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#fff",
  },
  employeeInfo: {
    paddingRight: 40,
  },
  employeeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  employeeUsername: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 6,
    marginBottom: 4,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    fontWeight: "700",
  },

  bottomSpacer: {
    height: 40,
  },
});
