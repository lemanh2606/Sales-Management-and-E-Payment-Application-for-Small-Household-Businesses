// src/screens/productGroup/ProductGroupListScreen.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import * as productGroupApi from "../../api/productGroupApi";
import type { ProductGroup } from "../../type/productGroup";

// ========== SUB-COMPONENTS ==========
interface StatCardProps {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <View style={styles.statIconCircle}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
};

const GroupCard: React.FC<{
  group: ProductGroup;
  maxProducts: number;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ group, maxProducts, onEdit, onDelete }) => {
  const productCount = group.productCount || 0;
  const progress = maxProducts > 0 ? (productCount / maxProducts) * 100 : 0;
  const createdDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString("vi-VN")
    : "N/A";

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <View style={styles.groupIconCircle}>
          <Ionicons name="apps" size={28} color="#fff" />
        </View>
        <View style={styles.groupBadge}>
          <Text style={styles.groupBadgeText}>{productCount}</Text>
        </View>
      </View>

      <Text style={styles.groupLabel}>TÊN NHÓM</Text>
      <Text style={styles.groupName} numberOfLines={2}>
        {group.name}
      </Text>

      <Text style={styles.groupLabel}>MÔ TẢ</Text>
      <Text style={styles.groupDesc} numberOfLines={3}>
        {group.description || "Không có mô tả"}
      </Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Số lượng SP</Text>
          <Text style={styles.progressValue}>{productCount} SP</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.groupMeta}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color="#9ca3af" />
          <Text style={styles.metaText}>Tạo: {createdDate}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color="#9ca3af"
          />
          <Text style={styles.metaText} numberOfLines={1}>
            ID: {group._id.slice(-8)}
          </Text>
        </View>
      </View>

      <View style={styles.groupActions}>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={18} color="#10b981" />
          <Text style={styles.editBtnText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ========== MAIN COMPONENT ==========
const ProductGroupListScreen: React.FC = () => {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  // Modal states
  const [formModalVisible, setFormModalVisible] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<ProductGroup | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
  }>({
    name: "",
    description: "",
  });
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async (): Promise<void> => {
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const store = storeStr ? JSON.parse(storeStr) : null;
      const storeId = store?._id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy cửa hàng");
        setLoading(false);
        return;
      }

      // ✅ Dùng API có sẵn với params
      const response = await productGroupApi.getProductGroupsByStore(storeId, {
        page: 1,
        limit: 100,
      });

      const data = response.productGroups || [];
      console.log("✅ Loaded", data.length, "product groups");
      console.log("Total:", response.total);
      setGroups(data);
    } catch (error: any) {
      console.error("Fetch groups error:", error?.message || error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể tải danh sách nhóm sản phẩm"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleAdd = () => {
    setEditingGroup(null);
    setFormData({ name: "", description: "" });
    setFormModalVisible(true);
  };

  const handleEdit = (group: ProductGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
    });
    setFormModalVisible(true);
  };

  const handleDelete = (group: ProductGroup) => {
    const productCount = group.productCount || 0;
    Alert.alert(
      "Xóa nhóm sản phẩm",
      `Bạn có chắc muốn xóa nhóm "${group.name}"?${
        productCount > 0
          ? `\n\n⚠️ Nhóm này đang có ${productCount} sản phẩm. Các sản phẩm sẽ không bị xóa nhưng sẽ không còn thuộc nhóm này.`
          : ""
      }`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await productGroupApi.deleteProductGroup(group._id);
              Alert.alert("Thành công", "Đã xóa nhóm sản phẩm");
              fetchGroups();
            } catch (error: any) {
              console.error("Delete error:", error?.message || error);
              Alert.alert(
                "Lỗi",
                error?.response?.data?.message ||
                  error?.message ||
                  "Không thể xóa nhóm sản phẩm"
              );
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Lỗi", "Tên nhóm không được để trống");
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

      if (editingGroup) {
        // ✅ UPDATE - Dùng API có sẵn
        await productGroupApi.updateProductGroup(editingGroup._id, {
          name: formData.name,
          description: formData.description,
        });
        Alert.alert("Thành công", "Cập nhật nhóm sản phẩm thành công");
      } else {
        // ✅ CREATE - Dùng API có sẵn
        await productGroupApi.createProductGroup(storeId, {
          name: formData.name,
          description: formData.description,
        });
        Alert.alert("Thành công", "Thêm nhóm sản phẩm thành công");
      }

      setFormModalVisible(false);
      fetchGroups();
    } catch (error: any) {
      console.error("Save error:", error?.message || error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể lưu nhóm sản phẩm"
      );
    } finally {
      setSaving(false);
    }
  };

  // Filter by search
  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalProducts = groups.reduce(
    (sum, g) => sum + (g.productCount || 0),
    0
  );
  const avgProducts =
    groups.length > 0 ? (totalProducts / groups.length).toFixed(1) : "0";
  const maxProducts =
    groups.length > 0 ? Math.max(...groups.map((g) => g.productCount || 0)) : 0;

  const renderItem = ({ item }: { item: ProductGroup }) => (
    <GroupCard
      group={item}
      maxProducts={maxProducts}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Đang tải nhóm sản phẩm...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerGradient}>
        <Text style={styles.headerTitle}>📦 Nhóm sản phẩm</Text>
        <Text style={styles.headerSubtitle}>
          Tổ chức và phân loại sản phẩm dễ dàng
        </Text>
      </View>

      {/* Stats */}
      {groups.length > 0 && (
        <View style={styles.statsContainer}>
          <StatCard
            title="Tổng nhóm"
            value={groups.length}
            icon="apps"
            color="#10b981"
          />
          <StatCard
            title="Tổng SP"
            value={totalProducts}
            icon="cube"
            color="#3b82f6"
          />
          <StatCard
            title="TB SP/nhóm"
            value={avgProducts}
            icon="bar-chart"
            color="#f59e0b"
          />
          <StatCard
            title="Max SP"
            value={maxProducts}
            icon="trophy"
            color="#ef4444"
          />
        </View>
      )}

      {/* Search & Add */}
      <View style={styles.actionBar}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm nhóm..."
            placeholderTextColor="#9ca3af"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10b981"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="apps-outline" size={64} color="#e5e7eb" />
            <Text style={styles.emptyText}>
              {search ? "Không tìm thấy nhóm" : "Chưa có nhóm sản phẩm"}
            </Text>
            {!search && (
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAdd}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.emptyBtnText}>Tạo nhóm đầu tiên</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Form Modal */}
      <Modal visible={formModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGroup ? "Cập nhật nhóm" : "Thêm nhóm mới"}
              </Text>
              <TouchableOpacity onPress={() => setFormModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formContainer}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formLabel}>
                Tên nhóm <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.formInput}>
                <Ionicons name="apps-outline" size={20} color="#6b7280" />
                <TextInput
                  style={styles.formInputText}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                  placeholder="Nhập tên nhóm"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <Text style={styles.formLabel}>Mô tả</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholder="Nhập mô tả nhóm sản phẩm..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {editingGroup ? "Cập nhật" : "Thêm mới"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ProductGroupListScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b" },
  headerGradient: {
    backgroundColor: "#10b981",
    padding: 24,
    paddingTop: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)" },
  statsContainer: { flexDirection: "row", padding: 16, gap: 10 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  statIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 3,
  },
  statTitle: { fontSize: 11, color: "#fff", fontWeight: "600", opacity: 0.9 },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  listContent: { padding: 8, paddingBottom: 24 },
  columnWrapper: { gap: 12, paddingHorizontal: 8 },
  groupCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  groupIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  groupBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  groupBadgeText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    minHeight: 40,
  },
  groupDesc: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 14,
    minHeight: 54,
    lineHeight: 18,
  },
  progressContainer: { marginBottom: 14 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 11, fontWeight: "600", color: "#9ca3af" },
  progressValue: { fontSize: 13, fontWeight: "700", color: "#10b981" },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#10b981", borderRadius: 4 },
  groupMeta: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 6,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, color: "#6b7280", flex: 1 },
  groupActions: { flexDirection: "row", gap: 10 },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#10b981",
    backgroundColor: "#ecfdf5",
  },
  editBtnText: { fontSize: 14, fontWeight: "700", color: "#10b981" },
  deleteBtn: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1.5,
    borderColor: "#ef4444",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  formContainer: { padding: 20 },
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
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  formInputText: { flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" },
  formTextArea: { paddingTop: 12, minHeight: 120 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveBtnDisabled: { backgroundColor: "#9ca3af" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
