// src/screens/pos/OrderTrackingScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import apiClient from "../../api/apiClient";

/**
 * Install (Expo): npx expo install @react-native-community/datetimepicker  [web:902]
 */

type MongoDecimal = { $numberDecimal: string };
type Store = { _id: string; name: string };
type Employee = { _id: string; fullName: string };
type Customer = { _id: string; name: string; phone: string };
type Product = { _id: string; name: string; sku: string; price: MongoDecimal };

type OrderItem = {
  _id: string;
  orderId: string;
  productId: Product;
  quantity: number;
  priceAtTime: MongoDecimal;
  subtotal: MongoDecimal;
  createdAt: string;
  updatedAt: string;
  productName: string;
  productSku: string;
};

type OrderStatus = "pending" | "paid" | "refunded" | "partially_refunded";
type PaymentMethod = "cash" | "qr";

type Order = {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;

  totalAmount: MongoDecimal;
  paymentMethod: PaymentMethod;
  qrExpiry: string | null;

  status: OrderStatus;
  refundId: string | null;

  printDate: string | null;
  printCount: number;

  isVATInvoice: boolean;
  vatAmount: MongoDecimal;
  beforeTaxAmount: MongoDecimal;

  createdAt: string;
  updatedAt: string;
};

type OrderListResponse = { message: string; total: number; orders: Order[] };
type OrderDetailResponse = {
  message: string;
  order: Order & { items: OrderItem[] };
};

const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const moneyToNumber = (v: MongoDecimal | number | undefined | null) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && (v as any)?.$numberDecimal)
    return parseFloat((v as any).$numberDecimal) || 0;
  return Number(v) || 0;
};

const formatCurrency = (value: MongoDecimal | number): string => {
  const n = moneyToNumber(value);
  return `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}₫`;
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "---";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return String(iso);
  }
};

const formatDateOnly = (d: Date | null) => {
  if (!d) return "—";
  try {
    return dayjs(d).format("DD/MM/YYYY");
  } catch {
    return "—";
  }
};

const getStatusChip = (status: OrderStatus) => {
  const map: Record<OrderStatus, { bg: string; text: string; label: string }> =
    {
      pending: { bg: "#ffedd5", text: "#9a3412", label: "Chờ TT" },
      paid: { bg: "#dcfce7", text: "#166534", label: "Đã TT" },
      refunded: { bg: "#fee2e2", text: "#b91c1c", label: "Hoàn hết" },
      partially_refunded: {
        bg: "#ffe4e6",
        text: "#be123c",
        label: "Hoàn 1 phần",
      },
    };
  return map[status] || map.pending;
};

const getPaymentChip = (method: PaymentMethod) => {
  return method === "cash"
    ? { bg: "#dcfce7", text: "#166534", label: "Tiền mặt" }
    : { bg: "#dbeafe", text: "#1d4ed8", label: "QR" };
};

const Pill: React.FC<{
  text: string;
  active?: boolean;
  onPress?: () => void;
}> = ({ text, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.pill,
      active ? styles.pillOn : styles.pillOff,
      pressed && { opacity: 0.9 },
    ]}
  >
    <Text style={active ? styles.pillTextOn : styles.pillTextOff}>{text}</Text>
  </Pressable>
);

const KV: React.FC<{
  k: string;
  v: string;
  bold?: boolean;
  valueColor?: string;
}> = ({ k, v, bold, valueColor }) => (
  <View style={styles.kvRow}>
    <Text style={styles.k}>{k}</Text>
    <Text
      style={[
        styles.v,
        bold && { fontWeight: "900" },
        valueColor ? { color: valueColor } : null,
      ]}
    >
      {v}
    </Text>
  </View>
);

type PickerField = null | "from" | "to";

const OrderTrackingScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");
  const [token, setToken] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  // filters
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  // date range: from/to Date
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // picker UI state
  const [pickerField, setPickerField] = useState<PickerField>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [pickerVisible, setPickerVisible] = useState(false);

  // data
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetailResponse | null>(
    null
  );

  // loading
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // detail modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [csRaw, tkn] = await Promise.all([
          AsyncStorage.getItem("currentStore"),
          AsyncStorage.getItem("token"),
        ]);
        const cs = safeParse(csRaw);
        setStoreId(cs?._id || "");
        setStoreName(cs?.name || "POS");
        setToken(tkn);
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res: any = await apiClient.get<OrderListResponse>(
        `/orders/list-all`,
        {
          params: { storeId },
          headers: authHeaders,
        }
      );
      setOrders(Array.isArray(res?.data?.orders) ? res.data.orders : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, authHeaders]);

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      if (!storeId) return;
      setDetailLoading(true);
      setSelectedOrderId(orderId);
      try {
        const res: any = await apiClient.get<OrderDetailResponse>(
          `/orders/${orderId}`,
          {
            params: { storeId },
            headers: authHeaders,
          }
        );
        setOrderDetail(res?.data || null);
        setDetailModalOpen(true);
      } catch {
        setOrderDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [storeId, authHeaders]
  );

  useEffect(() => {
    if (!storeId) return;
    loadOrders();
  }, [storeId, loadOrders]);

  const openPicker = (field: "from" | "to") => {
    setPickerField(field);

    const init =
      field === "from"
        ? fromDate || new Date()
        : toDate || fromDate || new Date();

    setTempDate(init);
    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerField(null);
  };

  const confirmPicker = () => {
    if (pickerField === "from") {
      const nextFrom = tempDate;
      setFromDate(nextFrom);

      // nếu toDate < fromDate => auto đẩy toDate = fromDate (tránh range sai)
      if (toDate && dayjs(toDate).isBefore(dayjs(nextFrom), "day")) {
        setToDate(nextFrom);
      }
    }

    if (pickerField === "to") {
      const nextTo = tempDate;
      // nếu user chọn "to" < "from" => auto set to = from
      if (fromDate && dayjs(nextTo).isBefore(dayjs(fromDate), "day")) {
        setToDate(fromDate);
      } else {
        setToDate(nextTo);
      }
    }

    closePicker();
  };

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    // Android: event.type = 'set' | 'dismissed'
    if (Platform.OS === "android") {
      if (_e.type === "dismissed") {
        closePicker();
        return;
      }
      if (date) {
        setTempDate(date);
      }
      // Android đã pick xong => confirm luôn cho nhanh
      // (UX pro: đỡ cần nút)
      if (_e.type === "set") {
        // confirm sau tick để tempDate được update
        setTimeout(() => {
          if (date) setTempDate(date);
          confirmPicker();
        }, 0);
      }
      return;
    }

    // iOS: giữ picker mở, confirm bằng nút
    if (date) setTempDate(date);
  };

  const clearRange = () => {
    setFromDate(null);
    setToDate(null);
  };

  const rangeLabel = useMemo(() => {
    if (!fromDate && !toDate) return "Tất cả ngày";
    if (fromDate && !toDate) return `Từ ${formatDateOnly(fromDate)}`;
    if (!fromDate && toDate) return `Đến ${formatDateOnly(toDate)}`;
    return `${formatDateOnly(fromDate)} → ${formatDateOnly(toDate)}`;
  }, [fromDate, toDate]);

  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    const from = fromDate ? dayjs(fromDate).startOf("day") : null;
    const to = toDate ? dayjs(toDate).endOf("day") : null;

    return orders.filter((o) => {
      const matchSearch = !q
        ? true
        : o._id.toLowerCase().includes(q) ||
          (o.customer?.name || "").toLowerCase().includes(q) ||
          (o.customer?.phone || "").includes(searchText.trim());

      const matchStatus = status === "all" ? true : o.status === status;

      let matchDate = true;
      if (from && from.isValid())
        matchDate =
          dayjs(o.createdAt).isAfter(from) || dayjs(o.createdAt).isSame(from);
      if (matchDate && to && to.isValid())
        matchDate =
          dayjs(o.createdAt).isBefore(to) || dayjs(o.createdAt).isSame(to);

      return matchSearch && matchStatus && matchDate;
    });
  }, [orders, searchText, status, fromDate, toDate]);

  if (loadingInit) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Tra cứu đơn hàng</Text>
          <Text style={styles.muted}>Chưa chọn cửa hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tra cứu đơn hàng</Text>
        <Text style={styles.headerSub} numberOfLines={1}>
          {storeName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="always"
      >
        {/* Filters */}
        <View style={styles.card}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm mã đơn / tên khách / SĐT..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => openPicker("from")}
              style={({ pressed }) => [
                styles.dateBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.dateBtnLabel}>Từ</Text>
              <Text style={styles.dateBtnValue}>
                {formatDateOnly(fromDate)}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => openPicker("to")}
              style={({ pressed }) => [
                styles.dateBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.dateBtnLabel}>Đến</Text>
              <Text style={styles.dateBtnValue}>{formatDateOnly(toDate)}</Text>
            </Pressable>

            <Pressable
              onPress={clearRange}
              style={({ pressed }) => [
                styles.outlineBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.outlineBtnText}>Xoá</Text>
            </Pressable>
          </View>

          <Text style={[styles.muted, { marginTop: 8 }]}>
            Đang lọc: {rangeLabel}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pill
                text="Tất cả"
                active={status === "all"}
                onPress={() => setStatus("all")}
              />
              <Pill
                text="Chờ TT"
                active={status === "pending"}
                onPress={() => setStatus("pending")}
              />
              <Pill
                text="Đã TT"
                active={status === "paid"}
                onPress={() => setStatus("paid")}
              />
              <Pill
                text="Hoàn hết"
                active={status === "refunded"}
                onPress={() => setStatus("refunded")}
              />
              <Pill
                text="Hoàn 1 phần"
                active={status === "partially_refunded"}
                onPress={() => setStatus("partially_refunded")}
              />
            </View>
          </ScrollView>

          <View style={styles.rowBetween}>
            <Text style={styles.muted}>
              Tổng:{" "}
              <Text style={{ fontWeight: "900", color: "#1d4ed8" }}>
                {filteredOrders.length}
              </Text>{" "}
              đơn
            </Text>

            <Pressable
              onPress={loadOrders}
              style={({ pressed }) => [
                styles.outlineBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.outlineBtnText}>Tải lại</Text>
            </Pressable>
          </View>
        </View>

        {/* List */}
        <View style={styles.card}>
          {loading ? (
            <View style={styles.centerSlim}>
              <ActivityIndicator />
              <Text style={styles.muted}>Đang tải danh sách...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(i) => i._id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              ListEmptyComponent={
                <Text style={styles.muted}>Không có đơn hàng</Text>
              }
              renderItem={({ item }) => {
                const st = getStatusChip(item.status);
                const pm = getPaymentChip(item.paymentMethod);
                const active = item._id === selectedOrderId;

                return (
                  <Pressable
                    onPress={() => loadOrderDetail(item._id)}
                    style={({ pressed }) => [
                      styles.orderRow,
                      active && styles.orderRowActive,
                      pressed && { opacity: 0.95 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderId}>#{item._id.slice(-8)}</Text>
                      <Text style={styles.orderMeta} numberOfLines={1}>
                        Khách: {item.customer?.name || "Khách lẻ"} •{" "}
                        {item.customer?.phone || "N/A"}
                      </Text>
                      <Text style={styles.orderMeta} numberOfLines={1}>
                        {formatDateTime(item.createdAt)}
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          gap: 8,
                          marginTop: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <View
                          style={[styles.badge, { backgroundColor: st.bg }]}
                        >
                          <Text style={[styles.badgeText, { color: st.text }]}>
                            {st.label}
                          </Text>
                        </View>
                        <View
                          style={[styles.badge, { backgroundColor: pm.bg }]}
                        >
                          <Text style={[styles.badgeText, { color: pm.text }]}>
                            {pm.label}
                          </Text>
                        </View>
                        {item.isVATInvoice ? (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: "#cffafe" },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: "#155e75" }]}
                            >
                              VAT
                            </Text>
                          </View>
                        ) : null}
                        {item.refundId ? (
                          <View
                            style={[
                              styles.badge,
                              { backgroundColor: "#fee2e2" },
                            ]}
                          >
                            <Text
                              style={[styles.badgeText, { color: "#b91c1c" }]}
                            >
                              Có hoàn
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View
                      style={{
                        alignItems: "flex-end",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={styles.money}>
                        {formatCurrency(item.totalAmount)}
                      </Text>
                      <Text style={styles.printHint}>
                        {item.printDate
                          ? `Đã in ${item.printCount || 0} lần`
                          : "Chưa in"}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </ScrollView>

      {/* DateTimePicker modal (iOS needs buttons, Android auto-confirm) */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.pickerHeader}>
              <Text style={styles.modalTitle}>
                {pickerField === "from" ? "Chọn từ ngày" : "Chọn đến ngày"}
              </Text>
              <Pressable
                onPress={closePicker}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
            </View>

            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onPickerChange}
              locale="vi-VN"
              style={{ backgroundColor: "#fff" }}
              textColor="#000000"
              themeVariant="light"
            />

            {Platform.OS === "ios" ? (
              <View style={styles.pickerFooter}>
                <Pressable
                  onPress={closePicker}
                  style={({ pressed }) => [
                    styles.outlineBtn,
                    pressed && { opacity: 0.9 },
                    { flex: 1 },
                  ]}
                >
                  <Text style={styles.outlineBtnText}>Huỷ</Text>
                </Pressable>
                <Pressable
                  onPress={confirmPicker}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && { opacity: 0.92 },
                    { flex: 1 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>Áp dụng</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Detail modal */}
      <Modal
        visible={detailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "88%" }]}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Chi tiết đơn</Text>
              <Pressable
                onPress={() => setDetailModalOpen(false)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.centerSlim}>
                <ActivityIndicator />
                <Text style={styles.muted}>Đang tải chi tiết...</Text>
              </View>
            ) : !orderDetail ? (
              <Text style={styles.muted}>Chưa có dữ liệu.</Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="always">
                <View style={styles.sectionBox}>
                  <KV k="Mã đơn" v={orderDetail.order._id} />
                  <KV k="Cửa hàng" v={orderDetail.order.storeId?.name} />
                  <KV
                    k="Nhân viên"
                    v={orderDetail.order.employeeId?.fullName}
                  />
                  <KV
                    k="Khách"
                    v={
                      orderDetail.order.customer
                        ? `${orderDetail.order.customer.name} (${orderDetail.order.customer.phone})`
                        : "Khách lẻ"
                    }
                  />
                  <View style={styles.hr} />
                  <KV
                    k="Phương thức"
                    v={
                      orderDetail.order.paymentMethod === "cash"
                        ? "Tiền mặt"
                        : "QR"
                    }
                  />
                  <KV
                    k="VAT"
                    v={orderDetail.order.isVATInvoice ? "Có" : "Không"}
                  />
                  <KV
                    k="Ngày tạo"
                    v={formatDateTime(orderDetail.order.createdAt)}
                  />
                  {orderDetail.order.printDate ? (
                    <KV
                      k="In hóa đơn"
                      v={`${formatDateTime(orderDetail.order.printDate)} • ${orderDetail.order.printCount || 0} lần`}
                    />
                  ) : null}
                </View>

                <Text style={styles.sectionTitle}>Sản phẩm trong đơn</Text>
                {orderDetail.order.items?.map((it, idx) => (
                  <View key={it._id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>
                        {idx + 1}. {it.productName || it.productId?.name}
                      </Text>
                      <Text style={styles.itemSub}>
                        SKU: {it.productSku || it.productId?.sku}
                      </Text>
                      <Text style={styles.itemSub}>
                        SL: {it.quantity} • Đơn giá:{" "}
                        {formatCurrency(it.priceAtTime)}
                      </Text>
                    </View>
                    <Text style={styles.money}>
                      {formatCurrency(it.subtotal)}
                    </Text>
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Thanh toán</Text>
                <View style={styles.sectionBox}>
                  <KV
                    k="Trước thuế"
                    v={formatCurrency(orderDetail.order.beforeTaxAmount)}
                  />
                  {orderDetail.order.isVATInvoice ? (
                    <KV
                      k="VAT (10%)"
                      v={`+${formatCurrency(orderDetail.order.vatAmount)}`}
                      valueColor="#b45309"
                    />
                  ) : null}
                  <KV
                    k="Tổng"
                    v={formatCurrency(orderDetail.order.totalAmount)}
                    valueColor="#1d4ed8"
                    bold
                  />
                  {orderDetail.order.refundId ? (
                    <View style={styles.refundBanner}>
                      <Text style={styles.refundBannerText}>
                        Đơn hàng này đã được hoàn trả
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default OrderTrackingScreen;

/** =========================
 * Styles
 * ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    paddingTop: Platform.OS === "android" ? 14 : 6,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: "#10b981",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  headerSub: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "700",
    marginTop: 2,
  },

  title: { fontSize: 18, fontWeight: "900", color: "#0b1220" },
  muted: { color: "#64748b", fontWeight: "700", marginTop: 6 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },

  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    color: "#0b1220",
    backgroundColor: "#fff",
  },

  dateBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateBtnLabel: { color: "#64748b", fontWeight: "900", fontSize: 12 },
  dateBtnValue: { marginTop: 4, color: "#0b1220", fontWeight: "900" },

  primaryBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  outlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { fontWeight: "900", color: "#0b1220" },

  rowBetween: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: { backgroundColor: "#ecfdf5", borderColor: "#10b981" },
  pillOff: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  pillTextOn: { fontWeight: "900", color: "#047857", fontSize: 12 },
  pillTextOff: { fontWeight: "900", color: "#0b1220", fontSize: 12 },

  orderRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderRowActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },

  orderId: { fontWeight: "900", color: "#0b1220" },
  orderMeta: {
    marginTop: 4,
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontWeight: "900", fontSize: 11 },

  money: { fontWeight: "900", color: "#0b1220" },
  printHint: {
    marginTop: 6,
    color: "#64748b",
    fontWeight: "800",
    fontSize: 11,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalTitle: { fontWeight: "900", color: "#0b1220", fontSize: 16 },

  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  closeBtnText: { fontWeight: "900", color: "#0b1220" },

  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    padding: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  pickerFooter: { flexDirection: "row", gap: 10, marginTop: 10 },

  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "900",
    color: "#0b1220",
  },
  sectionBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  k: { color: "#64748b", fontWeight: "800" },
  v: { color: "#0b1220", fontWeight: "800", flexShrink: 1, textAlign: "right" },

  hr: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },

  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemTitle: { fontWeight: "900", color: "#0b1220" },
  itemSub: { marginTop: 4, color: "#475569", fontWeight: "700", fontSize: 12 },

  refundBanner: {
    marginTop: 12,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  refundBannerText: {
    fontWeight: "900",
    color: "#b91c1c",
    textAlign: "center",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerSlim: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
