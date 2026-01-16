import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import dayjs from "dayjs";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

const ProcessExpiredScreen = ({ navigation }: any) => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [supplierModalVisible, setSupplierModalVisible] = useState(false);
  const [mode, setMode] = useState<"DISPOSE" | "RETURN">("DISPOSE");

  // Form states
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [delivererName, setDelivererName] = useState("");
  const [receiverName, setReceiverName] = useState("");

  useEffect(() => {
    fetchExpiring();
    fetchWarehouses();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await apiClient.get(`/suppliers/store/${storeId}?limit=100`);
      setSuppliers((res.data as any).data?.suppliers || (res.data as any).data || []);
    } catch (err) { }
  };

  const fetchExpiring = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/products/expiring?storeId=${storeId}&days=30`);
      setItems((res.data as any).data || []);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tải danh sách hàng hết hạn");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await apiClient.get(`/warehouses/${storeId}`);
      const list = (res.data as any).data || [];
      setWarehouses(list);
      if (list.length > 0) setWarehouseId(list[0]._id);
    } catch (err) {}
  };

  const toggleSelect = (id: string, batch_no: string) => {
    const key = `${id}-${batch_no}`;
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const handleOpenModal = (selectedMode: "DISPOSE" | "RETURN") => {
    if (selectedIds.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất 1 mặt hàng");
      return;
    }
    setMode(selectedMode);
    setReceiverName(selectedMode === "DISPOSE" ? "Hội đồng tiêu hủy" : "");
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!warehouseId || !delivererName || !receiverName) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin bắt buộc (*)");
      return;
    }

    Alert.alert(
      "Xác nhận",
      `Bạn có chắc chắn muốn lập phiếu ${mode === "DISPOSE" ? "TIÊU HỦY" : "TRẢ HÀNG"} cho các mặt hàng đã chọn?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: async () => {
            setLoading(true);
            try {
              const selectedItemsData = items.filter(it => 
                selectedIds.includes(`${it._id}-${it.batch_no}`)
              ).map(it => ({
                product_id: it._id,
                batch_no: it.batch_no,
                quantity: it.quantity,
              }));

              const payload = {
                mode,
                warehouse_id: warehouseId,
                notes,
                partner_name: partnerName,
                deliverer_name: delivererName,
                receiver_name: receiverName,
                items: selectedItemsData,
              };

              await apiClient.post(`/inventory-vouchers/${storeId}/inventory-vouchers/process-expired`, payload);
              
              Alert.alert("Thành công", "Phiếu đã được lập và tồn kho đã được cập nhật.");
              setModalVisible(false);
              setSelectedIds([]);
              fetchExpiring();
            } catch (err: any) {
              Alert.alert("Lỗi", err.response?.data?.message || "Không thể xử lý");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: any) => {
    const key = `${item._id}-${item.batch_no}`;
    const isSelected = selectedIds.includes(key);
    const isExpired = item.status === "expired";

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => toggleSelect(item._id, item.batch_no)}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={isSelected ? "#1890ff" : "#d1d5db"}
          />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lô: <Text style={styles.infoValue}>{item.batch_no}</Text></Text>
            <Text style={styles.infoLabel}>Tồn: <Text style={styles.infoValue}>{item.quantity}</Text></Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>HSD: 
              <Text style={[styles.infoValue, { color: isExpired ? "#f5222d" : "#faad14" }]}>
                {dayjs(item.expiry_date).format("DD/MM/YYYY")}
              </Text>
            </Text>
            <View style={[styles.statusTag, { backgroundColor: isExpired ? "#fff1f0" : "#fffbe6" }]}>
              <Text style={[styles.statusText, { color: isExpired ? "#f5222d" : "#faad14" }]}>
                {isExpired ? "Hết hạn" : "Sắp hết hạn"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1890ff", "#096dd9"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xử lý hàng hết hạn</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <View style={styles.summaryBox}>
        <Ionicons name="information-circle-outline" size={20} color="#666" />
        <Text style={styles.summaryText}>
          Chọn các mặt hàng hết hạn để thực hiện nghiệp vụ tiêu hủy hoặc trả hàng theo quy định.
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item._id}-${item.batch_no}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>Tuyệt vời! Không có hàng hết hạn.</Text>
            </View>
          ) : null
        }
        refreshing={loading}
        onRefresh={fetchExpiring}
      />

      {selectedIds.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.disposeBtn]}
            onPress={() => handleOpenModal("DISPOSE")}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Tiêu hủy ({selectedIds.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.returnBtn]}
            onPress={() => handleOpenModal("RETURN")}
          >
            <Ionicons name="refresh-outline" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Trả hàng</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {mode === "DISPOSE" ? "Nghiệp vụ Tiêu hủy" : "Nghiệp vụ Trả hàng"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={{backgroundColor: mode === "DISPOSE" ? "#fff1f0" : "#f6ffed", padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
               <Text style={{color: mode === "DISPOSE" ? "#f5222d" : "#52c41a", fontWeight: '600'}}>
                 {mode === "DISPOSE" ? "Tổng thiệt hại (Giá vốn):" : "Tổng giá trị hoàn trả:"}
               </Text>
               <Text style={{fontSize: 16, fontWeight: '700', color: mode === "DISPOSE" ? "#f5222d" : "#52c41a"}}>
                 {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                    items.filter(it => selectedIds.includes(`${it._id}-${it.batch_no}`))
                    .reduce((acc, it) => acc + ((it.cost_price || 0) * it.quantity), 0)
                 )}
               </Text>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Kho xuất (*)</Text>
              <View style={styles.pickerContainer}>
                {warehouses.length > 0 ? warehouses.map(w => (
                  <TouchableOpacity
                    key={w._id}
                    style={[styles.choiceBtn, warehouseId === w._id && styles.choiceBtnActive]}
                    onPress={() => setWarehouseId(w._id)}
                  >
                    <Text style={[styles.choiceText, warehouseId === w._id && styles.choiceTextActive]}>{w.name}</Text>
                  </TouchableOpacity>
                )) : <Text style={{color: '#999', fontStyle: 'italic'}}>Không có kho nào</Text>}
              </View>

              <Text style={styles.label}>{mode === "RETURN" ? "Nhà cung cấp (*)" : "Đơn vị tiếp nhận"}</Text>
              <View style={{flexDirection: "row", alignItems: "center", gap: 8}}>
                 <TextInput
                  style={[styles.input, {flex: 1}]}
                  value={partnerName}
                  onChangeText={setPartnerName}
                  placeholder="Nhập hoặc chọn..."
                />
                {mode === "RETURN" && (
                    <TouchableOpacity 
                        style={{backgroundColor: '#e6f7ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#1890ff'}}
                        onPress={() => setSupplierModalVisible(true)}
                    >
                        <Ionicons name="list" size={24} color="#1890ff" />
                    </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Người lập phiếu (*)</Text>
              <TextInput
                style={styles.input}
                value={delivererName}
                onChangeText={setDelivererName}
                placeholder="Tên người giao hàng..."
              />

              <Text style={styles.label}>Người nhận / Hội đồng (*)</Text>
              <TextInput
                style={styles.input}
                value={receiverName}
                onChangeText={setReceiverName}
              />

              <Text style={styles.label}>Ghi chú / Lý do</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="Lý do tiêu hủy hoặc thỏa thuận trả hàng..."
              />
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Xác nhận & Ghi sổ</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Supplier Selection Modal */}
      <Modal visible={supplierModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {height: '70%'}]}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Chọn Nhà Cung Cấp</Text>
                    <TouchableOpacity onPress={() => setSupplierModalVisible(false)}>
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={suppliers}
                    keyExtractor={(item) => item._id}
                    renderItem={({item}) => (
                        <TouchableOpacity 
                            style={{paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee'}}
                            onPress={() => {
                                setPartnerName(item.name);
                                setSupplierModalVisible(false);
                            }}
                        >
                            <Text style={{fontSize: 16, fontWeight: '600'}}>{item.name}</Text>
                            {item.phone && <Text style={{fontSize: 13, color: '#666'}}>SĐT: {item.phone}</Text>}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20, color: '#999'}}>Chưa có nhà cung cấp nào</Text>}
                />
            </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    height: 100,
    paddingTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  summaryBox: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryText: { flex: 1, marginLeft: 10, fontSize: 13, color: "#64748b", lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  itemCardSelected: { borderColor: "#1890ff", backgroundColor: "#f0f7ff" },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  itemBody: {},
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, alignItems: 'center' },
  infoLabel: { fontSize: 13, color: "#64748b" },
  infoValue: { fontWeight: "600", color: "#334155" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disposeBtn: { backgroundColor: "#ef4444" },
  returnBtn: { backgroundColor: "#10b981" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyBox: { alignItems: "center", marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 15, color: "#94a3b8" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "85%", padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  modalForm: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pickerContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  choiceBtnActive: { backgroundColor: "#1890ff", borderColor: "#1890ff" },
  choiceText: { color: "#64748b", fontSize: 13 },
  choiceTextActive: { color: "#fff", fontWeight: "600" },
  submitBtn: {
    backgroundColor: "#1890ff",
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default ProcessExpiredScreen;
