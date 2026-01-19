import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import * as productApi from "../../api/productApi";
import * as warehouseApi from "../../api/warehouseApi";
import { Product, ProductStatus } from "../../type/product";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import Modal from "react-native-modal";

import { fileService } from "../../services/fileService";

// Components
import ProductFormModal from "../../components/product/ProductFormModal";
import ProductGroupFormModal from "../../components/product/ProductGroupFormModal";
import ProductBatchModal from "../../components/product/ProductBatchModal";

const { width } = Dimensions.get("window");

const ProductListScreen: React.FC = ({ navigation }: any) => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  // --- Data States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productGroups, setProductGroups] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  // --- UI/Filter States ---
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"merge" | "split">("merge");
  
  // Filters
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingBatchProduct, setEditingBatchProduct] = useState<Product | null>(null);
  const [editingBatchIndex, setEditingBatchIndex] = useState<number | null>(null);

  // --- Fetch Data ---
  const fetchData = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const [prodRes, groupRes, whRes] = await Promise.all([
        productApi.getProductsByStore(storeId, { page: 1, limit: 1000 }), // Fetch all for smooth filtering
        productApi.getProductGroupsByStore(storeId),
        warehouseApi.getWarehousesByStore(storeId)
      ]);

      setProducts(prodRes.products || []);
      setProductGroups(groupRes.productGroups || []);
      setWarehouses(whRes.warehouses || []);
      
      // Init filtered
      setFilteredProducts(prodRes.products || []);
    } catch (error) {
      console.error("Fetch error:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // --- Flatten Logic (for Split View) ---
  const flattenProducts = useMemo(() => {
    return products.reduce<any[]>((acc, product) => {
      const batches = product.batches && product.batches.length > 0
          ? product.batches.filter((b) => b.quantity > 0)
          : [];

      if (batches.length === 0) {
        // No batch or out of stock -> keep as one row
        acc.push({ ...product, uniqueId: product._id, isBatch: false });
      } else {
        // Split batches
        batches.forEach((batch, index) => {
           // Resolve warehouse name
           const whName = warehouses.find(w => w._id === batch.warehouse_id)?.name || product.default_warehouse_name;
           
           acc.push({
            ...product,
            _id: product._id,
            uniqueId: `${product._id}_${batch.batch_no}_${index}`,
            isBatch: true,
            stock_quantity: batch.quantity,
            cost_price: batch.cost_price,
            expiry_date: batch.expiry_date,
            batch_no: batch.batch_no,
            warehouse_id: batch.warehouse_id || product.default_warehouse_id,
            warehouse_name: whName,
            createdAt: batch.created_at || product.createdAt,
            batches: [batch],
            batchIndex: index,
            originalProduct: product,
          });
        });
      }
      return acc;
    }, []);
  }, [products, warehouses]);

  // --- Filtering Logic ---
  useEffect(() => {
    const source = viewMode === "split" ? flattenProducts : products;
    let result = [...source];

    // Search
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(lower) || 
        p.sku?.toLowerCase().includes(lower) ||
        (p as any).batch_no?.toLowerCase().includes(lower)
      );
    }

    // Filter Group
    if (selectedGroupId) {
      result = result.filter(p => p.group?._id === selectedGroupId || p.group_id === selectedGroupId);
    }

    // Filter Warehouse
    if (selectedWarehouseId) {
      // Logic: if split, check batch warehouse. if merge, check default or if any batch in that warehouse?
      // Easier: Check if product belongs to warehouse (simple approximation for merge mode)
      if (viewMode === "split") {
          result = result.filter(p => p.warehouse_id === selectedWarehouseId);
      } else {
          // In merge mode, show product if it has default warehouse OR any batch in this warehouse
          result = result.filter(p => {
              if (p.default_warehouse_id === selectedWarehouseId) return true;
              if (p.batches?.some((b: any) => b.warehouse_id === selectedWarehouseId)) return true;
              return false;
          });
      }
    }

    // Filter Status
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    setFilteredProducts(result);
  }, [products, flattenProducts, viewMode, searchText, selectedGroupId, selectedWarehouseId, statusFilter]);

  // --- Stats ---
  const stats = useMemo(() => {
    const totalQty = filteredProducts.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);
    const totalValue = filteredProducts.reduce((sum, p) => sum + ((p.stock_quantity || 0) * (p.price || 0)), 0);
    const lowStockCount = filteredProducts.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 0)).length;
    return { totalQty, totalValue, lowStockCount };
  }, [filteredProducts]);

  // --- Actions ---
  const handleExport = async () => {
      if (!storeId) return;
      try {
          Alert.alert("Thông báo", "Đang xử lý xuất file...");
          const blob = await productApi.exportProducts(storeId);
          await fileService.downloadAndSaveFile(blob, {
              fileName: `products_${new Date().getTime()}.xlsx`,
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Xuất sản phẩm"
          });
          Alert.alert("Thành công", "Đã xuất file thành công");
      } catch (err) {
          Alert.alert("Lỗi export", "Không thể xuất file");
      }
  };

  const handleDownloadTemplate = async () => {
      try {
          Alert.alert("Thông báo", "Đang tải template...");
          const blob = await productApi.downloadProductTemplate();
          await fileService.downloadAndSaveFile(blob, {
              fileName: "product_template.xlsx",
              mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Tải template"
          });
          Alert.alert("Thành công", "Đã tải template thành công");
      } catch (err) {
          Alert.alert("Lỗi", "Không thể tải template");
      }
  };

  const handleImport = async () => {
      if (!storeId) return;
      try {
          const res = await DocumentPicker.getDocumentAsync({
              type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
              copyToCacheDirectory: true
          });
          
          if (res.canceled) return;
          
          const file = res.assets[0];
          if (file.size && file.size > 10 * 1024 * 1024) {
              Alert.alert("Lỗi", "File quá lớn (>10MB)");
              return;
          }

          Alert.alert("Xác nhận", `Import file ${file.name}?`, [
              { text: "Hủy", style: "cancel" },
              { text: "Import", onPress: async () => {
                  try {
                      setLoading(true);
                      const response = await productApi.importProducts(storeId, {
                          uri: file.uri,
                          name: file.name,
                          type: file.mimeType
                      });
                      
                      // Handle result
                      const { success, failed } = response.results;
                      let msg = `Thành công: ${success?.length || 0} dòng.`;
                      if (failed?.length > 0) msg += `\nThất bại: ${failed.length} dòng.`;
                      
                      Alert.alert("Kết quả Import", msg, [{ text: "OK", onPress: fetchData }]);
                  } catch (err: any) {
                       Alert.alert("Lỗi Import", err.message || "Có lỗi xảy ra");
                  } finally {
                      setLoading(false);
                  }
              }}
          ]);
      } catch (err) {
          Alert.alert("Lỗi", "Không thể chọn file");
      }
  };

  const showActionMenu = () => {
    Alert.alert("Tác vụ khác", "Chọn hành động bạn muốn thực hiện", [
        { text: "📥 Import Excel", onPress: handleImport },
        { text: "📤 Export Excel", onPress: handleExport },
        { text: "📄 Tải Template", onPress: handleDownloadTemplate },
        { text: "Đóng", style: "cancel" }
    ]);
  };

  // --- Handlers ---
  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setShowProductModal(true);
  };

  const handleEditBatch = (prod: any) => {
      if (prod.isBatch) {
          setEditingBatchProduct(prod.originalProduct);
          setEditingBatchIndex(prod.batchIndex);
          setShowBatchModal(true);
      } else {
          // If in merge mode but want to edit batch? 
          // For now, only allow edit batch in Split mode or implement a batch list modal
          // Let's just edit product info if in merge mode
          setEditingProduct(prod);
          setShowProductModal(true);
      }
  };

  // --- Render Item ---
  const renderItem = ({ item }: { item: any }) => {
    const isSplit = viewMode === "split";
    const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
    const isLowStock = item.stock_quantity <= item.min_stock;
    
    // Resolve Warehouse Name
    let whName = item.warehouse_name;
    if (!whName && item.default_warehouse_id) {
        whName = warehouses.find(w => w._id === item.default_warehouse_id)?.name;
    }
    if (!whName && item.batches?.length > 0) {
        // If merge mode, just show "Nhiều kho" or first one
        whName = "Đa kho"; 
    }

    return (
      <View style={[styles.card, isExpired && styles.cardExpired, isLowStock && styles.cardLowStock]}>
        <View style={styles.cardHeader}>
          <View style={{flex: 1}}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.cardSku}>{item.sku} • {item.unit || "Cái"}</Text>
          </View>
          <TouchableOpacity onPress={() => isSplit ? handleEditBatch(item) : handleEditProduct(item)}>
             <Ionicons name="create-outline" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
           <View style={styles.row}>
               <View style={styles.col}>
                   <Text style={styles.label}>Giá bán</Text>
                   <Text style={styles.price}>{new Intl.NumberFormat('vi-VN').format(item.price)}đ</Text>
               </View>
               <View style={styles.colRight}>
                   <Text style={styles.label}>Tồn kho</Text>
                   <Text style={[styles.stock, isLowStock && { color: '#ef4444' }]}>
                       {item.stock_quantity}
                   </Text>
               </View>
           </View>

           {isSplit && (
               <View style={styles.batchInfo}>
                   <Text style={styles.batchText}>📦 Lô: {item.batch_no}</Text>
                   <Text style={[styles.batchText, isExpired && { color: '#ef4444' }]}>
                       📅 HSD: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('vi-VN') : '---'}
                   </Text>
               </View>
           )}
           
           {/* Footer Info */}
           <View style={styles.cardFooter}>
               <View style={styles.badge}>
                  <Ionicons name="location-outline" size={12} color="#64748b" />
                   <Text style={styles.badgeText}>{whName || "Chưa gán kho"}</Text>
               </View>
               <View style={[styles.badge, { backgroundColor: item.status === 'Nsngừng kinh doanh' ? '#f1f5f9' : '#dcfce7' }]}>
                   <Text style={[styles.badgeText, { color: item.status === 'Nsngừng kinh doanh' ? '#64748b' : '#16a34a' }]}>
                       {item.status}
                   </Text>
               </View>
           </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
        <View style={styles.headerTop}>
             <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                 <Ionicons name="arrow-back" size={24} color="#fff" />
             </TouchableOpacity>
             <Text style={styles.headerTitle}>Danh sách sản phẩm</Text>
             <TouchableOpacity style={styles.headerAction} onPress={fetchData}>
                 <Ionicons name="refresh" size={20} color="#fff" />
             </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContainer}>
            <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.statCard}>
                <Text style={styles.statLabel}>Tổng sản phẩm</Text>
                <Text style={styles.statValue}>{filteredProducts.length}</Text>
            </LinearGradient>
             <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.statCard}>
                <Text style={styles.statLabel}>Tổng tồn kho</Text>
                <Text style={styles.statValue}>{stats.totalQty}</Text>
            </LinearGradient>
             <LinearGradient colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']} style={styles.statCard}>
                <Text style={styles.statLabel}>Tổng giá trị</Text>
                <Text style={styles.statValue}>
                    {new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(stats.totalValue)}
                </Text>
            </LinearGradient>
        </ScrollView>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput 
                style={styles.searchInput} 
                placeholder="Tìm kiếm tên, SKU, lô..."
                placeholderTextColor="#94a3b8"
                value={searchText}
                onChangeText={setSearchText}
            />
        </View>
      </LinearGradient>

      {/* Filters & Controls */}
      <View style={styles.controls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16, gap: 8, paddingVertical: 12}}>
             {/* View Mode Toggle */}
             <TouchableOpacity style={[styles.filterChip, styles.modeChip]} onPress={showActionMenu}>
                  <Ionicons name="ellipsis-horizontal-circle" size={16} color="#0f172a" />
                  <Text style={styles.filterText}>Tiện ích</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.filterChip, styles.modeChip]} onPress={() => setViewMode(prev => prev === "merge" ? "split" : "merge")}>
                  <Ionicons name={viewMode === "merge" ? "layers-outline" : "list-outline"} size={16} color="#0f172a" />
                  <Text style={styles.filterText}>{viewMode === "merge" ? "Gộp Lô" : "Tách Lô"}</Text>
             </TouchableOpacity>
             
             {/* Warehouse Filter */}
             <TouchableOpacity 
                style={[styles.filterChip, selectedWarehouseId && styles.filterChipActive]} 
                onPress={() => {
                    if (warehouses.length > 0) {
                       Alert.alert("Chọn kho", undefined, [
                           { text: "Tất cả", onPress: () => setSelectedWarehouseId(null) },
                           ...warehouses.map(w => ({ text: w.name, onPress: () => setSelectedWarehouseId(w._id) })),
                           { text: "Đóng", style: "cancel" }
                       ])
                    }
                }}
             >
                <Text style={[styles.filterText, selectedWarehouseId && styles.filterTextActive]}>
                    {selectedWarehouseId ? warehouses.find(w => w._id === selectedWarehouseId)?.name : "Tất cả kho"}
                </Text>
                <Ionicons name="chevron-down" size={12} color={selectedWarehouseId ? "#fff" : "#64748b"} />
             </TouchableOpacity>

             {/* Group Filter */}
             <TouchableOpacity 
                style={[styles.filterChip, selectedGroupId && styles.filterChipActive]} 
                onPress={() => {
                    if (productGroups.length > 0) {
                        Alert.alert("Chọn nhóm hàng", undefined, [
                           { text: "Tất cả", onPress: () => setSelectedGroupId(null) },
                           ...productGroups.map(g => ({ text: g.name, onPress: () => setSelectedGroupId(g._id) })),
                           { text: "Đóng", style: "cancel" }
                       ])
                    }
                }}
             >
                <Text style={[styles.filterText, selectedGroupId && styles.filterTextActive]}>
                    {selectedGroupId ? productGroups.find(g => g._id === selectedGroupId)?.name : "Tất cả nhóm"}
                </Text>
                <Ionicons name="chevron-down" size={12} color={selectedGroupId ? "#fff" : "#64748b"} />
             </TouchableOpacity>
          </ScrollView>
      </View>

      {/* List */}
      <FlatList 
          data={filteredProducts}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.uniqueId || item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
              !loading ? (
                  <View style={styles.emptyBox}>
                      <Ionicons name="cube-outline" size={64} color="#cbd5e1" />
                      <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
                  </View>
              ) : <ActivityIndicator style={{marginTop: 50}} color="#10b981" />
          }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => { setEditingProduct(null); setShowProductModal(true); }}>
          <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modals */}
      <ProductFormModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSaved={onRefresh} 
        product={editingProduct}
      />

      {editingBatchProduct && (
      <ProductBatchModal
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onSaved={() => { setShowBatchModal(false); onRefresh(); }}
        product={editingBatchProduct}
        batchIndex={editingBatchIndex as number}
      />
      )}
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingTop: 40, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 16, justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerAction: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  
  statsContainer: { paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  statCard: { padding: 12, borderRadius: 12, marginRight: 10, minWidth: 110 },
  statLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginBottom: 4 },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "700" },

  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#1e293b" },

  controls: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", gap: 4, borderWidth: 1, borderColor: "#e2e8f0" },
  filterChipActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  filterText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  filterTextActive: { color: "#fff" },
  modeChip: { backgroundColor: "#fff", borderColor: "#cbd5e1" },

  listContent: { padding: 16, paddingBottom: 100 },
  
  // Card Styles
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardExpired: { borderWidth: 1, borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  cardLowStock: { borderWidth: 1, borderColor: "#f59e0b" },
  
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#1e293b", flex: 1, marginRight: 8 },
  cardSku: { fontSize: 13, color: "#64748b", marginTop: 2 },
  
  cardBody: {},
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  col: { alignItems: "flex-start" },
  colRight: { alignItems: "flex-end" },
  label: { fontSize: 12, color: "#94a3b8", marginBottom: 2 },
  price: { fontSize: 15, fontWeight: "700", color: "#10b981" },
  stock: { fontSize: 15, fontWeight: "700", color: "#334155" },
  
  batchInfo: { backgroundColor: "#f8fafc", padding: 8, borderRadius: 8, marginVertical: 8 },
  batchText: { fontSize: 12, color: "#475569", marginBottom: 2 },
  
  cardFooter: { flexDirection: "row", gap: 8, marginTop: 4 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#f1f5f9", gap: 4 },
  badgeText: { fontSize: 11, color: "#64748b", fontWeight: "500" },
  
  fab: { position: "absolute", bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: "#10b981", justifyContent: "center", alignItems: "center", shadowColor: "#10b981", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  
  emptyBox: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#94a3b8", marginTop: 16 },
});

export default ProductListScreen;
