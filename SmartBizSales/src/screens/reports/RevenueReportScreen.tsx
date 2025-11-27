// src/screens/reports/RevenueReportScreen.tsx
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

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface RevenueResponse {
  revenue: RevenueSummary;
}

interface EmployeeRevenueResponse {
  data: EmployeeRevenue[];
}

type PeriodType = "" | "month" | "quarter" | "year";

// ========== MAIN COMPONENT ==========
const RevenueReportScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeRevenue[]>([]);

  // ✅ Collapsible filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("");
  const [periodKey, setPeriodKey] = useState<string>("");

  // Period selection
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    dayjs().month() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    dayjs().quarter()
  );

  // Sorting
  const [sortBy, setSortBy] = useState<"orders" | "revenue">("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // ========== FORMAT VND ==========
  const formatVND = (
    value: number | { $numberDecimal: string } | undefined | null
  ): string => {
    if (!value) return "₫0";
    const num =
      typeof value === "object" ? parseFloat(value.$numberDecimal) : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
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

  // ========== FETCH DATA ==========
  const fetchData = async (isRefresh: boolean = false): Promise<void> => {
    if (!storeId || !periodType || !periodKey) {
      setSummary(null);
      setEmployeeData([]);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // 1. Fetch total revenue
      const totalRes = await apiClient.get<RevenueResponse>(
        `/revenues?storeId=${storeId}&periodType=${periodType}&periodKey=${periodKey}`
      );
      setSummary(totalRes.data.revenue);

      // 2. Fetch employee revenue
      const empRes = await apiClient.get<EmployeeRevenueResponse>(
        `/revenues/employee?storeId=${storeId}&periodType=${periodType}&periodKey=${periodKey}`
      );
      setEmployeeData(empRes.data.data || []);

      // ✅ Auto collapse filter sau khi load thành công
      setIsFilterExpanded(false);

      console.log("✅ Lấy báo cáo doanh thu thành công");
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy báo cáo:", axiosError);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Lỗi tải báo cáo doanh thu";

      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== AUTO FETCH ==========
  useEffect(() => {
    if (periodType && periodKey) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey]);

  // ========== SORT DATA ==========
  const getSortedData = (): EmployeeRevenue[] => {
    const sorted = [...employeeData].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (sortBy === "orders") {
        aValue = a.countOrders;
        bValue = b.countOrders;
      } else {
        aValue =
          typeof a.totalRevenue === "object"
            ? parseFloat(a.totalRevenue.$numberDecimal)
            : a.totalRevenue;
        bValue =
          typeof b.totalRevenue === "object"
            ? parseFloat(b.totalRevenue.$numberDecimal)
            : b.totalRevenue;
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  // ========== TOGGLE SORT ==========
  const toggleSort = (type: "orders" | "revenue"): void => {
    if (sortBy === type) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(type);
      setSortOrder("desc");
    }
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

  // ========== RENDER EMPLOYEE ITEM ==========
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
        {/* Rank Badge */}
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        {/* Employee Info */}
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

          {/* Stats Row */}
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
          <Ionicons name="trending-up" size={32} color="#1890ff" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Báo cáo doanh thu</Text>
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
                  setSummary(null);
                  setEmployeeData([]);
                }}
                style={styles.picker}
              >
                <Picker.Item label="Chọn loại" value="" />
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

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                (!periodType || loading) && styles.actionBtnDisabled,
              ]}
              onPress={() => fetchData(false)}
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
            onRefresh={() => fetchData(true)}
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

        {/* Info Alert */}
        {!periodType && !loading && (
          <View style={styles.infoAlert}>
            <Ionicons name="information-circle" size={24} color="#1890ff" />
            <Text style={styles.infoAlertText}>
              Vui lòng chọn kỳ báo cáo để xem dữ liệu
            </Text>
          </View>
        )}

        {/* Summary Cards */}
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

            {/* Employee Revenue Section */}
            <View style={styles.employeeSection}>
              <View style={styles.employeeSectionHeader}>
                <Text style={styles.employeeSectionTitle}>
                  Doanh thu theo nhân viên
                </Text>
                <Text style={styles.employeeCount}>
                  {employeeData.length} nhân viên
                </Text>
              </View>

              {/* Sort Options */}
              <View style={styles.sortRow}>
                <TouchableOpacity
                  style={[
                    styles.sortBtn,
                    sortBy === "orders" && styles.sortBtnActive,
                  ]}
                  onPress={() => toggleSort("orders")}
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

              {/* Employee List */}
              {employeeData.length > 0 ? (
                <FlatList
                  data={getSortedData()}
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
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
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
    fontWeight: "700",
    color: "#111827",
  },
  employeeCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
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
    fontWeight: "600",
    color: "#6b7280",
  },
  sortBtnTextActive: {
    color: "#1890ff",
  },
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
    fontWeight: "700",
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
    fontWeight: "700",
    color: "#111827",
  },
  employeeUsername: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
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
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
  },
  bottomSpacer: {
    height: 40,
  },
});
