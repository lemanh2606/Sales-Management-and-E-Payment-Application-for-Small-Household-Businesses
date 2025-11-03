// src/components/store/StoreDetailModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
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
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Store Image */}
            {store.imageUrl ? (
              <Image source={{ uri: store.imageUrl }} style={styles.image} />
            ) : null}

            {/* Store Name */}
            <Text style={styles.title}>{store.name}</Text>

            {/* Address & Phone */}
            {store.address ? (
              <Text style={styles.field}>🏠 Địa chỉ: {store.address}</Text>
            ) : null}
            {store.phone ? (
              <Text style={styles.field}>📞 Điện thoại: {store.phone}</Text>
            ) : null}

            {/* Description */}
            {store.description ? (
              <Text style={styles.field}>📝 Mô tả: {store.description}</Text>
            ) : null}

            {/* Tags */}
            {store.tags?.length ? (
              <Text style={styles.field}>🏷️ Tags: {store.tags.join(", ")}</Text>
            ) : null}

            {/* Opening Hours */}
            {store.openingHours ? (
              <Text style={styles.field}>
                ⏰ Giờ hoạt động: {store.openingHours.open} -{" "}
                {store.openingHours.close}
              </Text>
            ) : null}

            {/* Location */}
            {store.location ? (
              <Text style={styles.field}>
                📍 Vị trí: {store.location.lat}, {store.location.lng}
              </Text>
            ) : null}

            {/* Default & Deleted */}
            {store.isDefault !== undefined && (
              <Text style={styles.field}>
                ⭐ Mặc định: {store.isDefault ? "Có" : "Không"}
              </Text>
            )}
            {store.deleted !== undefined && store.deleted && (
              <Text style={[styles.field, { color: "#ef4444" }]}>
                ⚠️ Đã xóa
              </Text>
            )}

            {/* Created / Updated */}
            {store.createdAt && (
              <Text style={styles.field}>
                🕒 Tạo: {new Date(store.createdAt).toLocaleString()}
              </Text>
            )}
            {store.updatedAt && (
              <Text style={styles.field}>
                🕒 Cập nhật: {new Date(store.updatedAt).toLocaleString()}
              </Text>
            )}

            {/* Action Buttons */}
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
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    maxHeight: "85%",
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },
  field: { fontSize: 14, marginBottom: 8, color: "#374151" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  primaryBtn: { backgroundColor: "#0b84ff" },
  selectBtn: { backgroundColor: "#10b981" },
  deleteBtn: { backgroundColor: "#ef4444" },
  cancelBtn: {
    backgroundColor: "#e5e7eb",
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  btnTextCancel: { color: "#111827", fontWeight: "700", textAlign: "center" },
});
