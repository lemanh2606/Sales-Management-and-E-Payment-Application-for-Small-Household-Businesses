import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import * as warehouseApi from "../../api/warehouseApi";
import { Warehouse } from "../../api/warehouseApi";

const WarehouseFormScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;
  const editingWarehouse = route.params?.warehouse as Warehouse | undefined;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Warehouse>>({});

  useEffect(() => {
    if (editingWarehouse) {
      setFormData({
        code: editingWarehouse.code || "",
        name: editingWarehouse.name || "",
        description: editingWarehouse.description || "",
        address: editingWarehouse.address || "",
        ward: editingWarehouse.ward || "",
        district: editingWarehouse.district || "",
        city: editingWarehouse.city || "",
        country: editingWarehouse.country || "Việt Nam",
        postal_code: editingWarehouse.postal_code || "",
        latitude: editingWarehouse.latitude || undefined,
        longitude: editingWarehouse.longitude || undefined,
        contact_person: editingWarehouse.contact_person || "",
        phone: editingWarehouse.phone || "",
        email: editingWarehouse.email || "",
        warehouse_type: editingWarehouse.warehouse_type || "normal",
        capacity: editingWarehouse.capacity || undefined,
        capacity_unit: editingWarehouse.capacity_unit || "m3",
        status: editingWarehouse.status || "active",
        is_default: editingWarehouse.is_default || false,
        allow_negative_stock: editingWarehouse.allow_negative_stock || false,
        auto_reorder: editingWarehouse.auto_reorder || false,
        reorder_point: editingWarehouse.reorder_point || undefined,
        barcode_enabled: editingWarehouse.barcode_enabled !== false,
        lot_tracking: editingWarehouse.lot_tracking || false,
        expiry_tracking: editingWarehouse.expiry_tracking || false,
        fifo_enabled: editingWarehouse.fifo_enabled !== false,
        notes: editingWarehouse.notes || "",
      });
    } else {
      setFormData({
        code: "",
        name: "",
        description: "",
        address: "",
        ward: "",
        district: "",
        city: "",
        country: "Việt Nam",
        postal_code: "",
        latitude: undefined,
        longitude: undefined,
        contact_person: "",
        phone: "",
        email: "",
        warehouse_type: "normal",
        capacity: undefined,
        capacity_unit: "m3",
        status: "active",
        is_default: false,
        allow_negative_stock: false,
        auto_reorder: false,
        reorder_point: undefined,
        barcode_enabled: true,
        lot_tracking: false,
        expiry_tracking: false,
        fifo_enabled: true,
        notes: "",
      });
    }
  }, [editingWarehouse]);

  const handleSave = async () => {
    if (!storeId) return;
    if (!formData.code || !formData.name) {
      Alert.alert("Lỗi", "Vui lòng nhập mã và tên kho");
      return;
    }

    try {
      setLoading(true);
      if (editingWarehouse) {
        await warehouseApi.updateWarehouse(
          storeId,
          editingWarehouse._id,
          formData
        );
        Alert.alert("Thành công", "Cập nhật kho hàng thành công");
      } else {
        await warehouseApi.createWarehouse(storeId, formData);
        Alert.alert("Thành công", "Thêm kho hàng mới thành công");
      }
      navigation.navigate("WarehouseList");
      route.params?.onRefresh?.();
    } catch (error: any) {
      console.error("Lỗi khi lưu kho:", error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message || "Không thể lưu thông tin kho hàng"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (title: string, icon: any, children: React.ReactNode) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color="#10b981" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    key: keyof Warehouse,
    keyboardType: any = "default",
    placeholder: string = ""
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => setFormData({ ...formData, [key]: v })}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={["#10b981", "#059669"]}
          style={styles.headerGradient}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity 
              onPress={() => navigation.navigate("WarehouseList")}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleCol}>
              <Text style={styles.headerTitle}>
                {editingWarehouse ? "Cập nhật kho hàng" : "Thêm kho mới"}
              </Text>
              <Text style={styles.headerSub}>
                {editingWarehouse ? `Mã: ${editingWarehouse.code}` : "Khởi tạo kho chứa mới cho cửa hàng"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.formContent}>
          {renderSection(
            "Thông tin cơ bản",
            "information-circle-outline",
            <>
              {renderInput("Mã kho *", formData.code!, "code", "default", "VD: WH_MAIN")}
              {renderInput("Tên kho *", formData.name!, "name", "default", "VD: Kho Tổng Chính")}
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mô tả</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={formData.description}
                  onChangeText={(v) => setFormData({ ...formData, description: v })}
                  multiline
                  placeholder="Mô tả ngắn về kho"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Trạng thái</Text>
                <View style={styles.typeRow}>
                  {["active", "inactive", "maintenance", "archived"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.typePill,
                        formData.status === s && styles.typePillActive,
                      ]}
                      onPress={() => setFormData({ ...formData, status: s as any })}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          formData.status === s && styles.typePillTextActive,
                        ]}
                      >
                        {s === "active" ? "Hoạt động" : s === "inactive" ? "Tạm ngưng" : s === "maintenance" ? "Bảo trì" : "Lưu trữ"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Loại kho</Text>
                <View style={styles.typeRow}>
                  {["normal", "cold_storage", "hazardous", "high_value", "other"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typePill,
                        formData.warehouse_type === t && styles.typePillActive,
                      ]}
                      onPress={() => setFormData({ ...formData, warehouse_type: t as any })}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          formData.warehouse_type === t && styles.typePillTextActive,
                        ]}
                      >
                        {t === "normal" ? "Thường" : t === "cold_storage" ? "Lạnh" : t === "hazardous" ? "Nguy hiểm" : t === "high_value" ? "Giá trị cao" : "Khác"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Dung tích</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.capacity?.toString()}
                    onChangeText={(v) => setFormData({ ...formData, capacity: Number(v) })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Đơn vị</Text>
                  <View style={styles.typeRow}>
                    {["m3", "m2", "pallet", "items", "kg"].map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[
                          styles.typePill,
                          formData.capacity_unit === u && styles.typePillActive,
                        ]}
                        onPress={() => setFormData({ ...formData, capacity_unit: u })}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            formData.capacity_unit === u && styles.typePillTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </>
          )}

          {renderSection(
            "Địa chỉ & Liên hệ",
            "location-outline",
            <>
              {renderInput("Địa chỉ chi tiết", formData.address!, "address", "default", "Số nhà, tên đường...")}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  {renderInput("Phường/Xã", formData.ward!, "ward")}
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  {renderInput("Quận/Huyện", formData.district!, "district")}
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  {renderInput("Thành phố", formData.city!, "city")}
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  {renderInput("Mã bưu điện", formData.postal_code!, "postal_code")}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Vĩ độ (Lat)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.latitude?.toString()}
                    onChangeText={(v) => setFormData({ ...formData, latitude: Number(v) })}
                    keyboardType="numeric"
                    placeholder="Lat"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Kinh độ (Lng)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.longitude?.toString()}
                    onChangeText={(v) => setFormData({ ...formData, longitude: Number(v) })}
                    keyboardType="numeric"
                    placeholder="Lng"
                  />
                </View>
              </View>
              
              <View style={styles.divider} />
              
              {renderInput("Người phụ trách", formData.contact_person!, "contact_person", "default", "Tên người quản lý")}
              {renderInput("Số điện thoại", formData.phone!, "phone", "phone-pad")}
              {renderInput("Email", formData.email!, "email", "email-address")}
            </>
          )}

          {renderSection(
            "Thiết lập & Ghi chú",
            "settings-outline",
            <>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Kho mặc định</Text>
                  <Text style={styles.switchSub}>Tự động chọn khi nhập hàng</Text>
                </View>
                <Switch
                  value={formData.is_default}
                  onValueChange={(v) => setFormData({ ...formData, is_default: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.is_default ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Cho phép tồn âm</Text>
                  <Text style={styles.switchSub}>Bán hàng ngay cả khi hết kho</Text>
                </View>
                <Switch
                  value={formData.allow_negative_stock}
                  onValueChange={(v) => setFormData({ ...formData, allow_negative_stock: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.allow_negative_stock ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Tự động cảnh báo đặt hàng</Text>
                  <Text style={styles.switchSub}>Cảnh báo khi tồn kho xuống thấp</Text>
                </View>
                <Switch
                  value={formData.auto_reorder}
                  onValueChange={(v) => setFormData({ ...formData, auto_reorder: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.auto_reorder ? "#10b981" : "#f1f5f9"}
                />
              </View>

              {formData.auto_reorder && (
                <View style={[styles.inputGroup, { marginTop: 8 }]}>
                  <Text style={styles.label}>Ngưỡng tồn để cảnh báo</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.reorder_point?.toString()}
                    onChangeText={(v) => setFormData({ ...formData, reorder_point: Number(v) })}
                    keyboardType="numeric"
                    placeholder="VD: 10"
                  />
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Sử dụng Barcode/QR</Text>
                </View>
                <Switch
                  value={formData.barcode_enabled}
                  onValueChange={(v) => setFormData({ ...formData, barcode_enabled: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.barcode_enabled ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Theo dõi Lô/Batch</Text>
                </View>
                <Switch
                  value={formData.lot_tracking}
                  onValueChange={(v) => setFormData({ ...formData, lot_tracking: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.lot_tracking ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Theo dõi Hạn sử dụng</Text>
                </View>
                <Switch
                  value={formData.expiry_tracking}
                  onValueChange={(v) => setFormData({ ...formData, expiry_tracking: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.expiry_tracking ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Áp dụng FIFO</Text>
                </View>
                <Switch
                  value={formData.fifo_enabled}
                  onValueChange={(v) => setFormData({ ...formData, fifo_enabled: v })}
                  trackColor={{ false: "#cbd5e1", true: "#d1fae5" }}
                  thumbColor={formData.fifo_enabled ? "#10b981" : "#f1f5f9"}
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 12 }]}>
                <Text style={styles.label}>Ghi chú thêm</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(v) => setFormData({ ...formData, notes: v })}
                  multiline
                  placeholder="Thông thông tin bổ sung..."
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.disabledBtn]}
            onPress={handleSave}
            disabled={loading}
          >
            <LinearGradient
              colors={["#10b981", "#059669"]}
              style={styles.saveGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {editingWarehouse ? "CẬP NHẬT KHO" : "TẠO KHO MỚI"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingBottom: 40 },
  headerGradient: {
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  formContent: { padding: 16, marginTop: -20 },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginLeft: 8,
  },
  sectionContent: {},
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 15,
    color: "#1e293b",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center" },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typePillActive: {
    backgroundColor: "#d1fae5",
    borderColor: "#10b981",
  },
  typePillText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  typePillTextActive: { color: "#059669" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  switchLabel: { fontSize: 15, fontWeight: "600", color: "#1e293b" },
  switchSub: { fontSize: 12, color: "#94a3b8" },
  saveBtn: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  saveGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  disabledBtn: { opacity: 0.7 },
});

export default WarehouseFormScreen;
