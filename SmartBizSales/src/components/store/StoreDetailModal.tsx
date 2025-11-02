// src/components/store/StoreDetailModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import type { Store } from "../../type/store";

interface StoreDetailModalProps {
  open: boolean;
  onClose: () => void;
  store: Store | null;
  onEdit: (store: Store) => void;
  onSelect: (store: Store) => void;
  onDelete: (id: string) => void;
}

export default function StoreDetailModal({
  open,
  onClose,
  store,
  onEdit,
  onSelect,
  onDelete,
}: StoreDetailModalProps) {
  if (!store) return null;

  return (
    <Modal visible={open} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.title}>{store.name}</Text>

            {store.address ? (
              <Text style={styles.field}>Địa chỉ: {store.address}</Text>
            ) : null}
            {store.phone ? (
              <Text style={styles.field}>Điện thoại: {store.phone}</Text>
            ) : null}
            {store.description ? (
              <Text style={styles.field}>Mô tả: {store.description}</Text>
            ) : null}
            {store.tags?.length ? (
              <Text style={styles.field}>Tags: {store.tags.join(", ")}</Text>
            ) : null}
            {store.openingHours ? (
              <Text style={styles.field}>
                Giờ hoạt động: {store.openingHours.open} -{" "}
                {store.openingHours.close}
              </Text>
            ) : null}
            {store.location ? (
              <Text style={styles.field}>
                Vị trí: {store.location.lat}, {store.location.lng}
              </Text>
            ) : null}

            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => onEdit(store)}
              >
                <Text style={styles.btnText}>Sửa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.selectBtn]}
                onPress={() => onSelect(store)}
              >
                <Text style={styles.btnText}>Chọn</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.deleteBtn]}
                onPress={() => onDelete(store._id)}
              >
                <Text style={styles.btnText}>Xóa</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
            >
              <Text style={styles.btnTextCancel}>Đóng</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  container: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    maxHeight: "80%",
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  field: { fontSize: 14, marginBottom: 8, color: "#374151" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  btn: { flex: 1, padding: 10, borderRadius: 8, marginHorizontal: 4 },
  primaryBtn: { backgroundColor: "#0b84ff" },
  selectBtn: { backgroundColor: "#10b981" },
  deleteBtn: { backgroundColor: "#ef4444" },
  cancelBtn: { backgroundColor: "#e5e7eb", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  btnTextCancel: { color: "#111827", fontWeight: "700", textAlign: "center" },
});
