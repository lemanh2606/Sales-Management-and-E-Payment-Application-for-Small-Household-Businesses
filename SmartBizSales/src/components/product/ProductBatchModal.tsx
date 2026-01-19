
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Product } from "../../type/product";
import apiClient from "../../api/apiClient";
import * as productApi from "../../api/productApi";
import { useAuth } from "../../context/AuthContext";

interface ProductBatchModalProps {
  product: Product;
  batchIndex: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface Warehouse {
  _id: string;
  name: string;
}

const ProductBatchModal: React.FC<ProductBatchModalProps> = ({
  product,
  batchIndex,
  open,
  onClose,
  onSaved,
}) => {
  const { currentStore, user } = useAuth();
  const storeId = currentStore?._id;

  const batch = product.batches?.[batchIndex];

  const [formData, setFormData] = useState({
    batch_no: "",
    expiry_date: null as string | null,
    quantity: "",
    cost_price: "",
    selling_price: "",
    warehouse_id: "",
    deliverer_name: "",
    deliverer_phone: "",
    receiver_name: user?.fullname || user?.username || "",
    receiver_phone: user?.phone || "",
    note: "",
  });

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (batch) {
      setFormData({
        batch_no: batch.batch_no || "",
        expiry_date: batch.expiry_date ? String(batch.expiry_date) : null,
        quantity: batch.quantity?.toString() || "0",
        cost_price: batch.cost_price?.toString() || "0",
        selling_price: (batch as any).selling_price?.toString() || product.price?.toString() || "0",
        warehouse_id: batch.warehouse_id || product.default_warehouse_id || "",
        deliverer_name: product.supplier?.name || "",
        deliverer_phone: product.supplier?.phone || "",
        receiver_name: user?.fullname || user?.username || "",
        receiver_phone: user?.phone || "",
        note: "Điều chỉnh tại app",
      });
    }
  }, [batch, product, user]);

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!storeId || !open) return;
      try {
        const res = await apiClient.get<{ warehouses: Warehouse[] }>(`/stores/${storeId}/warehouses`);
        setWarehouses(res.data.warehouses || []);
      } catch (error) {
        console.error("Lỗi tải kho:", error);
      }
    };
    fetchWarehouses();
  }, [storeId, open]);

  const handleSave = async () => {
    if (!product._id) return;
    
    const newQty = Number(formData.quantity) || 0;
    const oldQty = Number(batch?.quantity) || 0;
    const qtyDelta = newQty - oldQty;
    const currentStock = Number(product.stock_quantity) || 0;
    const projectedStock = currentStock + qtyDelta;
    
    const maxStock = product.max_stock !== undefined && product.max_stock !== null 
      ? Number(product.max_stock) 
      : 0;

    if (maxStock > 0 && projectedStock > maxStock) {
      Alert.alert(
        "Lỗi: Vượt tồn kho tối đa",
        `Tổng tồn kho dự kiến (${projectedStock}) vượt quá giới hạn tối đa của sản phẩm (${maxStock}).\n\nVui lòng điều chỉnh lại số lượng.`
      );
      return;
    }

    if (newQty < 0) {
      Alert.alert("Lỗi", "Số lượng không được âm");
      return;
    }

    try {
      setLoading(true);
      await productApi.updateProductBatch(product._id.toString(), batchIndex, {
        batch_no: formData.batch_no,
        old_batch_no: batch?.batch_no,
        expiry_date: formData.expiry_date,
        quantity: newQty,
        cost_price: Number(formData.cost_price),
        selling_price: Number(formData.selling_price),
        warehouse_id: formData.warehouse_id,
        deliverer_name: formData.deliverer_name,
        deliverer_phone: formData.deliverer_phone,
        receiver_name: formData.receiver_name,
        receiver_phone: formData.receiver_phone,
        note: formData.note,
      });
      Alert.alert("Thành công", "Đã cập nhật lô hàng và tạo phiếu kho");
      onSaved();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Lỗi", error.response?.data?.message || "Không thể cập nhật lô hàng");
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, expiry_date: selectedDate.toISOString() });
    }
  };

  const getName = (list: any[], id: string, placeholder = "Chọn...") => {
     return list.find(i => i._id === id)?.name || placeholder;
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={["#16a34a", "#15803d"]} style={styles.header}>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 0 : 10}}>
                     <View>
                        <Text style={styles.headerTitle}>Điều chỉnh lô hàng</Text>
                        <Text style={styles.headerSubtitle}>{batch?.batch_no || "N/A"}</Text>
                     </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex: 1}}>
            <ScrollView contentContainerStyle={styles.contentParams}>
                
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Thông tin lô hàng</Text>
                    
                     <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Số lô</Text>
                        <TextInput style={styles.input} 
                             value={formData.batch_no} 
                             onChangeText={t => setFormData({...formData, batch_no: t})}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.col, {marginRight: 8}]}>
                             <Text style={styles.label}>Số lượng</Text>
                             <TextInput style={styles.input} 
                                  value={formData.quantity} 
                                  onChangeText={t => setFormData({...formData, quantity: t.replace(/[^0-9]/g, "")})}
                                  keyboardType="numeric"
                             />
                        </View>
                        <View style={[styles.col, {marginLeft: 8}]}>
                             <Text style={styles.label}>Hạn sử dụng</Text>
                             <TouchableOpacity style={styles.selectInput} onPress={() => setShowDatePicker(true)}>
                                  <Text style={{color: formData.expiry_date ? "#333" : "#999"}}>
                                      {formData.expiry_date ? new Date(formData.expiry_date).toLocaleDateString("vi-VN") : "Chọn ngày"}
                                  </Text>
                                  <Ionicons name="calendar-outline" size={20} color="#666" />
                             </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.col, {marginRight: 8}]}>
                             <Text style={styles.label}>Giá vốn (VND)</Text>
                             <TextInput style={styles.input} 
                                  value={formData.cost_price} 
                                  onChangeText={t => setFormData({...formData, cost_price: t.replace(/[^0-9]/g, "")})}
                                  keyboardType="numeric"
                             />
                        </View>
                        <View style={[styles.col, {marginLeft: 8}]}>
                             <Text style={styles.label}>Giá bán (VND)</Text>
                             <TextInput style={styles.input} 
                                  value={formData.selling_price} 
                                  onChangeText={t => setFormData({...formData, selling_price: t.replace(/[^0-9]/g, "")})}
                                  keyboardType="numeric"
                             />
                        </View>
                    </View>

                     <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Kho hàng</Text>
                        <TouchableOpacity style={styles.selectInput} onPress={() => setShowWarehouseDropdown(true)}>
                              <Text style={{color: formData.warehouse_id ? "#333" : "#999"}}>
                                  {getName(warehouses, formData.warehouse_id, "Chọn kho hàng...")}
                              </Text>
                              <Ionicons name="chevron-down" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Thông tin phiếu kho</Text>
                    
                    <View style={styles.row}>
                        <View style={[styles.col, {marginRight: 8}]}>
                             <Text style={styles.label}>Người giao / NCC</Text>
                             <TextInput style={styles.input} 
                                  value={formData.deliverer_name} 
                                  onChangeText={t => setFormData({...formData, deliverer_name: t})}
                             />
                        </View>
                        <View style={[styles.col, {marginLeft: 8}]}>
                             <Text style={styles.label}>SĐT người giao</Text>
                             <TextInput style={styles.input} 
                                  value={formData.deliverer_phone} 
                                  onChangeText={t => setFormData({...formData, deliverer_phone: t})}
                                  keyboardType="phone-pad"
                             />
                        </View>
                    </View>

                    <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Người nhận / Nhân viên</Text>
                        <TextInput style={styles.input} 
                             value={formData.receiver_name} 
                             onChangeText={t => setFormData({...formData, receiver_name: t})}
                        />
                    </View>

                     <View style={styles.videoFormGroup}>
                        <Text style={styles.label}>Ghi chú</Text>
                        <TextInput style={styles.input} 
                             value={formData.note} 
                             onChangeText={t => setFormData({...formData, note: t})}
                             placeholder="Nhập ghi chú..."
                        />
                    </View>
                </View>

            </ScrollView>
            </KeyboardAvoidingView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={loading}>
                    <Text style={styles.btnCancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnSaveText}>Lưu & Điều Chỉnh</Text>}
                </TouchableOpacity>
            </View>

            {/* Modals */}
             <Modal visible={showWarehouseDropdown} transparent animationType="fade" onRequestClose={() => setShowWarehouseDropdown(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowWarehouseDropdown(false)}>
                  <View style={styles.dropdownContainer}>
                    <View style={styles.dropdownHeader}>
                      <Text style={styles.dropdownTitle}>Chọn kho hàng</Text>
                      <TouchableOpacity onPress={() => setShowWarehouseDropdown(false)}><Ionicons name="close" size={24} color="#666"/></TouchableOpacity>
                    </View>
                    <ScrollView style={{maxHeight: 300}}>
                      {warehouses.map(item => (
                        <TouchableOpacity key={item._id} style={[styles.dropdownItem, formData.warehouse_id === item._id && styles.dropdownItemSelected]}
                          onPress={() => { setFormData({...formData, warehouse_id: item._id}); setShowWarehouseDropdown(false); }}>
                          <Text style={[styles.dropdownItemText, formData.warehouse_id === item._id && {color: "#16a34a", fontWeight: "700"}]}>{item.name}</Text>
                          {formData.warehouse_id === item._id && <Ionicons name="checkmark" size={20} color="#16a34a" />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>

            {showDatePicker && (
                <DateTimePicker
                value={formData.expiry_date ? new Date(formData.expiry_date) : new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
                />
            )}
        </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { padding: 16, paddingTop: 40 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  headerSubtitle: { fontSize: 14, color: "#e2e8f0", marginTop: 2 },
  closeBtn: { padding: 4 },
  contentParams: { padding: 16, paddingBottom: 100 },
  
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionHeader: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 12, textTransform: "uppercase" },
  
  videoFormGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, color: "#0f172a", fontSize: 15 },
  selectInput: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  
  row: { flexDirection: "row", marginBottom: 12 },
  col: { flex: 1 },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", padding: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", flexDirection: "row", gap: 12 },
  btnCancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center" },
  btnCancelText: { fontWeight: "600", color: "#64748b" },
  btnSave: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: "#16a34a", alignItems: "center" },
  btnSaveText: { fontWeight: "700", color: "#fff" },

  // Dropdown Modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  dropdownContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "60%" },
  dropdownHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 12 },
  dropdownTitle: { fontSize: 16, fontWeight: "bold" },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dropdownItemSelected: { backgroundColor: "#f0fdf4" },
  dropdownItemText: { fontSize: 15, color: "#334155" }
});

export default ProductBatchModal;
