// src/components/product/ProductGroupFormModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import apiClient from "../../api/apiClient";
import { ProductGroup } from "../../type/productGroup";
import { Ionicons } from "@expo/vector-icons";

interface ProductGroupFormModalProps {
  open: boolean;
  group?: ProductGroup | null;
  onClose: () => void;
  onSaved: () => void;
  storeId: string;
}

const ProductGroupFormModal: React.FC<ProductGroupFormModalProps> = ({
  open,
  group,
  onClose,
  onSaved,
  storeId,
}) => {
  const [name, setName] = useState<string>(group?.name || "");
  const [description, setDescription] = useState<string>(
    group?.description || ""
  );
  const [loading, setLoading] = useState(false);

  // Reset form khi mở modal hoặc group thay đổi
  useEffect(() => {
    if (open) {
      setName(group?.name || "");
      setDescription(group?.description || "");
    }
  }, [open, group]);

  const handleSave = async () => {
    // Validate dữ liệu
    if (!name.trim()) {
      Alert.alert("Lỗi", "Tên nhóm sản phẩm không được để trống");
      return;
    }

    if (name.trim().length < 2) {
      Alert.alert("Lỗi", "Tên nhóm sản phẩm phải có ít nhất 2 ký tự");
      return;
    }

    try {
      setLoading(true);

      const groupData = {
        name: name.trim(),
        description: description.trim(),
      };

      console.log("Saving product group:", {
        isEdit: !!group?._id,
        groupId: group?._id,
        storeId,
        data: groupData,
      });

      if (group?._id) {
        // Cập nhật nhóm sản phẩm đã tồn tại
        await apiClient.put(`/product-groups/${group._id}`, groupData);
      } else {
        // Tạo nhóm sản phẩm mới
        await apiClient.post(`/product-groups/store/${storeId}`, groupData);
      }

      // Thông báo thành công
      Alert.alert(
        "Thành công",
        group?._id ? "Đã cập nhật nhóm sản phẩm" : "Đã tạo nhóm sản phẩm mới",
        [{ text: "OK" }]
      );

      onSaved();
      handleClose();
    } catch (error: any) {
      console.error("Lỗi khi lưu nhóm sản phẩm:", error);

      // Xử lý lỗi chi tiết từ API
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể lưu nhóm sản phẩm. Vui lòng thử lại.";

      Alert.alert("Lỗi", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const isFormValid = name.trim().length >= 2;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {group?._id
                  ? "Chỉnh sửa nhóm sản phẩm"
                  : "Thêm nhóm sản phẩm mới"}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Tên nhóm sản phẩm */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Tên nhóm sản phẩm <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    !isFormValid && name.length > 0 && styles.inputError,
                  ]}
                  placeholder="Nhập tên nhóm sản phẩm..."
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                  editable={!loading}
                />
                {!isFormValid && name.length > 0 && (
                  <Text style={styles.errorText}>
                    Tên nhóm phải có ít nhất 2 ký tự
                  </Text>
                )}
                <Text style={styles.charCount}>{name.length}/100 ký tự</Text>
              </View>

              {/* Mô tả nhóm */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mô tả nhóm</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Nhập mô tả cho nhóm sản phẩm (tùy chọn)..."
                  placeholderTextColor="#999"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={500}
                  editable={!loading}
                />
                <Text style={styles.charCount}>
                  {description.length}/500 ký tự
                </Text>
              </View>

              {/* Thông tin thống kê (chỉ hiển thị khi chỉnh sửa) */}
              {group?._id && (
                <View style={styles.statsContainer}>
                  <Text style={styles.statsTitle}>Thông tin nhóm</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Số sản phẩm:</Text>
                    <Text style={styles.statsValue}>
                      {group.productCount || 0}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Ngày tạo:</Text>
                    <Text style={styles.statsValue}>
                      {new Date(group.createdAt).toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Cập nhật:</Text>
                    <Text style={styles.statsValue}>
                      {new Date(group.updatedAt).toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>
                  Hủy bỏ
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  (!isFormValid || loading) && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={!isFormValid || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={group?._id ? "refresh" : "add-circle"}
                      size={20}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.buttonText}>
                      {group?._id ? "Cập nhật" : "Tạo nhóm"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ProductGroupFormModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#fff",
    borderRadius: 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2e7d32",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#d32f2f",
  },
  input: {
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#d32f2f",
    backgroundColor: "#fef7f7",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 4,
  },
  statsContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  statsLabel: {
    fontSize: 14,
    color: "#666",
  },
  statsValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2e7d32",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#666",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2e7d32",
    shadowColor: "#2e7d32",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    backgroundColor: "#a5d6a7",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  buttonIcon: {
    marginRight: 8,
  },
});
