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
  ScrollView,
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

// --- Placeholder components: bạn có thể thay bằng modal thực tế ---
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import type { Store, StoreCreateDto } from "../../type/store";

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

  // --- Load stores from API ---
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

  // --- Search filter ---
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

  // --- Select store ---
  const handleSelect = async (store: Store) => {
    try {
      setBusy(true);
      const res = await selectStore(store._id);
      const returnedStore: Store = res?.store ?? store; // fallback chắc chắn

      // Backup previous
      try {
        const prev = localStorage.getItem("currentStore");
        if (prev) localStorage.setItem("previousStore", prev);
        localStorage.setItem("currentStore", JSON.stringify(returnedStore));
      } catch {}

      // Update context
      setCurrentStore && setCurrentStore(returnedStore);

      Alert.alert(
        "Chọn cửa hàng",
        `Bạn đã chọn cửa hàng: ${returnedStore.name}`
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

  // --- Add / Edit store ---
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

  // --- Save store: update nếu editingStore, tạo mới nếu không ---
  const handleSave = async (payloadFromModal?: Partial<Store>) => {
    const final = payloadFromModal || storeForm;
    if (!final.name || !final.address) {
      setErr("Vui lòng nhập tên và địa chỉ cửa hàng");
      return;
    }
    try {
      setBusy(true);
      if (editingStore && editingStore._id) {
        // Update
        await updateStore(editingStore._id, final);
      } else {
        // Create mới
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

  // --- Render item ---
  const renderItem = ({ item }: { item: Store }) => (
    <TouchableOpacity
      style={styles.storeCard}
      onPress={() => handleSelect(item)}
      activeOpacity={0.9}
    >
      <View style={styles.storeCardContent}>
        {/* Ảnh cửa hàng */}
        <Image
          source={
            item.imageUrl
              ? { uri: item.imageUrl }
              : require("../../../assets/store-placeholder.png")
          }
          style={styles.storeImage}
          resizeMode="cover"
        />

        {/* Nội dung thông tin */}
        <View style={styles.storeInfo}>
          <Text style={styles.storeName} numberOfLines={1}>
            {item.name}
          </Text>

          {item.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.storeAddress} numberOfLines={2}>
                {item.address}
              </Text>
            </View>
          )}

          {item.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={14} color="#666" />
              <Text style={styles.storePhone}>{item.phone}</Text>
            </View>
          )}
        </View>

        {/* Các nút hành động */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.detailBtn]}
            onPress={() => handleDetail(item._id)}
          >
            <Ionicons name="eye-outline" size={16} color="#3b82f6" />
            <Text style={styles.actionText}>Chi tiết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.editBtn]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="create-outline" size={16} color="#10b981" />
            <Text style={styles.actionText}>Sửa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Badge chọn nhanh */}
      <TouchableOpacity
        style={styles.quickSelectBtn}
        onPress={() => handleSelect(item)}
      >
        <Text style={styles.quickSelectText}>Chọn cửa hàng</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#94a3b8"
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Tìm kiếm cửa hàng theo tên, địa chỉ, số điện thoại..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Add Store Button */}
      <TouchableOpacity style={styles.addStoreBtn} onPress={handleAdd}>
        <View style={styles.addStoreContent}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.addStoreText}>Thêm cửa hàng mới</Text>
        </View>
      </TouchableOpacity>

      {/* Store Count */}
      {!loading && (
        <View style={styles.storeCountContainer}>
          <Text style={styles.storeCountText}>
            {filteredStores.length} cửa hàng
          </Text>
        </View>
      )}

      {/* Loading State */}
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
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Không có cửa hàng</Text>
              <Text style={styles.emptySubtitle}>
                Hãy tạo cửa hàng đầu tiên của bạn
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={handleAdd}>
                <Text style={styles.emptyBtnText}>Tạo cửa hàng mới</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Error Message */}
      {err ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={20} color="#dc2626" />
          <Text style={styles.errorText}>{err}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
  },
  addStoreBtn: {
    backgroundColor: "#3b82f6",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#3b82f6",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addStoreContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  addStoreText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  storeCountContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  storeCountText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  storeCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  storeCardContent: {
    padding: 16,
  },
  storeImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 12,
  },
  storeInfo: {
    marginBottom: 12,
  },
  storeName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  storeAddress: {
    color: "#475569",
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  storePhone: {
    color: "#475569",
    fontSize: 14,
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  detailBtn: {
    backgroundColor: "#eff6ff",
  },
  editBtn: {
    backgroundColor: "#ecfdf5",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  quickSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    gap: 8,
  },
  quickSelectText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#475569",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: "#fff",
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
    gap: 8,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});
