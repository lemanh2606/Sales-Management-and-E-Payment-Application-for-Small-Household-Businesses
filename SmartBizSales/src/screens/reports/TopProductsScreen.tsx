// src/screens/reports/TopProductsScreen.tsx
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
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

dayjs.locale("vi");

// ========== TYPES ==========
interface TopProduct {
  _id: string;
  productName: string;
  productSku: string;
  totalQuantity: number;
  totalSales: number | { $numberDecimal: string };
  countOrders: number;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface TopProductsResponse {
  data: TopProduct[];
}

type RangeType = "today" | "yesterday" | "thisWeek" | "thisMonth" | "thisYear";
type LimitOption = "" | "3" | "5" | "20" | "custom";

// ========== MAIN COMPONENT ==========
const TopProductsScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  // ✅ Collapsible filter state
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Filters
  const [range, setRange] = useState<RangeType>("thisMonth");
  const [limitOption, setLimitOption] = useState<LimitOption>("");
  const [customLimit, setCustomLimit] = useState<string>("");

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

  // ========== RANGE TEXT MAP ==========
  const rangeTextMap: Record<RangeType, string> = {
    today: "Hôm nay",
    yesterday: "Hôm qua",
    thisWeek: "Tuần này",
    thisMonth: "Tháng này",
    thisYear: "Năm nay",
  };

  // ========== FETCH TOP PRODUCTS ==========
  const fetchTopProducts = async (
    isRefresh: boolean = false
  ): Promise<void> => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setHasFetched(true);

