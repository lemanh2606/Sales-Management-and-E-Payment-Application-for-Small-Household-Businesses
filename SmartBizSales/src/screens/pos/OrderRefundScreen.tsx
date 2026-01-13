// src/screens/pos/OrderRefundScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "../../api/apiClient";

// Nếu bạn dùng Expo để chọn ảnh/video:
let ImagePicker: any = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  // ignore (sẽ báo khi user bấm thêm minh chứng)
}

/** =========================
 *  Types (giữ gần giống file web)
 *  ========================= */
type MongoDecimal = { $numberDecimal: string };

type Store = { _id: string; name: string };
type Employee = { _id: string; fullName: string };

type Customer = { _id: string; name: string; phone: string };

type Product = {
  _id: string;
  name: string;
  sku: string;
  price?: MongoDecimal;
};

type OrderRefundDoc = {
  _id: string;
  orderId: {
    _id: string;
    totalAmount: MongoDecimal;
    customer?: Customer;
    storeId: Store;
    status: string;
    employeeId?: Employee; // Original salesperson (populated)
  };
  refundAmount: MongoDecimal;
  refundedBy: Employee; // Who performed the refund
  createdAt: string;
  updatedAt: string;
};

type PaidOrder = {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  paymentMethod: string; // cash | qr ...
  status: string; // paid | partially_refunded | refunded
  createdAt: string;
  updatedAt: string;
};

type RefundItem = {
  _id: string;
  productId: Product;
  quantity: number;
  priceAtTime: MongoDecimal;
  subtotal: MongoDecimal;
};

type EvidenceMedia = {
  url: string; // local uri or server url
  type: "image" | "video";
  public_id?: string;
  // For RN upload:
  file?: { uri: string; name: string; type: string };
};

type RefundDetail = {
  _id: string;
  orderId: {
    _id: string;
    totalAmount: MongoDecimal;
    paymentMethod: string;
    status: string;
  };
  refundedAt: string;
  refundedBy: Employee;
  refundTransactionId: string | null;
  refundReason: string;
  refundAmount: MongoDecimal;
  refundItems: RefundItem[];
  evidenceMedia: EvidenceMedia[];
  createdAt: string;
  updatedAt: string;
};

type OrderItem = {
  _id: string;
  orderId: string;
  productId: Product;
  quantity: number;
  priceAtTime: MongoDecimal;
  subtotal: MongoDecimal;
  refundedQuantity?: number;
  maxRefundableQuantity?: number;
  createdAt: string;
  updatedAt: string;
};

type RefundSummary = {
  totalOrderAmount: MongoDecimal;
  totalRefundedAmount: number;
  totalRefundedQty: number;
  totalOrderQty: number;
  remainingRefundableQty: number;
  refundCount: number;
  orderStatus: string;
};

type OrderRefundDetailResponse = {
  message: string;
  order: PaidOrder;
  refundDetail: RefundDetail;
  refundRecords: RefundDetail[];
  orderItems: OrderItem[];
  summary: RefundSummary;
};

type SelectedProductItem = { productId: string; quantity: number };

/** =========================
 *  Small UI
 *  ========================= */
const PillBtn: React.FC<{
  text: string;
  active?: boolean;
  onPress?: () => void;
  style?: any;
}> = ({ text, active, onPress, style }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.pill,
      active ? styles.pillActive : styles.pillInactive,
      pressed && { opacity: 0.9 },
      style,
    ]}
  >
    <Text
      style={[
        styles.pillText,
        active ? styles.pillTextActive : styles.pillTextInactive,
      ]}
    >
      {text}
    </Text>
  </Pressable>
);

const Card: React.FC<{
  title?: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ title, right, children }) => (
  <View style={styles.card}>
    {(title || right) && (
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {right}
      </View>
    )}
    {children}
  </View>
);

/** =========================
 *  Helpers
 *  ========================= */
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

const formatCurrency = (
  value: MongoDecimal | number | undefined | null
): string => {
  const n = moneyToNumber(value);
  return `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}₫`;
};

const formatDateTime = (iso: string | undefined | null) => {
  if (!iso) return "---";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
};

