import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { Store } from "../../type/store";
import { Ionicons } from "@expo/vector-icons";
import { fetchLatLngFromAddress } from "../../api/storeApi";

interface StoreFormModalProps {
  open: boolean;
  onClose: () => void;
  form: Partial<Store>;
  setForm: (form: Partial<Store>) => void;
  onSave: (payload?: Partial<Store>) => Promise<void>;
  busy?: boolean;
  title?: string;
}

export default function StoreFormModal({
  open,
  onClose,
  form,
  setForm,
  onSave,
  busy = false,
  title = "Thêm cửa hàng",
}: StoreFormModalProps) {
  const [localForm, setLocalForm] = useState<Partial<Store>>(form);

  const [showOpenPicker, setShowOpenPicker] = useState(false);
  const [showClosePicker, setShowClosePicker] = useState(false);
  const geocodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync form from props only when modal opens
  useEffect(() => {
    if (open) {
      setLocalForm({
        ...form,
        openingHours: form.openingHours || { open: "", close: "" },
        location: form.location || { lat: null, lng: null },
        tags: form.tags || [],
      });
    }
  }, [open]); 
  // 👈 REMOVED 'form' from dependencies to prevent reset while typing/picking image 
  // Parent should not update 'form' prop while modal is open unless necessary.

  const updateField = (key: keyof Store, value: any) => {
    setLocalForm((prev) => ({ ...prev, [key]: value }));

    // Tự động lấy tọa độ nếu là trường địa chỉ (Debounced)
    if (key === "address") {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      if (value && value.trim().length > 10) {
        geocodeTimerRef.current = setTimeout(() => {
          handleAutoGeocode(value);
        }, 1500);
      }
    }
  };

  const handleAutoGeocode = async (address: string) => {
    try {
      const geo = await fetchLatLngFromAddress(address);
      if (geo && geo.lat && geo.lng) {
        setLocalForm(prev => ({
          ...prev,
          location: { lat: geo.lat, lng: geo.lng }
        }));
      }
    } catch (e) {
      console.warn("Auto geocode failed", e);
    }
  };

  const updateNested = (parent: keyof Store, key: string, value: any) => {
    setLocalForm((prev) => ({
      ...prev,
      [parent]: {
        ...(typeof prev[parent] === "object" && prev[parent] !== null
          ? prev[parent]
          : {}),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    await onSave(localForm);
  };

  // Chọn ảnh từ thư viện
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Cần quyền truy cập ảnh để chọn ảnh!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      updateField("imageUrl", result.assets[0].uri);
    }
  };

  // Lấy vị trí hiện tại
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Lỗi", "Cần quyền truy cập vị trí!");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      updateNested("location", "lat", location.coords.latitude);
      updateNested("location", "lng", location.coords.longitude);
      Alert.alert("Thành công", "Đã lấy vị trí hiện tại!");
    } catch (err) {
      console.error(err);
      Alert.alert("Lỗi", "Không thể lấy vị trí!");
    }
  };

  const handleTimeChange = (
    event: any,
    date: Date | undefined,
    type: "open" | "close"
  ) => {
    setShowOpenPicker(false);
    setShowClosePicker(false);
    if (!date) return;
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    updateNested("openingHours", type, `${hours}:${minutes}`);
  };

  return (
    <Modal visible={open} animationType="fade" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.modalContent}>
            {/* Custom Header */}
            <View style={styles.header}>
              <View style={styles.headerIconBox}>
                <Ionicons name="storefront" size={24} color="#3b82f6" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.headerTitle}>{title}</Text>
                <Text style={styles.headerSubtitle}>Vui lòng điền đủ thông tin</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
            >
              {/* Section 1: Basic Info */}
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle" size={18} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Tên cửa hàng <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="storefront-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={localForm.name}
                    onChangeText={(t) => updateField("name", t)}
                    style={styles.input}
                    placeholder="Ví dụ: Tiệm Của Manh"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Số điện thoại</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={localForm.phone}
                    onChangeText={(t) => updateField("phone", t)}
                    style={styles.input}
                    placeholder="Ví dụ: 0987654321"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.label}>Địa chỉ <Text style={styles.required}>*</Text></Text>
                  <TouchableOpacity onPress={getCurrentLocation} style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <Ionicons name="navigate-circle-outline" size={16} color="#3b82f6" />
                     <Text style={{ fontSize: 12, color: '#3b82f6', marginLeft: 4 }}>Lấy vị trí hiện tại</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="location-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={localForm.address}
                    onChangeText={(t) => updateField("address", t)}
                    style={styles.input}
                    placeholder="Số nhà, tên đường, khu vực..."
                    placeholderTextColor="#9ca3af"
                    onBlur={() => localForm.address && handleAutoGeocode(localForm.address)}
                  />
                </View>

                {/* Latitude & Longitude Fields */}
                <View style={styles.latLngGrid}>
                   <View style={styles.fieldHalf}>
                      <Text style={styles.smallLabel}>Vĩ độ (Lat)</Text>
                      <View style={[styles.inputWrapper, { height: 44, paddingHorizontal: 10 }]}>
                        <TextInput
                          value={localForm.location?.lat?.toString() || ""}
                          onChangeText={(t) => updateNested("location", "lat", t ? Number(t) : null)}
                          style={[styles.input, { fontSize: 13 }]}
                          placeholder="10.xxx"
                          keyboardType="numeric"
                        />
                      </View>
                   </View>
                   <View style={styles.fieldHalf}>
                      <Text style={styles.smallLabel}>Kinh độ (Lng)</Text>
                      <View style={[styles.inputWrapper, { height: 44, paddingHorizontal: 10 }]}>
                        <TextInput
                          value={localForm.location?.lng?.toString() || ""}
                          onChangeText={(t) => updateNested("location", "lng", t ? Number(t) : null)}
                          style={[styles.input, { fontSize: 13 }]}
                          placeholder="106.xxx"
                          keyboardType="numeric"
                        />
                      </View>
                   </View>
                   <TouchableOpacity 
                     onPress={() => localForm.address && handleAutoGeocode(localForm.address)}
                     style={styles.refreshCoordBtn}
                   >
                     <Ionicons name="refresh-circle" size={32} color="#3b82f6" />
                   </TouchableOpacity>
                </View>
                
                {localForm.location?.lat != null && (
                   <Text style={{ fontSize: 11, color: '#10b981', marginTop: 6, marginLeft: 4 }}>
                     ✅ Tọa độ đã được nhận diện tự động
                   </Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Mô tả</Text>
                <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
                  <TextInput
                    value={localForm.description}
                    onChangeText={(t) => updateField("description", t)}
                    style={[styles.input, { textAlignVertical: "top" }]}
                    placeholder="Đôi dòng giới thiệu về cửa hàng..."
                    placeholderTextColor="#9ca3af"
                    multiline
                  />
                </View>
              </View>

              <DividerHorizontal />

              {/* Section 2: Media */}
              <View style={styles.sectionHeader}>
                <Ionicons name="image" size={18} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Hình ảnh & Thương hiệu</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Ảnh đại diện</Text>
                <View style={styles.imageSelector}>
                  {localForm.imageUrl ? (
                    <View style={styles.imageBox}>
                      <Image source={{ uri: localForm.imageUrl }} style={styles.imagePreview} />
                      <TouchableOpacity 
                        style={styles.removeImageBtn}
                        onPress={() => updateField("imageUrl", "")}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.imagePlaceholder} onPress={pickImage}>
                      <Ionicons name="camera" size={32} color="#9ca3af" />
                      <Text style={styles.imagePlaceholderText}>Nhấn để chụp/chọn ảnh</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Tags (Ví dụ: cà phê, trà đá, bún chả)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="pricetags-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    value={(localForm.tags || []).join(", ")}
                    onChangeText={(t) =>
                      updateField(
                        "tags",
                        t.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    style={styles.input}
                    placeholder="Ngăn cách bằng dấu phẩy"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              <DividerHorizontal />

              {/* Section 3: Settings */}
              <View style={styles.sectionHeader}>
                <Ionicons name="settings" size={18} color="#3b82f6" />
                <Text style={styles.sectionTitle}>Cấu hình vận hành</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Giờ mở</Text>
                  <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowOpenPicker(true)}>
                    <Ionicons name="time-outline" size={18} color="#6b7280" />
                    <Text style={styles.timePickerText}>
                      {localForm.openingHours?.open || "08:00"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.label}>Giờ đóng</Text>
                  <TouchableOpacity style={styles.timePickerBtn} onPress={() => setShowClosePicker(true)}>
                    <Ionicons name="time-outline" size={18} color="#6b7280" />
                    <Text style={styles.timePickerText}>
                      {localForm.openingHours?.close || "22:00"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {showOpenPicker && (
                <DateTimePicker
                  value={new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleTimeChange(e, d, "open")}
                />
              )}
              {showClosePicker && (
                <DateTimePicker
                  value={new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleTimeChange(e, d, "close")}
                />
              )}

              <View style={styles.field}>
                 <View style={styles.toggleRow}>
                    <View>
                      <Text style={styles.label}>Thiết lập làm mặc định</Text>
                      <Text style={styles.toggleDesc}>Tự động chọn khi vào ứng dụng</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => updateField("isDefault", !localForm.isDefault)}
                      style={[styles.toggleSwitch, localForm.isDefault && styles.toggleSwitchActive]}
                    >
                      <View style={[styles.toggleCircle, localForm.isDefault && styles.toggleCircleActive]} />
                    </TouchableOpacity>
                 </View>
              </View>

              <View style={styles.spacer} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelActionBtn} onPress={onClose}>
                <Text style={styles.cancelActionText}>Hủy bỏ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveActionBtn, busy && styles.disabled]} 
                onPress={handleSave}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveActionText}>Lưu cửa hàng</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const DividerHorizontal = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    width: "100%",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "90%",
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  scrollContainer: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginLeft: 8,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  required: {
    color: "#ef4444",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  fieldHalf: {
    width: "48%",
  },
  imageSelector: {
    marginTop: 4,
  },
  imagePlaceholder: {
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  imagePlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#9ca3af",
    fontWeight: "500",
  },
  imageBox: {
    position: "relative",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 12,
  },
  timePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 52,
    gap: 8,
  },
  timePickerText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 16,
  },
  toggleDesc: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  toggleSwitch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#cbd5e1",
    padding: 4,
  },
  toggleSwitchActive: {
    backgroundColor: "#3b82f6",
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 12,
  },
  cancelActionBtn: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
  },
  cancelActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4b5563",
  },
  saveActionBtn: {
    flex: 2,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  disabled: {
    opacity: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 10,
  },
  spacer: {
    height: 40,
  },
  latLngGrid: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  smallLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  refreshCoordBtn: {
    paddingBottom: 4,
  },
});
