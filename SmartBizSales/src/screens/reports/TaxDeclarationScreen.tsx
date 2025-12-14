// src/screens/tax/TaxDeclarationScreen.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
  Platform,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import apiClient from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { Directory, File, Paths } from "expo-file-system/next";
import { fetch } from "expo/fetch";
import * as Sharing from "expo-sharing";
import DateTimePicker from "@react-native-community/datetimepicker";

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

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
};

const Field = React.memo(
  ({ label, value, onChangeText, placeholder, keyboardType }: FieldProps) => (
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
// ===================== TYPES =====================
type PeriodType = "month" | "quarter" | "year" | "custom";
type DeclarationStatus =
  | "draft"
  | "saved"
  | "submitted"
  | "approved"
  | "rejected";

type DecimalLike =
  | number
  | { $numberDecimal?: string }
  | { numberDecimal?: string };

interface Store {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  taxCode?: string;
  address?: string;
  email?: string;
  ownername?: string;
  bankAccount?: string;
  businessSector?: string;
  area?: number;
  isRented?: boolean;
  [key: string]: any;
}

interface CategoryRevenueItem {
  category: keyof typeof CATEGORY_MAP;
  revenue: number;
  gtgtTax: number;
  tncnTax: number;
}

interface SpecialTaxItem {
  itemName: string;
  unit: string;
  revenue: number;
  taxRate: number;
  taxAmount: number;
}

interface EnvTaxItem {
  type: "resource" | "environmentaltax" | "environmentalfee";
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
}

interface TaxpayerInfo {
  name?: string;
  storeName?: string;
  bankAccount?: string;
  taxCode?: string;
  businessSector?: string;
  businessArea?: number;
  isRented?: boolean;
  employeeCount?: number;
  workingHours?: { from?: string; to?: string };
  businessAddress?: {
    full?: string;
    street?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  phone?: string;
  email?: string;
}

interface TaxAmounts {
  gtgt?: number;
  tncn?: number;
  total?: number;
}

interface TaxDeclarationRecord {
  id: string;
  storeId: string;
  periodType: PeriodType;
  periodKey: string;
  declaredRevenue: number;
  systemRevenue?: number;
  orderCount?: number;
  taxRates?: { gtgt?: number; tncn?: number };
  taxAmounts?: TaxAmounts;
  revenueByCategory?: Array<{
    category: string;
    revenue: number;
    gtgtTax: number;
    tncnTax: number;
  }>;
  specialConsumptionTax?: Array<{
    itemName: string;
    unit: string;
    revenue: number;
    taxRate: number;
    taxAmount: number;
  }>;
  environmentalTax?: Array<{
    type: string;
    itemName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
  }>;
  notes?: string;
  taxpayerInfo?: TaxpayerInfo;

  isClone?: boolean;
  version?: string | number;
  status: DeclarationStatus;

  createdAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdBy?: { fullName?: string; email?: string };
  approvedBy?: { fullName?: string; email?: string };
}

// ===================== CONSTANTS (từ bản web) =====================
const PERIOD_TYPES: Array<{
  value: PeriodType;
  label: string;
  description: string;
}> = [
  { value: "month", label: "Tháng", description: "Kê khai theo tháng" },
  { value: "quarter", label: "Quý", description: "Kê khai theo quý" },
  { value: "year", label: "Năm", description: "Kê khai theo năm" },
  {
    value: "custom",
    label: "Tùy chỉnh",
    description: "Kê khai theo khoảng thời gian tùy chọn",
  },
];

const TAX_RATES = {
  DEFAULT_GTGT: 1.0,
  DEFAULT_TNCN: 0.5,
  MAX_GTGT: 10,
  MAX_TNCN: 5,
};

const STATUS_CONFIG: Record<
  DeclarationStatus,
  { text: string; color: string }
> = {
  draft: { text: "Nháp", color: "#6b7280" },
  saved: { text: "Đã lưu", color: "#2563eb" },
  submitted: { text: "Đã nộp", color: "#f59e0b" },
  approved: { text: "Đã duyệt", color: "#10b981" },
  rejected: { text: "Từ chối", color: "#ef4444" },
};

const CATEGORY_MAP = {
  goodsdistribution: { code: 28, name: "Phân phối, cung cấp hàng hóa" },
  serviceconstruction: {
    code: 29,
    name: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu",
  },
  manufacturingtransport: {
    code: 30,
    name: "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa",
  },
  otherbusiness: { code: 31, name: "Hoạt động kinh doanh khác" },
} as const;

// ===================== HELPERS =====================
const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (!v || typeof v !== "object") return 0;

  const s = v.$numberDecimal ?? v.numberDecimal ?? v.toString?.();

  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
};

const formatVND = (value: number): string => {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(Math.round(Number(value) || 0));
  } catch {
    return `${Math.round(Number(value) || 0)}`;
  }
};

const parseNumberInput = (s: string): number => {
  const cleaned = (s || "").replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const getStoreId = (store: Store | null): string | null => {
  if (!store) return null;
  return (store.id || store._id) ?? null;
};

const buildPeriodKey = (
  periodType: PeriodType,
  month: string,
  quarter: string,
  year: string,
  from: string,
  to: string
) => {
  if (periodType === "month") return month;
  if (periodType === "quarter") return quarter;
  if (periodType === "year") return year;
  if (periodType === "custom") return from && to ? `${from}-${to}` : "";
  return "";
};

// ===================== MAIN SCREEN =====================
export default function TaxDeclarationScreen() {
  const { user } = useAuth();

  // Auth + Store
  const [token, setToken] = useState<string | null>(null);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Step
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Filter period
  const [periodType, setPeriodType] = useState<PeriodType | null>(null);
  const [monthKey, setMonthKey] = useState<string>(dayjs().format("YYYY-MM")); // YYYY-MM
  const [quarterKey, setQuarterKey] = useState<string>(
    `${dayjs().year()}-Q${Math.ceil((dayjs().month() + 1) / 3)}`
  ); // YYYY-Qn
  const [yearKey, setYearKey] = useState<string>(dayjs().format("YYYY")); // YYYY
  const [monthFrom, setMonthFrom] = useState<string>(dayjs().format("YYYY-MM"));
  const [monthTo, setMonthTo] = useState<string>(dayjs().format("YYYY-MM"));

  // Preview system revenue
  const [systemRevenue, setSystemRevenue] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number>(0);

  // Editing
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form values
  const [declaredRevenueText, setDeclaredRevenueText] = useState<string>("");
  const [gtgtRateText, setGtgtRateText] = useState<string>(
    String(TAX_RATES.DEFAULT_GTGT)
  );
  const [tncnRateText, setTncnRateText] = useState<string>(
    String(TAX_RATES.DEFAULT_TNCN)
  );
  const [isFirstTime, setIsFirstTime] = useState<boolean>(true);
  const [supplementNumberText, setSupplementNumberText] = useState<string>("0");
  const [exportTargetId, setExportTargetId] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  // Taxpayer info
  const [taxpayerName, setTaxpayerName] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [taxCode, setTaxCode] = useState<string>("");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [businessSector, setBusinessSector] = useState<string>("");
  const [businessAreaText, setBusinessAreaText] = useState<string>("0");
  const [isRented, setIsRented] = useState<boolean>(false);
  const [employeeCountText, setEmployeeCountText] = useState<string>("0");
  const [workingHoursFrom, setWorkingHoursFrom] = useState<string>("08:00");
  const [workingHoursTo, setWorkingHoursTo] = useState<string>("22:00");
  const [businessAddressFull, setBusinessAddressFull] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // Extra
  const [notes, setNotes] = useState<string>("");

  // Arrays
  const [categoryRevenues, setCategoryRevenues] = useState<
    CategoryRevenueItem[]
  >([]);
  const [specialTaxItems, setSpecialTaxItems] = useState<SpecialTaxItem[]>([]);
  const [envTaxItems, setEnvTaxItems] = useState<EnvTaxItem[]>([]);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Result
  const calculatedTax = useMemo(() => {
    const declaredRevenue = parseNumberInput(declaredRevenueText);
    const gtgtRate = parseNumberInput(gtgtRateText);
    const tncnRate = parseNumberInput(tncnRateText);
    const gtgt = (declaredRevenue * gtgtRate) / 100;
    const tncn = (declaredRevenue * tncnRate) / 100;
    const total = gtgt + tncn;
    return { declaredRevenue, gtgtRate, tncnRate, gtgt, tncn, total };
  }, [declaredRevenueText, gtgtRateText, tncnRateText]);

  const periodKey = useMemo(() => {
    if (!periodType) return "";
    return buildPeriodKey(
      periodType,
      monthKey,
      quarterKey,
      yearKey,
      monthFrom,
      monthTo
    );
  }, [periodType, monthKey, quarterKey, yearKey, monthFrom, monthTo]);

  const hasValidPeriod = useMemo(() => {
    if (!periodType) return false;
    if (periodType === "custom") return !!monthFrom && !!monthTo;
    return !!periodKey;
  }, [periodType, periodKey, monthFrom, monthTo]);

  // Declarations list
  const [declarations, setDeclarations] = useState<TaxDeclarationRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Modals
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TaxDeclarationRecord | null>(null);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [customPicking, setCustomPicking] = useState<"from" | "to" | null>(
    null
  );
  type PickerTarget = null | "period" | "customFrom" | "customTo";

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [showPicker, setShowPicker] = useState(false);

  // ===================== INIT: token + store =====================
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

  // Prefill taxpayer info from store
  useEffect(() => {
    if (!currentStore) return;
    setTaxpayerName(currentStore.ownername || user?.fullname || "");
    setStoreName(currentStore.name || "");
    setTaxCode(currentStore.taxCode || "");
    setBankAccount(currentStore.bankAccount || "");
    setBusinessSector(currentStore.businessSector || "");
    setBusinessAreaText(String(currentStore.area ?? 0));
    setIsRented(!!currentStore.isRented);
    setBusinessAddressFull(currentStore.address || "");
    setPhone(currentStore.phone || "");
    setEmail(currentStore.email || "");
  }, [currentStore, user?.fullname]);

  // Load declarations whenever storeId/page ready
  useEffect(() => {
    if (!storeId || !token) return;
    fetchDeclarations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, token, page]);

  const axiosConfig = useMemo(() => {
    return {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
    };
  }, [token]);
  // ===================== PICKERS =====================
  const onChangeCustom = (event: any, date?: Date) => {
    if (event?.type === "dismissed" || !date) {
      setShowPeriodPicker(false);
      setCustomPicking(null);
      return;
    }

    const picked = dayjs(date).format("YYYY-MM");

    if (customPicking === "from") {
      // đảm bảo from <= to
      const newFrom = picked;
      const to = monthTo || picked;
      if (dayjs(newFrom).isAfter(dayjs(to))) {
        setMonthFrom(newFrom);
        setMonthTo(newFrom);
      } else {
        setMonthFrom(newFrom);
      }
    }

    if (customPicking === "to") {
      // đảm bảo from <= to
      const from = monthFrom || picked;
      const newTo = picked;
      if (dayjs(newTo).isBefore(dayjs(from))) {
        setMonthFrom(newTo);
        setMonthTo(newTo);
      } else {
        setMonthTo(newTo);
      }
    }

    setShowPeriodPicker(false);
    setCustomPicking(null);
  };

  const openPeriodPicker = () => {
    if (!periodType) return;

    // phân biệt đang chọn month/quarter/year theo periodType hiện tại
    setPickerTarget("period");

    if (periodType === "month") {
      setTempDate(dayjs(monthKey, "YYYY-MM").toDate());
    } else if (periodType === "year") {
      setTempDate(dayjs(yearKey, "YYYY").toDate());
    } else if (periodType === "quarter") {
      const [y, q] = quarterKey.split("-Q");
      const m = (Number(q || 1) - 1) * 3;
      setTempDate(
        dayjs(`${y || dayjs().year()}-01-01`)
          .month(m)
          .toDate()
      );
    } else {
      setTempDate(new Date());
    }

    setShowPicker(true);
  };
  const closePicker = () => {
    setShowPicker(false);
    setPickerTarget(null);
  };

  const onChangePicker = (event: any, date?: Date) => {
    // Dismiss/Cancel: kiểm tra event.type để không set giá trị sai [web:149]
    if (event?.type === "dismissed" || !date) {
      closePicker();
      return;
    }

    // ===== PERIOD (month/quarter/year) =====
    if (pickerTarget === "period") {
      if (periodType === "month") setMonthKey(dayjs(date).format("YYYY-MM"));
      else if (periodType === "year") setYearKey(dayjs(date).format("YYYY"));
      else if (periodType === "quarter") {
        const y = dayjs(date).year();
        const q = Math.ceil((dayjs(date).month() + 1) / 3);
        setQuarterKey(`${y}-Q${q}`);
      }
    }

    // ===== CUSTOM RANGE =====
    if (pickerTarget === "customFrom") {
      const newFrom = dayjs(date).format("YYYY-MM");
      setMonthFrom(newFrom);

      // chỉ tự sửa "to" nếu from > to
      if (dayjs(newFrom).isAfter(dayjs(monthTo, "YYYY-MM"))) {
        setMonthTo(newFrom);
      }
    }

    if (pickerTarget === "customTo") {
      const newTo = dayjs(date).format("YYYY-MM");
      setMonthTo(newTo);

      // chỉ tự sửa "from" nếu to < from
      if (dayjs(newTo).isBefore(dayjs(monthFrom, "YYYY-MM"))) {
        setMonthFrom(newTo);
      }
    }

    // Android: thường chọn xong là đóng; iOS spinner: nên có nút "Xong" để đóng [web:147]
    if (Platform.OS === "android") {
      closePicker();
    }
  };

  const openCustomPicker = (which: "from" | "to") => {
    setPickerTarget(which === "from" ? "customFrom" : "customTo");

    const current =
      which === "from"
        ? dayjs(monthFrom, "YYYY-MM").toDate()
        : dayjs(monthTo, "YYYY-MM").toDate();

    setTempDate(current);
    setShowPicker(true);
  };

  const onChangePeriod = (event: any, date?: Date) => {
    // user bấm cancel -> date undefined (thư viện gọi onChange cả khi dismiss) [web:77]
    if (event?.type === "dismissed" || !date) {
      setShowPeriodPicker(false);
      return;
    }

    setShowPeriodPicker(false);
    if (!periodType) return;

    if (periodType === "month") setMonthKey(dayjs(date).format("YYYY-MM"));
    else if (periodType === "year") setYearKey(dayjs(date).format("YYYY"));
    else if (periodType === "quarter") {
      const y = dayjs(date).year();
      const q = Math.ceil((dayjs(date).month() + 1) / 3);
      setQuarterKey(`${y}-Q${q}`);
    }
  };

  // ===================== API: fetch declarations =====================
  const fetchDeclarations = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res: any = await apiClient.get("/taxs", {
        ...axiosConfig,
        params: { storeId, page, limit: pageSize },
      });

      // web: res.data.success + res.data.data + res.data.pagination.total
      const ok = !!res.data?.success;
      if (!ok)
        throw new Error(res.data?.message || "Lỗi tải danh sách tờ khai");

      const rows: any[] = res.data?.data || [];
      const total = res.data?.pagination?.total || 0;

      const normalized: TaxDeclarationRecord[] = rows.map((r: any) => ({
        id: r.id || r._id,
        storeId: r.storeId,
        periodType: r.periodType,
        periodKey: r.periodKey,
        declaredRevenue: Number(r.declaredRevenue || 0),
        systemRevenue: Number(r.systemRevenue || 0),
        orderCount: Number(r.orderCount || 0),
        taxRates: r.taxRates,
        taxAmounts: r.taxAmounts,
        revenueByCategory: r.revenueByCategory,
        specialConsumptionTax: r.specialConsumptionTax,
        environmentalTax: r.environmentalTax,
        notes: r.notes,
        taxpayerInfo: r.taxpayerInfo,
        isClone: !!r.isClone,
        version: r.version,
        status: r.status,
        createdAt: r.createdAt,
        submittedAt: r.submittedAt,
        approvedAt: r.approvedAt,
        rejectionReason: r.rejectionReason,
        createdBy: r.createdBy,
        approvedBy: r.approvedBy,
      }));

      setDeclarations(normalized);
      setTotalCount(total);
    } catch (e: any) {
      console.error(
        "❌ fetchDeclarations error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message ||
          e?.message ||
          "Không thể tải danh sách tờ khai"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, axiosConfig, page]);

  // ===================== API: preview revenue =====================
  const fetchPreview = async () => {
    if (!storeId) {
      Alert.alert(
        "Thiếu thông tin",
        "Vui lòng chọn cửa hàng trước khi kê khai thuế"
      );
      return;
    }
    if (!periodType) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn kỳ kê khai");
      return;
    }
    if (!hasValidPeriod) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn thời gian kê khai hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const params: any = { storeId, periodType };
      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      } else {
        params.periodKey = periodKey;
      }

      const res: any = await apiClient.get("/taxs/preview", {
        ...axiosConfig,
        params,
      });

      if (!res.data?.success)
        throw new Error(res.data?.message || "Lỗi tải doanh thu hệ thống");
      console.log("✅ fetchPreview res.data:", res.data);
      const revenue = toNumber(res.data?.systemRevenue ?? 0);
      const count = Number(res.data?.orderCount ?? 0);

      setSystemRevenue(revenue);
      setOrderCount(count);

      setDeclaredRevenueText(String(Math.round(revenue)));
      setCurrentStep(2);

      Alert.alert(
        "Thành công",
        `Đã tải doanh thu hệ thống: ${formatVND(revenue)} (${count} đơn)`
      );
    } catch (e: any) {
      console.error(
        "❌ fetchPreview error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message ||
          e?.message ||
          "Không thể tải doanh thu hệ thống"
      );
    } finally {
      setLoading(false);
    }
  };

  // ===================== ACTIONS =====================
  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setCurrentStep(0);
    setSystemRevenue(null);
    setOrderCount(0);

    setDeclaredRevenueText("");
    setGtgtRateText(String(TAX_RATES.DEFAULT_GTGT));
    setTncnRateText(String(TAX_RATES.DEFAULT_TNCN));
    setIsFirstTime(true);
    setSupplementNumberText("0");

    setCategoryRevenues([]);
    setSpecialTaxItems([]);
    setEnvTaxItems([]);
    setNotes("");

    // re-prefill store info
    if (currentStore) {
      setTaxpayerName(currentStore.ownername || user?.fullname || "");
      setStoreName(currentStore.name || "");
      setTaxCode(currentStore.taxCode || "");
      setBankAccount(currentStore.bankAccount || "");
      setBusinessSector(currentStore.businessSector || "");
      setBusinessAreaText(String(currentStore.area ?? 0));
      setIsRented(!!currentStore.isRented);
      setBusinessAddressFull(currentStore.address || "");
      setPhone(currentStore.phone || "");
      setEmail(currentStore.email || "");
    }
  };

  const validateForm = (): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!periodType) errors.push("Chưa chọn kỳ kê khai");
    if (!hasValidPeriod) errors.push("Chưa chọn thời gian kê khai hợp lệ");

    const declared = parseNumberInput(declaredRevenueText);
    if (!declared || declared <= 0)
      errors.push("Doanh thu kê khai phải lớn hơn 0");

    if (systemRevenue !== null && systemRevenue > 0 && declared > 0) {
      const diff = Math.abs(declared - systemRevenue);
      const diffPercent = (diff / systemRevenue) * 100;
      if (diffPercent >= 20)
        warnings.push(
          `Doanh thu kê khai lệch ${diffPercent.toFixed(1)}% so với hệ thống`
        );
    }

    const categoryTotal = categoryRevenues.reduce(
      (s, c) => s + Number(c.revenue || 0),
      0
    );
    if (
      categoryRevenues.length > 0 &&
      Math.abs(categoryTotal - declared) > 1000
    ) {
      warnings.push(
        "Tổng doanh thu theo ngành nghề chưa khớp doanh thu kê khai"
      );
    }

    if (!taxpayerName) warnings.push("Chưa nhập tên người nộp thuế");
    if (!taxCode) warnings.push("Chưa nhập mã số thuế");
    if (!email) warnings.push("Chưa nhập email");

    return { isValid: errors.length === 0, errors, warnings };
  };

  const useSystemRevenue = () => {
    if (systemRevenue === null) {
      Alert.alert(
        "Chưa có doanh thu hệ thống",
        "Vui lòng bấm 'Xem doanh thu hệ thống' trước"
      );
      return;
    }
    setDeclaredRevenueText(String(Math.round(systemRevenue)));
    Alert.alert(
      "Đã áp dụng",
      `Đã set doanh thu kê khai = ${formatVND(systemRevenue)}`
    );
  };

  // ===================== CRUD: submit create/update =====================
  const submitDeclaration = async (status: DeclarationStatus) => {
    const v = validateForm();
    if (!v.isValid) {
      Alert.alert("Thông tin chưa hợp lệ", v.errors.join("\n"));
      return;
    }

    if (v.warnings.length > 0 && status === "submitted") {
      Alert.alert(
        "Cảnh báo",
        `${v.warnings.join("\n")}\n\nBạn vẫn muốn nộp tờ khai?`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Nộp",
            style: "destructive",
            onPress: () => submitDeclarationInternal(status, true),
          },
        ]
      );
      return;
    }

    await submitDeclarationInternal(status, false);
  };

  const submitDeclarationInternal = async (
    status: DeclarationStatus,
    withWarnings: boolean
  ) => {
    if (!storeId || !periodType) return;

    setSubmitLoading(true);
    try {
      const finalPeriodKey =
        periodType === "custom"
          ? monthFrom && monthTo
            ? `${monthFrom}-${monthTo}`
            : ""
          : periodKey;

      const payload: any = {
        storeId,
        periodType,
        periodKey: finalPeriodKey,
        declaredRevenue: parseNumberInput(declaredRevenueText),
        taxRates: {
          gtgt: parseNumberInput(gtgtRateText) || TAX_RATES.DEFAULT_GTGT,
          tncn: parseNumberInput(tncnRateText) || TAX_RATES.DEFAULT_TNCN,
        },
        isFirstTime: !!isFirstTime,
        supplementNumber: parseNumberInput(supplementNumberText) || 0,
        revenueByCategory: categoryRevenues.map((c) => ({
          category: c.category,
          revenue: Number(c.revenue || 0),
          gtgtTax: Number(c.gtgtTax || 0),
          tncnTax: Number(c.tncnTax || 0),
        })),
        specialConsumptionTax: specialTaxItems.map((it) => ({
          itemName: it.itemName,
          unit: it.unit,
          revenue: Number(it.revenue || 0),
          taxRate: Number(it.taxRate || 0),
          taxAmount: Number(it.taxAmount || 0),
        })),
        environmentalTax: envTaxItems.map((it) => ({
          type: it.type,
          itemName: it.itemName,
          unit: it.unit,
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.unitPrice || 0),
          taxRate: Number(it.taxRate || 0),
          taxAmount: Number(it.taxAmount || 0),
        })),
        notes,
        taxpayerInfo: {
          name: taxpayerName,
          storeName: storeName,
          bankAccount: bankAccount,
          taxCode: taxCode,
          businessSector: businessSector,
          businessArea: parseNumberInput(businessAreaText) || 0,
          isRented: !!isRented,
          employeeCount: parseNumberInput(employeeCountText) || 0,
          workingHours: {
            from: workingHoursFrom || "08:00",
            to: workingHoursTo || "22:00",
          },
          businessAddress: { full: businessAddressFull },
          phone,
          email,
        },
        status,
      };

      if (periodType === "custom") {
        payload.monthFrom = monthFrom;
        payload.monthTo = monthTo;
      }

      const url = isEditing && editingId ? `/taxs/${editingId}` : "/taxs";
      const method = isEditing && editingId ? "put" : "post";

      const res: any =
        method === "post"
          ? await apiClient.post(url, payload, axiosConfig)
          : await apiClient.put(url, payload, axiosConfig);

      if (!res.data?.success)
        throw new Error(res.data?.message || "Lỗi lưu tờ khai");

      Alert.alert(
        "Thành công",
        res.data?.message ||
          (isEditing ? "Cập nhật tờ khai thành công" : "Tạo tờ khai thành công")
      );

      resetForm();
      fetchDeclarations();
    } catch (e: any) {
      console.error(
        "❌ submitDeclaration error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || e?.message || "Không thể lưu tờ khai"
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // ===================== CRUD: load detail for edit =====================
  const fetchDeclarationById = async (
    id: string
  ): Promise<TaxDeclarationRecord | null> => {
    const res: any = await apiClient.get(`/taxs/${id}`, axiosConfig);
    if (!res.data?.success)
      throw new Error(res.data?.message || "Lỗi tải chi tiết tờ khai");
    const d = res.data?.declaration || res.data?.data;
    if (!d) return null;

    const normalized: TaxDeclarationRecord = {
      id: d.id || d._id,
      storeId: d.storeId,
      periodType: d.periodType,
      periodKey: d.periodKey,
      declaredRevenue: Number(d.declaredRevenue || 0),
      systemRevenue: Number(d.systemRevenue || 0),
      orderCount: Number(d.orderCount || 0),
      taxRates: d.taxRates,
      taxAmounts: d.taxAmounts,
      revenueByCategory: d.revenueByCategory,
      specialConsumptionTax: d.specialConsumptionTax,
      environmentalTax: d.environmentalTax,
      notes: d.notes,
      taxpayerInfo: d.taxpayerInfo,
      isClone: !!d.isClone,
      version: d.version,
      status: d.status,
      createdAt: d.createdAt,
      submittedAt: d.submittedAt,
      approvedAt: d.approvedAt,
      rejectionReason: d.rejectionReason,
      createdBy: d.createdBy,
      approvedBy: d.approvedBy,
    };

    return normalized;
  };

  const loadForEdit = async (id: string) => {
    setLoading(true);
    try {
      const d = await fetchDeclarationById(id);
      if (!d) {
        Alert.alert("Không tìm thấy", "Không tìm thấy tờ khai");
        return;
      }
      if (!["draft", "saved"].includes(d.status)) {
        Alert.alert(
          "Không thể chỉnh sửa",
          "Tờ khai đã nộp/đã duyệt/đã từ chối không thể chỉnh sửa"
        );
        return;
      }

      setIsEditing(true);
      setEditingId(d.id);

      setSystemRevenue(Number(d.systemRevenue || 0));
      setOrderCount(Number(d.orderCount || 0));

      // period
      setPeriodType(d.periodType);
      if (
        d.periodType === "custom" &&
        typeof d.periodKey === "string" &&
        d.periodKey.includes("-")
      ) {
        const parts = d.periodKey.split("-");
        setMonthFrom(parts[0]);
        setMonthTo(parts[1]);
      } else if (d.periodType === "month") {
        setMonthKey(d.periodKey);
      } else if (d.periodType === "quarter") {
        setQuarterKey(d.periodKey);
      } else if (d.periodType === "year") {
        setYearKey(d.periodKey);
      }

      // main fields
      setDeclaredRevenueText(
        String(Math.round(Number(d.declaredRevenue || 0)))
      );
      setGtgtRateText(String(d.taxRates?.gtgt ?? TAX_RATES.DEFAULT_GTGT));
      setTncnRateText(String(d.taxRates?.tncn ?? TAX_RATES.DEFAULT_TNCN));
      setNotes(d.notes || "");

      // taxpayer info
      setTaxpayerName(d.taxpayerInfo?.name || taxpayerName);
      setStoreName(d.taxpayerInfo?.storeName || storeName);
      setTaxCode(d.taxpayerInfo?.taxCode || taxCode);
      setBankAccount(d.taxpayerInfo?.bankAccount || bankAccount);
      setBusinessSector(d.taxpayerInfo?.businessSector || businessSector);
      setBusinessAreaText(String(d.taxpayerInfo?.businessArea ?? 0));
      setIsRented(!!d.taxpayerInfo?.isRented);
      setEmployeeCountText(String(d.taxpayerInfo?.employeeCount ?? 0));
      setWorkingHoursFrom(d.taxpayerInfo?.workingHours?.from || "08:00");
      setWorkingHoursTo(d.taxpayerInfo?.workingHours?.to || "22:00");
      setBusinessAddressFull(
        d.taxpayerInfo?.businessAddress?.full || businessAddressFull
      );
      setPhone(d.taxpayerInfo?.phone || phone);
      setEmail(d.taxpayerInfo?.email || email);

      // arrays
      if (d.revenueByCategory?.length) {
        setCategoryRevenues(
          d.revenueByCategory.map((c) => ({
            category: (c.category as any) || "goodsdistribution",
            revenue: Number(c.revenue || 0),
            gtgtTax: Number(c.gtgtTax || 0),
            tncnTax: Number(c.tncnTax || 0),
          }))
        );
      } else setCategoryRevenues([]);

      if (d.specialConsumptionTax?.length) {
        setSpecialTaxItems(
          d.specialConsumptionTax.map((it) => ({
            itemName: it.itemName || "",
            unit: it.unit || "",
            revenue: Number(it.revenue || 0),
            taxRate: Number(it.taxRate || 0),
            taxAmount: Number(it.taxAmount || 0),
          }))
        );
      } else setSpecialTaxItems([]);

      if (d.environmentalTax?.length) {
        setEnvTaxItems(
          d.environmentalTax.map((it) => ({
            type: (it.type as any) || "environmentaltax",
            itemName: it.itemName || "",
            unit: it.unit || "",
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            taxRate: Number(it.taxRate || 0),
            taxAmount: Number(it.taxAmount || 0),
          }))
        );
      } else setEnvTaxItems([]);

      setCurrentStep(3);
      Alert.alert("Đang chỉnh sửa", `Đã tải tờ khai kỳ ${d.periodKey}`);
    } catch (e: any) {
      console.error(
        "❌ loadForEdit error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || e?.message || "Không thể tải tờ khai"
      );
    } finally {
      setLoading(false);
    }
  };

  // ===================== STATUS / CLONE / DELETE / APPROVE / REJECT =====================
  const handleClone = async (id: string) => {
    setLoading(true);
    try {
      const res: any = await apiClient.post(
        `/taxs/${id}/clone`,
        {},
        axiosConfig
      );
      if (!res.data?.success)
        throw new Error(res.data?.message || "Lỗi nhân bản tờ khai");
      Alert.alert("Thành công", res.data?.message || "Đã tạo bản sao");
      fetchDeclarations();
    } catch (e: any) {
      console.error("❌ clone error:", e?.response?.data || e?.message || e);
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || e?.message || "Không thể nhân bản"
      );
    } finally {
      setLoading(false);
    }
  };

  // ======= TIẾP TỤC TỪ ĐOẠN handleDelete (dán đè từ đây tới hết file) =======

  const handleDelete = async (id: string) => {
    Alert.alert("Xóa tờ khai", "Bạn chắc chắn muốn xóa tờ khai này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            const res: any = await apiClient.delete(`/taxs/${id}`, axiosConfig);
            if (!res.data?.success)
              throw new Error(res.data?.message || "Lỗi xóa tờ khai");
            Alert.alert("Thành công", res.data?.message || "Đã xóa tờ khai");
            fetchDeclarations();
          } catch (e: any) {
            console.error(
              "❌ delete error:",
              e?.response?.data || e?.message || e
            );
            Alert.alert(
              "Lỗi",
              e?.response?.data?.message ||
                e?.message ||
                "Không thể xóa tờ khai"
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleUpdateStatus = async (id: string, status: DeclarationStatus) => {
    setLoading(true);
    try {
      const res: any = await apiClient.put(
        `/taxs/${id}`,
        { status },
        axiosConfig
      );
      if (!res.data?.success)
        throw new Error(res.data?.message || "Lỗi cập nhật trạng thái");
      Alert.alert("Thành công", res.data?.message || "Đã cập nhật trạng thái");
      fetchDeclarations();
    } catch (e: any) {
      console.error(
        "❌ update status error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message ||
          e?.message ||
          "Không thể cập nhật trạng thái"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (
    id: string,
    action: "approve" | "reject",
    reason?: string
  ) => {
    setLoading(true);
    try {
      const payload: any = { action };
      if (action === "reject") payload.rejectionReason = reason || "";
      const res: any = await apiClient.post(
        `/taxs/${id}/approve`,
        payload,
        axiosConfig
      );
      if (!res.data?.success)
        throw new Error(res.data?.message || "Lỗi duyệt/từ chối");
      Alert.alert(
        "Thành công",
        res.data?.message || (action === "approve" ? "Đã duyệt" : "Đã từ chối")
      );
      fetchDeclarations();
    } catch (e: any) {
      console.error(
        "❌ approve/reject error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || e?.message || "Không thể thực hiện"
      );
    } finally {
      setLoading(false);
      setRejectVisible(false);
      setRejectReason("");
      setSelectedActionId(null);
    }
  };

  const showRejectModal = (id: string) => {
    setSelectedActionId(id);
    setRejectReason("");
    setRejectVisible(true);
  };

  const showApproveConfirm = (id: string) => {
    Alert.alert("Duyệt tờ khai", "Bạn chắc chắn muốn duyệt tờ khai này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Duyệt",
        style: "default",
        onPress: () => handleApproveReject(id, "approve"),
      },
    ]);
  };

  // (Tuỳ backend) Export: nếu API trả URL thì có thể mở bằng Linking.
  // Hiện giữ tối giản để tránh phụ thuộc responseType blob trên RN.
  const ensureDir = () => {
    const dir = new Directory(Paths.cache, "tax-exports");
    dir.create({ intermediates: true, idempotent: true }); // không lỗi nếu đã tồn tại
    return dir;
  };

  const joinUrl = (baseURL: string, path: string) => {
    if (!baseURL) return path;
    return `${baseURL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
  };

  const handleExport = async (id: string, format: "pdf" | "csv") => {
    if (!id) return;

    try {
      setExportLoading(true);

      const ext = format === "pdf" ? "pdf" : "csv";
      const mime = format === "pdf" ? "application/pdf" : "text/csv";

      // baseURL lấy từ apiClient (axios instance) của bạn
      const baseURL = (apiClient.defaults as any)?.baseURL || "";
      const url = joinUrl(baseURL, `/taxs/${id}/export?format=${format}`);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`, // token đang có trong state
          Accept: mime,
        },
      });

      if (!res.ok) {
        throw new Error(`Export failed (HTTP ${res.status})`);
      }

      const bytes = await res.bytes(); // Uint8Array theo expo/fetch
      const dir = await ensureDir();
      const outFile = new File(dir, `to-khai-${id}-${Date.now()}.${ext}`);

      outFile.write(bytes); // File.write nhận Uint8Array [web:59]

      // Mở/share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(outFile.uri, { mimeType: mime });
      } else {
        Alert.alert("Thành công", `Đã lưu file tại: ${outFile.uri}`);
      }
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể xuất file");
    } finally {
      setExportLoading(false);
    }
  };

  // ===================== ARRAY HANDLERS =====================
  const addCategoryRevenue = () => {
    setCategoryRevenues((prev) => [
      ...prev,
      { category: "goodsdistribution", revenue: 0, gtgtTax: 0, tncnTax: 0 },
    ]);
  };

  const removeCategoryRevenue = (index: number) => {
    setCategoryRevenues((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCategoryRevenue = (
    index: number,
    field: keyof CategoryRevenueItem,
    value: any
  ) => {
    setCategoryRevenues((prev) => {
      const next = [...prev];
      (next[index] as any)[field] =
        field === "category" ? value : Number(value || 0);
      return next;
    });
  };

  const addSpecialTaxItem = () => {
    setSpecialTaxItems((prev) => [
      ...prev,
      { itemName: "", unit: "", revenue: 0, taxRate: 0, taxAmount: 0 },
    ]);
  };

  const removeSpecialTaxItem = (index: number) => {
    setSpecialTaxItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSpecialTaxItem = (
    index: number,
    field: keyof SpecialTaxItem,
    value: any
  ) => {
    setSpecialTaxItems((prev) => {
      const next = [...prev];
      (next[index] as any)[field] =
        field === "itemName" || field === "unit" ? value : Number(value || 0);
      if (field === "revenue" || field === "taxRate") {
        const rev = Number(next[index].revenue || 0);
        const rate = Number(next[index].taxRate || 0);
        next[index].taxAmount = (rev * rate) / 100;
      }
      return next;
    });
  };

  const addEnvTaxItem = () => {
    setEnvTaxItems((prev) => [
      ...prev,
      {
        type: "environmentaltax",
        itemName: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        taxRate: 0,
        taxAmount: 0,
      },
    ]);
  };

  const removeEnvTaxItem = (index: number) => {
    setEnvTaxItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEnvTaxItem = (
    index: number,
    field: keyof EnvTaxItem,
    value: any
  ) => {
    setEnvTaxItems((prev) => {
      const next = [...prev];
      (next[index] as any)[field] =
        field === "itemName" || field === "unit" || field === "type"
          ? value
          : Number(value || 0);

      if (
        field === "quantity" ||
        field === "unitPrice" ||
        field === "taxRate"
      ) {
        const q = Number(next[index].quantity || 0);
        const p = Number(next[index].unitPrice || 0);
        const r = Number(next[index].taxRate || 0);
        next[index].taxAmount = (q * p * r) / 100;
      }
      return next;
    });
  };

  // ===================== UI HELPERS =====================
  const totalCategoryRevenue = useMemo(
    () => categoryRevenues.reduce((s, c) => s + Number(c.revenue || 0), 0),
    [categoryRevenues]
  );

  const canEditRecord = (r: TaxDeclarationRecord) =>
    ["draft", "saved"].includes(r.status);
  const canApprove = (r: TaxDeclarationRecord) =>
    r.status === "submitted" && user?.role === "MANAGER";
  const canDelete = (r: TaxDeclarationRecord) =>
    ["draft", "saved"].includes(r.status);

  const openDetail = async (id: string) => {
    setLoading(true);
    try {
      const d = await fetchDeclarationById(id);
      if (!d) {
        Alert.alert("Không tìm thấy", "Không tìm thấy tờ khai");
        return;
      }
      setSelectedRecord(d);
      setDetailVisible(true);
    } catch (e: any) {
      console.error(
        "❌ openDetail error:",
        e?.response?.data || e?.message || e
      );
      Alert.alert(
        "Lỗi",
        e?.response?.data?.message || e?.message || "Không thể tải chi tiết"
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeclarations();
  };

  // ===================== RENDER SMALL COMPONENTS =====================

  // ===================== RENDER: missing store/token =====================
  if (!storeId || !token) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          Vui lòng đăng nhập và chọn cửa hàng
        </Text>
        <Text style={styles.emptySub}>
          Cần token + currentStore để kê khai thuế.
        </Text>
      </View>
    );
  }

  // ===================== MAIN RENDER =====================
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {currentStore?.name || "Cửa hàng"}
          </Text>
          <Text style={styles.headerSub}>
            Kê khai thuế •{" "}
            {currentStore?.taxCode
              ? `MST: ${currentStore.taxCode}`
              : "Chưa có MST"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={fetchDeclarations}
          disabled={loading}
          style={[styles.headerBtn, loading && styles.btnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.headerBtnText}>Tải lại</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Step info */}
        <View style={styles.card}>
          <Text style={styles.stepText}>
            Bước: <Text style={{ fontWeight: "800" }}>{currentStep + 1}/5</Text>
          </Text>
          <Text style={styles.stepHint}>
            0-Chọn kỳ • 1-Xem doanh thu • 2-Thông tin người nộp • 3-Kê khai •
            4-Xác nhận
          </Text>
        </View>

        {/* Period selector */}
        <View style={styles.card}>
          <SectionTitle title="1) Chọn kỳ kê khai" />

          <View style={styles.row}>
            {PERIOD_TYPES.map((t) => {
              const active = periodType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => {
                    setPeriodType(t.value);
                    setSystemRevenue(null);
                    setOrderCount(0);
                    setCurrentStep(0);
                    // khi đổi kỳ, giữ lại form nhưng reset preview
                  }}
                >
                  <Text
                    style={[styles.pillText, active && styles.pillTextActive]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!periodType ? (
            <Text style={styles.helperText}>
              Chọn loại kỳ kê khai để nhập thời gian.
            </Text>
          ) : (
            <>
              {/* THÁNG */}
              {periodType === "month" && (
                <TouchableOpacity
                  onPress={openPeriodPicker}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>
                    Tháng: {dayjs(monthKey, "YYYY-MM").format("MM/YYYY")}
                  </Text>
                </TouchableOpacity>
              )}

              {/* QUÝ */}
              {periodType === "quarter" && (
                <TouchableOpacity
                  onPress={openPeriodPicker}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Quý: {quarterKey}</Text>
                </TouchableOpacity>
              )}

              {/* NĂM */}
              {periodType === "year" && (
                <TouchableOpacity
                  onPress={openPeriodPicker}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Năm: {yearKey}</Text>
                </TouchableOpacity>
              )}

              {/* CUSTOM */}
              {periodType === "custom" && (
                <>
                  <TouchableOpacity
                    onPress={() => openCustomPicker("from")}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>
                      Từ tháng: {dayjs(monthFrom, "YYYY-MM").format("MM/YYYY")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openCustomPicker("to")}
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>
                      Đến tháng: {dayjs(monthTo, "YYYY-MM").format("MM/YYYY")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* CHỈ 1 DateTimePicker DUY NHẤT */}
              {showPicker && (
                <View style={{ marginTop: 8 }}>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onChangePicker}
                    locale="vi-VN"
                  />

                  {/* iOS spinner: thêm nút đóng để người dùng cuộn chọn xong rồi bấm Xong */}
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      onPress={closePicker}
                      style={styles.smallBtn}
                    >
                      <Text style={styles.smallBtnText}>Xong</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={fetchPreview}
                  disabled={loading || !hasValidPeriod}
                  style={[
                    styles.primaryBtn,
                    (loading || !hasValidPeriod) && styles.btnDisabled,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Xem doanh thu hệ thống
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={resetForm}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>
                    {isEditing ? "Hủy chỉnh sửa" : "Làm mới"}
                  </Text>
                </TouchableOpacity>
              </View>

              {!!periodKey && (
                <View
                  style={{
                    marginTop: 10,
                    flexDirection: "row",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Chip text={`Kỳ: ${periodKey}`} color="#2563eb" />
                  {systemRevenue !== null && (
                    <Chip
                      text={`Doanh thu: ${formatVND(systemRevenue)}`}
                      color="#10b981"
                    />
                  )}
                  {systemRevenue !== null && (
                    <Chip text={`Đơn: ${orderCount}`} color="#f59e0b" />
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Form (only after preview) */}
        {systemRevenue !== null && (
          <>
            {/* Taxpayer info */}
            <View style={styles.card}>
              <SectionTitle title="2) Thông tin người nộp thuế" />
              <Field
                label="Người nộp thuế"
                value={taxpayerName}
                onChangeText={setTaxpayerName}
                placeholder="Họ tên"
              />
              <Field
                label="Tên cửa hàng/Thương hiệu"
                value={storeName}
                onChangeText={setStoreName}
                placeholder="Tên cửa hàng"
              />
              <Field
                label="Mã số thuế"
                value={taxCode}
                onChangeText={setTaxCode}
                placeholder="10-13 chữ số"
                keyboardType="number-pad"
              />
              <Field
                label="Tài khoản ngân hàng"
                value={bankAccount}
                onChangeText={setBankAccount}
                placeholder="Số tài khoản"
              />
              <Field
                label="Ngành nghề kinh doanh"
                value={businessSector}
                onChangeText={setBusinessSector}
                placeholder="VD: Bán lẻ..."
              />
              <Field
                label="Diện tích kinh doanh (m²)"
                value={businessAreaText}
                onChangeText={setBusinessAreaText}
                placeholder="0"
                keyboardType="number-pad"
              />
              <Field
                label="Số lao động"
                value={employeeCountText}
                onChangeText={setEmployeeCountText}
                placeholder="0"
                keyboardType="number-pad"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Giờ mở (HH:mm)"
                    value={workingHoursFrom}
                    onChangeText={setWorkingHoursFrom}
                    placeholder="08:00"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Giờ đóng (HH:mm)"
                    value={workingHoursTo}
                    onChangeText={setWorkingHoursTo}
                    placeholder="22:00"
                  />
                </View>
              </View>
              <Field
                label="Địa chỉ kinh doanh"
                value={businessAddressFull}
                onChangeText={setBusinessAddressFull}
                placeholder="Địa chỉ"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Điện thoại"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="SĐT"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <TouchableOpacity
                  onPress={() => setIsRented((p) => !p)}
                  style={styles.toggleBtn}
                >
                  <Text style={styles.toggleText}>
                    {isRented ? "✓ Có thuê mặt bằng" : "Thuê mặt bằng"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Part A */}
            <View style={styles.card}>
              <SectionTitle title="3) Thu GTGT & TNCN" />
              <Field
                label="Doanh thu kê khai"
                value={declaredRevenueText}
                onChangeText={setDeclaredRevenueText}
                placeholder="Nhập doanh thu"
                keyboardType="number-pad"
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Thu suất GTGT (%)"
                    value={gtgtRateText}
                    onChangeText={setGtgtRateText}
                    placeholder="1.0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Thu suất TNCN (%)"
                    value={tncnRateText}
                    onChangeText={setTncnRateText}
                    placeholder="0.5"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={useSystemRevenue}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>
                    Dùng doanh thu hệ thống
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Kết quả tính</Text>
                <Text style={styles.summaryLine}>
                  GTGT: {formatVND(calculatedTax.gtgt)}
                </Text>
                <Text style={styles.summaryLine}>
                  TNCN: {formatVND(calculatedTax.tncn)}
                </Text>
                <Text style={styles.summaryTotal}>
                  Tổng: {formatVND(calculatedTax.total)}
                </Text>
              </View>

              <View style={styles.hr} />
              <Text style={styles.subTitle}>
                Doanh thu theo nhóm ngành nghề (tùy chọn)
              </Text>

              <TouchableOpacity
                onPress={addCategoryRevenue}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>+ Thêm ngành nghề</Text>
              </TouchableOpacity>

              {categoryRevenues.length === 0 ? (
                <Text style={styles.helperText}>
                  Chưa có ngành nghề. Có thể bỏ qua nếu không cần phân loại.
                </Text>
              ) : (
                categoryRevenues.map((c, idx) => (
                  <View key={idx} style={styles.itemCard}>
                    <Text style={styles.label}>Ngành nghề</Text>
                    <View style={styles.rowWrap}>
                      {Object.keys(CATEGORY_MAP).map((k) => {
                        const key = k as keyof typeof CATEGORY_MAP;
                        const active = c.category === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() =>
                              updateCategoryRevenue(idx, "category", key)
                            }
                            style={[
                              styles.miniPill,
                              active && styles.miniPillActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.miniPillText,
                                active && styles.miniPillTextActive,
                              ]}
                            >
                              {CATEGORY_MAP[key].code}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Doanh thu"
                          value={String(c.revenue ?? 0)}
                          onChangeText={(t) =>
                            updateCategoryRevenue(
                              idx,
                              "revenue",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Thu GTGT"
                          value={String(c.gtgtTax ?? 0)}
                          onChangeText={(t) =>
                            updateCategoryRevenue(
                              idx,
                              "gtgtTax",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Thu TNCN"
                          value={String(c.tncnTax ?? 0)}
                          onChangeText={(t) =>
                            updateCategoryRevenue(
                              idx,
                              "tncnTax",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <TouchableOpacity
                          onPress={() => removeCategoryRevenue(idx)}
                          style={[styles.dangerBtn, { marginTop: 22 }]}
                        >
                          <Text style={styles.dangerBtnText}>Xóa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}

              {categoryRevenues.length > 0 && (
                <Text style={styles.helperText}>
                  Tổng doanh thu theo ngành nghề:{" "}
                  {formatVND(totalCategoryRevenue)} (so với kê khai:{" "}
                  {formatVND(parseNumberInput(declaredRevenueText))})
                </Text>
              )}
            </View>

            {/* Part B */}
            <View style={styles.card}>
              <SectionTitle title="4) Thu tiêu thụ đặc biệt (nếu có)" />
              <TouchableOpacity
                onPress={addSpecialTaxItem}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>+ Thêm mặt hàng</Text>
              </TouchableOpacity>

              {specialTaxItems.length === 0 ? (
                <Text style={styles.helperText}>
                  Không có mặt hàng chịu thuế TTĐB có thể bỏ qua.
                </Text>
              ) : (
                specialTaxItems.map((it, idx) => (
                  <View key={idx} style={styles.itemCard}>
                    <Field
                      label="Tên hàng hóa/dịch vụ"
                      value={it.itemName}
                      onChangeText={(t) =>
                        updateSpecialTaxItem(idx, "itemName", t)
                      }
                    />
                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Đơn vị"
                          value={it.unit}
                          onChangeText={(t) =>
                            updateSpecialTaxItem(idx, "unit", t)
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Doanh thu"
                          value={String(it.revenue)}
                          onChangeText={(t) =>
                            updateSpecialTaxItem(
                              idx,
                              "revenue",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Thu suất (%)"
                          value={String(it.taxRate)}
                          onChangeText={(t) =>
                            updateSpecialTaxItem(
                              idx,
                              "taxRate",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Số thuế</Text>
                        <View style={styles.readonlyBox}>
                          <Text style={styles.readonlyText}>
                            {formatVND(it.taxAmount)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => removeSpecialTaxItem(idx)}
                      style={styles.dangerBtn}
                    >
                      <Text style={styles.dangerBtnText}>Xóa mặt hàng</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Part C */}
            <View style={styles.card}>
              <SectionTitle title="5) Thu/Phí môi trường (nếu có)" />
              <TouchableOpacity
                onPress={addEnvTaxItem}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>+ Thêm mục</Text>
              </TouchableOpacity>

              {envTaxItems.length === 0 ? (
                <Text style={styles.helperText}>
                  Không có mục môi trường có thể bỏ qua.
                </Text>
              ) : (
                envTaxItems.map((it, idx) => (
                  <View key={idx} style={styles.itemCard}>
                    <Text style={styles.label}>Loại</Text>
                    <View style={styles.row}>
                      {[
                        { v: "resource", t: "Thu tài nguyên" },
                        { v: "environmentaltax", t: "Thu BVMT" },
                        { v: "environmentalfee", t: "Phí BVMT" },
                      ].map((opt) => {
                        const active = it.type === (opt.v as any);
                        return (
                          <TouchableOpacity
                            key={opt.v}
                            onPress={() => updateEnvTaxItem(idx, "type", opt.v)}
                            style={[styles.pill, active && styles.pillActive]}
                          >
                            <Text
                              style={[
                                styles.pillText,
                                active && styles.pillTextActive,
                              ]}
                            >
                              {opt.t}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Field
                      label="Tên"
                      value={it.itemName}
                      onChangeText={(t) => updateEnvTaxItem(idx, "itemName", t)}
                    />
                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Đơn vị"
                          value={it.unit}
                          onChangeText={(t) => updateEnvTaxItem(idx, "unit", t)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Số lượng"
                          value={String(it.quantity)}
                          onChangeText={(t) =>
                            updateEnvTaxItem(
                              idx,
                              "quantity",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.row2}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Đơn giá"
                          value={String(it.unitPrice)}
                          onChangeText={(t) =>
                            updateEnvTaxItem(
                              idx,
                              "unitPrice",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Thu suất (%)"
                          value={String(it.taxRate)}
                          onChangeText={(t) =>
                            updateEnvTaxItem(
                              idx,
                              "taxRate",
                              parseNumberInput(t)
                            )
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <Text style={styles.helperText}>
                      Số thuế: {formatVND(it.taxAmount)}
                    </Text>

                    <TouchableOpacity
                      onPress={() => removeEnvTaxItem(idx)}
                      style={styles.dangerBtn}
                    >
                      <Text style={styles.dangerBtnText}>Xóa mục</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {/* Notes + submit */}
            <View style={styles.card}>
              <SectionTitle title="Ghi chú & lưu/nộp" />
              <Field
                label="Ghi chú"
                value={notes}
                onChangeText={setNotes}
                placeholder="Ghi chú bổ sung..."
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Bổ sung lần thứ"
                    value={supplementNumberText}
                    onChangeText={setSupplementNumberText}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => setIsFirstTime((p) => !p)}
                    style={[styles.toggleBtn, { marginTop: 22 }]}
                  >
                    <Text style={styles.toggleText}>
                      {isFirstTime ? "✓ Lần đầu kê khai" : "Lần đầu kê khai"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => submitDeclaration("saved")}
                  disabled={submitLoading}
                  style={[
                    styles.primaryBtn,
                    submitLoading && styles.btnDisabled,
                  ]}
                >
                  {submitLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {isEditing ? "Cập nhật tờ khai" : "Lưu tờ khai"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => submitDeclaration("submitted")}
                  disabled={submitLoading}
                  style={[
                    styles.dangerBtn,
                    submitLoading && styles.btnDisabled,
                  ]}
                >
                  {submitLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerBtnText}>Nộp tờ khai</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* History list */}
        <View style={styles.card}>
          <SectionTitle title="Lịch sử tờ khai" />
          <Text style={styles.helperText}>
            Đang hiển thị {declarations.length}/{totalCount} tờ khai (trang{" "}
            {page})
          </Text>

          {declarations.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Chưa có tờ khai</Text>
              <Text style={styles.emptySub}>
                Bấm “Xem doanh thu hệ thống” để bắt đầu kê khai.
              </Text>
            </View>
          ) : (
            <FlatList
              data={declarations}
              keyExtractor={(it) => it.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              renderItem={({ item }) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                return (
                  <View style={styles.listItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>
                          Kỳ: {item.periodKey}
                        </Text>
                        <Text style={styles.listSub}>
                          Doanh thu:{" "}
                          {formatVND(Number(item.declaredRevenue || 0))}
                        </Text>
                        <Text style={styles.listSub}>
                          Tổng thuế:{" "}
                          {formatVND(Number(item.taxAmounts?.total || 0))}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Chip text={cfg.text} color={cfg.color} />
                        <Text style={styles.listTime}>
                          {item.createdAt
                            ? dayjs(item.createdAt).format("DD/MM/YYYY")
                            : ""}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionRowWrap}>
                      <TouchableOpacity
                        onPress={() => {
                          setExportTargetId(item.id);
                          openDetail(item.id);
                        }}
                        style={styles.smallBtn}
                      >
                        <Text style={styles.smallBtnText}>Chi tiết</Text>
                      </TouchableOpacity>

                      {canEditRecord(item) && (
                        <TouchableOpacity
                          onPress={() => loadForEdit(item.id)}
                          style={styles.smallBtn}
                        >
                          <Text style={styles.smallBtnText}>Sửa</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleClone(item.id)}
                        style={styles.smallBtn}
                      >
                        <Text style={styles.smallBtnText}>Nhân bản</Text>
                      </TouchableOpacity>

                      {canApprove(item) && (
                        <>
                          <TouchableOpacity
                            onPress={() => showApproveConfirm(item.id)}
                            style={styles.smallBtnSuccess}
                          >
                            <Text style={styles.smallBtnTextWhite}>Duyệt</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => showRejectModal(item.id)}
                            style={styles.smallBtnDanger}
                          >
                            <Text style={styles.smallBtnTextWhite}>
                              Từ chối
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {canDelete(item) && (
                        <TouchableOpacity
                          onPress={() => handleDelete(item.id)}
                          style={styles.smallBtnDanger}
                        >
                          <Text style={styles.smallBtnTextWhite}>Xóa</Text>
                        </TouchableOpacity>
                      )}

                      {/* Export placeholder */}
                      {/* Export */}
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert("Xuất file", "Chọn định dạng", [
                            { text: "Hủy", style: "cancel" },
                            {
                              text: "Xuất CSV",
                              onPress: () => handleExport(item.id, "csv"),
                            },
                            {
                              text: "Xuất PDF",
                              onPress: () => handleExport(item.id, "pdf"),
                            },
                          ]);
                        }}
                        style={styles.smallBtn}
                      >
                        <Text style={styles.smallBtnText}>Xuất file</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={styles.paginationRow}>
            <TouchableOpacity
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={[styles.secondaryBtn, page <= 1 && styles.btnDisabled]}
            >
              <Text style={styles.secondaryBtnText}>Trang trước</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPage((p) => p + 1)}
              disabled={declarations.length < pageSize}
              style={[
                styles.secondaryBtn,
                declarations.length < pageSize && styles.btnDisabled,
              ]}
            >
              <Text style={styles.secondaryBtnText}>Trang sau</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chi tiết tờ khai</Text>
            <TouchableOpacity
              onPress={() => setDetailVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          >
            {!selectedRecord ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.listTitle}>
                    Kỳ: {selectedRecord.periodKey}
                  </Text>
                  <Text style={styles.listSub}>
                    Trạng thái:{" "}
                    {STATUS_CONFIG[selectedRecord.status]?.text ||
                      selectedRecord.status}
                  </Text>
                  <Text style={styles.listSub}>
                    Doanh thu kê khai:{" "}
                    {formatVND(Number(selectedRecord.declaredRevenue || 0))}
                  </Text>
                  <Text style={styles.listSub}>
                    Thu GTGT:{" "}
                    {formatVND(Number(selectedRecord.taxAmounts?.gtgt || 0))}
                  </Text>
                  <Text style={styles.listSub}>
                    Thu TNCN:{" "}
                    {formatVND(Number(selectedRecord.taxAmounts?.tncn || 0))}
                  </Text>
                  <Text style={[styles.listSub, { fontWeight: "800" }]}>
                    Tổng thu:{" "}
                    {formatVND(Number(selectedRecord.taxAmounts?.total || 0))}
                  </Text>

                  {!!selectedRecord.rejectionReason && (
                    <Text style={[styles.listSub, { color: "#ef4444" }]}>
                      Lý do từ chối: {selectedRecord.rejectionReason}
                    </Text>
                  )}
                </View>

                {selectedRecord.taxpayerInfo && (
                  <View style={styles.card}>
                    <SectionTitle title="Thông tin người nộp thuế" />
                    <Text style={styles.listSub}>
                      Người nộp thuế: {selectedRecord.taxpayerInfo.name || ""}
                    </Text>
                    <Text style={styles.listSub}>
                      Cửa hàng: {selectedRecord.taxpayerInfo.storeName || ""}
                    </Text>
                    <Text style={styles.listSub}>
                      MST: {selectedRecord.taxpayerInfo.taxCode || ""}
                    </Text>
                    <Text style={styles.listSub}>
                      SĐT: {selectedRecord.taxpayerInfo.phone || ""}
                    </Text>
                    <Text style={styles.listSub}>
                      Email: {selectedRecord.taxpayerInfo.email || ""}
                    </Text>
                    <Text style={styles.listSub}>
                      Địa chỉ:{" "}
                      {selectedRecord.taxpayerInfo.businessAddress?.full || ""}
                    </Text>
                  </View>
                )}

                {!!selectedRecord.revenueByCategory?.length && (
                  <View style={styles.card}>
                    <SectionTitle title="Doanh thu theo ngành nghề" />
                    {selectedRecord.revenueByCategory.map((r, idx) => (
                      <View key={idx} style={styles.simpleRow}>
                        <Text style={{ flex: 1, color: "#111827" }}>
                          {r.category}
                        </Text>
                        <Text
                          style={{
                            width: 130,
                            textAlign: "right",
                            color: "#111827",
                          }}
                        >
                          {formatVND(Number(r.revenue || 0))}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!selectedRecord.specialConsumptionTax?.length && (
                  <View style={styles.card}>
                    <SectionTitle title="Thu TTĐB" />
                    {selectedRecord.specialConsumptionTax.map((r, idx) => (
                      <View key={idx} style={styles.simpleRow}>
                        <Text style={{ flex: 1, color: "#111827" }}>
                          {r.itemName}
                        </Text>
                        <Text
                          style={{
                            width: 130,
                            textAlign: "right",
                            color: "#111827",
                          }}
                        >
                          {formatVND(Number(r.taxAmount || 0))}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!selectedRecord.environmentalTax?.length && (
                  <View style={styles.card}>
                    <SectionTitle title="Thu/Phí môi trường" />
                    {selectedRecord.environmentalTax.map((r, idx) => (
                      <View key={idx} style={styles.simpleRow}>
                        <Text style={{ flex: 1, color: "#111827" }}>
                          {r.itemName}
                        </Text>
                        <Text
                          style={{
                            width: 130,
                            textAlign: "right",
                            color: "#111827",
                          }}
                        >
                          {formatVND(Number(r.taxAmount || 0))}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {!!selectedRecord.notes && (
                  <View style={styles.card}>
                    <SectionTitle title="Ghi chú" />
                    <Text style={styles.listSub}>{selectedRecord.notes}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={rejectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle2}>Từ chối tờ khai</Text>
            <Text style={styles.helperText}>Nhập lý do từ chối:</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Lý do..."
              placeholderTextColor="#9ca3af"
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              multiline
            />

            <View style={styles.row2}>
              <TouchableOpacity
                onPress={() => {
                  setRejectVisible(false);
                  setRejectReason("");
                  setSelectedActionId(null);
                }}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!selectedActionId) return;
                  if (!rejectReason.trim()) {
                    Alert.alert(
                      "Thiếu thông tin",
                      "Vui lòng nhập lý do từ chối"
                    );
                    return;
                  }
                  handleApproveReject(
                    selectedActionId,
                    "reject",
                    rejectReason.trim()
                  );
                }}
                style={styles.dangerBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerBtnText}>Từ chối</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===================== STYLES =====================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  container: { flex: 1 },

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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyBox: { paddingVertical: 30, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  emptySub: { marginTop: 6, color: "#6b7280", textAlign: "center" },

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
  subTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
    marginTop: 8,
    marginBottom: 8,
  },

  stepText: { fontSize: 14, color: "#111827", fontWeight: "700" },
  stepHint: { marginTop: 6, color: "#6b7280", fontSize: 12 },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  row2: { flexDirection: "row", gap: 10 },
  toggleRow: { flexDirection: "row", gap: 10, marginTop: 8 },

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

  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  miniPillActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  miniPillText: { fontSize: 12, fontWeight: "800", color: "#374151" },
  miniPillTextActive: { color: "#10b981" },

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
  helperText: { marginTop: 8, color: "#6b7280", fontSize: 12, lineHeight: 16 },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    alignItems: "center",
  },
  actionRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

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

  dangerBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: "#fff", fontWeight: "900" },

  btnDisabled: { opacity: 0.6 },

  summaryBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryTitle: { fontWeight: "900", color: "#111827", marginBottom: 6 },
  summaryLine: { color: "#374151", marginBottom: 2 },
  summaryTotal: { marginTop: 6, color: "#111827", fontWeight: "900" },

  hr: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },

  itemCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },

  readonlyBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readonlyText: { color: "#111827", fontWeight: "900" },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "800" },

  toggleBtn: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  toggleText: { color: "#111827", fontWeight: "800" },

  listItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  listSub: { fontSize: 13, color: "#6b7280", marginBottom: 2 },
  listTime: { fontSize: 11, color: "#9ca3af", marginTop: 6 },

  smallBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  smallBtnText: { fontSize: 12, fontWeight: "800", color: "#111827" },

  smallBtnSuccess: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#10b981",
  },
  smallBtnDanger: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#ef4444",
  },
  smallBtnTextWhite: { fontSize: 12, fontWeight: "800", color: "#fff" },

  paginationRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "center",
  },

  modalRoot: { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader: {
    backgroundColor: "#111827",
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  modalCloseBtn: {
    backgroundColor: "#374151",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalCloseText: { color: "#fff", fontWeight: "800" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle2: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },

  simpleRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
  },
});
