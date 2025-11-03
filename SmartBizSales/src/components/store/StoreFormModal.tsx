// src/components/store/StoreFormModal.tsx
import React, { useState, useEffect } from "react";
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
} from "react-native";
import type { Store } from "../../type/store";

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

  useEffect(() => {
    setLocalForm(form);
  }, [form, open]);

  const updateField = (key: keyof Store, value: any) => {
    setLocalForm((prev) => ({ ...prev, [key]: value }));
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

  return (
    <Modal visible={open} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.wrapper}
      >
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>{title}</Text>

            {/* Name & Phone */}
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Tên cửa hàng</Text>
                <TextInput
                  value={localForm.name}
                  onChangeText={(t) => updateField("name", t)}
                  style={styles.input}
                  placeholder="Tên cửa hàng"
                />
              </View>

              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Số điện thoại</Text>
                <TextInput
                  value={localForm.phone}
                  onChangeText={(t) => updateField("phone", t)}
                  style={styles.input}
                  placeholder="Số điện thoại"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Address */}
            <View style={styles.field}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput
                value={localForm.address}
                onChangeText={(t) => updateField("address", t)}
                style={styles.input}
                placeholder="Địa chỉ"
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Mô tả</Text>
              <TextInput
                value={localForm.description}
                onChangeText={(t) => updateField("description", t)}
                style={[styles.input, { height: 80 }]}
                placeholder="Mô tả"
                multiline
              />
            </View>

            {/* Image URL */}
            <View style={styles.field}>
              <Text style={styles.label}>URL ảnh cửa hàng</Text>
              <TextInput
                value={localForm.imageUrl}
                onChangeText={(t) => updateField("imageUrl", t)}
                style={styles.input}
                placeholder="https://..."
              />
              {localForm.imageUrl ? (
                <Image
                  source={{ uri: localForm.imageUrl }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />
              ) : null}
            </View>

            {/* Tags */}
            <View style={styles.field}>
              <Text style={styles.label}>Tags (ngăn cách bằng dấu ,)</Text>
              <TextInput
                value={(localForm.tags || []).join(", ")}
                onChangeText={(t) =>
                  updateField(
                    "tags",
                    t
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                style={styles.input}
                placeholder="ví dụ: cà phê, bán lẻ"
              />
            </View>

            {/* Opening Hours */}
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Giờ mở cửa</Text>
                <TextInput
                  value={localForm.openingHours?.open}
                  onChangeText={(t) => updateNested("openingHours", "open", t)}
                  style={styles.input}
                  placeholder="08:00"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Giờ đóng cửa</Text>
                <TextInput
                  value={localForm.openingHours?.close}
                  onChangeText={(t) => updateNested("openingHours", "close", t)}
                  style={styles.input}
                  placeholder="22:00"
                />
              </View>
            </View>

            {/* Location */}
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  value={localForm.location?.lat?.toString() || ""}
                  onChangeText={(t) =>
                    updateNested("location", "lat", t ? Number(t) : null)
                  }
                  style={styles.input}
                  placeholder="Vĩ độ"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  value={localForm.location?.lng?.toString() || ""}
                  onChangeText={(t) =>
                    updateNested("location", "lng", t ? Number(t) : null)
                  }
                  style={styles.input}
                  placeholder="Kinh độ"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Is Default */}
            <View style={styles.field}>
              <Text style={styles.label}>Cửa hàng mặc định</Text>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  localForm.isDefault && styles.toggleActive,
                ]}
                onPress={() => updateField("isDefault", !localForm.isDefault)}
              >
                <Text style={styles.toggleText}>
                  {localForm.isDefault ? "Đang bật" : "Đang tắt"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Buttons */}
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn, busy && styles.disabled]}
                onPress={handleSave}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Lưu</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onClose}
              >
                <Text style={styles.btnTextCancel}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
  },
  container: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
    color: "#0b84ff",
  },
  field: { marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  fieldHalf: { flex: 1, marginRight: 8 },
  label: { fontSize: 14, color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f0f4f8",
    fontSize: 14,
    color: "#111827",
  },
  imagePreview: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#e5e7eb",
  },
  toggleBtn: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#0b84ff" },
  toggleText: { color: "#111827", fontWeight: "700" },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: "center",
  },
  primaryBtn: { backgroundColor: "#0b84ff" },
  cancelBtn: { backgroundColor: "#e5e7eb" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnTextCancel: { color: "#111827", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
});
