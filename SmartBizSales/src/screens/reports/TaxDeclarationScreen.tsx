// src/screens/tax/TaxDeclarationScreen.tsx
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";

import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient";
import { fileService } from "../../services/fileService";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

const { width } = Dimensions.get("window");

// ==================== TYPES ====================

type PeriodType = "month" | "quarter" | "year" | "custom";

type TaxStatus = "draft" | "saved" | "submitted" | "approved" | "rejected";

interface TaxpayerInfo {
  name: string;
  storeName: string;
  taxCode: string;
  phone: string;
  email: string;
  businessSector?: string;
  businessArea?: number;
  isRented?: boolean;
  employeeCount?: number;
  workingHours?: {
    from: string;
    to: string;
  };
  businessAddress: {
    full: string;
    street?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  bankAccount?: string;
}

interface CategoryRevenue {
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

type EnvTaxType = "resource" | "environmental_tax" | "environmental_fee";

interface EnvTaxItem {
  type: EnvTaxType;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
}

interface TaxAmounts {
  gtgt: number;
  tncn: number;
  total: number;
}

interface TaxDeclaration {
  _id: string;
  storeId: string;
  periodType: PeriodType;
  periodKey: string;
  declaredRevenue: number;
  taxRates: {
    gtgt: number;
    tncn: number;
  };
  taxAmounts: TaxAmounts;
  status: TaxStatus;
  version: number;
  isClone: boolean;
  isFirstTime: boolean;
  supplementNumber: number;
  taxpayerInfo?: TaxpayerInfo;
  revenueByCategory?: CategoryRevenue[];
  specialConsumptionTax?: SpecialTaxItem[];
  environmentalTax?: EnvTaxItem[];
  notes?: string;
  createdAt: string;
  createdBy?: {
    fullName?: string;
    email?: string;
  };
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: {
    fullName?: string;
  };
  rejectionReason?: string;
}

interface Pagination {
  current: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface DeclarationsApiResponse {
  data: TaxDeclaration[];
  pagination: Pagination;
}

interface PreviewApiResponse {
  systemRevenue: number;
  orderCount: number;
}

// ==================== CONSTANTS ====================

const PERIOD_TYPES = [
  { value: "month", label: "📅 Tháng" },
  { value: "quarter", label: "📊 Quý" },
  { value: "year", label: "📈 Năm" },
  { value: "custom", label: "⚙️ Tùy chỉnh" },
] as const;

const TAX_RATES = {
  DEFAULT_GTGT: 1.0,
  DEFAULT_TNCN: 0.5,
  MAX_GTGT: 10,
  MAX_TNCN: 5,
};

const STATUS_CONFIG: Record<
  TaxStatus,
  { text: string; color: string; bg: string }
> = {
  draft: { text: "Nháp", color: "#595959", bg: "#f5f5f5" },
  saved: { text: "Đã lưu", color: "#1890ff", bg: "#e6f7ff" },
  submitted: { text: "Đã nộp", color: "#faad14", bg: "#fff7e6" },
  approved: { text: "Đã duyệt", color: "#52c41a", bg: "#f6ffed" },
  rejected: { text: "Từ chối", color: "#ff4d4f", bg: "#fff1f0" },
};

const CATEGORY_MAP = {
  goods_distribution: { code: "[28]", name: "Phân phối, cung cấp hàng hóa" },
  service_construction: {
    code: "[29]",
    name: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu",
  },
  manufacturing_transport: {
    code: "[30]",
    name: "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa",
  },
  other_business: { code: "[31]", name: "Hoạt động kinh doanh khác" },
} as const;

const ENV_TAX_TYPES: { value: EnvTaxType; label: string }[] = [
  { value: "resource", label: "[34] Thuế tài nguyên" },
  { value: "environmental_tax", label: "[35] Thuế BVMT" },
  { value: "environmental_fee", label: "[36] Phí BVMT" },
];

// ==================== HELPERS ====================

const formatVND = (value?: number | string | null): string => {
  if (value === undefined || value === null) return "₫0";
  const num = Number(value);
  if (Number.isNaN(num)) return "₫0";
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num}`;
  }
};

// ==================== MAIN SCREEN ====================

const TaxDeclarationScreen: FC = () => {
  const { currentStore, token } = useAuth();
  const storeId = currentStore?._id;
  const storeName = currentStore?.name || "Chưa chọn cửa hàng";

  const isMountedRef = useRef(true);

  // Trong TaxDeclarationScreen component
  const [editingId, setEditingId] = useState<string | null>(null);

  // Loading & list
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filter & preview
  const [periodType, setPeriodType] = useState<PeriodType | "">("");
  const [periodKey, setPeriodKey] = useState("");
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");
  const [systemRevenue, setSystemRevenue] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState(0);

  // Form: phần A
  const [declaredRevenue, setDeclaredRevenue] = useState("");
  const [gtgtRate, setGtgtRate] = useState(TAX_RATES.DEFAULT_GTGT.toString());
  const [tncnRate, setTncnRate] = useState(TAX_RATES.DEFAULT_TNCN.toString());
  const [calculatedTax, setCalculatedTax] = useState<TaxAmounts | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [supplementNumber, setSupplementNumber] = useState("0");

  // Phần B/C/A chi tiết
  const [categoryRevenues, setCategoryRevenues] = useState<CategoryRevenue[]>(
    []
  );
  const [specialTaxItems, setSpecialTaxItems] = useState<SpecialTaxItem[]>([]);
  const [envTaxItems, setEnvTaxItems] = useState<EnvTaxItem[]>([]);

  // Người nộp thuế & ghi chú
  const [taxpayerName, setTaxpayerName] = useState(
    currentStore?.owner_name || ""
  );
  const [storeDisplayName, setStoreDisplayName] = useState(
    currentStore?.name || ""
  );
  const [bankAccount, setBankAccount] = useState(
    typeof currentStore?.bankAccount === "string"
      ? currentStore.bankAccount
      : currentStore?.bankAccount?.accountNumber || ""
  );
  const [taxCode, setTaxCode] = useState(currentStore?.taxCode || "");
  const [businessSector, setBusinessSector] = useState(
    currentStore?.businessSector || ""
  );
  const [businessArea, setBusinessArea] = useState(
    currentStore?.area?.toString() || ""
  );
  const [isRented, setIsRented] = useState(false);
  const [employeeCount, setEmployeeCount] = useState("");
  const [workingHoursFrom, setWorkingHoursFrom] = useState("08:00");
  const [workingHoursTo, setWorkingHoursTo] = useState("22:00");
  const [businessAddress, setBusinessAddress] = useState(
    currentStore?.address || ""
  );
  const [phone, setPhone] = useState(currentStore?.phone || "");
  const [email, setEmail] = useState(currentStore?.email || "");
  const [notes, setNotes] = useState("");

  // Modal & pagination
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TaxDeclaration | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Expandable sections
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    taxpayerInfo: true,
    taxDetails: true,
    categoryRevenue: false,
    specialTax: false,
    envTax: false,
    notes: false,
  });

  // ==================== EFFECTS ====================

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (storeId && token) {
      fetchDeclarations();
    }
  }, [storeId, token, currentPage]);

  // ==================== MEMO ====================

  const hasValidPeriod = useMemo(() => {
    if (!periodType) return false;
    if (periodType === "custom") return !!monthFrom && !!monthTo;
    return !!periodKey;
  }, [periodType, periodKey, monthFrom, monthTo]);

  const periodDisplay = useMemo(() => {
    if (periodType === "custom" && monthFrom && monthTo) {
      return `${dayjs(monthFrom).format("MM/YYYY")} - ${dayjs(monthTo).format(
        "MM/YYYY"
      )}`;
    }
    return periodKey || "Chưa chọn";
  }, [periodType, periodKey, monthFrom, monthTo]);

  const totalDeclaredRevenue = useMemo(
    () =>
      categoryRevenues.reduce((sum, c) => sum + (Number(c.revenue) || 0), 0),
    [categoryRevenues]
  );

  const totalSpecialTax = useMemo(
    () =>
      specialTaxItems.reduce((sum, i) => sum + (Number(i.taxAmount) || 0), 0),
    [specialTaxItems]
  );

  const totalEnvTax = useMemo(
    () => envTaxItems.reduce((sum, i) => sum + (Number(i.taxAmount) || 0), 0),
    [envTaxItems]
  );

  // ==================== API CALLS ====================

  const fetchDeclarations = useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const res = await apiClient.get<DeclarationsApiResponse>("/taxs", {
        params: {
          storeId,
          page: currentPage,
          limit: pageSize,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!isMountedRef.current) return;
      setDeclarations(res.data.data || []);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const msg =
        error?.response?.data?.message || "Không thể tải danh sách tờ khai";
      Alert.alert("Lỗi", msg);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [storeId, token, currentPage]);

  const fetchPreview = useCallback(async () => {
    if (!storeId) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn cửa hàng trước");
      return;
    }
    if (!periodType) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn loại kỳ kê khai");
      return;
    }
    if (!hasValidPeriod) {
      Alert.alert(
        "Thiếu thông tin",
        "Vui lòng nhập đầy đủ kỳ kê khai (tháng/quý/năm hoặc khoảng thời gian)"
      );
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        storeId,
        periodType,
      };

      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      } else {
        params.periodKey = periodKey;
      }

      const res = await apiClient.get<PreviewApiResponse>("/taxs/preview", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!isMountedRef.current) return;

      const revenue = res.data.systemRevenue || 0;
      const count = res.data.orderCount || 0;
      setSystemRevenue(revenue);
      setOrderCount(count);
      setDeclaredRevenue(revenue.toString());

      Alert.alert(
        "Đã tải doanh thu",
        `Doanh thu hệ thống: ${formatVND(
          revenue
        )}\nTổng ${count} đơn hàng trong kỳ`
      );
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const msg =
        error?.response?.data?.message || "Không thể tải doanh thu hệ thống";
      Alert.alert("Lỗi", msg);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    storeId,
    periodType,
    periodKey,
    monthFrom,
    monthTo,
    hasValidPeriod,
    token,
  ]);

  const submitDeclaration = useCallback(async () => {
    if (!storeId || !periodType || !hasValidPeriod) {
      Alert.alert(
        "Thiếu thông tin",
        "Vui lòng chọn cửa hàng và kỳ kê khai hợp lệ"
      );
      return;
    }

    const declared = Number(declaredRevenue) || 0;
    if (declared <= 0) {
      Alert.alert("Thiếu thông tin", "Doanh thu kê khai phải lớn hơn 0");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        storeId,
        periodType,
        declaredRevenue: declared,
        taxRates: {
          gtgt: Number(gtgtRate) || TAX_RATES.DEFAULT_GTGT,
          tncn: Number(tncnRate) || TAX_RATES.DEFAULT_TNCN,
        },
        isFirstTime,
        supplementNumber: Number(supplementNumber) || 0,
        revenueByCategory: categoryRevenues.map((c) => ({
          category: c.category,
          revenue: c.revenue || 0,
          gtgtTax: c.gtgtTax || 0,
          tncnTax: c.tncnTax || 0,
        })),
        specialConsumptionTax: specialTaxItems.map((i) => ({
          itemName: i.itemName || "",
          unit: i.unit || "",
          revenue: i.revenue || 0,
          taxRate: i.taxRate || 0,
          taxAmount: i.taxAmount || 0,
        })),
        environmentalTax: envTaxItems.map((i) => ({
          type: i.type || "environmental_tax",
          itemName: i.itemName || "",
          unit: i.unit || "",
          quantity: i.quantity || 0,
          unitPrice: i.unitPrice || 0,
          taxRate: i.taxRate || 0,
          taxAmount: i.taxAmount || 0,
        })),
        notes,
        taxpayerInfo: {
          name: taxpayerName || currentStore?.owner_name || "",
          storeName: storeDisplayName || currentStore?.name || "",
          bankAccount: bankAccount || currentStore?.bankAccount || "",
          taxCode: taxCode || currentStore?.taxCode || "",
          businessSector: businessSector || currentStore?.businessSector || "",
          businessArea: Number(businessArea) || currentStore?.area || 0,
          isRented,
          employeeCount: Number(employeeCount) || 0,
          workingHours: {
            from: workingHoursFrom || "08:00",
            to: workingHoursTo || "22:00",
          },
          businessAddress: {
            full: businessAddress || currentStore?.address || "",
          },
          phone: phone || currentStore?.phone || "",
          email: email || currentStore?.email || "",
        } as TaxpayerInfo,
      };

      if (periodType === "custom") {
        payload.periodKey = `${monthFrom}_${monthTo}`;
      } else {
        payload.periodKey = periodKey;
      }

      const url = editingId ? `/taxs/${editingId}` : "/taxs";
      const method: "post" | "put" = editingId ? "put" : "post";

      await apiClient.request({
        url,
        method,
        data: payload,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!isMountedRef.current) return;

      Alert.alert(
        "Thành công",
        editingId ? "Đã cập nhật tờ khai" : "Đã tạo tờ khai mới",
        [
          {
            text: "OK",
            onPress: () => {
              setFormModalVisible(false);
              resetForm();
              fetchDeclarations();
            },
          },
        ]
      );
    } catch (error: any) {
      if (!isMountedRef.current) return;
      const msg = error?.response?.data?.message || "Không thể lưu tờ khai";
      Alert.alert("Lỗi", msg);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [
    editingId,
    storeId,
    periodType,
    hasValidPeriod,
    declaredRevenue,
    gtgtRate,
    tncnRate,
    isFirstTime,
    supplementNumber,
    categoryRevenues,
    specialTaxItems,
    envTaxItems,
    notes,
    taxpayerName,
    storeDisplayName,
    bankAccount,
    taxCode,
    businessSector,
    businessArea,
    isRented,
    employeeCount,
    workingHoursFrom,
    workingHoursTo,
    businessAddress,
    phone,
    email,
    currentStore,
    monthFrom,
    monthTo,
    periodKey,
    token,
    fetchDeclarations,
  ]);

  const deleteDeclaration = useCallback(
    (id: string) => {
      Alert.alert("Xác nhận", "Bạn có chắc muốn xóa tờ khai này?", [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await apiClient.delete(`/taxs/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!isMountedRef.current) return;
              Alert.alert("Đã xóa", "Tờ khai đã được xóa");
              fetchDeclarations();
            } catch (error: any) {
              if (!isMountedRef.current) return;
              const msg =
                error?.response?.data?.message || "Không thể xóa tờ khai";
              Alert.alert("Lỗi", msg);
            } finally {
              if (isMountedRef.current) setLoading(false);
            }
          },
        },
      ]);
    },
    [token, fetchDeclarations]
  );

  const cloneDeclaration = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await apiClient.post(
          `/taxs/${id}/clone`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!isMountedRef.current) return;
        Alert.alert("Thành công", "Đã tạo bản sao tờ khai (trạng thái nháp)");
        fetchDeclarations();
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const msg =
          error?.response?.data?.message || "Không thể nhân bản tờ khai";
        Alert.alert("Lỗi", msg);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [token, fetchDeclarations]
  );

  const approveOrReject = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setLoading(true);
      try {
        await apiClient.post(
          `/taxs/${id}/approve`,
          { action },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!isMountedRef.current) return;
        Alert.alert(
          "Thành công",
          action === "approve"
            ? "Đã duyệt tờ khai"
            : "Đã chuyển tờ khai sang trạng thái từ chối"
        );
        fetchDeclarations();
      } catch (error: any) {
        if (!isMountedRef.current) return;
        const msg =
          error?.response?.data?.message ||
          "Không thể cập nhật trạng thái tờ khai";
        Alert.alert("Lỗi", msg);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [token, fetchDeclarations]
  );

  const exportDeclaration = useCallback(
    async (id: string, format: "csv" | "pdf") => {
      try {
        if (!storeId || !token) {
          Alert.alert("Lỗi", "Thiếu storeId hoặc token");
          return;
        }

        setLoading(true);

        // Gọi API với Bearer token, nhận về blob/binary
        const response = await apiClient.get(`/taxs/${id}/export`, {
          params: { format, storeId },
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob", // để fileService xử lý blob
        });

        const blob = response.data;

        const fileName = `to-khai-thue_${id}_${dayjs().format(
          "YYYYMMDD_HHmmss"
        )}.${format}`;

        const mimeType = format === "pdf" ? "application/pdf" : "text/csv";

        const result = await fileService.handleApiBlobResponse(
          blob,
          fileName,
          mimeType
        );

        if (!result.success) {
          Alert.alert("Lỗi", result.error || "Không thể lưu file");
        }
        // Nếu thành công, fileService đã tự share/mở file rồi
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ||
          error?.message ||
          "Không thể xuất file";
        Alert.alert("Lỗi", msg);
      } finally {
        setLoading(false);
      }
    },
    [storeId, token]
  );

  // ==================== HANDLERS ====================

  const resetForm = useCallback(() => {
    setEditingId(null);
    setPeriodType("");
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
    setSystemRevenue(null);
    setOrderCount(0);
    setDeclaredRevenue("");
    setGtgtRate(TAX_RATES.DEFAULT_GTGT.toString());
    setTncnRate(TAX_RATES.DEFAULT_TNCN.toString());
    setCalculatedTax(null);
    setIsFirstTime(true);
    setSupplementNumber("0");
    setCategoryRevenues([]);
    setSpecialTaxItems([]);
    setEnvTaxItems([]);
    setNotes("");
    setBankAccount(
      typeof currentStore?.bankAccount === "string"
        ? currentStore.bankAccount
        : currentStore?.bankAccount?.accountNumber || ""
    );
    setStoreDisplayName(currentStore?.name || "");
    setTaxCode(currentStore?.taxCode || "");
    setBusinessSector(currentStore?.businessSector || "");
    setBusinessArea(currentStore?.area?.toString() || "");
    setIsRented(false);
    setEmployeeCount("");
    setWorkingHoursFrom("08:00");
    setWorkingHoursTo("22:00");
    setBusinessAddress(currentStore?.address || "");
    setPhone(currentStore?.phone || "");
    setEmail(currentStore?.email || "");
  }, [currentStore]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    fetchDeclarations().finally(() => setRefreshing(false));
  }, [fetchDeclarations]);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const calculateTax = useCallback(() => {
    const revenue = Number(declaredRevenue) || 0;
    if (revenue <= 0) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập doanh thu kê khai");
      return;
    }
    const gt = Number(gtgtRate) || TAX_RATES.DEFAULT_GTGT;
    const tn = Number(tncnRate) || TAX_RATES.DEFAULT_TNCN;
    const gtgtAmount = (revenue * gt) / 100;
    const tncnAmount = (revenue * tn) / 100;
    const total = gtgtAmount + tncnAmount + totalSpecialTax + totalEnvTax;
    setCalculatedTax({ gtgt: gtgtAmount, tncn: tncnAmount, total });

    Alert.alert(
      "Kết quả",
      `Thuế GTGT: ${formatVND(
        gtgtAmount
      )}\nThuế TNCN: ${formatVND(tncnAmount)}\nThuế TTĐB: ${formatVND(
        totalSpecialTax
      )}\nThuế môi trường: ${formatVND(
        totalEnvTax
      )}\n\nTổng thuế: ${formatVND(total)}`
    );
  }, [declaredRevenue, gtgtRate, tncnRate, totalSpecialTax, totalEnvTax]);

  // Category revenue
  const addCategoryRevenue = () => {
    setCategoryRevenues((prev) => [
      ...prev,
      {
        category: "goods_distribution",
        revenue: 0,
        gtgtTax: 0,
        tncnTax: 0,
      } as CategoryRevenue,
    ]);
  };

  const updateCategoryRevenue = (
    index: number,
    field: keyof CategoryRevenue,
    value: any
  ) => {
    setCategoryRevenues((prev) => {
      const clone = [...prev];
      (clone[index] as any)[field] = value;
      return clone;
    });
  };

  const removeCategoryRevenue = (index: number) => {
    setCategoryRevenues((prev) => prev.filter((_, i) => i !== index));
  };

  // Special tax
  const addSpecialTaxItem = () => {
    setSpecialTaxItems((prev) => [
      ...prev,
      { itemName: "", unit: "", revenue: 0, taxRate: 0, taxAmount: 0 },
    ]);
  };

  const updateSpecialTaxItem = (
    index: number,
    field: keyof SpecialTaxItem,
    value: any
  ) => {
    setSpecialTaxItems((prev) => {
      const items = [...prev];
      (items[index] as any)[field] = value;
      if (field === "revenue" || field === "taxRate") {
        const r = Number(items[index].revenue) || 0;
        const t = Number(items[index].taxRate) || 0;
        items[index].taxAmount = (r * t) / 100;
      }
      return items;
    });
  };

  const removeSpecialTaxItem = (index: number) => {
    setSpecialTaxItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Env tax
  const addEnvTaxItem = () => {
    setEnvTaxItems((prev) => [
      ...prev,
      {
        type: "environmental_tax",
        itemName: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        taxRate: 0,
        taxAmount: 0,
      },
    ]);
  };

  const updateEnvTaxItem = (
    index: number,
    field: keyof EnvTaxItem,
    value: any
  ) => {
    setEnvTaxItems((prev) => {
      const items = [...prev];
      (items[index] as any)[field] = value;
      if (["quantity", "unitPrice", "taxRate"].includes(field)) {
        const q = Number(items[index].quantity) || 0;
        const u = Number(items[index].unitPrice) || 0;
        const t = Number(items[index].taxRate) || 0;
        items[index].taxAmount = (q * u * t) / 100;
      }
      return items;
    });
  };

  const removeEnvTaxItem = (index: number) => {
    setEnvTaxItems((prev) => prev.filter((_, i) => i !== index));
  };

  const openDetail = (record: TaxDeclaration) => {
    setSelectedRecord(record);
    setDetailModalVisible(true);
  };
  const startEdit = (record: TaxDeclaration) => {
    setEditingId(record._id);

    // Kỳ kê khai
    setPeriodType(record.periodType);
    setPeriodKey(record.periodKey);
    setMonthFrom("");
    setMonthTo("");
    setSystemRevenue(record.declaredRevenue);
    setOrderCount(0); // nếu cần có thể fetch lại preview

    // Phần A
    setDeclaredRevenue(record.declaredRevenue.toString());
    setGtgtRate(
      record.taxRates?.gtgt?.toString() ?? TAX_RATES.DEFAULT_GTGT.toString()
    );
    setTncnRate(
      record.taxRates?.tncn?.toString() ?? TAX_RATES.DEFAULT_TNCN.toString()
    );
    setIsFirstTime(record.isFirstTime);
    setSupplementNumber(record.supplementNumber?.toString() ?? "0");

    // Phần A chi tiết
    setCategoryRevenues(record.revenueByCategory || []);
    setSpecialTaxItems(record.specialConsumptionTax || []);
    setEnvTaxItems(record.environmentalTax || []);

    // Người nộp thuế
    const info = record.taxpayerInfo;
    if (info) {
      setTaxpayerName(info.name || "");
      setStoreDisplayName(info.storeName || "");
      setBankAccount(info.bankAccount || "");
      setTaxCode(info.taxCode || "");
      setBusinessSector(info.businessSector || "");
      setBusinessArea(info.businessArea?.toString() || "");
      setIsRented(!!info.isRented);
      setEmployeeCount(info.employeeCount?.toString() || "");
      setWorkingHoursFrom(info.workingHours?.from || "08:00");
      setWorkingHoursTo(info.workingHours?.to || "22:00");
      setBusinessAddress(info.businessAddress?.full || "");
      setPhone(info.phone || "");
      setEmail(info.email || "");
    } else {
      // fallback từ currentStore nếu record không có taxpayerInfo
      setTaxpayerName(currentStore?.owner_name || "");
      setStoreDisplayName(currentStore?.name || "");
      setBankAccount(
        typeof currentStore?.bankAccount === "string"
          ? currentStore.bankAccount
          : currentStore?.bankAccount?.accountNumber || ""
      );
      setTaxCode(currentStore?.taxCode || "");
      setBusinessSector(currentStore?.businessSector || "");
      setBusinessArea(currentStore?.area?.toString() || "");
      setBusinessAddress(currentStore?.address || "");
      setPhone(currentStore?.phone || "");
      setEmail(currentStore?.email || "");
    }

    setNotes(record.notes || "");

    setFormModalVisible(true);
  };

  // ==================== RENDER ====================

  if (!storeId || !token) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={56} color="#faad14" />
        <Text style={styles.errorTitle}>
          Vui lòng đăng nhập và chọn cửa hàng
        </Text>
        <Text style={styles.errorText}>
          Chức năng kê khai thuế chỉ hoạt động khi đã chọn cửa hàng đang làm
          việc.
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
            <Ionicons name="document-text" size={28} color="#fff" />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Kê khai thuế 01/CNKD</Text>
              <Text style={styles.headerSubtitle}>{storeName}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setFormModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Tổng quan */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Tổng quan tờ khai</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalCount}</Text>
              <Text style={styles.statLabel}>Tổng tờ khai</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#52c41a" }]}>
                {declarations.filter((d) => d.status === "approved").length}
              </Text>
              <Text style={styles.statLabel}>Đã duyệt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#faad14" }]}>
                {declarations.filter((d) => d.status === "submitted").length}
              </Text>
              <Text style={styles.statLabel}>Đã nộp</Text>
            </View>
          </View>
        </View>

        {/* DANH SÁCH TỜ KHAI */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Lịch sử tờ khai</Text>

          {loading && declarations.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1890ff" />
              <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
            </View>
          ) : declarations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={72} color="#d9d9d9" />
              <Text style={styles.emptyText}>Chưa có tờ khai</Text>
              <Text style={styles.emptySubtext}>
                Nhấn nút "+" trên thanh tiêu đề để tạo tờ khai mới.
              </Text>
            </View>
          ) : (
            declarations.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status];
              return (
                <TouchableOpacity
                  key={item._id}
                  style={styles.declarationCard}
                  activeOpacity={0.8}
                  onPress={() => openDetail(item)}
                >
                  <View style={styles.declarationHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.declarationPeriod}>
                        Kỳ {item.periodKey}
                      </Text>
                      <Text style={styles.declarationDate}>
                        Tạo lúc{" "}
                        {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusCfg.bg,
                          borderColor: statusCfg.color,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: statusCfg.color }]}
                      >
                        {statusCfg.text}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.declarationRow}>
                    <Text style={styles.declarationLabel}>Doanh thu:</Text>
                    <Text style={styles.declarationValue}>
                      {formatVND(item.declaredRevenue)}
                    </Text>
                  </View>
                  <View style={styles.declarationRow}>
                    <Text style={styles.declarationLabel}>Tổng thuế:</Text>
                    <Text style={styles.declarationTotal}>
                      {formatVND(item.taxAmounts?.total)}
                    </Text>
                  </View>

                  <View style={styles.declarationFooter}>
                    <View style={styles.tagRow}>
                      {item.isClone && (
                        <View
                          style={[styles.tag, { backgroundColor: "#fff7e6" }]}
                        >
                          <Text style={[styles.tagText, { color: "#fa8c16" }]}>
                            Bản sao
                          </Text>
                        </View>
                      )}
                      <View
                        style={[styles.tag, { backgroundColor: "#f0f5ff" }]}
                      >
                        <Text style={[styles.tagText, { color: "#1890ff" }]}>
                          v{item.version}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      {["draft", "saved"].includes(item.status) && (
                        <TouchableOpacity
                          style={styles.iconButton}
                          onPress={() => startEdit(item)}
                        >
                          <Ionicons
                            name="create-outline"
                            size={18}
                            color="#1890ff"
                          />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => cloneDeclaration(item._id)}
                      >
                        <Ionicons
                          name="duplicate-outline"
                          size={18}
                          color="#1890ff"
                        />
                      </TouchableOpacity>
                      {item.status === "submitted" && (
                        <>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => approveOrReject(item._id, "approve")}
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={18}
                              color="#52c41a"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => approveOrReject(item._id, "reject")}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={18}
                              color="#ff4d4f"
                            />
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => exportDeclaration(item._id, "pdf")}
                      >
                        <Ionicons
                          name="download-outline"
                          size={18}
                          color="#722ed1"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => deleteDeclaration(item._id)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#ff4d4f"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODAL FORM KÊ KHAI */}
      <Modal
        visible={formModalVisible}
        animationType="slide"
        onRequestClose={() => setFormModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setFormModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={26} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Tờ khai mới</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* [01-03] Kỳ kê khai */}
            <View style={styles.formSection}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection("basicInfo")}
              >
                <Text style={styles.sectionHeaderText}>
                  📅 [01-03] Kỳ kê khai
                </Text>
                <Ionicons
                  name={
                    expandedSections.basicInfo ? "chevron-up" : "chevron-down"
                  }
                  size={18}
                  color="#595959"
                />
              </TouchableOpacity>

              {expandedSections.basicInfo && (
                <View style={styles.sectionBody}>
                  <Text style={styles.inputLabel}>Loại kỳ</Text>

                  {Platform.OS === "ios" ? (
                    // iOS: dùng hàng nút lớn, dễ bấm
                    <View style={styles.segmentGroup}>
                      {PERIOD_TYPES.map((p) => {
                        const selected = periodType === p.value;
                        return (
                          <TouchableOpacity
                            key={p.value}
                            style={[
                              styles.segmentItem,
                              selected && styles.segmentItemActive,
                            ]}
                            onPress={() => {
                              const v = p.value as PeriodType;
                              setPeriodType(v);
                              setPeriodKey("");
                              setMonthFrom("");
                              setMonthTo("");
                              setSystemRevenue(null);
                              setOrderCount(0);
                            }}
                          >
                            <Text
                              style={[
                                styles.segmentItemText,
                                selected && styles.segmentItemTextActive,
                              ]}
                            >
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    // Android: giữ Picker cũ
                    <View style={styles.pickerWrapper}>
                      <Picker
                        selectedValue={periodType}
                        onValueChange={(v) => {
                          setPeriodType(v as PeriodType);
                          setPeriodKey("");
                          setMonthFrom("");
                          setMonthTo("");
                          setSystemRevenue(null);
                          setOrderCount(0);
                        }}
                      >
                        <Picker.Item label="-- Chọn --" value="" />
                        {PERIOD_TYPES.map((p) => (
                          <Picker.Item
                            key={p.value}
                            label={p.label}
                            value={p.value}
                          />
                        ))}
                      </Picker>
                    </View>
                  )}

                  {periodType && periodType !== "custom" && (
                    <>
                      <Text style={styles.inputLabel}>
                        {periodType === "month"
                          ? "Chọn tháng (YYYY-MM)"
                          : periodType === "quarter"
                            ? "Chọn quý (VD: 2025-Q1)"
                            : "Chọn năm (YYYY)"}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={periodKey}
                        onChangeText={setPeriodKey}
                        placeholder={
                          periodType === "month"
                            ? "2025-01"
                            : periodType === "quarter"
                              ? "2025-Q1"
                              : "2025"
                        }
                        placeholderTextColor="#bfbfbf"
                      />
                    </>
                  )}

                  {periodType === "custom" && (
                    <>
                      <Text style={styles.inputLabel}>Từ tháng (YYYY-MM)</Text>
                      <TextInput
                        style={styles.input}
                        value={monthFrom}
                        onChangeText={setMonthFrom}
                        placeholder="2025-01"
                        placeholderTextColor="#bfbfbf"
                      />
                      <Text style={styles.inputLabel}>Đến tháng (YYYY-MM)</Text>
                      <TextInput
                        style={styles.input}
                        value={monthTo}
                        onChangeText={setMonthTo}
                        placeholder="2025-12"
                        placeholderTextColor="#bfbfbf"
                      />
                    </>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      !hasValidPeriod && { opacity: 0.5 },
                    ]}
                    disabled={!hasValidPeriod || loading}
                    onPress={fetchPreview}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name="refresh-circle-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.primaryButtonText}>
                          Xem doanh thu hệ thống
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {systemRevenue !== null && (
                    <View style={styles.systemRevenueCard}>
                      <Text style={styles.systemRevenueTitle}>
                        Doanh thu hệ thống (tham khảo)
                      </Text>
                      <Text style={styles.systemRevenueValue}>
                        {formatVND(systemRevenue)}
                      </Text>
                      <Text style={styles.systemRevenueSub}>
                        {orderCount} đơn hàng • {periodDisplay}
                      </Text>
                    </View>
                  )}

                  <View style={styles.row}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setIsFirstTime(!isFirstTime)}
                    >
                      <Ionicons
                        name={isFirstTime ? "checkbox" : "square-outline"}
                        size={22}
                        color={isFirstTime ? "#1890ff" : "#bfbfbf"}
                      />
                      <Text style={styles.checkboxLabel}>
                        [02] Lần đầu kê khai
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>
                        [03] Bổ sung lần thứ
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={supplementNumber}
                        onChangeText={setSupplementNumber}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#bfbfbf"
                      />
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* PHẦN A: THUẾ GTGT & TNCN */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("taxDetails")}
                >
                  <Text style={styles.sectionHeaderText}>
                    💰 PHẦN A: Thuế GTGT & TNCN
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.taxDetails
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.taxDetails && (
                  <View style={styles.sectionBody}>
                    <Text style={styles.inputLabel}>
                      💵 [32] Doanh thu kê khai
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={declaredRevenue}
                      onChangeText={setDeclaredRevenue}
                      keyboardType="numeric"
                      placeholder="Nhập doanh thu..."
                      placeholderTextColor="#bfbfbf"
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.inputLabel}>Thuế GTGT (%)</Text>
                        <TextInput
                          style={styles.input}
                          value={gtgtRate}
                          onChangeText={setGtgtRate}
                          keyboardType="decimal-pad"
                          placeholder="1.0"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.inputLabel}>Thuế TNCN (%)</Text>
                        <TextInput
                          style={styles.input}
                          value={tncnRate}
                          onChangeText={setTncnRate}
                          keyboardType="decimal-pad"
                          placeholder="0.5"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={calculateTax}
                    >
                      <Ionicons
                        name="calculator-outline"
                        size={20}
                        color="#1890ff"
                      />
                      <Text style={styles.outlineButtonText}>Tính thuế</Text>
                    </TouchableOpacity>

                    {calculatedTax && (
                      <View style={styles.taxResultCard}>
                        <Text style={styles.taxResultTitle}>
                          Kết quả tính thuế
                        </Text>
                        <View style={styles.taxRow}>
                          <Text style={styles.taxLabel}>Thuế GTGT:</Text>
                          <Text style={styles.taxValue}>
                            {formatVND(calculatedTax.gtgt)}
                          </Text>
                        </View>
                        <View style={styles.taxRow}>
                          <Text style={styles.taxLabel}>Thuế TNCN:</Text>
                          <Text style={styles.taxValue}>
                            {formatVND(calculatedTax.tncn)}
                          </Text>
                        </View>
                        <View style={styles.taxRow}>
                          <Text style={styles.taxLabel}>Thuế TTĐB:</Text>
                          <Text style={styles.taxValue}>
                            {formatVND(totalSpecialTax)}
                          </Text>
                        </View>
                        <View style={styles.taxRow}>
                          <Text style={styles.taxLabel}>Thuế môi trường:</Text>
                          <Text style={styles.taxValue}>
                            {formatVND(totalEnvTax)}
                          </Text>
                        </View>
                        <View style={styles.taxDivider} />
                        <View style={styles.taxRow}>
                          <Text style={styles.taxTotalLabel}>Tổng thuế:</Text>
                          <Text style={styles.taxTotalValue}>
                            {formatVND(calculatedTax.total)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* [28-31] DOANH THU THEO NGHỀ */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("categoryRevenue")}
                >
                  <Text style={styles.sectionHeaderText}>
                    📊 [28-31] Doanh thu theo ngành nghề
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.categoryRevenue
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.categoryRevenue && (
                  <View style={styles.sectionBody}>
                    {/* Thanh trên: nút thêm + tổng doanh thu */}
                    <View style={styles.sectionHeaderRow}>
                      <TouchableOpacity
                        style={styles.outlineButton}
                        onPress={addCategoryRevenue}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#1890ff"
                        />
                        <Text style={styles.outlineButtonText}>
                          Thêm ngành nghề
                        </Text>
                      </TouchableOpacity>

                      {categoryRevenues.length > 0 && (
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipLabel}>
                            Tổng doanh thu:
                          </Text>
                          <Text style={styles.summaryChipValue}>
                            {formatVND(totalDeclaredRevenue)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {categoryRevenues.map((cat, index) => (
                      <View key={index} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <View>
                            <Text style={styles.itemTitle}>
                              Ngành nghề #{index + 1}
                            </Text>
                            <Text style={styles.itemSubtitle}>
                              Chọn nhóm ngành và nhập doanh thu, thuế GTGT, thuế
                              TNCN
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.iconCircleDanger}
                            onPress={() => removeCategoryRevenue(index)}
                          >
                            <Ionicons name="close" size={18} color="#ff4d4f" />
                          </TouchableOpacity>
                        </View>

                        {/* Nhóm ngành: iOS dùng chip, Android giữ Picker */}
                        <Text style={styles.inputLabelStrong}>Nhóm ngành</Text>

                        {Platform.OS === "ios" ? (
                          <View style={styles.chipGroup}>
                            {Object.entries(CATEGORY_MAP).map(([key, val]) => {
                              const selected = cat.category === key;
                              return (
                                <TouchableOpacity
                                  key={key}
                                  style={[
                                    styles.chip,
                                    selected && styles.chipActive,
                                  ]}
                                  onPress={() =>
                                    updateCategoryRevenue(
                                      index,
                                      "category",
                                      key as CategoryRevenue["category"]
                                    )
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      selected && styles.chipTextActive,
                                    ]}
                                  >
                                    {val.code} {val.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={cat.category}
                              onValueChange={(v) =>
                                updateCategoryRevenue(
                                  index,
                                  "category",
                                  v as CategoryRevenue["category"]
                                )
                              }
                            >
                              {Object.entries(CATEGORY_MAP).map(
                                ([key, val]) => (
                                  <Picker.Item
                                    key={key}
                                    label={`${val.code} ${val.name}`}
                                    value={key}
                                  />
                                )
                              )}
                            </Picker>
                          </View>
                        )}

                        {/* Doanh thu + Thuế */}
                        <Text style={styles.inputLabelStrong}>
                          Doanh thu (VND)
                        </Text>
                        <TextInput
                          style={styles.inputFilled}
                          value={cat.revenue.toString()}
                          onChangeText={(v) =>
                            updateCategoryRevenue(
                              index,
                              "revenue",
                              Number(v) || 0
                            )
                          }
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#8c8c8c"
                        />

                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.inputLabelStrong}>
                              Thuế GTGT
                            </Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={cat.gtgtTax.toString()}
                              onChangeText={(v) =>
                                updateCategoryRevenue(
                                  index,
                                  "gtgtTax",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.inputLabelStrong}>
                              Thuế TNCN
                            </Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={cat.tncnTax.toString()}
                              onChangeText={(v) =>
                                updateCategoryRevenue(
                                  index,
                                  "tncnTax",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                        </View>
                      </View>
                    ))}

                    {categoryRevenues.length === 0 && (
                      <Text style={styles.emptyHint}>
                        Chưa có ngành nghề nào. Nhấn "Thêm ngành nghề" để bắt
                        đầu.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* PHẦN B: THUẾ TTĐB */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("specialTax")}
                >
                  <Text style={styles.sectionHeaderText}>
                    🍷 PHẦN B: Thuế tiêu thụ đặc biệt
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.specialTax
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.specialTax && (
                  <View style={styles.sectionBody}>
                    <TouchableOpacity
                      style={styles.outlineButton}
                      onPress={addSpecialTaxItem}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="#1890ff"
                      />
                      <Text style={styles.outlineButtonText}>
                        Thêm hàng hóa TTĐB
                      </Text>
                    </TouchableOpacity>

                    {specialTaxItems.map((item, index) => (
                      <View key={index} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemTitle}>
                            Hàng hóa #{index + 1}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeSpecialTaxItem(index)}
                          >
                            <Ionicons
                              name="close-circle"
                              size={20}
                              color="#ff4d4f"
                            />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>
                          [33] Tên hàng hóa/dịch vụ
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={item.itemName}
                          onChangeText={(v) =>
                            updateSpecialTaxItem(index, "itemName", v)
                          }
                          placeholder="Ví dụ: Rượu vang, bia..."
                          placeholderTextColor="#bfbfbf"
                        />

                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.inputLabel}>Đơn vị tính</Text>
                            <TextInput
                              style={styles.input}
                              value={item.unit}
                              onChangeText={(v) =>
                                updateSpecialTaxItem(index, "unit", v)
                              }
                              placeholder="Chai, thùng..."
                              placeholderTextColor="#bfbfbf"
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.inputLabel}>Thuế suất (%)</Text>
                            <TextInput
                              style={styles.input}
                              value={item.taxRate.toString()}
                              onChangeText={(v) =>
                                updateSpecialTaxItem(
                                  index,
                                  "taxRate",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="#bfbfbf"
                            />
                          </View>
                        </View>

                        <Text style={styles.inputLabel}>Doanh thu</Text>
                        <TextInput
                          style={styles.input}
                          value={item.revenue.toString()}
                          onChangeText={(v) =>
                            updateSpecialTaxItem(
                              index,
                              "revenue",
                              Number(v) || 0
                            )
                          }
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#bfbfbf"
                        />

                        <View style={styles.calculatedBox}>
                          <Text style={styles.calculatedLabel}>
                            Số thuế TTĐB:
                          </Text>
                          <Text style={styles.calculatedValue}>
                            {formatVND(item.taxAmount)}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {specialTaxItems.length > 0 && (
                      <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Tổng thuế TTĐB:</Text>
                        <Text
                          style={[styles.summaryValue, { color: "#d4380d" }]}
                        >
                          {formatVND(totalSpecialTax)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* PHẦN C: THUẾ/PHÍ MÔI TRƯỜNG */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("envTax")}
                >
                  <Text style={styles.sectionHeaderText}>
                    🌍 PHẦN C: Thuế/Phí môi trường
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.envTax ? "chevron-up" : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.envTax && (
                  <View style={styles.sectionBody}>
                    {/* Thanh trên: nút thêm + tổng thuế */}
                    <View style={styles.sectionHeaderRow}>
                      <TouchableOpacity
                        style={styles.outlineButton}
                        onPress={addEnvTaxItem}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={20}
                          color="#1890ff"
                        />
                        <Text style={styles.outlineButtonText}>
                          Thêm mục môi trường
                        </Text>
                      </TouchableOpacity>

                      {envTaxItems.length > 0 && (
                        <View style={styles.summaryChip}>
                          <Text style={styles.summaryChipLabel}>
                            Tổng thuế môi trường:
                          </Text>
                          <Text style={styles.summaryChipValue}>
                            {formatVND(totalEnvTax)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {envTaxItems.map((item, index) => (
                      <View key={index} style={styles.itemCard}>
                        <View style={styles.itemHeader}>
                          <View>
                            <Text style={styles.itemTitle}>
                              Mục môi trường #{index + 1}
                            </Text>
                            <Text style={styles.itemSubtitle}>
                              Chọn loại thuế/phí và nhập số lượng, đơn giá, thuế
                              suất.
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.iconCircleDanger}
                            onPress={() => removeEnvTaxItem(index)}
                          >
                            <Ionicons name="close" size={18} color="#ff4d4f" />
                          </TouchableOpacity>
                        </View>

                        {/* Loại thuế/phí: iOS dùng chip, Android giữ Picker */}
                        <Text style={styles.inputLabelStrong}>
                          Loại thuế/phí
                        </Text>

                        {Platform.OS === "ios" ? (
                          <View style={styles.chipGroup}>
                            {ENV_TAX_TYPES.map((t) => {
                              const selected = item.type === t.value;
                              return (
                                <TouchableOpacity
                                  key={t.value}
                                  style={[
                                    styles.chip,
                                    selected && styles.chipActive,
                                  ]}
                                  onPress={() =>
                                    updateEnvTaxItem(
                                      index,
                                      "type",
                                      t.value as EnvTaxType
                                    )
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.chipText,
                                      selected && styles.chipTextActive,
                                    ]}
                                  >
                                    {t.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={item.type}
                              onValueChange={(v) =>
                                updateEnvTaxItem(index, "type", v as EnvTaxType)
                              }
                            >
                              {ENV_TAX_TYPES.map((t) => (
                                <Picker.Item
                                  key={t.value}
                                  label={t.label}
                                  value={t.value}
                                />
                              ))}
                            </Picker>
                          </View>
                        )}

                        {/* Tên tài nguyên / hàng hóa */}
                        <Text style={styles.inputLabelStrong}>
                          Tên tài nguyên / hàng hóa
                        </Text>
                        <TextInput
                          style={styles.inputFilled}
                          value={item.itemName}
                          onChangeText={(v) =>
                            updateEnvTaxItem(index, "itemName", v)
                          }
                          placeholder="Ví dụ: Xăng, dầu, túi nilon..."
                          placeholderTextColor="#8c8c8c"
                        />

                        {/* Đơn vị + Số lượng */}
                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.inputLabelStrong}>
                              Đơn vị tính
                            </Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={item.unit}
                              onChangeText={(v) =>
                                updateEnvTaxItem(index, "unit", v)
                              }
                              placeholder="Lít, kg, túi..."
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.inputLabelStrong}>
                              Số lượng
                            </Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={item.quantity.toString()}
                              onChangeText={(v) =>
                                updateEnvTaxItem(
                                  index,
                                  "quantity",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                        </View>

                        {/* Đơn giá + Thuế suất */}
                        <View style={styles.row}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.inputLabelStrong}>Đơn giá</Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={item.unitPrice.toString()}
                              onChangeText={(v) =>
                                updateEnvTaxItem(
                                  index,
                                  "unitPrice",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="numeric"
                              placeholder="0"
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.inputLabelStrong}>
                              Thuế suất (%)
                            </Text>
                            <TextInput
                              style={styles.inputFilled}
                              value={item.taxRate.toString()}
                              onChangeText={(v) =>
                                updateEnvTaxItem(
                                  index,
                                  "taxRate",
                                  Number(v) || 0
                                )
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="#8c8c8c"
                            />
                          </View>
                        </View>

                        {/* Số thuế BVMT */}
                        <View style={styles.calculatedBox}>
                          <Text style={styles.calculatedLabel}>
                            Số thuế BVMT:
                          </Text>
                          <Text style={styles.calculatedValue}>
                            {formatVND(item.taxAmount)}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {envTaxItems.length === 0 && (
                      <Text style={styles.emptyHint}>
                        Chưa có mục môi trường nào. Nhấn "Thêm mục môi trường"
                        để bắt đầu.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* THÔNG TIN NGƯỜI NỘP THUẾ */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("taxpayerInfo")}
                >
                  <Text style={styles.sectionHeaderText}>
                    👤 [04-16] Người nộp thuế
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.taxpayerInfo
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.taxpayerInfo && (
                  <View style={styles.sectionBody}>
                    <Text style={styles.inputLabel}>[04] Người nộp thuế</Text>
                    <TextInput
                      style={styles.input}
                      value={taxpayerName}
                      onChangeText={setTaxpayerName}
                      placeholder="Họ tên đầy đủ"
                      placeholderTextColor="#bfbfbf"
                    />

                    <Text style={styles.inputLabel}>
                      [05] Tên cửa hàng/thương hiệu
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={storeDisplayName}
                      onChangeText={setStoreDisplayName}
                      placeholder="Tên cửa hàng"
                      placeholderTextColor="#bfbfbf"
                    />

                    <Text style={styles.inputLabel}>
                      [06] Tài khoản ngân hàng
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={bankAccount}
                      onChangeText={setBankAccount}
                      keyboardType="numeric"
                      placeholder="Số tài khoản"
                      placeholderTextColor="#bfbfbf"
                    />

                    <Text style={styles.inputLabel}>[07] Mã số thuế</Text>
                    <TextInput
                      style={styles.input}
                      value={taxCode}
                      onChangeText={setTaxCode}
                      keyboardType="numeric"
                      placeholder="10-13 chữ số"
                      placeholderTextColor="#bfbfbf"
                    />

                    <Text style={styles.inputLabel}>
                      [08] Ngành nghề kinh doanh
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={businessSector}
                      onChangeText={setBusinessSector}
                      placeholder="VD: Bán lẻ thực phẩm"
                      placeholderTextColor="#bfbfbf"
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.inputLabel}>
                          [09] Diện tích (m²)
                        </Text>
                        <TextInput
                          style={styles.input}
                          value={businessArea}
                          onChangeText={setBusinessArea}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.inputLabel}>[10] Số lao động</Text>
                        <TextInput
                          style={styles.input}
                          value={employeeCount}
                          onChangeText={setEmployeeCount}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setIsRented(!isRented)}
                    >
                      <Ionicons
                        name={isRented ? "checkbox" : "square-outline"}
                        size={22}
                        color={isRented ? "#1890ff" : "#bfbfbf"}
                      />
                      <Text style={styles.checkboxLabel}>
                        [09a] Địa điểm đi thuê
                      </Text>
                    </TouchableOpacity>

                    <Text style={styles.inputLabel}>
                      [11] Thời gian hoạt động
                    </Text>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subLabel}>Từ</Text>
                        <TextInput
                          style={styles.input}
                          value={workingHoursFrom}
                          onChangeText={setWorkingHoursFrom}
                          placeholder="08:00"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.subLabel}>Đến</Text>
                        <TextInput
                          style={styles.input}
                          value={workingHoursTo}
                          onChangeText={setWorkingHoursTo}
                          placeholder="22:00"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                    </View>

                    <Text style={styles.inputLabel}>
                      [12] Địa chỉ kinh doanh
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 70 }]}
                      value={businessAddress}
                      onChangeText={setBusinessAddress}
                      placeholder="Địa chỉ đầy đủ"
                      placeholderTextColor="#bfbfbf"
                      multiline
                    />

                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.inputLabel}>[14] Điện thoại</Text>
                        <TextInput
                          style={styles.input}
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          placeholder="Số điện thoại"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.inputLabel}>[16] Email</Text>
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          placeholder="Email"
                          autoCapitalize="none"
                          placeholderTextColor="#bfbfbf"
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* GHI CHÚ & CAM ĐOAN */}
            {systemRevenue !== null && (
              <View style={styles.formSection}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("notes")}
                >
                  <Text style={styles.sectionHeaderText}>
                    📝 Ghi chú & Cam đoan
                  </Text>
                  <Ionicons
                    name={
                      expandedSections.notes ? "chevron-up" : "chevron-down"
                    }
                    size={18}
                    color="#595959"
                  />
                </TouchableOpacity>

                {expandedSections.notes && (
                  <View style={styles.sectionBody}>
                    <Text style={styles.inputLabel}>Ghi chú bổ sung</Text>
                    <TextInput
                      style={[styles.input, { height: 100 }]}
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      maxLength={500}
                      placeholder="Nhập ghi chú cho tờ khai (tùy chọn)..."
                      placeholderTextColor="#bfbfbf"
                    />
                    <Text style={styles.charCount}>{notes.length}/500</Text>

                    <View style={styles.infoBox}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#52c41a"
                      />
                      <Text style={styles.infoText}>
                        Tôi cam đoan số liệu khai trên là đúng và chịu trách
                        nhiệm trước pháp luật về những số liệu đã khai.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* FOOTER SUBMIT */}
          {systemRevenue !== null && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitDeclaration}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#52c41a", "#389e0d"]}
                  style={styles.submitButtonInner}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={22} color="#fff" />
                      <Text style={styles.submitButtonText}>Lưu tờ khai</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL CHI TIẾT */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setDetailModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={26} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chi tiết tờ khai</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedRecord && (
              <View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Kỳ kê khai</Text>
                  <Text style={styles.detailValue}>
                    {selectedRecord.periodKey}
                  </Text>

                  <Text style={styles.detailLabel}>Doanh thu kê khai</Text>
                  <Text style={[styles.detailValue, { color: "#1890ff" }]}>
                    {formatVND(selectedRecord.declaredRevenue)}
                  </Text>

                  <Text style={styles.detailLabel}>Thuế GTGT</Text>
                  <Text style={styles.detailValue}>
                    {formatVND(selectedRecord.taxAmounts?.gtgt)}
                  </Text>

                  <Text style={styles.detailLabel}>Thuế TNCN</Text>
                  <Text style={styles.detailValue}>
                    {formatVND(selectedRecord.taxAmounts?.tncn)}
                  </Text>

                  <Text style={styles.detailLabel}>Tổng thuế</Text>
                  <Text style={[styles.detailValue, { color: "#d4380d" }]}>
                    {formatVND(selectedRecord.taxAmounts?.total)}
                  </Text>
                </View>

                {selectedRecord.taxpayerInfo && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockTitle}>
                      Thông tin người nộp thuế
                    </Text>
                    {selectedRecord.taxpayerInfo.name && (
                      <>
                        <Text style={styles.detailLabel}>Người nộp thuế</Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.name}
                        </Text>
                      </>
                    )}
                    {selectedRecord.taxpayerInfo.storeName && (
                      <>
                        <Text style={styles.detailLabel}>Cửa hàng</Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.storeName}
                        </Text>
                      </>
                    )}
                    {selectedRecord.taxpayerInfo.taxCode && (
                      <>
                        <Text style={styles.detailLabel}>Mã số thuế</Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.taxCode}
                        </Text>
                      </>
                    )}
                    {selectedRecord.taxpayerInfo.phone && (
                      <>
                        <Text style={styles.detailLabel}>Điện thoại</Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.phone}
                        </Text>
                      </>
                    )}
                    {selectedRecord.taxpayerInfo.email && (
                      <>
                        <Text style={styles.detailLabel}>Email</Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.email}
                        </Text>
                      </>
                    )}
                    {selectedRecord.taxpayerInfo.businessAddress?.full && (
                      <>
                        <Text style={styles.detailLabel}>
                          Địa chỉ kinh doanh
                        </Text>
                        <Text style={styles.detailValue}>
                          {selectedRecord.taxpayerInfo.businessAddress.full}
                        </Text>
                      </>
                    )}
                  </View>
                )}

                {selectedRecord.revenueByCategory &&
                  selectedRecord.revenueByCategory.length > 0 && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockTitle}>
                        Doanh thu theo ngành nghề
                      </Text>
                      {selectedRecord.revenueByCategory.map((cat, idx) => (
                        <View key={idx} style={styles.detailRowInline}>
                          <Text style={styles.detailInlineLabel}>
                            {CATEGORY_MAP[cat.category]?.name ||
                              (cat.category as string)}
                          </Text>
                          <Text style={styles.detailInlineValue}>
                            {formatVND(cat.revenue)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {selectedRecord.specialConsumptionTax &&
                  selectedRecord.specialConsumptionTax.length > 0 && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockTitle}>
                        Thuế tiêu thụ đặc biệt
                      </Text>
                      {selectedRecord.specialConsumptionTax.map((item, idx) => (
                        <View key={idx} style={styles.detailRowInline}>
                          <Text style={styles.detailInlineLabel}>
                            {item.itemName}
                          </Text>
                          <Text style={styles.detailInlineValue}>
                            {formatVND(item.taxAmount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {selectedRecord.environmentalTax &&
                  selectedRecord.environmentalTax.length > 0 && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailBlockTitle}>
                        Thuế/Phí môi trường
                      </Text>
                      {selectedRecord.environmentalTax.map((item, idx) => (
                        <View key={idx} style={styles.detailRowInline}>
                          <Text style={styles.detailInlineLabel}>
                            {item.itemName}
                          </Text>
                          <Text style={styles.detailInlineValue}>
                            {formatVND(item.taxAmount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                {selectedRecord.notes && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockTitle}>Ghi chú</Text>
                    <Text style={styles.detailValue}>
                      {selectedRecord.notes}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default TaxDeclarationScreen;

// ==================== STYLES ====================

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

  // Error
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

  // Stats
  statsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1890ff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: "#8c8c8c" },

  // List
  listSection: { paddingHorizontal: 16, paddingBottom: 16 },
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

  declarationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  declarationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  declarationPeriod: { fontSize: 15, fontWeight: "700", color: "#262626" },
  declarationDate: { fontSize: 12, color: "#8c8c8c", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  declarationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  declarationLabel: { fontSize: 13, color: "#8c8c8c" },
  declarationValue: { fontSize: 13, fontWeight: "600", color: "#262626" },
  declarationTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#d4380d",
  },
  declarationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
    marginTop: 8,
    paddingTop: 8,
  },
  tagRow: { flexDirection: "row" },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
  cardActions: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    backgroundColor: "#f5f5f5",
  },

  // Modal base
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    paddingTop: Platform.OS === "ios" ? 48 : 16,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeButton: { padding: 4 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#262626" },
  modalContent: { flex: 1, padding: 16 },

  // Form sections
  formSection: {
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#262626",
  },
  sectionBody: { paddingHorizontal: 14, paddingVertical: 10 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#595959",
    marginTop: 8,
    marginBottom: 4,
  },
  subLabel: { fontSize: 12, color: "#8c8c8c", marginBottom: 4 },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9d9d9",
    paddingHorizontal: 10,
    fontSize: 14,
    color: "#262626",
    backgroundColor: "#fff",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", marginTop: 8 },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    marginRight: 8,
  },
  checkboxLabel: { marginLeft: 6, fontSize: 13, color: "#595959" },

  primaryButton: {
    marginTop: 12,
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
    marginTop: 10,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#1890ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: {
    marginLeft: 6,
    color: "#1890ff",
    fontSize: 14,
    fontWeight: "600",
  },

  systemRevenueCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e6f7ff",
    alignItems: "center",
  },
  systemRevenueTitle: { fontSize: 13, color: "#0050b3" },
  systemRevenueValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0050b3",
    marginTop: 4,
  },
  systemRevenueSub: { fontSize: 12, color: "#0050b3", marginTop: 2 },

  // Item cards
  itemCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#262626" },

  calculatedBox: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff1f0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  calculatedLabel: { fontSize: 13, color: "#8c8c8c" },
  calculatedValue: { fontSize: 13, fontWeight: "600", color: "#cf1322" },

  summaryBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f6ffed",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: { fontSize: 13, color: "#389e0d" },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#389e0d",
  },

  taxResultCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
  },
  taxResultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 4,
  },
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  taxLabel: { fontSize: 13, color: "#595959" },
  taxValue: { fontSize: 13, fontWeight: "600", color: "#262626" },
  taxDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#d9d9d9",
    marginVertical: 6,
  },
  taxTotalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#262626",
  },
  taxTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#cf1322",
  },

  infoBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f6ffed",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    color: "#389e0d",
  },
  charCount: {
    fontSize: 11,
    color: "#8c8c8c",
    textAlign: "right",
    marginTop: 2,
  },

  // Footer
  modalFooter: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  submitButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  submitButtonInner: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    marginLeft: 8,
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Detail
  detailBlock: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  detailBlockTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#262626",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#8c8c8c",
    marginTop: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "#262626",
    marginTop: 2,
  },
  detailRowInline: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  detailInlineLabel: {
    fontSize: 13,
    color: "#595959",
    flex: 1,
    marginRight: 8,
  },
  detailInlineValue: {
    fontSize: 13,
    color: "#262626",
    fontWeight: "600",
  },
  // Segmented control cho iOS
  segmentGroup: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    padding: 2,
    marginTop: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: "#1890ff",
  },
  segmentItemText: {
    fontSize: 13,
    color: "#595959",
    fontWeight: "500",
    textAlign: "center",
  },
  segmentItemTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryChip: {
    backgroundColor: "#e6f7ff",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryChipLabel: {
    fontSize: 11,
    color: "#595959",
  },
  summaryChipValue: {
    fontSize: 12,
    color: "#096dd9",
    fontWeight: "700",
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#8c8c8c",
    marginTop: 2,
  },
  iconCircleDanger: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#ffccc7",
    backgroundColor: "#fff1f0",
    alignItems: "center",
    justifyContent: "center",
  },

  inputLabelStrong: {
    fontSize: 12,
    color: "#262626",
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 4,
  },
  inputFilled: {
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#262626",
    backgroundColor: "#ffffff",
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    color: "#8c8c8c",
  },

  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    marginRight: 6,
    marginTop: 4,
  },
  chipActive: {
    backgroundColor: "#1890ff",
  },
  chipText: {
    fontSize: 12,
    color: "#595959",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
