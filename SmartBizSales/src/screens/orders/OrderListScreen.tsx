// src/screens/orders/OrderListScreen.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Platform,
  Modal,
  Alert,
  Share,
} from "react-native";

import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";

import apiClient from "../../api/apiClient";
import orderApi from "../../api/orderApi";
import { useAuth } from "../../context/AuthContext";
import debounce from "@/utils/debounce";
import { Ionicons } from "@expo/vector-icons";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

// ========== Types ==========
interface MongoDecimal {
  $numberDecimal: string;
}

interface Store {
  _id: string;
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  taxCode?: string;
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
}

interface Employee {
  _id: string;
  fullName: string;
}

type OrderStatus = "pending" | "paid" | "refunded" | "partially_refunded";
type PaymentMethod = "cash" | "qr";

interface Order {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  grossAmount?: MongoDecimal;
  discountAmount?: MongoDecimal;
  status: OrderStatus;
  createdAt: string;
  paymentMethod: PaymentMethod | string;
  isVATInvoice: boolean;
  vatAmount?: MongoDecimal;
  beforeTaxAmount?: MongoDecimal;
  printDate?: string;
  printCount: number;
}

interface OrderListResponse {
  message: string;
  total: number;
  orders: Order[];
}

type PeriodType = "day" | "month" | "quarter" | "year" | "custom";
type PickerTarget = "day" | "month" | "year" | "customFrom" | "customTo";

