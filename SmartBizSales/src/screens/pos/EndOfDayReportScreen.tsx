// src/screens/pos/EndOfDayReportScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import apiClient from "../../api/apiClient";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import Svg, { G, Path, Circle } from "react-native-svg";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

/** =========================
 * Types
 * ========================= */
type MongoDecimal = { $numberDecimal: string };

type ReportSummary = {
  // Doanh thu
  grossRevenue: number; // Doanh thu gộp (trước hoàn)
  totalRefundAmount: number; // Tiền hoàn
  totalRevenue: number; // Doanh thu thực (đã trừ hoàn)

  // Tiền mặt
  grossCashInDrawer: number; // Tiền mặt trước hoàn
  cashRefundAmount: number; // Tiền mặt hoàn
  cashInDrawer: number; // Tiền mặt thực

  // Thống kê khác
  totalOrders: number;
  vatTotal: number;
  totalRefunds: number; // Số lần hoàn
  totalDiscount: number;
  totalLoyaltyUsed: number;
  totalLoyaltyEarned: number;
};

type PaymentMethodData = {
  _id: string;
  revenue: number;
  count: number;
};

type EmployeeData = {
  _id: string;
  name: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
};

type ProductData = {
  _id: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
  refundQuantity: number;
  netSold: number;
};

type StockData = {
  productId: string;
  name: string;
  sku: string;
  stock: number;
};

type RefundByEmployee = {
  refundedBy: string;
  name: string;
  refundAmount: any;
  refundedAt: string;
};

type ReportData = {
  date: string;
  store: { _id: string; name: string };
  summary: ReportSummary;
  byPayment: PaymentMethodData[];
  byEmployee: EmployeeData[];
  byProduct: ProductData[];
  stockSnapshot: StockData[];
  refundsByEmployee: RefundByEmployee[];
};

type PeriodType = "day" | "month" | "quarter" | "year";

/** =========================
 * Const
 * ========================= */
const COLORS = {
  primary: "#10b981",
  primaryDark: "#0f766e",
  bg: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  sub: "#64748b",
  border: "#e2e8f0",
  danger: "#ef4444",
  blue: "#2563eb",
  amber: "#f59e0b",
  green: "#16a34a",
};

const PAYMENT_METHOD_NAMES: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR Code",
};

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: "hôm nay",
  month: "tháng này",
  quarter: "quý này",
  year: "năm nay",
};

const PIE_COLORS = [
  "#10b981",
  "#2563eb",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#06b6d4",
];

/** =========================
 * Helpers
 * ========================= */
const safeParse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number => {
  if (!value) return 0;
  if (typeof value === "object" && (value as any)?.$numberDecimal)
    return parseFloat((value as any).$numberDecimal) || 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (value: number | any): string => {
  const n = toNumber(value);
  return `${Math.max(0, Math.round(n)).toLocaleString("vi-VN")}₫`;
};

const periodKeyFromDate = (date: dayjs.Dayjs, period: PeriodType): string => {
  switch (period) {
    case "day":
      return date.format("YYYY-MM-DD");
    case "month":
      return date.format("YYYY-MM");
    case "quarter":
      return `${date.year()}-Q${Math.floor(date.month() / 3 + 1)}`;
    case "year":
      return date.format("YYYY");
    default:
      return date.format("YYYY-MM-DD");
  }
};

const periodTitle = (date: dayjs.Dayjs, period: PeriodType) => {
  if (period === "day") return `Ngày báo cáo: ${date.format("DD/MM/YYYY")}`;
  if (period === "month") return `Tháng báo cáo: ${date.format("MM/YYYY")}`;
  if (period === "quarter")
    return `Báo cáo quý ${Math.floor(date.month() / 3 + 1)} - ${date.year()}`;
  return `Báo cáo năm ${date.year()}`;
};

const stockStatus = (stock: number) => {
  if (stock < 10) return { bg: "#fee2e2", text: "#b91c1c", label: "Thấp" };
  if (stock < 50) return { bg: "#ffedd5", text: "#9a3412", label: "Cần nhập" };
  return { bg: "#dcfce7", text: "#166534", label: "Đủ" };
};

const keyOf = (prefix: string, idLike: any, index: number) =>
  `${prefix}:${String(idLike ?? "na")}:${index}`;

/** =========================
 * SVG Donut helpers
 * ========================= */
const degToRad = (deg: number) => (deg * Math.PI) / 180;

const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) => {
  const a = degToRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

const donutSlicePath = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) => {
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const sweepOuter = 1;
  const sweepInner = 0;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} ${sweepOuter} ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} ${sweepInner} ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
};

