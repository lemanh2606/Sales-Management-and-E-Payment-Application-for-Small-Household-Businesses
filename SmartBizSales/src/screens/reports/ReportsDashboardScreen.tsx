// src/screens/reports/ReportsDashboardScreen.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Linking,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { getFinancialReport, FinancialData } from "../../api/financialApi";
import operatingExpenseApi from "../../api/operatingExpenseApi";
import apiClient from "../../api/apiClient";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { BarChart, PieChart } from "react-native-gifted-charts";

dayjs.extend(quarterOfYear);

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ===== TYPES =====
interface ExpenseItem {
  _id?: string;
  amount: number;
  note: string;
  isSaved: boolean;
  originPeriod?: string;
}

interface GroupStat {
  _id: string;
  groupName: string;
  revenue: number;
  quantitySold: number;
  stockValueCost: number;
  stockToRevenueRatio: number;
  productDetails?: ProductDetail[];
}

interface ProductDetail {
  _id: string;
  name: string;
  code?: string;
  cost_price: number;
  stock_quantity: number;
  stockValueCost: number;
}

interface AllocationSuggestion {
  success: boolean;
  canAllocate: boolean;
  message: string;
  fromData: { periodType: string; periodKey: string };
  suggestions: Array<{ periodKey: string; amount: number }>;
}

// ===== COLORS =====
const COLORS = {
  revenue: "#3b82f6",
  grossProfit: "#22c55e",
  netProfit: "#8b5cf6",
  operatingCost: "#f59e0b",
  vat: "#ef4444",
  stockValue: "#06b6d4",
  cogs: "#a855f7",
};

