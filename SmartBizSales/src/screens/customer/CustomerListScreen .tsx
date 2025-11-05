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
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import customerApi from "../../api/customerApi";

// Components
import CustomerFormModal from "../../components/customer/CustomerFormModal";
import CustomerDetailModal from "../../components/customer/CustomerDetailModal";
import {
  Customer,
  CustomerCreateData,
  CustomerUpdateData,
} from "../../type/customer";

// Type definitions for component props
interface CustomerCardProps {
  customer: Customer;
  onViewDetail: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
}

interface EmptyListProps {
  searchText: string;
  onAddCustomer: () => void;
  onClearSearch?: () => void;
}

interface LoadingStateProps {
  message?: string;
}

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

// Main Component
const CustomerListScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  // State management with explicit types
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
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

  // ================= LOAD CUSTOMERS =================
  const loadCustomers = useCallback(async (): Promise<void> => {
    if (!storeId) {
      setCustomers([]);
      setFilteredCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      console.log("🟢 Loading customers for store:", storeId);
      const customerList: Customer[] = await customerApi.getCustomersByStore(
        storeId
      );

      console.log(`✅ Loaded ${customerList.length} customers`);
      setCustomers(customerList);
      setFilteredCustomers(customerList);
    } catch (e: any) {
      console.error("❌ Lỗi load khách hàng:", e);
      const errorMessage: string =
        e?.response?.data?.message ||
        e?.message ||
        "Không thể tải danh sách khách hàng";
      setError(errorMessage);
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  // Pull to refresh
  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    loadCustomers();
  }, [loadCustomers]);

  // Initial load
  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // ================= SEARCH FILTER =================
  useEffect((): void => {
    if (!search.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const query: string = search.toLowerCase().trim();
    const filtered: Customer[] = customers.filter(
      (customer: Customer) =>
        customer?.name?.toLowerCase().includes(query) ||
        customer?.phone?.includes(query) ||
        (customer?.address && customer.address.toLowerCase().includes(query)) ||
        (customer?.note && customer.note.toLowerCase().includes(query))
    );
    setFilteredCustomers(filtered);
  }, [search, customers]);

  // ================= CUSTOMER ACTIONS =================
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
    try {
      if (editingCustomer) {
        await customerApi.updateCustomer(
          editingCustomer._id,
          customerData as CustomerUpdateData
        );
      } else {
        await customerApi.createCustomer(customerData as CustomerCreateData);
      }

      setShowCustomerModal(false);
      setEditingCustomer(null);
      await loadCustomers();

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
        onPress: async (): Promise<void> => {
          try {
            await customerApi.softDeleteCustomer(customerId);
            setShowDetailModal(false);
            await loadCustomers();
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

  // ================= HELPER FUNCTIONS =================
  const formatCurrency = (
    amount: number | { $numberDecimal: string }
  ): string => {
    let value: number;

    if (typeof amount === "object" && amount.$numberDecimal) {
      // Xử lý Decimal128 format từ MongoDB
      value = parseFloat(amount.$numberDecimal);
    } else if (typeof amount === "number") {
      value = amount;
    } else {
      value = 0;
    }

    return new Intl.NumberFormat("vi-VN").format(value) + "₫";
  };

  const getTotalCustomersText = (): string => {
    const count: number = filteredCustomers.length;
    return `${count} khách hàng${count !== 1 ? "" : ""}`;
  };

  // ================= SUB-COMPONENTS =================
  const CustomerCard: React.FC<CustomerCardProps> = ({
    customer,
    onViewDetail,
    onEdit,
  }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={(): void => onViewDetail(customer)}
      activeOpacity={0.9}
    >
      <View style={styles.customerCardContent}>
        {/* Customer Avatar and Basic Info */}
        <View style={styles.customerMainInfo}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={50} color="#3b82f6" />
          </View>

          <View style={styles.customerInfo}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customer.name}
            </Text>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.customerPhone}>{customer.phone}</Text>
            </View>

            {customer.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.customerAddress} numberOfLines={1}>
                  {customer.address}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Customer Stats */}
        <View style={styles.customerStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{customer.totalOrders || 0}</Text>
            <Text style={styles.statLabel}>Đơn hàng</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatCurrency(customer.totalSpent || 0)}
            </Text>
            <Text style={styles.statLabel}>Tổng chi</Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{customer.loyaltyPoints || 0}</Text>
            <Text style={styles.statLabel}>Điểm</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailBtn]}
            onPress={(): void => onViewDetail(customer)}
          >
            <Ionicons name="eye-outline" size={16} color="#3b82f6" />
            <Text style={styles.actionText}>Chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={(): void => onEdit(customer)}
          >
            <Ionicons name="create-outline" size={16} color="#10b981" />
            <Text style={styles.actionText}>Sửa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyList: React.FC<EmptyListProps> = ({
    searchText,
    onAddCustomer,
    onClearSearch,
  }) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={80} color="#e2e8f0" />
      <Text style={styles.emptyTitle}>
        {searchText ? "Không tìm thấy khách hàng" : "Chưa có khách hàng nào"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchText
          ? "Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc"
          : "Bắt đầu bằng cách thêm khách hàng đầu tiên của bạn"}
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={searchText && onClearSearch ? onClearSearch : onAddCustomer}
      >
        <Ionicons
          name="person-add"
          size={20}
          color="#fff"
          style={styles.emptyBtnIcon}
        />
        <Text style={styles.emptyBtnText}>
          {searchText ? "Xem tất cả khách hàng" : "Thêm khách hàng đầu tiên"}
        </Text>
      </TouchableOpacity>
      {!searchText && (
        <Text style={styles.emptyHint}>
          Khách hàng giúp bạn quản lý thông tin và lịch sử mua hàng
        </Text>
      )}
    </View>
  );

  const LoadingState: React.FC<LoadingStateProps> = ({
    message = "Đang tải danh sách khách hàng...",
  }) => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );

  const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
    <View style={styles.errorContainer}>
      <Ionicons name="warning-outline" size={20} color="#dc2626" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Thử lại</Text>
      </TouchableOpacity>
    </View>
  );

  const NoStoreState: React.FC = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.noStoreContainer}>
        <Ionicons name="business-outline" size={64} color="#cbd5e1" />
        <Text style={styles.noStoreText}>
          Vui lòng chọn cửa hàng để xem danh sách khách hàng
        </Text>
      </View>
    </SafeAreaView>
  );

  // ================= RENDER ITEM =================
  const renderCustomerItem: ListRenderItem<Customer> = ({ item }) => (
    <CustomerCard
      customer={item}
      onViewDetail={handleViewDetail}
      onEdit={handleEditCustomer}
    />
  );

  // ================= MAIN RENDER =================
  if (!storeId) {
    return <NoStoreState />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Khách hàng</Text>
          <Text style={styles.headerSubtitle}>{getTotalCustomersText()}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#94a3b8"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Tìm kiếm khách hàng theo tên, số điện thoại, địa chỉ..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={(): void => setSearch("")}>
            <Ionicons name="close-circle" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Add Customer Button */}
      <TouchableOpacity
        style={styles.addCustomerBtn}
        onPress={handleAddCustomer}
      >
        <View style={styles.addCustomerContent}>
          <Ionicons name="person-add" size={24} color="#fff" />
          <Text style={styles.addCustomerText}>Thêm khách hàng mới</Text>
        </View>
      </TouchableOpacity>

      {/* Loading State */}
      {loading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item: Customer): string => item._id}
          renderItem={renderCustomerItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            filteredCustomers.length === 0 && styles.emptyListContainer,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3b82f6"]}
            />
          }
          ListEmptyComponent={
            <EmptyList
              searchText={search}
              onAddCustomer={handleAddCustomer}
              onClearSearch={(): void => setSearch("")}
            />
          }
        />
      )}

      {/* Error Message */}
      {error ? <ErrorState error={error} onRetry={loadCustomers} /> : null}

      {/* Modals */}
      <CustomerFormModal
        open={showCustomerModal}
        onClose={(): void => {
          setShowCustomerModal(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
        storeId={storeId}
      />

      <CustomerDetailModal
        open={showDetailModal}
        onClose={(): void => setShowDetailModal(false)}
        customer={selectedCustomer}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
      />
    </SafeAreaView>
  );
};

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  noStoreContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  noStoreText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
  },
  addCustomerBtn: {
    backgroundColor: "#3b82f6",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#3b82f6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addCustomerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  addCustomerText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  customerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  customerCardContent: {
    padding: 16,
  },
  customerMainInfo: {
    flexDirection: "row",
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  customerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  customerPhone: {
    color: "#475569",
    fontSize: 14,
    marginLeft: 6,
  },
  customerAddress: {
    color: "#475569",
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  customerStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3b82f6",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  detailBtn: {
    backgroundColor: "#eff6ff",
  },
  editBtn: {
    backgroundColor: "#ecfdf5",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#475569",
    marginTop: 24,
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  emptyBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyBtnIcon: {
    marginRight: 8,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyHint: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 24,
    fontStyle: "italic",
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#dc2626",
    borderRadius: 6,
  },
  retryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
});

export default CustomerListScreen;
