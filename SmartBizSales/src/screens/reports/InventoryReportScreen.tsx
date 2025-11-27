// src/screens/reports/InventoryReportScreen.tsx
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
interface MongoDecimal {
  $numberDecimal: string;
}

interface PeriodInfo {
  periodType: string;
  periodKey: string;
  from: string;
  to: string;
}

interface SummaryInfo {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
}

interface ProductDetail {
  index: number;
  productId: string;
  productName: string;
  sku: string;
  openingStock: number;
  importedQty: number;
  exportedQty: number;
  returnedQty: number;
  closingStock: number;
  costPrice: MongoDecimal;
  closingValue: number;
  lowStock: boolean;
}

interface ReportData {
  period: PeriodInfo;
  summary: SummaryInfo;
  details: ProductDetail[];
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface ReportResponse {
  success: boolean;
  message: string;
  data: ReportData;
}

type PeriodType = "realtime" | "month" | "quarter" | "year" | "custom";

// ========== MAIN COMPONENT ==========
const InventoryReportScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [searchText, setSearchText] = useState<string>("");

  // ✅ Collapsible filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(
    dayjs().month() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    dayjs().quarter()
  );
  const [customMonthFrom, setCustomMonthFrom] = useState<number>(
    dayjs().month() + 1
  );
  const [customYearFrom, setCustomYearFrom] = useState<number>(dayjs().year());
  const [customMonthTo, setCustomMonthTo] = useState<number>(
    dayjs().month() + 1
  );
  const [customYearTo, setCustomYearTo] = useState<number>(dayjs().year());

  // ========== FORMAT VND ==========
  const formatVND = (
    value: number | MongoDecimal | undefined | null
  ): string => {
    if (!value) return "₫0";
    const numValue =
      typeof value === "object"
        ? parseFloat(value.$numberDecimal)
        : Number(value);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(numValue);
  };

  // ========== FETCH REPORT ==========
  const fetchReport = async (isRefresh: boolean = false): Promise<void> => {
    if (!storeId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin cửa hàng");
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params: Record<string, string> = { storeId };

      if (periodType === "month") {
        params.periodType = "month";
        params.periodKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
      } else if (periodType === "quarter") {
        params.periodType = "quarter";
        params.periodKey = `${selectedYear}-Q${selectedQuarter}`;
      } else if (periodType === "year") {
        params.periodType = "year";
        params.periodKey = selectedYear.toString();
      } else if (periodType === "custom") {
        if (
          !customYearFrom ||
          !customMonthFrom ||
          !customYearTo ||
          !customMonthTo
        ) {
          Alert.alert("Cảnh báo", "Vui lòng chọn khoảng thời gian tùy chỉnh!");
          setLoading(false);
          setRefreshing(false);
          return;
        }
        params.periodType = "custom";
        params.monthFrom = `${customYearFrom}-${String(customMonthFrom).padStart(2, "0")}`;
        params.monthTo = `${customYearTo}-${String(customMonthTo).padStart(2, "0")}`;
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await apiClient.get<ReportResponse>(
        `/inventory-reports?${queryString}`
      );

      if (response.data.success) {
        setReportData(response.data.data);
        // ✅ Auto collapse filter sau khi load thành công
        setIsFilterExpanded(false);
        console.log("✅ Tải báo cáo tồn kho thành công");
      }
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi tải báo cáo:", axiosError);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Lỗi tải báo cáo";

      Alert.alert("Lỗi", errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== FILTER DATA ==========
  const getFilteredData = (): ProductDetail[] => {
    if (!reportData) return [];
    if (!searchText.trim()) return reportData.details;

    const lower = searchText.toLowerCase();
    return reportData.details.filter(
      (item) =>
        item.productName.toLowerCase().includes(lower) ||
        item.sku.toLowerCase().includes(lower)
    );
  };

  // ========== FORMAT PERIOD LABEL ==========
  const formatPeriodLabel = (): string => {
    if (!reportData || !reportData.period) return "Realtime";
    const { periodType, periodKey } = reportData.period;

    if (periodType === "month") return `Tháng ${periodKey}`;
    if (periodType === "quarter") return `Quý ${periodKey}`;
    if (periodType === "year") return `Năm ${periodKey}`;
    if (periodType === "custom") {
      return `${dayjs(reportData.period.from).format("MM/YYYY")} - ${dayjs(
        reportData.period.to
      ).format("MM/YYYY")}`;
    }
    return "Realtime";
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

  // ========== LOW STOCK COUNT ==========
  const lowStockCount =
    reportData?.details.filter((item) => item.lowStock).length || 0;

  // ========== RENDER PRODUCT ITEM ==========
  const renderProductItem = ({
    item,
  }: {
    item: ProductDetail;
  }): JSX.Element => {
    return (
      <View
        style={[
          styles.productCard,
          item.lowStock && styles.productCardLowStock,
        ]}
      >
        {/* Header Row */}
        <View style={styles.productHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.productNameRow}>
              {item.lowStock && (
                <Ionicons name="warning" size={18} color="#ef4444" />
              )}
              <Text
                style={[
                  styles.productName,
                  item.lowStock && styles.productNameLow,
                ]}
              >
                {item.productName}
              </Text>
            </View>
            <Text style={styles.productSku}>SKU: {item.sku}</Text>
          </View>
          <Text style={styles.productIndex}>#{item.index}</Text>
        </View>

        {/* Stock Info Grid */}
        <View style={styles.stockGrid}>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>Tồn đầu</Text>
            <Text style={styles.stockValue}>{item.openingStock}</Text>
          </View>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>Nhập</Text>
            <Text style={[styles.stockValue, { color: "#52c41a" }]}>
              +{item.importedQty}
            </Text>
          </View>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>Xuất</Text>
            <Text style={[styles.stockValue, { color: "#ef4444" }]}>
              -{item.exportedQty}
            </Text>
          </View>
          <View style={styles.stockItem}>
            <Text style={styles.stockLabel}>Trả NCC</Text>
            <Text style={[styles.stockValue, { color: "#1890ff" }]}>
              {item.returnedQty}
            </Text>
          </View>
        </View>

        {/* Closing Stock & Value */}
        <View style={styles.productFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Tồn cuối kỳ</Text>
            <Text
              style={[
                styles.footerValue,
                { color: item.lowStock ? "#ef4444" : "#52c41a" },
              ]}
            >
              {item.closingStock}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Giá trị tồn</Text>
            <Text style={[styles.footerValue, { color: "#1890ff" }]}>
              {formatVND(item.closingValue)}
            </Text>
          </View>
        </View>

        {/* Low Stock Badge */}
        {item.lowStock && (
          <View style={styles.lowStockBadge}>
            <Ionicons name="alert-circle" size={14} color="#fff" />
            <Text style={styles.lowStockText}>Tồn thấp</Text>
          </View>
        )}
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
          <Ionicons name="cube" size={32} color="#13c2c2" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Báo cáo tồn kho</Text>
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
            <Text style={styles.filterToggleText}>
              {isFilterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
            </Text>
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
                onValueChange={(value: PeriodType) => setPeriodType(value)}
                style={styles.picker}
              >
                <Picker.Item label="Realtime (tồn hiện tại)" value="realtime" />
                <Picker.Item label="Theo tháng" value="month" />
                <Picker.Item label="Theo quý" value="quarter" />
                <Picker.Item label="Theo năm" value="year" />
                <Picker.Item label="Tùy chỉnh khoảng tháng" value="custom" />
              </Picker>
            </View>

            {/* Period Selection */}
            {periodType !== "realtime" && (
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

                {periodType === "custom" && (
                  <>
                    <Text style={styles.filterLabel}>Từ tháng</Text>
                    <View style={styles.customRangeRow}>
                      <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                          selectedValue={customMonthFrom}
                          onValueChange={(value: number) =>
                            setCustomMonthFrom(value)
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
                      <View
                        style={[
                          styles.pickerContainer,
                          { flex: 1, marginLeft: 8 },
                        ]}
                      >
                        <Picker
                          selectedValue={customYearFrom}
                          onValueChange={(value: number) =>
                            setCustomYearFrom(value)
                          }
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
                    </View>

                    <Text style={styles.filterLabel}>Đến tháng</Text>
                    <View style={styles.customRangeRow}>
                      <View style={[styles.pickerContainer, { flex: 1 }]}>
                        <Picker
                          selectedValue={customMonthTo}
                          onValueChange={(value: number) =>
                            setCustomMonthTo(value)
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
                      <View
                        style={[
                          styles.pickerContainer,
                          { flex: 1, marginLeft: 8 },
                        ]}
                      >
                        <Picker
                          selectedValue={customYearTo}
                          onValueChange={(value: number) =>
                            setCustomYearTo(value)
                          }
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
                    </View>
                  </>
                )}
              </>
            )}

            {/* Action Buttons */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => fetchReport(false)}
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
                      <Text style={styles.actionBtnText}>Xem báo cáo</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => fetchReport(true)}
                disabled={!reportData || loading}
                activeOpacity={0.8}
              >
                <Ionicons name="reload" size={18} color="#6b7280" />
                <Text style={styles.actionBtnTextSecondary}>Làm mới</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchReport(true)}
            colors={["#13c2c2"]}
          />
        }
      >
        {/* Loading */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#13c2c2" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && !reportData && (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
            <Text style={styles.emptyText}>
              Chọn kỳ báo cáo và nhấn "Xem báo cáo" để hiển thị dữ liệu
            </Text>
          </View>
        )}

        {/* Report Content */}
        {!loading && reportData && (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Ionicons name="albums" size={28} color="#1890ff" />
                <Text style={styles.summaryLabel}>Tổng sản phẩm</Text>
                <Text style={[styles.summaryValue, { color: "#1890ff" }]}>
                  {reportData.summary.totalProducts}
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Ionicons name="cube" size={28} color="#52c41a" />
                <Text style={styles.summaryLabel}>Tổng tồn kho</Text>
                <Text style={[styles.summaryValue, { color: "#52c41a" }]}>
                  {reportData.summary.totalStock}
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Ionicons name="cash" size={28} color="#faad14" />
                <Text style={styles.summaryLabel}>Tổng giá trị</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: "#faad14", fontSize: 16 },
                  ]}
                >
                  {formatVND(reportData.summary.totalValue)}
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Ionicons
                  name="alert-circle"
                  size={28}
                  color={lowStockCount > 0 ? "#ef4444" : "#52c41a"}
                />
                <Text style={styles.summaryLabel}>Tồn thấp</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: lowStockCount > 0 ? "#ef4444" : "#52c41a" },
                  ]}
                >
                  {lowStockCount}/{reportData.summary.totalProducts}
                </Text>
              </View>
            </View>

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
              <View style={styles.warningAlert}>
                <Ionicons name="warning" size={20} color="#f59e0b" />
                <Text style={styles.warningText}>
                  Có {lowStockCount} sản phẩm tồn kho thấp! Vui lòng nhập hàng
                  kịp thời.
                </Text>
              </View>
            )}

            {/* Search Box */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Tìm tên sản phẩm hoặc SKU..."
                placeholderTextColor="#9ca3af"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText("")}>
                  <Ionicons name="close-circle" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>

            {/* Product List Header */}
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>
                Chi tiết - {formatPeriodLabel()}
              </Text>
              <Text style={styles.listHeaderCount}>
                {getFilteredData().length} sản phẩm
              </Text>
            </View>

            {/* Product List */}
            <FlatList
              data={getFilteredData()}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.productId}
              scrollEnabled={false}
              contentContainerStyle={styles.productList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>Không tìm thấy sản phẩm</Text>
                </View>
              }
            />
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default InventoryReportScreen;

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
    backgroundColor: "#e6fffb",
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
  },
  filterToggleText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1890ff",
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
  customRangeRow: {
    flexDirection: "row",
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  actionBtnPrimary: {
    shadowColor: "#1890ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    paddingVertical: 14,
    borderRadius: 12,
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
  actionBtnTextSecondary: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  warningAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  listHeaderCount: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  productList: {
    paddingHorizontal: 16,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
  },
  productCardLowStock: {
    borderWidth: 2,
    borderColor: "#fecaca",
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  productNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  productNameLow: {
    color: "#ef4444",
  },
  productSku: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  productIndex: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  stockGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  stockItem: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  stockLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 4,
  },
  stockValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  productFooter: {
    flexDirection: "row",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  footerItem: {
    flex: 1,
    alignItems: "center",
  },
  footerDivider: {
    width: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 12,
  },
  footerLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 6,
  },
  footerValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  lowStockBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ef4444",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  bottomSpacer: {
    height: 40,
  },
});
