// src/screens/customer/TopCustomersScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import dayjs from "dayjs";
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { File, Directory, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import * as Sharing from "expo-sharing";
import apiClient from "../../api/apiClient";

// 2) utils xử lý số và URL
const sanitizePhone = (p?: string) => (p ? p.replace(/\D/g, "") : "");
const telUrl = (p?: string) => `tel:${sanitizePhone(p)}`;
const smsUrl = (p?: string, body?: string) => {
  const num = sanitizePhone(p);
  if (!body) return `sms:${num}`;
  const divider = Platform.OS === "ios" ? "&" : "?";
  return `sms:${num}${divider}body=${encodeURIComponent(body)}`;
};

// 3) handler
const handleCall = async (phone?: string) => {
  const url = telUrl(phone);
  const ok = await Linking.canOpenURL(url);
  if (!ok) return Alert.alert("Không thể mở trình quay số");
  return Linking.openURL(url);
};

const handleSms = async (phone?: string, body?: string) => {
  const url = smsUrl(phone, body);
  const ok = await Linking.canOpenURL(url);
  if (!ok) return Alert.alert("Không thể mở ứng dụng SMS");
  return Linking.openURL(url);
};
function debounce<F extends (...args: any[]) => void>(func: F, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  const debounced = (...args: Parameters<F>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  // @ts-ignore
  debounced.cancel = () => clearTimeout(timeout);
  return debounced as F & { cancel?: () => void };
}

type PeriodType = "day" | "month" | "quarter" | "year" | "custom";

type TopCustomerItem = {
  customerName: string;
  customerPhone: string;
  address?: string;
  note?: string;
  totalSpent?: any;
  orderCount?: number;
  loyaltyPoints?: number;
  latestOrder?: string;
};

const getNumber = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === "object") {
    const d = (v.$numberDecimal as string) ?? (v as any).numberDecimal;
    if (d) return parseFloat(d);
    if (typeof (v as any).toString === "function")
      return parseFloat((v as any).toString());
  }
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const formatVND = (value: any) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(getNumber(value));

const formatPhone = (num?: string) => {
  if (!num) return "—";
  const cleaned = num.replace(/\D/g, "");
  if (cleaned.length === 10)
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  return num;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function toQueryString(params: Record<string, any>) {
  const parts: string[] = [];
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  });
  return parts.join("&");
}

