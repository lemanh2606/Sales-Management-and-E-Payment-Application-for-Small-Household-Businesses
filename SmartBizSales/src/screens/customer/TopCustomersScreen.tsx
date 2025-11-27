// src/screens/customer/TopCustomersScreen.tsx
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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

// ========== TYPES ==========
interface TopCustomer {
  customerName: string;
  customerPhone: string;
  totalAmount: number | { $numberDecimal: string };
  orderCount: number;
  loyaltyPoints?: number;
  latestOrder: string;
}

interface ApiErrorResponse {
  message?: string;
  error?: string;
}

interface TopCustomersResponse {
  data: TopCustomer[];
  message?: string;
}

type RangeType = "thisWeek" | "thisMonth" | "thisYear";
type LimitType = "3" | "5" | "10" | "20" | "custom";

// ========== MAIN COMPONENT ==========
const TopCustomersScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // States
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [filtered, setFiltered] = useState<TopCustomer[]>([]);
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  // Filters
  const [range, setRange] = useState<RangeType>("thisMonth");
  const [limitOption, setLimitOption] = useState<LimitType>("10");
  const [customLimit, setCustomLimit] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  // ========== FORMAT VND ==========
  const formatVND = (
    value: number | { $numberDecimal: string } | undefined
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

  // ========== FORMAT PHONE ==========
  const formatPhone = (phone: string): string => {
    if (!phone) return "—";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  };

  // ========== FETCH TOP CUSTOMERS ==========
  const fetchTopCustomers = async (
    isRefresh: boolean = false
  ): Promise<void> => {
    if (!storeId) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }

    setHasFetched(true);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let limit = 10;
      if (["3", "5", "20"].includes(limitOption)) {
        limit = parseInt(limitOption);
      } else if (limitOption === "custom" && customLimit) {
        limit = parseInt(customLimit);
      }

      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("range", range);
      if (limit) params.append("limit", limit.toString());

      const response = await apiClient.get<TopCustomersResponse>(
        `/orders/top-customers?${params.toString()}`
      );

      const data = response.data.data || [];
      setCustomers(data);
      setFiltered(data);

      console.log("✅ Lấy top khách hàng thành công:", data.length);
    } catch (err) {
      const axiosError = err as any;
      console.error("❌ Lỗi lấy top khách hàng:", axiosError);

      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "Lỗi tải top khách hàng";

      setError(errorMessage);
      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ========== SEARCH FILTER ==========
  useEffect(() => {
    if (!searchText.trim()) {
      setFiltered(customers);
      return;
    }

    const lower = searchText.toLowerCase();
    const filteredData = customers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(lower) ||
        c.customerPhone.includes(searchText)
    );
    setFiltered(filteredData);
  }, [searchText, customers]);

  // ========== RANGE TEXT ==========
  const getRangeText = (): string => {
    switch (range) {
      case "thisWeek":
        return "Tuần này";
      case "thisMonth":
        return "Tháng này";
      case "thisYear":
        return "Năm nay";
      default:
        return "";
    }
  };

  // ========== RENDER EMPTY ==========
  const renderEmpty = (): JSX.Element => {
    if (!hasFetched) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
          <Text style={styles.emptyText}>
            Chọn kỳ thống kê và nhấn "Xem kết quả" để tải!
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>{getRangeText()} chưa có dữ liệu</Text>
        <Text style={styles.emptyText}>
          Không có khách hàng nào trong kỳ này
        </Text>
      </View>
    );
  };

  // ========== RENDER CUSTOMER CARD ==========
  const renderCustomerCard = (
    customer: TopCustomer,
    index: number
  ): JSX.Element => {
    const rankColors = ["#fbbf24", "#d1d5db", "#f97316"];
    const rankColor = index < 3 ? rankColors[index] : "#6b7280";

    return (
      <View key={customer.customerPhone} style={styles.customerCard}>
        {/* Rank Badge */}
        <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>

        {/* Customer Info */}
        <View style={styles.customerInfo}>
          <View style={styles.customerHeader}>
            <Ionicons name="person-circle" size={24} color="#10b981" />
            <Text style={styles.customerName}>{customer.customerName}</Text>
          </View>

          <View style={styles.customerPhone}>
            <Ionicons name="call-outline" size={16} color="#6b7280" />
            <Text style={styles.phoneText}>
              {formatPhone(customer.customerPhone)}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            {/* Total Amount */}
            <View style={styles.statItem}>
              <Ionicons name="cash-outline" size={20} color="#ef4444" />
              <Text style={styles.statLabel}>Tổng chi</Text>
              <Text style={styles.statValueMoney}>
                {formatVND(customer.totalAmount)}
              </Text>
            </View>

            {/* Order Count */}
            <View style={styles.statItem}>
              <Ionicons name="cart-outline" size={20} color="#f59e0b" />
              <Text style={styles.statLabel}>Đơn hàng</Text>
              <Text style={styles.statValue}>{customer.orderCount}</Text>
            </View>

            {/* Loyalty Points */}
            <View style={styles.statItem}>
              <Ionicons name="star-outline" size={20} color="#10b981" />
              <Text style={styles.statLabel}>Điểm tích lũy</Text>
              <Text style={styles.statValue}>
                {customer.loyaltyPoints?.toLocaleString() || 0}
              </Text>
            </View>
          </View>

          {/* Latest Order */}
          <View style={styles.latestOrder}>
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text style={styles.latestOrderText}>
              Mua gần nhất:{" "}
              {dayjs(customer.latestOrder).format("DD/MM/YYYY HH:mm")}
            </Text>
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
          <Ionicons name="trophy" size={32} color="#fbbf24" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Top Khách Hàng</Text>
          <Text style={styles.headerSubtitle}>{storeName}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTopCustomers(true)}
            colors={["#10b981"]}
          />
        }
      >
        {/* Filters Card */}
        <View style={styles.filtersCard}>
          <Text style={styles.filterLabel}>Kỳ thống kê</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={range}
              onValueChange={(value: RangeType) => setRange(value)}
              style={styles.picker}
            >
              <Picker.Item label="Tuần này" value="thisWeek" />
              <Picker.Item label="Tháng này" value="thisMonth" />
              <Picker.Item label="Năm nay" value="thisYear" />
            </Picker>
          </View>

          <Text style={styles.filterLabel}>Số lượng</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={limitOption}
              onValueChange={(value: LimitType) => {
                setLimitOption(value);
                if (value !== "custom") setCustomLimit("");
              }}
              style={styles.picker}
            >
              <Picker.Item label="Top 3" value="3" />
              <Picker.Item label="Top 5" value="5" />
              <Picker.Item label="Top 10" value="10" />
              <Picker.Item label="Top 20" value="20" />
              <Picker.Item label="Tùy chỉnh" value="custom" />
            </Picker>
          </View>

          {limitOption === "custom" && (
            <>
              <Text style={styles.filterLabel}>Số lượng tùy chỉnh</Text>
              <TextInput
                style={styles.input}
                value={customLimit}
                onChangeText={setCustomLimit}
                placeholder="VD: 30"
                keyboardType="number-pad"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={() => fetchTopCustomers(false)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.searchGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#fff" />
                  <Text style={styles.searchBtnText}>Xem kết quả</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm tên hoặc số điện thoại..."
            placeholderTextColor="#9ca3af"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

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

        {/* Results Header */}
        {filtered.length > 0 && (
          <View style={styles.resultsHeader}>
            <Ionicons name="people" size={20} color="#10b981" />
            <Text style={styles.resultsText}>
              Top {filtered.length} khách hàng - {getRangeText()}
            </Text>
          </View>
        )}

        {/* Customer List */}
        {filtered.length > 0 ? (
          <View style={styles.customerList}>
            {filtered.map((customer, index) =>
              renderCustomerCard(customer, index)
            )}
          </View>
        ) : (
          renderEmpty()
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default TopCustomersScreen;

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
    backgroundColor: "#fef3c7",
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
  filtersCard: {
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
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  searchBtn: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  searchBtnDisabled: {
    opacity: 0.6,
  },
  searchGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    gap: 8,
  },
  resultsText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  customerList: {
    paddingHorizontal: 16,
  },
  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  rankText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  customerInfo: {
    paddingRight: 40,
  },
  customerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  customerPhone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  phoneText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
    marginBottom: 4,
    textAlign: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statValueMoney: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ef4444",
  },
  latestOrder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  latestOrderText: {
    fontSize: 12,
    color: "#6b7280",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
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
  bottomSpacer: {
    height: 40,
  },
});
