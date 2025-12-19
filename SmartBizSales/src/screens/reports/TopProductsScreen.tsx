import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import DateTimePicker from "@react-native-community/datetimepicker";

import apiClient from "../../api/apiClient"; // chỉnh lại path nếu project bạn khác
import { Directory, File, Paths } from "expo-file-system/next";
import { fetch } from "expo/fetch";
import * as Sharing from "expo-sharing";

type PeriodType = "day" | "month" | "quarter" | "year" | "custom";
type DecimalLike = number | { $numberDecimal?: string };

type TopProductRow = {
  productName?: string;
  productSku?: string;
  totalQuantity?: number;
  totalSales?: DecimalLike;
  countOrders?: number;
};

type Store = {
  id?: string;
  _id?: string;
  name?: string;
};

const COLORS = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  text: "#0F172A",
  sub: "#64748B",
  border: "#E6EAF2",
  borderSoft: "#EEF2F7",

  brand: "#0EA5A4",
  primary: "#1D4ED8",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  slate: "#334155",
};

const PERIOD_OPTIONS: Array<{ v: PeriodType; t: string }> = [
  { v: "day", t: "Ngày" },
  { v: "month", t: "Tháng" },
  { v: "quarter", t: "Quý" },
  { v: "year", t: "Năm" },
  { v: "custom", t: "Tùy chỉnh" },
];

const LIMIT_OPTIONS: Array<{ v: "" | "3" | "5" | "20" | "custom"; t: string }> =
  [
    { v: "3", t: "Top 3" },
    { v: "5", t: "Top 5" },
    { v: "", t: "Top 10" },
    { v: "20", t: "Top 20" },
    { v: "custom", t: "Tùy chỉnh" },
  ];

const PAGE_SIZES = [10, 20, 50];

const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (!v || typeof v !== "object") return 0;
  const s = (v.$numberDecimal ?? (v as any).numberDecimal ?? v.toString?.()) as
    | string
    | undefined;
  const n = parseFloat(String(s ?? "0"));
  return Number.isFinite(n) ? n : 0;
};

const formatVND = (value: any) => {
  const n = toNumber(value);
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(Math.round(n));
  } catch {
    return `${Math.round(n)} ₫`;
  }
};

