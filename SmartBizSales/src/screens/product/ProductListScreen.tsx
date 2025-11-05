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
  Alert,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import * as productApi from "../../api/productApi";
import { Product, ProductStatus } from "../../type/product";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import { File } from "expo-file-system";

// Components
import ProductFormModal from "../../components/product/ProductFormModal";
import ProductGroupFormModal from "../../components/product/ProductGroupFormModal";
import ProductImportModal from "../../components/product/ProductImportModal";
import { ProductExportButton } from "../../components/product/ProductExportButton";
import { TemplateDownloadButton } from "../../components/product/TemplateDownloadButton";
import { ProductImportButton } from "../../components/product/ProductImportButton";

// Định nghĩa interface cho nhóm sản phẩm
interface ProductGroup {
  _id: string;
  name: string;
  description: string;
  productCount: number;
  store: {
    _id: string;
    name: string;
    address: string;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
}

const ProductListScreen: React.FC = () => {
  // Lấy thông tin cửa hàng hiện tại từ context auth
  const { currentStore } = useAuth();
  const storeId = currentStore?._id || null;

  // State quản lý danh sách sản phẩm và sản phẩm đã lọc
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // State quản lý danh sách nhóm sản phẩm
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);

  // State quản lý bộ lọc
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">(
    "all"
  );
  const [searchText, setSearchText] = useState("");

  // State quản lý trạng thái loading
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);

  // State quản lý hiển thị dropdown
  const [groupDropdownVisible, setGroupDropdownVisible] = useState(false);
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  // State quản lý modal
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // ================= HÀM LẤY DANH SÁCH NHÓM SẢN PHẨM =================
  const fetchProductGroups = useCallback(async () => {
    if (!storeId) return;
    try {
      const response = await productApi.getProductGroupsByStore(storeId);
      setProductGroups(response.productGroups);
    } catch (error) {
      console.error("Lỗi load nhóm sản phẩm:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách nhóm sản phẩm");
    }
  }, [storeId]);

  // ================= HÀM LẤY DANH SÁCH SẢN PHẨM =================
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const response = await productApi.getProductsByStore(storeId, {
        page: 1,
        limit: 100,
      });
      setProducts(response.products);
      setFilteredProducts(response.products);
    } catch (error) {
      console.error("Lỗi khi tải danh sách sản phẩm:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách sản phẩm");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProducts();
    fetchProductGroups();
  }, [fetchProducts, fetchProductGroups]);

  // Gọi API khi component được mount hoặc storeId thay đổi
  useEffect(() => {
    fetchProductGroups();
    fetchProducts();
  }, [fetchProductGroups, fetchProducts]);

  // ================= XỬ LÝ LỌC VÀ TÌM KIẾM SẢN PHẨM =================
  useEffect(() => {
    let temp = [...products];

    // Lọc theo nhóm sản phẩm
    if (selectedGroupIds.length > 0) {
      temp = temp.filter((product) => {
        return (
          product.group?._id &&
          selectedGroupIds.includes(product.group?._id.toString())
        );
      });
    }

    // Lọc theo trạng thái
    if (statusFilter !== "all") {
      temp = temp.filter((product) => product.status === statusFilter);
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      temp = temp.filter((product) => {
        const groupName = product.group?.name?.toLowerCase() || "";
        return (
          product.name.toLowerCase().includes(lower) ||
          product.sku.toLowerCase().includes(lower) ||
          groupName.includes(lower) ||
          (product.description &&
            product.description.toLowerCase().includes(lower))
        );
      });
    }

    setFilteredProducts(temp);
  }, [products, selectedGroupIds, statusFilter, searchText, productGroups]);

  // ================= HÀM XỬ LÝ CHỌN/BỎ CHỌN NHÓM SẢN PHẨM =================
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((currentSelectedIds) =>
      currentSelectedIds.includes(groupId)
        ? currentSelectedIds.filter((id) => id !== groupId)
        : [...currentSelectedIds, groupId]
    );
  };

  // ================= XỬ LÝ IMPORT SẢN PHẨM =================
  const handleImportProducts = async (file: any) => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }

    setImporting(true);
    try {
      console.log("📁 Starting import process...", {
        fileName: file.name,
        fileUri: file.uri,
        fileType: file.mimeType,
      });

      // Kiểm tra file trước khi gửi
      const fileObj = new File(file.uri);

      if (!fileObj.exists) {
        throw new Error("File không tồn tại hoặc không thể truy cập");
      }

      console.log("✅ File validation passed");

      // Gọi API import - truyền trực tiếp file object
      const response = await productApi.importProducts(storeId, file);

      console.log("✅ Import API response received");

      // Xử lý response
      const successCount =
        response.results?.success?.length || response.importedCount || 0;

      Alert.alert("Thành công", `Import thành công ${successCount} sản phẩm`);

      setShowImportModal(false);
      fetchProducts();
    } catch (error: any) {
      console.error("❌ Import error details:", {
        message: error.message,
        stack: error.stack,
      });

      let errorMessage = "Import thất bại";

      if (error.message?.includes("File không tồn tại")) {
        errorMessage = "File không tồn tại. Vui lòng chọn file khác.";
      } else if (error.message?.includes("400")) {
        errorMessage =
          "Server không nhận diện được file. Vui lòng thử file khác hoặc liên hệ quản trị viên.";
      } else if (error.message?.includes("Network Error")) {
        errorMessage = "Lỗi kết nối mạng. Vui lòng kiểm tra internet.";
      } else {
        errorMessage = error.message || "Import thất bại";
      }

      Alert.alert("Lỗi Import", errorMessage);
    } finally {
      setImporting(false);
    }
  };

  // ================= XỬ LÝ XÓA NHIỀU SẢN PHẨM =================
  const handleBulkDelete = async () => {
    Alert.alert("Thông báo", "Chức năng đang được phát triển");
    setActionMenuVisible(false);
  };

  // ================= RENDER MỖI SẢN PHẨM TRONG DANH SÁCH =================
  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productSKU}>SKU: {item.sku}</Text>
          <View style={styles.productMeta}>
            <Text style={styles.productPrice}>
              {productApi.formatPrice(item.price)}
            </Text>
            <Text style={styles.productStock}>
              Tồn kho: {item.stock_quantity}
            </Text>
          </View>
          <View style={styles.productDetails}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) },
              ]}
            >
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
            {item.group && (
              <Text style={styles.productGroup}>{item.group.name}</Text>
            )}
            {productApi.isLowStock(item) && (
              <View style={styles.lowStockBadge}>
                <Text style={styles.lowStockText}>Tồn kho thấp</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setEditingProduct(item)}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Lấy màu cho trạng thái
  const getStatusColor = (status: ProductStatus): string => {
    switch (status) {
      case "Đang kinh doanh":
        return "#4caf50";
      case "Ngừng kinh doanh":
        return "#ff9800";
      case "Ngừng bán":
        return "#f44336";
      default:
        return "#666";
    }
  };

  // Hiển thị thông báo nếu chưa chọn cửa hàng
  if (!storeId) {
    return (
      <View style={styles.container}>
        <Text style={styles.noStoreText}>
          Vui lòng chọn cửa hàng để xem danh sách sản phẩm
        </Text>
      </View>
    );
  }

  // Lấy tên các nhóm đang được chọn để hiển thị
  const getSelectedGroupNames = () => {
    return (
      productGroups
        .filter((group) => selectedGroupIds.includes(group._id))
        .map((group) => group.name)
        .join(", ") || "Tất cả nhóm"
    );
  };

  return (
    <View style={styles.container}>
      {/* ================= HEADER VỚI ACTION BUTTONS ================= */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Sản phẩm</Text>
          <Text style={styles.headerSubtitle}>
            {filteredProducts.length} sản phẩm
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setActionMenuVisible(true)}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#2e7d32" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= Ô TÌM KIẾM ================= */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm sản phẩm..."
          placeholderTextColor="#8a8a8a"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ================= KHU VỰC BỘ LỌC ================= */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          {/* Bộ lọc nhóm sản phẩm */}
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setGroupDropdownVisible(!groupDropdownVisible)}
          >
            <Ionicons name="pricetags-outline" size={16} color="#2e7d32" />
            <Text style={styles.filterValueText} numberOfLines={1}>
              {getSelectedGroupNames()}
            </Text>
            <Ionicons
              name={groupDropdownVisible ? "chevron-up" : "chevron-down"}
              size={16}
              color="#2e7d32"
            />
          </TouchableOpacity>

          {/* Bộ lọc trạng thái */}
          <TouchableOpacity
            style={styles.filterDropdown}
            onPress={() => setStatusDropdownVisible(!statusDropdownVisible)}
          >
            <Ionicons name="filter-outline" size={16} color="#2e7d32" />
            <Text style={styles.filterValueText}>
              {statusFilter === "all" ? "Tất cả" : statusFilter}
            </Text>
            <Ionicons
              name={statusDropdownVisible ? "chevron-up" : "chevron-down"}
              size={16}
              color="#2e7d32"
            />
          </TouchableOpacity>
        </View>

        {/* Action buttons row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryAction]}
            onPress={() => setShowProductModal(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Thêm SP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryAction]}
            onPress={() => setShowGroupModal(true)}
          >
            <Ionicons name="folder-open" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Nhóm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= HIỂN THỊ DANH SÁCH SẢN PHẨM ================= */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Đang tải danh sách sản phẩm...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item._id.toString()}
          renderItem={renderProductItem}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2e7d32"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
              <Text style={styles.emptySubtext}>
                {searchText ||
                selectedGroupIds.length > 0 ||
                statusFilter !== "all"
                  ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
                  : "Bắt đầu bằng cách thêm sản phẩm mới"}
              </Text>
              {!searchText &&
                selectedGroupIds.length === 0 &&
                statusFilter === "all" && (
                  <TouchableOpacity
                    style={styles.emptyActionButton}
                    onPress={() => setShowProductModal(true)}
                  >
                    <Text style={styles.emptyActionText}>
                      Thêm sản phẩm đầu tiên
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          }
        />
      )}

      {/* ================= MODAL DROPDOWNS ================= */}

      {/* Modal dropdown chọn nhóm sản phẩm */}
      <Modal
        isVisible={groupDropdownVisible}
        onBackdropPress={() => setGroupDropdownVisible(false)}
        backdropTransitionOutTiming={0}
        style={styles.modal}
      >
        <View style={styles.dropdownModal}>
          <Text style={styles.modalTitle}>Chọn nhóm sản phẩm</Text>
          <ScrollView style={styles.dropdownScroll}>
            {productGroups.map((group) => (
              <TouchableOpacity
                key={group._id}
                style={[
                  styles.dropdownItem,
                  selectedGroupIds.includes(group._id) && styles.selectedItem,
                ]}
                onPress={() => toggleGroupSelection(group._id)}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedGroupIds.includes(group._id) &&
                      styles.selectedItemText,
                  ]}
                >
                  {group.name}
                </Text>
                {selectedGroupIds.includes(group._id) && (
                  <Ionicons name="checkmark" size={20} color="#2e7d32" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => setSelectedGroupIds([])}
            >
              <Text style={styles.modalActionText}>Bỏ chọn</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalActionButton, styles.modalPrimaryAction]}
              onPress={() => setGroupDropdownVisible(false)}
            >
              <Text style={styles.modalActionPrimaryText}>Xong</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal dropdown chọn trạng thái */}
      <Modal
        isVisible={statusDropdownVisible}
        onBackdropPress={() => setStatusDropdownVisible(false)}
        backdropTransitionOutTiming={0}
        style={styles.modal}
      >
        <View style={styles.dropdownModal}>
          <Text style={styles.modalTitle}>Chọn trạng thái</Text>
          {["all", "Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].map(
            (status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.dropdownItem,
                  statusFilter === status && styles.selectedItem,
                ]}
                onPress={() => {
                  setStatusFilter(status as ProductStatus | "all");
                  setStatusDropdownVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    statusFilter === status && styles.selectedItemText,
                  ]}
                >
                  {status === "all" ? "Tất cả trạng thái" : status}
                </Text>
                {statusFilter === status && (
                  <Ionicons name="checkmark" size={20} color="#2e7d32" />
                )}
              </TouchableOpacity>
            )
          )}
        </View>
      </Modal>

      {/* Action Menu Modal */}
      <Modal
        isVisible={actionMenuVisible}
        onBackdropPress={() => setActionMenuVisible(false)}
        backdropTransitionOutTiming={0}
        style={styles.actionModal}
      >
        <View style={styles.actionModalContent}>
          <ProductImportButton
            storeId={storeId}
            onImportSuccess={(result) => {
              console.log("Import thành công:", result);
              fetchProducts();
              setActionMenuVisible(false);
            }}
            onImportError={(error) => {
              console.error("Import lỗi:", error);
              setActionMenuVisible(false);
            }}
            onShowImportModal={() => {
              setActionMenuVisible(false);
              setShowImportModal(true);
            }}
          />

          <TemplateDownloadButton
            onDownloadSuccess={() => {
              console.log("Download template thành công");
              setActionMenuVisible(false);
            }}
            onDownloadError={(error: any) => {
              console.error("Download template lỗi:", error);
              setActionMenuVisible(false);
            }}
          />

          <ProductExportButton
            storeId={storeId}
            onExportSuccess={() => {
              console.log("Export thành công");
              setActionMenuVisible(false);
            }}
            onExportError={(error: any) => {
              console.error("Export lỗi:", error);
              setActionMenuVisible(false);
            }}
          />

          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleBulkDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#e53935" />
            <Text style={[styles.actionMenuText, styles.dangerText]}>
              Xóa nhiều
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionMenuCancel}
            onPress={() => setActionMenuVisible(false)}
          >
            <Text style={styles.actionMenuCancelText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ================= MODALS ================= */}

      {/* Modal chỉnh sửa/thêm sản phẩm */}
      {(editingProduct || showProductModal) && (
        <ProductFormModal
          product={editingProduct || undefined}
          onClose={() => {
            setEditingProduct(null);
            setShowProductModal(false);
          }}
          onSaved={() => {
            setEditingProduct(null);
            setShowProductModal(false);
            fetchProducts();
          }}
        />
      )}

      {/* Modal quản lý nhóm sản phẩm */}
      {showGroupModal && (
        <ProductGroupFormModal
          open={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onSaved={() => {
            setShowGroupModal(false);
            fetchProductGroups();
          }}
          storeId={storeId}
        />
      )}

      {/* Modal import sản phẩm */}
      {showImportModal && (
        <ProductImportModal
          visible={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportProducts}
          loading={importing}
        />
      )}
    </View>
  );
};

