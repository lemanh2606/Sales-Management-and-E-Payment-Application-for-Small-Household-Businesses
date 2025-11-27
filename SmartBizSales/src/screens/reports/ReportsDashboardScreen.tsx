// src/screens/reports/ReportsDashboardScreen.tsx
import React, { useState, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

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

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface FinancialResponse {
  data: FinancialData;
  message?: string;
}

type PeriodType = "" | "month" | "quarter" | "year";

// ========== COLORS ==========
const COLORS = {
  revenue: "#1890ff",
  grossProfit: "#52c41a",
  netProfit: "#722ed1",
  operatingCost: "#fa8c16",
  vat: "#f5222d",
  stockValue: "#13c2c2",
};

// ========== MAIN COMPONENT ==========
const ReportsDashboardScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FinancialData | null>(null);

  // ✅ Collapsible filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [extraExpenses, setExtraExpenses] = useState<number[]>([]);
  const [newExpense, setNewExpense] = useState<string>("");

  // Period selection
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    dayjs().month() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    dayjs().quarter()
  );

  // ========== FORMAT VND ==========
  const formatVND = (value: number | undefined | null): string => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // ========== FORMAT NUMBER ==========
  const formatNumber = (value: string): string => {
    const number = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // ========== GET PROFIT COLOR ==========
  const getProfitColor = (value: number | undefined | null): string => {
    if (value == null) return "#fa8c16";
    if (value > 0) return "#52c41a";
    if (value < 0) return "#f5222d";
    return "#fa8c16";
  };

  // ========== UPDATE PERIOD KEY ==========
  useEffect(() => {
    if (!periodType) {
      setPeriodKey("");
      return;
    }

    let key = "";
    if (periodType === "month") {
      key = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    } else if (periodType === "quarter") {
      key = `${selectedYear}-Q${selectedQuarter}`;
    } else if (periodType === "year") {
      key = selectedYear.toString();
    }
    setPeriodKey(key);
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // ========== FETCH FINANCIAL ==========
  const fetchFinancial = async (isRefresh: boolean = false): Promise<void> => {
    if (!storeId) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }

    if (!periodType || !periodKey) {
      setData(null);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        storeId,
        periodType,
        periodKey,
      });

      if (extraExpenses.length > 0) {
        params.append("extraExpense", extraExpenses.join(","));
      }

      const response = await apiClient.get<FinancialResponse>(
        `/financials?${params.toString()}`
      );

      setData(response.data.data);
      // ✅ Auto collapse filter sau khi load thành công
      setIsFilterExpanded(false);
      console.log("✅ Lấy báo cáo tài chính thành công");
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy báo cáo:", axiosError);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Lỗi tải báo cáo tài chính";

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== AUTO FETCH ==========
  useEffect(() => {
    if (periodType && periodKey) {
      fetchFinancial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey, extraExpenses]);

  // ========== ADD EXPENSE ==========
  const addExtraExpense = (): void => {
    const value = parseFloat(newExpense.replace(/\./g, ""));
    if (!isNaN(value) && value > 0) {
      setExtraExpenses([...extraExpenses, value]);
      setNewExpense("");
    } else {
      Alert.alert("Lỗi", "Vui lòng nhập số tiền hợp lệ");
    }
  };

  // ========== REMOVE EXPENSE ==========
  const removeExpense = (index: number): void => {
    setExtraExpenses(extraExpenses.filter((_, idx) => idx !== index));
  };

  // ========== GENERATE YEARS ==========
  const generateYears = (): number[] => {
    const currentYear = dayjs().year();
    const years: number[] = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }
    return years;
  };

  // ========== GET PERIOD DISPLAY TEXT ==========
  const getPeriodDisplayText = (): string => {
    if (!periodType) return "Chưa chọn kỳ";

    if (periodType === "month") {
      return `Tháng ${selectedMonth}/${selectedYear}`;
    } else if (periodType === "quarter") {
      return `Quý ${selectedQuarter}/${selectedYear}`;
    } else if (periodType === "year") {
      return `Năm ${selectedYear}`;
    }
    return "";
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
          <Ionicons name="stats-chart" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Báo cáo tổng quan</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
      </View>

      {/* ✅ Collapsible Filter Section */}
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
              {!isFilterExpanded && periodType && (
                <Text style={styles.filterTogglePeriod}>
                  {getPeriodDisplayText()}
                  {extraExpenses.length > 0 &&
                    ` • ${extraExpenses.length} chi phí ngoài`}
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
            {/* Period Type */}
            <Text style={styles.filterLabel}>Kỳ báo cáo</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={periodType}
                onValueChange={(value: PeriodType) => {
                  setPeriodType(value);
                  setData(null);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Chưa chọn" value="" />
                <Picker.Item label="Theo tháng" value="month" />
                <Picker.Item label="Theo quý" value="quarter" />
                <Picker.Item label="Theo năm" value="year" />
              </Picker>
            </View>

            {/* Period Selection */}
            {periodType && (
              <>
                <Text style={styles.filterLabel}>Năm</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedYear}
                    onValueChange={(value: number) => setSelectedYear(value)}
                    style={styles.picker}
                  >
                    {generateYears().map((year) => (
                      <Picker.Item
                        key={year}
                        label={year.toString()}
                        value={year}
                      />
                    ))}
                  </Picker>
                </View>

                {periodType === "month" && (
                  <>
                    <Text style={styles.filterLabel}>Tháng</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedMonth}
                        onValueChange={(value: number) =>
                          setSelectedMonth(value)
                        }
                        style={styles.picker}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (month) => (
                            <Picker.Item
                              key={month}
                              label={`Tháng ${month}`}
                              value={month}
                            />
                          )
                        )}
                      </Picker>
                    </View>
                  </>
                )}

                {periodType === "quarter" && (
                  <>
                    <Text style={styles.filterLabel}>Quý</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedQuarter}
                        onValueChange={(value: number) =>
                          setSelectedQuarter(value)
                        }
                        style={styles.picker}
                      >
                        <Picker.Item label="Quý 1" value={1} />
                        <Picker.Item label="Quý 2" value={2} />
                        <Picker.Item label="Quý 3" value={3} />
                        <Picker.Item label="Quý 4" value={4} />
                      </Picker>
                    </View>
                  </>
                )}
              </>
            )}

            {/* Extra Expenses */}
            <Text style={styles.filterLabel}>Chi phí ngoài</Text>
            <Text style={styles.hint}>
              (Chi phí không trong hệ thống: mặt bằng, điện nước, marketing...)
            </Text>
            <View style={styles.expenseInputRow}>
              <TextInput
                style={styles.expenseInput}
                value={formatNumber(newExpense)}
                onChangeText={(text) => setNewExpense(text.replace(/\./g, ""))}
                placeholder="VD: 1000000"
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={[
                  styles.addExpenseBtn,
                  !newExpense && styles.addExpenseBtnDisabled,
                ]}
                onPress={addExtraExpense}
                disabled={!newExpense}
              >
                <Text style={styles.addExpenseBtnText}>Thêm</Text>
              </TouchableOpacity>
            </View>

            {extraExpenses.length > 0 && (
              <View style={styles.expenseList}>
                {extraExpenses.map((exp, index) => (
                  <View key={index} style={styles.expenseChip}>
                    <Text style={styles.expenseChipText}>{formatVND(exp)}</Text>
                    <TouchableOpacity onPress={() => removeExpense(index)}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                (!periodType || loading) && styles.actionBtnDisabled,
              ]}
              onPress={() => fetchFinancial(false)}
              disabled={!periodType || loading}
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
                    <Text style={styles.actionBtnText}>Xem báo cáo</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchFinancial(true)}
            colors={["#1890ff"]}
          />
        }
      >
        {/* Error Alert */}
        {error && (
          <View style={styles.errorAlert}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorAlertText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
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

        {/* Info Alert - No selection */}
        {!periodType && !loading && (
          <View style={styles.infoAlert}>
            <Ionicons name="information-circle" size={24} color="#1890ff" />
            <Text style={styles.infoAlertText}>
              Vui lòng chọn kỳ báo cáo để xem dữ liệu
            </Text>
          </View>
        )}

        {/* Data Display */}
        {!loading && data && (
          <>
            {/* Statistics Cards */}
            <View style={styles.statsGrid}>
              <View
                style={[styles.statCard, { borderLeftColor: COLORS.revenue }]}
              >
                <Ionicons name="trending-up" size={24} color={COLORS.revenue} />
                <Text style={styles.statLabel}>Doanh thu</Text>
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
                <Ionicons name="cash" size={24} color={COLORS.grossProfit} />
                <Text style={styles.statLabel}>Lợi nhuận gộp</Text>
                <Text style={[styles.statValue, { color: COLORS.grossProfit }]}>
                  {formatVND(data.grossProfit)}
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  { borderLeftColor: COLORS.operatingCost },
                ]}
              >
                <Ionicons
                  name="wallet"
                  size={24}
                  color={COLORS.operatingCost}
                />
                <Text style={styles.statLabel}>Chi phí vận hành</Text>
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
                <Ionicons
                  name="trophy"
                  size={24}
                  color={getProfitColor(data.netProfit)}
                />
                <Text style={styles.statLabel}>Lợi nhuận ròng</Text>
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

            {/* Tax & Stock */}
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

            {/* Details */}
            <View style={styles.detailCard}>
              <Text style={styles.detailCardTitle}>Chi tiết</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chi phí nhập hàng (COGS)</Text>
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
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chi phí hàng hoá huỷ</Text>
                <Text style={styles.detailValue}>
                  {formatVND(data.stockDisposalCost)}
                </Text>
              </View>
            </View>

            {/* Performance */}
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
                      ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(
                          1
                        )
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
                      ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
                      : 0}
                    %
                  </Text>
                </View>
              </View>
              <Text style={styles.performanceHint}>
                💡 Lợi nhuận gộp = Doanh thu - Giá vốn hàng bán
              </Text>
              <Text style={styles.performanceHint}>
                💡 Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành - Thuế
              </Text>
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default ReportsDashboardScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
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
  errorText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
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
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  // ✅ Collapsible Filter Styles
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
  filterToggleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1890ff",
  },
  filterTogglePeriod: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
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
  hint: {
    fontSize: 11,
    color: "#1890ff",
    marginBottom: 8,
    fontStyle: "italic",
  },
  pickerContainer: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  expenseInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  expenseInput: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  addExpenseBtn: {
    backgroundColor: "#1890ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
  },
  addExpenseBtnDisabled: {
    backgroundColor: "#d1d5db",
  },
  addExpenseBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  expenseList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  expenseChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  expenseChipText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
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
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
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
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
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
  },
  statsGrid: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  detailCard: {
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
  detailCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  performanceRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  performanceItem: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  performanceLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
    textAlign: "center",
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  performanceHint: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});
