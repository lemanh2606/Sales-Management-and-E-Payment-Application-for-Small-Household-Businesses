import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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

const Chip = ({ text, color }: { text: string; color: string }) => (
  <View
    style={[styles.chip, { borderColor: color, backgroundColor: `${color}18` }]}
  >
    <Text style={[styles.chipText, { color }]}>{text}</Text>
  </View>
);

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
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
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  )
);

const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (!v || typeof v !== "object") return 0;
  const s = (v.$numberDecimal ?? v.numberDecimal ?? v.toString?.()) as
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

export default function TopProductsScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [products, setProducts] = useState<TopProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

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

  // Picker flags (tách riêng để không xung đột)
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customWhich, setCustomWhich] = useState<"from" | "to" | null>(null);

  // Limit
  const [limitOption, setLimitOption] = useState<
    "" | "3" | "5" | "20" | "custom"
  >("");
  const [customLimitText, setCustomLimitText] = useState<string>("");

  // Pagination (client-side)
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

  // init token + store (giống TaxDeclarationScreen)
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

  // reset khi đổi loại kỳ (giống web)
  useEffect(() => {
    setProducts([]);
    setPage(1);

    if (periodType === "day") setDayKey("");
    if (periodType === "month") setMonthKey("");
    if (periodType === "quarter") setQuarterKey("");
    if (periodType === "year") setYearKey("");
    if (periodType === "custom") {
      setMonthFrom("");
      setMonthTo("");
    }
  }, [periodType]);

  const getLimit = () => {
    let limit = 10;
    if (limitOption === "3") limit = 3;
    else if (limitOption === "5") limit = 5;
    else if (limitOption === "20") limit = 20;
    else if (limitOption === "custom") {
      const n = parseNumberInput(customLimitText);
      if (n > 0) limit = n;
    }
    return limit;
  };

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
    limitOption,
    customLimitText,
    pageSize,
  ]);

  // debounce 300ms
  useEffect(() => {
    if (!isReadyToLoad) {
      setProducts([]);
      return;
    }

    const t = setTimeout(() => {
      loadTopProducts();
    }, 300);

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
      const m = (q - 1) * 3; // month index
      setTempDate(dayjs(`${y}-01-01`).month(m).toDate());
    } else {
      setTempDate(new Date());
    }

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
      // đảm bảo from <= to
      if (monthTo && dayjs(picked).isAfter(dayjs(monthTo))) {
        setMonthFrom(picked);
        setMonthTo(picked);
      } else {
        setMonthFrom(picked);
      }
    }

    if (customWhich === "to") {
      if (monthFrom && dayjs(picked).isBefore(dayjs(monthFrom))) {
        setMonthFrom(picked);
        setMonthTo(picked);
      } else {
        setMonthTo(picked);
      }
    }

    setShowCustomPicker(false);
    setCustomWhich(null);
  };

  const getPeriodDisplay = () => {
    if (!isReadyToLoad) return "Chọn kỳ báo cáo";
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

      // build query
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

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return products.slice(start, start + pageSize);
  }, [products, page, pageSize]);

  if (!storeId || !token) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          Vui lòng đăng nhập và chọn cửa hàng
        </Text>
        <Text style={styles.emptySub}>
          Cần token + currentStore để xem báo cáo.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {currentStore?.name ?? "Cửa hàng"}
          </Text>
          <Text style={styles.headerSub}>Top sản phẩm bán chạy</Text>
        </View>

        <TouchableOpacity
          onPress={askExport}
          disabled={
            !isReadyToLoad || products.length === 0 || exportLoading || loading
          }
          style={[
            styles.headerBtn,
            (!isReadyToLoad ||
              products.length === 0 ||
              exportLoading ||
              loading) &&
              styles.btnDisabled,
          ]}
        >
          {exportLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.headerBtnText}>Xuất</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters */}
        <View style={styles.card}>
          <SectionTitle title="Chọn kỳ báo cáo" />

          {/* Period type pills */}
          <View style={styles.row}>
            {[
              { v: "day", t: "Ngày" },
              { v: "month", t: "Tháng" },
              { v: "quarter", t: "Quý" },
              { v: "year", t: "Năm" },
              { v: "custom", t: "Tùy chỉnh" },
            ].map((it) => {
              const active = periodType === (it.v as PeriodType);
              return (
                <TouchableOpacity
                  key={it.v}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setPeriodType(it.v as PeriodType)}
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

          {/* period selector */}
          {periodType !== "custom" ? (
            <TouchableOpacity
              onPress={openPeriodPicker}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>
                {periodType === "day" &&
                  (dayKey
                    ? `Ngày: ${dayjs(dayKey).format("DD/MM/YYYY")}`
                    : "Chọn ngày")}
                {periodType === "month" &&
                  (monthKey
                    ? `Tháng: ${dayjs(monthKey).format("MM/YYYY")}`
                    : "Chọn tháng")}
                {periodType === "quarter" &&
                  (quarterKey ? `Quý: ${quarterKey}` : "Chọn quý")}
                {periodType === "year" &&
                  (yearKey ? `Năm: ${yearKey}` : "Chọn năm")}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => openCustomMonthPicker("from")}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {monthFrom
                        ? `Từ tháng: ${dayjs(monthFrom).format("MM/YYYY")}`
                        : "Từ tháng"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => openCustomMonthPicker("to")}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {monthTo
                        ? `Đến tháng: ${dayjs(monthTo).format("MM/YYYY")}`
                        : "Đến tháng"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nếu bạn muốn cho phép nhập tay fallback */}
              <View style={{ marginTop: 10 }}>
                <Field
                  label="Từ tháng (YYYY-MM)"
                  value={monthFrom}
                  onChangeText={setMonthFrom}
                  placeholder="VD: 2025-01"
                />
                <Field
                  label="Đến tháng (YYYY-MM)"
                  value={monthTo}
                  onChangeText={setMonthTo}
                  placeholder="VD: 2025-12"
                />
              </View>
            </>
          )}

          {/* DateTimePicker (non-custom) */}
          {showPeriodPicker && periodType !== "custom" && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChangePeriod}
              locale="vi-VN"
            />
          )}

          {/* DateTimePicker (custom from/to) */}
          {showCustomPicker && periodType === "custom" && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChangeCustomMonth}
              locale="vi-VN"
            />
          )}

          {/* Limit */}
          <Text style={[styles.label, { marginTop: 12 }]}>Top</Text>
          <View style={styles.row}>
            {[
              { v: "3", t: "Top 3" },
              { v: "5", t: "Top 5" },
              { v: "", t: "Top 10" },
              { v: "20", t: "Top 20" },
              { v: "custom", t: "Tùy chỉnh" },
            ].map((it) => {
              const active = limitOption === (it.v as any);
              return (
                <TouchableOpacity
                  key={it.v || "10"}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    setLimitOption(it.v as any);
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

          {/* Chips */}
          <View style={[styles.row, { marginTop: 8 }]}>
            {isReadyToLoad && (
              <Chip text={`Kỳ: ${getPeriodDisplay()}`} color="#2563eb" />
            )}
            {isReadyToLoad && (
              <Chip text={`Limit: ${getLimit()}`} color="#f59e0b" />
            )}
            {products.length > 0 && (
              <Chip text={`Sản phẩm: ${products.length}`} color="#10b981" />
            )}
          </View>
        </View>

        {/* Content */}
        {!isReadyToLoad ? (
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Vui lòng chọn kỳ báo cáo để xem top sản phẩm.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.card}>
            <View style={styles.centerPad}>
              <ActivityIndicator />
              <Text style={[styles.helperText, { marginTop: 8 }]}>
                Đang tải top sản phẩm...
              </Text>
            </View>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Không có dữ liệu trong kỳ này.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <SectionTitle title={`Top sản phẩm – ${getPeriodDisplay()}`} />

            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: 40 }]}>#</Text>
              <Text style={[styles.th, { flex: 1 }]}>Sản phẩm</Text>
              <Text style={[styles.th, { width: 80 }]}>SL</Text>
              <Text style={[styles.th, { width: 110, textAlign: "right" }]}>
                Doanh thu
              </Text>
            </View>

            <FlatList
              data={pagedProducts}
              keyExtractor={(_, i) => `${i}`}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item, index }) => {
                const stt = (page - 1) * pageSize + index + 1;
                return (
                  <View style={styles.tableRow}>
                    <Text style={[styles.td, { width: 40 }]}>{stt}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.productName ?? "-"}
                      </Text>
                      <Text style={styles.skuText}>
                        SKU: {item.productSku || "-"}
                      </Text>
                      <Text style={styles.metaText}>
                        Số đơn: {item.countOrders ?? 0}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.qtyText,
                        { width: 80, textAlign: "center" },
                      ]}
                    >
                      {item.totalQuantity ?? 0}
                    </Text>
                    <Text
                      style={[styles.td, { width: 110, textAlign: "right" }]}
                    >
                      {formatVND(item.totalSales)}
                    </Text>
                  </View>
                );
              }}
            />

            {/* Pagination controls */}
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.secondaryBtn, page <= 1 && styles.btnDisabled]}
                disabled={page <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Text style={styles.secondaryBtnText}>Trang trước</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  page * pageSize >= products.length && styles.btnDisabled,
                ]}
                disabled={page * pageSize >= products.length}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.secondaryBtnText}>Trang sau</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              {[10, 20, 50].map((s) => {
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
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },

  header: {
    backgroundColor: "#10b981",
    paddingTop: Platform.OS === "ios" ? 1 : 5,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  headerBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  headerBtnText: { color: "#fff", fontWeight: "800" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },

  label: { fontSize: 12, fontWeight: "800", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#111827",
    fontSize: 14,
  },

  helperText: { marginTop: 6, color: "#6b7280", fontSize: 12, lineHeight: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  centerPad: { alignItems: "center", paddingVertical: 30 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  emptySub: { marginTop: 6, color: "#6b7280", textAlign: "center" },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row2: { flexDirection: "row", gap: 10 },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  pillActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  pillText: { color: "#374151", fontWeight: "800", fontSize: 12 },
  pillTextActive: { color: "#2563eb" },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "800" },

  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#111827", fontWeight: "900" },
  btnDisabled: { opacity: 0.6 },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
  tableRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  th: { fontSize: 12, fontWeight: "900", color: "#374151" },
  td: { fontSize: 12, fontWeight: "800", color: "#111827" },
  productName: { fontSize: 13, fontWeight: "900", color: "#111827" },
  skuText: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  metaText: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  qtyText: { fontSize: 13, fontWeight: "900", color: "#ef4444" },

  paginationRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    justifyContent: "center",
  },
});
