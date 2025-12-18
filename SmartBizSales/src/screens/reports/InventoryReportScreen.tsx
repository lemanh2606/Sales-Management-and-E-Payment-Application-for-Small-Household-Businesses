// src/screens/reports/InventoryReportScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as XLSX from "xlsx";
import { Directory, File, Paths } from "expo-file-system";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";

// ===== TYPES =====
interface MongoDecimal {
  $numberDecimal: string;
}

interface SummaryInfo {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
}

interface ProductDetail {
  index: number;
  productId: string;
  productName: string;
  sku: string;
  closingStock: number;
  costPrice: MongoDecimal;
  closingValue: number;
  lowStock: boolean;
}

interface ReportData {
  summary: SummaryInfo;
  details: ProductDetail[];
}

interface ReportResponse {
  success: boolean;
  message: string;
  data: ReportData;
}

// ===== COMPONENT =====
const InventoryReportScreen: React.FC = () => {
  const { currentStore } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");

  // ===== HELPERS =====
  const formatCurrency = (value: number | MongoDecimal): string => {
    const numValue =
      typeof value === "object" && (value as MongoDecimal)?.$numberDecimal
        ? parseFloat((value as MongoDecimal).$numberDecimal)
        : Number(value || 0);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(numValue);
  };

  const lowStockCount = useMemo(
    () => reportData?.details.filter((item) => item.lowStock).length || 0,
    [reportData]
  );

  const filteredData = useMemo(
    () =>
      reportData?.details.filter((item) => {
        if (!searchText.trim()) return true;
        const q = searchText.toLowerCase();
        return (
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        );
      }) || [],
    [reportData, searchText]
  );

  const formatDateFile = (d: Date) => {
    // yyyy-mm-dd
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const sanitizeFileName = (name: string) =>
    name
      .trim()
      .replace(/[\/\\?%*:|"<>]/g, "-")
      .replace(/\s+/g, "_")
      .slice(0, 40);

  // ===== API CALL =====
  const fetchRealtimeReport = async (isRefresh: boolean = false) => {
    if (!storeId) {
      setError("Không tìm thấy cửa hàng. Vui lòng chọn cửa hàng trước.");
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<ReportResponse>("/inventory-reports", {
        params: { storeId },
      });

      if (res.data.success) {
        setReportData(res.data.data);
      } else {
        setReportData(null);
        setError(res.data.message || "Không thể tải báo cáo tồn kho");
      }
    } catch (err: any) {
      console.error("❌ Lỗi tải tồn kho:", err);
      setReportData(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tải báo cáo tồn kho"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (storeId) fetchRealtimeReport(false);
  }, [storeId]);

  // ===== EXPORT EXCEL (expo-file-system NEW API) =====
  const exportExcel = async () => {
    if (!reportData) {
      Alert.alert(
        "Chưa có dữ liệu",
        "Vui lòng tải báo cáo trước khi xuất Excel."
      );
      return;
    }

    setExporting(true);
    try {
      const now = new Date();
      const ws_data: any[][] = [
        [`BÁO CÁO TỒN KHO HIỆN TẠI - ${storeName}`],
        [`Thời điểm: ${now.toLocaleString("vi-VN")}`],
        [],
        [
          "STT",
          "Tên sản phẩm",
          "Mã SKU",
          "Tồn kho",
          "Giá vốn",
          "Giá trị tồn",
          "Cảnh báo",
        ],
      ];

      reportData.details.forEach((item) => {
        ws_data.push([
          item.index,
          item.productName,
          item.sku,
          item.closingStock,
          parseFloat(item.costPrice?.$numberDecimal || "0"),
          item.closingValue,
          item.lowStock ? "Tồn thấp" : "",
        ]);
      });

      ws_data.push([]);
      ws_data.push([
        "TỔNG CỘNG",
        "",
        "",
        reportData.summary.totalStock,
        "",
        reportData.summary.totalValue,
        "",
      ]);

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ton kho hien tai");

      // Xuất ra ArrayBuffer -> Uint8Array
      const buffer = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      }) as ArrayBuffer;
      const bytes = new Uint8Array(buffer);

      // Lưu file vào Document/reports
      const dir = new Directory(Paths.document, "reports");
      dir.create({ intermediates: true, idempotent: true });

      const filename = `TonKho_HienTai_${sanitizeFileName(storeName)}_${formatDateFile(now)}.xlsx`;
      const file = new File(dir, filename);
      file.create({ intermediates: true, overwrite: true });
      file.write(bytes);

      // Share (nếu có expo-sharing thì share luôn, không thì báo đường dẫn)
      let shared = false;
      try {
        const Sharing = await import("expo-sharing");
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: "Xuất báo cáo tồn kho",
            UTI: "com.microsoft.excel.xlsx",
          });
          shared = true;
        }
      } catch {
        // app chưa cài expo-sharing -> bỏ qua
      }

      if (!shared) {
        Alert.alert(
          "Xuất Excel thành công",
          `Đã lưu file:\n${file.uri}\n\n(Gợi ý: cài expo-sharing để mở hộp thoại chia sẻ)`
        );
      }
    } catch (err: any) {
      console.error("❌ Export excel error:", err);
      Alert.alert("Lỗi", err?.message || "Không thể xuất Excel");
    } finally {
      setExporting(false);
    }
  };

  // ===== RENDER ITEM =====
  const renderProductItem = ({ item }: { item: ProductDetail }) => {
    const stockColor = item.lowStock ? "#f97316" : "#16a34a";

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeaderRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {item.lowStock && (
              <Ionicons
                name="warning"
                size={16}
                color="#ef4444"
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={[styles.itemName, item.lowStock && { color: "#b91c1c" }]}
              numberOfLines={2}
            >
              {item.index}. {item.productName}
            </Text>
          </View>
          <View style={styles.skuBadge}>
            <Text style={styles.skuText}>{item.sku}</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Tồn kho</Text>
          <Text style={[styles.itemValue, { color: stockColor }]}>
            {item.closingStock}
          </Text>
        </View>

        <View style={styles.itemRow}>
          <Text style={styles.itemLabel}>Giá vốn</Text>
          <Text style={styles.itemValue}>{formatCurrency(item.costPrice)}</Text>
        </View>

        <View style={styles.itemRow}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#0ea5e9"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.itemLabel}>Giá trị tồn</Text>
          </View>
          <Text style={[styles.itemValue, { color: "#f59e0b", fontSize: 15 }]}>
            {formatCurrency(item.closingValue)}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusTag,
              item.lowStock ? styles.statusTagDanger : styles.statusTagNormal,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: item.lowStock ? "#ef4444" : "#22c55e" },
              ]}
            />
            <Text
              style={[styles.statusText, item.lowStock && { color: "#b91c1c" }]}
            >
              {item.lowStock ? "Tồn kho thấp" : "Bình thường"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ===== GUARD: CHƯA CHỌN CỬA HÀNG =====
  if (!storeId) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.centerTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.centerText}>
          Vui lòng chọn cửa hàng trước khi xem báo cáo tồn kho.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={["#10b981", "#10b981", "#10b981"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Báo cáo tồn kho</Text>
            <View style={styles.headerStoreRow}>
              <Ionicons
                name="storefront-outline"
                size={14}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={styles.headerStore}>{storeName}</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Dữ liệu tồn kho cập nhật theo thời gian thực
            </Text>
          </View>

          <View style={styles.headerButtons}>
            {/* Export Excel */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={exportExcel}
              disabled={exporting || loading || !reportData}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#fff" />
              )}
            </TouchableOpacity>

            {/* Refresh */}
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => fetchRealtimeReport(false)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* SUMMARY CHIP ROW */}
        {reportData && (
          <View style={styles.summaryChipsRow}>
            <View style={styles.summaryChip}>
              <Ionicons name="cube-outline" size={16} color="#e0f2fe" />
              <Text style={styles.summaryChipLabel}>Sản phẩm</Text>
              <Text style={styles.summaryChipValue}>
                {reportData.summary.totalProducts}
              </Text>
            </View>

            <View style={styles.summaryChip}>
              <Ionicons name="layers-outline" size={16} color="#dcfce7" />
              <Text style={styles.summaryChipLabel}>Tổng tồn</Text>
              <Text style={styles.summaryChipValue}>
                {reportData.summary.totalStock}
              </Text>
            </View>

            <View style={styles.summaryChip}>
              <Ionicons name="cash-outline" size={16} color="#fef3c7" />
              <Text style={styles.summaryChipLabel}>Giá trị tồn</Text>
              <Text style={styles.summaryChipValue} numberOfLines={1}>
                {formatCurrency(reportData.summary.totalValue)}
              </Text>
            </View>

            <View style={styles.summaryChip}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={lowStockCount > 0 ? "#fee2e2" : "#dcfce7"}
              />
              <Text style={styles.summaryChipLabel}>Tồn thấp</Text>
              <Text
                style={[
                  styles.summaryChipValue,
                  lowStockCount > 0 && { color: "#fee2e2" },
                ]}
              >
                {lowStockCount}/{reportData.summary.totalProducts}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* BODY */}
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRealtimeReport(true)}
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
      >
        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color="#b91c1c" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close-circle" size={20} color="#b91c1c" />
            </TouchableOpacity>
          </View>
        )}

        {/* Info realtime */}
        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={20} color="#2563eb" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.infoTitle}>Tồn kho hiện tại</Text>
            <Text style={styles.infoDesc}>
              Mỗi phiếu nhập, xuất, bán hàng sẽ tự động cập nhật số lượng tồn
              ngay tại đây.
            </Text>
          </View>
        </View>

        {/* Search + Count */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search-outline"
              size={18}
              color="#6b7280"
              style={{ marginRight: 6 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm sản phẩm hoặc mã SKU..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>

          {reportData && (
            <Text style={styles.searchCount}>
              {filteredData.length}/{reportData.summary.totalProducts} mặt hàng
            </Text>
          )}
        </View>

        {/* Loading */}
        {loading && !refreshing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingLabel}>
              Đang tải tồn kho hiện tại...
            </Text>
          </View>
        )}

        {/* Empty */}
        {!loading && reportData && reportData.details.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={40} color="#9ca3af" />
            <Text style={styles.emptyTitle}>Chưa có sản phẩm nào</Text>
            <Text style={styles.emptyDesc}>
              Vui lòng tạo sản phẩm và nhập kho để xem báo cáo tồn.
            </Text>
          </View>
        )}

        {/* List */}
        {!loading && reportData && reportData.details.length > 0 && (
          <FlatList
            data={filteredData}
            keyExtractor={(item) => item.productId}
            renderItem={renderProductItem}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default InventoryReportScreen;

// ===== STYLES =====
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 32,
  },
  centerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 6,
    textAlign: "center",
  },
  centerText: { fontSize: 14, color: "#6b7280", textAlign: "center" },

  header: {
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
    backgroundColor: "#10b981",
  },
  headerTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerStoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  headerStore: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 13,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 4,
    color: "rgba(241,245,249,0.95)",
    fontSize: 12,
  },
  headerButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.12)",
  },

  summaryChipsRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryChip: {
    flex: 1,
    minWidth: "45%",
    maxWidth: "48%",
    backgroundColor: "rgba(15,23,42,0.16)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  summaryChipLabel: { fontSize: 11, color: "rgba(226,232,240,0.92)" },
  summaryChipValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "800",
    color: "#f9fafb",
  },

  body: { flex: 1 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 8,
  },
  errorText: { flex: 1, fontSize: 13, color: "#b91c1c", fontWeight: "600" },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d4ed8",
    marginBottom: 2,
  },
  infoDesc: { fontSize: 12, color: "#1e40af" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  searchCount: { fontSize: 11, color: "#6b7280", fontWeight: "600" },

  loadingBox: { alignItems: "center", paddingVertical: 32 },
  loadingLabel: { marginTop: 10, fontSize: 14, color: "#6b7280" },

  emptyBox: { marginHorizontal: 16, marginTop: 32, alignItems: "center" },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  emptyDesc: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },

  listContent: { paddingHorizontal: 16, paddingTop: 12 },

  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  itemName: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
  skuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  skuText: { fontSize: 11, color: "#1d4ed8", fontWeight: "700" },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  itemLabel: { fontSize: 12, color: "#6b7280" },
  itemValue: { fontSize: 14, fontWeight: "700", color: "#111827" },

  statusRow: { marginTop: 8, flexDirection: "row", justifyContent: "flex-end" },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusTagDanger: { backgroundColor: "#fef2f2" },
  statusTagNormal: { backgroundColor: "#ecfdf5" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: "700", color: "#166534" },
});
