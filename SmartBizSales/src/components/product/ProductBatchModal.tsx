// src/components/product/ProductBatchModal.tsx
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
import { Product } from "../../type/product";
import apiClient from "../../api/apiClient";
import * as productApi from "../../api/productApi";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

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
        const res = await apiClient.get<{ warehouses: Warehouse[] }>(`/warehouses/store/${storeId}`);
        setWarehouses(res.data.warehouses || []);
      } catch (error) {
        console.error("Lỗi tải kho:", error);
      }
    };
    fetchWarehouses();
  }, [storeId, open]);

  const handleSave = async () => {
    if (!product._id) return;
    try {
      setLoading(true);
      await productApi.updateProductBatch(product._id.toString(), batchIndex, {
        batch_no: formData.batch_no,
        old_batch_no: batch?.batch_no,
        expiry_date: formData.expiry_date,
        quantity: Number(formData.quantity),
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

  const getWarehouseName = (id: string) => {
    return warehouses.find((w) => w._id === id)?.name || "Chọn kho hàng";
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.backdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              Điều chỉnh lô: {batch?.batch_no || "N/A"}
            </Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContainer}>
            <Text style={styles.productLabel}>Sản phẩm: <Text style={{fontWeight: '700'}}>{product.name}</Text></Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin lô hàng</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Số lô</Text>
                <TextInput
                  style={styles.input}
                  value={formData.batch_no}
                  onChangeText={(t) => setFormData({ ...formData, batch_no: t })}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Số lượng</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.quantity}
                    keyboardType="numeric"
                    onChangeText={(t) => setFormData({ ...formData, quantity: t.replace(/[^0-9]/g, "") })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Hạn sử dụng</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                    <Text style={{ color: formData.expiry_date ? "#000" : "#999" }}>
                      {formData.expiry_date ? new Date(formData.expiry_date).toLocaleDateString("vi-VN") : "Chọn ngày"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Giá vốn (VND)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.cost_price}
                    keyboardType="numeric"
                    onChangeText={(t) => setFormData({ ...formData, cost_price: t.replace(/[^0-9]/g, "") })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Giá bán (VND)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.selling_price}
                    keyboardType="numeric"
                    onChangeText={(t) => setFormData({ ...formData, selling_price: t.replace(/[^0-9]/g, "") })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kho hàng</Text>
                <TouchableOpacity style={styles.dropdown} onPress={() => setShowWarehouseDropdown(true)}>
                  <Text style={styles.dropdownText}>{getWarehouseName(formData.warehouse_id)}</Text>
                  <Ionicons name="chevron-down" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin phiếu kho (Tùy chọn)</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người giao / NCC</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.deliverer_name}
                    onChangeText={(t) => setFormData({ ...formData, deliverer_name: t })}
                    placeholder="Tên người giao"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SĐT người giao</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.deliverer_phone}
                    onChangeText={(t) => setFormData({ ...formData, deliverer_phone: t })}
                    placeholder="SĐT"
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Người nhận / NV</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.receiver_name}
                    onChangeText={(t) => setFormData({ ...formData, receiver_name: t })}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Ghi chú</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.note}
                    onChangeText={(t) => setFormData({ ...formData, note: t })}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Lưu & Tạo phiếu</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Warehouse Dropdown Modal */}
      <Modal visible={showWarehouseDropdown} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowWarehouseDropdown(false)}>
          <View style={styles.dropdownMenu}>
             <Text style={styles.dropdownTitle}>Chọn kho hàng</Text>
             {warehouses.map(w => (
               <TouchableOpacity 
                  key={w._id} 
                  style={styles.dropdownItem}
                  onPress={() => {
                    setFormData({...formData, warehouse_id: w._id});
                    setShowWarehouseDropdown(false);
                  }}
               >
                 <Text style={[styles.dropdownItemText, formData.warehouse_id === w._id && { color: '#16a34a', fontWeight: '700' }]}>{w.name}</Text>
                 {formData.warehouse_id === w._id && <Ionicons name="checkmark" size={20} color="#16a34a" />}
               </TouchableOpacity>
             ))}
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  modalContainer: { backgroundColor: "#fff", borderRadius: 16, maxHeight: "90%", overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 18, fontWeight: "700", color: "#16a34a", flex: 1 },
  productLabel: { paddingHorizontal: 16, paddingTop: 12, color: '#666' },
  formContainer: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#666", textTransform: 'uppercase', marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, color: "#333", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, minHeight: 44, justifyContent: 'center' },
  row: { flexDirection: "row", marginBottom: 0 },
  dropdown: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  dropdownText: { color: "#333" },
  actions: { flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#eee" },
  button: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  cancelButton: { backgroundColor: "#f5f5f5", marginRight: 8 },
  saveButton: { backgroundColor: "#16a34a" },
  cancelText: { color: "#666", fontWeight: "600" },
  saveText: { color: "#fff", fontWeight: "600" },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenu: { width: '80%', backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowOpacity: 0.1, elevation: 5 },
  dropdownTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  dropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', flexDirection: 'row', justifyContent: 'space-between' },
  dropdownItemText: { fontSize: 15 },
});

export default ProductBatchModal;