    try {
      let limit = 10;
      if (limitOption === "3") limit = 3;
      else if (limitOption === "5") limit = 5;
      else if (limitOption === "20") limit = 20;
      else if (limitOption === "custom" && customLimit) {
        limit = parseInt(customLimit);
      }

      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("range", range);
      if (limit) params.append("limit", limit.toString());

      const response = await apiClient.get<TopProductsResponse>(
        `/orders/top-products?${params.toString()}`
      );

      setProducts(response.data.data || []);

      // ✅ Auto collapse filter sau khi load thành công
      setIsFilterExpanded(false);

      console.log("✅ Lấy top sản phẩm thành công");
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy top sản phẩm:", axiosError);
      Alert.alert("Lỗi", "Không thể tải top sản phẩm");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== EXPORT CSV (NEW API) ==========
  const exportToCSV = async (): Promise<void> => {
    if (!products.length) {
      Alert.alert("Thông báo", "Chưa có dữ liệu để xuất");
      return;
    }

    try {
      // Build CSV content
      const BOM = "\uFEFF";
      let csv = BOM + "STT,Tên sản phẩm,Mã SKU,Số lượng bán,Doanh thu,Số đơn\n";

      products.forEach((item, index) => {
        const sales =
          typeof item.totalSales === "object"
            ? parseFloat(item.totalSales.$numberDecimal)
            : item.totalSales;

        const row = [
          index + 1,
          `"${item.productName.replace(/"/g, '""')}"`, // Escape quotes
          item.productSku,
          item.totalQuantity,
          sales,
          item.countOrders,
        ].join(",");

        csv += row + "\n";
      });

      // Create file using new API
      const fileName = `top-san-pham-${range}-${dayjs().format("YYYYMMDD-HHmmss")}.csv`;
      const file = new File(Paths.cache, fileName);

      // Create and write file
      if (!file.exists) {
        file.create();
      }
      file.write(csv);

      console.log("✅ File created at:", file.uri);

      // Share
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Xuất file Top sản phẩm",
          UTI: "public.comma-separated-values-text",
        });
        Alert.alert("Thành công", "Xuất file Excel thành công!");
      } else {
        Alert.alert("Lỗi", "Không thể chia sẻ file trên thiết bị này");
      }
    } catch (err) {
      console.error("❌ Lỗi xuất CSV:", err);
      Alert.alert("Lỗi", `Không thể xuất file CSV: ${err}`);
    }
  };

  // ========== GET FILTER DISPLAY TEXT ==========
  const getFilterDisplayText = (): string => {
    let text = rangeTextMap[range];

    if (limitOption === "3") text += " • Top 3";
    else if (limitOption === "5") text += " • Top 5";
    else if (limitOption === "20") text += " • Top 20";
    else if (limitOption === "custom" && customLimit)
      text += ` • Top ${customLimit}`;
    else text += " • Top 10";

    return text;
  };

  // ========== RENDER PRODUCT ITEM ==========
  const renderProductItem = ({
    item,
    index,
  }: {
    item: TopProduct;
    index: number;
  }): JSX.Element => {
    const sales =
      typeof item.totalSales === "object"
        ? parseFloat(item.totalSales.$numberDecimal)
        : item.totalSales;

    const rankColors = ["#fbbf24", "#d1d5db", "#f97316"];
    const rankColor = index < 3 ? rankColors[index] : "#6b7280";

    return (
      <View style={styles.productCard}>
        {/* Rank Badge */}
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productName}
          </Text>
          <Text style={styles.productSku}>SKU: {item.productSku}</Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="cube-outline" size={18} color="#1890ff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Số lượng bán</Text>
                <Text style={[styles.statValue, { color: "#ef4444" }]}>
                  {item.totalQuantity}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="cash-outline" size={18} color="#52c41a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Doanh thu</Text>
                <Text style={[styles.statValue, { color: "#52c41a" }]}>
                  {formatVND(sales)}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <Ionicons name="receipt-outline" size={18} color="#722ed1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>Số đơn</Text>
                <Text style={[styles.statValue, { color: "#722ed1" }]}>
                  {item.countOrders}
                </Text>
              </View>
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
          <Ionicons name="trophy" size={32} color="#faad14" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Top sản phẩm</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.exportBtn,
            !products.length && styles.exportBtnDisabled,
          ]}
          onPress={exportToCSV}
          disabled={!products.length}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ✅ Collapsible Filter Section */}
      <View style={styles.filterSection}>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setIsFilterExpanded(!isFilterExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.filterToggleLeft}>
            <Ionicons name="funnel" size={20} color="#faad14" />
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
            color="#faad14"
          />
        </TouchableOpacity>

        {isFilterExpanded && (
          <View style={styles.filterContent}>
            {/* Range */}
            <Text style={styles.filterLabel}>Kỳ thống kê</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={range}
                onValueChange={(value: RangeType) => setRange(value)}
                style={styles.picker}
              >
                <Picker.Item label="Hôm nay" value="today" />
                <Picker.Item label="Hôm qua" value="yesterday" />
                <Picker.Item label="Tuần này" value="thisWeek" />
                <Picker.Item label="Tháng này" value="thisMonth" />
                <Picker.Item label="Năm nay" value="thisYear" />
              </Picker>
            </View>

            {/* Limit */}
            <Text style={styles.filterLabel}>Số lượng</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={limitOption}
                onValueChange={(value: LimitOption) => {
                  setLimitOption(value);
                  if (value !== "custom") setCustomLimit("");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Top 3" value="3" />
                <Picker.Item label="Top 5" value="5" />
                <Picker.Item label="Top 10 (mặc định)" value="" />
                <Picker.Item label="Top 20" value="20" />
                <Picker.Item label="Tùy chỉnh..." value="custom" />
              </Picker>
            </View>

            {/* Custom Limit Input */}
            {limitOption === "custom" && (
              <>
                <Text style={styles.filterLabel}>Nhập số lượng tùy chỉnh</Text>
                <TextInput
                  style={styles.customInput}
                  value={customLimit}
                  onChangeText={setCustomLimit}
                  placeholder="VD: 30"
                  keyboardType="numeric"
                  placeholderTextColor="#9ca3af"
                />
              </>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
              onPress={() => fetchTopProducts(false)}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#faad14", "#fa8c16"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="search" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Xem kết quả</Text>
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
            onRefresh={() => fetchTopProducts(true)}
            colors={["#faad14"]}
          />
        }
      >
        {/* Summary Card */}
        {products.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="trophy" size={24} color="#faad14" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>{rangeTextMap[range]}</Text>
                  <Text style={styles.summaryValue}>
                    {products.length} sản phẩm
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Products List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>
              {hasFetched ? "Kết quả" : "Chưa có dữ liệu"}
            </Text>
            {products.length > 0 && (
              <Text style={styles.listHeaderCount}>
                {products.length} sản phẩm
              </Text>
            )}
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#faad14" />
              <Text style={styles.loadingText}>Đang tải top sản phẩm...</Text>
            </View>
          ) : products.length > 0 ? (
            <FlatList
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.productList}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {hasFetched
                  ? `${rangeTextMap[range]} chưa có dữ liệu nào!`
                  : "Chưa có dữ liệu. Chọn kỳ thống kê và nhấn 'Xem kết quả'"}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default TopProductsScreen;

// ========== STYLES (giữ nguyên như bản trước) ==========
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
    backgroundColor: "#fffbeb",
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
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#faad14",
    alignItems: "center",
    justifyContent: "center",
  },
  exportBtnDisabled: { backgroundColor: "#d1d5db" },
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
  filterToggleText: { fontSize: 16, fontWeight: "700", color: "#faad14" },
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
  customInput: {
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
    shadowColor: "#faad14",
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
  summaryCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryRow: { flexDirection: "row" },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryLabel: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#111827" },
  listSection: { marginHorizontal: 16, marginTop: 16 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  listHeaderCount: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  loadingContainer: { alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  productList: { gap: 12 },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  productInfo: { paddingRight: 44 },
  productName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  productSku: { fontSize: 13, color: "#6b7280", marginBottom: 12 },
  statsGrid: { gap: 10 },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  statLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 12,
    textAlign: "center",
  },
  bottomSpacer: { height: 40 },
});
