import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import * as inventoryVoucherApi from "../../api/inventoryVoucherApi";
import { InventoryVoucher } from "../../api/inventoryVoucherApi";
import { useNavigation } from "@react-navigation/native";

const STATUS_LABEL: any = {
  DRAFT: "Nháp",
  APPROVED: "Đã duyệt",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
};

const STATUS_COLOR: any = {
  DRAFT: "#94a3b8",
  APPROVED: "#3b82f6",
  POSTED: "#10b981",
  CANCELLED: "#ef4444",
};

const InventoryVoucherListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  const [vouchers, setVouchers] = useState<InventoryVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [q, setQ] = useState("");
  const [type, setType] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchVouchers = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const res = await inventoryVoucherApi.getInventoryVouchers(storeId, {
        q: q || undefined,
        type: type || undefined,
        status: status || undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        sort: "-voucher_date",
      });
      setVouchers(res.data || []);
    } catch (error) {
      console.error("Lỗi khi tải phiếu kho:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách phiếu kho");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, q, type, status, fromDate, toDate]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVouchers();
  }, [fetchVouchers]);

  const formatCurrency = (n: any) => {
    const val = typeof n === 'object' && n?.$numberDecimal ? parseFloat(n.$numberDecimal) : parseFloat(n || 0);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val || 0);
  };

  const renderItem = ({ item }: { item: InventoryVoucher }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate("InventoryVoucherDetail", { voucherId: item._id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, { backgroundColor: item.type === "IN" ? "#dcfce7" : "#fee2e2" }]}>
          <Text style={[styles.typeText, { color: item.type === "IN" ? "#166534" : "#991b1b" }]}>
            {item.type === "IN" ? "NHẬP" : "XUẤT"}
          </Text>
        </View>
        <Text style={styles.voucherCode}>{item.voucher_code}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + "20" }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] }]}>
            {STATUS_LABEL[item.status]}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text style={styles.infoText} numberOfLines={1}>
            Kho: {item.warehouse_name || "Trống"}
          </Text>
        </View>
        {(item.type === "IN" && (item.supplier_name_snapshot || item.supplier_id?.name)) ? (
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={14} color="#64748b" />
            <Text style={styles.infoText} numberOfLines={1}>
              NCC: {item.supplier_name_snapshot || item.supplier_id?.name}
            </Text>
          </View>
        ) : (
          item.receiver_name && (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={14} color="#64748b" />
              <Text style={styles.infoText} numberOfLines={1}>
                Người nhận: {item.receiver_name}
              </Text>
            </View>
          )
        )}
        
        {item.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonText} numberOfLines={2}>
              📝 {item.reason}
            </Text>
          </View>
        ) : null}

        <View style={styles.productPreview}>
          {(item.items || []).slice(0, 2).map((it: any, idx: number) => (
            <View key={idx} style={styles.productBadge}>
              <Text style={styles.productBadgeText} numberOfLines={1}>
                {it.name_snapshot || it.product_id?.name || "SP"} (x{it.qty_actual})
              </Text>
            </View>
          ))}
          {(item.items?.length || 0) > 2 && (
            <Text style={styles.moreText}>+{item.items.length - 2}...</Text>
          )}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <View style={styles.itemsCount}>
            <Ionicons name="cube-outline" size={12} color="#64748b" />
            <Text style={styles.countText}>
              Tổng SL: {(item.items || []).reduce((acc: number, it: any) => acc + (it.qty_actual || 0), 0)}
            </Text>
          </View>
          <Text style={styles.dateText}>{new Date(item.voucher_date).toLocaleDateString("vi-VN")}</Text>
        </View>
        <Text style={styles.totalCost}>{formatCurrency(item.total_cost)}</Text>
      </View>
    </TouchableOpacity>
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (type) count++;
    if (status) count++;
    if (fromDate || toDate) count++;
    return count;
  }, [type, status, fromDate, toDate]);

  const clearFilters = () => {
    setType(undefined);
    setStatus(undefined);
    setFromDate("");
    setToDate("");
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm mã phiếu, lý do..."
              placeholderTextColor="#94a3b8"
              value={q}
              onChangeText={setQ}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]} 
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options-outline" size={24} color={activeFilterCount > 0 ? "#10b981" : "#fff"} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <FlatList
          data={vouchers}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10b981"]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="receipt-outline" size={60} color="#e2e8f0" />
              </View>
              <Text style={styles.emptyText}>Không tìm thấy phiếu nào</Text>
              <Text style={styles.emptySubText}>Thử thay đổi bộ lọc hoặc tạo phiếu mới</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilterModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc nâng cao</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.filterLabel}>Loại phiếu</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity 
                  style={[styles.chip, !type && styles.chipActive]} 
                  onPress={() => setType(undefined)}
                >
                  <Text style={[styles.chipText, !type && styles.chipTextActive]}>Tất cả</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, type === "IN" && styles.chipActive]} 
                  onPress={() => setType("IN")}
                >
                  <Text style={[styles.chipText, type === "IN" && styles.chipTextActive]}>Nhập kho</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, type === "OUT" && styles.chipActive]} 
                  onPress={() => setType("OUT")}
                >
                  <Text style={[styles.chipText, type === "OUT" && styles.chipTextActive]}>Xuất kho</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.filterLabel}>Trạng thái</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity 
                  style={[styles.chip, !status && styles.chipActive]} 
                  onPress={() => setStatus(undefined)}
                >
                  <Text style={[styles.chipText, !status && styles.chipTextActive]}>Tất cả</Text>
                </TouchableOpacity>
                {Object.keys(STATUS_LABEL).map(s => (
                  <TouchableOpacity 
                    key={s}
                    style={[styles.chip, status === s && styles.chipActive]} 
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{STATUS_LABEL[s]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Khoảng thời gian</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateLabel}>Từ ngày</Text>
                  <TextInput 
                    style={styles.dateInput} 
                    placeholder="YYYY-MM-DD" 
                    value={fromDate} 
                    onChangeText={setFromDate}
                  />
                </View>
                <View style={styles.dateInputWrap}>
                  <Text style={styles.dateLabel}>Đến ngày</Text>
                  <TextInput 
                    style={styles.dateInput} 
                    placeholder="YYYY-MM-DD" 
                    value={toDate} 
                    onChangeText={setToDate}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Xóa tất cả</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyBtnText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("InventoryVoucherForm", { onRefresh: fetchVouchers })}
      >
        <LinearGradient colors={["#10b981", "#059669"]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: "#1e293b" },
  filterBtn: { 
    width: 48, 
    height: 48, 
    borderRadius: 14, 
    backgroundColor: "rgba(255,255,255,0.2)", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  filterBtnActive: { backgroundColor: "#fff" },
  filterBadge: { 
    position: "absolute", 
    top: -5, 
    right: -5, 
    backgroundColor: "#ef4444", 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  list: { padding: 12, paddingBottom: 100 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  typeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  voucherCode: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1e293b" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "800" },
  cardBody: { padding: 16, paddingTop: 0 },
  reasonBox: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 12, marginTop: 8 },
  reasonText: { fontSize: 13, color: "#475569", lineHeight: 18 },
  productPreview: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 6, alignItems: "center" },
  productBadge: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  productBadgeText: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  moreText: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  infoText: { marginLeft: 8, fontSize: 14, color: "#334155", flex: 1, fontWeight: "500" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateText: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  itemsCount: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  totalCost: { fontSize: 18, fontWeight: "900", color: "#059669" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  emptyText: { fontSize: 18, color: "#1e293b", fontWeight: "800" },
  emptySubText: { fontSize: 14, color: "#94a3b8", marginTop: 8 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    elevation: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  modalBody: { padding: 24 },
  filterLabel: { fontSize: 14, fontWeight: "700", color: "#64748b", marginBottom: 12, marginTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#dcfce7", borderColor: "#10b981" },
  chipText: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  chipTextActive: { color: "#059669" },
  dateRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  dateInputWrap: { flex: 1 },
  dateLabel: { fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: "600" },
  dateInput: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, fontSize: 14, color: "#1e293b" },
  modalFooter: { padding: 24, borderTopWidth: 1, borderTopColor: "#f1f5f9", flexDirection: "row", gap: 12 },
  clearBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 14, backgroundColor: "#f1f5f9" },
  clearBtnText: { color: "#64748b", fontWeight: "700" },
  applyBtn: { flex: 2, paddingVertical: 14, alignItems: "center", borderRadius: 14, backgroundColor: "#059669" },
  applyBtnText: { color: "#fff", fontWeight: "700" },
});

export default InventoryVoucherListScreen;
