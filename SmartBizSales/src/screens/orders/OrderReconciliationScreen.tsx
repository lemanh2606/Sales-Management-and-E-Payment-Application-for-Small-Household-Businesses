// src/screens/orders/OrderReconciliationScreen.tsx
import React, { FC, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import dayjs from "dayjs";

import { useAuth } from "../../context/AuthContext"; // chỉnh path cho đúng dự án app của bạn
import apiClient from "../../api/apiClient"; // giống TaxDeclarationScreen

// ====== TYPES giống web ======

type DecimalValue =
  | number
  | string
  | { $numberDecimal?: string }
  | null
  | undefined;

interface CustomerInfo {
  name?: string;
  phone?: string;
}

interface EmployeeInfo {
  fullName?: string;
}

interface PaidOrder {
  _id: string;
  totalAmount: DecimalValue;
  paymentMethod: "cash" | "qr";
  updatedAt: string;
  createdAt: string;
  printCount?: number;
  customer?: CustomerInfo;
  employeeId?: EmployeeInfo;
}

interface OrderItemDetail {
  _id: string;
  quantity: number;
  priceAtTime: DecimalValue;
  subtotal: DecimalValue;
  productName?: string;
  productSku?: string;
}

interface OrderDetail extends PaidOrder {
  items?: OrderItemDetail[];
  storeId?: { name?: string };
}

interface PrintPreviewData {
  orderId: string;
  createdAt?: string;
  printCount?: number;
  paymentMethod?: PaidOrder["paymentMethod"];
  totalAmount: number;
  employeeName?: string;
  customerName?: string;
  customerPhone?: string;
  cart: {
    name: string;
    quantity: number;
    unit: string;
    subtotal: string;
    sku?: string;
    priceAtTime?: string;
    price: number;
  }[];
}

interface ValidationCheck {
  field: string;
  label: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

interface ValidationResult {
  message: string;
  summary: {
    totalChecks: number;
    mismatched: number;
    status: string;
    textPreview: string;
  };
  checks: ValidationCheck[];
}

type PaymentFilter = "all" | "cash" | "qr";

// ====== HELPERS ======

const formatCurrency = (value: DecimalValue) => {
  if (value == null) return "0đ";
  if (typeof value === "number") return value.toLocaleString("vi-VN") + "đ";
  if (typeof value === "string")
    return Number(value).toLocaleString("vi-VN") + "đ";
  if (typeof value === "object" && value.$numberDecimal) {
    return Number(value.$numberDecimal).toLocaleString("vi-VN") + "đ";
  }
  return "0đ";
};

const decimalToNumber = (value: DecimalValue) => {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && value.$numberDecimal) {
    const parsed = Number(value.$numberDecimal);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const mapItemsToCart = (items: OrderItemDetail[] = []) =>
  items.map((item) => {
    const price = decimalToNumber(item.priceAtTime);
    const subtotal = decimalToNumber(item.subtotal);
    return {
      name: item.productName || "Sản phẩm",
      quantity: item.quantity,
      unit: "cái",
      subtotal: subtotal.toString(),
      sku: item.productSku,
      priceAtTime: price.toString(),
      price,
    };
  });

// ====== SCREEN ======

const OrderReconciliationScreen: FC = () => {
  const { token, currentStore } = useAuth();
  const storeId = currentStore?._id; // trên app store dùng id, không phải _id [file:72]
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<PaidOrder[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");

  // in hóa đơn
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printPreview, setPrintPreview] = useState<PrintPreviewData | null>(
    null
  );
  const [printModalVisible, setPrintModalVisible] = useState(false);

  // đối soát PDF
  const [reconcileVisible, setReconcileVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PaidOrder | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);

  // ====== API CALLS (dựa trên orderApi web) ======

  const loadOrders = async () => {
    if (!storeId || !token) return;

    setLoading(true);
    try {
      // GET /orders/reconciliation/paid-not-printed?storeId=...
      const res: any = await apiClient.get(
        "/orders/reconciliation/paid-not-printed",
        {
          params: { storeId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOrders(res.data.orders || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Không thể tải danh sách đối soát";
      Alert.alert("Lỗi", msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPrint = async (order: PaidOrder) => {
    if (!storeId || !token) {
      Alert.alert(
        "Thiếu thông tin",
        "Vui lòng đăng nhập và chọn cửa hàng trước khi in hóa đơn"
      );
      return;
    }
    if (previewingId) return;

    setPreviewingId(order._id);
    try {
      // GET /orders/:id?storeId=...
      const res: any = await apiClient.get(`/orders/${order._id}`, {
        params: { storeId },
        headers: { Authorization: `Bearer ${token}` },
      });
      const detail: OrderDetail | undefined = res.data.order;
      if (!detail) throw new Error("Không tìm thấy dữ liệu hóa đơn");

      setPrintPreview({
        orderId: detail._id,
        createdAt: detail.createdAt,
        printCount: detail.printCount,
        paymentMethod: detail.paymentMethod,
        totalAmount: decimalToNumber(detail.totalAmount),
        employeeName: detail.employeeId?.fullName,
        customerName: detail.customer?.name,
        customerPhone: detail.customer?.phone,
        cart: mapItemsToCart(detail.items),
      });
      setPrintModalVisible(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Không thể tải hóa đơn";
      Alert.alert("Lỗi", msg);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleConfirmPrint = async () => {
    if (!printPreview || printingId) return;
    if (!storeId || !token) return;

    try {
      setPrintingId(printPreview.orderId);
      // POST /orders/:id/print-bill
      await apiClient.post(
        `/orders/${printPreview.orderId}/print-bill`,
        { storeId },
        {
          params: { storeId },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Alert.alert("Thành công", "In hóa đơn thành công");
      setPrintModalVisible(false);
      setPrintPreview(null);
      await loadOrders();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "In hóa đơn thất bại";
      Alert.alert("Lỗi", msg);
    } finally {
      setPrintingId(null);
    }
  };

  const handleOpenReconcile = (order: PaidOrder) => {
    setSelectedOrder(order);
    setSelectedPdfName(null);
    setValidationResult(null);
    setReconcileVisible(true);
  };

  const handlePickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      setSelectedPdfName(file.name || "invoice.pdf");
      // giữ lại file trong state khác nếu cần, ở đây dùng lại asset
      (selectedOrder as any)._pickedFile = file;
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể chọn file PDF");
    }
  };

  const handleValidate = async () => {
    if (!selectedOrder || !token || !storeId) return;

    const file = (selectedOrder as any)._pickedFile as
      | DocumentPicker.DocumentPickerAsset
      | undefined;
    if (!file) {
      Alert.alert(
        "Thiếu file",
        "Vui lòng chọn file PDF hóa đơn trước khi đối soát"
      );
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("storeId", String(storeId));
      // expo-document-picker trả về uri, name, mimeType
      formData.append("invoice", {
        uri: file.uri,
        name: file.name || "invoice.pdf",
        type: file.mimeType || "application/pdf",
      } as any);

      // POST /orders/:id/reconciliation/verify-invoice
      const res = await apiClient.post(
        `/orders/${selectedOrder._id}/reconciliation/verify-invoice`,
        formData,
        {
          params: { storeId },
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setValidationResult(res.data as ValidationResult);
      Alert.alert(
        "Kết quả",
        (res.data as ValidationResult).message || "Đối soát thành công"
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Đối soát thất bại";
      Alert.alert("Lỗi", msg);
    } finally {
      setValidating(false);
    }
  };

  // ====== FILTERED ORDERS ======

  const filteredOrders = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesPayment =
        paymentFilter === "all" ? true : order.paymentMethod === paymentFilter;

      if (!normalized) {
        return matchesPayment;
      }

      const orderId = order._id?.toLowerCase() || "";
      const orderIdShort = orderId.slice(-8);
      const customerName = order.customer?.name?.toLowerCase() || "";
      const customerPhone = order.customer?.phone?.toLowerCase() || "";
      const employeeName = order.employeeId?.fullName?.toLowerCase() || "";

      const matchesSearch =
        orderId.includes(normalized) ||
        orderIdShort.includes(normalized) ||
        customerName.includes(normalized) ||
        customerPhone.includes(normalized) ||
        employeeName.includes(normalized);

      return matchesPayment && matchesSearch;
    });
  }, [orders, paymentFilter, searchTerm]);

  // ====== EFFECTS ======

  useEffect(() => {
    if (storeId && token) {
      loadOrders();
    }
  }, [storeId, token]);

  // ====== RENDER ======

  if (!storeId || !token) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={56} color="#faad14" />
        <Text style={styles.errorTitle}>
          Vui lòng đăng nhập và chọn cửa hàng
        </Text>
        <Text style={styles.errorText}>
          Chức năng đối soát hóa đơn chỉ hoạt động khi cửa hàng đang được chọn.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#1890ff", "#096dd9"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Ionicons name="receipt-outline" size={28} color="#fff" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Đối soát hóa đơn</Text>
              <Text style={styles.headerSubtitle}>{storeName}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={loadOrders}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="refresh" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <ScrollView style={styles.content}>
        {/* FILTER BAR */}
        <View style={styles.filterCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm mã đơn, tên khách, SĐT, nhân viên..."
            placeholderTextColor="#bfbfbf"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />

          <View style={styles.filterRow}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Thanh toán</Text>
              <View style={styles.segmentGroup}>
                {[
                  { value: "all", label: "Tất cả" },
                  { value: "cash", label: "Tiền mặt" },
                  { value: "qr", label: "QR" },
                ].map((opt) => {
                  const selected = paymentFilter === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.segmentItem,
                        selected && styles.segmentItemActive,
                      ]}
                      onPress={() =>
                        setPaymentFilter(opt.value as PaymentFilter)
                      }
                    >
                      <Text
                        style={[
                          styles.segmentItemText,
                          selected && styles.segmentItemTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* LIST */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            Hóa đơn đã thanh toán nhưng chưa in
          </Text>

          {loading && orders.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Đang tải danh sách...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={72} color="#d9d9d9" />
              <Text style={styles.emptyText}>
                Không còn hóa đơn cần đối soát
              </Text>
              <Text style={styles.emptySubtext}>
                Hãy thay đổi điều kiện lọc hoặc làm mới danh sách.
              </Text>
            </View>
          ) : (
            filteredOrders.map((order) => {
              const shortId = order._id.slice(-8);
              const isPrinted = (order.printCount ?? 0) > 0;
              return (
                <View key={order._id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderCode}>#{shortId}</Text>
                      <Text style={styles.orderDate}>
                        Cập nhật:{" "}
                        {dayjs(order.updatedAt).format("DD/MM/YYYY HH:mm")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPrinted ? "#f0f5ff" : "#fff7e6",
                          borderColor: isPrinted ? "#2f54eb" : "#fa8c16",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          {
                            color: isPrinted ? "#2f54eb" : "#fa8c16",
                          },
                        ]}
                      >
                        {isPrinted ? "Đã in" : "Chưa in"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Khách:</Text>
                    <Text style={styles.orderValue}>
                      {order.customer?.name || "Khách vãng lai"}
                    </Text>
                  </View>
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>SĐT:</Text>
                    <Text style={styles.orderValue}>
                      {order.customer?.phone || "—"}
                    </Text>
                  </View>
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Nhân viên:</Text>
                    <Text style={styles.orderValue}>
                      {order.employeeId?.fullName || "—"}
                    </Text>
                  </View>
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Tổng tiền:</Text>
                    <Text style={styles.orderTotal}>
                      {formatCurrency(order.totalAmount)}
                    </Text>
                  </View>

                  <View style={styles.orderFooter}>
                    <View style={styles.methodTag}>
                      <Ionicons
                        name={
                          order.paymentMethod === "cash"
                            ? "cash-outline"
                            : "qr-code-outline"
                        }
                        size={16}
                        color={
                          order.paymentMethod === "cash" ? "#52c41a" : "#1890ff"
                        }
                      />
                      <Text
                        style={[
                          styles.methodText,
                          {
                            color:
                              order.paymentMethod === "cash"
                                ? "#52c41a"
                                : "#1890ff",
                          },
                        ]}
                      >
                        {order.paymentMethod === "cash"
                          ? "Tiền mặt"
                          : "QR Code"}
                      </Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handlePreviewPrint(order)}
                      >
                        <Ionicons
                          name="print-outline"
                          size={18}
                          color="#1890ff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleOpenReconcile(order)}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={18}
                          color="#fa8c16"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL XÁC NHẬN IN */}
      <Modal
        visible={printModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPrintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận in hóa đơn</Text>
              <TouchableOpacity onPress={() => setPrintModalVisible(false)}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>

            {printPreview && (
              <View style={styles.modalBody}>
                <Text style={styles.detailLine}>
                  Mã hóa đơn:{" "}
                  <Text style={styles.detailStrong}>
                    #{printPreview.orderId.slice(-8)}
                  </Text>
                </Text>
                <Text style={styles.detailLine}>
                  Khách hàng: {printPreview.customerName || "Khách vãng lai"}
                </Text>
                <Text style={styles.detailLine}>
                  SĐT: {printPreview.customerPhone || "—"}
                </Text>
                <Text style={styles.detailLine}>
                  Nhân viên: {printPreview.employeeName || "—"}
                </Text>
                <Text style={styles.detailLine}>
                  Tổng tiền:{" "}
                  <Text style={styles.detailStrong}>
                    {formatCurrency(printPreview.totalAmount)}
                  </Text>
                </Text>
                <Text style={styles.detailLine}>
                  Phương thức:{" "}
                  {printPreview.paymentMethod === "cash"
                    ? "Tiền mặt"
                    : "QR Code"}
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleConfirmPrint}
                  disabled={!!printingId}
                >
                  {printingId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="print-outline" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>
                        Xác nhận in & trừ kho
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL ĐỐI SOÁT PDF */}
      <Modal
        visible={reconcileVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReconcileVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đối soát hóa đơn PDF</Text>
              <TouchableOpacity onPress={() => setReconcileVisible(false)}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody}>
                <Text style={styles.detailLine}>
                  Mã hóa đơn:{" "}
                  <Text style={styles.detailStrong}>{selectedOrder._id}</Text>
                </Text>
                <Text style={styles.detailLine}>
                  Khách hàng: {selectedOrder.customer?.name || "Khách vãng lai"}
                </Text>
                <Text style={styles.detailLine}>
                  SĐT: {selectedOrder.customer?.phone || "—"}
                </Text>
                <Text style={styles.detailLine}>
                  Tổng tiền:{" "}
                  <Text style={styles.detailStrong}>
                    {formatCurrency(selectedOrder.totalAmount)}
                  </Text>
                </Text>
                <Text style={styles.detailLine}>
                  Thanh toán:{" "}
                  {selectedOrder.paymentMethod === "cash"
                    ? "Tiền mặt"
                    : "QR Code"}
                </Text>
                <Text style={styles.detailLine}>
                  Cập nhật:{" "}
                  {dayjs(selectedOrder.updatedAt).format("DD/MM/YYYY HH:mm")}
                </Text>

                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={handlePickPdf}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={20}
                    color="#1890ff"
                  />
                  <Text style={styles.outlineButtonText}>
                    {selectedPdfName || "Chọn file PDF hóa đơn"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    {
                      marginTop: 12,
                      opacity: selectedPdfName ? 1 : 0.5,
                    },
                  ]}
                  disabled={!selectedPdfName || validating}
                  onPress={handleValidate}
                >
                  {validating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.primaryButtonText}>
                        Đối soát ngay
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {validationResult && (
                  <View style={styles.validationBox}>
                    <Ionicons
                      name={
                        validationResult.summary.mismatched > 0
                          ? "alert-circle-outline"
                          : "checkmark-circle-outline"
                      }
                      size={20}
                      color={
                        validationResult.summary.mismatched > 0
                          ? "#fa8c16"
                          : "#52c41a"
                      }
                    />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.validationTitle}>
                        {validationResult.message}
                      </Text>
                      <Text style={styles.validationText}>
                        Tổng kiểm tra: {validationResult.summary.totalChecks} –
                        Lệch: {validationResult.summary.mismatched}
                      </Text>
                      {validationResult.checks.map((c) => (
                        <Text key={c.field} style={styles.validationItem}>
                          {c.match ? "✅" : "⚠️"} {c.label}: hệ thống{" "}
                          {String(c.expected ?? "—")}, PDF{" "}
                          {String(c.actual ?? "Không tìm thấy")}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrderReconciliationScreen;

// ====== STYLES (reuse từ TaxDeclarationScreen style) ======

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  headerTextContainer: { marginLeft: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 13, color: "#e6f7ff", marginTop: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#262626",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: "#8c8c8c",
    textAlign: "center",
  },

  filterCard: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#262626",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  filterRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  filterGroup: { flex: 1, marginHorizontal: 4 },
  filterLabel: { fontSize: 12, color: "#595959", marginBottom: 4 },
  segmentGroup: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    padding: 2,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: { backgroundColor: "#1890ff" },
  segmentItemText: {
    fontSize: 12,
    color: "#595959",
    fontWeight: "500",
  },
  segmentItemTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  listSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 12,
  },
  loadingContainer: { padding: 32, alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 14, color: "#8c8c8c" },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#595959",
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 13,
    color: "#8c8c8c",
    textAlign: "center",
  },

  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderCode: { fontSize: 15, fontWeight: "700", color: "#262626" },
  orderDate: { fontSize: 12, color: "#8c8c8c", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  orderLabel: { fontSize: 13, color: "#8c8c8c" },
  orderValue: { fontSize: 13, color: "#262626", fontWeight: "500" },
  orderTotal: { fontSize: 14, color: "#d4380d", fontWeight: "700" },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
    paddingTop: 6,
  },
  methodTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  methodText: { marginLeft: 4, fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingTop: 10,
  },
  modalHeader: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#262626",
  },
  modalBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  detailLine: {
    fontSize: 13,
    color: "#595959",
    marginTop: 6,
  },
  detailStrong: { fontWeight: "600", color: "#262626" },

  primaryButton: {
    marginTop: 16,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#1890ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    marginLeft: 6,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  outlineButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#1890ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  outlineButtonText: {
    marginLeft: 6,
    color: "#1890ff",
    fontSize: 14,
    fontWeight: "600",
  },

  validationBox: {
    marginTop: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f6ffed",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  validationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 4,
  },
  validationText: {
    fontSize: 12,
    color: "#595959",
  },
  validationItem: {
    fontSize: 12,
    color: "#595959",
    marginTop: 2,
  },
});
