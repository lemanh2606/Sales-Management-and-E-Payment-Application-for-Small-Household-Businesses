import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import * as warehouseApi from "../../api/warehouseApi";
import { Warehouse } from "../../api/warehouseApi";
import { useNavigation } from "@react-navigation/native";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WAREHOUSE_STATUS_LABEL: any = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  maintenance: "Bảo trì",
  archived: "Lưu trữ",
};

const getWarehouseStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "#10b981"; // Success
    case "inactive":
      return "#64748b"; // Secondary
    case "maintenance":
      return "#f59e0b"; // Warning
    case "archived":
      return "#ef4444"; // Error
    default:
      return "#64748b";
  }
};

const typeLabel: any = {
  normal: "Kho thường",
  cold_storage: "Kho lạnh",
  hazardous: "Kho hàng nguy hiểm",
  high_value: "Kho giá trị cao",
  other: "Kho khác",
};

const WarehouseListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [deletedMode, setDeletedMode] = useState(false);

  const fetchWarehouses = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const params = {
        deleted: deletedMode,
        q: searchText || undefined,
      };
      const response = await warehouseApi.getWarehousesByStore(storeId, params);
      setWarehouses(response.warehouses || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách kho:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách kho hàng");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, deletedMode, searchText]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWarehouses();
  }, [fetchWarehouses]);

  const toggleDeletedMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDeletedMode(!deletedMode);
  };

  const handleSetDefault = async (item: Warehouse) => {
    if (!storeId) return;
    try {
      await warehouseApi.setDefaultWarehouse(storeId, item._id);
      Alert.alert("Thành công", `Đã đặt "${item.name}" làm kho mặc định`);
      fetchWarehouses();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể đặt làm kho mặc định");
    }
  };

  const handleRestore = async (item: Warehouse) => {
    if (!storeId) return;
    try {
      await warehouseApi.restoreWarehouse(storeId, item._id);
      Alert.alert("Thành công", `Đã khôi phục kho "${item.name}"`);
      fetchWarehouses();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể khôi phục kho");
    }
  };

  const renderItem = ({ item }: { item: Warehouse }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("WarehouseForm", {
            warehouse: item,
            onRefresh: fetchWarehouses,
          })
        }
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={20} color="#10b981" />
          </View>
          <View style={styles.headerTitleContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_default && (
                <View style={styles.defaultBadge}>
                  <Ionicons name="star" size={10} color="#f59e0b" />
                  <Text style={styles.badgeText}>Mặc định</Text>
                </View>
              )}
            </View>
            <Text style={styles.codeText}>{item.code}</Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getWarehouseStatusColor(item.status) },
            ]}
          />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.address || "Chưa có địa chỉ"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={14} color="#64748b" />
            <Text style={styles.infoText} numberOfLines={1}>
              {item.contact_person || "Chưa cập nhật người phụ trách"}
            </Text>
          </View>
          <View style={styles.tagRow}>
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>
                {typeLabel[item.warehouse_type] || "Kho thường"}
              </Text>
            </View>
            {item.capacity && (
              <View style={styles.capacityTag}>
                <Text style={styles.capacityText}>
                  {item.capacity} {item.capacity_unit || "m3"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.updatedAt}>
            Cập nhật:{" "}
            {item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString("vi-VN")
              : "N/A"}
          </Text>
          <View style={styles.actions}>
            {!item.is_default && !deletedMode && (
              <TouchableOpacity
                onPress={() => handleSetDefault(item)}
                style={styles.actionBtn}
              >
                <Ionicons name="star-outline" size={18} color="#f59e0b" />
              </TouchableOpacity>
            )}
            {deletedMode && (
              <TouchableOpacity
                onPress={() => handleRestore(item)}
                style={[styles.actionBtn, styles.restoreBtn]}
              >
                <Ionicons name="refresh-outline" size={18} color="#10b981" />
              </TouchableOpacity>
            )}
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo mã, tên, địa chỉ..."
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText !== "" && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, deletedMode && styles.filterBtnActive]}
            onPress={toggleDeletedMode}
          >
            <Ionicons
              name={deletedMode ? "eye-outline" : "trash-outline"}
              size={18}
              color={deletedMode ? "#10b981" : "#fff"}
            />
            <Text
              style={[
                styles.filterBtnText,
                deletedMode && styles.filterBtnTextActive,
              ]}
            >
              {deletedMode ? "Xem kho hiện tại" : "Kho đã xoá"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshHeaderBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      ) : (
        <FlatList
          data={warehouses}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#10b981"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name={deletedMode ? "trash-bin-outline" : "business-outline"}
                  size={48}
                  color="#cbd5e1"
                />
              </View>
              <Text style={styles.emptyText}>
                {deletedMode
                  ? "Không có kho nào đã xoá"
                  : "Chưa có kho hàng nào"}
              </Text>
              {!deletedMode && (
                <TouchableOpacity
                  style={styles.addEmptyBtn}
                  onPress={() =>
                    navigation.navigate("WarehouseForm", {
                      onRefresh: fetchWarehouses,
                    })
                  }
                >
                  <Text style={styles.addEmptyText}>Thêm kho ngay</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {!deletedMode && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            navigation.navigate("WarehouseForm", { onRefresh: fetchWarehouses })
          }
        >
          <LinearGradient
            colors={["#10b981", "#059669"]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 16,
    paddingTop: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: "#1e293b" },
  filterRow: {
    flexDirection: "row",
    marginTop: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterBtnActive: { backgroundColor: "#fff" },
  filterBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  filterBtnTextActive: { color: "#10b981" },
  refreshHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, paddingBottom: 100 },
  cardContainer: {
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "700", color: "#1e293b", maxWidth: "70%" },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 0.5,
    borderColor: "#f59e0b",
  },
  badgeText: {
    color: "#d97706",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 2,
  },
  codeText: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  cardBody: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  infoText: { flex: 1, fontSize: 13, color: "#64748b", marginLeft: 8 },
  tagRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  typeTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeTagText: { fontSize: 11, fontWeight: "600", color: "#64748b" },
  capacityTag: {
    backgroundColor: "#ecfeff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#06b6d4",
  },
  capacityText: { fontSize: 11, fontWeight: "600", color: "#0891b2" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  updatedAt: { fontSize: 11, color: "#94a3b8" },
  actions: { flexDirection: "row", alignItems: "center" },
  actionBtn: { padding: 6, marginRight: 8 },
  restoreBtn: { backgroundColor: "#f0fdf4", borderRadius: 6 },
  empty: { alignItems: "center", marginTop: 60 },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#94a3b8" },
  addEmptyBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#10b981",
  },
  addEmptyText: { color: "#fff", fontWeight: "700" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default WarehouseListScreen;
