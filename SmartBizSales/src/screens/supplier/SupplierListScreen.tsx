// src/screens/supplier/SupplierListScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

import * as supplierApi from "../../api/supplierApi";
import { SupplierExportButton } from "../../components/supplier/SupplierExportButton";
import type {
  Supplier,
  CreateSupplierData,
  UpdateSupplierData,
  SupplierStatus,
} from "../../type/supplier";

const { width } = Dimensions.get("window");

// ---------- helpers ----------
const normalizeId = (s: any): string => {
  if (!s) return "";
  if (typeof s === "string") return s;
  if (typeof s === "object" && s.$oid) return String(s.$oid);
  if (typeof s === "object" && typeof s.toString === "function")
    return String(s.toString());
  return String(s);
};

const normalizeSupplier = (s: any): Supplier => ({
  ...s,
  _id: normalizeId(s?._id || s?.id),
});

// ---------- sub-components ----------
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
}) => {
  return (
    <LinearGradient colors={gradient} style={styles.statCard}>
      <View style={styles.statIconCircle}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View>
        <Text style={styles.statValue}>{value.toLocaleString("vi-VN")}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </LinearGradient>
  );
};

const SupplierCard: React.FC<{
  supplier: Supplier;
  mode: "active" | "deleted";
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onView: () => void;
}> = ({ supplier, mode, onEdit, onDelete, onRestore, onView }) => {
  const isActive = supplier.status === "đang hoạt động";

  return (
    <TouchableOpacity
      onPress={onView}
      activeOpacity={0.7}
      style={styles.supplierCard}
    >
      <View style={styles.cardMain}>
        <LinearGradient
          colors={isActive ? ["#3b82f6", "#2563eb"] : ["#94a3b8", "#64748b"]}
          style={styles.supplierAvatar}
        >
          <Text style={styles.avatarText}>
            {supplier.name?.charAt(0)?.toUpperCase()}
          </Text>
        </LinearGradient>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.supplierName} numberOfLines={1}>
              {supplier.name}
            </Text>
            {isActive ? (
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>Active</Text>
              </View>
            ) : (
              <View style={styles.inactiveTag}>
                <Text style={styles.inactiveTagText}>Ngừng</Text>
              </View>
            )}
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call" size={14} color="#64748b" />
            <Text style={styles.infoText}>{supplier.phone || "—"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={14} color="#64748b" />
            <Text style={styles.infoText} numberOfLines={1}>
              {supplier.address || "—"}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onView} style={styles.viewMoreBtn}>
          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardActions}>
        {mode === "active" ? (
          <>
            <TouchableOpacity style={styles.actionItem} onPress={onEdit}>
              <Ionicons name="create-outline" size={16} color="#3b82f6" />
              <Text style={[styles.actionLabel, { color: "#3b82f6" }]}>Sửa</Text>
            </TouchableOpacity>
            <View style={styles.actionSeparator} />
            <TouchableOpacity style={styles.actionItem} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
              <Text style={[styles.actionLabel, { color: "#ef4444" }]}>Xóa</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.actionItem, { flex: 1 }]} onPress={onRestore}>
            <Ionicons name="refresh-outline" size={16} color="#10b981" />
            <Text style={[styles.actionLabel, { color: "#10b981" }]}>Khôi phục nhà cung cấp</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const DetailModal: React.FC<{
  visible: boolean;
  supplier: Supplier | null;
  mode: "active" | "deleted";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}> = ({ visible, supplier, mode, onClose, onEdit, onDelete, onRestore }) => {
  if (!supplier) return null;

  const isActive = supplier.status === "đang hoạt động";

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.detailOverlay}>
        <View style={styles.detailContent}>
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleBox}>
              <Text style={styles.detailTitle}>Chi tiết đối tác</Text>
              <TouchableOpacity onPress={onClose} style={styles.detailCloseBtn}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailHero}>
              <LinearGradient
                colors={isActive ? ["#3b82f6", "#2563eb"] : ["#94a3b8", "#64748b"]}
                style={styles.heroAvatar}
              >
                <Text style={styles.heroAvatarText}>
                  {supplier.name?.charAt(0)?.toUpperCase()}
                </Text>
              </LinearGradient>
              <Text style={styles.heroName}>{supplier.name}</Text>
              <View style={isActive ? styles.heroTagActive : styles.heroTagInactive}>
                <Text style={isActive ? styles.heroTagTextActive : styles.heroTagTextInactive}>
                  {isActive ? "Đang hoạt động" : "Ngừng giao dịch"}
                </Text>
              </View>
            </View>

            <View style={styles.detailInfoList}>
              <InfoItem icon="call-outline" label="Số điện thoại" value={supplier.phone || "Chưa cập nhật"} color="#3b82f6" />
              <InfoItem icon="mail-outline" label="Email" value={supplier.email || "Chưa cập nhật"} color="#6366f1" />
              <InfoItem icon="location-outline" label="Địa chỉ" value={supplier.address || "Chưa cập nhật"} color="#10b981" />
              <InfoItem icon="document-text-outline" label="Mã số thuế" value={supplier.taxcode || "Chưa cập nhật"} color="#f59e0b" />
              <InfoItem icon="chatbubble-outline" label="Ghi chú" value={supplier.notes || "Không có ghi chú"} color="#64748b" />
            </View>
          </ScrollView>

          <View style={styles.detailFooter}>
            <TouchableOpacity
              style={[styles.footerBtn, styles.editBtnActive]}
              onPress={() => { onClose(); onEdit(); }}
            >
              <Ionicons name="create" size={20} color="#fff" />
              <Text style={styles.footerBtnText}>Chỉnh sửa</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const InfoItem = ({ icon, label, value, color }: any) => (
  <View style={styles.detailInfoItem}>
    <View style={[styles.infoIconBox, { backgroundColor: color + "15" }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={styles.infoMeta}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// ---------- main ----------
const SupplierListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"active" | "deleted">("active");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");

  // Animation values for Collapsible Header
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const [headerVisible, setHeaderVisible] = useState(true);

  const HEADER_HEIGHT = 180 + insets.top;

  useEffect(() => {
    const listener = scrollY.addListener(({ value }: { value: number }) => {
      const diff = value - lastScrollY.current;
      lastScrollY.current = value;

      if (value < 50) {
        Animated.timing(headerTranslate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
        setHeaderVisible(true);
        return;
      }

      if (diff > 5) {
        if (headerVisible) {
          Animated.timing(headerTranslate, {
            toValue: -HEADER_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start();
          setHeaderVisible(false);
        }
      } else if (diff < -5) {
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

  // modal states
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

  useEffect(() => {
    fetchSuppliers(true);
  }, [mode]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredSuppliers(suppliers);
      return;
    }
    const q = search.toLowerCase().trim();
    setFilteredSuppliers(
      suppliers.filter((s) => {
        const name = (s.name || "").toLowerCase();
        const phone = (s.phone || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const address = (s.address || "").toLowerCase();
        return (
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          address.includes(q)
        );
      })
    );
  }, [search, suppliers]);

  const fetchSuppliers = async (silent = false): Promise<void> => {
    try {
      if (!silent) setLoading(true);

      const storeStr = await AsyncStorage.getItem("currentStore");
      const store = storeStr ? JSON.parse(storeStr) : null;
      const storeId: string | undefined = store?._id || store?.id;
      setStoreId(storeId || "");

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy ID cửa hàng");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await supplierApi.getSuppliers(storeId, {
        deleted: mode === "deleted",
      });
      const list = Array.isArray(res?.suppliers)
        ? res.suppliers.map(normalizeSupplier)
        : [];

      setSuppliers(list);
      setFilteredSuppliers(list);
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
    fetchSuppliers(true);
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
      name: supplier.name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      status: (supplier.status as SupplierStatus) || "đang hoạt động",
    });
    setFormModalVisible(true);
  };

  const handleDelete = (supplier: Supplier) => {
    const id = supplier._id;
    if (!id) return;

    Alert.alert(
      "Xóa nhà cung cấp",
      `Bạn có chắc muốn xóa "${supplier.name}"?\nHành động này là xóa mềm và có thể khôi phục.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await supplierApi.deleteSupplier(id);
              Alert.alert("Thành công", "Đã xóa nhà cung cấp");
              fetchSuppliers(true);
            } catch (error: any) {
              console.error("Delete error:", error?.message || error);
              Alert.alert(
                "Lỗi",
                error?.response?.data?.message ||
                  error?.message ||
                  "Không thể xóa nhà cung cấp"
              );
            }
          },
        },
      ]
    );
  };

  const handleRestore = (supplier: Supplier) => {
    const id = supplier._id;
    if (!id) return;

    Alert.alert("Khôi phục nhà cung cấp", `Khôi phục "${supplier.name}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Khôi phục",
        onPress: async () => {
          try {
            await supplierApi.restoreSupplier(id);
            Alert.alert("Thành công", "Đã khôi phục nhà cung cấp");
            fetchSuppliers(true);
          } catch (error: any) {
            console.error("Restore error:", error?.message || error);
            Alert.alert(
              "Lỗi",
              error?.response?.data?.message ||
                error?.message ||
                "Không thể khôi phục nhà cung cấp"
            );
          }
        },
      },
    ]);
  };

  const handleView = async (supplier: Supplier) => {
    try {
      const id = supplier._id;
      if (!id) return;

      // luôn fetch chi tiết để xem được cả NCC đã bị khóa/xóa
      const res = await supplierApi.getSupplierById(id);
      const detail = normalizeSupplier(res?.supplier || supplier);

      setSelectedSupplier(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      console.error("View detail error:", error?.message || error);
      // fallback: vẫn mở modal với dữ liệu hiện có
      setSelectedSupplier(supplier);
      setDetailModalVisible(true);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Lỗi", "Tên nhà cung cấp không được trống");
      return;
    }

    setSaving(true);
    try {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const store = storeStr ? JSON.parse(storeStr) : null;
      const storeId: string | undefined = store?._id || store?.id;

      if (!storeId) {
        Alert.alert("Lỗi", "Không tìm thấy ID cửa hàng");
        return;
      }

      if (editingSupplier) {
        const id = editingSupplier._id;
        const updateData: UpdateSupplierData = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          status: formData.status,
        };
        await supplierApi.updateSupplier(id, updateData);
        Alert.alert("Thành công", "Cập nhật nhà cung cấp thành công");
      } else {
        await supplierApi.createSupplier(storeId, formData);
        Alert.alert("Thành công", "Thêm nhà cung cấp thành công");
      }

      setFormModalVisible(false);
      fetchSuppliers(true);
    } catch (error: any) {
      console.error("Save error:", error?.message || error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error?.message ||
          "Không thể lưu nhà cung cấp"
      );
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(
    () => suppliers.filter((s) => s.status === "đang hoạt động").length,
    [suppliers]
  );

  const renderItem = ({ item }: { item: Supplier }) => (
    <SupplierCard
      supplier={item}
      mode={mode}
      onView={() => handleView(item)}
      onEdit={() => handleEdit(item)}
      onDelete={() => handleDelete(item)}
      onRestore={() => handleRestore(item)}
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
          colors={["#10b981", "#3b82f6"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Nhà cung cấp</Text>
            <Text style={styles.headerSubtitle}>
              Quản lý {suppliers.length} đối tác cung ứng
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SupplierExportButton storeId={storeId} />
            <TouchableOpacity style={[styles.headerAddBtn, { marginLeft: 10 }]} onPress={handleAdd}>
              <Ionicons name="add" size={28} color="#10b981" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mode Tabs */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            onPress={() => setMode("active")}
            style={[styles.modeTab, mode === "active" && styles.modeTabActive]}
          >
            <Text style={[styles.modeTabText, mode === "active" && styles.modeTabTextActive]}>Đang hoạt động</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("deleted")}
            style={[styles.modeTab, mode === "deleted" && styles.modeTabActive]}
          >
            <Text style={[styles.modeTabText, mode === "deleted" && styles.modeTabTextActive]}>Đã xóa</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsScroll}
        >
          <StatCard title="Tổng số" value={suppliers.length} icon="business" gradient={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} />
          <StatCard title="Hoạt động" value={activeCount} icon="checkmark-circle" gradient={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} />
          <StatCard title="Đã xóa" value={suppliers.length - activeCount} icon="trash" gradient={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]} />
        </ScrollView>
      </Animated.View>

      {/* Sticky Search Bar */}
      <Animated.View style={[
        styles.stickySearch,
        {
          top: HEADER_HEIGHT - 30,
          transform: [{ translateY: headerTranslate }],
        }
      ]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo tên, SĐT, địa chỉ..."
            placeholderTextColor="#94a3b8"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Main List */}
      <Animated.FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: HEADER_HEIGHT + 35 }
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
              <Ionicons name="business-outline" size={60} color="#e2e8f0" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có nhà cung cấp nào</Text>
            <Text style={styles.emptySubtitle}>Bắt đầu bằng cách thêm nhà cung cấp mới vào hệ thống của bạn</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAdd}>
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddBtnText}>Thêm NCC</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Detail Modal */}
      <DetailModal
        visible={detailModalVisible}
        supplier={selectedSupplier}
        mode={mode}
        onClose={() => setDetailModalVisible(false)}
        onEdit={() => {
          setDetailModalVisible(false);
          if (selectedSupplier) handleEdit(selectedSupplier);
        }}
        onDelete={() => {
          setDetailModalVisible(false);
          if (selectedSupplier) handleDelete(selectedSupplier);
        }}
        onRestore={() => {
          setDetailModalVisible(false);
          if (selectedSupplier) handleRestore(selectedSupplier);
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
                disabled={saving}
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
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  )}
                  <Text style={styles.saveBtnText}>
                    {editingSupplier ? "Cập nhật" : "Thêm mới"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SupplierListScreen;

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
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
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 15,
  },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
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
  modeTabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  modeTabActive: { backgroundColor: "#fff" },
  modeTabText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  modeTabTextActive: { color: "#10b981" },
  statsScroll: { paddingHorizontal: 20, paddingTop: 15, gap: 10 },
  statCard: {
    minWidth: 120,
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: "#fff" },
  statTitle: { fontSize: 10, color: "rgba(255,255,255,0.9)", fontWeight: "600" },

  // Sticky Search
  stickySearch: { position: "absolute", left: 0, right: 0, zIndex: 20, paddingHorizontal: 20 },
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
  searchInput: { flex: 1, fontSize: 15, color: "#1e293b", fontWeight: "500", marginLeft: 10 },

  // List
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  supplierCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  supplierAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
  cardContent: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  supplierName: { fontSize: 16, fontWeight: "700", color: "#0f172a", flex: 1 },
  activeTag: { backgroundColor: "#ecfdf5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  activeTagText: { fontSize: 10, fontWeight: "700", color: "#10b981" },
  inactiveTag: { backgroundColor: "#fef2f2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  inactiveTagText: { fontSize: 10, fontWeight: "700", color: "#ef4444" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  infoText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  viewMoreBtn: { padding: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  actionItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionLabel: { fontSize: 13, fontWeight: "700" },
  actionSeparator: { width: 1, height: 16, backgroundColor: "#f1f5f9" },

  // Detail Modal
  detailOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  detailContent: { backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 30, maxHeight: "90%" },
  detailHeader: { padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  detailTitleBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  detailCloseBtn: { padding: 4 },
  detailHero: { alignItems: "center", paddingVertical: 30 },
  heroAvatar: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroAvatarText: { fontSize: 40, fontWeight: "800", color: "#fff" },
  heroName: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  heroTagActive: { backgroundColor: "#ecfdf5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  heroTagTextActive: { color: "#10b981", fontWeight: "700", fontSize: 13 },
  heroTagInactive: { backgroundColor: "#fef2f2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  heroTagTextInactive: { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  detailInfoList: { paddingHorizontal: 24 },
  detailInfoItem: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20 },
  infoIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  infoMeta: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 2 },
  infoValue: { fontSize: 15, color: "#1e293b", fontWeight: "600" },
  detailFooter: { padding: 24, paddingTop: 10 },
  footerBtn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  editBtnActive: { backgroundColor: "#3b82f6" },
  footerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Empty state
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#f8fafc", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#64748b", textAlign: "center", paddingHorizontal: 40, lineHeight: 20, marginBottom: 24 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#10b981", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyAddBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Form (if any - keeping compatible)
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
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  modalCloseBtn: { padding: 4 },
  formContainer: { padding: 20 },
  formSection: { marginBottom: 24 },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 16,
  },
  formGroup: { marginBottom: 16 },
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
  formInputText: { flex: 1, marginLeft: 10, fontSize: 16, color: "#1e293b" },
  formTextArea: { paddingTop: 12, minHeight: 100, alignItems: "flex-start" },

  statusButtons: { flexDirection: "row", gap: 12 },
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
  statusButtonActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  statusButtonInactive: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  statusButtonText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  statusButtonTextActive: { color: "#fff" },

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
  cancelBtnText: { fontSize: 16, fontWeight: "600", color: "#6b7280" },
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
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
