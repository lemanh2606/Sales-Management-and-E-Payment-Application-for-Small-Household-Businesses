// src/screens/product/ProductListScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import { Product, ProductStatus, ProductGroupRef } from "../../type/product";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";

// import modal form của bạn
import ProductFormModal from "../../components/product/ProductFormModal";

interface ProductGroup {
  _id: string;
  name: string;
}

const ProductListScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">(
    "all"
  );
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);

  const [groupDropdownVisible, setGroupDropdownVisible] = useState(false);
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ================= FETCH PRODUCT GROUPS =================
  const fetchProductGroups = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await apiClient.get<{ productGroups: ProductGroupRef[] }>(
        `/product-groups/store/${storeId}`
      );
      setProductGroups(
        res.data.productGroups.map((g) => ({
          _id: g._id as string,
          name: g.name || "",
        }))
      );
    } catch (error) {
      console.error("Lỗi load nhóm sản phẩm:", error);
    }
  }, [storeId]);

  // ================= FETCH PRODUCTS =================
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const res = await apiClient.get<{ products: Product[] }>(
        `/products/store/${storeId}`
      );
      setProducts(res.data.products);
      setFilteredProducts(res.data.products);
    } catch (error) {
      console.error("Lỗi load sản phẩm:", error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProductGroups();
    fetchProducts();
  }, [fetchProductGroups, fetchProducts]);

  // ================= FILTER & SEARCH =================
  useEffect(() => {
    let temp = [...products];

    if (selectedGroupIds.length > 0) {
      temp = temp.filter(
        (p) => p.group_id && selectedGroupIds.includes(p.group_id.toString())
      );
    }

    if (statusFilter !== "all") {
      temp = temp.filter((p) => p.status === statusFilter);
    }

    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      temp = temp.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.sku.toLowerCase().includes(lower)
      );
    }

    setFilteredProducts(temp);
  }, [products, selectedGroupIds, statusFilter, searchText]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productSKU}>SKU: {item.sku}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Stock: {item.stock_quantity}</Text>
          {item.group && <Text>Nhóm: {item.group.name}</Text>}
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setEditingProduct(item)}
        >
          <Text style={{ color: "#fff" }}>Sửa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!storeId) {
    return (
      <View style={styles.container}>
        <Text>Vui lòng chọn cửa hàng để xem sản phẩm</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Tìm kiếm theo tên hoặc SKU"
        value={searchText}
        onChangeText={setSearchText}
      />

      {/* Filter dropdowns */}
      <View style={styles.dropdownContainer}>
        {/* Group Filter */}
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setGroupDropdownVisible(!groupDropdownVisible)}
        >
          <Text>
            Nhóm:{" "}
            {selectedGroupIds.length > 0 ? selectedGroupIds.length : "Tất cả"}
          </Text>
          <Ionicons
            name={groupDropdownVisible ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </TouchableOpacity>
        <Modal
          isVisible={groupDropdownVisible}
          onBackdropPress={() => setGroupDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <ScrollView>
              {productGroups.map((g) => (
                <TouchableOpacity
                  key={g._id}
                  style={styles.dropdownItem}
                  onPress={() => toggleGroup(g._id)}
                >
                  <Text>{g.name}</Text>
                  {selectedGroupIds.includes(g._id) && <Text>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Status Filter */}
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setStatusDropdownVisible(!statusDropdownVisible)}
        >
          <Text>
            Status: {statusFilter === "all" ? "Tất cả" : statusFilter}
          </Text>
          <Ionicons
            name={statusDropdownVisible ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </TouchableOpacity>
        <Modal
          isVisible={statusDropdownVisible}
          onBackdropPress={() => setStatusDropdownVisible(false)}
        >
          <View style={styles.dropdownModal}>
            {["all", "Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].map(
              (status) => (
                <TouchableOpacity
                  key={status}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setStatusFilter(status as any);
                    setStatusDropdownVisible(false);
                  }}
                >
                  <Text>{status === "all" ? "Tất cả" : status}</Text>
                  {statusFilter === status && <Text>✓</Text>}
                </TouchableOpacity>
              )
            )}
          </View>
        </Modal>
      </View>

      {/* Product List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#007bff"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id.toString()}
          renderItem={renderProduct}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Product edit modal */}
      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            setEditingProduct(null);
            fetchProducts();
          }}
        />
      )}
    </View>
  );
};

export default ProductListScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f9fafb" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  dropdownContainer: {
    marginBottom: 10,
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 6,
  },
  dropdownModal: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "#ccc",
  },
  productCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  productName: { fontWeight: "bold", fontSize: 16 },
  productSKU: { color: "#666" },
  editButton: {
    backgroundColor: "#007bff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
});