type PieRow = { name: string; value: number; count: number };

/** =========================
 * UI Components
 * ========================= */
const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

const Pill: React.FC<{
  text: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}> = ({ text, active, onPress, icon }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.pill,
      active ? styles.pillOn : styles.pillOff,
      pressed && { opacity: 0.92 },
    ]}
  >
    {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
    <Text style={active ? styles.pillTextOn : styles.pillTextOff}>{text}</Text>
  </Pressable>
);

const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}> = ({ title, subtitle, right }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

const StatTile: React.FC<{
  title: string;
  value: string;
  tone?: "primary" | "dark" | "danger";
  icon: React.ReactNode;
}> = ({ title, value, tone = "primary", icon }) => {
  const toneStyle =
    tone === "danger"
      ? styles.statDanger
      : tone === "dark"
        ? styles.statDark
        : styles.statPrimary;

  return (
    <View style={[styles.statTile, toneStyle]}>
      <View style={styles.statIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
};

const DonutChart: React.FC<{
  data: PieRow[];
  total: number;
  size?: number;
  thickness?: number;
}> = ({ data, total, size = 220, thickness = 26 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = Math.max(outerR - thickness, 1);
  const startOffset = -90;

  const slices = useMemo(() => {
    const clean = data.filter((d) => d.value > 0);
    if (clean.length === 0 || total <= 0) return [];

    const angles = clean.map((d) => (d.value / total) * 360);
    if (angles.length === 1 && angles[0] > 359.9) {
      const half = clean[0].value / 2;
      return [
        { ...clean[0], value: half, _splitKey: "a" },
        { ...clean[0], value: half, _splitKey: "b" },
      ] as any[];
    }
    return clean as any[];
  }, [data, total]);

  let accAngle = startOffset;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G>
            <Circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" />
            <Circle cx={cx} cy={cy} r={innerR} fill="#ffffff" />

            {(() => {
              const items: React.ReactNode[] = [];
              const sum = slices.reduce(
                (s: number, d: any) => s + Number(d.value || 0),
                0
              );
              if (sum <= 0) return items;

              slices.forEach((d: any, idx: number) => {
                const angle = (Number(d.value || 0) / sum) * 360;
                const start = accAngle;
                const end = accAngle + angle;
                accAngle = end;

                const path = donutSlicePath(cx, cy, outerR, innerR, start, end);
                const fill = PIE_COLORS[idx % PIE_COLORS.length];

                items.push(
                  <Path
                    key={keyOf("slice", d.name + (d._splitKey ?? ""), idx)}
                    d={path}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              });

              return items;
            })()}
          </G>
        </Svg>

        <View
          pointerEvents="none"
          style={[styles.donutCenter, { width: size, height: size }]}
        >
          <Text style={styles.donutCenterTitle}>Tổng</Text>
          <Text style={styles.donutCenterValue}>{formatCurrency(total)}</Text>
        </View>
      </View>
    </View>
  );
};

/** =========================
 * Screen
 * ========================= */
const EndOfDayReportScreen: React.FC = () => {
  const [loadingInit, setLoadingInit] = useState(true);

  const [storeId, setStoreId] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("POS");
  const [token, setToken] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const [periodType, setPeriodType] = useState<PeriodType>("day");
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  // paging ("xem thêm")
  const [empLimit, setEmpLimit] = useState(8);
  const [productLimit, setProductLimit] = useState(8);
  const [refundLimit, setRefundLimit] = useState(8);
  const [stockLimit, setStockLimit] = useState(8);

  // DateTimePicker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

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

  const loadReport = useCallback(
    async (date: dayjs.Dayjs, period: PeriodType) => {
      if (!storeId) return;
      setLoading(true);
      try {
        const periodKey = periodKeyFromDate(date, period);
        const res: any = await apiClient.get(
          `/financials/end-of-day/${storeId}`,
          {
            params: { periodType: period, periodKey },
            headers: authHeaders,
          }
        );
        setReportData(res?.data?.report ?? null);

        // reset paging
        setEmpLimit(8);
        setProductLimit(8);
        setRefundLimit(8);
        setStockLimit(8);
      } catch {
        setReportData(null);
      } finally {
        setLoading(false);
      }
    },
    [storeId, authHeaders]
  );

  useEffect(() => {
    if (!storeId) return;
    loadReport(selectedDate, periodType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const changePeriod = (p: PeriodType, dateOverride?: dayjs.Dayjs) => {
    const d = dateOverride || selectedDate;
    if (dateOverride) setSelectedDate(dateOverride);
    setPeriodType(p);
    loadReport(d, p);
  };

  const openDatePicker = () => {
    setTempDate(selectedDate.toDate());
    setPickerVisible(true);
  };

  const closeDatePicker = () => setPickerVisible(false);

  const confirmDatePicker = () => {
    const d = dayjs(tempDate);
    setSelectedDate(d);
    closeDatePicker();
    loadReport(d, periodType);
  };

  const onPickerChange = (_e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      if (_e.type === "dismissed") {
        closeDatePicker();
        return;
      }
      if (date) {
        setTempDate(date);
        if (_e.type === "set") {
          const d = dayjs(date);
          setSelectedDate(d);
          closeDatePicker();
          loadReport(d, periodType);
        }
      }
      return;
    }
    if (date) setTempDate(date);
  };

  const headerTitle = useMemo(
    () => periodTitle(selectedDate, periodType),
    [selectedDate, periodType]
  );

  const byPayment = useMemo(() => reportData?.byPayment || [], [reportData]);
  const paymentTotal = useMemo(
    () => byPayment.reduce((sum, x) => sum + toNumber(x.revenue), 0),
    [byPayment]
  );

  const pieData: PieRow[] = useMemo(() => {
    const rows = byPayment
      .map((x) => ({
        name: PAYMENT_METHOD_NAMES[x._id] || x._id || "Khác",
        value: Math.max(0, toNumber(x.revenue)),
        count: x.count ?? 0,
      }))
      .filter((x) => x.value > 0 || x.count > 0);

    const map = new Map<string, PieRow>();
    rows.forEach((r) => {
      const prev = map.get(r.name);
      if (!prev) map.set(r.name, r);
      else
        map.set(r.name, {
          name: r.name,
          value: prev.value + r.value,
          count: prev.count + r.count,
        });
    });

    // sort desc by value for nicer legend
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [byPayment]);

  const visibleEmployees = useMemo(
    () => (reportData?.byEmployee || []).slice(0, empLimit),
    [reportData, empLimit]
  );
  const visibleProducts = useMemo(
    () => (reportData?.byProduct || []).slice(0, productLimit),
    [reportData, productLimit]
  );
  const visibleRefunds = useMemo(
    () => (reportData?.refundsByEmployee || []).slice(0, refundLimit),
    [reportData, refundLimit]
  );
  const visibleStocks = useMemo(
    () => (reportData?.stockSnapshot || []).slice(0, stockLimit),
    [reportData, stockLimit]
  );

  // ===== EXPORT FUNCTIONS =====
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "pdf" | "xlsx") => {
    if (!storeId || exporting) return;
    setExporting(true);
    try {
      const periodKey = periodKeyFromDate(selectedDate, periodType);
      const filename = `Bao_Cao_Cuoi_Ngay_${periodKey.replace(/[/:]/g, "-")}.${format}`;

      // 1. Prepare Directory (Cache/Reports)
      const reportsDir = new Directory(Paths.cache, "reports");
      if (!reportsDir.exists) {
        await reportsDir.create();
      }

      // 2. Prepare File
      const file = new File(reportsDir, filename);

      // 3. Fetch Data as ArrayBuffer using apiClient (handles Auth automatically)
      // Note: apiClient already includes baseURL
      const res = await apiClient.get(
        `/financials/end-of-day/${storeId}/export`,
        {
          params: { periodType, periodKey, format },
          headers: authHeaders,
          responseType: "arraybuffer", // Important for binary files
        }
      );

      // 4. Write data to file
      const uint8Array = new Uint8Array(res.data as ArrayBuffer);
      await file.write(uint8Array);

      // 5. Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType:
            format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: `Chia sẻ báo cáo ${format.toUpperCase()}`,
        });
      } else {
        Alert.alert("Thành công", `Đã lưu file: ${filename}`);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      Alert.alert(
        "Lỗi",
        err?.message || "Không thể xuất báo cáo. Vui lòng thử lại."
      );
    } finally {
      setExporting(false);
    }
  };

  const onExportPDF = () => handleExport("pdf");
  const onExportExcel = () => handleExport("xlsx");

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

  if (!storeId) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.pageTitle}>Báo cáo cuối ngày</Text>
          <Text style={styles.muted}>Chưa chọn cửa hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !reportData) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Đang tải báo cáo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!reportData) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Báo cáo cuối ngày</Text>
          <Text style={styles.heroSub}>{storeName}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 12 }}>
          <Card>
            <Text style={styles.emptyTitle}>Không có dữ liệu báo cáo</Text>
            <Text style={styles.emptySub}>
              Hãy thử chọn ngày/kỳ khác hoặc tải lại.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => loadReport(selectedDate, periodType)}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnOutline,
                  pressed && { opacity: 0.9 },
                  { flex: 1 },
                ]}
              >
                <Ionicons name="refresh" size={18} color={COLORS.text} />
                <Text style={styles.btnOutlineText}>Tải lại</Text>
              </Pressable>
              <Pressable
                onPress={openDatePicker}
                style={({ pressed }) => [
                  styles.btn,
                  styles.btnPrimary,
                  pressed && { opacity: 0.92 },
                  { flex: 1 },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Chọn ngày</Text>
              </Pressable>
            </View>
          </Card>
        </ScrollView>

        {/* Date picker modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDatePicker}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeDatePicker}>
            <Pressable style={styles.pickerSheet} onPress={() => {}}>
              {/* <View style={styles.pickerHeader}>
                <Text style={styles.modalTitle}>Chọn ngày</Text>
                <Pressable
                  onPress={closeDatePicker}
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.closeBtnText}>Đóng</Text>
                </Pressable>
              </View> */}

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
                    onPress={closeDatePicker}
                    style={[styles.btn, styles.btnOutline, { flex: 1 }]}
                  >
                    <Text style={styles.btnOutlineText}>Huỷ</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmDatePicker}
                    style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                  >
                    <Text style={styles.btnPrimaryText}>Áp dụng</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Báo cáo cuối ngày</Text>
          <Text style={styles.heroSub}>{storeName}</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => loadReport(selectedDate, periodType)}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
          </Pressable>
          <Pressable
            onPress={openDatePicker}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="calendar-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 28 }}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => loadReport(selectedDate, periodType)}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Filter bar */}
        <Card style={{ padding: 12 }}>
          <SectionHeader
            title={headerTitle}
            subtitle={`Kỳ: ${PERIOD_LABELS[periodType]}`}
            right={
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={onExportExcel}
                  disabled={exporting}
                  style={({ pressed }) => [
                    styles.btnTiny,
                    { backgroundColor: COLORS.green },
                    pressed && { opacity: 0.92 },
                    exporting && { opacity: 0.5 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="file-excel-outline"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.btnTinyText}>Excel</Text>
                </Pressable>
                <Pressable
                  onPress={onExportPDF}
                  disabled={exporting}
                  style={({ pressed }) => [
                    styles.btnTiny,
                    pressed && { opacity: 0.92 },
                    exporting && { opacity: 0.5 },
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color="#fff"
                  />
                  <Text style={styles.btnTinyText}>PDF</Text>
                </Pressable>
              </View>
            }
          />

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            <Pill
              text="Hôm nay"
              active={periodType === "day"}
              onPress={() => changePeriod("day", dayjs())}
              icon={
                <Ionicons
                  name="today-outline"
                  size={16}
                  color={periodType === "day" ? COLORS.primaryDark : COLORS.sub}
                />
              }
            />
            <Pill
              text="Tháng"
              active={periodType === "month"}
              onPress={() => changePeriod("month")}
              icon={
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={
                    periodType === "month" ? COLORS.primaryDark : COLORS.sub
                  }
                />
              }
            />
            <Pill
              text="Quý"
              active={periodType === "quarter"}
              onPress={() => changePeriod("quarter")}
              icon={
                <MaterialCommunityIcons
                  name="calendar-range-outline"
                  size={16}
                  color={
                    periodType === "quarter" ? COLORS.primaryDark : COLORS.sub
                  }
                />
              }
            />
            <Pill
              text="Năm"
              active={periodType === "year"}
              onPress={() => changePeriod("year")}
              icon={
                <Ionicons
                  name="calendar-number-outline"
                  size={16}
                  color={
                    periodType === "year" ? COLORS.primaryDark : COLORS.sub
                  }
                />
              }
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={openDatePicker}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && { opacity: 0.92 },
                { flex: 1 },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Chọn ngày</Text>
            </Pressable>

            <Pressable
              onPress={onExportPDF}
              style={({ pressed }) => [
                styles.btn,
                styles.btnDanger,
                pressed && { opacity: 0.92 },
                { flex: 1 },
              ]}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Xuất PDF</Text>
            </Pressable>
          </View>
        </Card>

        {/* Summary tiles */}
        <View style={styles.statGrid}>
          <StatTile
            title="Tổng đơn"
            value={`${reportData.summary.totalOrders} đơn`}
            tone="primary"
            icon={<Ionicons name="receipt-outline" size={18} color="#fff" />}
          />
          <StatTile
            title="Doanh thu"
            value={formatCurrency(reportData.summary.totalRevenue)}
            tone="dark"
            icon={<Ionicons name="cash-outline" size={18} color="#fff" />}
          />
          <StatTile
            title="VAT"
            value={formatCurrency(reportData.summary.vatTotal)}
            tone="primary"
            icon={
              <MaterialCommunityIcons
                name="percent-outline"
                size={18}
                color="#fff"
              />
            }
          />
          <StatTile
            title="Tiền mặt két"
            value={formatCurrency(reportData.summary.cashInDrawer)}
            tone="dark"
            icon={<Ionicons name="wallet-outline" size={18} color="#fff" />}
          />
          <StatTile
            title="Điểm thưởng"
            value={`${reportData.summary.totalLoyaltyEarned} điểm`}
            tone="primary"
            icon={<Ionicons name="gift-outline" size={18} color="#fff" />}
          />
          <StatTile
            title="Hoàn hàng"
            value={formatCurrency(reportData.summary.totalRefundAmount)}
            tone="danger"
            icon={
              <Ionicons
                name="return-down-back-outline"
                size={18}
                color="#fff"
              />
            }
          />
        </View>

        {/* Payment donut */}
        <Card>
          <SectionHeader
            title="Phương thức thanh toán"
            subtitle={
              pieData.length
                ? `Tổng: ${formatCurrency(paymentTotal)}`
                : undefined
            }
            right={
              <View style={styles.badgeSoft}>
                <Ionicons
                  name="pie-chart-outline"
                  size={16}
                  color={COLORS.primaryDark}
                />
                <Text style={styles.badgeSoftText}>Donut</Text>
              </View>
            }
          />

          {pieData.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={COLORS.sub}
              />
              <Text style={styles.emptyBoxText}>Không có dữ liệu.</Text>
            </View>
          ) : (
            <>
              <View style={{ marginTop: 10 }}>
                <DonutChart
                  data={pieData}
                  total={paymentTotal}
                  size={220}
                  thickness={28}
                />
              </View>

              <View style={{ marginTop: 8, gap: 10 }}>
                {pieData.map((d, idx) => {
                  const color = PIE_COLORS[idx % PIE_COLORS.length];
                  const pct =
                    paymentTotal > 0 ? (d.value / paymentTotal) * 100 : 0;
                  const exact = Math.floor(pct * 100) / 100; // không làm tròn lên

                  return (
                    <View
                      key={keyOf("payLegend", d.name, idx)}
                      style={styles.legendRow}
                    >
                      <View
                        style={[styles.legendDot, { backgroundColor: color }]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendName}>{d.name}</Text>
                        <Text style={styles.legendSub}>
                          {d.count} đơn • {exact.toFixed(2)}%
                        </Text>
                      </View>
                      <Text style={styles.legendMoney}>
                        {formatCurrency(d.value)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </Card>

        {/* By employee */}
        <Card>
          <SectionHeader
            title="Doanh thu theo nhân viên"
            subtitle="Sắp xếp theo dữ liệu backend"
          />
          <FlatList
            data={visibleEmployees}
            keyExtractor={(item, index) => keyOf("emp", item._id, index)}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={COLORS.sub}
                />
                <Text style={styles.emptyBoxText}>Không có dữ liệu.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    {item.orders} đơn • TB/đơn:{" "}
                    {formatCurrency(item.avgOrderValue)}
                  </Text>
                </View>
                <Text style={[styles.itemMoney, { color: COLORS.green }]}>
                  {formatCurrency(item.revenue)}
                </Text>
              </View>
            )}
          />
          {(reportData.byEmployee?.length || 0) > empLimit ? (
            <Pressable
              onPress={() => setEmpLimit((p) => p + 8)}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.text} />
            </Pressable>
          ) : null}
        </Card>

        {/* By product */}
        <Card>
          <SectionHeader
            title="Sản phẩm bán chạy"
            subtitle="SL bán / hoàn / còn lại"
          />
          <FlatList
            data={visibleProducts}
            keyExtractor={(item, index) => keyOf("prod", item._id, index)}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={COLORS.sub}
                />
                <Text style={styles.emptyBoxText}>Không có dữ liệu.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemSub}>SKU: {item.sku}</Text>
                  <View style={styles.kpiRow}>
                    <View
                      style={[styles.kpiPill, { backgroundColor: "#ecfdf5" }]}
                    >
                      <Text style={[styles.kpiText, { color: "#047857" }]}>
                        Bán: {item.quantitySold}
                      </Text>
                    </View>
                    <View
                      style={[styles.kpiPill, { backgroundColor: "#fff1f2" }]}
                    >
                      <Text style={[styles.kpiText, { color: "#be123c" }]}>
                        Hoàn: {item.refundQuantity}
                      </Text>
                    </View>
                    <View
                      style={[styles.kpiPill, { backgroundColor: "#eff6ff" }]}
                    >
                      <Text style={[styles.kpiText, { color: "#1d4ed8" }]}>
                        Còn: {item.netSold}
                      </Text>
                    </View>
                  </View>
                </View>
                <Text style={[styles.itemMoney, { color: COLORS.blue }]}>
                  {formatCurrency(item.revenue)}
                </Text>
              </View>
            )}
          />
          {(reportData.byProduct?.length || 0) > productLimit ? (
            <Pressable
              onPress={() => setProductLimit((p) => p + 8)}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.text} />
            </Pressable>
          ) : null}
        </Card>

        {/* Refund details */}
        {reportData.summary.totalRefunds > 0 ? (
          <Card style={{ borderColor: "#fecaca" }}>
            <SectionHeader
              title="Chi tiết hoàn hàng"
              subtitle={`Trong ${PERIOD_LABELS[periodType]} có ${reportData.summary.totalRefunds} đơn hoàn`}
            />

            <View style={styles.refundBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#be123c" />
              <Text style={styles.refundBannerText}>
                Tổng giá trị hoàn:{" "}
                {formatCurrency(reportData.summary.totalRefundAmount)}
              </Text>
            </View>

            <FlatList
              data={visibleRefunds}
              keyExtractor={(item, index) =>
                keyOf("refund", item.refundedBy, index)
              }
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(item.refundedAt).toLocaleString("vi-VN")}
                    </Text>
                  </View>
                  <Text style={[styles.itemMoney, { color: COLORS.danger }]}>
                    {formatCurrency(item.refundAmount)}
                  </Text>
                </View>
              )}
            />

            {(reportData.refundsByEmployee?.length || 0) > refundLimit ? (
              <Pressable
                onPress={() => setRefundLimit((p) => p + 8)}
                style={({ pressed }) => [
                  styles.loadMoreBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.loadMoreText}>Xem thêm</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.text} />
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {/* Stock snapshot */}
        <Card>
          <SectionHeader
            title="Tồn kho cuối ngày"
            subtitle="Cảnh báo khi tồn thấp"
          />
          <FlatList
            data={visibleStocks}
            keyExtractor={(item, index) =>
              keyOf("stock", item.productId, index)
            }
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={COLORS.sub}
                />
                <Text style={styles.emptyBoxText}>Không có dữ liệu.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const st = stockStatus(item.stock);
              return (
                <View style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSub}>SKU: {item.sku}</Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <View
                      style={[styles.stockPill, { backgroundColor: st.bg }]}
                    >
                      <Text style={[styles.stockPillText, { color: st.text }]}>
                        {item.stock}
                      </Text>
                    </View>
                    <Text style={[styles.stockLabel, { color: st.text }]}>
                      {st.label}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
          {(reportData.stockSnapshot?.length || 0) > stockLimit ? (
            <Pressable
              onPress={() => setStockLimit((p) => p + 8)}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.text} />
            </Pressable>
          ) : null}
        </Card>
      </ScrollView>

      {/* Date picker modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDatePicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            {/* <View style={styles.pickerHeader}>
              <Text style={styles.modalTitle}>Chọn ngày</Text>
              <Pressable
                onPress={closeDatePicker}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.closeBtnText}>Đóng</Text>
              </Pressable>
            </View> */}

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
                  onPress={closeDatePicker}
                  style={[styles.btn, styles.btnOutline, { flex: 1 }]}
                >
                  <Text style={styles.btnOutlineText}>Huỷ</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDatePicker}
                  style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
                >
                  <Text style={styles.btnPrimaryText}>Áp dụng</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default EndOfDayReportScreen;

/** =========================
 * Styles
 * ========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  heroHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  heroSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "800",
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
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
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  sectionSubtitle: {
    marginTop: 4,
    color: COLORS.sub,
    fontWeight: "700",
    fontSize: 12,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillOn: { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
  pillOff: { backgroundColor: "#f8fafc", borderColor: COLORS.border },
  pillTextOn: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },
  pillTextOff: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

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
  btnDanger: { backgroundColor: COLORS.danger },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnOutlineText: { color: COLORS.text, fontWeight: "900" },

  btnTiny: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primaryDark,
  },
  btnTinyText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  badgeSoft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  badgeSoftText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  statTile: {
    width: "48%",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statPrimary: { backgroundColor: COLORS.primary },
  statDark: { backgroundColor: "#334155" },
  statDanger: { backgroundColor: COLORS.danger },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.92)",
    fontWeight: "900",
    fontSize: 12,
  },
  statValue: { marginTop: 4, color: "#fff", fontWeight: "900", fontSize: 14 },

  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenterTitle: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },
  donutCenterValue: {
    marginTop: 6,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendName: { color: COLORS.text, fontWeight: "900" },
  legendSub: {
    marginTop: 2,
    color: COLORS.sub,
    fontWeight: "800",
    fontSize: 12,
  },
  legendMoney: { color: COLORS.text, fontWeight: "900" },

  itemCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  itemSub: { marginTop: 4, color: COLORS.sub, fontWeight: "700", fontSize: 12 },
  itemMoney: { fontWeight: "900", fontSize: 13 },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  kpiPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  kpiText: { fontWeight: "900", fontSize: 12 },

  stockPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  stockPillText: { fontWeight: "900", fontSize: 13 },
  stockLabel: { marginTop: 6, fontWeight: "900", fontSize: 11 },

  refundBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    marginTop: 10,
    marginBottom: 12,
  },
  refundBannerText: { color: "#be123c", fontWeight: "900" },

  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
    marginTop: 10,
  },
  emptyBoxText: { color: COLORS.sub, fontWeight: "800" },

  loadMoreBtn: {
    marginTop: 12,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    justifyContent: "center",
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    padding: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
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
  pickerFooter: { flexDirection: "row", gap: 10, marginTop: 10 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: COLORS.sub, fontWeight: "700", marginTop: 8 },

  pageTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },

  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  emptySub: { marginTop: 6, color: COLORS.sub, fontWeight: "700" },
});
