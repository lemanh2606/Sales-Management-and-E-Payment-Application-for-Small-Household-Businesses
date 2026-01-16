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
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  selectStore,
  createStore,
  updateStore,
  deleteStore,
  getStoresByManager,
  getStoreById,
} from "../../api/storeApi";
import { Ionicons } from "@expo/vector-icons";
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import type { Store, StoreCreateDto } from "../../type/store";
import { NavigationService } from "../../navigation/RootNavigation";

const { width } = Dimensions.get("window");

export default function SelectStoreScreen() {
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string>("");
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [search, setSearch] = useState("");

  const [storeForm, setStoreForm] = useState<Partial<Store>>({
    name: "",
    address: "",
    phone: "",
    description: "",
    imageUrl: "",
    tags: [],
    openingHours: { open: "", close: "" },
    location: { lat: null, lng: null },
    staff_ids: [],
  });

  const { setCurrentStore, user } = useAuth();

  const loadStores = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await getStoresByManager();
      const list: Store[] = res?.stores || res?.data?.stores || res || [];
      const activeList = list.filter((s) => !s.deleted);
      setStores(activeList);
      setFilteredStores(activeList);
    } catch (e: any) {
      console.error(e);
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          "Không lấy được danh sách cửa hàng"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, [user]);

  useEffect(() => {
    if (!search) return setFilteredStores(stores);
    const q = search.trim().toLowerCase();
    setFilteredStores(
      stores.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q) ||
          (s.tags || []).join(" ").toLowerCase().includes(q)
      )
    );
  }, [search, stores]);

  const handleSelect = async (store: Store) => {
    try {
      setBusy(true);
      const res = await selectStore(store._id);
      const returnedStore: Store = res?.store ?? store;

      setCurrentStore && setCurrentStore(returnedStore);

      Alert.alert(
        "Chọn cửa hàng",
        `Bạn đã chọn cửa hàng: ${returnedStore.name}`,
        [
          {
            text: "OK",
            onPress: () => {
              NavigationService.navigate("Dashboard", undefined, 15);
            },
          },
        ]
      );
    } catch (e: any) {
      console.error(e);
      setErr(
        e?.response?.data?.message || e?.message || "Không thể chọn cửa hàng"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () => {
    setEditingStore(null);
    setStoreForm({
      name: "",
      address: "",
      phone: "",
      description: "",
      imageUrl: "",
      tags: [],
      openingHours: { open: "", close: "" },
      location: { lat: null, lng: null },
    });
    setShowModal(true);
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setStoreForm({
      ...store,
      tags: store.tags || [],
      openingHours: store.openingHours || { open: "", close: "" },
      location: store.location || { lat: null, lng: null },
    });
    setShowModal(true);
  };

  const handleSave = async (payloadFromModal?: Partial<Store>) => {
    const final = payloadFromModal || storeForm;
    if (!final.name || !final.address) {
      setErr("Vui lòng nhập tên và địa chỉ cửa hàng");
      return;
    }
    try {
      setBusy(true);
      if (editingStore && editingStore._id) {
        await updateStore(editingStore._id, final);
      } else {
        await createStore(final as StoreCreateDto);
      }
      setShowModal(false);
      setEditingStore(null);
      await loadStores();
    } catch (e: any) {
      console.error(e);
      setErr(e?.response?.data?.message || "Lỗi khi lưu cửa hàng");
    } finally {
      setBusy(false);
    }
  };

  const handleDetail = async (storeId: string) => {
    setSelectedStore(null);
    try {
      setBusy(true);
      const res: any = await getStoreById(storeId);
      const detail: Store = res?.store || res?.data || res;
      setSelectedStore(detail);
      setShowDetailModal(true);
    } catch (e) {
      const cached = stores.find((s) => s._id === storeId) || null;
      setSelectedStore(cached);
      setShowDetailModal(true);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (storeId: string) => {
    Alert.alert(
      "Xóa cửa hàng",
      "Bạn có chắc muốn xóa cửa hàng này? (xóa mềm)",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);
              await deleteStore(storeId);
              setShowDetailModal(false);
              await loadStores();
            } catch (e: any) {
              console.error(e);
              setErr(e?.response?.data?.message || "Lỗi khi xóa cửa hàng");
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Store }) => (
    <View style={styles.storeCard}>
      {/* Store Image with Overlay */}
      <View style={styles.imageContainer}>
        <Image
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require("../../../assets/store-placeholder.png")
          }
          style={styles.storeImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay} />

        {/* Quick Actions on Image */}
        <View style={styles.imageActions}>
          <TouchableOpacity
            style={[styles.iconButton, styles.viewButton]}
            onPress={() => handleDetail(item._id)}
          >
            <Ionicons name="eye" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.editButton]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Store Info */}
      <View style={styles.storeContent}>
        <View style={styles.storeHeader}>
          <Text style={styles.storeName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Đang hoạt động</Text>
          </View>
        </View>

        <View style={styles.storeDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="location" size={16} color="#6b7280" />
            <Text style={styles.detailText} numberOfLines={2}>
              {item.address}
            </Text>
          </View>

          {item.phone && (
            <View style={styles.detailItem}>
              <Ionicons name="call" size={16} color="#6b7280" />
              <Text style={styles.detailText}>{item.phone}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={() => handleDetail(item._id)}
          >
            <Ionicons name="information-circle" size={18} color="#3b82f6" />
            <Text style={styles.secondaryBtnText}>Chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => handleSelect(item)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Vào cửa hàng</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quản lý cửa hàng</Text>
          <Text style={styles.subtitle}>Chọn cửa hàng để bắt đầu làm việc</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            placeholder="Tìm kiếm cửa hàng theo tên, địa chỉ..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor="#9ca3af"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#d1d5db" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats Bar */}
      {!loading && (
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>{filteredStores.length} cửa hàng</Text>
          <View style={styles.statsDivider} />
          <Text style={styles.statsText}>{stores.length} tổng số</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Đang tải danh sách cửa hàng...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStores}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={64} color="#d1d5db" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có cửa hàng</Text>
              <Text style={styles.emptyDescription}>
                Tạo cửa hàng đầu tiên để bắt đầu kinh doanh
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAdd}>
                <Text style={styles.emptyButtonText}>Tạo cửa hàng mới</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Error Message */}
      {err ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={20} color="#dc2626" />
          <Text style={styles.errorText}>{err}</Text>
          <TouchableOpacity onPress={() => setErr("")}>
            <Ionicons name="close" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Modals */}
      <StoreFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        form={storeForm}
        setForm={setStoreForm}
        onSave={handleSave}
        busy={busy}
        title={editingStore ? "Sửa cửa hàng" : "Thêm cửa hàng"}
      />
      <StoreDetailModal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        store={selectedStore}
        onEdit={handleEdit}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
  },
  statsText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  statsDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#d1d5db",
    marginHorizontal: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  listContainer: {
    padding: 20,
  },
  storeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  storeImage: {
    width: "100%",
    height: 160,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  imageActions: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  viewButton: {
    backgroundColor: "rgba(59, 130, 246, 0.9)",
  },
  editButton: {
    backgroundColor: "rgba(16, 185, 129, 0.9)",
  },
  storeContent: {
    padding: 16,
  },
  storeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#065f46",
  },
  storeDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailText: {
    color: "#6b7280",
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  secondaryBtn: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  primaryBtn: {
    backgroundColor: "#3b82f6",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryBtnText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
    gap: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});