export default ProductListScreen;

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fdf8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1b5e20",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  filterDropdown: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 8,
  },
  filterValueText: {
    flex: 1,
    fontSize: 14,
    color: "#2e7d32",
    fontWeight: "500",
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
    borderRadius: 12,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: "#2e7d32",
  },
  secondaryAction: {
    backgroundColor: "#1976d2",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  productList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#2e7d32",
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1b5e20",
    marginBottom: 4,
  },
  productSKU: {
    fontSize: 13,
    color: "#666",
    marginBottom: 8,
  },
  productMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#d32f2f",
  },
  productStock: {
    fontSize: 13,
    color: "#666",
  },
  productDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "500",
  },
  productGroup: {
    fontSize: 12,
    color: "#2e7d32",
    fontStyle: "italic",
  },
  lowStockBadge: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "500",
  },
  editButton: {
    backgroundColor: "#1976d2",
    padding: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  emptyActionButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  emptyActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  noStoreText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 40,
  },
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  dropdownModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  dropdownScroll: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  selectedItem: {
    backgroundColor: "#f1f8e9",
    borderRadius: 8,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  selectedItemText: {
    color: "#2e7d32",
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  modalPrimaryAction: {
    backgroundColor: "#2e7d32",
  },
  modalActionText: {
    color: "#666",
    fontWeight: "600",
  },
  modalActionPrimaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  actionModal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  actionModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 8,
  },
  actionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  actionMenuText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  dangerText: {
    color: "#e53935",
  },
  actionMenuCancel: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  actionMenuCancelText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
});