/** =========================
 *  Screen
 *  ========================= */
const OrderRefundScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");
  const [token, setToken] = useState<string | null>(null);

  const authHeaders = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [token]);

  // filters
  const [searchText, setSearchText] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(
    null
  );

  // modal filters
  const [modalSearchText, setModalSearchText] = useState("");
  const [modalSelectedEmployeeId, setModalSelectedEmployeeId] = useState<string | null>(
    null
  );

  // data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [refundOrders, setRefundOrders] = useState<OrderRefundDoc[]>([]);
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([]);

  // detail
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [refundDetail, setRefundDetail] =
    useState<OrderRefundDetailResponse | null>(null);

  // load states
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingPaid, setLoadingPaid] = useState(false);

  // Modals
  const [paidOrdersModalOpen, setPaidOrdersModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  // Paid order selection
  const [selectedPaidOrder, setSelectedPaidOrder] = useState<PaidOrder | null>(
    null
  );
  const [selectedPaidOrderItems, setSelectedPaidOrderItems] = useState<
    OrderItem[]
  >([]);
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, boolean>
  >({});
  const [refundQtyByProduct, setRefundQtyByProduct] = useState<
    Record<string, number>
  >({});

  // Form inputs
  const [refundEmployeeId, setRefundEmployeeId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");

  // Evidence media (local)
  const [evidenceMedia, setEvidenceMedia] = useState<EvidenceMedia[]>([]);

  // load init store/token
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
      } catch {
        // ignore
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!storeId) return;
    try {
      const res: any = await apiClient.get(`/stores/${storeId}/employees`, {
        params: { deleted: "false" },
        headers: authHeaders,
      });
      const list: Employee[] =
        res?.data?.employees || res?.data?.data?.employees || [];
      setEmployees(Array.isArray(list) ? list : []);
    } catch {
      setEmployees([]);
    }
  }, [storeId, authHeaders]);

  const loadRefundOrders = useCallback(async () => {
    if (!storeId) return;
    setLoadingList(true);
    try {
      const res: any = await apiClient.get(`/orders/list-refund`, {
        params: { storeId },
        headers: authHeaders,
      });
      setRefundOrders(Array.isArray(res?.data?.orders) ? res.data.orders : []);
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Lỗi tải danh sách đơn hoàn trả"
      );
      setRefundOrders([]);
    } finally {
      setLoadingList(false);
    }
  }, [storeId, authHeaders]);

  const loadRefundDetail = useCallback(
    async (orderId: string) => {
      if (!storeId) return;
      setSelectedOrderId(orderId);
      setLoadingDetail(true);
      try {
        const res: any = await apiClient.get(
          `/orders/order-refund/${orderId}`,
          {
            params: { storeId },
            headers: authHeaders,
          }
        );
        setRefundDetail(res?.data || null);
      } catch (e: any) {
        Alert.alert(
          "Lỗi",
          e?.response?.data?.message || "Lỗi tải chi tiết đơn hoàn trả"
        );
        setRefundDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [storeId, authHeaders]
  );

  const loadPaidOrders = useCallback(async () => {
    if (!storeId) return;
    setLoadingPaid(true);
    try {
      const res: any = await apiClient.get(`/orders/list-paid`, {
        params: { storeId },
        headers: authHeaders,
      });
      setPaidOrders(Array.isArray(res?.data?.orders) ? res.data.orders : []);
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || "Lỗi tải danh sách đơn đã thanh toán"
      );
      setPaidOrders([]);
    } finally {
      setLoadingPaid(false);
    }
  }, [storeId, authHeaders]);

  const loadPaidOrderItems = useCallback(
    async (orderId: string) => {
      if (!storeId) return;
      try {
        const res: any = await apiClient.get(
          `/orders/order-refund/${orderId}`,
          {
            params: { storeId },
            headers: authHeaders,
          }
        );
        setSelectedPaidOrderItems(
          Array.isArray(res?.data?.orderItems) ? res.data.orderItems : []
        );
      } catch (e: any) {
        Alert.alert(
          "Lỗi",
          e?.response?.data?.message || "Lỗi tải chi tiết đơn hàng"
        );
        setSelectedPaidOrderItems([]);
      }
    },
    [storeId, authHeaders]
  );

  useEffect(() => {
    if (!storeId) return;
    loadEmployees();
    loadRefundOrders();
  }, [storeId, loadEmployees, loadRefundOrders]);

  const filteredRefundOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return refundOrders.filter((o) => {
      const orderData = o.orderId;
      const matchSearch = !q
        ? true
        : o._id?.toLowerCase().includes(q) ||
          orderData?._id?.toLowerCase().includes(q) ||
          (orderData?.customer?.name || "").toLowerCase().includes(q) ||
          (orderData?.customer?.phone || "").includes(searchText.trim());

      // Filter theo người thực hiện hoàn
      let matchEmp = true;
      if (selectedEmployeeId === "owner") {
        matchEmp = !o.refundedBy || !o.refundedBy._id;
      } else if (selectedEmployeeId) {
        matchEmp = o.refundedBy?._id === selectedEmployeeId;
      }

      // Filter theo nhân viên bán hàng gốc
      let matchSales = true;
      if (selectedSalespersonId === "owner") {
        matchSales = !orderData?.employeeId || !orderData?.employeeId._id;
      } else if (selectedSalespersonId) {
        matchSales = orderData?.employeeId?._id === selectedSalespersonId;
      }

      return matchSearch && matchEmp && matchSales;
    });
  }, [refundOrders, searchText, selectedEmployeeId, selectedSalespersonId]);

  const filteredPaidOrders = useMemo(() => {
    const q = modalSearchText.trim().toLowerCase();
    return paidOrders.filter((o) => {
      const matchSearch = !q
        ? true
        : o._id?.toLowerCase().includes(q) ||
          (o.customer?.name || "").toLowerCase().includes(q) ||
          (o.customer?.phone || "").includes(modalSearchText.trim());

      let matchEmp = true;
      if (modalSelectedEmployeeId === "owner") {
        matchEmp = !o.employeeId || !o.employeeId._id;
      } else if (modalSelectedEmployeeId) {
        matchEmp = o.employeeId?._id === modalSelectedEmployeeId;
      }

      return matchSearch && matchEmp;
    });
  }, [paidOrders, modalSearchText, modalSelectedEmployeeId]);

  const openPaidOrdersModal = useCallback(async () => {
    await loadPaidOrders();
    setPaidOrdersModalOpen(true);
  }, [loadPaidOrders]);

  const handleOpenRefundModal = useCallback(
    async (order: PaidOrder) => {
      setSelectedPaidOrder(order);
      setPaidOrdersModalOpen(false);
      await loadPaidOrderItems(order._id);

      // reset form states
      setSelectedProducts({});
      setRefundQtyByProduct({});
      setRefundEmployeeId(null);
      setRefundReason("");
      setEvidenceMedia([]);

      setRefundModalOpen(true);
    },
    [loadPaidOrderItems]
  );

  const toggleSelectProduct = (productId: string, maxQty: number) => {
    setSelectedProducts((prev) => {
      const next = { ...prev, [productId]: !prev[productId] };
      if (!next[productId]) {
        // uncheck => remove qty
        setRefundQtyByProduct((qPrev) => {
          const qNext = { ...qPrev };
          delete qNext[productId];
          return qNext;
        });
      } else {
        // check => default qty 1
        setRefundQtyByProduct((qPrev) => ({
          ...qPrev,
          [productId]: Math.min(qPrev[productId] || 1, maxQty),
        }));
      }
      return next;
    });
  };

  const pickEvidence = useCallback(async () => {
    if (!ImagePicker) {
      Alert.alert(
        "Chưa hỗ trợ",
        "Thiếu expo-image-picker. Nếu bạn không dùng Expo, nói mình để đổi sang thư viện RN CLI."
      );
      return;
    }

    if (evidenceMedia.length >= 5) {
      Alert.alert("Giới hạn", "Tối đa 5 file minh chứng.");
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) {
      Alert.alert("Thiếu quyền", "Cần quyền truy cập thư viện ảnh/video.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 5 - evidenceMedia.length,
    });

    if (result?.canceled) return;

    const assets = result?.assets || [];
    const added: EvidenceMedia[] = assets.map((a: any, idx: number) => {
      const uri = a.uri;
      const isVideo = (a.type || "").toLowerCase() === "video";
      const ext = (
        uri.split(".").pop() || (isVideo ? "mp4" : "jpg")
      ).toLowerCase();
      const mime = isVideo
        ? `video/${ext === "mov" ? "quicktime" : ext}`
        : `image/${ext === "jpg" ? "jpeg" : ext}`;
      const name = `evidence-${Date.now()}-${idx}.${ext}`;

      return {
        url: uri,
        type: isVideo ? "video" : "image",
        file: { uri, name, type: mime },
      };
    });

    setEvidenceMedia((prev) => [...prev, ...added].slice(0, 5));
  }, [evidenceMedia.length]);

  const removeEvidenceAt = (index: number) => {
    setEvidenceMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCloseRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedPaidOrder(null);
    setSelectedPaidOrderItems([]);
    setSelectedProducts({});
    setRefundQtyByProduct({});
    setRefundEmployeeId(null);
    setRefundReason("");
    setEvidenceMedia([]);
  };

  const submitRefund = useCallback(async () => {
    if (!storeId) return;
    if (!selectedPaidOrder?._id) {
      Alert.alert("Thiếu đơn", "Chưa chọn đơn cần hoàn.");
      return;
    }
    // Không bắt buộc chọn nhân viên - backend sẽ tự lấy từ người đăng nhập
    const reason = refundReason.trim();
    if (!reason) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do hoàn trả.");
      return;
    }

    const selectedIds = Object.keys(selectedProducts).filter(
      (k) => selectedProducts[k]
    );
    if (selectedIds.length === 0) {
      Alert.alert(
        "Chưa chọn sản phẩm",
        "Vui lòng chọn ít nhất 1 sản phẩm để hoàn trả."
      );
      return;
    }

    const items: SelectedProductItem[] = selectedIds.map((productId) => ({
      productId,
      quantity: Math.max(1, refundQtyByProduct[productId] || 1),
    }));

    setLoadingList(true);
    try {
      const formData: any = new FormData();
      // Không gửi employeeId - backend sẽ tự lấy từ người đăng nhập
      formData.append("refundReason", reason);
      formData.append("items", JSON.stringify(items));

      // files
      evidenceMedia.forEach((m) => {
        if (m.file?.uri) {
          formData.append("files", m.file as any);
        }
      });

      await apiClient.post(
        `/orders/${selectedPaidOrder._id}/refund`,
        formData,
        {
          params: { storeId },
          headers: {
            ...(authHeaders || {}),
            "Content-Type": "multipart/form-data",
          },
        }
      );

      Alert.alert("Thành công", "Tạo đơn hoàn trả thành công!");
      handleCloseRefundModal();
      await loadRefundOrders();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Lỗi tạo đơn hoàn trả");
    } finally {
      setLoadingList(false);
    }
  }, [
    storeId,
    selectedPaidOrder?._id,
    selectedProducts,
    refundQtyByProduct,
    refundReason,
    evidenceMedia,
    authHeaders,
    loadRefundOrders,
  ]);

  // ===== render loading init =====
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}

      <ScrollView
        contentContainerStyle={{ padding: 12 }}
        keyboardShouldPersistTaps="always"
      >
        <Card
          title="Bộ lọc"
          right={
            <Pressable
              onPress={openPaidOrdersModal}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Tạo đơn trả</Text>
            </Pressable>
          }
        >
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm mã đơn / tên khách / SĐT..."
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={[styles.muted, { alignSelf: "center", marginRight: 5 }]}>NV Hoàn:</Text>
              <PillBtn
                text="Tất cả"
                active={!selectedEmployeeId}
                onPress={() => setSelectedEmployeeId(null)}
              />
              <PillBtn
                text="Chủ cửa hàng"
                active={selectedEmployeeId === "owner"}
                onPress={() => setSelectedEmployeeId("owner")}
              />
              {employees.map((e) => (
                <PillBtn
                  key={e._id}
                  text={e.fullName}
                  active={selectedEmployeeId === e._id}
                  onPress={() => setSelectedEmployeeId(e._id)}
                />
              ))}
            </View>
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Text style={[styles.muted, { alignSelf: "center", marginRight: 5 }]}>NV Bán:</Text>
              <PillBtn
                text="Tất cả"
                active={!selectedSalespersonId}
                onPress={() => setSelectedSalespersonId(null)}
              />
              <PillBtn
                text="Chủ cửa hàng"
                active={selectedSalespersonId === "owner"}
                onPress={() => setSelectedSalespersonId("owner")}
              />
              {employees.map((e) => (
                <PillBtn
                  key={e._id}
                  text={e.fullName}
                  active={selectedSalespersonId === e._id}
                  onPress={() => setSelectedSalespersonId(e._id)}
                />
              ))}
            </View>
          </ScrollView>
        </Card>

        {/* List + detail */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Card title="Đơn đã hoàn">
              {loadingList ? (
                <View style={styles.centerSlim}>
                  <ActivityIndicator />
                  <Text style={styles.muted}>Đang tải danh sách...</Text>
                </View>
              ) : (
                <FlatList
                  data={filteredRefundOrders}
                  keyExtractor={(i) => i._id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  ListEmptyComponent={
                    <Text style={styles.muted}>Chưa có đơn hoàn.</Text>
                  }
                  renderItem={({ item }) => {
                    const active = item._id === selectedOrderId;
                    return (
                      <Pressable
                        onPress={() => loadRefundDetail(item._id)}
                        style={({ pressed }) => [
                          styles.orderRow,
                          active && styles.orderRowActive,
                          pressed && { opacity: 0.95 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderId}>
                            #{item._id.slice(-8)}
                          </Text>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            Khách: {item.orderId?.customer?.name || "Khách vãng lai"} •{" "}
                            {item.orderId?.customer?.phone || "---"}
                          </Text>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            NV bán: {item.orderId?.employeeId?.fullName || "Chủ cửa hàng"}
                          </Text>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            NV hoàn: {item.refundedBy?.fullName || "Chủ cửa hàng"} •{" "}
                            {formatDateTime(item.createdAt)}
                          </Text>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.money}>
                            {formatCurrency(item.refundAmount)}
                          </Text>
                          <Text
                            style={[
                              styles.badge,
                              item.orderId?.status === "refunded"
                                ? styles.badgeDanger
                                : styles.badgeWarn,
                            ]}
                          >
                            {item.orderId?.status === "refunded"
                              ? "Hoàn toàn bộ"
                              : "Hoàn 1 phần"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }}
                />
              )}
            </Card>
          </View>
        </View>

        <Card title="Chi tiết hoàn trả">
          {loadingDetail ? (
            <View style={styles.centerSlim}>
              <ActivityIndicator />
              <Text style={styles.muted}>Đang tải chi tiết...</Text>
            </View>
          ) : !refundDetail ? (
            <Text style={styles.muted}>
              Chọn 1 đơn ở danh sách để xem chi tiết.
            </Text>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>Đơn gốc</Text>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Mã đơn</Text>
                <Text style={styles.v}>{refundDetail.order._id}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Cửa hàng</Text>
                <Text style={styles.v}>{refundDetail.order.storeId?.name}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Nhân viên bán</Text>
                <Text style={styles.v}>
                  {refundDetail.order.employeeId?.fullName || "Chủ cửa hàng"}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Khách</Text>
                <Text style={styles.v}>
                  {refundDetail.order.customer
                    ? `${refundDetail.order.customer.name} (${refundDetail.order.customer.phone})`
                    : "Trống"}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Tổng tiền</Text>
                <Text
                  style={[styles.v, { fontWeight: "900", color: "#2563eb" }]}
                >
                  {formatCurrency(refundDetail.order.totalAmount)}
                </Text>
              </View>

              <View style={styles.hr} />

              <Text style={styles.sectionTitle}>Sản phẩm trong đơn</Text>
              {refundDetail.orderItems?.map((it) => (
                <View key={it._id} style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineTitle}>{it.productId?.name}</Text>
                    <Text style={styles.lineSub}>SKU: {it.productId?.sku}</Text>
                    <Text style={styles.lineSub}>
                      SL: {it.quantity} • Đơn giá:{" "}
                      {formatCurrency(it.priceAtTime)}
                    </Text>
                  </View>
                  <Text style={styles.money}>
                    {formatCurrency(it.subtotal)}
                  </Text>
                </View>
              ))}

              <View style={styles.hr} />

              <Text style={[styles.sectionTitle, { color: "#ef4444" }]}>
                Chi tiết hoàn
              </Text>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Người xử lý</Text>
                <Text style={styles.v}>
                  {(refundDetail.refundDetail as any)?.refundedByName ||
                    refundDetail.refundDetail?.refundedBy?.fullName ||
                    "Chủ cửa hàng"}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Thời gian</Text>
                <Text style={styles.v}>
                  {formatDateTime(refundDetail.refundDetail?.refundedAt)}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Lý do</Text>
                <Text style={styles.v}>
                  {refundDetail.refundDetail?.refundReason || "---"}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.k}>Tiền hoàn</Text>
                <Text
                  style={[styles.v, { fontWeight: "900", color: "#ef4444" }]}
                >
                  {formatCurrency(refundDetail.refundDetail?.refundAmount)}
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
                Sản phẩm đã hoàn
              </Text>
              {refundDetail.refundDetail?.refundItems?.map((ri) => (
                <View key={ri._id} style={styles.lineItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineTitle}>{ri.productId?.name}</Text>
                    <Text style={styles.lineSub}>SKU: {ri.productId?.sku}</Text>
                    <Text style={styles.lineSub}>SL hoàn: {ri.quantity}</Text>
                  </View>
                  <Text style={[styles.money, { color: "#ef4444" }]}>
                    {formatCurrency(ri.subtotal)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>

      {/* Modal: paid orders */}
      <Modal
        visible={paidOrdersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPaidOrdersModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn đơn đã thanh toán</Text>

            {loadingPaid ? (
              <View style={styles.centerSlim}>
                <ActivityIndicator />
                <Text style={styles.muted}>Đang tải...</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <TextInput
                  value={modalSearchText}
                  onChangeText={setModalSearchText}
                  placeholder="Tìm mã đơn / tên khách..."
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, { marginBottom: 10 }]}
                />
                
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 10 }}
                >
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <PillBtn
                      text="Tất cả NV"
                      active={!modalSelectedEmployeeId}
                      onPress={() => setModalSelectedEmployeeId(null)}
                    />
                    <PillBtn
                      text="Chủ cửa hàng"
                      active={modalSelectedEmployeeId === "owner"}
                      onPress={() => setModalSelectedEmployeeId("owner")}
                    />
                    {employees.map((e) => (
                      <PillBtn
                        key={e._id}
                        text={e.fullName}
                        active={modalSelectedEmployeeId === e._id}
                        onPress={() => setModalSelectedEmployeeId(e._id)}
                      />
                    ))}
                  </View>
                </ScrollView>

                <ScrollView
                  style={{ maxHeight: 400 }}
                  keyboardShouldPersistTaps="always"
                >
                  {filteredPaidOrders.length === 0 ? (
                    <Text style={[styles.muted, { textAlign: "center", marginTop: 20 }]}>Không tìm thấy đơn phù hợp</Text>
                  ) : (
                    filteredPaidOrders.map((o) => (
                      <Pressable
                        key={o._id}
                        onPress={() => handleOpenRefundModal(o)}
                        style={({ pressed }) => [
                          styles.modalRowItem,
                          pressed && { opacity: 0.92 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderId}>#{o._id.slice(-8)}</Text>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            Khách: {o.customer?.name || "Trống"} •{" "}
                            {o.customer?.phone || "---"}
                          </Text>
                          <Text style={styles.orderMeta} numberOfLines={1}>
                            Bán bởi: {o.employeeId?.fullName || "Chủ cửa hàng"} •{" "}
                            {formatDateTime(o.createdAt)}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.money}>
                            {formatCurrency(o.totalAmount)}
                          </Text>
                          <Text style={[styles.badge, styles.badgeInfo]}>
                            {o.paymentMethod === "cash" ? "Tiền mặt" : "QR"}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            )}

            <Pressable
              onPress={() => setPaidOrdersModalOpen(false)}
              style={({ pressed }) => [
                styles.outlineBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.outlineBtnText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal: create refund */}
      <Modal
        visible={refundModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRefundModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "88%" }]}>
            <Text style={styles.modalTitle}>Tạo đơn hoàn trả</Text>

            {selectedPaidOrder ? (
              <Text style={styles.muted}>
                Đơn: #{selectedPaidOrder._id.slice(-8)} • Tổng:{" "}
                {formatCurrency(selectedPaidOrder.totalAmount)}
              </Text>
            ) : null}

            <ScrollView
              style={{ marginTop: 10 }}
              keyboardShouldPersistTaps="always"
            >
              {/* Người xử lý sẽ được lấy tự động từ backend */}

              <Text style={[styles.label, { marginTop: 12 }]}>
                Lý do hoàn trả
              </Text>
              <TextInput
                value={refundReason}
                onChangeText={setRefundReason}
                placeholder="Mô tả lý do..."
                placeholderTextColor="#94a3b8"
                style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                multiline
              />

              <Text style={[styles.label, { marginTop: 12 }]}>
                Minh chứng (tối đa 5)
              </Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {evidenceMedia.map((m, idx) => (
                  <View key={`${m.url}-${idx}`} style={styles.thumbWrap}>
                    {m.type === "image" ? (
                      <Image source={{ uri: m.url }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbVideo]}>
                        <Text style={{ color: "#fff", fontWeight: "900" }}>
                          VIDEO
                        </Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => removeEvidenceAt(idx)}
                      style={styles.thumbRemove}
                    >
                      <Text style={styles.thumbRemoveText}>X</Text>
                    </Pressable>
                  </View>
                ))}

                <Pressable onPress={pickEvidence} style={styles.addEvidenceBtn}>
                  <Text style={styles.addEvidenceText}>+ Thêm</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                Chọn sản phẩm hoàn
              </Text>
              {selectedPaidOrderItems.map((it) => {
                const pid = it.productId?._id;
                if (!pid) return null;

                // Sử dụng maxRefundableQuantity từ API nếu có
                const maxQty = it.maxRefundableQuantity ?? (it.quantity - (it.refundedQuantity || 0));
                const alreadyRefunded = it.refundedQuantity || 0;
                const isFullyRefunded = maxQty <= 0;
                const checked = !!selectedProducts[pid];
                const qty = refundQtyByProduct[pid] || 1;

                // Item đã hoàn hết thì hiển thị mờ
                if (isFullyRefunded) {
                  return (
                    <View key={it._id} style={[styles.refundItemRow, { opacity: 0.5 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.lineTitle, { color: "#9ca3af" }]}>
                          {it.productId?.name} (Đã hoàn hết)
                        </Text>
                        <Text style={styles.lineSub}>
                          SKU: {it.productId?.sku} • Đã hoàn: {alreadyRefunded}/{it.quantity}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={it._id} style={styles.refundItemRow}>
                    <Pressable
                      onPress={() => toggleSelectProduct(pid, maxQty)}
                      style={styles.checkbox}
                    >
                      <View
                        style={[
                          styles.checkboxBox,
                          checked && styles.checkboxBoxOn,
                        ]}
                      >
                        {checked ? (
                          <Text style={styles.checkboxTick}>✓</Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.lineTitle}>
                          {it.productId?.name}
                        </Text>
                        <Text style={styles.lineSub}>
                          SKU: {it.productId?.sku} • Đã mua: {it.quantity} • Đơn giá:{" "}
                          {formatCurrency(it.priceAtTime)}
                        </Text>
                        {alreadyRefunded > 0 && (
                          <Text style={[styles.lineSub, { color: "#ef4444" }]}>
                            Đã hoàn: {alreadyRefunded} | Còn lại: {maxQty}
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    {checked ? (
                      <View style={styles.qtyMini}>
                        <Pressable
                          onPress={() =>
                            setRefundQtyByProduct((p) => ({
                              ...p,
                              [pid]: Math.max(1, (p[pid] || 1) - 1),
                            }))
                          }
                          style={styles.qtyMiniBtn}
                        >
                          <Text style={styles.qtyMiniBtnText}>-</Text>
                        </Pressable>

                        <Text style={styles.qtyMiniText}>{qty}</Text>

                        <Pressable
                          onPress={() =>
                            setRefundQtyByProduct((p) => ({
                              ...p,
                              [pid]: Math.min(maxQty, (p[pid] || 1) + 1),
                            }))
                          }
                          style={styles.qtyMiniBtn}
                        >
                          <Text style={styles.qtyMiniBtnText}>+</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={handleCloseRefundModal}
                style={[styles.outlineBtn, { flex: 1 }]}
              >
                <Text style={styles.outlineBtnText}>Huỷ</Text>
              </Pressable>

              <Pressable
                onPress={submitRefund}
                style={[styles.dangerBtn, { flex: 1 }]}
              >
                <Text style={styles.dangerBtnText}>Xác nhận hoàn</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default OrderRefundScreen;

/** =========================
 *  Styles
 *  ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },

  pageHeader: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "android" ? 12 : 4,
    paddingBottom: 10,
    backgroundColor: "#10b981",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
  },
  pageTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },
  pageSubTitle: {
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: { fontWeight: "900", color: "#0b1220" },

  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    color: "#0b1220",
  },

  primaryBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  outlineBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  outlineBtnText: { color: "#0b1220", fontWeight: "900" },

  dangerBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "900" },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillInactive: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  pillActive: { backgroundColor: "#e6fffb", borderColor: "#10b981" },
  pillText: { fontWeight: "800", fontSize: 12 },
  pillTextInactive: { color: "#0b1220" },
  pillTextActive: { color: "#047857" },

  orderRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 10,
  },
  orderRowActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  orderId: { fontWeight: "900", color: "#0b1220" },
  orderMeta: {
    marginTop: 4,
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },

  money: { fontWeight: "900", color: "#0b1220" },
  badge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 11,
  },
  badgeDanger: { backgroundColor: "#fee2e2", color: "#b91c1c" as any },
  badgeWarn: { backgroundColor: "#ffedd5", color: "#9a3412" as any },
  badgeInfo: { backgroundColor: "#dbeafe", color: "#1d4ed8" as any },

  sectionTitle: {
    fontWeight: "900",
    color: "#0b1220",
    marginTop: 6,
    marginBottom: 8,
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

  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  lineTitle: { fontWeight: "900", color: "#0b1220" },
  lineSub: { color: "#475569", fontWeight: "700", fontSize: 12, marginTop: 4 },

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
  modalTitle: {
    fontWeight: "900",
    color: "#0b1220",
    fontSize: 16,
    marginBottom: 6,
  },
  modalRowItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerSlim: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { marginTop: 8, color: "#64748b", fontWeight: "700" },

  label: { fontWeight: "900", color: "#0b1220", marginBottom: 6 },

  thumbWrap: { position: "relative" },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  thumbVideo: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },
  thumbRemove: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemoveText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  addEvidenceBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  addEvidenceText: { fontWeight: "900", color: "#0b1220" },

  refundItemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  checkbox: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxBoxOn: { backgroundColor: "#10b981", borderColor: "#10b981" },
  checkboxTick: { color: "#fff", fontWeight: "900" },

  qtyMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    alignSelf: "flex-end",
  },
  qtyMiniBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qtyMiniBtnText: { fontWeight: "900", color: "#0b1220", fontSize: 16 },
  qtyMiniText: {
    fontWeight: "900",
    color: "#0b1220",
    width: 30,
    textAlign: "center",
  },
});
