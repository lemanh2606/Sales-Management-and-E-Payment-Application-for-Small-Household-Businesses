// src/screens/product/ProductListScreen.tsx
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
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import * as productApi from "../../api/productApi";
import { Product, ProductStatus, ImportResponse } from "../../type/product";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";
import { File, Directory, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

// Components
import ProductFormModal from "../../components/product/ProductFormModal";
import ProductGroupFormModal from "../../components/product/ProductGroupFormModal";
import { ProductExportButton } from "../../components/product/ProductExportButton";
import { TemplateDownloadButton } from "../../components/product/TemplateDownloadButton";

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

  // Thêm state mới
  const [importProgress, setImportProgress] = useState<string>("");

  // View mode: "merge" = gộp lô, "split" = tách từng lô (giống web)
  const [viewMode, setViewMode] = useState<"merge" | "split">("merge");

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

  // Logic làm phẳng (flatten) sản phẩm theo lô - giống web
  const flattenProducts = useMemo(() => {
    return products.reduce<any[]>((acc, product) => {
      const batches = product.batches && product.batches.length > 0
        ? product.batches.filter(b => b.quantity > 0)
        : [];

      if (batches.length === 0) {
        // Nếu không có lô hoặc hết hàng -> giữ nguyên 1 dòng
        acc.push({ ...product, uniqueId: product._id, isBatch: false });
      } else {
        // Tách mỗi lô thành 1 dòng
        batches.forEach((batch, index) => {
          acc.push({
            ...product,
            _id: product._id,
            uniqueId: `${product._id}_${batch.batch_no}_${index}`,
            isBatch: true,
            stock_quantity: batch.quantity,
            cost_price: batch.cost_price,
            expiry_date: batch.expiry_date,
            batch_no: batch.batch_no,
            warehouse: batch.warehouse_id || product.default_warehouse_id,
            createdAt: batch.created_at || product.createdAt,
            batches: [batch],
          });
        });
      }
      return acc;
    }, []);
  }, [products]);

  // ================= XỬ LÝ LỌC VÀ TÌM KIẾM SẢN PHẨM =================
  useEffect(() => {
    // Chọn nguồn dữ liệu dựa trên viewMode (giống web)
    const sourceData = viewMode === "split" ? flattenProducts : products;
    let temp = [...sourceData];

    // Lọc theo nhóm sản phẩm
    if (selectedGroupIds.length > 0) {
      temp = temp.filter((product: any) => {
        return (
          product.group?._id &&
          selectedGroupIds.includes(product.group?._id.toString())
        );
      });
    }

    // Lọc theo trạng thái
    if (statusFilter !== "all") {
      temp = temp.filter((product: any) => product.status === statusFilter);
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      temp = temp.filter((product: any) => {
        const groupName = product.group?.name?.toLowerCase() || "";
        const batchNo = (product as any).batch_no?.toLowerCase() || "";
        return (
          product.name?.toLowerCase().includes(lower) ||
          product.sku?.toLowerCase().includes(lower) ||
          groupName.includes(lower) ||
          batchNo.includes(lower) ||
          (product.description && product.description.toLowerCase().includes(lower))
        );
      });
    }

    setFilteredProducts(temp);
  }, [products, flattenProducts, selectedGroupIds, statusFilter, searchText, productGroups, viewMode]);

  // ================= HÀM XỬ LÝ CHỌN/BỎ CHỌN NHÓM SẢN PHẨM =================
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((currentSelectedIds) =>
      currentSelectedIds.includes(groupId)
        ? currentSelectedIds.filter((id) => id !== groupId)
        : [...currentSelectedIds, groupId]
    );
  };

  // Hàm kiểm tra lỗi có thể retry được không
  const isRetryableError = (error: any): boolean => {
    // Các lỗi có thể retry
    if (error.code === "ECONNABORTED") return true; // Timeout
    if (error.message?.includes("timeout")) return true;
    if (error.message?.includes("Network Error")) return true;
    if (error.response?.status >= 500) return true; // Server errors
    if (error.response?.status === 429) return true; // Rate limiting

    // Các lỗi không nên retry
    if (error.response?.status === 400) return false; // Bad request
    if (error.response?.status === 401) return false; // Unauthorized
    if (error.response?.status === 403) return false; // Forbidden
    if (error.response?.status === 413) return false; // Payload too large

    return false;
  };

  // ================= XỬ LÝ CHỌN FILE IMPORT =================
  const handleSelectImportFile = async () => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileAsset = result.assets[0];

      if (!fileAsset) {
        Alert.alert("Lỗi", "Không thể chọn file");
        return;
      }

      // Kiểm tra kích thước file (tối đa 10MB)
      if (fileAsset.size && fileAsset.size > 10 * 1024 * 1024) {
        Alert.alert("Lỗi", "File quá lớn. Vui lòng chọn file nhỏ hơn 10MB");
        return;
      }

      Alert.alert(
        "Xác nhận Import",
        `Bạn có chắc muốn import sản phẩm từ file "${fileAsset.name}"?\n\nQuá trình này có thể mất vài phút.`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Import",
            style: "default",
            onPress: () => handleImportProducts(fileAsset),
          },
        ]
      );
    } catch (error) {
      console.error("Lỗi khi chọn file:", error);
      Alert.alert("Lỗi", "Không thể chọn file. Vui lòng thử lại.");
    }
  };

  // ================= XỬ LÝ IMPORT SẢN PHẨM VỚI RETRY =================
  const handleImportProducts = async (fileAsset: any) => {
    if (!storeId) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }

    setImporting(true);
    setImportProgress("Đang chuẩn bị file...");

    try {
      console.log("🟢 Bắt đầu import process", {
        storeId,
        fileName: fileAsset.name,
        fileSize: fileAsset.size,
        fileType: fileAsset.mimeType,
      });

      // Kiểm tra file cơ bản
      if (!fileAsset.uri) {
        throw new Error("File URI không tồn tại");
      }

      const fileObj = {
        uri: fileAsset.uri,
        name: fileAsset.name || "products_import.xlsx",
        type:
          fileAsset.mimeType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };

      console.log("📤 Gọi API import...", {
        url: `/products/store/${storeId}/import`,
        fileInfo: fileObj,
      });

      // Thêm retry mechanism với exponential backoff
      const maxRetries = 3;
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          setImportProgress(
            `Đang thử import (lần ${attempt}/${maxRetries})...`
          );
          console.log(`🔄 Attempt ${attempt}/${maxRetries}`);

          if (attempt > 1) {
            // Tăng thời gian chờ giữa các lần retry
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            setImportProgress(`Chờ ${delay / 1000}s trước khi thử lại...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          setImportProgress("Đang gửi file đến server...");
          const response: ImportResponse = await productApi.importProducts(
            storeId,
            fileObj
          );

          console.log("✅ Import thành công:", response);

          // Xử lý kết quả theo cấu trúc response mới
          const results = response.results || {};
          const successCount = results.success?.length || 0;
          const failedCount = results.failed?.length || 0;
          const totalCount = results.total || successCount + failedCount;
          const newlyCreated = response.newlyCreated || {
            suppliers: 0,
            productGroups: 0,
            warehouses: 0,
            products: 0,
          };

          let message = "";
          let title = "";

          if (successCount > 0 && failedCount === 0) {
            // Tất cả đều thành công
            title = "🎉 Thành công";
            message = `Import thành công ${successCount} dòng`;

            // Thêm thông tin về đối tượng mới được tạo
            const createdParts: string[] = [];
            if (newlyCreated.products > 0) createdParts.push(`${newlyCreated.products} sản phẩm mới`);
            if (newlyCreated.suppliers > 0) createdParts.push(`${newlyCreated.suppliers} nhà cung cấp`);
            if (newlyCreated.productGroups > 0) createdParts.push(`${newlyCreated.productGroups} nhóm sản phẩm`);
            if (newlyCreated.warehouses > 0) createdParts.push(`${newlyCreated.warehouses} kho hàng`);
            
            if (createdParts.length > 0) {
              message += `\n\nĐã tự động tạo mới:\n• ${createdParts.join("\n• ")}`;
            }
          } else if (successCount > 0 && failedCount > 0) {
            // Một phần thành công
            title = "⚠️ Hoàn thành một phần";
            message = `Import thành công ${successCount}/${totalCount} dòng\n${failedCount} dòng thất bại`;

            // Thêm thông tin về đối tượng mới được tạo
            const createdParts: string[] = [];
            if (newlyCreated.products > 0) createdParts.push(`${newlyCreated.products} sản phẩm mới`);
            if (newlyCreated.suppliers > 0) createdParts.push(`${newlyCreated.suppliers} nhà cung cấp`);
            if (newlyCreated.productGroups > 0) createdParts.push(`${newlyCreated.productGroups} nhóm sản phẩm`);
            if (newlyCreated.warehouses > 0) createdParts.push(`${newlyCreated.warehouses} kho hàng`);
            
            if (createdParts.length > 0) {
              message += `\n\nĐã tạo mới:\n• ${createdParts.join("\n• ")}`;
            }
          } else {
            // Tất cả đều thất bại
            title = "❌ Có lỗi xảy ra";
            message = `Không có sản phẩm nào được import thành công\n${failedCount} dòng thất bại`;
          }

          // Hiển thị chi tiết lỗi nếu có sản phẩm thất bại
          if (failedCount > 0 && results.failed) {
            const errorDetails = results.failed
              .slice(0, 5) // Chỉ hiển thị 5 lỗi đầu tiên
              .map((error: any, index: number) => {
                // Xử lý các loại lỗi khác nhau
                const rowInfo = error.row ? `Dòng ${error.row}: ` : "";
                const errorMsg =
                  error.error || error.message || "Lỗi không xác định";
                const productInfo = error.data?.["Tên sản phẩm"]
                  ? ` (${error.data["Tên sản phẩm"]})`
                  : "";
                return `${index + 1}. ${rowInfo}${errorMsg}${productInfo}`;
              })
              .join("\n");

            message += `\n\nChi tiết lỗi:\n${errorDetails}`;

            if (failedCount > 5) {
              message += `\n...và ${failedCount - 5} lỗi khác`;
            }

            // Thêm gợi ý cho người dùng
            message += `\n\n💡 Mẹo: Kiểm tra lại định dạng file và đảm bảo dữ liệu đúng cấu trúc`;
          }

          // Tạo buttons cho alert
          const alertButtons: any[] = [{ text: "OK", style: "default" }];

          // Thêm nút "Xem chi tiết" nếu có lỗi
          if (failedCount > 0) {
            alertButtons.unshift({
              text: "Xem chi tiết",
              style: "default",
              onPress: () => {
                // Có thể mở modal hiển thị chi tiết kết quả ở đây
                console.log("Chi tiết kết quả import:", results);
                // Hoặc hiển thị modal với toàn bộ lỗi
                showDetailedErrorModal(results.failed);
              },
            });
          }

          // Hiển thị thông báo
          Alert.alert(title, message, alertButtons);

          fetchProducts(); // Refresh danh sách
          setImportProgress("");
          return; // Thoát khỏi hàm khi thành công
        } catch (error: any) {
          lastError = error;
          console.log(`❌ Attempt ${attempt} failed:`, error.message);

          // Nếu không phải lỗi timeout hoặc network, không retry
          if (!isRetryableError(error)) {
            break;
          }

          if (attempt < maxRetries) {
            setImportProgress(`Thử lại lần ${attempt + 1}...`);
            console.log(`🔄 Sẽ thử lại sau...`);
          }
        }
      }

      // Nếu đến đây nghĩa là tất cả retry đều thất bại
      throw lastError;
    } catch (error: any) {
      console.error("🔴 Tất cả retry đều thất bại:", error);

      let userMessage = "Import thất bại";
      if (error.message?.includes("timeout") || error.code === "ECONNABORTED") {
        userMessage =
          "⏰ Server xử lý quá lâu. Vui lòng thử lại với file nhỏ hơn hoặc liên hệ quản trị viên.";
      } else if (error.response?.status === 500) {
        userMessage = "🔄 Server đang quá tải. Vui lòng thử lại sau vài phút.";
      } else if (error.response?.status === 413) {
        userMessage =
          "📁 File quá lớn. Vui lòng chia nhỏ file hoặc sử dụng file có kích thước nhỏ hơn 10MB.";
      } else if (error.response?.status === 400) {
        userMessage =
          "📝 Dữ liệu file không hợp lệ. Vui lòng kiểm tra lại định dạng file và cấu trúc dữ liệu.";
      } else if (error.response?.status === 401) {
        userMessage = "🔐 Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
      } else if (error.response?.status === 403) {
        userMessage = "🚫 Bạn không có quyền thực hiện thao tác này.";
      } else if (error.request) {
        userMessage =
          "📡 Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.";
      } else {
        userMessage = `❌ Lỗi: ${error.message || "Không xác định"}`;
      }

      Alert.alert("Thông báo", userMessage);
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  };

  // Hàm hiển thị modal chi tiết lỗi (tuỳ chọn)
  const showDetailedErrorModal = (failedItems: any[]) => {
    // Bạn có thể implement modal hiển thị chi tiết lỗi ở đây
    // Ví dụ sử dụng Modal component từ react-native
    console.log("Hiển thị modal chi tiết lỗi:", failedItems);

    // Tạm thời hiển thị alert với toàn bộ lỗi
    const detailedMessage = failedItems
      .map((error, index) => {
        const rowInfo = error.row ? `Dòng ${error.row}: ` : "";
        const errorMsg = error.error || error.message || "Lỗi không xác định";
        const productInfo = error.data?.["Tên sản phẩm"]
          ? ` (${error.data["Tên sản phẩm"]})`
          : "";
        return `${index + 1}. ${rowInfo}${errorMsg}${productInfo}`;
      })
      .join("\n\n");

    Alert.alert("Chi tiết lỗi Import", detailedMessage, [
      { text: "Đóng", style: "cancel" },
    ]);
  };

  // ================= XỬ LÝ XÓA NHIỀU SẢN PHẨM =================
  const handleBulkDelete = async () => {
    Alert.alert("Thông báo", "Chức năng đang được phát triển");
    setActionMenuVisible(false);
  };

  // ================= RENDER MỖI SẢN PHẨM TRONG DANH SÁCH =================
  const renderProductItem = ({ item }: { item: Product }) => {
    const batches = item.batches || [];
    const validBatches = batches.filter(b => b.quantity > 0);
    const batchesWithExpiry = validBatches.filter(b => b.expiry_date);
    
    // Sort by expiry date to get nearest
    let nearestExpiry: Date | null = null;
    let expiryColor = "#4caf50";
    if (batchesWithExpiry.length > 0) {
      batchesWithExpiry.sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());
      nearestExpiry = new Date(batchesWithExpiry[0].expiry_date!);
      const diff = (nearestExpiry.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      if (diff < 0) expiryColor = "#f44336";
      else if (diff <= 30) expiryColor = "#ff9800";
    }

    const now = new Date();
    const expiredBatchesCount = batches.filter(b => b.expiry_date && new Date(b.expiry_date) < now).length;
    const validBatchesCount = batches.filter(b => !b.expiry_date || new Date(b.expiry_date) >= now).length;

    // Xác định xem item này có đang bị hết hạn không (dùng cho Split mode hoặc để báo highlight)
    const isExpired = (item as any).isBatch && (item as any).expiry_date && new Date((item as any).expiry_date) < now;

    return (
      <View style={[styles.productCard, isExpired && { borderColor: "#f44336", borderWidth: 1, backgroundColor: "#fff1f0" }]}>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <View style={{ flex: 1 }}>
                  <Text style={[styles.productName, isExpired && { color: "#d32f2f" }]}>{item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.productSKU}>SKU: {item.sku}</Text>
                    {item.unit && <Text style={styles.productUnit}>({item.unit})</Text>}
                  </View>
               </View>
               {/* Badge Hết hạn nổi bật nếu ở chế độ tách lô */}
               {isExpired && (
                  <View style={{ backgroundColor: '#f44336', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                     <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>HẾT HẠN</Text>
                  </View>
               )}
            </View>

            <View style={styles.productMeta}>
              <View>
                <Text style={[styles.productPrice, isExpired && { color: "#d32f2f" }]}>
                  Giá: {productApi.formatPrice((item as any).selling_price || item.price)}
                </Text>
                <Text style={styles.productCostPrice}>
                  Vốn: {productApi.formatPrice(item.cost_price)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.productStock, isExpired && { color: "#d32f2f" }]}>
                  Tồn: {item.stock_quantity} {item.unit || ""}
                </Text>
                {! (item as any).isBatch && validBatches.length > 0 && (
                  <Text style={styles.batchCount}>{validBatches.length} lô còn hàng</Text>
                )}
              </View>
            </View>

            <View style={styles.productDetails}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: isExpired ? "#d32f2f" : getStatusColor(item.status) },
                ]}
              >
                <Text style={styles.statusText}>{isExpired ? "Hết hạn" : item.status}</Text>
              </View>
              
              {item.group && (
                <Text style={styles.productGroup}>{item.group.name}</Text>
              )}

              {/* Hiển thị số lô khi ở chế độ split */}
              {(item as any).batch_no && (
                <View style={[styles.expiryBadge, { backgroundColor: "#1976d2" }]}>
                  <Text style={styles.expiryText}>Lô: {(item as any).batch_no}</Text>
                </View>
              )}

              {productApi.isLowStock(item) && (
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockText}>Tồn kho thấp</Text>
                </View>
              )}

              {/* Hiển thị HSD Gộp hoặc Tách */}
              {viewMode === "split" ? (
                (item as any).expiry_date && (
                  <View style={[styles.expiryBadge, { backgroundColor: expiryColor }]}>
                    <Text style={styles.expiryText}>
                      HSD: {new Date((item as any).expiry_date).toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                )
              ) : (
                // Chế độ gộp: Đếm số lô còn hạn/hết hạn
                <View style={{ flexDirection: 'row', gap: 4 }}>
                   {validBatchesCount > 0 && (
                      <View style={[styles.expiryBadge, { backgroundColor: "#4caf50" }]}>
                         <Text style={styles.expiryText}>{validBatchesCount} lô còn hạn</Text>
                      </View>
                   )}
                   {expiredBatchesCount > 0 && (
                      <View style={[styles.expiryBadge, { backgroundColor: "#f44336" }]}>
                         <Text style={styles.expiryText}>{expiredBatchesCount} lô hết hạn</Text>
                      </View>
                   )}
                   {validBatchesCount === 0 && expiredBatchesCount === 0 && (
                      <Text style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>Không có HSD</Text>
                   )}
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.editButton, isExpired && { backgroundColor: '#d32f2f' }]}
            onPress={() => setEditingProduct(item)}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
          {/* View Mode Toggle */}
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === "split" && styles.viewModeButtonActive]}
            onPress={() => setViewMode(viewMode === "merge" ? "split" : "merge")}
          >
            <Ionicons 
              name={viewMode === "split" ? "list" : "layers"} 
              size={18} 
              color={viewMode === "split" ? "#fff" : "#1976d2"} 
            />
            <Text style={[styles.viewModeText, viewMode === "split" && styles.viewModeTextActive]}>
              {viewMode === "split" ? "Theo lô" : "Gộp"}
            </Text>
          </TouchableOpacity>
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

          {/* Nút Import Products */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.importAction]}
            onPress={handleSelectImportFile}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            )}
            <Text style={styles.actionBtnText}>
              {importing ? "Importing..." : "Import"}
            </Text>
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
          keyExtractor={(item: any) => item.uniqueId || item._id?.toString() || Math.random().toString()}
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
                  <View style={styles.emptyActionButtons}>
                    <TouchableOpacity
                      style={styles.emptyActionButton}
                      onPress={() => setShowProductModal(true)}
                    >
                      <Text style={styles.emptyActionText}>
                        Thêm sản phẩm đầu tiên
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.emptyActionButton,
                        styles.emptyImportButton,
                      ]}
                      onPress={handleSelectImportFile}
                    >
                      <Text
                        style={[styles.emptyActionText, styles.emptyImportText]}
                      >
                        Import từ file Excel
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
            </View>
          }
        />
      )}

      {/* ================= MODAL IMPORT PROGRESS ================= */}
      <Modal
        isVisible={importing}
        backdropOpacity={0.7}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View style={styles.progressModal}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.progressTitle}>Đang Import Sản Phẩm</Text>
          <Text style={styles.progressText}>
            {importProgress || "Đang xử lý file..."}
          </Text>
          <Text style={styles.progressSubtext}>
            Quá trình có thể mất vài phút{"\n"}
            Vui lòng không đóng ứng dụng
          </Text>
        </View>
      </Modal>

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

          <TouchableOpacity
            style={styles.actionMenuItem}
            onPress={handleSelectImportFile}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#2e7d32" />
            <Text style={styles.actionMenuText}>Import sản phẩm</Text>
          </TouchableOpacity>

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
    paddingTop: 5,
    paddingBottom: 5,
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
  importAction: {
    backgroundColor: "#ff9800",
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
  expiryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiryText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "500",
  },
  productUnit: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  productCostPrice: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  batchCount: {
    fontSize: 11,
    color: "#1976d2",
    fontWeight: "500",
    marginTop: 2,
  },
  viewModeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1976d2",
    backgroundColor: "#fff",
    marginRight: 8,
    gap: 4,
  },
  viewModeButtonActive: {
    backgroundColor: "#1976d2",
    borderColor: "#1976d2",
  },
  viewModeText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "500",
  },
  viewModeTextActive: {
    color: "#fff",
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
  emptyActionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  emptyActionButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyImportButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#2e7d32",
  },
  emptyActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyImportText: {
    color: "#2e7d32",
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
  // Thêm styles cho progress modal
  progressModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1b5e20",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  progressText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  progressSubtext: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
  },
});