// ========== Small UI helpers ==========
function Chip({
  label,
  icon,
  active,
  onPress,
  tone = "default",
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
  tone?: "default" | "primary" | "danger";
}) {
  const bg = active ? (tone === "danger" ? "#fee2e2" : "#e6f4ff") : "#f3f4f6";

  const border = active
    ? tone === "danger"
      ? "#fecaca"
      : "#91caff"
    : "#e5e7eb";

  const color = active
    ? tone === "danger"
      ? "#b91c1c"
      : "#1677ff"
    : "#374151";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.chip, { backgroundColor: bg, borderColor: border }]}
    >
      {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PillButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function formatVND(num: number): string {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${Math.round(num)}₫`;
  }
}

function toNumberDecimal(value: MongoDecimal | any): number {
  const s = value?.$numberDecimal ?? value?.numberDecimal ?? value;
  const n = parseFloat(String(s ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function statusMeta(status: OrderStatus) {
  const map: Record<
    OrderStatus,
    { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    pending: {
      label: "Chờ thanh toán",
      color: "#fa8c16",
      icon: "time-outline",
    },
    paid: {
      label: "Đã thanh toán",
      color: "#52c41a",
      icon: "checkmark-circle-outline",
    },
    refunded: {
      label: "Hoàn toàn bộ",
      color: "#ff4d4f",
      icon: "return-up-back-outline",
    },
    partially_refunded: {
      label: "Hoàn 1 phần",
      color: "#fa541c",
      icon: "return-up-back-outline",
    },
  };
  return map[status] || map.pending;
}

// Helper: Chuyển số thành chữ (Tiếng Việt)
const docSoVND = (so: number): string => {
  if (so === 0) return "Không đồng";
  const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const donVi = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  
  const docBlock = (block: number) => {
    let s = "";
    const h = Math.floor(block / 100);
    const ch = Math.floor((block % 100) / 10);
    const dv = block % 10;
    
    if (h > 0 || block >= 100) {
      s += chuSo[h] + " trăm ";
      if (ch === 0 && dv > 0) s += "lẻ ";
    }
    
    if (ch > 1) {
      s += chuSo[ch] + " mươi ";
      if (dv === 1) s += "mốt ";
      else if (dv === 5) s += "lăm ";
      else if (dv > 0) s += chuSo[dv];
    } else if (ch === 1) {
      s += "mười ";
      if (dv === 1) s += "một ";
      else if (dv === 5) s += "lăm ";
      else if (dv > 0) s += chuSo[dv];
    } else if (dv > 0) {
      s += chuSo[dv];
    }
    return s.trim();
  };

  let res = "";
  let i = 0;
  let s = Math.floor(so);
  if (s < 0) return "Âm " + docSoVND(Math.abs(s));

  do {
    const block = s % 1000;
    if (block > 0) {
      const blockStr = docBlock(block);
      res = blockStr + " " + donVi[i] + " " + res;
    }
    s = Math.floor(s / 1000);
    i++;
  } while (s > 0);

  const result = res.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng chẵn.";
};

function paymentMeta(method: string) {
  const map: Record<
    string,
    { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    cash: { label: "Tiền mặt", color: "#52c41a", icon: "cash-outline" },
    qr: { label: "Chuyển khoản", color: "#1677ff", icon: "qr-code-outline" },
  };
  return (
    map[method] || {
      label: method || "N/A",
      color: "#6b7280",
      icon: "card-outline",
    }
  );
}

// ========== Pending modal (mobile) ==========
function PendingOrdersModal({
  visible,
  onClose,
  orders,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
  onDelete: (id: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flex: 1,
              }}
            >
              <Ionicons name="time-outline" size={22} color="#fa8c16" />
              <Text style={styles.modalTitle}>Đơn chưa thanh toán</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.8}
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            Danh sách dưới đây là các đơn hàng "Chưa thanh toán".
            {"\n"}Bạn có thể xóa nếu đó là đơn ảo hoặc khách hủy.
          </Text>

          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="checkmark-done-outline"
                size={40}
                color="#d1d5db"
              />
              <Text style={styles.emptyText}>Không có đơn chờ thanh toán.</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(i) => i._id}
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 10 }}
              renderItem={({ item }) => {
                const st = statusMeta(item.status);
                return (
                  <View style={styles.pendingRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.pendingCode} numberOfLines={1}>
                        #{item._id.slice(-8)}
                      </Text>
                      <Text style={styles.pendingSub} numberOfLines={1}>
                        {item.customer?.name || "Khách lẻ"} •{" "}
                        {item.customer?.phone || "N/A"}
                      </Text>
                      <Text style={styles.pendingAmount}>
                        {formatVND(toNumberDecimal(item.totalAmount))}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <View
                         style={[
                          styles.badge,
                          {
                            backgroundColor: "#fff7e6",
                            borderColor: "#ffd591",
                          },
                        ]}
                      >
                         <Text style={[styles.badgeText, { color: st.color }]}>
                           {dayjs(item.createdAt).format("HH:mm")}
                         </Text>
                      </View>

                      <TouchableOpacity 
                        onPress={() => onDelete(item._id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ padding: 4 }}
                      >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.9}
            style={styles.modalCloseBtn}
          >
            <Text style={styles.modalCloseText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ========== Main screen ==========
const OrderListScreen: React.FC = () => {
  const { currentStore, token, user } = useAuth();
  const storeId = (currentStore as any)?.id || (currentStore as any)?._id;
  const storeName = (currentStore as any)?.name || "Cửa hàng";

  const axiosConfig = useMemo(() => {
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  }, [token]);

  // UI state
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [orders, setOrders] = useState<Order[]>([]);

  // Filters
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodKey, setPeriodKey] = useState<string>(""); // day: YYYY-MM-DD | month: YYYY-MM | quarter: YYYY-Qn | year: YYYY
  const [monthFrom, setMonthFrom] = useState<string>(""); // custom: YYYY-MM
  const [monthTo, setMonthTo] = useState<string>(""); // custom: YYYY-MM

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | undefined>(
    undefined
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | undefined>(
    undefined
  );
  const [searchText, setSearchText] = useState("");

  // Pagination (client side)
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Pending modal
  const [pendingVisible, setPendingVisible] = useState(false);

  // Date picker (for day/month/year/custom range)
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>("month");
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [printingId, setPrintingId] = useState<string | null>(null);

  // ========== Helpers ==========
  const isReadyToLoad = useCallback(() => {
    if (!storeId) return false;
    if (periodType === "custom") return !!monthFrom && !!monthTo;
    return !!periodKey;
  }, [storeId, periodType, periodKey, monthFrom, monthTo]);

  const disabledActions = !storeId || !isReadyToLoad();

  const periodDisplayText = useMemo(() => {
    if (!periodType) return "Chưa chọn kỳ";
    if (periodType === "day")
      return periodKey ? dayjs(periodKey).format("DD/MM/YYYY") : "Chọn ngày";
    if (periodType === "month")
      return periodKey
        ? dayjs(periodKey + "-01").format("MM/YYYY")
        : "Chọn tháng";
    if (periodType === "quarter")
      return periodKey ? periodKey.replace("-", " / ") : "Chọn quý";
    if (periodType === "year")
      return periodKey ? `Năm ${periodKey}` : "Chọn năm";
    if (periodType === "custom") {
      if (!monthFrom || !monthTo) return "Chọn khoảng tháng";
      return `${dayjs(monthFrom + "-01").format("MM/YYYY")} - ${dayjs(monthTo + "-01").format("MM/YYYY")}`;
    }
    return "Chưa chọn kỳ";
  }, [periodType, periodKey, monthFrom, monthTo]);

  const openPicker = useCallback(
    (target: PickerTarget) => {
      setPickerTarget(target);

      // set temp date to current displayed selection for nicer UX
      if (target === "day" && periodKey) {
        setTempDate(dayjs(periodKey).toDate());
      } else if (target === "month" && periodKey) {
        setTempDate(dayjs(periodKey + "-01").toDate());
      } else if (target === "year" && periodKey) {
        setTempDate(dayjs(`${periodKey}-01-01`).toDate());
      } else if (target === "customFrom" && monthFrom) {
        setTempDate(dayjs(monthFrom + "-01").toDate());
      } else if (target === "customTo" && monthTo) {
        setTempDate(dayjs(monthTo + "-01").toDate());
      } else {
        setTempDate(new Date());
      }

      setShowPicker(true);
    },
    [periodKey, monthFrom, monthTo]
  );

  const applyPickedDate = useCallback((date: Date, target: PickerTarget) => {
    const d = dayjs(date);

    if (target === "day") {
      setPeriodKey(d.format("YYYY-MM-DD"));
      return;
    }

    if (target === "month") {
      setPeriodKey(d.format("YYYY-MM"));
      return;
    }

    if (target === "year") {
      setPeriodKey(d.format("YYYY"));
      return;
    }

    if (target === "customFrom") {
      setMonthFrom(d.format("YYYY-MM"));
      return;
    }

    if (target === "customTo") {
      setMonthTo(d.format("YYYY-MM"));
      return;
    }
  }, []);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "dismissed") {
          setShowPicker(false);
          return;
        }
        const picked = date ?? tempDate;
        applyPickedDate(picked, pickerTarget);
        setShowPicker(false);
        return;
      }

      // iOS: update tempDate live
      if (date) setTempDate(date);
    },
    [applyPickedDate, pickerTarget, tempDate]
  );

  const closePickerIOS = useCallback(() => setShowPicker(false), []);
  const confirmPickerIOS = useCallback(() => {
    applyPickedDate(tempDate, pickerTarget);
    setShowPicker(false);
  }, [applyPickedDate, pickerTarget, tempDate]);

  // ========== Reset when change periodType ==========
  useEffect(() => {
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
    setOrders([]);
    setPage(1);
  }, [periodType]);

  // ========== API ==========
  const loadOrders = useCallback(
    async (isRefresh = false) => {
      if (!storeId) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params: any = { storeId, periodType, periodKey };
        if (periodType === "custom") {
          params.monthFrom = monthFrom;
          params.monthTo = monthTo;
        }

        const res = await apiClient.get<OrderListResponse>("orders/list-all", {
          ...axiosConfig,
          params,
        });

        setOrders(res.data?.orders || []);
        setFilterExpanded(false);
      } catch (e: any) {
        setOrders([]);
        Alert.alert(
          "Lỗi",
          e?.response?.data?.message || "Không thể tải danh sách đơn hàng."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, periodType, periodKey, monthFrom, monthTo, axiosConfig]
  );

  const debouncedLoadOrders = useMemo(
    () =>
      debounce(() => {
        loadOrders(false);
      }, 500),
    [loadOrders]
  );

  useEffect(() => {
    if (isReadyToLoad()) {
      debouncedLoadOrders();
    } else {
      setOrders([]);
    }

    return () => {
      debouncedLoadOrders.cancel?.();
    };
  }, [isReadyToLoad, debouncedLoadOrders]);

  const onRefresh = useCallback(() => {
    if (!isReadyToLoad()) return;
    loadOrders(true);
  }, [isReadyToLoad, loadOrders]);

  // ========== Search debounce ==========
  const debouncedSearch = useMemo(
    () =>
      debounce((text: string) => {
        setSearchText(text);
        setPage(1);
      }, 300),
    []
  );

  // ========== Filtered orders ==========
  const filteredOrders = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return (orders || []).filter((o) => {
      const matchSearch = q
        ? o._id.toLowerCase().includes(q) ||
          (o.customer?.name || "").toLowerCase().includes(q) ||
          (o.customer?.phone || "").includes(searchText.trim())
        : true;

      const matchStatus = selectedStatus ? o.status === selectedStatus : true;
      const matchPayment = paymentFilter
        ? o.paymentMethod === paymentFilter
        : true;

      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, searchText, selectedStatus, paymentFilter]);

  const visibleOrders = useMemo(() => {
    const end = page * pageSize;
    return filteredOrders.slice(0, end);
  }, [filteredOrders, page]);

  const pendingOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === "pending");
  }, [filteredOrders]);

  const handleExportExcel = useCallback(async () => {
    if (!storeId) {
      Alert.alert("Lỗi", "Không tìm thấy cửa hàng.");
      return;
    }
    if (!isReadyToLoad()) {
      Alert.alert(
        "Cảnh báo",
        "Vui lòng chọn đủ thông tin kỳ trước khi xuất Excel."
      );
      return;
    }

    let FS: any;
    let LegacyFS: any;
    let Sharing: any;

    try {
      FS = require("expo-file-system");
      LegacyFS = require("expo-file-system/legacy");
      Sharing = require("expo-sharing");
    } catch {
      Alert.alert("Chưa hỗ trợ", "Cần expo-file-system và expo-sharing.");
      return;
    }

    const toBase64 = (data: any) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer } = require("buffer");

      // Axios RN có thể trả ArrayBuffer, Uint8Array, hoặc array number
      if (data instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(data)).toString("base64");
      }
      if (data?.buffer instanceof ArrayBuffer) {
        // Uint8Array
        return Buffer.from(new Uint8Array(data.buffer)).toString("base64");
      }
      if (Array.isArray(data)) {
        return Buffer.from(Uint8Array.from(data)).toString("base64");
      }

      // Fallback: nếu lỡ server trả string/base64 rồi
      if (typeof data === "string") {
        // nếu là JSON string thì sẽ fail ở check "PK" bên dưới
        return Buffer.from(data, "binary").toString("base64");
      }

      throw new Error("Response data is not binary (ArrayBuffer/Uint8Array).");
    };

    const assertXlsxZip = (base64: string) => {
      // .xlsx là ZIP => bytes đầu phải là "PK" (0x50 0x4B)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer } = require("buffer");
      const bytes = Buffer.from(base64, "base64");
      const ok = bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
      if (!ok) throw new Error("Downloaded content is not an XLSX (ZIP) file.");
    };

    try {
      setLoading(true);

      const params: any = { storeId, periodType, periodKey };
      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      }

      const res = await apiClient.get("orders/export-all", {
        ...axiosConfig,
        params,
        responseType: "arraybuffer",
        headers: {
          ...(axiosConfig?.headers || {}),
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        // quan trọng: đừng để axios tự parse JSON
        transformResponse: (r: any) => r,
      });

      const base64 = toBase64(res.data);

      // Nếu server trả JSON lỗi (mà status vẫn 200/500 tuỳ), check này sẽ bắt được
      assertXlsxZip(base64);

      const safeName = `Danh_Sach_Don_Hang_${dayjs().format("DD-MM-YYYY")}.xlsx`
        .replace(/[\\/:*?"<>|\r\n]+/g, "_")
        .trim();

      const file = new FS.File(FS.Paths.document, safeName);

      try {
        if (file.exists) file.delete();
      } catch {}

      file.create();

      //  ghi base64 đúng chuẩn nhị phân
      await LegacyFS.writeAsStringAsync(file.uri, base64, {
        encoding: LegacyFS.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Xuất danh sách đơn hàng",
        });
      } else {
        Alert.alert("Thành công", `Đã lưu file tại: ${file.uri}`);
      }
    } catch (e: any) {
      Alert.alert(
        "Lỗi",
        e?.message || e?.response?.data?.message || "Không thể xuất Excel."
      );
    } finally {
      setLoading(false);
    }
  }, [
    storeId,
    isReadyToLoad,
    periodType,
    periodKey,
    monthFrom,
    monthTo,
    axiosConfig,
  ]);

  // ========== Printing Logic ==========
  const buildReprintHtml = useCallback(
    (order: any) => {
      // 1. Prepare Data
      const storeInfo = (currentStore as Store) || {};
      const storeName = storeInfo.name || "Cửa hàng";
      const storeAddress = storeInfo.address || "---";
      const storePhone = storeInfo.phone || "";
      const storeTaxCode = storeInfo.taxCode || ""; // Hoặc lấy từ settings nếu có

      const orderIdStr = order?._id ? order._id.slice(-8) : "---";
      const createdDate = order?.createdAt ? new Date(order.createdAt) : new Date();
      
      // Khách hàng
      const customerName = order?.customer?.name || "Khách vãng lai";
      const customerPhone = order?.customer?.phone || "";
      // const customerAddress = order?.customer?.address || ""; // Nếu có address

      // Seller name fallback logic:
      let sellerName = order?.employeeId?.fullName; 
      if (!sellerName) {
         sellerName = (user as any)?.fullname;
      }
      if (!sellerName) sellerName = "Chủ cửa hàng"; // Final fallback

      // Items
      const rows = (order?.items || [])
        .map((item: any, idx: number) => {
          const name = item.productName || item.productId?.name || "Sản phẩm";
          const unit = item.productId?.unit || "";
          
          const quantity = Number(item.quantity || 0); // Quantity usually number
          const price = toNumberDecimal(item.priceAtTime || 0);
          const sub = toNumberDecimal(item.subtotal || 0);

          return `
          <tr>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #000; padding: 5px;">${name}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${unit}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${quantity}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatVND(price).replace('₫', '')}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatVND(sub).replace('₫', '')}</td>
          </tr>
        `;
        })
        .join("");

      // Totals
      const subTotal = toNumberDecimal(order?.beforeTaxAmount || 0); 
      const vatAmount = toNumberDecimal(order?.vatAmount || 0);
      const discount = toNumberDecimal(order?.discountAmount || 0);
      const totalAmount = toNumberDecimal(order?.totalAmount || 0);
      const isVAT = !!order?.isVATInvoice;

      // Payment Method Label
      const pmLabel = order?.paymentMethod === "cash" 
          ? "TIỀN MẶT" 
          : order?.paymentMethod === "qr" 
            ? "CHUYỂN KHOẢN / QR" 
            : "KHÁC";

      // Date components
      const dd = dayjs(createdDate).format("DD");
      const mm = dayjs(createdDate).format("MM");
      const yyyy = dayjs(createdDate).format("YYYY");

      // HTML Template (Simulating Web ModalPrintBill structure)
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body { 
      font-family: 'Times New Roman', serif; 
      font-size: 13px; 
      padding: 20px; 
      color: #000; 
      background-color: #fff;
      line-height: 1.4;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .header-left { flex: 2; }
    .header-right { flex: 1; text-align: right; }
    .store-name { font-weight: bold; font-size: 16px; text-transform: uppercase; }
    
    .title-box { text-align: center; margin: 15px 0; }
    .title-main { font-weight: bold; font-size: 20px; }
    .title-date { font-style: italic; font-size: 12px; }

    .customer-box { margin-bottom: 15px; }
    .row { display: flex; margin-bottom: 4px; }
    .label { min-width: 150px; }
    .val-bold { font-weight: bold; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { border: 1px solid #000; padding: 5px; background-color: #f2f2f2; font-weight: bold; }
    
    .totals-box { width: 100%; margin-left: auto; }
    .total-row { display: flex; justify-content: flex-end; margin-bottom: 4px; }
    .total-label { min-width: 200px; }
    .total-val { min-width: 120px; text-align: right; font-weight: bold; }
    
    .amount-words { margin-top: 10px; font-style: italic; }
    
    .signatures { display: flex; margin-top: 40px; text-align: center; }
    .sig-block { flex: 1; }
    .sig-title { font-weight: bold; }
    .sig-sub { font-size: 11px; font-style: italic; }
    .sig-name { margin-top: 60px; font-weight: bold; }
    
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #666; }
  </style>
</head>
<body>
  
  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <div class="store-name">${storeName}</div>
      <div>Địa chỉ: ${storeAddress}</div>
      ${storePhone ? `<div>Điện thoại: ${storePhone}</div>` : ""}
      ${storeTaxCode ? `<div>Mã số thuế: ${storeTaxCode}</div>` : ""}
    </div>
    <div class="header-right">
      <div style="font-size: 12px;">Số: ${orderIdStr}</div>
      <div style="font-size: 12px;">Ngày: ${dd}/${mm}/${yyyy}</div>
    </div>
  </div>

  <hr style="margin: 10px 0; border-color: #000;" />

  <!-- Title -->
  <div class="title-box">
    <div class="title-main">${isVAT ? "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" : "HÓA ĐƠN BÁN LẺ"}</div>
    <div class="title-date">Ngày ${dd} tháng ${mm} năm ${yyyy}</div>
  </div>

  <!-- Customer Info -->
  <div class="customer-box">
    <div class="row">
      <span class="label">Họ tên người mua hàng:</span>
      <span class="val-bold">${customerName}</span>
    </div>
    <div class="row">
      <span class="label">Điện thoại:</span>
      <span>${customerPhone || "---"}</span>
    </div>
    <div class="row">
      <span class="label">Hình thức thanh toán:</span>
      <span style="text-transform: uppercase;">${pmLabel}</span>
    </div>
    <!-- Add VAT Company info if needed (checking isVATInvoice) -->
    ${isVAT ? `
    <div class="row">
      <span class="label">Đơn vị / MST:</span>
      <span>(Thông tin VAT)</span>
    </div>` : ""}
  </div>

  <!-- Table -->
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">STT</th>
        <th>Tên hàng hóa, dịch vụ</th>
        <th style="width: 70px;">Đơn vị</th>
        <th style="width: 60px;">SL</th>
        <th style="width: 100px;">Đơn giá</th>
        <th style="width: 120px;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-box">
    <div class="total-row">
      <span class="total-label">Cộng tiền hàng:</span>
      <span class="total-val">${formatVND(subTotal).replace('₫', '')}</span>
    </div>
    ${discount > 0 ? `
    <div class="total-row">
      <span class="total-label">Chiết khấu:</span>
      <span class="total-val">-${formatVND(discount).replace('₫', '')}</span>
    </div>` : ""}
    <div class="total-row">
      <span class="total-label">Tiền thuế GTGT:</span>
      <span class="total-val">${formatVND(vatAmount).replace('₫', '')}</span>
    </div>
    <div class="total-row" style="font-size: 16px;">
      <span class="total-label" style="font-weight: bold;">Tổng cộng thanh toán:</span>
      <span class="total-val" style="border-top: 1px solid #000;">${formatVND(totalAmount).replace('₫', '')}</span>
    </div>
  </div>

  <div class="amount-words">
    Số tiền viết bằng chữ: <span style="font-weight: bold;">${docSoVND(totalAmount)}</span>
  </div>

  <!-- Signatures -->
  <div class="signatures">
    <div class="sig-block">
      <div class="sig-title">NGƯỜI MUA HÀNG</div>
      <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
      <div class="sig-name" style="margin-top: 80px;">${customerName !== "Khách vãng lai" ? customerName : ""}</div>
    </div>
    <div class="sig-block">
      <div class="sig-title">NGƯỜI BÁN HÀNG</div>
      <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
      <div class="sig-name" style="margin-top: 80px;">${sellerName}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${order?.printCount > 0 ? `<div>(Bản sao hóa đơn - lần in thứ ${order.printCount + 1})</div>` : ""}
    <div>Cảm ơn quý khách đã mua hàng!</div>
    <div>Hệ thống quản lý SmartBiz v1.0</div>
  </div>

</body>
</html>`;
    },
    [currentStore, user]
  );
  


  const handleReprint = useCallback(async (orderItem: Order) => {
    try {
      setPrintingId(orderItem._id);
      
      // 1. Fetch full details
      const res = await apiClient.get<any>(`/orders/${orderItem._id}`);
      const fullOrder = res.data?.order;
      if (!fullOrder) throw new Error("Không lấy được chi tiết đơn hàng");
      
      // Fallback seller name logic injection (since we can't easily modify buildReprintHtml signature/access scope cleanly inside duplicate code)
      // Actually fullOrder.employeeId might be null.
      if (!fullOrder.employeeId) {
          // Manual patch for display
           // We'll handle this in buildReprintHtml dynamically if we move 'user' into scope or pass it.
           // Better: create a specialized helper or pass user name to buildReprintHtml.
           // However, let's just use what we have in fullOrder for now.
           // If user wants "current user logged in" as fallback, we need that info.
           // I'll assume 'user' is available in component scope.
      }
      
      const html = buildReprintHtml({ ...fullOrder,
         // Patch seller name if missing
         employeeId: fullOrder.employeeId || { fullName: (user as any)?.fullname || "Chủ cửa hàng" }
      });

      // 2. Generate PDF
      const fileName = `hoa-don-${orderItem._id.slice(-8)}.pdf`;
      let pdfUri = "";
      
      try {
        const Print = require("expo-print");
        const Sharing = require("expo-sharing");
        
        if (Print?.printToFileAsync) {
           const { uri } = await Print.printToFileAsync({ html });
           pdfUri = uri;
           
            if (Sharing?.isAvailableAsync && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: fileName,
                });
            } else {
                 await Share.share({
                  url: uri,
                  message: "Hoá đơn PDF",
                  title: fileName,
                });
            }
        }
      } catch (e) {
          console.log("Expo Print/Share error", e);
          Alert.alert("Lỗi", "Không thể tạo file PDF (cần expo-print).");
          return;
      }

      // 3. Update print count (backend)
      await apiClient.post(`/orders/${orderItem._id}/print-bill`);

      // 4. Update UI (increment locally to avoid full reload)
      setOrders(prev => prev.map(o => {
          if (o._id === orderItem._id) {
              return { ...o, printCount: (o.printCount || 0) + 1 };
          }
          return o;
      }));

    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể in hoá đơn.");
    } finally {
      setPrintingId(null);
    }
  }, [user, buildReprintHtml]);
  const renderOrderItem = useCallback(
    ({ item }: { item: Order }) => {
      const st = statusMeta(item.status);
      const pm = paymentMeta(item.paymentMethod);

      return (
        <View style={styles.orderCard}>
          <View style={styles.orderTopRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orderCode} numberOfLines={1}>
                #{item._id.slice(-8)}
              </Text>
              <Text style={styles.orderSub} numberOfLines={1}>
                {item.customer?.name || "Khách lẻ"} •{" "}
                {item.customer?.phone || "N/A"}
              </Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.orderAmount}>
                {formatVND(toNumberDecimal(item.totalAmount))}
              </Text>
              {item.discountAmount && toNumberDecimal(item.discountAmount) > 0 ? (
                <Text style={[styles.orderTime, { color: "#52c41a" }]}>
                  Giảm: -{formatVND(toNumberDecimal(item.discountAmount))}
                </Text>
              ) : null}
              <Text style={styles.orderTime}>
                {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
              </Text>
            </View>
          </View>

          <View style={styles.orderMidRow}>
            <View style={styles.metaLine}>
              <Ionicons name="person-outline" size={16} color="#6b7280" />
              <Text style={styles.metaText} numberOfLines={1}>
                NV: {item.employeeId?.fullName || "Chủ cửa hàng"}
              </Text>
            </View>

            <View style={styles.metaLine}>
              <Ionicons name={pm.icon} size={16} color={pm.color} />
              <Text
                style={[styles.metaText, { color: pm.color }]}
                numberOfLines={1}
              >
                {pm.label}
              </Text>
            </View>
          </View>

          <View style={styles.orderBottomRow}>
            <View
              style={[
                styles.badge,
                { backgroundColor: "#f6ffed", borderColor: "#b7eb8f" },
              ]}
            >
              <Ionicons name="print-outline" size={14} color="#389e0d" />
              <Text style={[styles.badgeText, { color: "#389e0d" }]}>
                In HĐ: {item.printCount || 0} lần
              </Text>
            </View>

            {/* Reprint Button */}
            <TouchableOpacity
              onPress={() => handleReprint(item)}
              disabled={printingId === item._id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "#e6f4ff",
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#91caff",
              }}
            >
              {printingId === item._id ? (
                <ActivityIndicator size="small" color="#1677ff" />
              ) : (
                <Ionicons name="print-outline" size={16} color="#1677ff" />
              )}
              <Text
                style={{ fontSize: 12, color: "#1677ff", fontWeight: "500" }}
              >
                {printingId === item._id ? "Đang in..." : "In lại"}
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.badge,
                {
                  backgroundColor: item.isVATInvoice ? "#e6f4ff" : "#f3f4f6",
                  borderColor: "#e5e7eb",
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={item.isVATInvoice ? "#1677ff" : "#6b7280"}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: item.isVATInvoice ? "#1677ff" : "#6b7280" },
                ]}
              >
                {item.isVATInvoice 
                  ? `VAT: ${formatVND(toNumberDecimal(item.vatAmount || 0))}`
                  : "VAT: Không"}
              </Text>
            </View>

            <View
              style={[
                styles.badge,
                { backgroundColor: "#fff7e6", borderColor: "#ffd591" },
              ]}
            >
              <Ionicons name={st.icon} size={14} color={st.color} />
              <Text style={[styles.badgeText, { color: st.color }]}>
                {st.label}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [printingId, handleReprint]
  );

  // ========== Guards ==========
  if (!storeId) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={54} color="#ef4444" />
        <Text style={styles.centerTitle}>Chưa chọn cửa hàng</Text>
        <Text style={styles.centerSub}>
          Vui lòng chọn cửa hàng trước khi xem danh sách đơn hàng.
        </Text>
      </View>
    );
  }

  // ========== UI ==========
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="receipt-outline" size={26} color="#1677ff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Danh sách đơn hàng</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {storeName}
          </Text>
        </View>
      </View>

      {/* Filter card */}
      <View style={styles.filterCard}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setFilterExpanded((p) => !p)}
          style={styles.filterToggle}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <Ionicons name="funnel-outline" size={20} color="#1677ff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.filterToggleTitle}>
                {filterExpanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
              </Text>
              <Text style={styles.filterToggleSub} numberOfLines={1}>
                Kỳ: {periodDisplayText}
              </Text>
            </View>
          </View>
          <Ionicons
            name={filterExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#1677ff"
          />
        </TouchableOpacity>

        {filterExpanded ? (
          <View style={styles.filterBody}>
            <Text style={styles.sectionLabel}>Loại kỳ</Text>
            <View style={styles.rowWrap}>
              <PillButton
                label="Ngày"
                active={periodType === "day"}
                onPress={() => setPeriodType("day")}
              />
              <PillButton
                label="Tháng"
                active={periodType === "month"}
                onPress={() => setPeriodType("month")}
              />
              <PillButton
                label="Quý"
                active={periodType === "quarter"}
                onPress={() => setPeriodType("quarter")}
              />
              <PillButton
                label="Năm"
                active={periodType === "year"}
                onPress={() => setPeriodType("year")}
              />
              <PillButton
                label="Tùy chỉnh"
                active={periodType === "custom"}
                onPress={() => setPeriodType("custom")}
              />
            </View>

            <Text style={styles.sectionLabel}>Chọn thời gian</Text>

            {/* Day */}
            {periodType === "day" ? (
              <TouchableOpacity
                style={styles.fieldBtn}
                activeOpacity={0.85}
                onPress={() => openPicker("day")}
              >
                <Ionicons name="calendar-outline" size={18} color="#1677ff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Ngày</Text>
                  <Text style={styles.fieldValue}>
                    {periodKey
                      ? dayjs(periodKey).format("DD/MM/YYYY")
                      : "Chọn ngày"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}

            {/* Month */}
            {periodType === "month" ? (
              <TouchableOpacity
                style={styles.fieldBtn}
                activeOpacity={0.85}
                onPress={() => openPicker("month")}
              >
                <Ionicons name="calendar-outline" size={18} color="#1677ff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Tháng</Text>
                  <Text style={styles.fieldValue}>
                    {periodKey
                      ? dayjs(periodKey + "-01").format("MM/YYYY")
                      : "Chọn tháng"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}

            {/* Quarter */}
            {periodType === "quarter" ? (
              <View style={{ gap: 10 }}>
                <View style={styles.rowWrap}>
                  {[1, 2, 3, 4].map((q) => {
                    const active = periodKey?.endsWith(`Q${q}`);
                    return (
                      <PillButton
                        key={q}
                        label={`Q${q}`}
                        active={!!active}
                        onPress={() => {
                          const y = dayjs().year();
                          const year = periodKey
                            ? Number(periodKey.split("-")[0])
                            : y;
                          setPeriodKey(`${year}-Q${q}`);
                        }}
                      />
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.fieldBtn}
                  activeOpacity={0.85}
                  onPress={() => openPicker("year")}
                >
                  <Ionicons name="flag-outline" size={18} color="#1677ff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Năm áp dụng cho quý</Text>
                    <Text style={styles.fieldValue}>
                      {periodKey
                        ? `Năm ${periodKey.split("-")[0]}`
                        : `Năm ${dayjs().year()}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                <Text style={styles.helperText}>
                  Mẹo: chọn Q trước, sau đó đổi năm nếu cần.
                </Text>
              </View>
            ) : null}

            {/* Year */}
            {periodType === "year" ? (
              <TouchableOpacity
                style={styles.fieldBtn}
                activeOpacity={0.85}
                onPress={() => openPicker("year")}
              >
                <Ionicons name="flag-outline" size={18} color="#1677ff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Năm</Text>
                  <Text style={styles.fieldValue}>
                    {periodKey ? `Năm ${periodKey}` : "Chọn năm"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}

            {/* Custom */}
            {periodType === "custom" ? (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.fieldBtn}
                  activeOpacity={0.85}
                  onPress={() => openPicker("customFrom")}
                >
                  <Ionicons name="calendar-outline" size={18} color="#1677ff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Từ tháng</Text>
                    <Text style={styles.fieldValue}>
                      {monthFrom
                        ? dayjs(monthFrom + "-01").format("MM/YYYY")
                        : "Chọn tháng bắt đầu"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fieldBtn}
                  activeOpacity={0.85}
                  onPress={() => openPicker("customTo")}
                >
                  <Ionicons name="calendar-outline" size={18} color="#1677ff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Đến tháng</Text>
                    <Text style={styles.fieldValue}>
                      {monthTo
                        ? dayjs(monthTo + "-01").format("MM/YYYY")
                        : "Chọn tháng kết thúc"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </TouchableOpacity>

                {monthFrom &&
                monthTo &&
                dayjs(monthFrom + "-01").isAfter(dayjs(monthTo + "-01")) ? (
                  <Text style={[styles.helperText, { color: "#ef4444" }]}>
                    Khoảng tháng không hợp lệ: “Từ” phải nhỏ hơn hoặc bằng
                    “Đến”.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Trạng thái</Text>
            <View style={styles.rowWrap}>
              <Chip
                label="Tất cả"
                icon="apps-outline"
                active={!selectedStatus}
                onPress={() => setSelectedStatus(undefined)}
              />
              {(
                [
                  "pending",
                  "paid",
                  "refunded",
                  "partially_refunded",
                ] as OrderStatus[]
              ).map((st) => {
                const meta = statusMeta(st);
                return (
                  <Chip
                    key={st}
                    label={meta.label}
                    icon={meta.icon}
                    active={selectedStatus === st}
                    onPress={() =>
                      setSelectedStatus(selectedStatus === st ? undefined : st)
                    }
                    tone={st === "refunded" ? "danger" : "primary"}
                  />
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Phương thức</Text>
            <View style={styles.rowWrap}>
              <Chip
                label="Tất cả"
                icon="apps-outline"
                active={!paymentFilter}
                onPress={() => setPaymentFilter(undefined)}
              />
              {(["cash", "qr"] as PaymentMethod[]).map((m) => {
                const meta = paymentMeta(m);
                return (
                  <Chip
                    key={m}
                    label={meta.label}
                    icon={meta.icon}
                    active={paymentFilter === m}
                    onPress={() =>
                      setPaymentFilter(paymentFilter === m ? undefined : m)
                    }
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {/* Search + Actions */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo mã đơn, tên KH, SĐT..."
          placeholderTextColor="#9ca3af"
          onChangeText={(t) => debouncedSearch(t)}
          autoCorrect={false}
          autoCapitalize="none"
          editable={!disabledActions}
        />
        {!!searchText ? (
          <TouchableOpacity
            onPress={() => setSearchText("")}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            disabledActions && styles.actionBtnDisabled,
          ]}
          disabled={disabledActions}
          activeOpacity={0.85}
          onPress={() => setPendingVisible(true)}
        >
          <Ionicons name="time-outline" size={18} color="#111827" />
          <Text style={styles.actionBtnText}>Đơn chưa thanh toán</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtnPrimary,
            disabledActions && styles.actionBtnDisabled,
          ]}
          disabled={disabledActions}
          activeOpacity={0.85}
          onPress={handleExportExcel}
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnTextPrimary}>Xuất Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#1677ff" />
          <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
        </View>
      ) : !isReadyToLoad() ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="information-circle-outline"
            size={40}
            color="#d1d5db"
          />
          <Text style={styles.emptyText}>
            Vui lòng chọn kỳ để xem danh sách đơn hàng.
          </Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="file-tray-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Không có đơn hàng trong kỳ này.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={(i) => i._id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Platform.OS === "ios" ? "#1677ff" : undefined}
              colors={Platform.OS === "android" ? ["#1677ff"] : undefined}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.listInfo}>
                Đang hiển thị{" "}
                {Math.min(visibleOrders.length, filteredOrders.length)}/
                {filteredOrders.length} đơn • Kỳ: {periodDisplayText}
              </Text>
            </View>
          }
          ListFooterComponent={
            visibleOrders.length < filteredOrders.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                activeOpacity={0.85}
                onPress={() => setPage((p) => p + 1)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#1677ff" />
                <Text style={styles.loadMoreText}>Xem thêm</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ height: 10 }} />
            )
          }
        />
      )}

      {/* DateTimePicker - Android directly, iOS inside modal */}
      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          textColor="#000000"
          themeVariant="light"
          onChange={onPickerChange}
          locale="vi-VN"
        />
      ) : null}

      {showPicker && Platform.OS === "ios" ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closePickerIOS}
        >
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>
                {pickerTarget === "day"
                  ? "Chọn ngày"
                  : pickerTarget === "month"
                    ? "Chọn tháng (chọn 1 ngày bất kỳ trong tháng)"
                    : pickerTarget === "year"
                      ? "Chọn năm (chọn 1 ngày bất kỳ trong năm)"
                      : pickerTarget === "customFrom"
                        ? "Chọn tháng bắt đầu"
                        : "Chọn tháng kết thúc"}
              </Text>

              <View style={styles.pickerInlineWrap}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  textColor="#000000"
                  themeVariant="light"
                  onChange={onPickerChange}
                  locale="vi-VN"
                />
              </View>

              <View style={styles.pickerFooter}>
                <TouchableOpacity
                  onPress={closePickerIOS}
                  activeOpacity={0.85}
                  style={styles.pickerBtn}
                >
                  <Text style={styles.pickerBtnText}>Huỷ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmPickerIOS}
                  activeOpacity={0.85}
                  style={[styles.pickerBtn, styles.pickerBtnPrimary]}
                >
                  <Text
                    style={[styles.pickerBtnText, styles.pickerBtnTextPrimary]}
                  >
                    Chọn
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Gợi ý: App sẽ tự lấy YYYY-MM hoặc YYYY từ ngày bạn chọn.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Pending modal */}
      <PendingOrdersModal
        visible={pendingVisible}
        onClose={() => setPendingVisible(false)}
        orders={pendingOrders}
        onDelete={async (id) => {
          Alert.alert(
            "Xác nhận xoá",
            "Bạn có chắc muốn xóa đơn chưa thanh toán này không? Hành động không thể hoàn tác.",
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Xóa",
                style: "destructive",
                onPress: async () => {
                  try {
                    setLoading(true);
                    await orderApi.deletePendingOrder(id, storeId);
                    // Refresh data
                    setOrders(prev => prev.filter(o => o._id !== id));
                    Alert.alert("Thành công", "Đã xóa đơn hàng.");
                  } catch (e: any) {
                    Alert.alert("Lỗi", e?.message || "Không thể xóa đơn hàng");
                  } finally {
                    setLoading(false);
                  }
                },
              },
            ]
          );
        }}
      />
    </View>
  );
};

export default OrderListScreen;

// ========== Styles ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 5 : 5,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#e6f4ff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  headerSub: {
    marginTop: 2,
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
  },

  filterCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  filterToggle: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterToggleTitle: { fontSize: 15, fontWeight: "900", color: "#1677ff" },
  filterToggleSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  filterBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },

  sectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#374151",
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  pill: {
    flexGrow: 1,
    minWidth: 90,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  pillActive: { backgroundColor: "#e6f4ff", borderColor: "#91caff" },
  pillText: { fontSize: 13, fontWeight: "900", color: "#6b7280" },
  pillTextActive: { color: "#1677ff" },

  fieldBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  fieldLabel: { fontSize: 12, color: "#111827", fontWeight: "800" },
  fieldValue: {
    marginTop: 2,
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },

  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 16,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "900" },

  searchWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
    paddingVertical: Platform.OS === "ios" ? 4 : 0,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1677ff",
    backgroundColor: "#1677ff",
  },
  actionBtnDisabled: { opacity: 0.55 },
  actionBtnText: { fontSize: 13, fontWeight: "900", color: "#111827" },
  actionBtnTextPrimary: { fontSize: 13, fontWeight: "900", color: "#fff" },

  loadingBox: {
    paddingVertical: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "800",
  },

  emptyBox: {
    margin: 16,
    paddingVertical: 34,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "800",
    textAlign: "center",
  },

  listInfo: { fontSize: 12, color: "#6b7280", fontWeight: "800" },

  orderCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderCode: { fontSize: 15, fontWeight: "900", color: "#111827" },
  orderSub: { marginTop: 2, fontSize: 12, color: "#6b7280", fontWeight: "700" },
  orderAmount: { fontSize: 14, fontWeight: "900", color: "#1677ff" },
  orderTime: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },

  orderMidRow: { marginTop: 10, gap: 6 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 12, color: "#374151", fontWeight: "800", flex: 1 },

  orderBottomRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "900" },

  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  loadMoreText: { fontSize: 13, fontWeight: "900", color: "#1677ff" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  centerTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  centerSub: {
    marginTop: 6,
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "700",
    textAlign: "center",
  },

  // Modal (pending)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  modalHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
    lineHeight: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  pendingRow: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    flexDirection: "row",
    gap: 10,
  },
  pendingCode: { fontSize: 14, fontWeight: "900", color: "#111827" },
  pendingSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  pendingAmount: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#1677ff",
  },

  modalCloseBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  modalCloseText: { color: "#fff", fontWeight: "900" },
  // Picker iOS modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827", // chữ đen
    marginBottom: 10,
  },
  pickerInlineWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff", // đổi sang trắng để tránh “dark mode” làm chữ khó nhìn
  },
  pickerFooter: { flexDirection: "row", gap: 12, marginTop: 12 },
  pickerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
  },
  pickerBtnPrimary: { backgroundColor: "#1677ff", borderColor: "#1677ff" },
  pickerBtnText: { fontWeight: "900", color: "#111827" }, // chữ đen
  pickerBtnTextPrimary: { color: "#fff" }, // chữ trắng cho nút primary
});
