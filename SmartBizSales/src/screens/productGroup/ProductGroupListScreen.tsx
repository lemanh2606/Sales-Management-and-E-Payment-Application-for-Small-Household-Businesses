// src/screens/productGroup/ProductGroupListScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  onEdit: () => void;
  onDelete: () => void;
}> = ({ group, onEdit, onDelete }) => {
  const productCount = group.productCount || 0;
  const createdDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString("vi-VN")
    : "N/A";

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupMainRow}>
        <LinearGradient
          colors={["#10b981", "#059669"]}
          style={styles.groupIconCircle}
        >
          <Ionicons name="layers" size={24} color="#fff" />
        </LinearGradient>

        <View style={styles.groupContent}>
          <View style={styles.groupTitleRow}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{productCount} SP</Text>
            </View>
          </View>

          <Text style={styles.groupDesc} numberOfLines={2}>
            {group.description || "Không có mô tả cho nhóm này"}
          </Text>

          <View style={styles.groupFooter}>
            <View style={styles.metaInfo}>
              <Ionicons name="calendar-outline" size={12} color="#94a3b8" />
              <Text style={styles.metaText}>{createdDate}</Text>
            </View>
            <View style={styles.metaDivider} />
            <Text style={styles.metaText}>ID: {group._id.slice(-6).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.groupActionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={18} color="#2563eb" />
          <Text style={[styles.actionBtnText, { color: "#2563eb" }]}>Chỉnh sửa</Text>
        </TouchableOpacity>
        <View style={styles.actionDivider} />
        <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
          <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Xóa nhóm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ========== MAIN COMPONENT ==========
const ProductGroupListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  // Animation values for Collapsible Header
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const [headerVisible, setHeaderVisible] = useState(true);

  const HEADER_HEIGHT = 160 + insets.top;

  useEffect(() => {
    const listener = scrollY.addListener(({ value }: { value: number }) => {
      const diff = value - lastScrollY.current;
      lastScrollY.current = value;

      if (value < 50) {
        // Show header when near top
        Animated.timing(headerTranslate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
        setHeaderVisible(true);
        return;
      }

      if (diff > 5) {
        // Scroll down - hide header
        if (headerVisible) {
          Animated.timing(headerTranslate, {
            toValue: -HEADER_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start();
          setHeaderVisible(false);
        }
      } else if (diff < -5) {
        // Scroll up - show header
        if (!headerVisible) {
          Animated.timing(headerTranslate, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
          setHeaderVisible(true);
        }
      }
    });

    return () => scrollY.removeListener(listener);
  }, [headerVisible, HEADER_HEIGHT]);

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
      {/* Animated Collapsible Header */}
      <Animated.View
        style={[
          styles.collapsibleHeader,
          {
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslate }],
            paddingTop: insets.top,
          },
        ]}
      >
        <LinearGradient
          colors={["#10b981", "#059669"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Nhóm hàng hóa</Text>
            <Text style={styles.headerSubtitle}>
              Quản lý {groups.length} nhóm và {totalProducts} sản phẩm
            </Text>
          </View>
          <TouchableOpacity style={styles.headerAddBtn} onPress={handleAdd}>
            <Ionicons name="add" size={28} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
        >
          <StatCard title="TB SP" value={avgProducts} icon="stats-chart" color="rgba(255,255,255,0.2)" />
          <StatCard title="Max SP" value={maxProducts} icon="trophy" color="rgba(255,255,255,0.2)" />
          <StatCard title="Tổng nhóm" value={groups.length} icon="apps" color="rgba(255,255,255,0.2)" />
        </ScrollView>
      </Animated.View>

      {/* Floating Action Bar (Search) - Remains sticky but moves with header if desired, or stay fixed */}
      <Animated.View style={[
        styles.stickySearch,
        {
          top: HEADER_HEIGHT - 30, // Positioned overlapping the header bottom
          transform: [{ translateY: headerTranslate }],
        }
      ]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên hoặc mô tả..."
            placeholderTextColor="#94a3b8"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* List */}
      <Animated.FlatList
        data={filteredGroups}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: HEADER_HEIGHT + 35 } // offset for header + search
        ]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10b981"]}
            progressViewOffset={HEADER_HEIGHT}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="file-tray-outline" size={60} color="#e2e8f0" />
            </View>
            <Text style={styles.emptyTitle}>
              {search ? "Không tìm thấy kết quả" : "Chưa có nhóm hàng hóa"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search ? "Thử tìm kiếm với từ khóa khác" : "Bắt đầu bằng cách tạo nhóm hàng hóa đầu tiên của bạn"}
            </Text>
            {!search && (
              <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAdd}>
                <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.emptyAddBtnText}>Tạo nhóm mới</Text>
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
    backgroundColor: "#fff",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748b", fontWeight: "600" },

  // Collapsible Header
  collapsibleHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: "hidden",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 15,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  headerAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsScroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  statCard: {
    minWidth: 110,
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  statTitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
    marginTop: 2,
  },

  // Sticky Search
  stickySearch: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  groupMainRow: {
    flexDirection: "row",
    gap: 16,
  },
  groupIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  groupContent: {
    flex: 1,
  },
  groupTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
  },
  groupDesc: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 12,
  },
  groupFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  groupActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  actionDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#f1f5f9",
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyAddBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  formContainer: { padding: 24 },
  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
    marginTop: 16,
  },
  required: { color: "#ef4444" },
  formInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  formInputText: { flex: 1, marginLeft: 12, fontSize: 16, color: "#0f172a", fontWeight: "500" },
  formTextArea: { height: 120, paddingTop: 16, alignItems: "flex-start" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    marginHorizontal: 24,
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  saveBtnDisabled: { backgroundColor: "#cbd5e1" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
