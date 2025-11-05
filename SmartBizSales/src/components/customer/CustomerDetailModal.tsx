// src/components/customer/CustomerDetailModal.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Linking,
} from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import { Customer } from "../../type/customer";

interface CustomerDetailModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  open,
  onClose,
  customer,
  onEdit,
  onDelete,
}) => {
  if (!customer) return null;

  const handleCall = () => {
    Linking.openURL(`tel:${customer.phone}`);
  };

  const handleSMS = () => {
    Linking.openURL(`sms:${customer.phone}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Thông tin khách hàng:\nTên: ${customer.name}\nSĐT: ${
          customer.phone
        }${customer.address ? `\nĐịa chỉ: ${customer.address}` : ""}`,
        title: "Thông tin khách hàng",
      });
    } catch (error) {
      console.error("Lỗi khi chia sẻ:", error);
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit(customer);
  };

  const handleDelete = () => {
    onClose();
    setTimeout(() => {
      Alert.alert(
        "Xác nhận xóa",
        `Bạn có chắc muốn xóa khách hàng "${customer.name}"?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xóa",
            style: "destructive",
            onPress: () => onDelete(customer._id),
          },
        ]
      );
    }, 300);
  };

  const formatCurrency = (amount: number | object): string => {
    const value =
      typeof amount === "object" ? parseFloat(amount.toString()) : amount;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Modal
      isVisible={open}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
    >
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#3b82f6" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.customerName} numberOfLines={2}>
                {customer.name}
              </Text>
              <Text style={styles.customerPhone}>{customer.phone}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#3b82f6" />
              <Text style={styles.actionText}>Gọi</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleSMS}>
              <Ionicons name="chatbubble" size={20} color="#10b981" />
              <Text style={styles.actionText}>Nhắn tin</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#f59e0b" />
              <Text style={styles.actionText}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>

          {/* Thông tin cơ bản */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>

            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={18} color="#64748b" />
              <Text style={styles.infoLabel}>Số điện thoại:</Text>
              <Text style={styles.infoValue}>{customer.phone}</Text>
            </View>

            {customer.address && (
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={18} color="#64748b" />
                <Text style={styles.infoLabel}>Địa chỉ:</Text>
                <Text style={styles.infoValue} numberOfLines={3}>
                  {customer.address}
                </Text>
              </View>
            )}

            {customer.note && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#64748b"
                />
                <Text style={styles.infoLabel}>Ghi chú:</Text>
                <Text style={styles.infoValue} numberOfLines={4}>
                  {customer.note}
                </Text>
              </View>
            )}
          </View>

          {/* Thống kê */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thống kê mua hàng</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: "#dbeafe" }]}>
                  <Ionicons name="cart-outline" size={20} color="#3b82f6" />
                </View>
                <Text style={styles.statNumber}>{customer.totalOrders}</Text>
                <Text style={styles.statLabel}>Tổng đơn hàng</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: "#dcfce7" }]}>
                  <Ionicons name="cash-outline" size={20} color="#10b981" />
                </View>
                <Text style={styles.statNumber}>
                  {formatCurrency(customer.totalSpent)}
                </Text>
                <Text style={styles.statLabel}>Tổng chi tiêu</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: "#fef3c7" }]}>
                  <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
                </View>
                <Text style={styles.statNumber}>{customer.loyaltyPoints}</Text>
                <Text style={styles.statLabel}>Điểm tích lũy</Text>
              </View>
            </View>
          </View>

          {/* Thông tin hệ thống */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin hệ thống</Text>

            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={18} color="#64748b" />
              <Text style={styles.infoLabel}>Ngày tạo:</Text>
              <Text style={styles.infoValue}>
                {formatDate(customer.createdAt)}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={18} color="#64748b" />
              <Text style={styles.infoLabel}>Cập nhật:</Text>
              <Text style={styles.infoValue}>
                {formatDate(customer.updatedAt)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.actionButtonLarge, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteButtonText}>Xóa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButtonLarge, styles.editButton]}
            onPress={handleEdit}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.editButtonText}>Sửa thông tin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
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
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 16,
    color: "#64748b",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    maxHeight: 500,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  actionButton: {
    alignItems: "center",
    padding: 12,
  },
  actionText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    marginLeft: 8,
    marginRight: 8,
    minWidth: 80,
  },
  infoValue: {
    fontSize: 14,
    color: "#1e293b",
    flex: 1,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  editButton: {
    backgroundColor: "#3b82f6",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CustomerDetailModal;
