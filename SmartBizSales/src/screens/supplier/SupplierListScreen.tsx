// src/screens/supplier/SupplierListScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import API và Types
import * as supplierApi from "../../api/supplierApi";
import type {
  Supplier,
  CreateSupplierData,
  UpdateSupplierData,
} from "../../type/supplier";

const { width, height } = Dimensions.get("window");

// ========== SUB-COMPONENTS ==========
interface StatCardProps {
  title: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string, ...string[]];
  trend?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  gradient,
  trend,
}) => {
  return (
    <LinearGradient colors={gradient} style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={styles.statIconCircle}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        {trend !== undefined && (
          <View
            style={[
              styles.trendBadge,
              { backgroundColor: trend >= 0 ? "#10b98120" : "#ef444420" },
            ]}
          >
            <Ionicons
              name={trend >= 0 ? "trending-up" : "trending-down"}
              size={12}
              color={trend >= 0 ? "#10b981" : "#ef4444"}
            />
            <Text
              style={[
                styles.trendText,
                { color: trend >= 0 ? "#10b981" : "#ef4444" },
              ]}
            >
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value.toLocaleString("vi-VN")}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </LinearGradient>
  );
};

const SupplierCard: React.FC<{
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
}> = ({ supplier, onEdit, onDelete, onView }) => {
  const isActive = supplier.status === "đang hoạt động";
  const scaleAnim = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.supplierCard}
        onPress={onView}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={styles.supplierHeader}>
          <View style={styles.supplierInfoMain}>
            <View style={styles.supplierAvatar}>
              <LinearGradient
                colors={
                  isActive ? ["#10b981", "#059669"] : ["#6b7280", "#4b5563"]
                }
                style={styles.avatarGradient}
              >
                <Text style={styles.avatarText}>
                  {supplier.name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.supplierDetails}>
              <Text style={styles.supplierName} numberOfLines={1}>
                {supplier.name}
              </Text>
              <View style={styles.supplierMeta}>
                <View
                  style={[
                    styles.statusBadge,
                    isActive ? styles.statusActive : styles.statusInactive,
                  ]}
                >
                  <Ionicons
                    name={isActive ? "checkmark-circle" : "close-circle"}
                    size={12}
                    color="#fff"
                  />
                  <Text style={styles.statusText}>
                    {isActive ? "Hoạt động" : "Ngừng"}
                  </Text>
                </View>
                {supplier.phone && (
                  <Text style={styles.phoneText}>• {supplier.phone}</Text>
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.menuBtn} onPress={onView}>
            <Ionicons name="ellipsis-vertical" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {(supplier.email || supplier.address) && (
          <View style={styles.supplierExtraInfo}>
            {supplier.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={14} color="#6b7280" />
                <Text style={styles.infoText} numberOfLines={1}>
                  {supplier.email}
                </Text>
              </View>
            )}
            {supplier.address && (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text style={styles.infoText} numberOfLines={2}>
                  {supplier.address}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.supplierActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.viewBtn]}
            onPress={onView}
          >
            <Ionicons name="eye-outline" size={16} color="#3b82f6" />
            <Text style={[styles.actionText, { color: "#3b82f6" }]}>Xem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={onEdit}
          >
            <Ionicons name="create-outline" size={16} color="#f59e0b" />
            <Text style={[styles.actionText, { color: "#f59e0b" }]}>Sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DetailModal: React.FC<{
  visible: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ visible, supplier, onClose, onEdit, onDelete }) => {
  if (!supplier) return null;

  const isActive = supplier.status === "đang hoạt động";

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.detailModalOverlay}>
        <View style={styles.detailModalContent}>
          {/* Header */}
          <LinearGradient
            colors={isActive ? ["#10b981", "#059669"] : ["#6b7280", "#4b5563"]}
            style={styles.detailHeader}
          >
            <View style={styles.detailHeaderTop}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.detailTitle}>Chi tiết NCC</Text>
              <View style={styles.detailActions}>
                <TouchableOpacity
                  onPress={onEdit}
                  style={styles.detailActionBtn}
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onDelete}
                  style={styles.detailActionBtn}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.supplierHero}>
              <View style={styles.detailAvatar}>
                <Text style={styles.detailAvatarText}>
                  {supplier.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.detailName}>{supplier.name}</Text>
              <View
                style={[
                  styles.detailStatus,
                  isActive
                    ? styles.detailStatusActive
                    : styles.detailStatusInactive,
                ]}
              >
                <Ionicons
                  name={isActive ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.detailStatusText}>{supplier.status}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.detailContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Thông tin liên hệ</Text>

              {supplier.phone && (
                <View style={styles.detailItem}>
                  <View style={styles.detailItemIcon}>
                    <Ionicons name="call-outline" size={20} color="#3b82f6" />
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Số điện thoại</Text>
                    <Text style={styles.detailItemValue}>{supplier.phone}</Text>
                  </View>
                </View>
              )}

              {supplier.email && (
                <View style={styles.detailItem}>
                  <View style={styles.detailItemIcon}>
                    <Ionicons name="mail-outline" size={20} color="#ef4444" />
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemLabel}>Email</Text>
                    <Text style={styles.detailItemValue}>{supplier.email}</Text>
                  </View>
                </View>
              )}
            </View>

            {supplier.address && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Địa chỉ</Text>
                <View style={styles.detailItem}>
                  <View style={styles.detailItemIcon}>
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color="#10b981"
                    />
                  </View>
                  <View style={styles.detailItemContent}>
                    <Text style={styles.detailItemValue}>
                      {supplier.address}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Thông tin khác</Text>
              <View style={styles.statsGrid}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>12</Text>
                  <Text style={styles.miniStatLabel}>Đơn hàng</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>₫125M</Text>
                  <Text style={styles.miniStatLabel}>Tổng giá trị</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatValue}>98%</Text>
                  <Text style={styles.miniStatLabel}>Tỷ lệ thành công</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ========== MAIN COMPONENT ==========
