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
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productSKU}>SKU: {item.sku}</Text>
      <Text>Status: {item.status}</Text>
      <Text>Stock: {item.stock_quantity}</Text>
      {item.group && <Text>Nhóm: {item.group.name}</Text>}
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

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
      >
        {/* Product Groups */}
        {productGroups.map((g) => (
          <TouchableOpacity
            key={g._id}
            style={[
              styles.filterButton,
              selectedGroupIds.includes(g._id) && styles.filterButtonActive,
            ]}
            onPress={() => toggleGroup(g._id)}
          >
            <Text
              style={selectedGroupIds.includes(g._id) ? { color: "#fff" } : {}}
            >
              {g.name}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Status Filters */}
        {["all", "Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].map(
          (status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                statusFilter === status && styles.filterButtonActive,
              ]}
              onPress={() => setStatusFilter(status as any)}
            >
              <Text style={statusFilter === status ? { color: "#fff" } : {}}>
                {status === "all" ? "Tất cả" : status}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

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
  filters: {
    flexDirection: "row",
    marginBottom: 10,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  filterButtonActive: {
    backgroundColor: "#007bff",
    borderColor: "#007bff",
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
});