function normalizeBaseUrl(url: string) {
  if (!url) return "";
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const TopCustomersScreen: React.FC = () => {
  const [store, setStore] = useState<any>(null);
  const [token, setToken] = useState<string>("");

  // Applied filters (đang dùng để fetch)
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [monthFrom, setMonthFrom] = useState<string>("");
  const [monthTo, setMonthTo] = useState<string>("");
  const [limitOption, setLimitOption] = useState<string>(""); // ""=Top10
  const [customLimit, setCustomLimit] = useState<number | null>(null);

  // Draft filters (đổi trong modal, chỉ apply khi bấm "Áp dụng")
  const [filterOpen, setFilterOpen] = useState(false);
  const [dPeriodType, setDPeriodType] = useState<PeriodType>("month");
  const [dPeriodKey, setDPeriodKey] = useState<string>("");
  const [dMonthFrom, setDMonthFrom] = useState<string>("");
  const [dMonthTo, setDMonthTo] = useState<string>("");
  const [dLimitOption, setDLimitOption] = useState<string>("");
  const [dCustomLimit, setDCustomLimit] = useState<number | null>(null);
  const [applyTick, setApplyTick] = useState(0);
  // trợ giúp cho quarter
  const [dQuarterYear, setDQuarterYear] = useState<string>(
    String(dayjs().year())
  );
  const [dQuarter, setDQuarter] = useState<1 | 2 | 3 | 4>(1);

  // DateTimePicker inside modal
  type PickerField =
    | null
    | "day"
    | "month"
    | "year"
    | "customFrom"
    | "customTo"
    | "quarterYear";
  const [pickerField, setPickerField] = useState<PickerField>(null);
  const [tempPickedDate, setTempPickedDate] = useState<Date>(new Date());

  // data
  const [customers, setCustomers] = useState<TopCustomerItem[]>([]);
  const [filtered, setFiltered] = useState<TopCustomerItem[]>([]);
  const [searchText, setSearchText] = useState<string>("");

  // ui
  const [loading, setLoading] = useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Load store/token
  useEffect(() => {
    (async () => {
      const storeStr = await AsyncStorage.getItem("currentStore");
      const t = await AsyncStorage.getItem("token");
      const s = storeStr ? JSON.parse(storeStr) : null;
      setStore(s);
      setToken(t || "");
    })();
  }, []);

  const isReadyToFetch = () => {
    if (!store?._id && !store?.id) return false;
    if (periodType === "custom") return monthFrom !== "" && monthTo !== "";
    return periodKey !== "";
  };

  const buildParams = () => {
    let limit = 10;
    if (["3", "5", "20"].includes(limitOption))
      limit = parseInt(limitOption, 10);
    else if (limitOption === "custom" && customLimit) limit = customLimit;

    const params: Record<string, any> = {
      storeId: store?._id || store?.id,
      periodType,
      limit,
    };

    if (periodType === "custom") {
      params.monthFrom = monthFrom;
      params.monthTo = monthTo;
    } else {
      params.periodKey = periodKey;
    }
    return params;
  };

  const fetchTopCustomers = async () => {
    if (!store?._id && !store?.id) {
      Alert.alert("Lỗi", "Vui lòng chọn cửa hàng");
      return;
    }
    if (!isReadyToFetch()) {
      Alert.alert("Lỗi", "Vui lòng chọn đủ thông tin kỳ báo cáo");
      return;
    }

    setHasFetched(true);
    setLoading(true);
    try {
      const params = buildParams();
      const t = token || (await AsyncStorage.getItem("token")) || "";

      const res = await apiClient.get<{ data: TopCustomerItem[] }>(
        "/orders/top-customers",
        {
          params,
          headers: t ? { Authorization: `Bearer ${t}` } : undefined,
        }
      );

      const data: TopCustomerItem[] = res?.data?.data || [];
      setCustomers(data);
      setFiltered(data);
      setHasFetched(true);
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message || "Lỗi tải top khách hàng"
      );
      setCustomers([]);
      setFiltered([]);
      setHasFetched(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto fetch when applied filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReadyToFetch()) return; // KHÔNG clear data ở đây
      fetchTopCustomers();
    }, 450);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    periodType,
    periodKey,
    monthFrom,
    monthTo,
    limitOption,
    customLimit,
    store?._id,
  ]);

  // client-side search
  useEffect(() => {
    const lower = (searchText || "").toLowerCase();
    const f = customers.filter(
      (c) =>
        (c.customerName || "").toLowerCase().includes(lower) ||
        (c.customerPhone || "").toLowerCase().includes(lower)
    );
    setFiltered(f);
  }, [searchText, customers]);

  const onRefresh = () => {
    if (!isReadyToFetch()) return setRefreshing(false);
    setRefreshing(true);
    fetchTopCustomers();
  };

  const periodLabel = useMemo(() => {
    if (periodType === "custom") {
      if (!monthFrom || !monthTo) return "Chưa chọn kỳ";
      const from = dayjs(monthFrom, "YYYY-MM").format("MM/YYYY");
      const to = dayjs(monthTo, "YYYY-MM").format("MM/YYYY");
      return `Từ ${from} → ${to}`;
    }
    if (!periodKey) return "Chưa chọn kỳ";
    switch (periodType) {
      case "day":
        return dayjs(periodKey, "YYYY-MM-DD").format("DD/MM/YYYY");
      case "month":
        return dayjs(periodKey, "YYYY-MM").format("MM/YYYY");
      case "quarter": {
        const [year, q] = periodKey.split("-Q");
        return `Quý ${q}/${year}`;
      }
      case "year":
        return `Năm ${periodKey}`;
      default:
        return "Kỳ đã chọn";
    }
  }, [periodType, periodKey, monthFrom, monthTo]);

  // ---------- Filter Modal logic ----------
  const openFilter = () => {
    // copy applied -> draft
    setDPeriodType(periodType);
    setDPeriodKey(periodKey);
    setDMonthFrom(monthFrom);
    setDMonthTo(monthTo);
    setDLimitOption(limitOption);
    setDCustomLimit(customLimit);

    // init quarter helpers from current selection if possible
    if (periodType === "quarter" && periodKey.includes("-Q")) {
      const [y, q] = periodKey.split("-Q");
      setDQuarterYear(y || String(dayjs().year()));
      setDQuarter((parseInt(q || "1", 10) as any) || 1);
    } else {
      setDQuarterYear(String(dayjs().year()));
      setDQuarter(1);
    }

    setPickerField(null);
    setFilterOpen(true);
  };

  const closeFilter = () => {
    setPickerField(null);
    setFilterOpen(false);
  };

  const resetDraftTime = (type: PeriodType) => {
    setDPeriodKey("");
    setDMonthFrom("");
    setDMonthTo("");
    if (type === "quarter") {
      setDQuarterYear(String(dayjs().year()));
      setDQuarter(1);
    }
  };

  const validateDraft = (): string | null => {
    if (!store?._id && !store?.id) return "Vui lòng chọn cửa hàng";

    if (dPeriodType === "custom") {
      if (!dMonthFrom || !dMonthTo)
        return "Vui lòng chọn đủ Từ tháng và Đến tháng";
      const from = dayjs(dMonthFrom, "YYYY-MM");
      const to = dayjs(dMonthTo, "YYYY-MM");
      if (from.isAfter(to))
        return "Khoảng tháng không hợp lệ (Từ tháng phải <= Đến tháng)";
      return null;
    }

    if (dPeriodType === "quarter") {
      if (!dQuarterYear) return "Vui lòng chọn năm cho quý";
      const y = String(parseInt(dQuarterYear, 10));
      if (y === "NaN") return "Năm quý không hợp lệ";
      const key = `${y}-Q${dQuarter}`;
      if (!/^(\d{4})-Q([1-4])$/.test(key))
        return "Quý không hợp lệ (VD: 2025-Q1)";
      return null;
    }

    if (!dPeriodKey) return "Vui lòng chọn kỳ báo cáo";
    return null;
  };

  const applyFilter = () => {
    const err = validateDraft();
    if (err) {
      Alert.alert("Thiếu thông tin", err);
      return;
    }

    // Apply limit
    setLimitOption(dLimitOption);
    setCustomLimit(dCustomLimit);

    // Apply period
    setPeriodType(dPeriodType);

    if (dPeriodType === "custom") {
      setMonthFrom(dMonthFrom);
      setMonthTo(dMonthTo);
      setPeriodKey(""); // not used
    } else if (dPeriodType === "quarter") {
      const key = `${String(parseInt(dQuarterYear, 10))}-Q${dQuarter}`;
      setPeriodKey(key);
      setMonthFrom("");
      setMonthTo("");
    } else {
      setPeriodKey(dPeriodKey);
      setMonthFrom("");
      setMonthTo("");
    }

    closeFilter();
    setApplyTick((x) => x + 2); // ép chạy fetch sau khi apply
  };

  useEffect(() => {
    if (isReadyToFetch()) fetchTopCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyTick]);

  // ---------- Date picker (inside modal) ----------
  const getPickerInit = (field: PickerField): Date => {
    const now = new Date();

    switch (field) {
      case "day":
        return dPeriodKey ? dayjs(dPeriodKey, "YYYY-MM-DD").toDate() : now;
      case "month":
        return dPeriodKey ? dayjs(dPeriodKey, "YYYY-MM").toDate() : now;
      case "year":
        return dPeriodKey
          ? dayjs(dPeriodKey, "YYYY").startOf("year").toDate()
          : now;
      case "customFrom":
        return dMonthFrom ? dayjs(dMonthFrom, "YYYY-MM").toDate() : now;
      case "customTo":
        return dMonthTo ? dayjs(dMonthTo, "YYYY-MM").toDate() : now;
      case "quarterYear":
        return dQuarterYear
          ? dayjs(dQuarterYear, "YYYY").startOf("year").toDate()
          : now;
      default:
        return now;
    }
  };

  const applyPickedDate = (field: PickerField, picked: Date) => {
    const d = dayjs(picked);

    if (field === "day") setDPeriodKey(d.format("YYYY-MM-DD"));
    if (field === "month") setDPeriodKey(d.format("YYYY-MM"));
    if (field === "year") setDPeriodKey(d.format("YYYY"));
    if (field === "customFrom") setDMonthFrom(d.format("YYYY-MM"));
    if (field === "customTo") setDMonthTo(d.format("YYYY-MM"));
    if (field === "quarterYear") setDQuarterYear(d.format("YYYY"));
  };

  const openPicker = (field: PickerField) => {
    const init = getPickerInit(field);

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: init,
        mode: "date",
        minimumDate: new Date(2000, 0, 1),
        maximumDate: new Date(2100, 11, 31),
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== "set" || !date) return; // dismiss/cancel
          applyPickedDate(field, date); //  áp dụng ngay trên Android
        },
      });
      return;
    }

    // iOS: giữ UX hiện tại (spinner + nút Áp dụng)
    setPickerField(field);
    setTempPickedDate(init);
  };

  const confirmPicker = () => {
    if (!pickerField) return;
    applyPickedDate(pickerField, tempPickedDate);
    setPickerField(null);
  };

  const cancelPicker = () => setPickerField(null);

  // ---------- Export ----------
  const periodForFile = () => {
    switch (periodType) {
      case "day":
        return dayjs(periodKey, "YYYY-MM-DD").format("DD-MM-YYYY");
      case "month":
        return dayjs(periodKey, "YYYY-MM").format("MM-YYYY");
      case "quarter": {
        const q = periodKey.split("-Q")[1];
        const y = periodKey.split("-Q")[0];
        return `Q${q}-${y}`;
      }
      case "year":
        return periodKey;
      case "custom":
        if (monthFrom && monthTo) {
          const from = dayjs(monthFrom, "YYYY-MM").format("MM-YYYY");
          const to = dayjs(monthTo, "YYYY-MM").format("MM-YYYY");
          return `${from}_den_${to}`;
        }
        return "khoang-tuy-chinh";
      default:
        return "ky-hien-tai";
    }
  };

  const handleExport = async (format: "xlsx" | "csv" | "pdf") => {
    if (filtered.length === 0) {
      Alert.alert("Cảnh báo", "Chưa có dữ liệu để xuất!");
      return;
    }

    try {
      setExporting(true);
      const t = token || (await AsyncStorage.getItem("token")) || "";
      const params = buildParams();
      params.format = format;

      const baseURL = normalizeBaseUrl(
        (apiClient as any)?.defaults?.baseURL || ""
      );
      if (!baseURL) throw new Error("Thiếu baseURL trong apiClient");

      const url = `${baseURL}/orders/top-customers/export?${toQueryString(params)}`;

      const res = await expoFetch(url, {
        headers: t ? { Authorization: `Bearer ${t}` } : undefined,
      });
      if (!res.ok) throw new Error(`Tải file thất bại (${res.status})`);

      const bytes = await res.bytes(); // Uint8Array

      const fileName = `Top_Khach_Hang_${periodForFile()}_${dayjs().format(
        "DD-MM-YYYY"
      )}.${format}`;
      const dir = new Directory(Paths.cache, "exports");
      dir.create({ idempotent: true });

      const out = new File(dir, fileName);
      out.create({ overwrite: true });
      out.write(bytes);

      const mime =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : format === "csv"
            ? "text/csv"
            : "application/pdf";

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(out.uri, {
          mimeType: mime,
          dialogTitle: "Chia sẻ báo cáo",
        });
      } else {
        Alert.alert("Đã lưu file", out.uri);
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Lỗi xuất file");
    } finally {
      setExporting(false);
    }
  };

  // ---------- UI helpers ----------
  const FilterChip = ({
    active,
    label,
    icon,
    onPress,
  }: {
    active?: boolean;
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      {!!icon && (
        <Ionicons name={icon} size={14} color={active ? "#fff" : "#334155"} />
      )}
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextInactive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({
    item,
    index,
  }: {
    item: TopCustomerItem;
    index: number;
  }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Ionicons
                name="person-circle-outline"
                size={18}
                color="#2563eb"
              />
              <Text style={styles.name} numberOfLines={1}>
                {item.customerName || "—"}
              </Text>
            </View>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text style={styles.phoneCode}>
                {formatPhone(item.customerPhone)}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => handleCall(item.customerPhone)}
              >
                <Ionicons name="call" size={14} color="#fff" />
                <Text style={styles.actionText}>Gọi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
                onPress={() =>
                  handleSms(
                    item.customerPhone,
                    `Xin chào ${item.customerName || ""}`
                  )
                }
              >
                <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
                <Text style={styles.actionText}>SMS</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleCall(item.customerPhone)}
              onLongPress={() =>
                Alert.alert("Liên hệ", formatPhone(item.customerPhone), [
                  {
                    text: "Gọi",
                    onPress: () => handleCall(item.customerPhone),
                  },
                  { text: "SMS", onPress: () => handleSms(item.customerPhone) },
                  { text: "Hủy", style: "cancel" },
                ])
              }
            ></TouchableOpacity>
          </View>

          <View style={styles.moneyBox}>
            <Text style={styles.money}>{formatVND(item.totalSpent)}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: "#fff7ed" }]}>
                <Ionicons name="cart-outline" size={12} color="#f97316" />
                <Text style={[styles.badgeText, { color: "#9a3412" }]}>
                  {item.orderCount ?? 0}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: "#ecfdf5" }]}>
                <Ionicons name="trophy-outline" size={12} color="#10b981" />
                <Text style={[styles.badgeText, { color: "#065f46" }]}>
                  {(item.loyaltyPoints ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.address || "—"}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="reader-outline" size={14} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.note || "—"}
            </Text>
          </View>
          <View style={[styles.metaRow, { justifyContent: "flex-end" }]}>
            <Ionicons name="calendar-outline" size={14} color="#7c3aed" />
            <Text style={[styles.metaText, { color: "#0f172a" }]}>
              {item.latestOrder
                ? dayjs(item.latestOrder).format("DD/MM/YYYY HH:mm")
                : "—"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ---------- Modal view state text ----------
  const draftPeriodLabel = useMemo(() => {
    if (dPeriodType === "custom") {
      const from = dMonthFrom
        ? dayjs(dMonthFrom, "YYYY-MM").format("MM/YYYY")
        : "—";
      const to = dMonthTo ? dayjs(dMonthTo, "YYYY-MM").format("MM/YYYY") : "—";
      return `Từ ${from} → ${to}`;
    }
    if (dPeriodType === "quarter") {
      return `Q${dQuarter}/${dQuarterYear || "—"}`;
    }
    if (!dPeriodKey) return "Chưa chọn";
    if (dPeriodType === "day")
      return dayjs(dPeriodKey, "YYYY-MM-DD").format("DD/MM/YYYY");
    if (dPeriodType === "month")
      return dayjs(dPeriodKey, "YYYY-MM").format("MM/YYYY");
    if (dPeriodType === "year") return `Năm ${dPeriodKey}`;
    return "Chưa chọn";
  }, [dPeriodType, dPeriodKey, dMonthFrom, dMonthTo, dQuarter, dQuarterYear]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={["#10b981", "#6366f1"]} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store?.name || "Top Khách Hàng"}
              </Text>
              <View style={styles.subRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color="rgba(255,255,255,0.92)"
                />
                <Text style={styles.subTitle}>Top khách hàng thân thiết</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.iconBtn} onPress={openFilter}>
              <Ionicons name="options-outline" size={20} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => isReadyToFetch() && fetchTopCustomers()}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.headerInfoRow}>
            <View style={styles.pillInfo}>
              <Ionicons name="calendar-clear-outline" size={14} color="#fff" />
              <Text style={styles.pillInfoText}>{periodLabel}</Text>
            </View>

            <View style={styles.pillInfo}>
              <Ionicons name="people-outline" size={14} color="#fff" />
              <Text style={styles.pillInfoText}>Top {filtered.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search + Export */}
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên hoặc số điện thoại..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.exportBtn,
              (filtered.length === 0 || exporting) && { opacity: 0.55 },
            ]}
            disabled={filtered.length === 0 || exporting}
            onPress={() => handleExport("xlsx")}
            onLongPress={() => {
              if (filtered.length === 0 || exporting) return;
              Alert.alert("Xuất báo cáo", "Chọn định dạng", [
                { text: "Hủy", style: "cancel" },
                { text: "Excel (.xlsx)", onPress: () => handleExport("xlsx") },
                { text: "CSV (.csv)", onPress: () => handleExport("csv") },
                { text: "PDF (.pdf)", onPress: () => handleExport("pdf") },
              ]);
            }}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.exportBtnText}>Xuất</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) =>
              item.customerPhone || `${item.customerName}-${Math.random()}`
            }
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 22 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#6366f1"]}
                tintColor="#6366f1"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color="#f97316"
                />
                <Text style={styles.emptyText}>
                  {hasFetched
                    ? `Không có dữ liệu trong kỳ: ${periodLabel}`
                    : "Chưa có dữ liệu. Mở bộ lọc để chọn kỳ thống kê."}
                </Text>
              </View>
            }
          />
        )}

        {/* Filter Modal */}
        <Modal
          visible={filterOpen}
          transparent
          animationType="fade"
          onRequestClose={closeFilter}
        >
          <Pressable style={styles.modalOverlay} onPress={closeFilter} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc</Text>
              <TouchableOpacity onPress={closeFilter} style={styles.modalClose}>
                <Ionicons name="close" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 18 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Period type */}
              <Text style={styles.sectionTitle}>Kỳ báo cáo</Text>
              <View style={styles.chipRow}>
                <FilterChip
                  label="Ngày"
                  icon="today-outline"
                  active={dPeriodType === "day"}
                  onPress={() => {
                    setDPeriodType("day");
                    resetDraftTime("day");
                  }}
                />
                <FilterChip
                  label="Tháng"
                  icon="calendar-outline"
                  active={dPeriodType === "month"}
                  onPress={() => {
                    setDPeriodType("month");
                    resetDraftTime("month");
                  }}
                />
                <FilterChip
                  label="Quý"
                  icon="grid-outline"
                  active={dPeriodType === "quarter"}
                  onPress={() => {
                    setDPeriodType("quarter");
                    resetDraftTime("quarter");
                  }}
                />
                <FilterChip
                  label="Năm"
                  icon="time-outline"
                  active={dPeriodType === "year"}
                  onPress={() => {
                    setDPeriodType("year");
                    resetDraftTime("year");
                  }}
                />
                <FilterChip
                  label="Tùy chỉnh"
                  icon="swap-vertical-outline"
                  active={dPeriodType === "custom"}
                  onPress={() => {
                    setDPeriodType("custom");
                    resetDraftTime("custom");
                  }}
                />
              </View>

              {/* Period picker */}
              <View style={styles.fieldCard}>
                <View style={styles.fieldHeader}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={16}
                    color="#334155"
                  />
                  <Text style={styles.fieldLabel}>Đang chọn</Text>
                </View>
                <Text style={styles.fieldValue}>{draftPeriodLabel}</Text>

                {dPeriodType === "day" && (
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => openPicker("day")}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#fff" />
                    <Text style={styles.pickBtnText}>Chọn ngày</Text>
                  </TouchableOpacity>
                )}

                {dPeriodType === "month" && (
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => openPicker("month")}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#fff" />
                    <Text style={styles.pickBtnText}>Chọn tháng</Text>
                  </TouchableOpacity>
                )}

                {dPeriodType === "year" && (
                  <TouchableOpacity
                    style={styles.pickBtn}
                    onPress={() => openPicker("year")}
                  >
                    <Ionicons name="time-outline" size={16} color="#fff" />
                    <Text style={styles.pickBtnText}>Chọn năm</Text>
                  </TouchableOpacity>
                )}

                {dPeriodType === "quarter" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <TouchableOpacity
                      style={[styles.pickBtn, { backgroundColor: "#0ea5e9" }]}
                      onPress={() => openPicker("quarterYear")}
                    >
                      <Ionicons name="time-outline" size={16} color="#fff" />
                      <Text style={styles.pickBtnText}>Chọn năm</Text>
                    </TouchableOpacity>

                    <View style={styles.chipRow}>
                      {[1, 2, 3, 4].map((q) => (
                        <FilterChip
                          key={q}
                          label={`Q${q}`}
                          icon="pie-chart-outline"
                          active={dQuarter === q}
                          onPress={() => setDQuarter(q as 1 | 2 | 3 | 4)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {dPeriodType === "custom" && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.pickBtn, { flex: 1 }]}
                        onPress={() => openPicker("customFrom")}
                      >
                        <Ionicons
                          name="arrow-forward-outline"
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.pickBtnText}>Từ tháng</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.pickBtn,
                          { flex: 1, backgroundColor: "#0ea5e9" },
                        ]}
                        onPress={() => openPicker("customTo")}
                      >
                        <Ionicons
                          name="arrow-back-outline"
                          size={16}
                          color="#fff"
                        />
                        <Text style={styles.pickBtnText}>Đến tháng</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.hintText}>
                      Gợi ý: chọn bất kỳ ngày trong tháng, hệ thống sẽ lấy theo
                      tháng/năm.
                    </Text>
                  </View>
                )}
              </View>

              {/* Limit */}
              <Text style={styles.sectionTitle}>Số lượng</Text>
              <View style={styles.chipRow}>
                {[
                  { label: "Top 3", value: "3" },
                  { label: "Top 5", value: "5" },
                  { label: "Top 10", value: "" },
                  { label: "Top 20", value: "20" },
                  { label: "Tùy chỉnh", value: "custom" },
                ].map((x) => (
                  <FilterChip
                    key={x.label}
                    label={x.label}
                    icon="list-outline"
                    active={dLimitOption === x.value}
                    onPress={() => {
                      setDLimitOption(x.value);
                      if (x.value !== "custom") setDCustomLimit(null);
                    }}
                  />
                ))}
              </View>

              {dLimitOption === "custom" && (
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>Nhập số (1–200)</Text>
                  <View style={styles.inlineInputRow}>
                    <Ionicons
                      name="options-outline"
                      size={16}
                      color="#334155"
                    />
                    <TextInput
                      style={styles.inlineInput}
                      keyboardType="number-pad"
                      placeholder="VD: 30"
                      placeholderTextColor="#94a3b8"
                      value={dCustomLimit == null ? "" : String(dCustomLimit)}
                      onChangeText={(t) => {
                        const n = parseInt(t || "0", 10);
                        if (!t) return setDCustomLimit(null);
                        setDCustomLimit(clampNumber(isNaN(n) ? 1 : n, 1, 200));
                      }}
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.footerBtnGhost}
                onPress={closeFilter}
              >
                <Text style={styles.footerBtnGhostText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerBtnPrimary}
                onPress={applyFilter}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.footerBtnPrimaryText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date picker modal (confirm/cancel) - iOS only */}
          <Modal
            visible={Platform.OS === "ios" && !!pickerField}
            transparent
            animationType="fade"
            onRequestClose={cancelPicker}
          >
            <Pressable style={styles.pickerOverlay} onPress={cancelPicker} />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Chọn thời gian</Text>
                <TouchableOpacity
                  onPress={cancelPicker}
                  style={styles.pickerClose}
                >
                  <Ionicons name="close" size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerBody}>
                <DateTimePicker
                  value={tempPickedDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, date) => {
                    if (!date) return;
                    setTempPickedDate(date);
                  }}
                  minimumDate={new Date(2000, 0, 1)}
                  maximumDate={new Date(2100, 11, 31)}
                  locale="vi-VN"
                  style={{ backgroundColor: "#fff" }}
                  textColor="#000000"
                  themeVariant="light"
                />
              </View>

              <View style={styles.pickerFooter}>
                <TouchableOpacity
                  style={styles.footerBtnGhost}
                  onPress={cancelPicker}
                >
                  <Text style={styles.footerBtnGhostText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerBtnPrimary}
                  onPress={confirmPicker}
                >
                  <Text style={styles.footerBtnPrimaryText}>Áp dụng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default TopCustomersScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
    backgroundColor: "#10b981",
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  storeName: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  subTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "600",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerInfoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  pillInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  pillInfoText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  toolbar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  searchBox: {
    flex: 1,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, color: "#0f172a", fontWeight: "600" },

  exportBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#1d4ed8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  exportBtnText: { color: "#fff", fontWeight: "800" },

  loadingWrap: {
    paddingTop: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 10, color: "#64748b", fontWeight: "600" },

  emptyBox: {
    marginTop: 30,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  emptyText: { flex: 1, color: "#9a3412", fontWeight: "700", lineHeight: 18 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  rankText: { color: "#4338ca", fontWeight: "900" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: "#0f172a", fontWeight: "800", fontSize: 15, flex: 1 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  phoneCode: { color: "#334155", fontWeight: "700" },

  moneyBox: { alignItems: "flex-end", gap: 8 },
  money: { color: "#b91c1c", fontWeight: "900", fontSize: 15 },
  badgeRow: { flexDirection: "row", gap: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { fontWeight: "900" },

  cardBottom: { marginTop: 10, gap: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { flex: 1, color: "#64748b", fontWeight: "600" },

  // Modal sheet
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.45)" },
  modalSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: "86%",
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 16,
    color: "#0f172a",
    fontWeight: "900",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipInactive: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" },
  chipText: { fontSize: 12, fontWeight: "900" },
  chipTextActive: { color: "#fff" },
  chipTextInactive: { color: "#334155" },

  fieldCard: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  fieldHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldLabel: { color: "#334155", fontWeight: "900" },
  fieldValue: {
    marginTop: 8,
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 14,
  },

  pickBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  pickBtnText: { color: "#fff", fontWeight: "900" },
  hintText: {
    marginTop: 8,
    color: "#64748b",
    fontWeight: "600",
    lineHeight: 16,
  },

  inlineInputRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  inlineInput: { flex: 1, color: "#0f172a", fontWeight: "800" },

  modalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
    backgroundColor: "#fff",
  },
  footerBtnGhost: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnGhostText: { color: "#0f172a", fontWeight: "900" },
  footerBtnPrimary: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  footerBtnPrimaryText: { color: "#fff", fontWeight: "900" },

  // Picker modal
  pickerOverlay: { flex: 1, backgroundColor: "rgba(2,6,23,0.45)" },
  pickerSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pickerHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: { color: "#0f172a", fontWeight: "900", fontSize: 15 },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerBody: {
    backgroundColor: "#fff",
    paddingBottom: Platform.OS === "ios" ? 0 : 8,
  },
  pickerFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
  },

  // style gợi ý
  actionRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
