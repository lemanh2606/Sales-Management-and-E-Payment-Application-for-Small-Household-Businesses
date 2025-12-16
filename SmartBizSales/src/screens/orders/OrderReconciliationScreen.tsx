// src/screens/orders/OrderReconciliationScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import orderApi from "../../api/orderApi";
import { createReceiptPdfAsync } from "../../utils/receiptPdf";
import {
  savePdfToAndroidFolderWithPicker,
  sharePdf,
} from "../../utils/pdfSave";

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

const COLORS = {
  primary: "#10b981",
  primaryDark: "#0f766e",
  bg: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  sub: "#64748b",
  border: "#e2e8f0",
  danger: "#ef4444",
  warn: "#f59e0b",
  ok: "#16a34a",
  info: "#2563eb",
};

const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

const formatCurrency = (value: DecimalValue) =>
  decimalToNumber(value).toLocaleString("vi-VN") + "đ";

const Chip: React.FC<{
  label: string;
  active?: boolean;
  onPress?: () => void;
}> = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.chip,
      active && styles.chipActive,
      pressed && { opacity: 0.92 },
    ]}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>
      {label}
    </Text>
  </Pressable>
);

const Badge: React.FC<{
  text: string;
  tone?: "success" | "danger" | "warning" | "info";
}> = ({ text, tone = "info" }) => {
  const bg =
    tone === "success"
      ? "#dcfce7"
      : tone === "danger"
        ? "#fee2e2"
        : tone === "warning"
          ? "#ffedd5"
          : "#dbeafe";
  const fg =
    tone === "success"
      ? "#166534"
      : tone === "danger"
        ? "#b91c1c"
        : tone === "warning"
          ? "#9a3412"
          : "#1d4ed8";
  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderColor: fg + "33" }]}
    >
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
};

const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

const InfoRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text
      style={[
        styles.infoValue,
        mono && {
          fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
        },
      ]}
      numberOfLines={2}
    >
      {value}
    </Text>
  </View>
);

const OrderReconciliationScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);
  const [loading, setLoading] = useState(false);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("Cửa hàng");
  const [storeAddress, setStoreAddress] = useState<string>("");

  const [orders, setOrders] = useState<PaidOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "qr">(
    "all"
  );
  const [printFilter, setPrintFilter] = useState<
    "all" | "printed" | "notPrinted"
  >("all");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Date picker
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"from" | "to">(
    "from"
  );

  // Print modal
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState<PrintPreviewData | null>(
    null
  );
  const [pendingPrintOrderId, setPendingPrintOrderId] = useState<string | null>(
    null
  );

  // PDF exporting state
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const csRaw = await AsyncStorage.getItem("currentStore");
        const cs = safeParse(csRaw);
        setStoreId(cs?._id || "");
        setStoreName(cs?.name || "Cửa hàng");
        setStoreAddress(cs?.address || "");
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await orderApi.getPaidNotPrintedOrders({ storeId });
      setOrders(res?.orders || []);
      setPage(1);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể tải danh sách đối soát";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    loadOrders();
  }, [storeId, loadOrders]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, paymentFilter, printFilter, dateFrom, dateTo]);

  const filteredOrders = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesPayment =
        paymentFilter === "all" ? true : order.paymentMethod === paymentFilter;

      const count = order.printCount ?? 0;
      const matchesPrint =
        printFilter === "all"
          ? true
          : printFilter === "printed"
            ? count > 0
            : count === 0;

      let matchesDate = true;
      if (dateFrom && dateTo) {
        const updatedAt = dayjs(order.updatedAt);
        matchesDate =
          updatedAt.isAfter(dayjs(dateFrom).startOf("day")) &&
          updatedAt.isBefore(dayjs(dateTo).endOf("day"));
      }

      if (!normalized) return matchesPayment && matchesPrint && matchesDate;

      const orderId = (order._id || "").toLowerCase();
      const shortId = orderId.slice(-8);
      const customerName = (order.customer?.name || "").toLowerCase();
      const customerPhone = (order.customer?.phone || "").toLowerCase();
      const employeeName = (order.employeeId?.fullName || "").toLowerCase();

      const matchesSearch =
        orderId.includes(normalized) ||
        shortId.includes(normalized) ||
        customerName.includes(normalized) ||
        customerPhone.includes(normalized) ||
        employeeName.includes(normalized);

      return matchesPayment && matchesPrint && matchesDate && matchesSearch;
    });
  }, [orders, paymentFilter, printFilter, searchTerm, dateFrom, dateTo]);

  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, page * pageSize),
    [filteredOrders, page]
  );
  const canLoadMore = visibleOrders.length < filteredOrders.length;

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

  const handlePreviewPrint = useCallback(
    async (order: PaidOrder) => {
      if (!storeId) {
        Alert.alert(
          "Thiếu cửa hàng",
          "Vui lòng chọn cửa hàng trước khi thao tác."
        );
        return;
      }
      if (previewingId || printingId) return;

      setPreviewingId(order._id);
      try {
        const res: any = await orderApi.getOrderById(order._id, { storeId });
        const detail: OrderDetail | undefined = res?.order;
        if (!detail) throw new Error("Không tìm thấy dữ liệu hóa đơn");

        const preview: PrintPreviewData = {
          orderId: detail._id,
          createdAt: detail.createdAt,
          printCount: detail.printCount,
          paymentMethod: detail.paymentMethod,
          totalAmount: decimalToNumber(detail.totalAmount),
          employeeName: detail.employeeId?.fullName,
          customerName: detail.customer?.name,
          customerPhone: detail.customer?.phone,
          cart: mapItemsToCart(detail.items),
        };

        setPrintPreview(preview);
        setPendingPrintOrderId(detail._id);
        setPrintModalOpen(true);
      } catch (err: any) {
        Alert.alert(
          "Lỗi",
          err?.response?.data?.message ||
            err?.message ||
            "Không thể tải hóa đơn"
        );
      } finally {
        setPreviewingId(null);
      }
    },
    [storeId, previewingId, printingId]
  );

  const resetPrintModal = () => {
    if (exportingPdf) return;
    setPrintModalOpen(false);
    setPrintPreview(null);
    setPendingPrintOrderId(null);
  };

  const handleConfirmBackendPrint = useCallback(async () => {
    if (!pendingPrintOrderId || printingId) return;
    try {
      setPrintingId(pendingPrintOrderId);
      await orderApi.printBill(pendingPrintOrderId, { storeId });
      Alert.alert("Thành công", "Đã ghi nhận in hóa đơn trên hệ thống");
      resetPrintModal();
      loadOrders();
    } catch (err: any) {
      Alert.alert(
        "Thất bại",
        err?.response?.data?.message || "In hóa đơn thất bại"
      );
    } finally {
      setPrintingId(null);
    }
  }, [pendingPrintOrderId, printingId, storeId, loadOrders]);

  const exportReceiptPdf = useCallback(
    async (mode: "share" | "androidFolder") => {
      if (!printPreview) return;
      if (exportingPdf) return;

      setExportingPdf(true);
      try {
        const created = printPreview.createdAt
          ? dayjs(printPreview.createdAt).format("DD/MM/YYYY HH:mm")
          : undefined;

        const { uri } = await createReceiptPdfAsync({
          storeName,
          address: storeAddress,
          orderId: printPreview.orderId,
          createdAt: created,
          paymentMethod: printPreview.paymentMethod,
          printCount: printPreview.printCount,
          employeeName: printPreview.employeeName,
          customerName: printPreview.customerName,
          customerPhone: printPreview.customerPhone,
          totalAmount: printPreview.totalAmount,
          cart: (printPreview.cart || []).map((x) => ({
            name: x.name,
            quantity: x.quantity,
            unit: x.unit,
            price: x.price,
            subtotal: x.subtotal,
            sku: x.sku,
          })),
        });

        const fileName = `hoa-don-${printPreview.orderId.slice(-8)}.pdf`;

        if (mode === "androidFolder") {
          await savePdfToAndroidFolderWithPicker({ sourceUri: uri, fileName });
        } else {
          await sharePdf(uri, fileName);
        }
      } catch (e: any) {
        Alert.alert("Lỗi", e?.message || "Không thể tạo/lưu PDF");
      } finally {
        setExportingPdf(false);
      }
    },
    [printPreview, exportingPdf, storeName, storeAddress]
  );

  const openDatePicker = (target: "from" | "to") => {
    setDatePickerTarget(target);
    setDatePickerVisible(true);
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    setDatePickerVisible(false);
    if (!selected) return;

    if (datePickerTarget === "from") {
      setDateFrom(selected);
      if (dateTo && dayjs(dateTo).isBefore(dayjs(selected), "day"))
        setDateTo(null);
    } else {
      setDateTo(selected);
      if (dateFrom && dayjs(selected).isBefore(dayjs(dateFrom), "day"))
        setDateFrom(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm("");
    setPaymentFilter("all");
    setPrintFilter("all");
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  };

  const renderOrderItem = ({ item }: { item: PaidOrder }) => {
    const shortId = item._id?.slice(-8) || "--------";
    const customerName = item.customer?.name || "Khách vãng lai";
    const customerPhone = item.customer?.phone || "—";
    const employeeName = item.employeeId?.fullName || "—";
    const printCount = item.printCount ?? 0;

    return (
      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderCode}>
              #{shortId}{" "}
              <Text style={styles.orderCodeSub}>
                ({dayjs(item.updatedAt).format("DD/MM/YYYY HH:mm")})
              </Text>
            </Text>
            <Text style={styles.subLine} numberOfLines={1}>
              KH: {customerName} • {customerPhone}
            </Text>
            <Text style={styles.subLine} numberOfLines={1}>
              NV: {employeeName}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Text style={styles.money}>{formatCurrency(item.totalAmount)}</Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Badge
                text={item.paymentMethod === "cash" ? "Tiền mặt" : "QR"}
                tone={item.paymentMethod === "cash" ? "success" : "info"}
              />
              <Badge
                text={`${printCount} lần in`}
                tone={printCount > 0 ? "info" : "warning"}
              />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => handlePreviewPrint(item)}
            disabled={previewingId === item._id || printingId === item._id}
            style={({ pressed }) => [
              styles.btn,
              styles.btnOutline,
              (pressed ||
                previewingId === item._id ||
                printingId === item._id) && { opacity: 0.75 },
              { flex: 1 },
            ]}
          >
            {previewingId === item._id ? (
              <ActivityIndicator />
            ) : (
              <Ionicons
                name="document-text-outline"
                size={18}
                color={COLORS.text}
              />
            )}
            <Text style={styles.btnOutlineText}>Xem & in</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert(
                "Gợi ý",
                "Đối soát PDF đang nằm ở tab/flow khác của bạn."
              )
            }
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              pressed && { opacity: 0.9 },
              { flex: 1 },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={styles.btnPrimaryText}>Đối soát</Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Hóa đơn đã thanh toán</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {storeName}
          </Text>
        </View>

        <Pressable
          onPress={loadOrders}
          disabled={loading}
          style={({ pressed }) => [
            styles.iconBtn,
            (pressed || loading) && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="refresh" size={18} color="#fff" />
          )}
        </Pressable>
      </View>

      <FlatList
        data={visibleOrders}
        keyExtractor={(it) => it._id}
        renderItem={renderOrderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={styles.cardTitle}>Bộ lọc</Text>

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={COLORS.sub} />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Tìm mã đơn, tên khách, SĐT, nhân viên..."
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                />
                {searchTerm ? (
                  <Pressable
                    onPress={() => setSearchTerm("")}
                    style={({ pressed }) => [
                      styles.clearBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Ionicons name="close" size={16} color={COLORS.text} />
                  </Pressable>
                ) : null}
              </View>

              <Text style={styles.blockLabel}>Phương thức</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Tất cả"
                  active={paymentFilter === "all"}
                  onPress={() => setPaymentFilter("all")}
                />
                <Chip
                  label="Tiền mặt"
                  active={paymentFilter === "cash"}
                  onPress={() => setPaymentFilter("cash")}
                />
                <Chip
                  label="QR"
                  active={paymentFilter === "qr"}
                  onPress={() => setPaymentFilter("qr")}
                />
              </View>

              <Text style={[styles.blockLabel, { marginTop: 10 }]}>
                Trạng thái in
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Tất cả"
                  active={printFilter === "all"}
                  onPress={() => setPrintFilter("all")}
                />
                <Chip
                  label="Đã in"
                  active={printFilter === "printed"}
                  onPress={() => setPrintFilter("printed")}
                />
                <Chip
                  label="Chưa in"
                  active={printFilter === "notPrinted"}
                  onPress={() => setPrintFilter("notPrinted")}
                />
              </View>

              <Text style={[styles.blockLabel, { marginTop: 10 }]}>
                Khoảng ngày (updatedAt)
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => openDatePicker("from")}
                  style={({ pressed }) => [
                    styles.dateBtn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.text}
                  />
                  <Text style={styles.dateBtnText}>
                    {dateFrom
                      ? dayjs(dateFrom).format("DD/MM/YYYY")
                      : "Từ ngày"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openDatePicker("to")}
                  style={({ pressed }) => [
                    styles.dateBtn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={COLORS.text}
                  />
                  <Text style={styles.dateBtnText}>
                    {dateTo ? dayjs(dateTo).format("DD/MM/YYYY") : "Đến ngày"}
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable
                  onPress={resetFilters}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutline,
                    pressed && { opacity: 0.9 },
                    { flex: 1 },
                  ]}
                >
                  <Ionicons
                    name="reload-outline"
                    size={18}
                    color={COLORS.text}
                  />
                  <Text style={styles.btnOutlineText}>Reset lọc</Text>
                </Pressable>

                <View style={[styles.summaryPill, { flex: 1 }]}>
                  <Ionicons
                    name="list-outline"
                    size={18}
                    color={COLORS.primaryDark}
                  />
                  <Text style={styles.summaryText}>
                    {filteredOrders.length} đơn • đang hiển thị{" "}
                    {visibleOrders.length}
                  </Text>
                </View>
              </View>
            </Card>

            {error ? (
              <Card style={{ borderColor: "#fecaca" }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={COLORS.danger}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </Card>
            ) : null}

            {!loading && !filteredOrders.length ? (
              <Card>
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons
                    name="file-search-outline"
                    size={20}
                    color={COLORS.sub}
                  />
                  <Text style={styles.emptyBoxText}>
                    Không có hóa đơn phù hợp bộ lọc.
                  </Text>
                </View>
              </Card>
            ) : null}
          </>
        }
        ListFooterComponent={
          canLoadMore ? (
            <Pressable
              onPress={() => setPage((p) => p + 1)}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Ionicons name="chevron-down" size={18} color={COLORS.text} />
              <Text style={styles.loadMoreText}>Tải thêm</Text>
            </Pressable>
          ) : (
            <View style={{ height: 6 }} />
          )
        }
      />

      {datePickerVisible ? (
        <DateTimePicker
          value={
            datePickerTarget === "from"
              ? dateFrom || new Date()
              : dateTo || new Date()
          }
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      ) : null}

      {/* Print & PDF modal */}
      <Modal
        visible={printModalOpen}
        transparent
        animationType="fade"
        onRequestClose={resetPrintModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={resetPrintModal}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>In & Lưu hóa đơn</Text>
              <Pressable
                onPress={resetPrintModal}
                disabled={!!printingId || exportingPdf}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 560 }}
              contentContainerStyle={{ paddingTop: 10 }}
            >
              <Card style={{ marginBottom: 10 }}>
                <Text style={styles.sectionTitle}>{storeName}</Text>
                {storeAddress ? (
                  <Text style={styles.sectionSub}>{storeAddress}</Text>
                ) : null}
                <View style={{ height: 10 }} />

                <InfoRow
                  label="Mã hóa đơn"
                  value={printPreview?.orderId || "—"}
                  mono
                />
                <InfoRow
                  label="Thời gian"
                  value={
                    printPreview?.createdAt
                      ? dayjs(printPreview.createdAt).format("DD/MM/YYYY HH:mm")
                      : "—"
                  }
                />
                <InfoRow
                  label="Thanh toán"
                  value={
                    printPreview?.paymentMethod === "cash"
                      ? "Tiền mặt"
                      : "QR Code"
                  }
                />
                <InfoRow
                  label="Số lần in"
                  value={String(printPreview?.printCount ?? 0)}
                />
                <InfoRow
                  label="Nhân viên"
                  value={printPreview?.employeeName || "—"}
                />
                <InfoRow
                  label="Khách"
                  value={printPreview?.customerName || "Khách vãng lai"}
                />
                <InfoRow
                  label="SĐT"
                  value={printPreview?.customerPhone || "—"}
                />
              </Card>

              <Card style={{ marginBottom: 10 }}>
                <Text style={styles.sectionTitle}>Tổng tiền</Text>
                <Text style={styles.totalMoney}>
                  {(printPreview?.totalAmount || 0).toLocaleString("vi-VN")}đ
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <Pressable
                    onPress={() => exportReceiptPdf("share")}
                    disabled={exportingPdf || !printPreview}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      (pressed || exportingPdf || !printPreview) && {
                        opacity: 0.75,
                      },
                      { flex: 1 },
                    ]}
                  >
                    {exportingPdf ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons
                        name="download-outline"
                        size={18}
                        color="#fff"
                      />
                    )}
                    <Text style={styles.btnPrimaryText}>Lưu PDF</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => exportReceiptPdf("androidFolder")}
                    disabled={
                      exportingPdf || !printPreview || Platform.OS !== "android"
                    }
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnOutline,
                      (pressed ||
                        exportingPdf ||
                        !printPreview ||
                        Platform.OS !== "android") && { opacity: 0.75 },
                      { flex: 1 },
                    ]}
                  >
                    <Ionicons
                      name="folder-open-outline"
                      size={18}
                      color={COLORS.text}
                    />
                    <Text style={styles.btnOutlineText}>Lưu vào thư mục</Text>
                  </Pressable>
                </View>

                <Text style={[styles.hint, { marginTop: 10 }]}>
                  “Lưu PDF” sẽ mở màn hình chia sẻ để bạn chọn Lưu vào Tệp/Files
                  hoặc ứng dụng khác.
                </Text>
              </Card>

              <Card style={{ marginBottom: 4 }}>
                <Text style={styles.sectionTitle}>
                  Ghi nhận đã in (hệ thống)
                </Text>
                <Text style={styles.sectionSub}>
                  Nút này gọi API in hóa đơn để tăng số lần in / trừ kho (tùy
                  backend).
                </Text>

                <Pressable
                  onPress={handleConfirmBackendPrint}
                  disabled={
                    !pendingPrintOrderId || !!printingId || exportingPdf
                  }
                  style={({ pressed }) => [
                    styles.btn,
                    styles.btnOutline,
                    (pressed ||
                      !pendingPrintOrderId ||
                      !!printingId ||
                      exportingPdf) && { opacity: 0.75 },
                  ]}
                >
                  {printingId ? (
                    <ActivityIndicator />
                  ) : (
                    <Ionicons
                      name="print-outline"
                      size={18}
                      color={COLORS.text}
                    />
                  )}
                  <Text style={styles.btnOutlineText}>
                    {printingId ? "Đang xử lý..." : "Ghi nhận in hóa đơn"}
                  </Text>
                </Pressable>
              </Card>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default OrderReconciliationScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  heroHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  heroSub: { marginTop: 2, color: "rgba(255,255,255,0.92)", fontWeight: "800" },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  searchBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, color: COLORS.text, fontWeight: "800" },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },

  blockLabel: {
    marginTop: 12,
    color: COLORS.sub,
    fontWeight: "900",
    fontSize: 12,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  chipText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  chipTextActive: { color: COLORS.primaryDark },

  dateBtn: {
    flex: 1,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  dateBtnText: { color: COLORS.text, fontWeight: "900" },

  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#ecfdf5",
  },
  summaryText: { color: COLORS.primaryDark, fontWeight: "900" },

  orderCode: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  orderCodeSub: { color: COLORS.sub, fontWeight: "800", fontSize: 12 },
  subLine: { marginTop: 4, color: COLORS.sub, fontWeight: "700", fontSize: 12 },
  money: { color: COLORS.info, fontWeight: "900", fontSize: 14 },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnOutlineText: { color: COLORS.text, fontWeight: "900" },

  loadMoreBtn: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#fff",
  },
  loadMoreText: { fontWeight: "900", color: COLORS.text },

  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
  },
  emptyBoxText: { color: COLORS.sub, fontWeight: "800" },

  errorText: { flex: 1, color: COLORS.danger, fontWeight: "900" },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: "900", fontSize: 12 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    justifyContent: "center",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    padding: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontWeight: "900", color: COLORS.text, fontSize: 16 },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  closeBtnText: { fontWeight: "900", color: COLORS.text },

  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  sectionSub: {
    marginTop: 6,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
  },

  totalMoney: {
    marginTop: 8,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 20,
  },
  hint: { color: COLORS.sub, fontWeight: "700", fontSize: 12, lineHeight: 16 },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  infoLabel: { color: COLORS.sub, fontWeight: "800", fontSize: 12 },
  infoValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: COLORS.sub, fontWeight: "700", marginTop: 8 },
});
