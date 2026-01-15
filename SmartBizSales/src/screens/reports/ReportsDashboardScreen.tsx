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
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import { PieChart } from "react-native-gifted-charts";
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
  comparison?: {
    prevPeriodKey: string;
    revenueChange: number;
    grossProfitChange: number;
    netProfitChange: number;
    operatingCostChange: number;
  };
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

interface OrderStats {
  total: number;
  pending: number;
  refunded: number;
  paid: number;
  totalSoldItems: number;
  totalRefundedItems: number;
  netSoldItems: number;
}

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

  // Order Stats
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    refunded: 0,
    paid: 0,
    totalSoldItems: 0,
    totalRefundedItems: 0,
    netSoldItems: 0,
  });

  // Operating expenses from DB
  const [expenseItems, setExpenseItems] = useState<any[]>([]);
  const [operatingExpenseId, setOperatingExpenseId] = useState<string | null>(null);
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>("");
  const [newExpenseNote, setNewExpenseNote] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [previousPeriodType, setPreviousPeriodType] = useState<PeriodType>("");
  const [prevPeriodKey, setPrevPeriodKey] = useState<string>("");
  const [allocationSuggestion, setAllocationSuggestion] = useState<any>(null);

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

  /**
   * Check if a period is in the future
   */
  const isFuturePeriod = (type: PeriodType, year: number, monthOrQuarter: number): boolean => {
    const now = dayjs();
    if (type === "year") return year > now.year();
    if (type === "month") {
      if (year > now.year()) return true;
      if (year === now.year() && monthOrQuarter > now.month() + 1) return true;
      return false;
    }
    if (type === "quarter") {
      const q = monthOrQuarter;
      const currentQuarter = Math.floor(now.month() / 3) + 1;
      if (year > now.year()) return true;
      if (year === now.year() && q > currentQuarter) return true;
      return false;
    }
    return false;
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

  // Load expenses theo draft period (dùng trong modal khi user chọn period mới)
  const loadExpensesWithDraftPeriod = async (): Promise<void> => {
    if (!storeId || !dPeriodType) {
      setExpenseItems([]);
      setOperatingExpenseId(null);
      setHasUnsavedChanges(false);
      return;
    }

    // Build periodKey từ draft values
    let draftPeriodKey = "";
    if (dPeriodType === "month") {
      draftPeriodKey = `${dYear}-${String(dMonth).padStart(2, "0")}`;
    } else if (dPeriodType === "quarter") {
      draftPeriodKey = `${dYear}-Q${dQuarter}`;
    } else if (dPeriodType === "year") {
      draftPeriodKey = String(dYear);
    }

    if (!draftPeriodKey) {
      setExpenseItems([]);
      return;
    }

    try {
      const resp = await operatingExpenseApi.getOperatingExpenseByPeriod({
        storeId,
        periodType: dPeriodType,
        periodKey: draftPeriodKey,
      });
      setExpenseItems(resp.items || []);
      setOperatingExpenseId(resp._id || null);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("loadExpensesWithDraftPeriod error:", err);
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

  // ========== FETCH ORDER STATS ==========
  const fetchOrderStats = async (): Promise<void> => {
    if (!storeId || !applied.periodType || !periodKey) return;
    try {
      const res = await apiClient.get<OrderStats>("/orders/stats", {
        params: {
          storeId,
          periodType: applied.periodType,
          periodKey,
        }
      });
      // Backend returns flat object: { total, pending, ... }
      setOrderStats(res.data);
    } catch (err) {
      console.error("fetchOrderStats error:", err);
    }
  };
  // Auto fetch lần đầu
  useEffect(() => {
    if (storeId && applied.periodType) {
      fetchFinancial(false);
      loadOperatingExpenses();
      fetchOrderStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, applied.periodType, periodKey]);

  // Suggest allocation when period type changes
  useEffect(() => {
    const checkAllocation = async () => {
      if (previousPeriodType && previousPeriodType !== applied.periodType && prevPeriodKey && storeId) {
        try {
          const suggestion = await operatingExpenseApi.suggestAllocation({
            storeId,
            fromPeriodType: previousPeriodType,
            fromPeriodKey: prevPeriodKey,
            toPeriodType: applied.periodType,
          });
          if (suggestion?.success && suggestion?.canAllocate) {
            setAllocationSuggestion(suggestion);
          }
        } catch (err) {
          console.error("suggestAllocation error:", err);
          setAllocationSuggestion(null);
        }
      } else {
        setAllocationSuggestion(null);
      }
    };
    checkAllocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.periodType, periodKey, storeId]);

  const handleExecuteAllocation = async (): Promise<void> => {
    if (!allocationSuggestion || !storeId) return;

    Alert.alert(
      "Xác nhận phân bổ",
      `Hệ thống sẽ tự động tạo ${allocationSuggestion.suggestions.length} khoản chi phí tương ứng. Bạn có chắc chắn?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: async () => {
            try {
              setLoading(true);
              await operatingExpenseApi.executeAllocation({
                storeId,
                fromPeriodType: allocationSuggestion.fromData.periodType,
                fromPeriodKey: allocationSuggestion.fromData.periodKey,
                toPeriodType: applied.periodType,
                suggestions: allocationSuggestion.suggestions,
              });

              Alert.alert("Thành công", "Đã thực hiện phân bổ chi phí");
              setAllocationSuggestion(null);
              loadOperatingExpenses();
              fetchFinancial();
            } catch (err: any) {
              Alert.alert("Lỗi", "Không thể phân bổ: " + (err?.message || "Lỗi server"));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // ========== EXPENSE MANAGEMENT ==========
  const addExpenseItem = (): void => {
    // Block future periods
    if (isFuturePeriod(dPeriodType, dYear, dPeriodType === "month" ? dMonth : dQuarter)) {
      Alert.alert("Thông báo", "Không thể thêm chi phí cho thời gian ở tương lai", [{ text: "Đã hiểu" }]);
      return;
    }

    if (!newExpenseAmount || newExpenseAmount.trim() === "") {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền");
      return;
    }
    const amount = parseFloat(newExpenseAmount.replace(/\./g, ""));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Lỗi", "Số tiền phải lớn hơn 0");
      return;
    }

    const newItem = {
      amount,
      note: newExpenseNote.trim(),
      isSaved: false,
    };

    setExpenseItems([...expenseItems, newItem as any]);
    setNewExpenseAmount("");
    setNewExpenseNote("");
    setHasUnsavedChanges(true);
  };

  const removeExpenseItem = (index: number): void => {
    const item = expenseItems[index];
    if (!item) return;

    Alert.alert(
      "Xóa chi phí",
      `Bạn chắc chắn muốn xóa chi phí ${formatVND(item.amount)}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            const updated = expenseItems.filter((_, i) => i !== index);
            setExpenseItems(updated);
            setHasUnsavedChanges(true);
          },
        },
      ]
    );
  };

  const saveOperatingExpense = async (): Promise<void> => {
    if (!storeId || !applied.periodType || !periodKey) {
      Alert.alert("Lỗi", "Thiếu thông tin kỳ báo cáo");
      return;
    }

    // Block future periods
    if (isFuturePeriod(applied.periodType, applied.year, applied.periodType === "month" ? applied.month : applied.quarter)) {
      Alert.alert("Thông báo", "Không thể lưu chi phí cho thời gian ở tương lai", [{ text: "Đã hiểu" }]);
      return;
    }

    try {
      setLoading(true);

      const itemsToSave = expenseItems.map((it) => ({
        amount: it.amount,
        note: it.note || "",
        isSaved: true,
      }));

      await operatingExpenseApi.upsertOperatingExpense({
        storeId,
        periodType: applied.periodType,
        periodKey,
        items: itemsToSave,
      });

      setHasUnsavedChanges(false);
      
      // Reload để có _id thực từ DB
      await loadOperatingExpenses();
      
      // Reload financial data
      await fetchFinancial(false);

      Alert.alert("Thành công", "Đã lưu chi phí vận hành");
    } catch (err: any) {
      console.error("saveOperatingExpense error:", err);
      Alert.alert("Lỗi", err?.message || "Không thể lưu chi phí");
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
    
    // Load chi phí khi mở modal (nếu đã có period)
    if (storeId && applied.periodType && periodKey) {
      loadOperatingExpenses();
    }
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

    // Track historical for allocation
    setPreviousPeriodType(applied.periodType);
    setPrevPeriodKey(periodKey);

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
    
    // Load expenses với period mới chọn
    setTimeout(() => loadExpensesWithDraftPeriod(), 100);
  };

  const handleExport = async (format: "xlsx" | "pdf" | "csv") => {
    if (!storeId || !applied.periodType || !periodKey) {
      return Alert.alert("Thông báo", "Vui lòng chọn kỳ báo cáo trước");
    }
    
    const token = await AsyncStorage.getItem("token");
    const exportUrl = `${apiClient.defaults.baseURL}/financials/export?storeId=${storeId}&periodType=${applied.periodType}&periodKey=${periodKey}&format=${format}&token=${token}`;
    
    Linking.openURL(exportUrl).catch(err => {
      Alert.alert("Lỗi", "Không thể mở liên kết tải về: " + err.message);
    });
  };

  const renderComparison = (change: number | undefined) => {
    if (change === undefined || change === null) return null;
    const isPositive = change > 0;
    const IconName = isPositive ? "trending-up" : "trending-down";
    const color = isPositive ? "#16a34a" : "#ef4444";

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
         <Ionicons name={IconName as any} size={14} color={color} />
         <Text style={{ fontSize: 11, color, fontWeight: '700', marginLeft: 4 }}>
           {isPositive ? "+" : ""}{change}%
         </Text>
         <Text style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>so với kỳ trước</Text>
      </View>
    );
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
              onPress={() => {
                fetchFinancial(false);
                fetchOrderStats();
              }}
              disabled={!isReadyToFetch || loading}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
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

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}
          onPress={() => {
            Alert.alert(
              "Xuất báo cáo",
              "Chọn định dạng bạn muốn xuất",
              [
                { text: "Excel (.xlsx)", onPress: () => handleExport("xlsx") },
                { text: "PDF (.pdf)", onPress: () => handleExport("pdf") },
                { text: "CSV (.csv)", onPress: () => handleExport("csv") },
                { text: "Hủy", style: "cancel" }
              ]
            );
          }}
          disabled={!isReadyToFetch || loading}
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={[styles.secondaryBtnText, { color: '#fff' }]}>Xuất</Text>
        </TouchableOpacity>
      </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                fetchFinancial(true);
                fetchOrderStats();
              }}
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
          {/* Allocation Suggestion Alert */}
          {allocationSuggestion && (
            <View style={styles.suggestionAlert}>
              <View style={styles.suggestionIcon}>
                <Ionicons name="bulb-outline" size={24} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionTitle}>Gợi ý phân bổ chi phí</Text>
                <Text style={styles.suggestionText}>{allocationSuggestion.message}</Text>
                <TouchableOpacity
                  style={styles.suggestionBtn}
                  onPress={handleExecuteAllocation}
                >
                  <Text style={styles.suggestionBtnText}>Thực hiện ngay</Text>
                  <Ionicons name="chevron-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setAllocationSuggestion(null)}>
                <Ionicons name="close" size={20} color="#64748b" />
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
            <View style={{ paddingBottom: 40 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chỉ số quan trọng</Text>
                <Text style={styles.sectionSubTitle}>{periodDisplay}</Text>
              </View>

              <View style={styles.statsGrid}>
                {/* Doanh thu */}
                <View style={[styles.statCard, { borderLeftColor: COLORS.revenue }]}>
                  <LinearGradient
                    colors={["rgba(37, 99, 235, 0.05)", "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(37, 99, 235, 0.1)" }]}>
                      <Ionicons name="trending-up" size={18} color={COLORS.revenue} />
                    </View>
                    <Text style={styles.statLabel}>Doanh thu</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.revenue }]}>
                    {formatVND(data.totalRevenue)}
                  </Text>
                  {renderComparison(data.comparison?.revenueChange)}
                </View>

                {/* Lợi nhuận gộp */}
                <View style={[styles.statCard, { borderLeftColor: COLORS.grossProfit }]}>
                  <LinearGradient
                    colors={["rgba(22, 163, 74, 0.05)", "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(22, 163, 74, 0.1)" }]}>
                      <Ionicons name="cash-outline" size={18} color={COLORS.grossProfit} />
                    </View>
                    <Text style={styles.statLabel}>Lợi nhuận gộp</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.grossProfit }]}>
                    {formatVND(data.grossProfit)}
                  </Text>
                  {renderComparison(data.comparison?.grossProfitChange)}
                </View>

                {/* Chi phí vận hành */}
                <View style={[styles.statCard, { borderLeftColor: COLORS.operatingCost }]}>
                  <LinearGradient
                    colors={["rgba(249, 115, 22, 0.05)", "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(249, 115, 22, 0.1)" }]}>
                      <Ionicons name="wallet-outline" size={18} color={COLORS.operatingCost} />
                    </View>
                    <Text style={styles.statLabel}>CP vận hành</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.operatingCost }]}>
                    {formatVND(data.operatingCost)}
                  </Text>
                  {renderComparison(data.comparison?.operatingCostChange)}
                </View>

                {/* Lợi nhuận ròng */}
                <View style={[styles.statCard, { borderLeftColor: getProfitColor(data.netProfit) }]}>
                  <LinearGradient
                    colors={[`${getProfitColor(data.netProfit)}10`, "transparent"]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: `${getProfitColor(data.netProfit)}15` }]}>
                      <Ionicons name="star-outline" size={18} color={getProfitColor(data.netProfit)} />
                    </View>
                    <Text style={styles.statLabel}>LN thực tế</Text>
                  </View>
                  <Text style={[styles.statValue, { color: getProfitColor(data.netProfit) }]}>
                    {formatVND(data.netProfit)}
                  </Text>
                  {renderComparison(data.comparison?.netProfitChange)}
                </View>

                {/* Thuế VAT */}
                <View style={[styles.statCard, { borderLeftColor: COLORS.vat }]}>
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                      <Ionicons name="receipt-outline" size={18} color={COLORS.vat} />
                    </View>
                    <Text style={styles.statLabel}>Thuế VAT</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.vat }]}>
                    {formatVND(data.totalVAT)}
                  </Text>
                </View>

                {/* Giá trị tồn kho */}
                <View style={[styles.statCard, { borderLeftColor: COLORS.stockValue }]}>
                  <View style={styles.statTop}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(6, 182, 212, 0.1)" }]}>
                      <Ionicons name="cube-outline" size={18} color={COLORS.stockValue} />
                    </View>
                    <Text style={styles.statLabel}>Giá trị kho</Text>
                  </View>
                  <Text style={[styles.statValue, { color: COLORS.stockValue }]}>
                    {formatVND(data.stockValue)}
                  </Text>
                </View>
              </View>

              {/* Charts Section */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Cơ cấu tài chính</Text>
                <View style={styles.chartRow}>
                  <PieChart
                    data={[
                      {
                        value: Math.max(0, data.netProfit),
                        color: COLORS.netProfit,
                        text: "LN",
                      },
                      {
                        value: Math.max(0, data.operatingCost),
                        color: COLORS.operatingCost,
                        text: "CP",
                      },
                      {
                        value: Math.max(0, data.totalCOGS),
                        color: "#6b7280",
                        text: "Vốn",
                      },
                    ]}
                    radius={70}
                    innerRadius={45}
                    innerCircleColor={"#fff"}
                    centerLabelComponent={() => (
                      <View style={{ alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 10, color: "#64748b", fontWeight: "700" }}>Ròng</Text>
                        <Text style={{ fontSize: 12, fontWeight: "900", color: "#0f172a" }}>
                          {((data.netProfit / (data.totalRevenue || 1)) * 100).toFixed(0)}%
                        </Text>
                      </View>
                    )}
                  />

                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.netProfit }]} />
                      <Text style={styles.legendText}>LN Ròng: {formatVND(data.netProfit)}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: COLORS.operatingCost }]} />
                      <Text style={styles.legendText}>CP Vận hành: {formatVND(data.operatingCost)}</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: "#6b7280" }]} />
                      <Text style={styles.legendText}>Giá vốn hàng: {formatVND(data.totalCOGS)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Analysis Summary */}
              <View style={styles.analysisBox}>
                <View style={[StyleSheet.absoluteFill, { borderRadius: 18, overflow: 'hidden' }]}>
                  <LinearGradient
                    colors={["#eff6ff", "#f8fafc"]}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View style={styles.analysisHeader}>
                  <Ionicons name="analytics-outline" size={20} color="#2563eb" />
                  <Text style={styles.analysisTitle}>Phân tích hiệu quả</Text>
                </View>
                <Text style={styles.analysisText}>
                  Tỷ suất lợi nhuận ròng đạt <Text style={{ fontWeight: "800", color: "#0f172a" }}>{((data.netProfit / (data.totalRevenue || 1)) * 100).toFixed(1)}%</Text>.
                  {data.comparison?.netProfitChange && data.comparison.netProfitChange > 0
                    ? " Hiệu suất đang cải thiện so với kỳ trước."
                    : " Cần tối ưu chi phí vận hành để cải thiện dòng tiền."}
                </Text>
              </View>

              {/* Danh sách Chi phí đã lưu */}
              {expenseItems.length > 0 && (
                <View style={styles.expenseListCard}>
                  <View style={styles.expenseListHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="wallet-outline" size={20} color="#f97316" />
                      <Text style={styles.expenseListTitle}>Chi phí vận hành ({periodDisplay})</Text>
                    </View>
                    <View style={styles.expenseTotalBadge}>
                      <Text style={styles.expenseTotalText}>
                        {formatVND(expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.expenseListBody}>
                    {expenseItems.map((item, index) => (
                      <View key={index} style={styles.expenseItem}>
                        <View style={styles.expenseItemLeft}>
                          <View style={styles.expenseIndexBadge}>
                            <Text style={styles.expenseIndexText}>{index + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.expenseNote} numberOfLines={2}>
                              {item.note || "Không có ghi chú"}
                            </Text>
                            {item.originPeriod && (
                              <View style={styles.expenseOriginBadge}>
                                <Ionicons name="link-outline" size={10} color="#64748b" />
                                <Text style={styles.expenseOriginText}>
                                  Phân bổ từ {item.originPeriod}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.expenseItemRight}>
                          <Text style={styles.expenseAmount}>{formatVND(item.amount)}</Text>
                          <TouchableOpacity
                            onPress={() => removeExpenseItem(index)}
                            style={styles.expenseDeleteBtn}
                            disabled={loading}
                          >
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={styles.expenseListFooter}>
                    <Ionicons name="information-circle-outline" size={14} color="#64748b" />
                    <Text style={styles.expenseListFooterText}>
                      Các khoản chi phí này đã được tính vào báo cáo tài chính
                    </Text>
                  </View>
                </View>
              )}
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
            </View>
          )}

          <View style={{ height: 40 }} />
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
                  onPress={() => {
                    setDPeriodType("month");
                    setTimeout(() => loadExpensesWithDraftPeriod(), 100);
                  }}
                />
                <FilterChip
                  label="Quý"
                  icon="grid-outline"
                  active={dPeriodType === "quarter"}
                  onPress={() => {
                    setDPeriodType("quarter");
                    setTimeout(() => loadExpensesWithDraftPeriod(), 100);
                  }}
                />
                <FilterChip
                  label="Năm"
                  icon="time-outline"
                  active={dPeriodType === "year"}
                  onPress={() => {
                    setDPeriodType("year");
                    setTimeout(() => loadExpensesWithDraftPeriod(), 100);
                  }}
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
                          onPress={() => {
                            setDQuarter(q as 1 | 2 | 3 | 4);
                            setTimeout(() => loadExpensesWithDraftPeriod(), 100);
                          }}
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

              {/* HIDE INPUT IF FUTURE */}
              {isFuturePeriod(dPeriodType, dYear, dPeriodType === "month" ? dMonth : dQuarter) ? (
                <View style={[styles.suggestionAlert, { backgroundColor: '#fff7ed', borderColor: '#fed7aa', marginTop: 16 }]}>
                  <Ionicons name="time-outline" size={20} color="#f97316" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionTitle, { color: '#9a3412' }]}>Thời gian ở tương lai</Text>
                    <Text style={[styles.suggestionText, { color: '#9a3412' }]}>
                      Kỳ báo cáo này chưa diễn ra. Bạn không thể ghi nhận chi phí hoạt động trước cho tương lai.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
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
                </>
              )}

              {/* NÚT LƯU CHI PHÍ - GIỐNG WEB */}
              {expenseItems.length > 0 && (
                <View style={styles.saveSection}>
                  <TouchableOpacity
                    style={[
                      styles.saveExpenseBtn,
                      (!hasUnsavedChanges || loading) && { opacity: 0.5, backgroundColor: '#94a3b8' }
                    ]}
                    onPress={saveOperatingExpense}
                    disabled={!hasUnsavedChanges || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={18} color="#fff" />
                        <Text style={styles.saveExpenseBtnText}>
                          {hasUnsavedChanges ? "Lưu Chi Phí" : "Đã Lưu"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {hasUnsavedChanges && expenseItems.filter(it => !it.isSaved).length > 0 && (
                    <View style={styles.warningAlert}>
                      <Ionicons name="warning-outline" size={18} color="#f59e0b" />
                      <Text style={styles.warningAlertText}>
                        Có {expenseItems.filter(it => !it.isSaved).length} khoản chi phí chưa lưu
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {expenseItems.length > 0 && (
                <>
                  <View style={styles.expenseHeaderRow}>
                    <Text style={styles.expenseHeaderText}>
                      Danh sách chi phí ({expenseItems.length} khoản)
                    </Text>
                    <View style={styles.expenseTotalBadge}>
                      <Text style={styles.expenseTotalText}>
                        {formatVND(expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0))}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.expenseList}>
                    {expenseItems.map((exp, index) => (
                      <View 
                        key={exp._id || index} 
                        style={[
                          styles.expenseListItem, 
                          !exp.isSaved && styles.expenseListItemUnsaved
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Text style={styles.expenseItemAmount}>{formatVND(exp.amount)}</Text>
                            <View style={[
                              styles.statusBadge,
                              exp.isSaved ? styles.statusBadgeSaved : styles.statusBadgeUnsaved
                            ]}>
                              <Text style={[
                                styles.statusBadgeText,
                                exp.isSaved ? styles.statusBadgeTextSaved : styles.statusBadgeTextUnsaved
                              ]}>
                                {exp.isSaved ? 'Đã lưu' : 'Chưa lưu'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.expenseItemNote}>{exp.note || "(Không có ghi chú)"}</Text>
                          {exp.originPeriod && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <Ionicons name="link-outline" size={12} color="#2563eb" />
                              <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '600' }}>
                                Kỳ gốc: {exp.originPeriod}
                              </Text>
                            </View>
                          )}
                        </View>
                        {!exp.originPeriod && (
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
                        )}
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
                  onChange={(event, date) => {
                    if (Platform.OS === "android") {
                      // Android: picker tự đóng, nên ta confirm luôn
                      if (event.type === "set" && date) {
                        const d = dayjs(date);
                        if (pickerKind === "month") {
                          setDYear(d.year());
                          setDMonth(d.month() + 1);
                        } else if (pickerKind === "year" || pickerKind === "quarterYear") {
                          setDYear(d.year());
                        }
                        // Load expenses với period mới chọn
                        setTimeout(() => loadExpensesWithDraftPeriod(), 100);
                      }
                      // Đóng modal
                      setPickerKind(null);
                    } else {
                      // iOS: chỉ update temp, user sẽ bấm "Áp dụng"
                      if (date) setTempPickedDate(date);
                    }
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
  suggestionAlert: {
    flexDirection: "row",
    backgroundColor: "#fffbeb",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fde68a",
    gap: 12,
    alignItems: "flex-start",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: {
    color: "#92400e",
    fontWeight: "900",
    fontSize: 15,
  },
  suggestionText: {
    color: "#b45309",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  suggestionBtn: {
    marginTop: 12,
    backgroundColor: "#d97706",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  suggestionBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    marginHorizontal: 16,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: "hidden",
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
  },

  chartCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  chartLegend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },

  analysisBox: {
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    minHeight: 80,
    position: "relative",
    overflow: "hidden",
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2563eb",
  },
  analysisText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    fontWeight: "500",
  },

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

  // Expense List Card Styles
  expenseListCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  expenseListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  expenseListTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0f172a",
  },
  expenseTotalBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  expenseTotalText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#f59e0b",
  },
  expenseListBody: {
    padding: 16,
    gap: 12,
  },
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  expenseItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  expenseIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f97316",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseIndexText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
  },
  expenseNote: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  expenseOriginBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  expenseOriginText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  expenseItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a",
  },
  expenseDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  expenseListFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  expenseListFooterText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    flex: 1,
  },
  
  // Status Badge Styles
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeSaved: {
    backgroundColor: "#f6ffed",
  },
  statusBadgeUnsaved: {
    backgroundColor: "#fff1f0",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusBadgeTextSaved: {
    color: "#52c41a",
  },
  statusBadgeTextUnsaved: {
    color: "#f5222d",
  },

  // Save Section Styles
  saveSection: {
    marginTop: 16,
    gap: 12,
  },
  saveExpenseBtn: {
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveExpenseBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  warningAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  warningAlertText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
    flex: 1,
  },
  // STATS GRID STYLES
  
  
  statCardBlue: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#dbeafe' },
  statLabelBlue: { fontSize: 11, color: '#1e40af', fontWeight: '600', marginBottom: 4 },
  statValueBlue: { fontSize: 16, color: '#2563eb', fontWeight: '800' },

  statCardGreen: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#dcfce7' },
  statLabelGreen: { fontSize: 11, color: '#166534', fontWeight: '600', marginBottom: 4 },
  statValueGreen: { fontSize: 16, color: '#16a34a', fontWeight: '800' },

  statCardOrange: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#ffedd5' },
  statLabelOrange: { fontSize: 11, color: '#c2410c', fontWeight: '600', marginBottom: 4 },
  statValueOrange: { fontSize: 16, color: '#f97316', fontWeight: '800' },

  statCardPurple: { backgroundColor: '#faf5ff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f3e8ff' },
  statLabelPurple: { fontSize: 11, color: '#7e22ce', fontWeight: '600', marginBottom: 4 },
  statValuePurple: { fontSize: 16, color: '#9333ea', fontWeight: '800' },

  statCardRed: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#fee2e2' },
  statLabelRed: { fontSize: 11, color: '#b91c1c', fontWeight: '600', marginBottom: 4 },
  statValueRed: { fontSize: 16, color: '#ef4444', fontWeight: '800' },

  statCardGray: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  statLabelGray: { fontSize: 11, color: '#475569', fontWeight: '600', marginBottom: 4 },
  statValueGray: { fontSize: 16, color: '#64748b', fontWeight: '800' },

  // Analysis Box

});
