import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import * as inventoryVoucherApi from "../../api/inventoryVoucherApi";
import { InventoryVoucher } from "../../api/inventoryVoucherApi";

const STATUS_LABEL: any = {
  DRAFT: "Nháp",
  APPROVED: "Đã duyệt",
  POSTED: "Đã ghi sổ",
  CANCELLED: "Đã hủy",
};

const STATUS_COLOR: any = {
  DRAFT: "#94a3b8",
  APPROVED: "#3b82f6",
  POSTED: "#10b981",
  CANCELLED: "#ef4444",
};

const InventoryVoucherDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { currentStore, user } = useAuth();
  const storeId = currentStore?._id || null;
  const voucherId = route.params?.voucherId;

  const [voucher, setVoucher] = useState<InventoryVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = async () => {
    if (!storeId || !voucherId) return;
    try {
      setLoading(true);
      const res = await inventoryVoucherApi.getInventoryVoucherById(storeId, voucherId);
      setVoucher(res.voucher);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể tải chi tiết phiếu");
      navigation.navigate("InventoryVoucherList");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [storeId, voucherId]);

  const handleAction = async (action: string) => {
    if (!storeId || !voucherId) return;
    
    let confirmMsg = "";
    if (action === "approve") confirmMsg = "Xác nhận duyệt phiếu này?";
    if (action === "post") confirmMsg = "Ghi sổ phiếu này? Kho hàng sẽ được cập nhật số lượng tồn.";
    if (action === "cancel") confirmMsg = "Bạn có chắc chắn muốn hủy phiếu này?";
    
    Alert.alert("Xác nhận", confirmMsg, [
      { text: "Quay lại", style: "cancel" },
      {
        text: "Xác nhận",
        onPress: async () => {
          try {
            setActionLoading(true);
            if (action === "approve") await inventoryVoucherApi.approveInventoryVoucher(storeId, voucherId);
            if (action === "post") await inventoryVoucherApi.postInventoryVoucher(storeId, voucherId);
            if (action === "cancel") await inventoryVoucherApi.cancelInventoryVoucher(storeId, voucherId);
            
            Alert.alert("Thành công", "Thao tác đã được thực hiện");
            fetchDetail();
          } catch (error: any) {
            Alert.alert("Lỗi", error?.response?.data?.message || "Không thể thực hiện thao tác");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const formatCurrency = (n: any) => {
    const val = typeof n === 'object' && n?.$numberDecimal ? parseFloat(n.$numberDecimal) : parseFloat(n || 0);
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val || 0);
  };

  const totals = useMemo(() => {
    if (!voucher) return { qty: 0, cost: 0 };
    const qty = (voucher.items || []).reduce((s, it) => s + (it.qty_actual || 0), 0);
    const cost = (voucher.items || []).reduce((s, it) => {
      const uCost = typeof it.unit_cost === 'object' && it.unit_cost?.$numberDecimal ? parseFloat(it.unit_cost.$numberDecimal) : parseFloat(it.unit_cost || 0);
      return s + ((it.qty_actual || 0) * uCost);
    }, 0);
    return { qty, cost };
  }, [voucher]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!voucher) return null;

  const isManager = user?.role === "MANAGER";

  const renderInfoRow = (label: string, value: string | undefined | number, icon: any, fullWidth = false) => (
    <View style={[styles.infoRow, fullWidth && { width: "100%" }]}>
      <View style={styles.infoIconBox}>
        <Ionicons name={icon} size={16} color="#64748b" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "---"}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#10b981", "#059669"]} style={styles.header}>
          <View style={styles.headerTop}>
             <TouchableOpacity onPress={() => navigation.navigate("InventoryVoucherList")} style={styles.headerBack}>
               <Ionicons name="arrow-back" size={24} color="#fff" />
             </TouchableOpacity>
             <View style={styles.badges}>
                <View style={[styles.typeBadge, { backgroundColor: voucher.type === "IN" ? "#dcfce7" : "#fee2e2" }]}>
                  <Text style={[styles.typeText, { color: voucher.type === "IN" ? "#166534" : "#991b1b" }]}>
                    {voucher.type === "IN" ? "📥 NHẬP KHO" : "📤 XUẤT KHO"}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[voucher.status] }]}>
                  <Text style={styles.statusText}>{STATUS_LABEL[voucher.status]}</Text>
                </View>
             </View>
             <TouchableOpacity style={styles.headerBack} onPress={fetchDetail}>
               <Ionicons name="refresh" size={20} color="#fff" />
             </TouchableOpacity>
          </View>
          <Text style={styles.headerCode}>{voucher.voucher_code}</Text>
          <Text style={styles.headerDate}>{new Date(voucher.voucher_date).toLocaleDateString("vi-VN", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>THÔNG TIN CHUNG</Text>
          <View style={styles.grid}>
            {renderInfoRow("Kho lưu trữ", voucher.warehouse_name, "business")}
            {renderInfoRow("Vị trí kho", voucher.warehouse_location, "map")}
            {renderInfoRow("Người tạo", voucher.created_by?.fullname || voucher.created_by?.fullName || "Hệ thống", "person")}
            {renderInfoRow("Chứng từ kèm", voucher.attached_docs, "attach")}
            {renderInfoRow("Số chứng từ gốc", voucher.ref_no, "document-text", true)}
            {renderInfoRow("Ngày chứng từ gốc", voucher.ref_date ? new Date(voucher.ref_date).toLocaleDateString("vi-VN") : "---", "calendar", true)}
            {renderInfoRow("Lý do thực hiện", voucher.reason, "chatbubble-ellipses", true)}
          </View>
        </View>

        {voucher.type === "IN" && (voucher.supplier_name_snapshot || voucher.supplier_id) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>THÔNG TIN NHÀ CUNG CẤP</Text>
            <View style={styles.grid}>
              {renderInfoRow("Tên NCC", voucher.supplier_name_snapshot || voucher.supplier_id?.name, "people", true)}
              {voucher.supplier_phone_snapshot && renderInfoRow("Điện thoại", voucher.supplier_phone_snapshot, "call")}
              {voucher.supplier_email_snapshot && renderInfoRow("Email", voucher.supplier_email_snapshot, "mail")}
              {voucher.supplier_address_snapshot && renderInfoRow("Địa chỉ", voucher.supplier_address_snapshot, "location", true)}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>GIAO NHẬN & XỬ LÝ</Text>
          <View style={styles.grid}>
            {renderInfoRow("Người giao", voucher.deliverer_name, "chevron-forward-circle")}
            {renderInfoRow("SĐT người giao", voucher.deliverer_phone, "call")}
            {renderInfoRow("Người nhận", voucher.receiver_name, "chevron-back-circle")}
            {renderInfoRow("SĐT người nhận", voucher.receiver_phone, "call")}
            
            {(voucher.status === "APPROVED" || voucher.status === "POSTED") && (
              <View style={styles.statusRow}>
                {renderInfoRow("Người duyệt", voucher.approved_by?.fullname || voucher.approved_by?.fullName || "---", "shield-checkmark", true)}
              </View>
            )}
            {voucher.status === "POSTED" && (
              <View style={styles.statusRow}>
                {renderInfoRow("Người ghi sổ", voucher.posted_by?.fullname || voucher.posted_by?.fullName || "---", "cloud-done", true)}
              </View>
            )}
            {voucher.status === "CANCELLED" && (
              <View style={[styles.statusRow, { backgroundColor: "#fee2e2", borderRadius: 12, padding: 8 }]}>
                {renderInfoRow("Người hủy", voucher.cancelled_by?.fullname || voucher.cancelled_by?.fullName || "---", "ban", true)}
                {renderInfoRow("Lý do hủy", voucher.cancel_reason, "help-circle", true)}
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsHeaderTitle}>DANH SÁCH MẶT HÀNG</Text>
            <View style={styles.itemsCountBadge}>
              <Text style={styles.itemsCountText}>{voucher.items.length}</Text>
            </View>
          </View>
          
          {voucher.items.map((it, idx) => (
            <View key={idx} style={[styles.itemRow, idx === voucher.items.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.itemMain}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name_snapshot || it.product_id?.name || "Sản phẩm"}</Text>
                  <Text style={styles.itemSku}>SKU: {it.sku_snapshot || it.product_id?.sku || "N/A"}</Text>
                </View>
                <View style={styles.itemPriceBlock}>
                  <Text style={styles.itemCost}>{formatCurrency(it.unit_cost)}</Text>
                  <Text style={styles.itemQty}>x{it.qty_actual} {it.unit_snapshot || it.product_id?.unit || ""}</Text>
                  {it.expiry_date && (
                    <Text style={[styles.itemSku, { color: "#ef4444", fontWeight: "700", marginTop: 4 }]}>
                      HSD: {new Date(it.expiry_date).toLocaleDateString("vi-VN")}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.itemFooter}>
                <Text style={styles.itemTotalLabel}>Thành tiền:</Text>
                <Text style={styles.itemTotalValue}>{formatCurrency((it.qty_actual || 0) * (typeof it.unit_cost === 'object' && it.unit_cost?.$numberDecimal ? parseFloat(it.unit_cost.$numberDecimal) : parseFloat(it.unit_cost || 0)))}</Text>
              </View>
              {it.note ? (
                <View style={styles.itemNoteRow}>
                  <Ionicons name="chatbox-outline" size={12} color="#94a3b8" />
                  <Text style={styles.itemNoteText}>{it.note}</Text>
                </View>
              ) : null}
            </View>
          ))}
          
          <View style={styles.totalSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tổng số lượng mặt hàng</Text>
              <Text style={styles.summaryValue}>{totals.qty}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: 12 }]}>
              <Text style={styles.summaryLabelTotal}>TỔNG TIỀN PHIẾU</Text>
              <Text style={styles.summaryValueTotal}>{formatCurrency(voucher.total_cost || totals.cost)}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Actions */}
      <View style={styles.actionsFooter}>
        {actionLoading ? (
          <ActivityIndicator color="#10b981" />
        ) : (
          <View style={styles.actionContent}>
            {voucher.status === "DRAFT" && (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => handleAction("cancel")}>
                  <Ionicons name="close-circle" size={18} color="#ef4444" />
                  <Text style={styles.cancelText}>HỦY PHIẾU</Text>
                </TouchableOpacity>
                {isManager && (
                  <TouchableOpacity style={[styles.actionBtn, styles.primaryBtn]} onPress={() => handleAction("approve")}>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={styles.primaryText}>DUYỆT PHIẾU</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {voucher.status === "APPROVED" && (
              isManager ? (
                <TouchableOpacity style={[styles.actionBtn, styles.postedBtn]} onPress={() => handleAction("post")}>
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.primaryText}>GHI SỔ TỒN KHO</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.hintBox}>
                  <Ionicons name="information-circle" size={20} color="#3b82f6" />
                  <Text style={styles.hintText}>Đã duyệt. Chờ Manager ghi sổ tồn kho.</Text>
                </View>
              )
            )}
            {voucher.status === "POSTED" && (
              <View style={[styles.hintBox, { backgroundColor: "#d1fae5" }]}>
                <Ionicons name="checkmark-done-circle" size={22} color="#10b981" />
                <Text style={[styles.hintText, { color: "#065f46" }]}>Phiếu đã hoàn tất và được ghi sổ thành công.</Text>
              </View>
            )}
            {voucher.status === "CANCELLED" && (
              <View style={[styles.hintBox, { backgroundColor: "#fee2e2" }]}>
                <Ionicons name="ban" size={20} color="#ef4444" />
                <Text style={[styles.hintText, { color: "#991b1b" }]}>Phiếu này đã bị hủy bỏ.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 20 },
  header: { padding: 16, paddingTop: Platform.OS === 'ios' ? 50 : 30, alignItems: "center", borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 6, shadowOpacity: 0.1 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 16 },
  headerBack: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20 },
  badges: { flexDirection: "row", gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  typeText: { fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  headerCode: { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  headerDate: { fontSize: 14, color: "rgba(255,255,255,0.9)", marginTop: 6, fontWeight: "600" },
  card: { backgroundColor: "#fff", margin: 16, marginBottom: 0, borderRadius: 24, padding: 20, shadowColor: "#1e293b", shadowOpacity: 0.08, shadowRadius: 15, elevation: 4 },
  cardTitle: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1.2, marginBottom: 16, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  infoRow: { width: "48%", flexDirection: "row", marginBottom: 16 },
  infoIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginRight: 10 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" },
  infoValue: { fontSize: 14, color: "#1e293b", fontWeight: "700", marginTop: 2 },
  statusRow: { width: "100%", marginTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8 },
  itemsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  itemsHeaderTitle: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1.2 },
  itemsCountBadge: { backgroundColor: "#10b981", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  itemsCountText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  itemRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  itemMain: { flexDirection: "row", justifyContent: "space-between" },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b", flex: 1 },
  itemSku: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  itemPriceBlock: { alignItems: "flex-end" },
  itemCost: { fontSize: 13, color: "#64748b", fontWeight: "600" },
  itemQty: { fontSize: 14, fontWeight: "700", color: "#059669", marginTop: 2 },
  itemFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 10, gap: 8 },
  itemNoteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#f8fafc", padding: 8, borderRadius: 8 },
  itemNoteText: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  itemTotalLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  itemTotalValue: { fontSize: 15, fontWeight: "800", color: "#1e293b" },
  totalSummary: { padding: 20, backgroundColor: "#f8fafc", borderTopWidth: 2, borderTopColor: "#f1f5f9", borderStyle: "dashed" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 14, color: "#64748b", fontWeight: "600" },
  summaryValue: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  summaryLabelTotal: { fontSize: 14, color: "#1e293b", fontWeight: "800" },
  summaryValueTotal: { fontSize: 24, fontWeight: "900", color: "#10b981" },
  actionsFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "rgba(255,255,255,0.95)", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  actionContent: {},
  buttonRow: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, height: 54, borderRadius: 16, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8, elevation: 4, shadowOpacity: 0.1 },
  primaryBtn: { backgroundColor: "#10b981" },
  postedBtn: { backgroundColor: "#3b82f6", width: "100%" },
  cancelBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fee2e2" },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cancelText: { color: "#ef4444", fontWeight: "800", fontSize: 15 },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 16, backgroundColor: "#eff6ff" },
  hintText: { flex: 1, fontSize: 14, color: "#1d4ed8", fontWeight: "700" },
});

export default InventoryVoucherDetailScreen;