const formatCompact = (n: number) => {
  try {
    return new Intl.NumberFormat("vi-VN", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${Math.round(n)}`;
  }
};

const formatVNDShort = (n: number) => {
  // Hiển thị gọn (vd 1,2 Tr ₫) nhưng vẫn rõ là tiền
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${formatCompact(n)} ₫`;
  return formatVND(n);
};

const parseNumberInput = (s: string): number => {
  const cleaned = (s ?? "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const getStoreId = (store: Store | null): string | null => {
  if (!store) return null;
  return store._id ?? store.id ?? null;
};

const buildPeriodKey = (
  periodType: PeriodType,
  dayKey: string,
  monthKey: string,
  quarterKey: string,
  yearKey: string
) => {
  if (periodType === "day") return dayKey;
  if (periodType === "month") return monthKey;
  if (periodType === "quarter") return quarterKey;
  if (periodType === "year") return yearKey;
  return "";
};

const ensureDir = async () => {
  const dir = new Directory(Paths.cache, "report-exports");
  await dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const joinUrl = (baseURL: string | undefined, path: string) => {
  if (!baseURL) return path;
  return `${baseURL}`.replace(/\/+$/, "") + "/" + `${path}`.replace(/^\/+/, "");
};

const SectionTitle = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <View style={{ gap: 4 }}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
  </View>
);

const Field = React.memo(
  ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType,
  }: {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
    keyboardType?: any;
  }) => (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  )
);

const Chip = ({
  text,
  tone,
}: {
  text: string;
  tone: "blue" | "green" | "amber" | "slate";
}) => {
  const cfg = useMemo(() => {
    if (tone === "blue")
      return {
        c: "#1D4ED8",
        bg: "rgba(29,78,216,0.10)",
        bd: "rgba(29,78,216,0.18)",
      };
    if (tone === "green")
      return {
        c: "#059669",
        bg: "rgba(16,185,129,0.10)",
        bd: "rgba(16,185,129,0.18)",
      };
    if (tone === "amber")
      return {
        c: "#B45309",
        bg: "rgba(245,158,11,0.12)",
        bd: "rgba(245,158,11,0.20)",
      };
    return {
      c: "#334155",
      bg: "rgba(51,65,85,0.08)",
      bd: "rgba(51,65,85,0.14)",
    };
  }, [tone]);

  return (
    <View
      style={[styles.chip, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}
    >
      <Text style={[styles.chipText, { color: cfg.c }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
};

const Stat = ({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "red" | "green" | "blue";
}) => {
  const cfg = useMemo(() => {
    if (tone === "red")
      return {
        c: COLORS.red,
        bg: "rgba(239,68,68,0.08)",
        bd: "rgba(239,68,68,0.18)",
      };
    if (tone === "green")
      return {
        c: COLORS.green,
        bg: "rgba(16,185,129,0.08)",
        bd: "rgba(16,185,129,0.18)",
      };
    if (tone === "blue")
      return {
        c: COLORS.primary,
        bg: "rgba(29,78,216,0.08)",
        bd: "rgba(29,78,216,0.18)",
      };
    return {
      c: COLORS.slate,
      bg: "rgba(51,65,85,0.06)",
      bd: "rgba(51,65,85,0.12)",
    };
  }, [tone]);

  return (
    <View
      style={[styles.stat, { backgroundColor: cfg.bg, borderColor: cfg.bd }]}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: cfg.c }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
};

export default function TopProductsScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [products, setProducts] = useState<TopProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // UI
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [manualRangeVisible, setManualRangeVisible] = useState(false);

  // Period
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [dayKey, setDayKey] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [monthKey, setMonthKey] = useState<string>(dayjs().format("YYYY-MM"));
  const [quarterKey, setQuarterKey] = useState<string>(() => {
    const y = dayjs().year();
    const q = Math.ceil((dayjs().month() + 1) / 3);
    return `${y}-Q${q}`;
  });
  const [yearKey, setYearKey] = useState<string>(dayjs().format("YYYY"));

  // Custom range (tháng)
  const [monthFrom, setMonthFrom] = useState<string>(dayjs().format("YYYY-MM"));
  const [monthTo, setMonthTo] = useState<string>(dayjs().format("YYYY-MM"));

  // Picker flags
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customWhich, setCustomWhich] = useState<"from" | "to" | null>(null);

  // Limit
  const [limitOption, setLimitOption] = useState<
    "" | "3" | "5" | "20" | "custom"
  >("");
  const [customLimitText, setCustomLimitText] = useState<string>("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const periodKey = useMemo(
    () => buildPeriodKey(periodType, dayKey, monthKey, quarterKey, yearKey),
    [periodType, dayKey, monthKey, quarterKey, yearKey]
  );

  const isReadyToLoad = useMemo(() => {
    if (!storeId) return false;
    if (periodType === "custom") return !!monthFrom && !!monthTo;
    return !!periodKey;
  }, [storeId, periodType, periodKey, monthFrom, monthTo]);

  const axiosConfig = useMemo(
    () => ({
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
    }),
    [token]
  );

  useEffect(() => {
    (async () => {
      const t =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("accessToken"));
      setToken(t);

      const storeRaw = await AsyncStorage.getItem("currentStore");
      if (storeRaw) {
        const s = JSON.parse(storeRaw) as Store;
        setCurrentStore(s);
        setStoreId(getStoreId(s));
      }
    })();
  }, []);

  useEffect(() => {
    setProducts([]);
    setPage(1);

    // luôn set mặc định “kỳ hiện tại” để tránh trống -> đỡ lỗi hiển thị
    if (periodType === "day") setDayKey(dayjs().format("YYYY-MM-DD"));
    if (periodType === "month") setMonthKey(dayjs().format("YYYY-MM"));
    if (periodType === "quarter") {
      const y = dayjs().year();
      const q = Math.ceil((dayjs().month() + 1) / 3);
      setQuarterKey(`${y}-Q${q}`);
    }
    if (periodType === "year") setYearKey(dayjs().format("YYYY"));
    if (periodType === "custom") {
      setMonthFrom(dayjs().format("YYYY-MM"));
      setMonthTo(dayjs().format("YYYY-MM"));
    }
  }, [periodType]);

  const getLimit = useCallback(() => {
    let limit = 10;
    if (limitOption === "3") limit = 3;
    else if (limitOption === "5") limit = 5;
    else if (limitOption === "20") limit = 20;
    else if (limitOption === "custom") {
      const n = parseNumberInput(customLimitText);
      if (n > 0) limit = n;
    }
    return limit;
  }, [limitOption, customLimitText]);

  const loadTopProducts = useCallback(async () => {
    if (!isReadyToLoad || !storeId) return;

    setLoading(true);
    try {
      const params: any = {
        storeId,
        periodType,
        limit: getLimit(),
      };

      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      } else {
        params.periodKey = periodKey;
      }

      const res: any = await apiClient.get("/orders/top-products", {
        ...axiosConfig,
        params,
      });

      const rows = res?.data?.data ?? [];
      setProducts(Array.isArray(rows) ? rows : []);
      setPage(1);
    } catch (e: any) {
      console.error(
        "loadTopProducts error:",
        e?.response?.data ?? e?.message ?? e
      );
      setProducts([]);
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message ?? e?.message ?? "Không thể tải top sản phẩm"
      );
    } finally {
      setLoading(false);
    }
  }, [
    axiosConfig,
    isReadyToLoad,
    storeId,
    periodType,
    periodKey,
    monthFrom,
    monthTo,
    getLimit,
  ]);

  useEffect(() => {
    if (!isReadyToLoad) {
      setProducts([]);
      return;
    }
    const t = setTimeout(() => loadTopProducts(), 300);
    return () => clearTimeout(t);
  }, [isReadyToLoad, loadTopProducts]);

  const openPeriodPicker = () => {
    if (periodType === "custom") return;

    if (periodType === "day" && dayKey)
      setTempDate(dayjs(dayKey, "YYYY-MM-DD").toDate());
    else if (periodType === "month" && monthKey)
      setTempDate(dayjs(monthKey, "YYYY-MM").toDate());
    else if (periodType === "year" && yearKey)
      setTempDate(dayjs(yearKey, "YYYY").toDate());
    else if (periodType === "quarter" && quarterKey) {
      const [yStr, qStr] = quarterKey.split("-Q");
      const y = Number(yStr);
      const q = Number(qStr);
      const m = (q - 1) * 3;
      setTempDate(dayjs(`${y}-01-01`).month(m).toDate());
    } else setTempDate(new Date());

    setShowPeriodPicker(true);
  };

  const onChangePeriod = (event: any, date?: Date) => {
    if (event?.type === "dismissed" || !date) {
      setShowPeriodPicker(false);
      return;
    }
    setShowPeriodPicker(false);

    if (periodType === "day") setDayKey(dayjs(date).format("YYYY-MM-DD"));
    if (periodType === "month") setMonthKey(dayjs(date).format("YYYY-MM"));
    if (periodType === "year") setYearKey(dayjs(date).format("YYYY"));
    if (periodType === "quarter") {
      const y = dayjs(date).year();
      const q = Math.ceil((dayjs(date).month() + 1) / 3);
      setQuarterKey(`${y}-Q${q}`);
    }
  };

  const openCustomMonthPicker = (which: "from" | "to") => {
    setCustomWhich(which);
    const current = which === "from" ? monthFrom : monthTo;
    setTempDate(current ? dayjs(current, "YYYY-MM").toDate() : new Date());
    setShowCustomPicker(true);
  };

  const onChangeCustomMonth = (event: any, date?: Date) => {
    if (event?.type === "dismissed" || !date) {
      setShowCustomPicker(false);
      setCustomWhich(null);
      return;
    }

    const picked = dayjs(date).format("YYYY-MM");

    if (customWhich === "from") {
      if (monthTo && dayjs(picked).isAfter(dayjs(monthTo))) {
        setMonthFrom(picked);
        setMonthTo(picked);
      } else setMonthFrom(picked);
    }

    if (customWhich === "to") {
      if (monthFrom && dayjs(picked).isBefore(dayjs(monthFrom))) {
        setMonthFrom(picked);
        setMonthTo(picked);
      } else setMonthTo(picked);
    }

    setShowCustomPicker(false);
    setCustomWhich(null);
  };

  const getPeriodDisplay = () => {
    if (!isReadyToLoad) return "Chưa chọn kỳ";
    if (periodType === "day")
      return `Ngày ${dayjs(periodKey).format("DD/MM/YYYY")}`;
    if (periodType === "month")
      return `Tháng ${dayjs(periodKey).format("MM/YYYY")}`;
    if (periodType === "quarter")
      return quarterKey ? quarterKey.replace("-Q", " Quý ") : "";
    if (periodType === "year") return `Năm ${periodKey}`;
    if (periodType === "custom")
      return `Từ ${dayjs(monthFrom).format("MM/YYYY")} → ${dayjs(monthTo).format("MM/YYYY")}`;
    return "";
  };

  const totals = useMemo(() => {
    const totalQty = products.reduce(
      (sum, r) => sum + (r.totalQuantity ?? 0),
      0
    );
    const totalOrders = products.reduce(
      (sum, r) => sum + (r.countOrders ?? 0),
      0
    );
    const totalSales = products.reduce(
      (sum, r) => sum + toNumber(r.totalSales),
      0
    );
    return { totalQty, totalOrders, totalSales };
  }, [products]);

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return products.slice(start, start + pageSize);
  }, [products, page, pageSize]);

  const totalPages = useMemo(() => {
    if (products.length === 0) return 1;
    return Math.max(1, Math.ceil(products.length / pageSize));
  }, [products.length, pageSize]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const exportDisabled =
    !isReadyToLoad || products.length === 0 || exportLoading || loading;

  const handleExport = async (format: "csv" | "pdf") => {
    if (!isReadyToLoad || !storeId) return;

    try {
      setExportLoading(true);

      const ext = format === "pdf" ? "pdf" : "csv";
      const mime = format === "pdf" ? "application/pdf" : "text/csv";

      const params: any = {
        storeId,
        periodType,
        format,
        limit: getLimit(),
      };

      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      } else {
        params.periodKey = periodKey;
      }

      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && `${v}` !== "")
          query.append(k, `${v}`);
      });

      const baseURL = (apiClient.defaults as any)?.baseURL as
        | string
        | undefined;
      const url = joinUrl(
        baseURL,
        `/orders/top-products/export?${query.toString()}`
      );

      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: mime,
        },
      });

      if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);

      const bytes = await res.bytes();
      const dir = await ensureDir();

      const filenameSafePeriod =
        periodType === "custom" ? `${monthFrom}_den_${monthTo}` : periodKey;
      const outFile = new File(
        dir,
        `top-san-pham-${periodType}-${filenameSafePeriod}-${Date.now()}.${ext}`
      );
      await outFile.write(bytes);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(outFile.uri, { mimeType: mime });
      } else {
        Alert.alert("Thành công", `Đã lưu file tại: ${outFile.uri}`);
      }
    } catch (e: any) {
      console.error("export error:", e?.message ?? e);
      Alert.alert("Lỗi", e?.message ?? "Không thể xuất file");
    } finally {
      setExportLoading(false);
    }
  };

  const askExport = () => {
    if (!isReadyToLoad || products.length === 0) return;
    Alert.alert("Xuất báo cáo", "Chọn định dạng", [
      { text: "Hủy", style: "cancel" },
      { text: "CSV", onPress: () => handleExport("csv") },
      { text: "PDF", onPress: () => handleExport("pdf") },
    ]);
  };

  const quickSetPeriod = (type: PeriodType) => {
    setPeriodType(type);
    if (type === "day") setDayKey(dayjs().format("YYYY-MM-DD"));
    if (type === "month") setMonthKey(dayjs().format("YYYY-MM"));
    if (type === "year") setYearKey(dayjs().format("YYYY"));
    if (type === "quarter") {
      const y = dayjs().year();
      const q = Math.ceil((dayjs().month() + 1) / 3);
      setQuarterKey(`${y}-Q${q}`);
    }
    if (type === "custom") {
      setMonthFrom(dayjs().format("YYYY-MM"));
      setMonthTo(dayjs().format("YYYY-MM"));
    }
  };

  const resetFilters = () => {
    setPeriodType("month");
    setMonthKey(dayjs().format("YYYY-MM"));
    setDayKey(dayjs().format("YYYY-MM-DD"));
    setYearKey(dayjs().format("YYYY"));
    const y = dayjs().year();
    const q = Math.ceil((dayjs().month() + 1) / 3);
    setQuarterKey(`${y}-Q${q}`);
    setMonthFrom(dayjs().format("YYYY-MM"));
    setMonthTo(dayjs().format("YYYY-MM"));

    setLimitOption("");
    setCustomLimitText("");
    setPage(1);
    setPageSize(10);
  };

  const renderTopBar = () => (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>
          {currentStore?.name ?? "Cửa hàng"}
        </Text>
        <Text style={styles.headerSub}>Top sản phẩm bán chạy</Text>
      </View>

      <TouchableOpacity
        onPress={() => loadTopProducts()}
        disabled={!isReadyToLoad || loading}
        style={[
          styles.headerGhostBtn,
          (!isReadyToLoad || loading) && styles.btnDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.headerGhostBtnText}>Tải lại</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={askExport}
        disabled={exportDisabled}
        style={[styles.headerPrimaryBtn, exportDisabled && styles.btnDisabled]}
      >
        {exportLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.headerPrimaryBtnText}>Xuất</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderFiltersCard = () => {
    const periodText =
      periodType === "day"
        ? dayjs(dayKey).format("DD/MM/YYYY")
        : periodType === "month"
          ? dayjs(monthKey).format("MM/YYYY")
          : periodType === "quarter"
            ? quarterKey
            : periodType === "year"
              ? yearKey
              : `${dayjs(monthFrom).format("MM/YYYY")} → ${dayjs(monthTo).format("MM/YYYY")}`;

    return (
      <View style={[styles.card, styles.shadowMd]}>
        <View style={styles.cardHeadRow}>
          <SectionTitle title="Bộ lọc" subtitle={getPeriodDisplay()} />
          <TouchableOpacity
            style={styles.collapseBtn}
            onPress={() => setFiltersCollapsed((v) => !v)}
          >
            <Text style={styles.collapseBtnText}>
              {filtersCollapsed ? "Mở" : "Gọn"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Summary row (luôn hiện) */}
        <View style={[styles.rowWrap, { marginTop: 12 }]}>
          <Chip text={`Kỳ: ${periodText}`} tone="blue" />
          <Chip text={`Top: ${getLimit()}`} tone="amber" />
          <Chip text={`Trang: ${page}/${totalPages}`} tone="slate" />
        </View>

        {/* Quick presets */}
        <View style={[styles.rowWrap, { marginTop: 12 }]}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => quickSetPeriod("day")}
          >
            <Text style={styles.quickBtnText}>Hôm nay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => quickSetPeriod("month")}
          >
            <Text style={styles.quickBtnText}>Tháng này</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => quickSetPeriod("quarter")}
          >
            <Text style={styles.quickBtnText}>Quý này</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => quickSetPeriod("year")}
          >
            <Text style={styles.quickBtnText}>Năm nay</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
            <Text style={styles.resetBtnText}>Đặt lại</Text>
          </TouchableOpacity>
        </View>

        {filtersCollapsed ? null : (
          <>
            <View style={styles.divider} />

            <Text style={styles.label}>Loại kỳ</Text>
            <View style={styles.rowWrap}>
              {PERIOD_OPTIONS.map((it) => {
                const active = periodType === it.v;
                return (
                  <TouchableOpacity
                    key={it.v}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setPeriodType(it.v)}
                  >
                    <Text
                      style={[styles.pillText, active && styles.pillTextActive]}
                    >
                      {it.t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 14 }]}>Kỳ báo cáo</Text>
            {periodType !== "custom" ? (
              <TouchableOpacity
                onPress={openPeriodPicker}
                style={styles.selectorBtn}
              >
                <Text style={styles.selectorBtnText}>
                  {periodType === "day" &&
                    `Ngày: ${dayjs(dayKey).format("DD/MM/YYYY")}`}
                  {periodType === "month" &&
                    `Tháng: ${dayjs(monthKey).format("MM/YYYY")}`}
                  {periodType === "quarter" && `Quý: ${quarterKey}`}
                  {periodType === "year" && `Năm: ${yearKey}`}
                </Text>
                <Text style={styles.selectorBtnHint}>Chọn</Text>
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.row2}>
                  <TouchableOpacity
                    onPress={() => openCustomMonthPicker("from")}
                    style={[styles.selectorBtn, { flex: 1 }]}
                  >
                    <Text style={styles.selectorBtnText}>
                      {monthFrom
                        ? `Từ: ${dayjs(monthFrom).format("MM/YYYY")}`
                        : "Từ tháng"}
                    </Text>
                    <Text style={styles.selectorBtnHint}>Chọn</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openCustomMonthPicker("to")}
                    style={[styles.selectorBtn, { flex: 1 }]}
                  >
                    <Text style={styles.selectorBtnText}>
                      {monthTo
                        ? `Đến: ${dayjs(monthTo).format("MM/YYYY")}`
                        : "Đến tháng"}
                    </Text>
                    <Text style={styles.selectorBtnHint}>Chọn</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.inlineLink}
                  onPress={() => setManualRangeVisible((v) => !v)}
                >
                  <Text style={styles.inlineLinkText}>
                    {manualRangeVisible ? "Ẩn nhập tay" : "Nhập tay (YYYY-MM)"}
                  </Text>
                </TouchableOpacity>

                {manualRangeVisible && (
                  <View style={{ marginTop: 2 }}>
                    <Field
                      label="Từ tháng"
                      value={monthFrom}
                      onChangeText={setMonthFrom}
                      placeholder="VD: 2025-01"
                    />
                    <Field
                      label="Đến tháng"
                      value={monthTo}
                      onChangeText={setMonthTo}
                      placeholder="VD: 2025-12"
                    />
                  </View>
                )}
              </>
            )}

            <View style={styles.divider} />

            <Text style={styles.label}>Giới hạn</Text>
            <View style={styles.rowWrap}>
              {LIMIT_OPTIONS.map((it) => {
                const active = limitOption === it.v;
                return (
                  <TouchableOpacity
                    key={it.v || "10"}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => {
                      setLimitOption(it.v);
                      if (it.v !== "custom") setCustomLimitText("");
                    }}
                  >
                    <Text
                      style={[styles.pillText, active && styles.pillTextActive]}
                    >
                      {it.t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {limitOption === "custom" && (
              <Field
                label="Số lượng top"
                value={customLimitText}
                onChangeText={setCustomLimitText}
                placeholder="VD: 50"
                keyboardType="number-pad"
              />
            )}
          </>
        )}
      </View>
    );
  };

  const renderResultsCard = () => {
    if (!isReadyToLoad) return null;

    return (
      <View style={[styles.card, styles.shadowSm]}>
        <View style={styles.resultsHead}>
          <SectionTitle
            title="Kết quả"
            subtitle={`${products.length} sản phẩm • ${getPeriodDisplay()}`}
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{products.length} SP</Text>
          </View>
        </View>

        <View style={{ marginTop: 12, gap: 10 }}>
          <View style={styles.statsGrid}>
            <Stat
              label="Tổng SL"
              value={formatCompact(totals.totalQty)}
              tone="red"
            />
            <Stat
              label="Tổng đơn"
              value={formatCompact(totals.totalOrders)}
              tone="slate"
            />
          </View>

          <View style={styles.statsGrid}>
            <Stat
              label="Tổng doanh thu"
              value={formatVNDShort(totals.totalSales)}
              tone="green"
            />
            <Stat
              label="DT/đơn (tb)"
              value={formatVNDShort(
                totals.totalOrders > 0
                  ? totals.totalSales / totals.totalOrders
                  : 0
              )}
              tone="blue"
            />
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (!isReadyToLoad) {
      return (
        <View style={[styles.card, styles.shadowSm]}>
          <Text style={styles.helperText}>
            Chọn kỳ báo cáo để xem top sản phẩm.
          </Text>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={[styles.card, styles.shadowSm]}>
          <View style={styles.centerPad}>
            <ActivityIndicator />
            <Text style={[styles.helperText, { marginTop: 10 }]}>
              Đang tải dữ liệu...
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.card, styles.shadowSm]}>
        <Text style={styles.helperText}>Không có dữ liệu trong kỳ này.</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isReadyToLoad || loading || products.length === 0)
      return <View style={{ height: 18 }} />;

    return (
      <View style={[styles.card, styles.shadowSm]}>
        <SectionTitle
          title="Phân trang"
          subtitle={`Trang ${page}/${totalPages}`}
        />

        <View style={[styles.row2, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[styles.footerBtn, !canPrev && styles.btnDisabled]}
            disabled={!canPrev}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Text style={styles.footerBtnText}>Trang trước</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.footerBtn, !canNext && styles.btnDisabled]}
            disabled={!canNext}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <Text style={styles.footerBtnText}>Trang sau</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>Số dòng/trang</Text>
        <View style={styles.rowWrap}>
          {PAGE_SIZES.map((s) => {
            const active = pageSize === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  setPageSize(s);
                  setPage(1);
                }}
              >
                <Text
                  style={[styles.pillText, active && styles.pillTextActive]}
                >
                  {s}/trang
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (!storeId || !token) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Top sản phẩm</Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            Vui lòng đăng nhập và chọn cửa hàng
          </Text>
          <Text style={styles.emptySub}>
            Cần token + currentStore để xem báo cáo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" />
      {renderTopBar()}

      <FlatList
        data={pagedProducts}
        keyExtractor={(item, i) =>
          `${item.productSku ?? item.productName ?? "row"}-${i}`
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View>
            {renderFiltersCard()}
            {isReadyToLoad && (products.length > 0 || loading)
              ? renderResultsCard()
              : null}
          </View>
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        renderItem={({ item, index }) => {
          const stt = (page - 1) * pageSize + index + 1;

          const qty = item.totalQuantity ?? 0;
          const orders = item.countOrders ?? 0;
          const sales = toNumber(item.totalSales);
          const revPerOrder = orders > 0 ? sales / orders : 0;
          const revPerUnit = qty > 0 ? sales / qty : 0;

          const isTop1 = stt === 1;
          const isTop2 = stt === 2;
          const isTop3 = stt === 3;

          const accent = isTop1
            ? "rgba(245,158,11,0.75)"
            : isTop2
              ? "rgba(29,78,216,0.70)"
              : isTop3
                ? "rgba(16,185,129,0.65)"
                : "rgba(148,163,184,0.40)";

          return (
            <View
              style={[
                styles.productCard,
                styles.shadowSm,
                { borderLeftColor: accent },
              ]}
            >
              <View style={styles.productTopRow}>
                <View style={styles.rankPill}>
                  <Text style={styles.rankText}>#{stt}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.productName ?? "-"}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText} numberOfLines={1}>
                      SKU: {item.productSku || "-"}
                    </Text>
                    <View style={styles.dot} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      Đơn: {orders}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={styles.salesText}>{formatVND(sales)}</Text>
                  <Text style={styles.salesSub}>Doanh thu</Text>
                </View>
              </View>

              <View style={styles.productDivider} />

              <View style={styles.statsGrid}>
                <Stat label="Số lượng" value={`${qty}`} tone="red" />
                <Stat
                  label="DT/đơn"
                  value={formatVNDShort(revPerOrder)}
                  tone="blue"
                />
              </View>

              <View style={[styles.statsGrid, { marginTop: 10 }]}>
                <Stat
                  label="DT/SP"
                  value={formatVNDShort(revPerUnit)}
                  tone="slate"
                />
                <Stat
                  label="Tỷ trọng (ước tính)"
                  value={`${products.length ? Math.round((sales / Math.max(1, totals.totalSales)) * 100) : 0}%`}
                  tone="green"
                />
              </View>
            </View>
          );
        }}
      />

      {showPeriodPicker && periodType !== "custom" && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangePeriod}
          locale="vi-VN"
        />
      )}

      {showCustomPicker && periodType === "custom" && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeCustomMonth}
          locale="vi-VN"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    backgroundColor: "#10b981",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  headerSub: {
    color: "rgba(255,255,255,0.88)",
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },

  headerPrimaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  headerPrimaryBtnText: { color: "#fff", fontWeight: "900" },

  headerGhostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  headerGhostBtnText: { color: "#fff", fontWeight: "900" },

  btnDisabled: { opacity: 0.55 },

  listContent: { paddingBottom: 22 },

  // Base card
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Shadow presets (iOS shadow* + Android elevation)
  shadowSm: {
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  shadowMd: {
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },

  sectionTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  sectionSubtitle: { fontSize: 12, color: COLORS.sub, fontWeight: "600" },

  label: { fontSize: 12, fontWeight: "900", color: "#334155", marginBottom: 8 },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  helperText: {
    color: COLORS.sub,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centerPad: { alignItems: "center", paddingVertical: 26 },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  emptySub: {
    marginTop: 6,
    color: COLORS.sub,
    textAlign: "center",
    fontWeight: "600",
  },

  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  row2: { flexDirection: "row", gap: 10 },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderSoft,
    marginTop: 14,
    marginBottom: 14,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipText: { fontSize: 11, fontWeight: "900" },

  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  collapseBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  collapseBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  quickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#EFF6FF",
  },
  quickBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },

  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  resetBtnText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: "#EFF6FF" },
  pillText: { color: "#334155", fontWeight: "900", fontSize: 12 },
  pillTextActive: { color: COLORS.primary },

  selectorBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectorBtnText: { color: COLORS.text, fontWeight: "900" },
  selectorBtnHint: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },

  inlineLink: { alignSelf: "flex-start", paddingVertical: 8 },
  inlineLinkText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },

  // Results
  resultsHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFEFF",
    borderWidth: 1,
    borderColor: "#A5F3FC",
  },
  badgeText: { fontWeight: "900", color: "#0E7490", fontSize: 12 },

  // Stat blocks
  statsGrid: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  statLabel: { fontSize: 11, color: COLORS.sub, fontWeight: "900" },
  statValue: { fontSize: 13, fontWeight: "900" },

  // Product card
  productCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    padding: 14,
  },
  productTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rankPill: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rankText: { fontWeight: "900", color: "#334155", fontSize: 12 },

  productName: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 11, color: COLORS.sub, fontWeight: "800" },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: "#CBD5E1" },

  salesText: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  salesSub: { fontSize: 10, fontWeight: "900", color: COLORS.sub },

  productDivider: {
    height: 1,
    backgroundColor: COLORS.borderSoft,
    marginTop: 12,
    marginBottom: 12,
  },

  // Footer
  footerBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
  },
  footerBtnText: { color: COLORS.text, fontWeight: "900" },
});
