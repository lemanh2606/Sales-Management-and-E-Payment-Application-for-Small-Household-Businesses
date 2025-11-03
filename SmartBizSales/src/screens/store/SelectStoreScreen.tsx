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

// --- Placeholder components: bạn có thể thay bằng modal thực tế ---
import StoreFormModal from "../../components/store/StoreFormModal";
import StoreDetailModal from "../../components/store/StoreDetailModal";
import type { Store, StoreCreateDto } from "../../type/store";

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
    if (user && user.role !== "STAFF") {
      setCurrentStore && setCurrentStore(null);
      try {
        localStorage.removeItem("currentStore");
      } catch {}
    }
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
      let returnedStore: Store = res?.store || res?.data?.store || res || store;

      // Backup previous
      try {
        const prev = localStorage.getItem("currentStore");
        if (prev) localStorage.setItem("previousStore", prev);
        localStorage.setItem("currentStore", JSON.stringify(returnedStore));
      } catch {}

      // Update context
      if (setCurrentStore) {
        try {
          await setCurrentStore(returnedStore);
        } catch {
          await setCurrentStore(returnedStore);
        }
      }

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
      activeOpacity={0.8}
    >
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
      <Text style={styles.storeName}>{item.name}</Text>
      {item.address && <Text style={styles.storeAddress}>{item.address}</Text>}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => handleDetail(item._id)}>
          <Text style={styles.link}>Chi tiết</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleEdit(item)}>
          <Text style={styles.link}>Sửa</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        placeholder="Tìm kiếm cửa hàng..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#0b84ff"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredStores}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              Không có cửa hàng
            </Text>
          }
        />
      )}

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
  container: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  storeCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  storeImage: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  storeName: { fontWeight: "700", fontSize: 16, color: "#0b84ff" },
  storeAddress: { color: "#374151", marginTop: 4 },
  cardActions: {
    flexDirection: "row",
    marginTop: 8,
    justifyContent: "flex-end",
  },
  link: { color: "#0b84ff", fontWeight: "600", marginLeft: 12 },
});
