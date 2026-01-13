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
  Platform,
  Linking,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as XLSX from "xlsx";
import { Directory, File, Paths } from "expo-file-system";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import { PieChart } from "react-native-gifted-charts";
import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";

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

// ===== VARIANCE TYPES =====
interface VarianceDetail {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  beginningStock: number;
  importQty: number;
  exportQty: number;
  endingStock: number;
  periodCOGS: number;
  costPrice: number;
}

interface VarianceSummary {
  totalProducts: number;
  totalBeginningStock: number;
  totalImportQty: number;
  totalExportQty: number;
  totalEndingStock: number;
  totalCOGS: number;
}

interface VarianceData {
  summary: VarianceSummary;
  details: VarianceDetail[];
  reportPeriod?: {
    from: string;
    to: string;
  };
}

interface VarianceResponse {
  success: boolean;
  message: string;
  data: VarianceData;
}

// ===== COMPONENT =====
const InventoryReportScreen: React.FC = () => {
  const { currentStore, token } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  // ===== STATE =====
  const [activeTab, setActiveTab] = useState<'realtime' | 'variance'>('realtime');
  
  // Realtime Data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");

  // Variance Data
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null);
  const [vPeriodType, setVPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [vDate, setVDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

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

  const filteredVarianceData = useMemo(
    () =>
      varianceData?.details.filter((item) => {
        if (!searchText.trim()) return true;
        const q = searchText.toLowerCase();
        return (
          item.productName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        );
      }) || [],
    [varianceData, searchText]
  );

  const periodKey = useMemo(() => {
    if (vPeriodType === 'month') return dayjs(vDate).format('YYYY-MM');
    if (vPeriodType === 'quarter') {
       const q = Math.floor(vDate.getMonth() / 3) + 1;
       return `${dayjs(vDate).format('YYYY')}-Q${q}`;
    }
    return dayjs(vDate).format('YYYY');
  }, [vPeriodType, vDate]);

  const periodDisplay = useMemo(() => {
    if (vPeriodType === 'month') return `Tháng ${dayjs(vDate).format('MM/YYYY')}`;
    if (vPeriodType === 'quarter') {
      const q = Math.floor(vDate.getMonth() / 3) + 1;
      return `Quý ${q}/${dayjs(vDate).format('YYYY')}`;
    }
    return `Năm ${dayjs(vDate).format('YYYY')}`;
  }, [vPeriodType, vDate]);

  const sanitizeFileName = (name: string) =>
    name.trim().replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").slice(0, 40);

  // ===== API CALLS =====
  const fetchRealtimeReport = async (isRefresh: boolean = false) => {
    if (!storeId) return;
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
      setError(err?.message || "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchVarianceReport = async (isRefresh: boolean = false) => {
    if (!storeId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    
    try {
      const res = await apiClient.get<VarianceResponse>("/inventory-reports/variance", {
        params: {
          storeId,
          periodType: vPeriodType,
          periodKey: periodKey,
        }
      });
      if (res.data.success) {
        setVarianceData(res.data.data);
      } else {
        setVarianceData(null);
        setError(res.data.message || "Không thể tải biến thiên tồn kho");
      }
    } catch (err: any) {
      console.error("❌ Lỗi tải biến thiên:", err);
      setError(err?.message || "Lỗi tải báo cáo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      if (activeTab === 'realtime') fetchRealtimeReport();
      else fetchVarianceReport();
    }
  }, [storeId, activeTab, periodKey, vPeriodType]);

  // ===== ACTIONS =====
  const handleExport = async () => {
    if (activeTab === 'realtime') {
      // Local Export (simplified)
      if (!reportData) return;
      setExporting(true);
      try {
        const now = new Date();
        const ws_data: any[][] = [
          [`BÁO CÁO TỒN KHO HIỆN TẠI - ${storeName}`],
          [`Thời điểm: ${now.toLocaleString("vi-VN")}`],
          [],
          ["STT", "Tên sản phẩm", "Mã SKU", "Tồn kho", "Giá vốn", "Giá trị tồn", "Cảnh báo"],
        ];
        reportData.details.forEach((item) => {
          ws_data.push([
            item.index, item.productName, item.sku, item.closingStock,
            parseFloat(item.costPrice?.$numberDecimal || "0"), item.closingValue,
            item.lowStock ? "Tồn thấp" : "",
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ton kho");
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const dir = new Directory(Paths.document, "reports");
        dir.create({ intermediates: true, idempotent: true });
        const filename = `TonKho_${sanitizeFileName(storeName)}_${dayjs().format('YYYYMMDD')}.xlsx`;
        const file = new File(dir, filename);
        file.create({ intermediates: true, overwrite: true });
        file.write(new Uint8Array(buffer));
        const Sharing = await import("expo-sharing");
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
      } catch (e) { Alert.alert("Lỗi", "Không thể xuất file"); }
      finally { setExporting(false); }
    } else {
      // Backend Export Link
      try {
        const url = `${apiClient.defaults.baseURL}/inventory-reports/export?storeId=${storeId}&type=variance&periodType=${vPeriodType}&periodKey=${periodKey}&format=xlsx&token=${token}`;
        await Linking.openURL(url);
      } catch (e) { Alert.alert("Lỗi", "Không thể mở liên kết tải về"); }
    }
  };

  // ===== RENDER ITEMS =====
  const renderRealtimeItem = ({ item }: { item: ProductDetail }) => {
    const stockColor = item.lowStock ? "#ef4444" : "#10b981";
    const stockPercent = Math.min(100, (item.closingStock / 100) * 100);
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, item.lowStock && { color: "#ef4444" }]} numberOfLines={2}>{item.productName}</Text>
            <View style={styles.skuBadge}><Text style={styles.skuText}>{item.sku}</Text></View>
          </View>
          <View style={styles.stockBadge}>
             <Text style={styles.stockLabel}>Số dư:</Text>
             <Text style={[styles.stockValue, { color: stockColor }]}>{item.closingStock}</Text>
          </View>
        </View>
        <View style={styles.itemDetailGrid}>
           <View style={styles.itemDetailItem}>
              <Text style={styles.itemDetailLabel}>Giá vốn</Text>
              <Text style={styles.itemDetailValue}>{formatCurrency(item.costPrice)}</Text>
           </View>
           <View style={styles.itemDetailItem}>
              <Text style={styles.itemDetailLabel}>Giá trị tồn</Text>
              <Text style={[styles.itemDetailValue, { color: "#f59e0b" }]}>{formatCurrency(item.closingValue)}</Text>
           </View>
        </View>
        <View style={styles.stockIndicator}>
           <View style={[styles.stockIndicatorFill, { width: `${stockPercent}%`, backgroundColor: stockColor }]} />
        </View>
        {item.lowStock && (
           <View style={styles.lowStockWarning}>
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text style={styles.lowStockText}>Cần nhập thêm hàng gấp!</Text>
           </View>
        )}
      </View>
    );
  };

  const renderVarianceItem = ({ item }: { item: VarianceDetail }) => {
    const netChange = (item.importQty || 0) - (item.exportQty || 0);
    const changeColor = netChange > 0 ? "#10b981" : netChange < 0 ? "#ef4444" : "#64748b";

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName} numberOfLines={2}>{item.productName}</Text>
            <View style={styles.skuBadge}><Text style={styles.skuText}>{item.sku}</Text></View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
             <Text style={styles.stockLabel}>Tồn cuối:</Text>
             <Text style={[styles.stockValue, { color: "#2563eb" }]}>{item.endingStock}</Text>
          </View>
        </View>

        <View style={styles.varianceGrid}>
           <View style={styles.varianceCell}>
              <Text style={styles.varianceLabel}>Đầu kỳ</Text>
              <Text style={styles.varianceValue}>{item.beginningStock}</Text>
           </View>
           <View style={styles.varianceCell}>
              <Text style={styles.varianceLabel}>Nhập</Text>
              <Text style={[styles.varianceValue, { color: "#10b981" }]}>+{item.importQty}</Text>
           </View>
           <View style={styles.varianceCell}>
              <Text style={styles.varianceLabel}>Xuất</Text>
              <Text style={[styles.varianceValue, { color: "#ef4444" }]}>-{item.exportQty}</Text>
           </View>
           <View style={styles.varianceCell}>
              <Text style={styles.varianceLabel}>Giá vốn bán</Text>
              <Text style={[styles.varianceValue, { color: "#f59e0b", fontSize: 13 }]}>{formatCurrency(item.periodCOGS)}</Text>
           </View>
        </View>
      </View>
    );
  };

  // ===== MAIN RENDER =====
  if (!storeId) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.centerTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.centerText}>Vui lòng chọn cửa hàng trước khi xem báo cáo.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Báo cáo kho</Text>
            <View style={styles.headerStoreRow}>
              <Ionicons name="storefront-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.headerStore}>{storeName}</Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={handleExport} disabled={exporting || loading}>
              {exporting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={20} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => activeTab === 'realtime' ? fetchRealtimeReport(false) : fetchVarianceReport(false)} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="refresh" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* PRO TAB SWITCHER */}
        <View style={styles.tabContainer}>
           <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'realtime' && styles.tabBtnActive]}
              onPress={() => setActiveTab('realtime')}
           >
              <Ionicons name="cube-outline" size={16} color={activeTab === 'realtime' ? "#10b981" : "#fff"} />
              <Text style={[styles.tabText, activeTab === 'realtime' && styles.tabTextActive]}>Hiện tại</Text>
           </TouchableOpacity>
           <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'variance' && styles.tabBtnActive]}
              onPress={() => setActiveTab('variance')}
           >
              <Ionicons name="trending-up-outline" size={16} color={activeTab === 'variance' ? "#10b981" : "#fff"} />
              <Text style={[styles.tabText, activeTab === 'variance' && styles.tabTextActive]}>Biến thiên</Text>
           </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* FILTER BAR FOR VARIANCE */}
      {activeTab === 'variance' && (
        <View style={styles.filterBar}>
          <View style={styles.filterRow}>
            <TouchableOpacity 
               style={[styles.filterChip, vPeriodType === 'month' && styles.filterChipActive]}
               onPress={() => setVPeriodType('month')}
            >
              <Text style={[styles.filterChipText, vPeriodType === 'month' && styles.filterChipTextActive]}>Tháng</Text>
            </TouchableOpacity>
            <TouchableOpacity 
               style={[styles.filterChip, vPeriodType === 'quarter' && styles.filterChipActive]}
               onPress={() => setVPeriodType('quarter')}
            >
              <Text style={[styles.filterChipText, vPeriodType === 'quarter' && styles.filterChipTextActive]}>Quý</Text>
            </TouchableOpacity>
            <TouchableOpacity 
               style={[styles.filterChip, vPeriodType === 'year' && styles.filterChipActive]}
               onPress={() => setVPeriodType('year')}
            >
              <Text style={[styles.filterChipText, vPeriodType === 'year' && styles.filterChipTextActive]}>Năm</Text>
            </TouchableOpacity>
            
            <View style={styles.verticalDivider} />

            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
               <Ionicons name="calendar-outline" size={16} color="#334155" />
               <Text style={styles.dateSelectorText}>{periodDisplay}</Text>
               <Ionicons name="chevron-down" size={14} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* BODY */}
      <ScrollView 
        style={styles.body} 
        showsVerticalScrollIndicator={false} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => activeTab === 'realtime' ? fetchRealtimeReport(true) : fetchVarianceReport(true)} 
            colors={["#10b981"]} 
          />
        }
      >
        {/* SUMMARY SECTION */}
        {activeTab === 'realtime' && reportData && (
          <View style={styles.summarySection}>
             <View style={styles.chartWrap}>
               <PieChart
                  data={[
                     { value: reportData.summary.totalValue, color: '#10b981' },
                     { value: Math.max(0, reportData.summary.totalValue * 0.2), color: '#d1fae5' }
                  ]}
                  radius={35} innerRadius={22} innerCircleColor={'#fff'} centerLabelComponent={() => <Ionicons name="cube" size={16} color="#10b981" />}
               />
               <View style={{ flex: 1 }}>
                  <Text style={styles.summaryMainLabel}>Tổng giá trị tồn</Text>
                  <Text style={styles.summaryMainValue}>{formatCurrency(reportData.summary.totalValue)}</Text>
               </View>
            </View>
             <View style={styles.summaryChipsRow}>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Mặt hàng</Text>
                <Text style={styles.summaryChipValue}>{reportData.summary.totalProducts}</Text>
              </View>
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipLabel}>Số lượng</Text>
                <Text style={styles.summaryChipValue}>{reportData.summary.totalStock}</Text>
              </View>
              <View style={[styles.summaryChip, lowStockCount > 0 && { backgroundColor: '#fef2f2' }]}>
                <Text style={[styles.summaryChipLabel, lowStockCount > 0 && { color: '#ef4444' }]}>Tồn thấp</Text>
                <Text style={[styles.summaryChipValue, lowStockCount > 0 && { color: '#ef4444' }]}>{lowStockCount}</Text>
              </View>
            </View>
          </View>
        )}

        {/* VARIANCE SUMMARY */}
        {activeTab === 'variance' && varianceData && (
          <View style={styles.summarySection}>
             <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                   <Text style={styles.statLabel}>Nhập trong kỳ</Text>
                   <Text style={[styles.statValue, { color: '#10b981' }]}>+{varianceData.summary.totalImportQty}</Text>
                </View>
                <View style={styles.statCard}>
                   <Text style={styles.statLabel}>Xuất trong kỳ</Text>
                   <Text style={[styles.statValue, { color: '#ef4444' }]}>-{varianceData.summary.totalExportQty}</Text>
                </View>
                <View style={styles.statCard}>
                   <Text style={styles.statLabel}>Giá vốn bán hàng</Text>
                   <Text style={[styles.statValue, { color: '#f59e0b' }]}>{formatCurrency(varianceData.summary.totalCOGS)}</Text>
                </View>
             </View>
          </View>
        )}

        {/* SEARCH BAR */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Tìm sản phẩm, SKU..." 
              placeholderTextColor="#94a3b8" 
              value={searchText} 
              onChangeText={setSearchText} 
            />
            {searchText ? <TouchableOpacity onPress={() => setSearchText("")}><Ionicons name="close-circle" size={18} color="#cbd5e1" /></TouchableOpacity> : null}
          </View>
          <Text style={styles.searchCount}>
             {activeTab === 'realtime' ? filteredData.length : filteredVarianceData.length} SP
          </Text>
        </View>

        {loading && !refreshing && <ActivityIndicator style={{ marginTop: 24 }} color="#10b981" />}

        {/* LIST */}
        {activeTab === 'realtime' ? (
          <FlatList 
            data={filteredData} 
            keyExtractor={(item) => item.productId} 
            renderItem={renderRealtimeItem} 
            scrollEnabled={false} 
            contentContainerStyle={styles.listContent} 
          />
        ) : (
          <FlatList 
            data={filteredVarianceData} 
            keyExtractor={(item) => item.productId} 
            renderItem={renderVarianceItem} 
            scrollEnabled={false} 
            contentContainerStyle={styles.listContent} 
          />
        )}

        {error && (
           <View style={styles.emptyBox}>
              <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
              <Text style={{color: '#ef4444', marginTop: 10}}>{error}</Text>
           </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DATE PICKER MODAL */}
      {showPicker && (
         <View style={{ display: 'none' }}>
            <DateTimePicker
               value={vDate}
               mode="date"
               display="default"
               onChange={(event, date) => {
                  setShowPicker(false);
                  if (date) setVDate(date);
               }}
            />
         </View>
      )}
      {/* IOS Picker Helper - since DateTimePicker behaves differently */}
      {Platform.OS === 'ios' && showPicker && (
         <Modal transparent animationType="slide">
            <View style={styles.pickerOverlay}>
               <View style={styles.pickerSheet}>
                  <View style={styles.pickerHeader}>
                     <TouchableOpacity onPress={() => setShowPicker(false)}>
                        <Text style={{color: '#64748b'}}>Hủy</Text>
                     </TouchableOpacity>
                     <Text style={styles.pickerTitle}>Chọn thời gian</Text>
                     <TouchableOpacity onPress={() => setShowPicker(false)}>
                        <Text style={{color: '#10b981', fontWeight: 'bold'}}>Xong</Text>
                     </TouchableOpacity>
                  </View>
                  <DateTimePicker
                     value={vDate}
                     mode="date"
                     display="spinner"
                     onChange={(event, date) => {
                        if (date) setVDate(date);
                     }}
                  />
               </View>
            </View>
         </Modal>
      )}
    </View>
  );
};

