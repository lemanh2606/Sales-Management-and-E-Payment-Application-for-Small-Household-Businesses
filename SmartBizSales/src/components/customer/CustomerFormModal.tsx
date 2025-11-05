// src/components/customer/CustomerFormModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import { Customer, CustomerCreateData } from "../../type/customer";

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSave: (data: CustomerCreateData) => Promise<void>;
  storeId: string;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  onClose,
  customer,
  onSave,
  storeId,
}) => {
  const [formData, setFormData] = useState<CustomerCreateData>({
    name: "",
    phone: "",
    address: "",
    note: "",
    storeId: storeId,
    loyaltyPoints: 0,
    totalSpent: 0,
    totalOrders: 0,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Reset form khi mở modal
  useEffect(() => {
    if (open) {
      if (customer) {
        // Edit mode - điền dữ liệu hiện có
        setFormData({
          name: customer.name,
          phone: customer.phone,
          address: customer.address || "",
          note: customer.note || "",
          storeId: customer.storeId,
          loyaltyPoints: customer.loyaltyPoints,
          totalSpent:
            typeof customer.totalSpent === "object"
              ? parseFloat(customer.totalSpent.toString())
              : customer.totalSpent,
          totalOrders: customer.totalOrders,
        });
      } else {
        // Add mode - reset form
        setFormData({
          name: "",
          phone: "",
          address: "",
          note: "",
          storeId: storeId,
          loyaltyPoints: 0,
          totalSpent: 0,
          totalOrders: 0,
        });
      }
      setErrors({});
    }
  }, [open, customer, storeId]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên khách hàng là bắt buộc";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Số điện thoại là bắt buộc";
    } else if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(formData.phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }

    if (formData.address && formData.address.length > 255) {
      newErrors.address = "Địa chỉ không được vượt quá 255 ký tự";
    }

    if (formData.note && formData.note.length > 500) {
      newErrors.note = "Ghi chú không được vượt quá 500 ký tự";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error: any) {
      if (error.response?.status === 400) {
        // Xử lý lỗi duplicate phone
        if (error.response.data.message?.includes("số điện thoại")) {
          setErrors({ phone: "Số điện thoại đã tồn tại trong cửa hàng" });
        } else {
          Alert.alert("Lỗi", error.response.data.message || "Có lỗi xảy ra");
        }
      } else {
        Alert.alert("Lỗi", "Không thể lưu thông tin khách hàng");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof CustomerCreateData,
    value: string | number
  ) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error khi user bắt đầu nhập
    if (errors[field as any]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  return (
    <Modal
      isVisible={open}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
      avoidKeyboard
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {customer ? "Sửa thông tin khách hàng" : "Thêm khách hàng mới"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Tên khách hàng */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Tên khách hàng <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={(value) => handleInputChange("name", value)}
                placeholder="Nhập tên khách hàng"
                placeholderTextColor="#94a3b8"
              />
              {errors.name && (
                <Text style={styles.errorText}>{errors.name}</Text>
              )}
            </View>

            {/* Số điện thoại */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Số điện thoại <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                value={formData.phone}
                onChangeText={(value) => handleInputChange("phone", value)}
                placeholder="Nhập số điện thoại"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
              />
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* Địa chỉ */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Địa chỉ</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  errors.address && styles.inputError,
                ]}
                value={formData.address}
                onChangeText={(value) => handleInputChange("address", value)}
                placeholder="Nhập địa chỉ khách hàng"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {errors.address && (
                <Text style={styles.errorText}>{errors.address}</Text>
              )}
            </View>

            {/* Ghi chú */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Ghi chú</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  errors.note && styles.inputError,
                ]}
                value={formData.note}
                onChangeText={(value) => handleInputChange("note", value)}
                placeholder="Ghi chú về khách hàng (nợ, sở thích, v.v.)"
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.note && (
                <Text style={styles.errorText}>{errors.note}</Text>
              )}
            </View>

            {/* Thống kê (chỉ hiển thị khi edit) */}
            {customer && (
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>Thống kê</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Tổng đơn hàng</Text>
                    <TextInput
                      style={styles.statInput}
                      value={formData.totalOrders?.toString()}
                      onChangeText={(value) =>
                        handleInputChange("totalOrders", parseInt(value) || 0)
                      }
                      keyboardType="numeric"
                      editable={false} // Không cho phép sửa trực tiếp
                    />
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Tổng chi tiêu (₫)</Text>
                    <TextInput
                      style={styles.statInput}
                      value={formData.totalSpent?.toString()}
                      onChangeText={(value) =>
                        handleInputChange("totalSpent", parseFloat(value) || 0)
                      }
                      keyboardType="numeric"
                      editable={false}
                    />
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Điểm tích lũy</Text>
                    <TextInput
                      style={styles.statInput}
                      value={formData.loyaltyPoints?.toString()}
                      onChangeText={(value) =>
                        handleInputChange("loyaltyPoints", parseInt(value) || 0)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={customer ? "checkmark-circle" : "add-circle"}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.saveButtonText}>
                    {customer ? "Cập nhật" : "Thêm mới"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  required: {
    color: "#ef4444",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1e293b",
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#ef4444",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  statsSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  statsGrid: {
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
  },
  statInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#fff",
    width: 120,
    textAlign: "right",
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
  },
  cancelButtonText: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#3b82f6",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CustomerFormModal;
