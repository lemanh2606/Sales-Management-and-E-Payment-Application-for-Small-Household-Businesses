// src/screens/reports/ReportsDashboardScreen.tsx
import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import operatingExpenseApi from "../../api/operatingExpenseApi";
import { useNavigation } from "@react-navigation/native";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

// ========== TYPES ==========
interface FinancialData {
  totalRevenue: number;
  grossProfit: number;
  netProfit: number;
  operatingCost: number;
  totalVAT: number;
  stockValue: number;
  totalCOGS: number;
  stockAdjustmentValue: number;
  stockDisposalCost: number;
}

interface FinancialResponse {
  data: FinancialData;
  message?: string;
}

type PeriodType = "" | "month" | "quarter" | "year";

type AppliedFilter = {
  periodType: PeriodType;
  year: number;
  month: number; // 1-12
  quarter: 1 | 2 | 3 | 4;
};

type PickerKind = null | "month" | "year" | "quarterYear";

const COLORS = {
  revenue: "#2563eb",
  grossProfit: "#16a34a",
  netProfit: "#7c3aed",
  operatingCost: "#f97316",
  vat: "#ef4444",
  stockValue: "#06b6d4",
};

const ReportsDashboardScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // API states
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancialData | null>(null);

  // Operating expenses from DB
  const [expenseItems, setExpenseItems] = useState<any[]>([]);
  const [operatingExpenseId, setOperatingExpenseId] = useState<string | null>(null);
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>("");
  const [newExpenseNote, setNewExpenseNote] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Applied filter (chỉ đổi khi bấm "Áp dụng")
  const [applied, setApplied] = useState<AppliedFilter>({
    periodType: "month",
    year: dayjs().year(),
    month: dayjs().month() + 1,
    quarter: dayjs().quarter() as 1 | 2 | 3 | 4,
  });

  // Bottom sheet filter
  const [filterOpen, setFilterOpen] = useState(false);

  // Draft filter trong sheet
  const [dPeriodType, setDPeriodType] = useState<PeriodType>(
    applied.periodType
  );
  const [dYear, setDYear] = useState<number>(applied.year);
  const [dMonth, setDMonth] = useState<number>(applied.month);
  const [dQuarter, setDQuarter] = useState<1 | 2 | 3 | 4>(applied.quarter);

  // DateTimePicker modal with Cancel/Apply
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [tempPickedDate, setTempPickedDate] = useState<Date>(new Date());

  // ========== FORMATTERS ==========
  const formatVND = (value: number | undefined | null): string => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: string): string => {
    const number = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const getProfitColor = (value: number | undefined | null): string => {
    if (value == null) return "#f97316";
    if (value > 0) return "#16a34a";
    if (value < 0) return "#ef4444";
    return "#f97316";
  };

  // ========== PERIOD KEY ==========
  const periodKey = useMemo(() => {
    if (!applied.periodType) return "";
    if (applied.periodType === "month") {
      return `${applied.year}-${String(applied.month).padStart(2, "0")}`;
    }
    if (applied.periodType === "quarter") {
      return `${applied.year}-Q${applied.quarter}`;
    }
    if (applied.periodType === "year") {
      return String(applied.year);
    }
    return "";
  }, [applied]);

  const isReadyToFetch = useMemo(() => {
    return !!storeId && !!applied.periodType && !!periodKey;
  }, [storeId, applied.periodType, periodKey]);

  const periodDisplay = useMemo(() => {
    if (!applied.periodType) return "Chưa chọn kỳ";
    if (applied.periodType === "month")
      return `Tháng ${applied.month}/${applied.year}`;
    if (applied.periodType === "quarter")
      return `Quý ${applied.quarter}/${applied.year}`;
    if (applied.periodType === "year") return `Năm ${applied.year}`;
    return "Chưa chọn kỳ";
  }, [applied]);

  // ========== FETCH OPERATING EXPENSES ==========
  const loadOperatingExpenses = async (): Promise<void> => {
    if (!storeId || !applied.periodType || !periodKey) {
      setExpenseItems([]);
      setOperatingExpenseId(null);
      setHasUnsavedChanges(false);
      return;
    }

    try {
      const resp = await operatingExpenseApi.getOperatingExpenseByPeriod({
        storeId,
        periodType: applied.periodType,
        periodKey,
      });
      setExpenseItems(resp.items || []);
      setOperatingExpenseId(resp._id || null);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("loadOperatingExpenses error:", err);
      setExpenseItems([]);
      setOperatingExpenseId(null);
    }
  };

  // ========== FETCH FINANCIAL ==========
  const fetchFinancial = async (isRefresh: boolean = false): Promise<void> => {
    if (!storeId) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }

    if (!applied.periodType || !periodKey) {
      setError(null);
      setData(null);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const params = new URLSearchParams({
        storeId,
        periodType: applied.periodType,
        periodKey,
      });

      const response = await apiClient.get<FinancialResponse>(
        `/financials?${params.toString()}`
      );
      setData(response.data.data);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Lỗi tải báo cáo tài chính";
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto fetch lần đầu
  useEffect(() => {
    if (storeId && applied.periodType) {
      fetchFinancial(false);
      loadOperatingExpenses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, applied.periodType, periodKey]);

  // ========== EXPENSE ACTIONS ==========
  const addExpenseItem = (): void => {
    const amount = parseFloat(newExpenseAmount.replace(/\./g, ""));
    if (isNaN(amount) || amount <= 0) {
      return Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
    }

    const newItem = {
      amount,
      note: newExpenseNote.trim(),
      isSaved: false,
    };

    setExpenseItems([...expenseItems, newItem]);
    setNewExpenseAmount("");
    setNewExpenseNote("");
    setHasUnsavedChanges(true);
  };

  const removeExpenseItem = (index: number): void => {
    const item = expenseItems[index];

    const performRemove = async () => {
      try {
        setLoading(true);
        if (item._id && operatingExpenseId) {
          // Xóa từ DB
          await operatingExpenseApi.deleteExpenseItem(operatingExpenseId, index);
        }
        
        const newItems = expenseItems.filter((_, idx) => idx !== index);
        setExpenseItems(newItems);
        
        // Nếu không còn item nào chưa lưu, reset change flag
        if (!newItems.some(it => !it._id)) {
           setHasUnsavedChanges(false);
        }

        Alert.alert("Thành công", "Đã xóa khoản chi phí");
        fetchFinancial();
      } catch (err: any) {
        Alert.alert("Lỗi", "Không thể xóa chi phí: " + (err?.message || "Lỗi server"));
      } finally {
        setLoading(false);
      }
    };

    Alert.alert("Xác nhận", "Xóa khoản chi phí này?", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: performRemove },
    ]);
  };

  const saveExpenses = async (): Promise<void> => {
    if (!storeId || !applied.periodType || !periodKey) return;

    try {
      setLoading(true);
      const payload = {
        storeId,
        periodType: applied.periodType,
        periodKey,
        items: expenseItems.map(it => ({
          amount: it.amount,
          note: it.note
        })),
      };

      await operatingExpenseApi.createOperatingExpense(payload);
      Alert.alert("Thành công", "Đã lưu danh sách chi phí");
      
      setHasUnsavedChanges(false);
      loadOperatingExpenses();
      fetchFinancial();
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể lưu chi phí: " + (err?.message || "Lỗi server"));
    } finally {
      setLoading(false);
    }
  };

  // ========== FILTER SHEET ==========
  const openFilter = () => {
    setDPeriodType(applied.periodType);
    setDYear(applied.year);
    setDMonth(applied.month);
    setDQuarter(applied.quarter);
    setFilterOpen(true);
  };

  const closeFilter = () => setFilterOpen(false);

  const validateDraft = (): string | null => {
    if (!storeId) return "Vui lòng chọn cửa hàng";
    if (!dPeriodType) return "Vui lòng chọn kỳ báo cáo";
    if (dPeriodType === "month") {
      if (dMonth < 1 || dMonth > 12) return "Tháng không hợp lệ";
      if (dYear < 2000 || dYear > 2100) return "Năm không hợp lệ";
    }
    if (dPeriodType === "quarter") {
      if (![1, 2, 3, 4].includes(dQuarter)) return "Quý không hợp lệ";
      if (dYear < 2000 || dYear > 2100) return "Năm không hợp lệ";
    }
    if (dPeriodType === "year") {
      if (dYear < 2000 || dYear > 2100) return "Năm không hợp lệ";
    }
    return null;
  };

  const applyFilter = async () => {
    const err = validateDraft();
    if (err) return Alert.alert("Thiếu thông tin", err);

    const next: AppliedFilter = {
      periodType: dPeriodType,
      year: dYear,
      month: dMonth,
      quarter: dQuarter,
    };

    setApplied(next);
    setFilterOpen(false);

    // fetch ngay sau apply (tránh cảm giác “bấm mà không chạy”)
    // dùng setTimeout 0 để đảm bảo state đã commit trước khi fetch đọc applied/periodKey
    setTimeout(() => {
      fetchFinancial(false);
    }, 0);
  };

  const FilterChip = ({
    label,
    active,
    onPress,
    icon,
  }: {
    label: string;
    active?: boolean;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      {!!icon && (
        <Ionicons name={icon} size={14} color={active ? "#fff" : "#0f172a"} />
      )}
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextInactive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ========== DATE PICKER HELPERS ==========
  const openPicker = (kind: PickerKind) => {
    setPickerKind(kind);

    if (kind === "month") {
      setTempPickedDate(
        dayjs(`${dYear}-${String(dMonth).padStart(2, "0")}-01`).toDate()
      );
      return;
    }
    if (kind === "year" || kind === "quarterYear") {
      setTempPickedDate(dayjs(`${dYear}-01-01`).toDate());
      return;
    }
    setTempPickedDate(new Date());
  };

  const cancelPicker = () => setPickerKind(null);

  const confirmPicker = () => {
    const d = dayjs(tempPickedDate);
    if (pickerKind === "month") {
      setDYear(d.year());
      setDMonth(d.month() + 1);
    } else if (pickerKind === "year" || pickerKind === "quarterYear") {
      setDYear(d.year());
    }
    setPickerKind(null);
  };

  // ========== RENDER GUARD ==========
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header gradient */}
        <LinearGradient
          colors={["#10b981", "#10b981", "#10b981"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Báo cáo tổng quan</Text>
              <View style={styles.headerSubRow}>
                <Ionicons
                  name="storefront-outline"
                  size={14}
                  color="rgba(255,255,255,0.92)"
                />
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {storeName}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.headerIconBtn} onPress={openFilter}>
              <Ionicons name="options-outline" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => fetchFinancial(false)}
              disabled={!isReadyToFetch || loading}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.headerPills}>
            <View style={styles.headerPill}>
              <Ionicons name="calendar-outline" size={14} color="#fff" />
              <Text style={styles.headerPillText}>{periodDisplay}</Text>
            </View>

            <TouchableOpacity style={styles.headerPill} onPress={openFilter}>
              <Ionicons name="funnel-outline" size={14} color="#fff" />
              <Text style={styles.headerPillText}>
                Bộ lọc{" "}
                {expenseItems.length > 0
                  ? `• ${expenseItems.length} CP`
                  : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Filter quick bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={openFilter}
            activeOpacity={0.9}
          >
            <Ionicons name="funnel" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Chọn kỳ & chi phí</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              (!isReadyToFetch || loading) && { opacity: 0.5 },
            ]}
            onPress={() => fetchFinancial(false)}
            disabled={!isReadyToFetch || loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#0f172a" />
                <Text style={styles.secondaryBtnText}>Xem</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchFinancial(true)}
              colors={["#2563eb"]}
              tintColor="#2563eb"
            />
          }
        >
          {/* Error alert */}
          {error && (
            <View style={styles.errorAlert}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorAlertText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Info (no data yet) */}
          {!loading && !data && (
            <View style={styles.infoBox}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color="#2563eb"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Chưa có dữ liệu hiển thị</Text>
                <Text style={styles.infoText}>
                  Mở bộ lọc để chọn kỳ báo cáo, sau đó bấm “Xem”.
                </Text>
              </View>
              <TouchableOpacity onPress={openFilter} style={styles.infoCta}>
                <Text style={styles.infoCtaText}>Mở</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading */}
          {loading && !refreshing && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Đang tải báo cáo...</Text>
            </View>
          )}

          {/* Data */}
          {!loading && data && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tổng quan</Text>
                <Text style={styles.sectionSubTitle}>{periodDisplay}</Text>
              </View>

              <View style={styles.statsGrid}>
                <View
                  style={[styles.statCard, { borderLeftColor: COLORS.revenue }]}
                >
                  <View style={styles.statTop}>
                    <Ionicons
                      name="trending-up"
                      size={22}
                      color={COLORS.revenue}
                    />
                    <Text style={styles.statLabel}>Doanh thu</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.revenue }]}>
                    {formatVND(data.totalRevenue)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    { borderLeftColor: COLORS.grossProfit },
                  ]}
                >
                  <View style={styles.statTop}>
                    <Ionicons
                      name="cash-outline"
                      size={22}
                      color={COLORS.grossProfit}
                    />
                    <Text style={styles.statLabel}>Lợi nhuận gộp</Text>
                  </View>
                  <Text
                    style={[styles.statValue, { color: COLORS.grossProfit }]}
                  >
                    {formatVND(data.grossProfit)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    { borderLeftColor: COLORS.operatingCost },
                  ]}
                >
                  <View style={styles.statTop}>
                    <Ionicons
                      name="wallet-outline"
                      size={22}
                      color={COLORS.operatingCost}
                    />
                    <Text style={styles.statLabel}>Chi phí vận hành</Text>
                  </View>
                  <Text
                    style={[styles.statValue, { color: COLORS.operatingCost }]}
                  >
                    {formatVND(data.operatingCost)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statCard,
                    { borderLeftColor: getProfitColor(data.netProfit) },
                  ]}
                >
                  <View style={styles.statTop}>
                    <Ionicons
                      name="trophy-outline"
                      size={22}
                      color={getProfitColor(data.netProfit)}
                    />
                    <Text style={styles.statLabel}>Lợi nhuận ròng</Text>
                  </View>
                  <Text
                    style={[
                      styles.statValue,
                      { color: getProfitColor(data.netProfit) },
                    ]}
                  >
                    {formatVND(data.netProfit)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Thuế & Tồn kho</Text>

                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <View
                      style={[styles.colorDot, { backgroundColor: COLORS.vat }]}
                    />
                    <Text style={styles.detailLabel}>Thuế GTGT</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: COLORS.vat }]}>
                    {formatVND(data.totalVAT)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: COLORS.stockValue },
                      ]}
                    />
                    <Text style={styles.detailLabel}>Tồn kho</Text>
                  </View>
                  <Text
                    style={[styles.detailValue, { color: COLORS.stockValue }]}
                  >
                    {formatVND(data.stockValue)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Chi tiết</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    Chi phí nhập hàng (COGS)
                  </Text>
                  <Text style={styles.detailValue}>
                    {formatVND(data.totalCOGS)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Điều chỉnh tồn kho</Text>
                  <Text style={styles.detailValue}>
                    {formatVND(data.stockAdjustmentValue)}
                  </Text>
                </View>

                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailLabel}>Chi phí hàng hoá huỷ</Text>
                  <Text style={styles.detailValue}>
                    {formatVND(data.stockDisposalCost)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailCard}>
                <Text style={styles.detailCardTitle}>Hiệu suất</Text>

                <View style={styles.performanceRow}>
                  <View style={styles.performanceItem}>
                    <Text style={styles.performanceLabel}>Lợi nhuận gộp</Text>
                    <Text
                      style={[
                        styles.performanceValue,
                        { color: getProfitColor(data.grossProfit) },
                      ]}
                    >
                      {data.totalRevenue
                        ? (
                            (data.grossProfit / data.totalRevenue) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </Text>
                  </View>

                  <View style={styles.performanceItem}>
                    <Text style={styles.performanceLabel}>Lợi nhuận ròng</Text>
                    <Text
                      style={[
                        styles.performanceValue,
                        { color: getProfitColor(data.netProfit) },
                      ]}
                    >
                      {data.totalRevenue
                        ? ((data.netProfit / data.totalRevenue) * 100).toFixed(
                            1
                          )
                        : 0}
                      %
                    </Text>
                  </View>
                </View>

                <View style={styles.tipBox}>
                  <Ionicons name="bulb-outline" size={18} color="#0f172a" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipText}>
                      Lợi nhuận gộp = Doanh thu - Giá vốn hàng bán
                    </Text>
                    <Text style={styles.tipText}>
                      Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành - Thuế
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          <View style={{ height: 28 }} />
        </ScrollView>

        {/* ================= FILTER BOTTOM SHEET ================= */}
        <Modal
          visible={filterOpen}
          transparent
          animationType="fade"
          onRequestClose={closeFilter}
        >
          <Pressable style={styles.overlay} onPress={closeFilter} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Bộ lọc báo cáo</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={closeFilter}>
                <Ionicons name="close" size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 14 }}
            >
              <Text style={styles.blockTitle}>Kỳ báo cáo</Text>
              <View style={styles.chipRow}>
                <FilterChip
                  label="Tháng"
                  icon="calendar-outline"
                  active={dPeriodType === "month"}
                  onPress={() => setDPeriodType("month")}
                />
                <FilterChip
                  label="Quý"
                  icon="grid-outline"
                  active={dPeriodType === "quarter"}
                  onPress={() => setDPeriodType("quarter")}
                />
                <FilterChip
                  label="Năm"
                  icon="time-outline"
                  active={dPeriodType === "year"}
                  onPress={() => setDPeriodType("year")}
                />
              </View>

              <View style={styles.fieldCard}>
                <View style={styles.fieldTop}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={16}
                    color="#0f172a"
                  />
                  <Text style={styles.fieldTitle}>Đang chọn</Text>
                </View>

                <Text style={styles.fieldValue}>
                  {!dPeriodType
                    ? "Chưa chọn"
                    : dPeriodType === "month"
                      ? `Tháng ${dMonth}/${dYear}`
                      : dPeriodType === "quarter"
                        ? `Quý ${dQuarter}/${dYear}`
                        : `Năm ${dYear}`}
                </Text>

                {dPeriodType === "month" && (
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => openPicker("month")}
                  >
                    <Ionicons name="calendar" size={16} color="#fff" />
                    <Text style={styles.pickBtnText}>Chọn tháng/năm</Text>
                  </TouchableOpacity>
                )}

                {dPeriodType === "quarter" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.pickBtn, { backgroundColor: "#0ea5e9" }]}
                      onPress={() => openPicker("quarterYear")}
                    >
                      <Ionicons name="time-outline" size={16} color="#fff" />
                      <Text style={styles.pickBtnText}>Chọn năm</Text>
                    </TouchableOpacity>

                    <View style={styles.chipRow}>
                      {[1, 2, 3, 4].map((q) => (
                        <FilterChip
                          key={q}
                          label={`Q${q}`}
                          icon="pie-chart-outline"
                          active={dQuarter === q}
                          onPress={() => setDQuarter(q as 1 | 2 | 3 | 4)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {dPeriodType === "year" && (
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => openPicker("year")}
                  >
                    <Ionicons name="time" size={16} color="#fff" />
                    <Text style={styles.pickBtnText}>Chọn năm</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.blockTitle}>Chi phí vận hành (Điện, nước, mặt bằng...)</Text>
              
              <View style={styles.expenseInputCard}>
                <View style={styles.expenseInputRow}>
                   <View style={styles.expenseInputWrap}>
                    <Ionicons name="cash-outline" size={16} color="#334155" />
                    <TextInput
                      style={styles.expenseInput}
                      value={formatNumber(newExpenseAmount)}
                      onChangeText={(t) => setNewExpenseAmount(t.replace(/\./g, ""))}
                      placeholder="Số tiền"
                      keyboardType="numeric"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={[styles.expenseInputWrap, { flex: 1.5 }]}>
                    <Ionicons name="create-outline" size={16} color="#334155" />
                    <TextInput
                      style={styles.expenseInput}
                      value={newExpenseNote}
                      onChangeText={setNewExpenseNote}
                      placeholder="Ghi chú (VD: Tiền điện)"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.addBtnLarge, (!newExpenseAmount || !newExpenseNote) && { opacity: 0.5 }]}
                  onPress={addExpenseItem}
                  disabled={!newExpenseAmount || !newExpenseNote}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.addBtnLargeText}>Thêm vào danh sách</Text>
                </TouchableOpacity>
              </View>

              {expenseItems.length > 0 && (
                <>
                  <View style={styles.expenseHeaderRow}>
                    <Text style={styles.expenseHeaderText}>Danh sách chi phí ({expenseItems.length})</Text>
                    {hasUnsavedChanges && (
                      <TouchableOpacity onPress={saveExpenses} style={styles.saveExpensesBtn}>
                        <Ionicons name="save-outline" size={16} color="#fff" />
                        <Text style={styles.saveExpensesBtnText}>Lưu ngay</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.expenseList}>
                    {expenseItems.map((exp, index) => (
                      <View key={index} style={[styles.expenseListItem, !exp._id && styles.expenseListItemUnsaved]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseItemAmount}>{formatVND(exp.amount)}</Text>
                          <Text style={styles.expenseItemNote}>{exp.note || "(Không có ghi chú)"}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.removeExpenseBtn} 
                          onPress={() => removeExpenseItem(index)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {hasUnsavedChanges && (
                    <Text style={styles.unsavedHint}>* Bạn có thay đổi chưa lưu. Hãy bấm lưu để cập nhật báo cáo.</Text>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.footerGhost}
                onPress={closeFilter}
              >
                <Text style={styles.footerGhostText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerPrimary}
                onPress={applyFilter}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.footerPrimaryText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ================= DATE PICKER MODAL (CANCEL/APPLY) ================= */}
          <Modal
            visible={!!pickerKind}
            transparent
            animationType="fade"
            onRequestClose={cancelPicker}
          >
            <Pressable style={styles.pickerOverlay} onPress={cancelPicker} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Chọn thời gian</Text>
                <TouchableOpacity
                  style={styles.sheetClose}
                  onPress={cancelPicker}
                >
                  <Ionicons name="close" size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerBody}>
                <DateTimePicker
                  value={tempPickedDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, date) => {
                    if (!date) return;
                    setTempPickedDate(date);
                  }}
                  minimumDate={new Date(2000, 0, 1)}
                  maximumDate={new Date(2100, 11, 31)}
                  locale="vi-VN"
                  style={{ backgroundColor: "#fff" }}
                  textColor="#000000"
                  themeVariant="light"
                />
                <Text style={styles.pickerHint}>
                  Mẹo: chọn một ngày bất kỳ, hệ thống sẽ lấy đúng tháng/năm.
                </Text>
              </View>

              <View style={styles.sheetFooter}>
                <TouchableOpacity
                  style={styles.footerGhost}
                  onPress={cancelPicker}
                >
                  <Text style={styles.footerGhostText}>Hủy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerPrimary}
                  onPress={confirmPicker}
                >
                  <Text style={styles.footerPrimaryText}>Áp dụng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default ReportsDashboardScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: { fontSize: 14, color: "#64748b", textAlign: "center" },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
    backgroundColor: "#10b981",
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  headerPillText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  // Top bar
  topBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  primaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
  secondaryBtn: {
    width: 92,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { color: "#0f172a", fontWeight: "900" },

  // Alerts
  errorAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
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

  infoBox: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { color: "#0f172a", fontWeight: "900" },
  infoText: {
    color: "#1e3a8a",
    marginTop: 4,
    fontWeight: "600",
    lineHeight: 18,
  },
  infoCta: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  infoCtaText: { color: "#fff", fontWeight: "900" },

  loadingContainer: { alignItems: "center", paddingVertical: 40 },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },

  sectionHeader: { marginTop: 18, paddingHorizontal: 16 },
  sectionTitle: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
  sectionSubTitle: { color: "#64748b", marginTop: 4, fontWeight: "700" },

  // Cards
  statsGrid: { paddingHorizontal: 16, marginTop: 12, gap: 12 },
  statCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderColor: "#eef2f7",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  statLabel: { color: "#64748b", fontWeight: "800" },
  statValue: { marginTop: 10, fontSize: 20, fontWeight: "900" },

  detailCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  detailCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  detailLabel: { fontSize: 13, color: "#64748b", fontWeight: "700" },
  detailValue: { fontSize: 14, fontWeight: "900", color: "#0f172a" },

  performanceRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  performanceItem: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  performanceLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "800",
  },
  performanceValue: { fontSize: 22, fontWeight: "900" },

  tipBox: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  tipText: { color: "#0f172a", fontWeight: "700", lineHeight: 18 },

  // Bottom sheet
  overlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.45)" },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: "86%",
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },

  blockTitle: {
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    color: "#0f172a",
    fontWeight: "900",
  },
  blockHint: {
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 16,
    color: "#64748b",
    fontWeight: "600",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipInactive: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  chipText: { fontSize: 12, fontWeight: "900" },
  chipTextActive: { color: "#fff" },
  chipTextInactive: { color: "#0f172a" },

  fieldCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  fieldTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldTitle: { color: "#334155", fontWeight: "900" },
  fieldValue: {
    marginTop: 8,
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 14,
  },

  pickBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pickBtnText: { color: "#fff", fontWeight: "900" },

  expenseRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  expenseInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expenseInput: { flex: 1, color: "#0f172a", fontWeight: "900" },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },

  expenseHeaderRow: {
    marginTop: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expenseHeaderText: { color: "#0f172a", fontWeight: "900" },
  clearAllText: { color: "#ef4444", fontWeight: "900" },

  expenseChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  expenseChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 8,
  },
  expenseChipText: { fontSize: 12, color: "#0f172a", fontWeight: "900" },

  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
    backgroundColor: "#fff",
  },
  footerGhost: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  footerGhostText: { color: "#0f172a", fontWeight: "900" },
  footerPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerPrimaryText: { color: "#fff", fontWeight: "900" },

  // Expense List styles
  expenseInputCard: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  expenseInputRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  addBtnLarge: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnLargeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
  expenseList: {
    marginTop: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  expenseListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  expenseListItemUnsaved: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },
  expenseItemAmount: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  expenseItemNote: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "600",
  },
  removeExpenseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  saveExpensesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0ea5e9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveExpensesBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  unsavedHint: {
    marginTop: 10,
    marginHorizontal: 16,
    fontSize: 11,
    color: "#f97316",
    fontWeight: "700",
    fontStyle: "italic",
  },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.45)" },
  pickerSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  pickerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: { color: "#0f172a", fontWeight: "900", fontSize: 15 },
  pickerBody: { backgroundColor: "#fff" },
  pickerHint: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    color: "#64748b",
    fontWeight: "700",
  },
});
