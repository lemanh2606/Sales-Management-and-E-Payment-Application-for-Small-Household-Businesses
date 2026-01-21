// src/screens/customer/CustomerListScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  ListRenderItem,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../context/AuthContext";
import customerApi from "../../api/customerApi";

// Components
import CustomerFormModal from "../../components/customer/CustomerFormModal";
import CustomerDetailModal from "../../components/customer/CustomerDetailModal";

import type {
  Customer,
  CustomerCreateData,
  CustomerUpdateData,
} from "../../type/customer";

type TabKey = "active" | "deleted";
const PAGE_SIZE = 50;
const HEADER_MAX_HEIGHT = 180;
const HEADER_MIN_HEIGHT = 60;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const CustomerListScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  const [tabKey, setTabKey] = useState<TabKey>("active");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Modal states
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );

  // Statistics
  const [totalActive, setTotalActive] = useState<number>(0);
  const [totalDeleted, setTotalDeleted] = useState<number>(0);

  // Scroll animation
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });

  // ================= Helpers =================
  const parseMoney = (amount: any): number => {
    if (!amount) return 0;
    if (typeof amount === "object" && amount.$numberDecimal)
      return Number.parseFloat(amount.$numberDecimal) || 0;
    if (typeof amount === "number") return amount;
    const n = Number.parseFloat(String(amount).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const formatCurrency = (amount: any): string => {
    const v = parseMoney(amount);
    return new Intl.NumberFormat("vi-VN").format(v) + "₫";
  };

  const formatMoneyShort = (value: number): string => {
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}tỷ`;
    if (value >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}tr`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toString();
  };

  const getTotalCustomersText = (): string => `${customers.length}`;

  // Calculate total spending
  const totalSpending = customers.reduce(
    (sum, customer) => sum + parseMoney(customer.totalSpent),
    0
  );

  // ================= LOAD CUSTOMERS =================
  const loadCustomers = useCallback(
    async (opts?: { silent?: boolean }): Promise<void> => {
      if (!storeId) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      if (!opts?.silent) setLoading(true);
      setError("");

      try {
        const isDeleted = tabKey === "deleted";
        const res = await customerApi.getCustomersByStore(storeId, {
          page: 1,
          limit: PAGE_SIZE,
          query: search.trim(),
          deleted: isDeleted,
        });

        setCustomers(res.customers || []);

        if (isDeleted) setTotalDeleted(res.total || res.customers.length);
        else setTotalActive(res.total || res.customers.length);
      } catch (e: any) {
        console.error("❌ Lỗi load khách hàng:", e);
        const errorMessage: string =
          e?.response?.data?.message ||
          e?.message ||
          "Không thể tải danh sách khách hàng";
        setError(errorMessage);
        setCustomers([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, search, tabKey]
  );

  // Load both active and deleted counts on mount
  useEffect(() => {
    if (!storeId) return;

    const loadStats = async () => {
      try {
        const [activeRes, deletedRes] = await Promise.all([
          customerApi.getCustomersByStore(storeId, {
            page: 1,
            limit: 1,
            query: "",
            deleted: false,
          }),
          customerApi.getCustomersByStore(storeId, {
            page: 1,
            limit: 1,
            query: "",
            deleted: true,
          }),
        ]);
        setTotalActive(activeRes.total || activeRes.customers.length);
        setTotalDeleted(deletedRes.total || deletedRes.customers.length);
      } catch (err) {
        console.error("Load stats error:", err);
      }
    };

    loadStats();
  }, [storeId]);

  // Initial load + khi tab/search đổi (debounce nhẹ)
  useEffect(() => {
    const t = setTimeout(() => loadCustomers(), 250);
    return () => clearTimeout(t);
  }, [loadCustomers]);

  // Pull to refresh
  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    loadCustomers({ silent: true });
  }, [loadCustomers]);

  // ================= ACTIONS =================
  const handleAddCustomer = (): void => {
    setEditingCustomer(null);
    setShowCustomerModal(true);
  };

  const handleEditCustomer = (customer: Customer): void => {
    setEditingCustomer(customer);
    setShowCustomerModal(true);
  };

  const handleViewDetail = (customer: Customer): void => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleSaveCustomer = async (
    customerData: CustomerCreateData | CustomerUpdateData
  ): Promise<void> => {
    if (!storeId && !editingCustomer) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng trước khi tạo khách hàng.");
      return;
    }

    try {
      if (editingCustomer) {
        await customerApi.updateCustomer(
          editingCustomer._id,
          customerData as CustomerUpdateData
        );
      } else {
        await customerApi.createCustomer({
          ...(customerData as CustomerCreateData),
          storeId: (customerData as any).storeId ?? storeId!,
        });
      }

      setShowCustomerModal(false);
      setEditingCustomer(null);
      await loadCustomers({ silent: true });

      Alert.alert(
        "Thành công",
        editingCustomer
          ? "Cập nhật khách hàng thành công"
          : "Thêm khách hàng thành công"
      );
    } catch (e: any) {
      console.error("Lỗi lưu khách hàng:", e);
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Không thể lưu thông tin khách hàng"
      );
    }
  };

  const handleDeleteCustomer = async (customerId: string): Promise<void> => {
    Alert.alert("Xóa khách hàng", "Bạn có chắc muốn xóa khách hàng này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await customerApi.softDeleteCustomer(customerId);
            setShowDetailModal(false);
            await loadCustomers({ silent: true });
            Alert.alert("Thành công", "Đã xóa khách hàng");
          } catch (e: any) {
            console.error("Lỗi xóa khách hàng:", e);
            Alert.alert(
              "Lỗi",
              e?.response?.data?.message || "Không thể xóa khách hàng"
            );
          }
        },
      },
    ]);
  };

  const handleRestoreCustomer = async (customerId: string): Promise<void> => {
    Alert.alert(
      "Khôi phục khách hàng",
      "Bạn có chắc muốn khôi phục khách hàng này?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Khôi phục",
          onPress: async () => {
            try {
              await customerApi.restoreCustomer(customerId);
              setShowDetailModal(false);
              await loadCustomers({ silent: true });
              Alert.alert("Thành công", "Đã khôi phục khách hàng");
            } catch (e: any) {
              console.error("Lỗi khôi phục khách hàng:", e);
              Alert.alert(
                "Lỗi",
                e?.response?.data?.message || "Không thể khôi phục khách hàng"
              );
            }
          },
        },
      ]
    );
  };

  const handleExportExcel = async (): Promise<void> => {
    if (!storeId) return;

    try {
      setLoading(true);

      const ab = await customerApi.exportCustomers(storeId);
      const bytes = new Uint8Array(ab);

      const fileName = `Danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const file = new File(Paths.cache, fileName);

      file.create({ overwrite: true });
      file.write(bytes);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Thông báo", `Đã lưu file tại:\n${file.uri}`);
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Chia sẻ file Excel",
      });
    } catch (e) {
      console.error("Export excel error:", e);
      Alert.alert("Lỗi", "Không thể xuất Excel, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  // ================= SUB-COMPONENTS =================
  // Compact Customer Card
  const CustomerCard = ({ customer }: { customer: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleViewDetail(customer)}
      activeOpacity={0.7}
    >
      {/* Row 1: Avatar + Name + Badge */}
      <View style={styles.cardRow1}>
        <View style={styles.avatarSmall}>
          <Ionicons name="person" size={18} color="#10b981" />
        </View>

        <View style={styles.nameSection}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customer.name}
          </Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call" size={11} color="#64748b" />
            <Text style={styles.customerPhone} numberOfLines={1}>
              {customer.phone}
            </Text>
          </View>
        </View>

        {tabKey === "deleted" ? (
          <View style={[styles.badgeMini, styles.badgeDeleted]}>
            <Ionicons name="trash" size={10} color="#dc2626" />
          </View>
        ) : (
          <View style={[styles.badgeMini, styles.badgeActive]}>
            <Ionicons name="checkmark-circle" size={10} color="#10b981" />
          </View>
        )}
      </View>

      {/* Row 2: Stats inline */}
      <View style={styles.cardRow2}>
        <View style={styles.statMini}>
          <Ionicons name="cart-outline" size={12} color="#64748b" />
          <Text style={styles.statMiniText}>{customer.totalOrders || 0}</Text>
        </View>

        <View style={styles.statDividerMini} />

        <View style={styles.statMini}>
          <Ionicons name="cash-outline" size={12} color="#64748b" />
          <Text style={styles.statMiniText}>
            {formatMoneyShort(parseMoney(customer.totalSpent || 0))}
          </Text>
        </View>

        <View style={styles.statDividerMini} />

        <View style={styles.statMini}>
          <Ionicons name="star-outline" size={12} color="#64748b" />
          <Text style={styles.statMiniText}>{customer.loyaltyPoints || 0}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Quick actions */}
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => handleViewDetail(customer)}
        >
          <Ionicons name="eye-outline" size={14} color="#3b82f6" />
        </TouchableOpacity>

        {tabKey === "active" && (
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => handleEditCustomer(customer)}
          >
            <Ionicons name="create-outline" size={14} color="#10b981" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCustomerItem: ListRenderItem<Customer> = ({ item }) => (
    <CustomerCard customer={item} />
  );

  const NoStoreState = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.noStoreContainer}>
        <View style={styles.noStoreIcon}>
          <Ionicons name="business-outline" size={28} color="#64748b" />
        </View>
        <Text style={styles.noStoreTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.noStoreText}>
          Vui lòng chọn cửa hàng để xem danh sách khách hàng.
        </Text>
      </View>
    </SafeAreaView>
  );

  // ================= MAIN RENDER =================
  if (!storeId) return <NoStoreState />;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <StatusBar barStyle="light-content" backgroundColor="#10b981" />

        {/* Animated Header with Gradient */}
        <Animated.View style={[{ height: headerHeight }, styles.headerWrapper]}>
          <LinearGradient
            colors={["#10b981", "#3b82f6"]}
            // start={{ x: 0, y: 0 }}
            // end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              {/* Compact title for scrolled state */}
              <Animated.View
                style={[
                  styles.headerTitleCompact,
                  { opacity: headerTitleOpacity },
                ]}
              >
                <Text style={styles.headerTitleCompactText}>Khách hàng</Text>
                <Text style={styles.headerSubtitleCompact}>
                  {getTotalCustomersText()} KH
                </Text>
              </Animated.View>

              {/* Full header content */}
              <Animated.View style={{ opacity: headerOpacity }}>
                <View style={styles.headerTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Khách hàng</Text>
                    <Text style={styles.headerSubtitle}>
                      Quản lý {getTotalCustomersText()} khách hàng
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={handleExportExcel}
                  >
                    <Ionicons name="download-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={onRefresh}
                  >
                    <Ionicons name="reload-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {totalActive + totalDeleted}
                    </Text>
                    <Text style={styles.statBoxLabel}>Tổng</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {tabKey === "active" ? totalActive : totalDeleted}
                    </Text>
                    <Text style={styles.statBoxLabel}>
                      {tabKey === "active" ? "Hoạt động" : "Đã xóa"}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxValue}>
                      {formatMoneyShort(totalSpending)}
                    </Text>
                    <Text style={styles.statBoxLabel}>Tổng chi</Text>
                  </View>
                </View>
              </Animated.View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, tabKey === "active" && styles.tabActive]}
                onPress={() => {
                  setTabKey("active");
                  setSearch("");
                }}
              >
                <Ionicons
                  name="people"
                  size={14}
                  color={tabKey === "active" ? "#10b981" : "#e0f2fe"}
                />
                <Text
                  style={[
                    styles.tabText,
                    tabKey === "active" && styles.tabTextActive,
                  ]}
                >
                  Hoạt động
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, tabKey === "deleted" && styles.tabActive]}
                onPress={() => {
                  setTabKey("deleted");
                  setSearch("");
                }}
              >
                <Ionicons
                  name="trash"
                  size={14}
                  color={tabKey === "deleted" ? "#10b981" : "#e0f2fe"}
                />
                <Text
                  style={[
                    styles.tabText,
                    tabKey === "deleted" && styles.tabTextActive,
                  ]}
                >
                  Đã xóa
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Search bar - fixed */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              placeholder="Tìm tên, SĐT..."
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              placeholderTextColor="#94a3b8"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>

          {tabKey === "active" && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAddCustomer}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        ) : (
          <Animated.FlatList
            data={customers}
            keyExtractor={(item) => item._id}
            renderItem={renderCustomerItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#10b981"]}
                tintColor="#10b981"
                progressViewOffset={HEADER_MAX_HEIGHT}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={40} color="#cbd5e1" />
                </View>
                <Text style={styles.emptyTitle}>
                  {search
                    ? "Không tìm thấy"
                    : tabKey === "active"
                      ? "Chưa có khách hàng"
                      : "Không có KH đã xóa"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {search ? "Thử từ khóa khác" : "Bắt đầu thêm khách hàng mới"}
                </Text>

                {tabKey === "active" && !search && (
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={handleAddCustomer}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.emptyBtnText}>Thêm khách hàng</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {/* Error banner */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => loadCustomers()}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Modals */}
        <CustomerFormModal
          open={showCustomerModal}
          onClose={() => {
            setShowCustomerModal(false);
            setEditingCustomer(null);
          }}
          customer={editingCustomer}
          onSave={handleSaveCustomer}
          storeId={storeId}
        />

        <CustomerDetailModal
          open={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          customer={selectedCustomer}
          onEdit={handleEditCustomer}
          onDelete={handleDeleteCustomer}
          onRestore={handleRestoreCustomer}
          isDeleted={tabKey === "deleted"}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  safeArea: {
    flex: 1,
  },

  // ===== No Store =====
  noStoreContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  noStoreIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  noStoreTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  noStoreText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },

  // ===== Animated Header with Gradient =====
  headerWrapper: {
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  headerGradient: {
    flex: 1,
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 12 : 8,
  },

  // Compact header (when scrolled)
  headerTitleCompact: {
    position: "absolute",
    top: Platform.OS === "android" ? 16 : 12,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitleCompactText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitleCompact: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },

  // Full header
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Stats row
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },

  // Tabs
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#fff",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  tabTextActive: {
    color: "#10b981",
  },

  // ===== Search =====
  searchWrapper: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: "#f1f5f9",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // ===== Customer Card (Compact) =====
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Row 1: Avatar + Name + Badge
  cardRow1: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#d1fae5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  nameSection: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  customerPhone: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },

  badgeMini: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: {
    backgroundColor: "#d1fae5",
  },
  badgeDeleted: {
    backgroundColor: "#fee2e2",
  },

  // Row 2: Stats + Actions
  cardRow2: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statMiniText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  statDividerMini: {
    width: 1,
    height: 14,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 10,
  },
  quickBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },

  // ===== Empty State =====
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#10b981",
    gap: 6,
  },
  emptyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ===== Loading =====
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },

  // ===== Error =====
  errorContainer: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#dc2626",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#991b1b",
    fontWeight: "600",
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#dc2626",
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
});

export default CustomerListScreen;