const SupplierListScreen: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  // Modal states
  const [formModalVisible, setFormModalVisible] = useState<boolean>(false);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<CreateSupplierData>({
    name: "",
    phone: "",
    email: "",
    address: "",
    status: "đang hoạt động",
  });
  const [saving, setSaving] = useState<boolean>(false);

  // Animation
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredSuppliers(suppliers);
      return;
    }
    const query = search.toLowerCase().trim();
    const filtered = suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
    );
    setFilteredSuppliers(filtered);
  }, [search, suppliers]);

  const fetchSuppliers = async (): Promise<void> => {
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const store = storeStr ? JSON.parse(storeStr) : null;
      const storeId = store?._id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy cửa hàng");
        setLoading(false);
        return;
      }

      const response = await supplierApi.getSuppliers(storeId);
      const data = response.suppliers || [];
      console.log("✅ Loaded", data.length, "suppliers");
      setSuppliers(data);
      setFilteredSuppliers(data);
    } catch (error: any) {
      console.error("Fetch suppliers error:", error?.message || error);
      Alert.alert(
        "Lỗi",
        error?.message || "Không thể tải danh sách nhà cung cấp"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSuppliers();
  };

  const handleAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      address: "",
      status: "đang hoạt động",
    });
    setFormModalVisible(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      status: supplier.status,
    });
    setFormModalVisible(true);
  };

  const handleDelete = (supplier: Supplier) => {
    Alert.alert(
      "Xóa nhà cung cấp",
      `Bạn có chắc muốn xóa "${supplier.name}"? Hành động này không thể hoàn tác.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await supplierApi.deleteSupplier(supplier._id);
              Alert.alert("Thành công", "Đã xóa nhà cung cấp");
              fetchSuppliers();
            } catch (error: any) {
              console.error("Delete error:", error?.message || error);
              Alert.alert(
                "Lỗi",
                error?.message || "Không thể xóa nhà cung cấp"
              );
            }
          },
        },
      ]
    );
  };

  const handleView = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDetailModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Lỗi", "Tên nhà cung cấp không được để trống");
      return;
    }

    setSaving(true);
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const store = storeStr ? JSON.parse(storeStr) : null;
      const storeId = store?._id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy ID cửa hàng");
        return;
      }

      if (editingSupplier) {
        const updateData: UpdateSupplierData = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          status: formData.status,
        };
        await supplierApi.updateSupplier(editingSupplier._id, updateData);
        Alert.alert("Thành công", "Cập nhật nhà cung cấp thành công");
      } else {
        await supplierApi.createSupplier(storeId, formData);
        Alert.alert("Thành công", "Thêm nhà cung cấp thành công");
      }

      setFormModalVisible(false);
      fetchSuppliers();
    } catch (error: any) {
      console.error("Save error:", error?.message || error);
      Alert.alert("Lỗi", error?.message || "Không thể lưu nhà cung cấp");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = filteredSuppliers.filter(
    (s) => s.status === "đang hoạt động"
  ).length;
  const inactiveCount = filteredSuppliers.length - activeCount;

  const renderItem = ({ item }: { item: Supplier }) => (
    <SupplierCard
      supplier={item}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
      onView={() => handleView(item)}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          style={styles.loadingCircle}
        >
          <ActivityIndicator size="large" color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>Đang tải nhà cung cấp...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header với gradient */}
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerContent}>
          {/* Stats */}
          <View style={styles.statsContainer}>
            <StatCard
              title="Tổng số"
              value={filteredSuppliers.length}
              icon="business"
              gradient={["#667eea", "#764ba2"]}
              trend={5.2}
            />
            <StatCard
              title="Hoạt động"
              value={activeCount}
              icon="checkmark-circle"
              gradient={["#43e97b", "#38f9d7"]}
              trend={12.5}
            />
            <StatCard
              title="Ngừng"
              value={inactiveCount}
              icon="close-circle"
              gradient={["#f093fb", "#f5576c"]}
              trend={-2.1}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Search & Add */}
      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm nhà cung cấp..."
            placeholderTextColor="#9ca3af"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <LinearGradient
            colors={["#10b981", "#059669"]}
            style={styles.addBtnGradient}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#667eea"]}
            tintColor="#667eea"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <LinearGradient
              colors={["#f8fafc", "#e2e8f0"]}
              style={styles.emptyIcon}
            >
              <Ionicons name="business-outline" size={48} color="#9ca3af" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {search ? "Không tìm thấy nhà cung cấp" : "Chưa có nhà cung cấp"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? "Thử tìm kiếm với từ khóa khác"
                : "Thêm nhà cung cấp đầu tiên của bạn"}
            </Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAdd}>
                <Text style={styles.emptyBtnText}>Thêm nhà cung cấp</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Detail Modal */}
      <DetailModal
        visible={detailModalVisible}
        supplier={selectedSupplier}
        onClose={() => setDetailModalVisible(false)}
        onEdit={() => {
          setDetailModalVisible(false);
          if (selectedSupplier) handleEdit(selectedSupplier);
        }}
        onDelete={() => {
          setDetailModalVisible(false);
          if (selectedSupplier) handleDelete(selectedSupplier);
        }}
      />

      {/* Form Modal */}
      <Modal visible={formModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              style={styles.modalHeader}
            >
              <Text style={styles.modalTitle}>
                {editingSupplier ? "Cập nhật NCC" : "Thêm NCC mới"}
              </Text>
              <TouchableOpacity
                onPress={() => setFormModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Thông tin cơ bản</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>
                    Tên nhà cung cấp <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.formInput}>
                    <Ionicons
                      name="business-outline"
                      size={20}
                      color="#6b7280"
                    />
                    <TextInput
                      style={styles.formInputText}
                      value={formData.name}
                      onChangeText={(text) =>
                        setFormData({ ...formData, name: text })
                      }
                      placeholder="Nhập tên nhà cung cấp"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Số điện thoại</Text>
                  <View style={styles.formInput}>
                    <Ionicons name="call-outline" size={20} color="#6b7280" />
                    <TextInput
                      style={styles.formInputText}
                      value={formData.phone}
                      onChangeText={(text) =>
                        setFormData({ ...formData, phone: text })
                      }
                      placeholder="Nhập số điện thoại"
                      placeholderTextColor="#9ca3af"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email</Text>
                  <View style={styles.formInput}>
                    <Ionicons name="mail-outline" size={20} color="#6b7280" />
                    <TextInput
                      style={styles.formInputText}
                      value={formData.email}
                      onChangeText={(text) =>
                        setFormData({ ...formData, email: text })
                      }
                      placeholder="Nhập email"
                      placeholderTextColor="#9ca3af"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Địa chỉ</Text>
                  <View style={[styles.formInput, styles.formTextArea]}>
                    <TextInput
                      style={[
                        styles.formInputText,
                        { textAlignVertical: "top" },
                      ]}
                      value={formData.address}
                      onChangeText={(text) =>
                        setFormData({ ...formData, address: text })
                      }
                      placeholder="Nhập địa chỉ"
                      placeholderTextColor="#9ca3af"
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Trạng thái</Text>
                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      formData.status === "đang hoạt động" &&
                        styles.statusButtonActive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, status: "đang hoạt động" })
                    }
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={
                        formData.status === "đang hoạt động"
                          ? "#fff"
                          : "#10b981"
                      }
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        formData.status === "đang hoạt động" &&
                          styles.statusButtonTextActive,
                      ]}
                    >
                      Đang hoạt động
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      formData.status === "ngừng hoạt động" &&
                        styles.statusButtonInactive,
                    ]}
                    onPress={() =>
                      setFormData({ ...formData, status: "ngừng hoạt động" })
                    }
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={
                        formData.status === "ngừng hoạt động"
                          ? "#fff"
                          : "#ef4444"
                      }
                    />
                    <Text
                      style={[
                        styles.statusButtonText,
                        formData.status === "ngừng hoạt động" &&
                          styles.statusButtonTextActive,
                      ]}
                    >
                      Ngừng hoạt động
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setFormModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient
                  colors={["#10b981", "#059669"]}
                  style={styles.saveBtnGradient}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.saveBtnText}>
                        {editingSupplier ? "Cập nhật" : "Thêm mới"}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "600",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
  },
  notificationBtn: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
    opacity: 0.9,
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#1e293b",
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  addBtnGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 20,
    paddingTop: 16,
  },
  supplierCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  supplierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  supplierInfoMain: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 12,
  },
  supplierAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  supplierDetails: {
    flex: 1,
  },
  supplierName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  supplierMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusActive: { backgroundColor: "#10b981" },
  statusInactive: { backgroundColor: "#ef4444" },
  statusText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
  },
  phoneText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  menuBtn: {
    padding: 4,
  },
  supplierExtraInfo: {
    gap: 6,
    marginBottom: 12,
    paddingLeft: 56, // Align with avatar
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#6b7280",
    flex: 1,
  },
  supplierActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Specific variants for action buttons (used in SupplierCard)
  viewBtn: {
    backgroundColor: "#eff6ff", // light blue background for view action
  },
  editBtn: {
    backgroundColor: "#fffbeb", // light amber background for edit action
  },
  deleteBtn: {
    backgroundColor: "#fff1f2", // light red/pink background for delete action
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  detailModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  detailHeader: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  detailHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  closeBtn: {
    padding: 4,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  detailActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailActionBtn: {
    padding: 8,
  },
  supplierHero: {
    alignItems: "center",
  },
  detailAvatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  detailAvatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  detailName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  detailStatus: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  detailStatusActive: { backgroundColor: "rgba(16, 185, 129, 0.9)" },
  detailStatusInactive: { backgroundColor: "rgba(239, 68, 68, 0.9)" },
  detailStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  detailContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  detailItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    fontWeight: "600",
  },
  detailItemValue: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  miniStat: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  miniStatLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },

  // Form Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  modalCloseBtn: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  required: { color: "#ef4444" },
  formInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formInputText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#1e293b",
  },
  formTextArea: {
    paddingTop: 12,
    minHeight: 100,
    alignItems: "flex-start",
  },
  statusButtons: {
    flexDirection: "row",
    gap: 12,
  },
  statusButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  statusButtonActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  statusButtonInactive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
  formActions: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  saveBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default SupplierListScreen;
