// src/screens/customer/CustomerListScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

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
      return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ₫`;
    if (value >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")} tr₫`;
    return value.toLocaleString("vi-VN") + "₫";
  };

  const getTotalCustomersText = (): string => `${customers.length} khách hàng`;

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
        console.error(" Lỗi load khách hàng:", e);
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

      // File.create & File.write là API mới của expo-file-system [web:302]
      file.create({ overwrite: true });
      file.write(bytes); // write(string | Uint8Array) [web:302]

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Thông báo", `Đã lưu file tại:\n${file.uri}`);
        return;
      }

      // shareAsync nhận local file URL [web:315]
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
  const StatCard = ({
    title,
    value,
    icon,
    tone = "blue",
  }: {
    title: string;
    value: string | number;
    icon: keyof typeof Ionicons.glyphMap | string;
    tone?: "blue" | "green" | "orange";
  }) => {
    const toneStyle =
      tone === "green"
        ? styles.statCardGreen
        : tone === "orange"
          ? styles.statCardOrange
          : styles.statCardBlue;

    return (
      <View style={[styles.statCard, toneStyle]}>
        <View style={styles.statTopRow}>
          <View style={styles.statIconWrap}>
            <Ionicons name={icon as any} size={20} color="#fff" />
          </View>
          <Text style={styles.statTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    );
  };

  const CustomerCard = ({ customer }: { customer: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleViewDetail(customer)}
      activeOpacity={0.92}
    >
      <View style={styles.customerCardContent}>
        <View style={styles.customerHeaderRow}>
          <View style={styles.customerMainInfo}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person-circle" size={54} color="#3b82f6" />
            </View>

            <View style={styles.customerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {customer.name}
                </Text>

                {tabKey === "deleted" ? (
                  <View style={[styles.badge, styles.badgeDeleted]}>
                    <Ionicons name="trash-outline" size={12} color="#b91c1c" />
                    <Text style={[styles.badgeText, { color: "#b91c1c" }]}>
                      Đã xóa
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeActive]}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={12}
                      color="#166534"
                    />
                    <Text style={[styles.badgeText, { color: "#166534" }]}>
                      Hoạt động
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={14} color="#64748b" />
                <Text style={styles.customerPhone}>{customer.phone}</Text>
              </View>

              {!!customer.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.customerAddress} numberOfLines={1}>
                    {customer.address}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.customerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue2}>{customer.totalOrders || 0}</Text>
            <Text style={styles.statLabel}>Đơn hàng</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue2}>
              {formatCurrency(customer.totalSpent || 0)}
            </Text>
            <Text style={styles.statLabel}>Tổng chi</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue2}>{customer.loyaltyPoints || 0}</Text>
            <Text style={styles.statLabel}>Điểm</Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailBtn]}
            onPress={() => handleViewDetail(customer)}
          >
            <Ionicons name="eye-outline" size={16} color="#2563eb" />
            <Text style={[styles.actionText, { color: "#2563eb" }]}>
              Chi tiết
            </Text>
          </TouchableOpacity>

          {tabKey === "active" ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              onPress={() => handleEditCustomer(customer)}
            >
              <Ionicons name="create-outline" size={16} color="#059669" />
              <Text style={[styles.actionText, { color: "#059669" }]}>Sửa</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.restoreBtn]}
              onPress={() => handleRestoreCustomer(customer._id)}
            >
              <Ionicons name="refresh-outline" size={16} color="#16a34a" />
              <Text style={[styles.actionText, { color: "#16a34a" }]}>
                Khôi phục
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
          <Ionicons name="business-outline" size={30} color="#475569" />
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Khách hàng</Text>
              <Text style={styles.heroSubtitle}>
                {getTotalCustomersText()} • Quản lý & theo dõi lịch sử mua hàng
              </Text>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.heroIconBtn} onPress={onRefresh}>
                <Ionicons name="reload-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroIconBtn}
                onPress={handleExportExcel}
              >
                <Ionicons name="download-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsContainer}
          >
            <StatCard
              title="Tổng khách hàng"
              value={totalActive + totalDeleted}
              icon="people-outline"
              tone="blue"
            />
            <StatCard
              title={tabKey === "active" ? "Đang hoạt động" : "Đã xóa"}
              value={tabKey === "active" ? totalActive : totalDeleted}
              icon={
                tabKey === "active"
                  ? "checkmark-circle-outline"
                  : "trash-outline"
              }
              tone={tabKey === "active" ? "green" : "orange"}
            />
            <StatCard
              title="Tổng chi tiêu"
              value={formatMoneyShort(totalSpending)}
              icon="wallet-outline"
              tone="blue"
            />
          </ScrollView>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrap}>
          <TouchableOpacity
            style={[styles.tabBtn, tabKey === "active" && styles.tabBtnActive]}
            onPress={() => {
              setTabKey("active");
              setSearch("");
            }}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={tabKey === "active" ? "#fff" : "#0f172a"}
            />
            <Text
              style={[
                styles.tabText,
                tabKey === "active" && styles.tabTextActive,
              ]}
            >
              Đang hoạt động
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, tabKey === "deleted" && styles.tabBtnActive]}
            onPress={() => {
              setTabKey("deleted");
              setSearch("");
            }}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={tabKey === "deleted" ? "#fff" : "#0f172a"}
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

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#94a3b8"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Tìm theo tên, SĐT, địa chỉ..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#94a3b8"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>

        {/* Add */}
        {tabKey === "active" && (
          <TouchableOpacity
            style={styles.addCustomerBtn}
            onPress={handleAddCustomer}
            activeOpacity={0.9}
          >
            <Ionicons name="person-add" size={22} color="#fff" />
            <Text style={styles.addCustomerText}>Thêm khách hàng mới</Text>
          </TouchableOpacity>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>
              Đang tải danh sách khách hàng...
            </Text>
          </View>
        ) : (
          <FlatList
            data={customers}
            keyExtractor={(item) => item._id}
            renderItem={renderCustomerItem}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            contentContainerStyle={[
              styles.listContainer,
              customers.length === 0 && styles.emptyListContainer,
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#3b82f6"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={44} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>
                  {search
                    ? "Không tìm thấy khách hàng"
                    : tabKey === "active"
                      ? "Chưa có khách hàng nào"
                      : "Không có khách hàng đã xóa"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {search
                    ? "Thử đổi từ khóa hoặc xóa tìm kiếm."
                    : "Bắt đầu bằng cách thêm khách hàng đầu tiên."}
                </Text>

                {tabKey === "active" && (
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={search ? () => setSearch("") : handleAddCustomer}
                  >
                    <Ionicons name="person-add" size={20} color="#fff" />
                    <Text style={styles.emptyBtnText}>
                      {search ? "Xem tất cả" : "Thêm khách hàng"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {/* Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={18} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => loadCustomers()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  // ===== No store =====
  noStoreContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  noStoreIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  noStoreTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  noStoreText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  // ===== Hero =====
  hero: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  heroRow: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 4,
  },
  heroSubtitle: { fontSize: 13, color: "#cbd5e1", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10 },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  // ===== Stats =====
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
  },
  statCard: {
    width: 160,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
  },
  statCardBlue: { backgroundColor: "#1d4ed8" },
  statCardGreen: { backgroundColor: "#16a34a" },
  statCardOrange: { backgroundColor: "#f97316" },
  statTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  statTitle: { fontSize: 12, color: "#fff", fontWeight: "700", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#fff", marginTop: 10 },

  // ===== Tabs =====
  tabsWrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  tabBtnActive: { backgroundColor: "#111827", borderColor: "#111827" },
  tabText: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  tabTextActive: { color: "#fff" },

  // ===== Search =====
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 12, android: 10 }) as any,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#0f172a" },
  clearBtn: { paddingLeft: 8 },

  // ===== Add button =====
  addCustomerBtn: {
    backgroundColor: "#3b82f6",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  addCustomerText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // ===== Loading =====
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b" },

  // ===== List =====
  listContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  emptyListContainer: { flexGrow: 1, justifyContent: "center" },

  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  customerCardContent: { padding: 14 },

  customerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  customerMainInfo: { flexDirection: "row", flex: 1 },

  avatarContainer: { marginRight: 10 },
  customerInfo: { flex: 1, justifyContent: "center" },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customerName: { fontSize: 17, fontWeight: "900", color: "#0f172a", flex: 1 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeDeleted: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 11, fontWeight: "800" },

  infoRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  customerPhone: { color: "#475569", fontSize: 13, marginLeft: 6 },
  customerAddress: { color: "#475569", fontSize: 13, marginLeft: 6, flex: 1 },

  customerStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  statItem: { alignItems: "center" },
  statValue2: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2563eb",
    marginBottom: 2,
  },
  statLabel: { fontSize: 11, color: "#64748b", fontWeight: "700" },

  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
  },
  detailBtn: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  editBtn: { backgroundColor: "#ecfdf5", borderColor: "#bbf7d0" },
  restoreBtn: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  actionText: { fontSize: 13, fontWeight: "900" },

  // ===== Empty =====
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 46,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  // ===== Error =====
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    gap: 8,
  },
  errorText: { color: "#b91c1c", fontSize: 13, fontWeight: "700", flex: 1 },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ef4444",
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});

export default CustomerListScreen;