export default InventoryReportScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  centerTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginTop: 16 },
  centerText: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8 },

  header: { padding: 16, paddingTop: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4 },
  headerTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerStoreRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  headerStore: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  headerButtons: { flexDirection: "row", gap: 8 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },

  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.1)', padding: 4, borderRadius: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  tabTextActive: { color: '#059669' },

  filterBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterChipActive: { backgroundColor: '#d1fae5' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterChipTextActive: { color: '#059669' },
  verticalDivider: { width: 1, height: 20, backgroundColor: '#e2e8f0', marginHorizontal: 4 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', flex: 1 },
  dateSelectorText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#334155' },

  body: { flex: 1 },
  summarySection: { padding: 16 },
  chartWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowOpacity: 0.03, elevation: 2 },
  summaryMainLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
  summaryMainValue: { fontSize: 20, fontWeight: '900', color: '#10b981', marginTop: 4 },
  
  summaryChipsRow: { flexDirection: "row", gap: 8 },
  summaryChip: { flex: 1, backgroundColor: "#fff", padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' },
  summaryChipLabel: { fontSize: 10, color: "#94a3b8", fontWeight: '700', marginBottom: 4 },
  summaryChipValue: { fontSize: 14, fontWeight: "900", color: "#334155" },

  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#64748b', fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: '900' },

  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, gap: 10, marginBottom: 8 },
  searchInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b", fontWeight: "600" },
  searchCount: { fontSize: 11, color: "#64748b", fontWeight: "800" },

  listContent: { padding: 16, gap: 12 },
  itemCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, borderWidth: 1, borderColor: "#f1f5f9" },
  itemHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  itemName: { fontSize: 15, fontWeight: "800", color: "#1e293b", marginBottom: 6 },
  skuBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#f1f5f9" },
  skuText: { fontSize: 10, color: "#64748b", fontWeight: "800" },
  stockBadge: { alignItems: 'flex-end' },
  stockLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "800", textTransform: 'uppercase' },
  stockValue: { fontSize: 18, fontWeight: "900" },

  itemDetailGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  itemDetailItem: { flex: 1 },
  itemDetailLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "800", marginBottom: 2 },
  itemDetailValue: { fontSize: 14, fontWeight: "800", color: "#334155" },

  stockIndicator: { height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  stockIndicatorFill: { height: '100%' },

  lowStockWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', padding: 8, borderRadius: 8 },
  lowStockText: { fontSize: 11, color: "#ef4444", fontWeight: "800" },

  varianceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  varianceCell: { width: '48%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  varianceLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  varianceValue: { fontSize: 13, fontWeight: '800', color: '#334155' },

  emptyBox: { alignItems: "center", padding: 40 },
  
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerTitle: { fontWeight: '800', fontSize: 16, color: '#0f172a' },
});