// ===== COMPONENT =====
const ReportsDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentStore, token } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancialData & { groupStats?: GroupStat[]; netSales?: number; comparison?: any } | null>(null);

  // Period Filter
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year">("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [previousPeriodType, setPreviousPeriodType] = useState<string>("");
  const [prevPeriodKey, setPrevPeriodKey] = useState<string>("");

  // Operating Expenses
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [operatingExpenseId, setOperatingExpenseId] = useState<string | null>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>("");
  const [newExpenseNote, setNewExpenseNote] = useState<string>("");
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Allocation
  const [allocationSuggestion, setAllocationSuggestion] = useState<AllocationSuggestion | null>(null);

  // Group Detail Modal
  const [selectedGroup, setSelectedGroup] = useState<GroupStat | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // ===== HELPERS =====
  const formatVND = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };
  
  const formatCompact = (value: number): string => {
      if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toString();
    };

    const periodKey = useMemo(() => {
      if (periodType === "month") return dayjs(selectedDate).format("YYYY-MM");
      if (periodType === "quarter") {
        const q = Math.floor(selectedDate.getMonth() / 3) + 1;
        return `${dayjs(selectedDate).format("YYYY")}-Q${q}`;
      }
      return dayjs(selectedDate).format("YYYY");
    }, [periodType, selectedDate]);

    const periodDisplay = useMemo(() => {
        if (periodType === "month") return `Tháng ${dayjs(selectedDate).format("MM/YYYY")}`;
        if (periodType === "quarter") {
          const q = Math.floor(selectedDate.getMonth() / 3) + 1;
          return `Quý ${q}/${dayjs(selectedDate).format("YYYY")}`;
        }
        return `Năm ${dayjs(selectedDate).format("YYYY")}`;
      }, [periodType, selectedDate]);
    
      const isFuturePeriod = useMemo(() => {
        const now = dayjs();
        if (periodType === "month") return dayjs(periodKey, "YYYY-MM").isAfter(now, "month");
        if (periodType === "year") return dayjs(periodKey, "YYYY").isAfter(now, "year");
        if (periodType === "quarter") {
          const [year, qStr] = periodKey.split("-Q");
          const q = parseInt(qStr);
          const currentQuarter = Math.floor(now.month() / 3) + 1;
          const currentYear = now.year();
          if (parseInt(year) > currentYear) return true;
          if (parseInt(year) === currentYear && q > currentQuarter) return true;
        }
        return false;
      }, [periodType, periodKey]);
    
      const getCurrentTotalExpense = () =>
        expenseItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    
      const getUnsavedItems = () => expenseItems.filter((it) => it && it.isSaved === false);
      const getUnsavedCount = () => getUnsavedItems().length;

  // ===== NAVIGATION GUARD =====
  useEffect(() => {
    const hasUnsaved = expenseItems.some((item) => !item.isSaved);
    // Sync unsavedChanges state just in case
    if (hasUnsaved !== unsavedChanges) {
       setUnsavedChanges(hasUnsaved);
    }

    const beforeRemoveListener = navigation.addListener("beforeRemove", (e) => {
      if (!hasUnsaved) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        "Thay đổi chưa lưu",
        "Bạn có các khoản chi phí chưa lưu. Bạn muốn làm gì?",
        [
            { 
              text: "Không lưu", 
              style: "destructive", 
              onPress: () => navigation.dispatch(e.data.action) 
            },
            { 
              text: "Hủy", 
              style: "cancel", 
              onPress: () => {} 
            },
            {
              text: "Lưu & Thoát",
              onPress: async () => {
                  const success = await saveOperatingExpense();
                  if (success) {
                    navigation.dispatch(e.data.action);
                  }
              },
            },
        ]
      );
    });

    return beforeRemoveListener;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, expenseItems, unsavedChanges, storeId, periodType, periodKey]);

  // ===== API CALLS =====
  const fetchFinancial = useCallback(async () => {
    if (!storeId || !periodType || !periodKey) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<any>("/financials", {
        params: { storeId, periodType, periodKey },
      });
      setData(response.data.data);
    } catch (err: any) {
      console.error("fetchFinancial error:", err);
      setError(err?.message || "Lỗi tải báo cáo tài chính");
    } finally {
      setLoading(false);
    }
  }, [storeId, periodType, periodKey]);

  const loadOperatingExpenses = useCallback(async () => {
    if (!storeId || !periodType || !periodKey) {
      setExpenseItems([]);
      setOperatingExpenseId(null);
      setUnsavedChanges(false);
      return;
    }

    try {
      const result = await operatingExpenseApi.getOperatingExpenseByPeriod({
        storeId,
        periodType,
        periodKey,
      });
      // API returns structure { success: true, data: { items: [], _id: ... } }
      const expenseData = result?.data || {};
      setExpenseItems(expenseData.items || []);
      setOperatingExpenseId(expenseData._id || null);
      setUnsavedChanges(false);
    } catch (error) {
      console.error("loadOperatingExpenses error:", error);
      setExpenseItems([]);
      setOperatingExpenseId(null);
    }
  }, [storeId, periodType, periodKey]);

  useEffect(() => {
    if (storeId && periodType && periodKey) {
      fetchFinancial();
      loadOperatingExpenses();
    }
  }, [storeId, periodType, periodKey, fetchFinancial, loadOperatingExpenses]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFinancial(), loadOperatingExpenses()]);
    setRefreshing(false);
  };

  // ===== EXPENSE ACTIONS =====
  const addExpenseItem = () => {
    if (isFuturePeriod) {
      Alert.alert("Không thể thêm", "Không thể thêm chi phí cho thời gian ở tương lai");
      return;
    }

    const amount = parseFloat(newExpenseAmount.replace(/[,.]/g, ""));
    if (!amount || amount <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ > 0");
      return;
    }

    const newItem: ExpenseItem = {
      amount,
      note: newExpenseNote.trim(),
      isSaved: false,
    };

    setExpenseItems([...expenseItems, newItem]);
    setNewExpenseAmount("");
    setNewExpenseNote("");
    setUnsavedChanges(true);
  };

  const removeExpenseItem = (index: number) => {
    const item = expenseItems[index];
    if (!item) return;

    Alert.alert(
      "Xoá chi phí",
      `Xoá khoản ${formatVND(item.amount)}?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            try {
              if (item.isSaved && item._id && operatingExpenseId) {
                await operatingExpenseApi.deleteItemWithCheckbox(operatingExpenseId, [item._id]);
              }
              const newItems = expenseItems.filter((_, i) => i !== index);
              setExpenseItems(newItems);
              
              // Re-check unsaved status
              const hasUnsavedRaw = newItems.some(i => !i.isSaved);
              setUnsavedChanges(hasUnsavedRaw);

              await fetchFinancial();
            } catch (error: any) {
              Alert.alert("Lỗi", error?.message || "Không thể xoá");
            }
          },
        },
      ]
    );
  };

  const saveOperatingExpense = async (): Promise<boolean> => {
    if (!storeId || !periodType || !periodKey) {
      Alert.alert("Lỗi", "Vui lòng chọn đầy đủ kỳ báo cáo");
      return false;
    }

    if (isFuturePeriod) {
      Alert.alert("Lỗi", "Không thể lưu chi phí cho thời gian ở tương lai");
      return false;
    }

    try {
      setLoading(true);
      const itemsToSave = expenseItems.map((it) => ({
        amount: it.amount,
        note: it.note,
        isSaved: true,
      }));

      await operatingExpenseApi.upsertOperatingExpense({
        storeId,
        periodType,
        periodKey,
        items: itemsToSave,
      });

      setUnsavedChanges(false);
      setSelectedExpenseIds([]);
      Alert.alert("Thành công", `Đã lưu ${formatVND(getCurrentTotalExpense())}`);
      await loadOperatingExpenses();
      await fetchFinancial();
      return true;
    } catch (error: any) {
      Alert.alert("Lỗi", error?.message || "Không thể lưu chi phí");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "xlsx" | "pdf" | "csv") => {
    if (!storeId || !periodType || !periodKey) {
      Alert.alert("Lỗi", "Vui lòng chọn kỳ báo cáo trước");
      return;
    }

    try {
      const url = `${apiClient.defaults.baseURL}/financials/export?storeId=${storeId}&periodType=${periodType}&periodKey=${periodKey}&format=${format}&token=${token}`;
      await Linking.openURL(url);
      setShowExportModal(false);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể mở liên kết tải về");
    }
  };

  const handlePeriodTypeChange = (newType: "month" | "quarter" | "year") => {
    if (newType === periodType) return;

    if (!unsavedChanges) {
        setPreviousPeriodType(periodType);
        setPrevPeriodKey(periodKey);
        setPeriodType(newType);
        return;
    }

    Alert.alert(
      "Thay đổi chưa lưu",
      "Bạn có các khoản chi phí chưa lưu. Bạn muốn làm gì?",
      [
        {
          text: "Không lưu",
          style: "destructive",
          onPress: () => {
             setUnsavedChanges(false);
             setPreviousPeriodType(periodType);
             setPrevPeriodKey(periodKey);
             setPeriodType(newType);
          },
        },
        { text: "Hủy", style: "cancel" },
        {
          text: "Lưu & Chuyển",
          onPress: async () => {
            const success = await saveOperatingExpense();
            if (success) {
                setPreviousPeriodType(periodType);
                setPrevPeriodKey(periodKey);
                setPeriodType(newType);
            }
          },
        },
      ]
    );
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowPicker(false);
    if (!date) return;
    
    let newPeriodKey = "";
    if (periodType === "month") newPeriodKey = dayjs(date).format("YYYY-MM");
    else if (periodType === "quarter") {
        const q = Math.floor(date.getMonth() / 3) + 1;
        newPeriodKey = `${dayjs(date).format("YYYY")}-Q${q}`;
    } else {
        newPeriodKey = dayjs(date).format("YYYY");
    }

    if (newPeriodKey === periodKey) {
        setSelectedDate(date);
        return;
    }

    if (!unsavedChanges) {
        setSelectedDate(date);
        return;
    }

    Alert.alert(
      "Thay đổi chưa lưu",
      "Bạn có các khoản chi phí chưa lưu. Bạn muốn làm gì?",
      [
        {
          text: "Không lưu",
          style: "destructive",
          onPress: () => {
             setUnsavedChanges(false);
             setSelectedDate(date);
          },
        },
        { text: "Hủy", style: "cancel" },
        {
          text: "Lưu & Chuyển",
          onPress: async () => {
            const success = await saveOperatingExpense();
            if (success) {
                setSelectedDate(date);
            }
          },
        },
      ]
    );
  };

  // ===== CHART DATA =====
  const barData = useMemo(() => {
    if (!data) return [];
    return [
      { value: Math.max(0, data.totalRevenue / 1e6), label: "DT", frontColor: COLORS.revenue },
      { value: Math.max(0, data.grossProfit / 1e6), label: "LN Gộp", frontColor: COLORS.grossProfit },
      { value: Math.max(0, data.operatingCost / 1e6), label: "CP VH", frontColor: COLORS.operatingCost },
      { value: Math.max(0, data.netProfit / 1e6), label: "LN Ròng", frontColor: COLORS.netProfit },
    ];
  }, [data]);

  const pieData = useMemo(() => {
    if (!data) return [];
    const total = (data.totalRevenue || 0) + (data.stockValue || 0);
    if (total === 0) return [];
    return [
      { value: data.totalRevenue || 0, color: COLORS.revenue, text: "DT" },
      { value: data.stockValue || 0, color: COLORS.stockValue, text: "Tồn" },
    ];
  }, [data]);

  // ===== RENDER HELPERS =====
  const renderStatCard = (
    label: string,
    value: number,
    color: string,
    icon: string,
    comparison?: number | null
  ) => (
    <LinearGradient colors={[color, adjustColor(color, -20)]} style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <View style={styles.statIconWrap}>
          <Ionicons name={icon as any} size={16} color="#fff" />
        </View>
        {comparison !== undefined && comparison !== null && (
          <View style={styles.comparisonBadge}>
            <Ionicons
              name={comparison >= 0 ? "trending-up" : "trending-down"}
              size={10}
              color={comparison >= 0 ? "#22c55e" : "#ef4444"}
            />
            <Text style={[styles.comparisonText, { color: comparison >= 0 ? "#22c55e" : "#ef4444" }]}>
              {Math.abs(comparison)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatVND(value)}</Text>
    </LinearGradient>
  );

  const adjustColor = (color: string, amount: number): string => {
    const clamp = (num: number) => Math.min(255, Math.max(0, num));
    const hex = color.replace("#", "");
    const r = clamp(parseInt(hex.slice(0, 2), 16) + amount);
    const g = clamp(parseInt(hex.slice(2, 4), 16) + amount);
    const b = clamp(parseInt(hex.slice(4, 6), 16) + amount);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  // ===== MAIN RENDER =====
  if (!storeId) {
    return (
      <View style={styles.center}>
        <Ionicons name="storefront-outline" size={64} color="#94a3b8" />
        <Text style={styles.centerTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.centerText}>Vui lòng chọn cửa hàng để xem báo cáo</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#6366f1", "#4f46e5"]} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Báo cáo tài chính</Text>
            <View style={styles.storeRow}>
              <Ionicons name="storefront" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.storeName}>{storeName}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowExportModal(true)}>
            <Ionicons name="download-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={handleRefresh} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="refresh" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>



        {/* PERIOD FILTER */}
        <View style={styles.filterRow}>
          {(["month", "quarter", "year"] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.filterChip, periodType === type && styles.filterChipActive]}
              onPress={() => handlePeriodTypeChange(type)}
            >
              <Text style={[styles.filterChipText, periodType === type && styles.filterChipTextActive]}>
                {type === "month" ? "Tháng" : type === "quarter" ? "Quý" : "Năm"}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={14} color="#fff" />
            <Text style={styles.dateBtnText}>{periodDisplay}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#6366f1"]} />}
      >
        {/* FUTURE PERIOD WARNING */}
        {isFuturePeriod && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color="#f59e0b" />
            <Text style={styles.warningText}>Kỳ báo cáo trong tương lai - không thể ghi nhận chi phí</Text>
          </View>
        )}

        {/* STATS GRID */}
        {data && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
              <View style={styles.statsRow}>
                {renderStatCard("Doanh thu thực", data.totalRevenue, COLORS.revenue, "cash-outline", data.comparison?.revenueChange)}
                {renderStatCard("Doanh thu thuần", data.netSales || 0, "#6366f1", "wallet-outline")}
                {renderStatCard("Lợi nhuận gộp", data.grossProfit, COLORS.grossProfit, "trending-up-outline", data.comparison?.grossProfitChange)}
                {renderStatCard("Lợi nhuận ròng", data.netProfit, COLORS.netProfit, "diamond-outline")}
              </View>
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
              <View style={styles.statsRow}>
                {renderStatCard("Giá vốn (COGS)", data.totalCOGS, COLORS.cogs, "pricetag-outline")}
                {renderStatCard("Chi phí vận hành", data.operatingCost, COLORS.operatingCost, "construct-outline")}
                {renderStatCard("VAT thu hộ", data.totalVAT, COLORS.vat, "receipt-outline")}
                {renderStatCard("Giá trị tồn kho", data.stockValue, COLORS.stockValue, "cube-outline")}
              </View>
            </ScrollView>

            {/* EXPENSE SECTION */}
            {!isFuturePeriod && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Chi phí ngoài lề</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpenseModal(true)}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Thêm</Text>
                  </TouchableOpacity>
                </View>

                {expenseItems.length > 0 ? (
                  <View style={styles.expenseList}>
                    {expenseItems.map((item, index) => (
                      <View key={item._id || `expense-${index}`} style={styles.expenseItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expenseAmount}>{formatVND(item.amount)}</Text>
                          <Text style={styles.expenseNote}>{item.note || "Không có ghi chú"}</Text>
                        </View>
                        <View style={styles.expenseStatus}>
                          <View style={[styles.statusBadge, { backgroundColor: item.isSaved ? "#dcfce7" : "#fef3c7" }]}>
                            <Text style={[styles.statusText, { color: item.isSaved ? "#16a34a" : "#d97706" }]}>
                              {item.isSaved ? "Đã lưu" : "Chưa lưu"}
                            </Text>
                          </View>
                        </View>
                        {!item.originPeriod && (
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => removeExpenseItem(index)}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    <View style={styles.expenseFooter}>
                      <Text style={styles.expenseTotal}>Tổng: {formatVND(getCurrentTotalExpense())}</Text>
                      {unsavedChanges && (
                        <TouchableOpacity style={styles.saveBtn} onPress={saveOperatingExpense} disabled={loading}>
                          {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="save-outline" size={16} color="#fff" />
                              <Text style={styles.saveBtnText}>Lưu</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyExpense}>
                    <Ionicons name="wallet-outline" size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>Chưa có chi phí ngoài lề</Text>
                  </View>
                )}
              </View>
            )}

            {/* CHARTS */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Cơ cấu doanh thu</Text>
              {pieData.length > 0 ? (
                <View style={{ alignItems: "center" }}>
                  <PieChart
                     data={pieData}
                     donut
                     radius={80}
                     innerCircleColor="#fff"
                     innerRadius={60}
                     showText
                     textSize={12}
                     textColor="#333"
                  />
                  <View style={styles.legendContainer}>
                    {pieData.map((item, index) => (
                      <View key={index} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                 <Text style={styles.emptyText}>Chưa có dữ liệu biểu đồ</Text>
              )}
            </View>

            {/* COMPARISON CHART */}
            <View style={styles.chartContainer}>
               <Text style={styles.chartTitle}>So sánh các chỉ số</Text>
               <BarChart
                 data={barData}
                 barWidth={30}
                 noOfSections={4}
                 barBorderRadius={4}
                 frontColor="lightgray"
                 yAxisThickness={0}
                 xAxisThickness={0}
                 width={SCREEN_WIDTH - 64}
                 height={200}
                 isAnimated
               />
            </View>

            {/* GROUPS */}
            {data.groupStats && data.groupStats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Hiệu quả theo nhóm hàng</Text>
                {data.groupStats.map((group) => (
                  <TouchableOpacity
                    key={group._id}
                    style={styles.groupItem}
                    onPress={() => {
                      setSelectedGroup(group);
                      setShowGroupModal(true);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupName}>{group.groupName}</Text>
                      <Text style={styles.groupRevenue}>DT: {formatVND(group.revenue)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", marginRight: 8 }}>
                      <Text style={styles.groupQty}>{group.quantitySold} SP</Text>
                      <View
                        style={[
                          styles.groupBadge,
                          {
                            backgroundColor:
                              group.revenue === 0
                                ? "#f1f5f9"
                                : group.stockToRevenueRatio > 2
                                ? "#fef2f2"
                                : "#dcfce7",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.groupBadgeText,
                            {
                              color:
                                group.revenue === 0
                                  ? "#64748b"
                                  : group.stockToRevenueRatio > 2
                                  ? "#ef4444"
                                  : "#16a34a",
                            },
                          ]}
                        >
                          {group.revenue === 0 ? "Chưa bán" : group.stockToRevenueRatio > 2 ? "Tồn cao" : "Ổn định"}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {loading && !data && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Đang tải báo cáo...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DATE PICKER */}
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}



      {/* ADD EXPENSE MODAL */}
      <Modal visible={showExpenseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm chi phí</Text>
              <TouchableOpacity onPress={() => setShowExpenseModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Số tiền (VND)"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Ghi chú (VD: Điện, nước, mặt bằng...)"
              placeholderTextColor="#94a3b8"
              multiline
              value={newExpenseNote}
              onChangeText={setNewExpenseNote}
            />
            <TouchableOpacity
              style={[styles.modalBtn, !newExpenseAmount && { opacity: 0.5 }]}
              onPress={() => {
                addExpenseItem();
                setShowExpenseModal(false);
              }}
              disabled={!newExpenseAmount}
            >
              <Text style={styles.modalBtnText}>Thêm chi phí</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport("csv")}>
              <Ionicons name="grid-outline" size={24} color="#3b82f6" />
              <Text style={styles.exportText}>CSV (.csv)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowExportModal(false)}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* GROUP DETAIL MODAL */}
      <Modal visible={showGroupModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết: {selectedGroup?.groupName}</Text>
              <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {selectedGroup?.productDetails?.map((product) => (
                <View key={product._id} style={styles.productItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {product.code && <Text style={styles.productCode}>{product.code}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.productCost}>GV: {formatVND(product.cost_price)}</Text>
                    <Text style={styles.productStock}>Tồn: {product.stock_quantity}</Text>
                    <Text style={styles.productTotal}>{formatVND(product.stockValueCost)}</Text>
                  </View>
                </View>
              ))}
              {(!selectedGroup?.productDetails || selectedGroup.productDetails.length === 0) && (
                <View style={styles.emptyExpense}>
                  <Ionicons name="cube-outline" size={32} color="#cbd5e1" />
                  <Text style={styles.emptyText}>Không có sản phẩm</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ReportsDashboardScreen;

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  centerTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginTop: 16 },
  centerText: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  storeName: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginLeft: 8 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)" },
  filterChipActive: { backgroundColor: "#fff" },
  filterChipText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  filterChipTextActive: { color: "#4f46e5" },
  dateBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)" },
  dateBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  body: { flex: 1 },
  warningBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 16, padding: 12, backgroundColor: "#fffbeb", borderRadius: 12, borderWidth: 1, borderColor: "#fde68a" },
  warningText: { flex: 1, color: "#d97706", fontSize: 13, fontWeight: "600" },

  statsScroll: { marginTop: 16 },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 12 },
  statCard: { width: 150, padding: 14, borderRadius: 16, marginBottom: 8 },
  statCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  comparisonBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  comparisonText: { fontSize: 10, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "900" },

  section: { margin: 16, marginTop: 8, padding: 16, backgroundColor: "#fff", borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.04, elevation: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#6366f1", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  expenseList: { gap: 8 },
  expenseItem: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f8fafc", borderRadius: 12, gap: 12 },
  expenseAmount: { fontSize: 15, fontWeight: "800", color: "#f59e0b" },
  expenseNote: { fontSize: 12, color: "#64748b", marginTop: 2 },
  expenseStatus: { alignItems: "flex-end" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "700" },
  deleteBtn: { padding: 8 },
  expenseFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  expenseTotal: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#22c55e", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyExpense: { alignItems: "center", padding: 24 },
  emptyText: { color: "#94a3b8", fontSize: 13, marginTop: 8 },

  chartContainer: { alignItems: "center", marginTop: 16 },
  pieContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginTop: 8 },
  pieLegend: { gap: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: "#64748b", fontWeight: "600" },

  groupItem: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#f8fafc", borderRadius: 12, marginTop: 8 },
  groupName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  groupRevenue: { fontSize: 12, color: "#64748b", marginTop: 2 },
  groupStats: { alignItems: "flex-end", marginRight: 8 },
  groupQty: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
  groupBadgeText: { fontSize: 10, fontWeight: "700" },

  loadingBox: { alignItems: "center", padding: 40 },
  loadingText: { color: "#64748b", marginTop: 12 },
  errorBox: { alignItems: "center", padding: 40 },
  errorText: { color: "#ef4444", marginTop: 12, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  modalInput: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  modalBtn: { backgroundColor: "#6366f1", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  exportModal: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  exportTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", textAlign: "center", marginBottom: 16 },
  exportOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: "#f8fafc", marginBottom: 8 },
  exportText: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  cancelBtn: { marginTop: 8, padding: 14, alignItems: "center" },
  cancelText: { color: "#64748b", fontSize: 15, fontWeight: "600" },

  productItem: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  productName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  productCode: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  productCost: { fontSize: 11, color: "#64748b" },
  productStock: { fontSize: 11, color: "#64748b" },
  productTotal: { fontSize: 13, fontWeight: "800", color: "#6366f1", marginTop: 4 },

  chartTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b", marginBottom: 16 },
  legendContainer: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center", marginTop: 24 },
  periodFilter: { flexDirection: "row", alignItems: "center", gap: 8 },
});
