// src/pages/report/TaxDeclaration.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Table,
  Form,
  Spin,
  Alert,
  Space,
  Modal,
  message,
  Dropdown,
  Menu,
  Statistic,
  Typography,
  Divider,
  Tooltip,
  Tag,
  Popconfirm,
  Badge,
  Descriptions,
  Result,
  Input,
  Collapse,
  Switch,
  Checkbox,
  notification,
  Progress,
  Empty,
} from "antd";
import {
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileDoneOutlined,
  UndoOutlined,
  QuestionCircleOutlined,
  CalculatorOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  UserOutlined,
  ShopOutlined,
  EnvironmentOutlined,
  BankOutlined,
  IdcardOutlined,
  TeamOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/vi";
import readVietnameseNumber from "read-vietnamese-number";
import Layout from "../../components/Layout";
import ComponentTaxGuide from "./ComponentTaxGuide";
import Swal from "sweetalert2";

dayjs.extend(quarterOfYear);
dayjs.extend(customParseFormat);
dayjs.locale("vi");

const apiUrl = import.meta.env.VITE_API_URL;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("❌ TaxDeclaration Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Result
            status="error"
            title="Có lỗi xảy ra trong module kê khai thuế"
            subTitle={this.state.error?.message || "Vui lòng thử lại hoặc liên hệ hỗ trợ"}
            extra={[
              <Button key="refresh" type="primary" onClick={() => window.location.reload()}>
                <ReloadOutlined /> Tải lại trang
              </Button>,
              <Button
                key="details"
                onClick={() =>
                  console.error("Error details:", this.state.error, this.state.errorInfo)
                }
              >
                Chi tiết lỗi
              </Button>,
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

// ==================== CONSTANTS & CONFIG ====================
const PERIOD_TYPES = [
  { value: "month", label: "Tháng", description: "Kê khai theo tháng" },
  { value: "quarter", label: "Quý", description: "Kê khai theo quý" },
  { value: "year", label: "Năm", description: "Kê khai theo năm" },
  { value: "custom", label: "Tùy chỉnh", description: "Kê khai theo khoảng thời gian tùy chọn" },
];

const TAX_RATES = {
  DEFAULT_GTGT: 1.0,
  DEFAULT_TNCN: 0.5,
  MAX_GTGT: 10,
  MAX_TNCN: 5,
};

const STATUS_CONFIG = {
  draft: { text: "Nháp", color: "default", icon: <EditOutlined /> },
  saved: { text: "Đã lưu", color: "processing", icon: <ClockCircleOutlined /> },
  submitted: { text: "Đã nộp", color: "warning", icon: <FileDoneOutlined /> },
  approved: { text: "Đã duyệt", color: "success", icon: <CheckCircleOutlined /> },
  rejected: { text: "Từ chối", color: "error", icon: <CloseCircleOutlined /> },
};

const CATEGORY_MAP = {
  goods_distribution: { code: "[28]", name: "Phân phối, cung cấp hàng hóa" },
  service_construction: { code: "[29]", name: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu" },
  manufacturing_transport: { code: "[30]", name: "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa" },
  other_business: { code: "[31]", name: "Hoạt động kinh doanh khác" },
};

// ==================== HELPER FUNCTIONS ====================
const formatVND = (value) => {
  if (!value && value !== 0) return "₫0";
  try {
    const num = typeof value === "object" ? value.$numberDecimal || value.toString() : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(Number(num));
  } catch {
    return "₫0";
  }
};

const readNumberSafe = (num) => {
  try {
    if (!num && num !== 0) return "Không xác định";
    const numStr = Math.round(Number(num)).toString();
    return readVietnameseNumber(numStr).replace("đơn vị", "").trim();
  } catch (error) {
    console.warn("readVietnameseNumber error:", error);
    return new Intl.NumberFormat("vi-VN").format(Math.round(Number(num)));
  }
};

const getCategoryName = (code) => {
  return CATEGORY_MAP[code]?.name || code;
};

const getCategoryCode = (code) => {
  return CATEGORY_MAP[code]?.code || "";
};

// ==================== MAIN COMPONENT ====================
const TaxDeclaration = () => {
  // ==================== AUTH & STORE ====================
  const token = localStorage.getItem("token");
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id || currentStore?.id;

  // ==================== STATE ====================
  const [loading, setLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [calculatedTax, setCalculatedTax] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [categoryRevenues, setCategoryRevenues] = useState([]);
  const [specialTaxItems, setSpecialTaxItems] = useState([]);
  const [envTaxItems, setEnvTaxItems] = useState([]);

  // Filter & Preview
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [monthRange, setMonthRange] = useState([]);
  const [pickerValue, setPickerValue] = useState(null);
  const [systemRevenue, setSystemRevenue] = useState(null);
  const [orderCount, setOrderCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ==================== MEMOIZED VALUES ====================
  const periodDisplay = useMemo(() => {
    if (periodType === "custom" && monthRange.length === 2) {
      return `${monthRange[0].format("MM/YYYY")} - ${monthRange[1].format("MM/YYYY")}`;
    }
    return periodKey;
  }, [periodType, periodKey, monthRange]);

  const hasValidPeriod = useMemo(() => {
    if (!periodType) return false;
    if (periodType === "custom") return monthRange.length === 2;
    return !!periodKey;
  }, [periodType, periodKey, monthRange]);

  const totalDeclaredRevenue = useMemo(() => {
    return categoryRevenues.reduce((sum, cat) => sum + (Number(cat.revenue) || 0), 0);
  }, [categoryRevenues]);

  // ==================== NOTIFICATION SYSTEM ====================
  const showNotification = useCallback(
    (type, title, description, hints = [], duration = 6) => {
      const icons = {
        success: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        error: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
        warning: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
        info: <InfoCircleOutlined style={{ color: "#1890ff" }} />,
      };

      notification[type]({
        message: (
          <Space>
            {icons[type]}
            <Text strong>{title}</Text>
          </Space>
        ),
        description: (
          <div>
            {description && (
              <Paragraph
                style={{
                  marginBottom: hints.length > 0 ? 12 : 0,
                  marginTop: 4,
                }}
              >
                {description}
              </Paragraph>
            )}
            {hints.length > 0 && (
              <div
                style={{
                  paddingLeft: 16,
                  borderLeft: "3px solid #1890ff",
                  background: "#f0f5ff",
                  padding: 12,
                  borderRadius: 4,
                }}
              >
                <Space align="start">
                  <BulbOutlined style={{ color: "#1890ff", marginTop: 2 }} />
                  <div>
                    <Text strong style={{ color: "#1890ff" }}>
                      Gợi ý:
                    </Text>
                    <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                      {hints.map((hint, idx) => (
                        <li
                          key={idx}
                          style={{
                            color: "#666",
                            marginBottom: 4,
                            lineHeight: 1.6,
                          }}
                        >
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Space>
              </div>
            )}
          </div>
        ),
        duration,
        placement: "topRight",
        style: {
          width: hints.length > 0 ? 450 : 380,
        },
      });
    },
    []
  );

  // ==================== ERROR HANDLER ====================
  const handleApiError = useCallback(
    (error, defaultMessage = "Có lỗi xảy ra", context = "") => {
      console.error(`❌ ${context} Error:`, error);

      const response = error.response?.data;
      const status = error.response?.status;

      // Extract error details
      const errorMessage = response?.message || defaultMessage;
      const missingFields = response?.missingFields || [];
      const invalidFields = response?.invalidFields || [];
      const hint = response?.hint;
      const details = response?.details || [];
      const existingId = response?.existingId;

      // Build hints array
      const hints = [];

      if (hint) {
        hints.push(hint);
      }

      if (missingFields.length > 0) {
        hints.push(`❌ Thiếu: ${missingFields.join(", ")}`);
      }

      if (invalidFields.length > 0) {
        hints.push(`⚠️ Không hợp lệ: ${invalidFields.join(", ")}`);
      }

      if (details.length > 0) {
        details.forEach((detail) => {
          if (detail.message) {
            hints.push(`• ${detail.message}`);
          }
        });
      }

      // Status-specific hints
      if (status === 400) {
        if (hints.length === 0) {
          hints.push("Vui lòng kiểm tra lại thông tin đã nhập");
          hints.push("Đảm bảo tất cả trường bắt buộc đã được điền");
        }
      } else if (status === 401) {
        hints.push("Phiên đăng nhập đã hết hạn");
        hints.push("Vui lòng đăng nhập lại để tiếp tục");
      } else if (status === 403) {
        hints.push("Bạn không có quyền thực hiện thao tác này");
        hints.push("Liên hệ quản lý để được cấp quyền");
      } else if (status === 404) {
        hints.push("Dữ liệu không tồn tại hoặc đã bị xóa");
        hints.push("Thử làm mới trang để cập nhật danh sách");
      } else if (status === 409) {
        hints.push("Dữ liệu đã tồn tại trong hệ thống");
        if (existingId) {
          hints.push(`ID bản ghi: ${existingId}`);
        }
        hints.push("Vui lòng cập nhật bản ghi hiện có hoặc tạo bản sao");
      } else if (status >= 500) {
        hints.push("Lỗi server, vui lòng thử lại sau");
        hints.push("Nếu lỗi vẫn tiếp tục, liên hệ hỗ trợ kỹ thuật");
      }

      showNotification(
        "error",
        errorMessage,
        context ? `Lỗi khi ${context}` : null,
        hints,
        8
      );

      return errorMessage;
    },
    [showNotification]
  );

  // ==================== API HELPER ====================
  const fetchWithAuth = useCallback(
    async (url, options = {}) => {
      try {
        const response = await axios({
          url,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...options,
        });
        return response;
      } catch (error) {
        throw error;
      }
    },
    [token]
  );

  // ==================== CALCULATION FUNCTIONS ====================
  const calculateTax = useCallback((values) => {
    try {
      const declared = Number(values.declaredRevenue) || 0;
      const gtgtRate = Number(values.gtgtRate || TAX_RATES.DEFAULT_GTGT);
      const tncnRate = Number(values.tncnRate || TAX_RATES.DEFAULT_TNCN);

      const gtgt = (declared * gtgtRate) / 100;
      const tncn = (declared * tncnRate) / 100;
      const total = gtgt + tncn;

      return { gtgt, tncn, total, gtgtRate, tncnRate };
    } catch {
      return { gtgt: 0, tncn: 0, total: 0, gtgtRate: 0, tncnRate: 0 };
    }
  }, []);

  // ==================== VALIDATION ====================
  const validateForm = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (!periodType) {
      errors.push("Chưa chọn kỳ kê khai (tháng/quý/năm/tùy chỉnh)");
    }

    if (!periodKey && periodType !== "custom") {
      errors.push("Chưa chọn tháng/quý/năm cụ thể");
    }

    if (periodType === "custom" && monthRange.length !== 2) {
      errors.push("Chưa chọn khoảng thời gian tùy chỉnh (từ tháng - đến tháng)");
    }

    const declaredRevenue = form.getFieldValue("declaredRevenue");
    if (!declaredRevenue || declaredRevenue <= 0) {
      errors.push("Doanh thu kê khai phải lớn hơn 0");
    }

    // Warning: Revenue difference
    if (systemRevenue && declaredRevenue) {
      const diff = Math.abs(declaredRevenue - systemRevenue);
      const diffPercent = (diff / systemRevenue) * 100;
      if (diffPercent > 20) {
        warnings.push(
          `Doanh thu kê khai chênh lệch ${diffPercent.toFixed(
            1
          )}% so với hệ thống (${formatVND(diff)})`
        );
      }
    }

    // Check category revenue total vs declared revenue
    if (categoryRevenues.length > 0 && declaredRevenue) {
      const categoryTotal = categoryRevenues.reduce(
        (sum, cat) => sum + (Number(cat.revenue) || 0),
        0
      );
      if (Math.abs(categoryTotal - declaredRevenue) > 1000) {
        warnings.push(
          `Tổng doanh thu theo ngành nghề (${formatVND(
            categoryTotal
          )}) không khớp với doanh thu kê khai (${formatVND(
            declaredRevenue
          )})`
        );
      }
    }

    // Warning: Missing taxpayer info
    const taxpayerName = form.getFieldValue("taxpayerName");
    const taxCode = form.getFieldValue("taxCode");
    if (!taxpayerName) {
      warnings.push("Chưa nhập tên người nộp thuế - Nên bổ sung để tờ khai đầy đủ");
    }
    if (!taxCode) {
      warnings.push("Chưa nhập mã số thuế - Bắt buộc khi nộp cho cơ quan thuế");
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [periodType, periodKey, monthRange, form, systemRevenue, categoryRevenues]);

  // ==================== API CALLS ====================
  const fetchPreview = async () => {
    console.log("\n📤 === FETCH PREVIEW ===");

    if (!storeId) {
      showNotification(
        "warning",
        "Chưa chọn cửa hàng",
        "Vui lòng chọn cửa hàng trước khi kê khai thuế",
        [
          "🏪 Truy cập trang quản lý cửa hàng",
          "✓ Chọn cửa hàng bạn muốn kê khai",
          "🔄 Quay lại trang này sau khi chọn",
        ]
      );
      return;
    }

    if (!periodType) {
      showNotification(
        "warning",
        "Thiếu thông tin",
        "Vui lòng chọn đầy đủ thông tin trước khi xem doanh thu",
        [
          "✓ Chọn kỳ kê khai (tháng/quý/năm/tùy chỉnh)",
          "✓ Chọn thời gian cụ thể",
          "✓ Đảm bảo đã chọn cửa hàng",
        ]
      );
      return;
    }

    if (!hasValidPeriod) {
      const periodNames = {
        month: "tháng",
        quarter: "quý",
        year: "năm",
      };
      showNotification(
        "warning",
        "Chưa chọn kỳ",
        `Vui lòng chọn ${periodNames[periodType] || "kỳ"} cụ thể`,
        [
          `📅 Nhấn vào ô chọn ${periodNames[periodType] || "thời gian"}`,
          `🗓️ Chọn ${periodNames[periodType] || "kỳ"} bạn muốn kê khai thuế`,
          periodType === "custom"
            ? "⏳ Chọn cả tháng bắt đầu và kết thúc"
            : "",
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ storeId, periodType });
      if (periodType === "custom" && monthRange.length === 2) {
        params.append("monthFrom", monthRange[0].format("YYYY-MM"));
        params.append("monthTo", monthRange[1].format("YYYY-MM"));
      } else if (periodKey) {
        params.append("periodKey", periodKey);
      }

      console.log("📤 Fetching preview:", `${apiUrl}/taxs/preview?${params}`);

      const res = await fetchWithAuth(`${apiUrl}/taxs/preview?${params}`);

      const revenue = res.data.systemRevenue || 0;
      const count = res.data.orderCount || 0;

      setSystemRevenue(revenue);
      setOrderCount(count);

      // Set declared revenue but allow user to change it
      form.setFieldsValue({ declaredRevenue: revenue });

      showNotification(
        "success",
        "✅ Đã tải doanh thu thành công",
        `Doanh thu hệ thống: ${formatVND(revenue)}`,
        [
          `Tổng ${count} đơn hàng đã thanh toán`,
          `Kỳ: ${periodDisplay}`,
          "Bạn có thể điều chỉnh doanh thu kê khai nếu cần",
          "Tiếp theo: Nhấn 'Tính thuế' để xem số thuế phải nộp",
        ],
        8
      );
    } catch (err) {
      handleApiError(err, "Lỗi tải doanh thu hệ thống", "tải doanh thu");
    } finally {
      setLoading(false);
    }
  };

  const fetchDeclarations = useCallback(async () => {
    if (!storeId) return;

    console.log("\n📤 === FETCH DECLARATIONS ===");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        storeId,
        page: currentPage,
        limit: pageSize,
      });

      console.log("📤 Fetching declarations:", `${apiUrl}/taxs?${params}`);

      const res = await fetchWithAuth(`${apiUrl}/taxs?${params}`);

      setDeclarations(res.data.data || []);
      setTotalCount(res.data.pagination?.total || 0);

      console.log(`✅ Loaded ${res.data.data?.length || 0} declarations`);
    } catch (err) {
      handleApiError(err, "Lỗi tải danh sách tờ khai", "tải danh sách");
    } finally {
      setLoading(false);
    }
  }, [storeId, fetchWithAuth, currentPage, pageSize, handleApiError]);

  const fetchDeclaration = async (id) => {
    try {
      console.log("📤 Fetching declaration:", id);
      const res = await fetchWithAuth(`${apiUrl}/taxs/${id}`);
      return res.data.data || res.data.declaration;
    } catch (err) {
      throw err;
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (storeId && token) {
      fetchDeclarations();
    }
  }, [storeId, token, fetchDeclarations]);

  // Auto-calculate tax when revenue or rates change
  useEffect(() => {
    const values = form.getFieldsValue();
    if (values.declaredRevenue && values.declaredRevenue > 0) {
      const result = calculateTax(values);
      setCalculatedTax(result);
    }
  }, [form, calculateTax]);

  // ==================== EVENT HANDLERS ====================
  const handleTypeChange = (value) => {
    console.log("📝 Period type changed:", value);

    setPeriodType(value);
    setPeriodKey("");
    setMonthRange([]);
    setPickerValue(null);
    setSystemRevenue(null);
    setOrderCount(0);
    form.resetFields();
    setCalculatedTax(null);

    const typeConfig = PERIOD_TYPES.find((t) => t.value === value);

    showNotification(
      "info",
      `Đã chọn kê khai theo ${typeConfig?.label || value}`,
      typeConfig?.description || `Bạn đang kê khai thuế theo ${value}`,
      [
        value === "month"
          ? "⏭️ Tiếp theo: Chọn tháng cụ thể"
          : value === "quarter"
            ? "⏭️ Tiếp theo: Chọn quý cụ thể"
            : value === "year"
              ? "⏭️ Tiếp theo: Chọn năm cụ thể"
              : "⏭️ Tiếp theo: Chọn khoảng thời gian (từ tháng - đến tháng)",
        "Sau khi chọn xong, nhấn 'Xem doanh thu hệ thống'",
      ],
      5
    );
  };

  const handlePeriodChange = (date) => {
    if (!date) return;

    let key = "";
    if (periodType === "month") key = date.format("YYYY-MM");
    else if (periodType === "quarter") key = `${date.year()}-Q${date.quarter()}`;
    else if (periodType === "year") key = date.year().toString();

    setPeriodKey(key);
    setPickerValue(date);

    message.success({
      content: `✅ Đã chọn: ${key}`,
      duration: 2,
    });
  };

  const handleMonthRangeChange = (dates) => {
    setMonthRange(dates || []);
    if (dates && dates.length === 2) {
      message.success({
        content: `✅ Đã chọn từ ${dates[0].format("MM/YYYY")} đến ${dates[1].format(
          "MM/YYYY"
        )}`,
        duration: 2,
      });
    }
  };

  const handleSubmit = async (values) => {
    console.log("\n📤 === SUBMIT TAX DECLARATION ===");

    // Validate
    const validation = validateForm();

    if (!validation.isValid) {
      showNotification(
        "error",
        "Thông tin chưa đầy đủ",
        "Vui lòng kiểm tra và điền đầy đủ thông tin",
        validation.errors,
        8
      );
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      Modal.confirm({
        title: "⚠️ Cảnh báo",
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <Paragraph>Phát hiện một số vấn đề cần lưu ý:</Paragraph>
            <ul style={{ paddingLeft: 20 }}>
              {validation.warnings.map((w, idx) => (
                <li key={idx} style={{ marginBottom: 8 }}>
                  {w}
                </li>
              ))}
            </ul>
            <Paragraph strong style={{ marginTop: 16 }}>
              Bạn có muốn tiếp tục lưu tờ khai?
            </Paragraph>
          </div>
        ),
        okText: "Tiếp tục lưu",
        cancelText: "Hủy bỏ",
        onOk: () => performSubmit(values),
      });
    } else {
      performSubmit(values);
    }
  };

  const performSubmit = async (values) => {
    console.log("📤 Performing submit...");

    setLoading(true);

    try {
      const url = `${apiUrl}/taxs`;

      const payload = {
        storeId,
        periodType,
        declaredRevenue: values.declaredRevenue,
        taxRates: {
          gtgt: values.gtgtRate || TAX_RATES.DEFAULT_GTGT,
          tncn: values.tncnRate || TAX_RATES.DEFAULT_TNCN,
        },
        isFirstTime: values.isFirstTime !== false,
        supplementNumber: values.supplementNumber || 0,
        revenueByCategory: categoryRevenues.map((cat) => ({
          category: cat.category,
          revenue: cat.revenue || 0,
          gtgtTax: cat.gtgtTax || 0,
          tncnTax: cat.tncnTax || 0,
        })),
        specialConsumptionTax: specialTaxItems.map((item) => ({
          itemName: item.itemName || "",
          unit: item.unit || "",
          revenue: item.revenue || 0,
          taxRate: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
        })),
        environmentalTax: envTaxItems.map((item) => ({
          type: item.type || "environmental_tax",
          itemName: item.itemName || "",
          unit: item.unit || "",
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          taxRate: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
        })),
        notes: values.notes || "",
        taxpayerInfo: {
          name: values.taxpayerName || currentStore.owner_name || "",
          storeName: values.storeName || currentStore.name || "",
          bankAccount: values.bankAccount || currentStore.bankAccount || "",
          taxCode: values.taxCode || currentStore.taxCode || "",
          businessSector: values.businessSector || currentStore.businessSector || "",
          businessArea: values.businessArea || currentStore.area || 0,
          isRented: values.isRented || false,
          employeeCount: values.employeeCount || 0,
          workingHours: {
            from: values.workingHoursFrom || "08:00",
            to: values.workingHoursTo || "22:00",
          },
          businessAddress: {
            full: values.businessAddressFull || currentStore.address || "",
            street: values.businessAddressStreet || "",
            ward: values.businessAddressWard || "",
            district: values.businessAddressDistrict || "",
            province: values.businessAddressProvince || "",
          },
          phone: values.phone || currentStore.phone || "",
          email: values.email || currentStore.email || "",
        },
      };

      if (periodType === "custom" && monthRange.length === 2) {
        payload.periodKey = `${monthRange[0].format("YYYY-MM")}_${monthRange[1].format(
          "YYYY-MM"
        )}`;
      } else {
        payload.periodKey = periodKey;
      }

      console.log("📤 Sending payload:", JSON.stringify(payload, null, 2));

      const response = await fetchWithAuth(url, {
        method: "POST",
        data: payload,
      });

      console.log("✅ Response:", response.data);

      // Success notification
      const tax = calculatedTax || calculateTax(values);
      showNotification(
        "success",
        "✅ Tạo tờ khai mới thành công",
        `Tờ khai thuế kỳ ${periodDisplay} đã được tạo mới`,
        [
          `💰 Doanh thu: ${formatVND(values.declaredRevenue)}`,
          `📊 Thuế GTGT: ${formatVND(tax.gtgt)}`,
          `👤 Thuế TNCN: ${formatVND(tax.tncn)}`,
          `💳 Tổng thuế: ${formatVND(tax.total)}`,
          "📋 Bạn có thể xem chi tiết trong danh sách bên dưới",
        ],
        8
      );

      // Reset form
      form.resetFields();
      setSystemRevenue(null);
      setOrderCount(0);
      setCalculatedTax(null);
      setCategoryRevenues([]);
      setSpecialTaxItems([]);
      setEnvTaxItems([]);

      fetchDeclarations();
    } catch (err) {
      handleApiError(err, "Lỗi lưu tờ khai", "tạo tờ khai mới");
    } finally {
      setLoading(false);
    }
  };

  const useSystemRevenue = () => {
    if (!systemRevenue) {
      showNotification(
        "warning",
        "Chưa có doanh thu hệ thống",
        "Vui lòng xem trước doanh thu trước khi áp dụng",
        [
          "📊 Nhấn nút 'Xem doanh thu hệ thống' ở trên",
          "✓ Chọn đầy đủ kỳ kê khai trước",
          "💡 Hệ thống sẽ tính tổng đơn hàng đã thanh toán trong kỳ",
        ]
      );
      return;
    }
    form.setFieldsValue({ declaredRevenue: systemRevenue });
    Swal.fire({
      icon: "success",
      title: "Đã áp dụng",
      text: `Doanh thu: ${formatVND(systemRevenue)}, tổng số đơn là: ${orderCount} đơn hàng`,
      confirmButtonText: "OK",
      timer: 2000,
    });
  };

  const handleCalculateTax = useCallback(() => {
    console.log("🧮 Calculating tax...");

    try {
      const values = form.getFieldsValue();

      if (!values.declaredRevenue || values.declaredRevenue <= 0) {
        showNotification(
          "warning",
          "Chưa nhập doanh thu",
          "Vui lòng nhập doanh thu kê khai trước khi tính thuế",
          [
            "📝 Nhập vào ô 'Doanh thu kê khai'",
            "💡 Hoặc nhấn 'Áp dụng doanh thu hệ thống'",
            "⚠️ Doanh thu phải lớn hơn 0",
          ]
        );
        return;
      }

      const result = calculateTax(values);
      setCalculatedTax(result);

      showNotification(
        "success",
        "✅ Đã tính thuế thành công",
        `Tổng thuế phải nộp: ${formatVND(result.total)}`,
        [
          `💰 Doanh thu kê khai: ${formatVND(values.declaredRevenue)}`,
          `📊 Thuế GTGT (${result.gtgtRate}%): ${formatVND(result.gtgt)}`,
          `👤 Thuế TNCN (${result.tncnRate}%): ${formatVND(result.tncn)}`,
          `💳 Tổng cộng: ${formatVND(result.total)}`,
          `🔤 Bằng chữ: ${readNumberSafe(result.total)} đồng`,
          "⏭️ Tiếp theo: Nhấn 'Lưu tờ khai' để hoàn tất",
        ],
        10
      );
    } catch (error) {
      console.error("Calculate tax error:", error);
      handleApiError(error, "Lỗi tính toán thuế", "tính thuế");
    }
  }, [form, calculateTax, showNotification, handleApiError]);

  const handleAction = async (
    url,
    method = "POST",
    data = {},
    successMsg = "Thành công",
    successHints = []
  ) => {
    console.log(`🔧 Action: ${method} ${url}`);

    setLoading(true);

    try {
      const response = await fetchWithAuth(url, { method, data });

      if (successHints.length > 0) {
        showNotification("success", successMsg, null, successHints, 5);
      } else {
        message.success(successMsg);
      }

      fetchDeclarations();
    } catch (err) {
      handleApiError(err, "Lỗi xử lý", method.toLowerCase());
    } finally {
      setLoading(false);
    }
  };

  const handleClone = (id) =>
    handleAction(
      `${apiUrl}/taxs/${id}/clone`,
      "POST",
      {},
      "✅ Đã tạo bản sao",
      [
        "Bản sao đã được tạo với trạng thái 'Nháp'",
        "Bạn có thể chỉnh sửa bản sao này",
        "Xem trong danh sách bên dưới",
      ]
    );

  const handleDelete = (id) =>
    handleAction(
      `${apiUrl}/taxs/${id}`,
      "DELETE",
      {},
      "✅ Đã xóa tờ khai",
      [
        "Tờ khai đã bị xóa khỏi hệ thống",
        "Nếu có bản sao, bản sao sẽ được nâng lên thành bản chính",
      ]
    );

  const handleApproveReject = (id, action) =>
    handleAction(
      `${apiUrl}/taxs/${id}/approve`,
      "POST",
      { action },
      action === "approve" ? "✅ Đã duyệt tờ khai" : "❌ Đã từ chối tờ khai",
      action === "approve"
        ? ["Tờ khai đã được duyệt", "Có thể export PDF để nộp cho cơ quan thuế"]
        : ["Tờ khai đã bị từ chối", "Người tạo cần chỉnh sửa và nộp lại"]
    );

  const handleExport = async (id, format) => {
    console.log(`📥 Exporting as ${format}...`);

    try {
      message.loading({
        content: `Đang xuất file ${format.toUpperCase()}...`,
        key: "export",
      });

      const res = await fetchWithAuth(
        `${apiUrl}/taxs/${id}/export?format=${format}&storeId=${storeId}`,
        { responseType: "blob" }
      );

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `to-khai-thue_${id}_${dayjs().format("YYYYMMDD")}.${format}`;
      link.click();

      message.success({
        content: `✅ Tải file ${format.toUpperCase()} thành công`,
        key: "export",
      });

      showNotification(
        "success",
        "✅ Xuất file thành công",
        `File ${format.toUpperCase()} đã được tải xuống`,
        [
          "📁 Kiểm tra thư mục Downloads của bạn",
          format === "pdf"
            ? "📄 File PDF theo mẫu 01/CNKD chính thức"
            : "📊 File CSV có thể mở bằng Excel",
          "💡 Bạn có thể in hoặc gửi file này cho cơ quan thuế",
        ],
        6
      );
    } catch (err) {
      message.error({
        content: "Lỗi tải file",
        key: "export",
      });
      handleApiError(err, "Lỗi xuất file", `xuất file ${format}`);
    }
  };

  const handleDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  // ==================== CATEGORY REVENUE HANDLERS ====================
  const addCategoryRevenue = () => {
    setCategoryRevenues([
      ...categoryRevenues,
      {
        category: "goods_distribution",
        revenue: 0,
        gtgtTax: 0,
        tncnTax: 0,
      },
    ]);
    message.info("✅ Đã thêm ngành nghề mới");
  };

  const removeCategoryRevenue = (index) => {
    setCategoryRevenues(categoryRevenues.filter((_, i) => i !== index));
    message.info("🗑️ Đã xóa ngành nghề");
  };

  const updateCategoryRevenue = (index, field, value) => {
    const newCategories = [...categoryRevenues];
    newCategories[index][field] = value;
    setCategoryRevenues(newCategories);
  };

  // ==================== SPECIAL TAX HANDLERS ====================
  const addSpecialTaxItem = () => {
    setSpecialTaxItems([
      ...specialTaxItems,
      {
        itemName: "",
        unit: "",
        revenue: 0,
        taxRate: 0,
        taxAmount: 0,
      },
    ]);
    message.info("✅ Đã thêm hàng hóa chịu thuế TTĐB");
  };

  const removeSpecialTaxItem = (index) => {
    setSpecialTaxItems(specialTaxItems.filter((_, i) => i !== index));
    message.info("🗑️ Đã xóa hàng hóa TTĐB");
  };

  const updateSpecialTaxItem = (index, field, value) => {
    const newItems = [...specialTaxItems];
    newItems[index][field] = value;
    if (field === "revenue" || field === "taxRate") {
      newItems[index].taxAmount =
        (newItems[index].revenue * newItems[index].taxRate) / 100;
    }
    setSpecialTaxItems(newItems);
  };

  // ==================== ENV TAX HANDLERS ====================
  const addEnvTaxItem = () => {
    setEnvTaxItems([
      ...envTaxItems,
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
    message.info("✅ Đã thêm mục thuế môi trường");
  };

  const removeEnvTaxItem = (index) => {
    setEnvTaxItems(envTaxItems.filter((_, i) => i !== index));
    message.info("🗑️ Đã xóa mục thuế môi trường");
  };

  const updateEnvTaxItem = (index, field, value) => {
    const newItems = [...envTaxItems];
    newItems[index][field] = value;
    if (["quantity", "unitPrice", "taxRate"].includes(field)) {
      newItems[index].taxAmount =
        (newItems[index].quantity *
          newItems[index].unitPrice *
          newItems[index].taxRate) /
        100;
    }
    setEnvTaxItems(newItems);
  };

  // ==================== TABLE COLUMNS ====================
  const columns = useMemo(
    () => [
      {
        title: "STT",
        dataIndex: "index",
        key: "index",
        width: 60,
        render: (_value, _record, index) => index + 1,
        align: "center",
        fixed: "left",
      },
      {
        title: "Kỳ kê khai",
        dataIndex: "periodKey",
        key: "periodKey",
        width: 150,
        sorter: (a, b) => a.periodKey.localeCompare(b.periodKey),
      },
      {
        title: "Phiên bản",
        dataIndex: "version",
        key: "version",
        width: 120,
        render: (v, record) => (
          <Space>
            <Tag color={record.isClone ? "orange" : "blue"}>V{v}</Tag>
            {record.isClone && <Tag color="orange">Bản sao</Tag>}
          </Space>
        ),
      },
      {
        title: "Doanh thu",
        dataIndex: "declaredRevenue",
        key: "declaredRevenue",
        render: (v) => <Text>{formatVND(v)}</Text>,
        sorter: (a, b) =>
          Number(a.declaredRevenue) - Number(b.declaredRevenue),
        width: 150,
      },
      {
        title: "Tổng thuế",
        dataIndex: ["taxAmounts", "total"],
        key: "total",
        render: (v) => (
          <Text strong style={{ color: "#d4380d" }}>
            {formatVND(v)}
          </Text>
        ),
        sorter: (a, b) =>
          Number(a.taxAmounts?.total || 0) -
          Number(b.taxAmounts?.total || 0),
        width: 150,
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => {
          const config =
            STATUS_CONFIG[status] || { text: status, color: "default", icon: null };
          return (
            <Tag color={config.color} icon={config.icon}>
              {config.text}
            </Tag>
          );
        },
        filters: Object.keys(STATUS_CONFIG).map((key) => ({
          text: STATUS_CONFIG[key].text,
          value: key,
        })),
        onFilter: (value, record) => record.status === value,
      },
      {
        title: "Ngày tạo",
        dataIndex: "createdAt",
        width: 120,
        render: (t) => (
          <Tooltip title={dayjs(t).format("DD/MM/YYYY HH:mm")}>
            {dayjs(t).format("DD/MM/YYYY")}
          </Tooltip>
        ),
        sorter: (a, b) =>
          dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      },
      {
        title: "Hành động",
        key: "actions",
        width: 150,
        render: (_, record) => (
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleDetail(record)}
              />
            </Tooltip>
            {["draft", "saved"].includes(record.status) && (
              <Tooltip title="Chỉnh sửa">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record._id)}
                />
              </Tooltip>
            )}
            <Tooltip title="Nhân bản">
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleClone(record._id)}
              />
            </Tooltip>
            {record.status === "submitted" && (
              <>
                <Tooltip title="Duyệt tờ khai">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleApproveReject(record._id, "approve")}
                  />
                </Tooltip>
                <Tooltip title="Từ chối">
                  <Popconfirm
                    title="Từ chối tờ khai?"
                    description="Tờ khai sẽ chuyển về trạng thái 'Từ chối'"
                    onConfirm={() =>
                      handleApproveReject(record._id, "reject")
                    }
                    okText="Từ chối"
                    cancelText="Hủy"
                  >
                    <Button size="small" danger icon={<UndoOutlined />} />
                  </Popconfirm>
                </Tooltip>
              </>
            )}
            <Popconfirm
              title="Xóa tờ khai?"
              description="Hành động này không thể hoàn tác"
              onConfirm={() => handleDelete(record._id)}
              okText="Xóa"
              okType="danger"
              cancelText="Hủy"
            >
              <Tooltip title="Xóa">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    key="csv"
                    icon={<FileExcelOutlined />}
                    onClick={() => handleExport(record._id, "csv")}
                  >
                    Xuất CSV
                  </Menu.Item>
                  <Menu.Item
                    key="pdf"
                    icon={<FilePdfOutlined />}
                    onClick={() => handleExport(record._id, "pdf")}
                  >
                    Xuất PDF (Mẫu 01/CNKD)
                  </Menu.Item>
                </Menu>
              }
            >
              <Button size="small" icon={<DownloadOutlined />} />
            </Dropdown>
          </Space>
        ),
      },
    ],
    []
  );

  // ==================== RENDER ====================
  if (!storeId || !token) {
    return (
      <Layout>
        <div style={{ padding: "24px", textAlign: "center" }}>
          <Result
            status="warning"
            title="Vui lòng đăng nhập và chọn cửa hàng"
            subTitle="Bạn cần đăng nhập và chọn cửa hàng để sử dụng chức năng kê khai thuế"
            extra={
              <Space>
                <Button type="primary" href="/login" icon={<UserOutlined />}>
                  Đăng nhập
                </Button>
                <Button href="/stores" icon={<ShopOutlined />}>
                  Chọn cửa hàng
                </Button>
              </Space>
            }
          />
        </div>
      </Layout>
    );
  }

  const handleEdit = async (id) => {
    try {
      const declaration = await fetchDeclaration(id);
      if (!declaration) {
        message.error("Không tìm thấy tờ khai");
        return;
      }

      // Set period type & key from declaration
      setPeriodType(declaration.periodType || "month");
      setPeriodKey(declaration.periodKey || "");
      if (declaration.periodType === "custom" && declaration.periodKey) {
        const [from, to] = declaration.periodKey.split("_");
        setMonthRange([dayjs(from), dayjs(to)]);
      } else {
        setPickerValue(dayjs());
      }

      // Set form values
      form.setFieldsValue({
        declaredRevenue: declaration.declaredRevenue,
        gtgtRate: declaration.taxRates?.gtgt || TAX_RATES.DEFAULT_GTGT,
        tncnRate: declaration.taxRates?.tncn || TAX_RATES.DEFAULT_TNCN,
        isFirstTime: declaration.isFirstTime,
        supplementNumber: declaration.supplementNumber || 0,
        taxpayerName: declaration.taxpayerInfo?.name,
        storeName: declaration.taxpayerInfo?.storeName,
        bankAccount: declaration.taxpayerInfo?.bankAccount,
        taxCode: declaration.taxpayerInfo?.taxCode,
        businessSector: declaration.taxpayerInfo?.businessSector,
        businessArea: declaration.taxpayerInfo?.businessArea,
        isRented: declaration.taxpayerInfo?.isRented,
        employeeCount: declaration.taxpayerInfo?.employeeCount,
        workingHoursFrom: declaration.taxpayerInfo?.workingHours?.from,
        workingHoursTo: declaration.taxpayerInfo?.workingHours?.to,
        businessAddressFull: declaration.taxpayerInfo?.businessAddress?.full,
        phone: declaration.taxpayerInfo?.phone,
        email: declaration.taxpayerInfo?.email,
        notes: declaration.notes,
      });

      setCategoryRevenues(
        declaration.revenueByCategory || [
          {
            category: "goods_distribution",
            revenue: 0,
            gtgtTax: 0,
            tncnTax: 0,
          },
        ]
      );
      setSpecialTaxItems(declaration.specialConsumptionTax || []);
      setEnvTaxItems(declaration.environmentalTax || []);

      const tax = calculateTax({
        declaredRevenue: declaration.declaredRevenue,
        gtgtRate: declaration.taxRates?.gtgt || TAX_RATES.DEFAULT_GTGT,
        tncnRate: declaration.taxRates?.tncn || TAX_RATES.DEFAULT_TNCN,
      });
      setCalculatedTax(tax);

      showNotification(
        "info",
        "Đang chỉnh sửa tờ khai",
        `Kỳ kê khai: ${declaration.periodKey}`,
        [
          `Doanh thu: ${formatVND(declaration.declaredRevenue)}`,
          `Tổng thuế: ${formatVND(tax.total)}`,
          "Sau khi chỉnh sửa, nhấn 'Lưu tờ khai' để cập nhật",
        ]
      );
    } catch (error) {
      handleApiError(error, "Lỗi tải tờ khai", "tải tờ khai để chỉnh sửa");
    }
  };

  return (
    <ErrorBoundary>
      <Layout>
        <Spin spinning={loading} size="large" tip="Đang xử lý...">
          <div>
            <Space direction="vertical" size={24} style={{ width: "100%" }}>
              {/* HEADER */}
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  border: "1px solid #8c8c8c",
                }}
              >
                <Row gutter={24} align="middle">
                  <Col xs={24} lg={6}>
                    <Space direction="vertical">
                      <Title
                        level={2}
                        style={{
                          margin: 0,
                          color: "#1890ff",
                          lineHeight: 1.2,
                        }}
                      >
                        {currentStore.name}
                      </Title>
                      <Text
                        type="secondary"
                        style={{
                          color: "#595959",
                          fontSize: "16px",
                          display: "block",
                          marginTop: 4,
                        }}
                      >
                        Kê khai thuế - {currentStore.phone}
                      </Text>
                      {currentStore.taxCode && (
                        <Text
                          type="secondary"
                          style={{
                            color: "#595959",
                            fontSize: "16px",
                            display: "block",
                            marginTop: 4,
                          }}
                        >
                          <IdcardOutlined /> MST: {currentStore.taxCode}
                        </Text>
                      )}
                    </Space>
                  </Col>
                  <Col xs={24} lg={5}>
                    <Form.Item label="Kỳ kê khai" style={{ marginBottom: 0 }}>
                      <Select
                        value={periodType}
                        onChange={handleTypeChange}
                        style={{ width: "100%" }}
                        size="large"
                        placeholder="Chọn kỳ..."
                      >
                        {PERIOD_TYPES.map((type) => (
                          <Option key={type.value} value={type.value}>
                            {type.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={7}>
                    <Form.Item
                      label={
                        periodType === "custom"
                          ? "Khoảng thời gian"
                          : "Chọn kỳ"
                      }
                      style={{ marginBottom: 0 }}
                    >
                      {periodType === "custom" ? (
                        <RangePicker
                          picker="month"
                          value={monthRange}
                          onChange={handleMonthRangeChange}
                          style={{ width: "100%" }}
                          size="large"
                          placeholder={["Từ tháng", "Đến tháng"]}
                          format="MM/YYYY"
                        />
                      ) : periodType ? (
                        <DatePicker
                          picker={periodType}
                          value={pickerValue}
                          onChange={handlePeriodChange}
                          style={{ width: "100%" }}
                          size="large"
                          placeholder={`Chọn ${periodType === "month"
                            ? "tháng"
                            : periodType === "quarter"
                              ? "quý"
                              : "năm"
                            }`}
                        />
                      ) : (
                        <Input
                          placeholder="Chọn kỳ kê khai trước"
                          disabled
                          size="large"
                        />
                      )}
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={6}>
                    <Button
                      type="primary"
                      block
                      size="large"
                      onClick={fetchPreview}
                      loading={loading}
                      disabled={!hasValidPeriod}
                      icon={<SyncOutlined />}
                      style={{ height: 56 }}
                    >
                      Xem doanh thu hệ thống
                    </Button>
                  </Col>
                </Row>
              </Card>

              {/* FORM KÊ KHAI CHI TIẾT */}
              {systemRevenue !== null && (
                <Card
                  title={
                    <Space>
                      <FileDoneOutlined style={{ fontSize: 20 }} />
                      <Text strong style={{ fontSize: 16 }}>
                        Kê khai thuế GTGT & TNCN theo Mẫu 01/CNKD
                      </Text>
                    </Space>
                  }
                  extra={
                    <Space size={12} align="center">
                      <Space size={6} align="center">
                        <Badge count={orderCount} showZero />
                        <Text type="secondary">Đơn hàng, trong kỳ</Text>
                      </Space>

                      <Tag color="blue">{periodDisplay}</Tag>
                    </Space>
                  }
                  style={{
                    borderRadius: 12,
                    border: "1px solid #8c8c8c",
                  }}
                >
                  <Row gutter={24} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={12}>
                      <Statistic
                        title={
                          <Space>
                            <InfoCircleOutlined />
                            <span>💰 Doanh thu hệ thống (tham khảo)</span>
                          </Space>
                        }
                        value={systemRevenue}
                        precision={0}
                        formatter={(value) => formatVND(value)}
                        suffix={
                          <Text
                            type="secondary"
                            style={{ fontSize: 14 }}
                          >{`(${orderCount} đơn)`}</Text>
                        }
                      />
                    </Col>
                    <Col xs={24} md={12}>
                      <Button
                        block
                        size="large"
                        onClick={useSystemRevenue}
                        icon={<CalculatorOutlined />}
                        style={{ height: 64, fontSize: 16 }}
                      >
                        Áp dụng doanh thu hệ thống
                      </Button>
                    </Col>
                  </Row>

                  <Divider />

                  <Form
                    form={form}
                    onFinish={handleSubmit}
                    layout="vertical"
                    onFinishFailed={(errorInfo) => {
                      console.log("❌ Form validation failed:", errorInfo);
                      const errors = errorInfo.errorFields.map(
                        (f) => f.errors[0]
                      );
                      showNotification(
                        "error",
                        "Form chưa hợp lệ",
                        "Vui lòng kiểm tra lại các trường bắt buộc",
                        errors
                      );
                    }}
                  >
                    <Collapse
                      defaultActiveKey={["1", "2", "3"]}
                      style={{ marginBottom: 24 }}
                      bordered={false}
                    >
                      {/* PHẦN 1: THÔNG TIN CƠ BẢN */}
                      <Panel
                        header={
                          <Space>
                            <FileDoneOutlined />
                            <Text strong>[01-03] Thông tin kỳ kê khai</Text>
                          </Space>
                        }
                        key="1"
                      >
                        <Row gutter={24}>
                          <Col span={12}>
                            <Form.Item
                              name="isFirstTime"
                              label="[02] Lần đầu kê khai"
                              valuePropName="checked"
                              initialValue={true}
                              tooltip="Đánh dấu nếu đây là lần đầu tiên kê khai thuế cho kỳ này"
                            >
                              <Checkbox>
                                Đánh dấu nếu là lần đầu kê khai thuế
                              </Checkbox>
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="supplementNumber"
                              label="[03] Bổ sung lần thứ"
                              initialValue={0}
                              tooltip="Nhập số lần bổ sung (0 nếu là lần đầu)"
                            >
                              <InputNumber
                                min={0}
                                max={10}
                                style={{ width: "100%" }}
                                placeholder="Nhập 0 nếu là lần đầu"
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Panel>

                      {/* PHẦN 2: THÔNG TIN NGƯỜI NỘP THUẾ */}
                      <Panel
                        header={
                          <Space>
                            <UserOutlined />
                            <Text strong>
                              [04-16] Thông tin người nộp thuế
                            </Text>
                          </Space>
                        }
                        key="2"
                      >
                        <Alert
                          message="💡 Gợi ý"
                          description="Các thông tin này sẽ tự động lấy từ thông tin cửa hàng. Bạn có thể chỉnh sửa nếu cần."
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                          closable
                        />
                        <Row gutter={24}>
                          <Col span={12}>
                            <Form.Item
                              name="taxpayerName"
                              label="[04] Người nộp thuế"
                              tooltip="Họ tên đầy đủ của người nộp thuế"
                              initialValue={currentStore.owner_name}
                            >
                              <Input
                                prefix={<UserOutlined />}
                                placeholder="Họ tên đầy đủ"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="storeName"
                              label="[05] Tên cửa hàng/thương hiệu"
                              tooltip="Tên cửa hàng hoặc thương hiệu"
                              initialValue={currentStore.name}
                            >
                              <Input
                                prefix={<ShopOutlined />}
                                placeholder="Tên cửa hàng"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="bankAccount"
                              label="[06] Tài khoản ngân hàng"
                              tooltip="Số tài khoản ngân hàng dùng để thanh toán thuế"
                              initialValue={currentStore.bankAccount}
                            >
                              <Input
                                prefix={<BankOutlined />}
                                placeholder="Số tài khoản"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="taxCode"
                              label="[07] Mã số thuế"
                              tooltip="Mã số thuế của cá nhân/hộ kinh doanh"
                              initialValue={currentStore.taxCode}
                              rules={[
                                {
                                  pattern: /^[0-9]{10,13}$/,
                                  message:
                                    "Mã số thuế phải là 10-13 chữ số",
                                },
                              ]}
                            >
                              <Input
                                prefix={<IdcardOutlined />}
                                placeholder="Mã số thuế (10-13 số)"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              name="businessSector"
                              label="[08] Ngành nghề kinh doanh"
                              tooltip="Mô tả ngành nghề kinh doanh chính"
                              initialValue={currentStore.businessSector}
                            >
                              <Input
                                placeholder="Ví dụ: Bán lẻ thực phẩm, đồ uống"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="businessArea"
                              label="[09] Diện tích kinh doanh (m²)"
                              tooltip="Diện tích mặt bằng kinh doanh"
                              initialValue={currentStore.area}
                            >
                              <InputNumber
                                min={0}
                                style={{ width: "100%" }}
                                placeholder="Diện tích m²"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="isRented"
                              label="[10] Đi thuê"
                              valuePropName="checked"
                              tooltip="Đánh dấu nếu địa điểm kinh doanh đi thuê"
                            >
                              <Checkbox>Địa điểm kinh doanh đi thuê</Checkbox>
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="employeeCount"
                              label="[11] Số lượng lao động"
                              tooltip="Tổng số lao động đang làm việc"
                            >
                              <InputNumber
                                min={0}
                                prefix={<TeamOutlined />}
                                style={{ width: "100%" }}
                                placeholder="Số lượng"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="workingHoursFrom"
                              label="[12] Thời gian hoạt động từ"
                              tooltip="Giờ mở cửa"
                              initialValue="08:00"
                            >
                              <Input type="time" size="large" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="workingHoursTo"
                              label="[13] Đến"
                              tooltip="Giờ đóng cửa"
                              initialValue="22:00"
                            >
                              <Input type="time" size="large" />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              name="businessAddressFull"
                              label="[14] Địa chỉ kinh doanh"
                              tooltip="Địa chỉ đầy đủ nơi kinh doanh"
                              initialValue={currentStore.address}
                            >
                              <Input
                                prefix={<EnvironmentOutlined />}
                                placeholder="Địa chỉ đầy đủ"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="phone"
                              label="[15] Điện thoại"
                              tooltip="Số điện thoại liên hệ"
                              initialValue={currentStore.phone}
                              rules={[
                                {
                                  pattern: /^[0-9]{10,11}$/,
                                  message:
                                    "Số điện thoại phải là 10-11 chữ số",
                                },
                              ]}
                            >
                              <Input
                                placeholder="Số điện thoại"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name="email"
                              label="[16] Email"
                              tooltip="Email liên hệ"
                              initialValue={currentStore.email}
                              rules={[
                                {
                                  type: "email",
                                  message: "Email không hợp lệ",
                                },
                              ]}
                            >
                              <Input
                                type="email"
                                placeholder="Email liên hệ"
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Panel>

                      {/* PHẦN A: KÊ KHAI GTGT & TNCN */}
                      <Panel
                        header={
                          <Space>
                            <CalculatorOutlined />
                            <Text strong>PHẦN A: Thuế GTGT & TNCN</Text>
                          </Space>
                        }
                        key="3"
                      >
                        <Alert
                          message="📊 Thông tin quan trọng"
                          description={
                            <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                              <li>
                                Doanh thu kê khai là tổng doanh thu trong kỳ
                              </li>
                              <li>
                                Thuế suất GTGT thường là 1%, TNCN là 0.5% (theo
                                quy định)
                              </li>
                              <li>
                                Bạn có thể điều chỉnh thuế suất nếu có quy định
                                đặc biệt
                              </li>
                            </ul>
                          }
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                          closable
                        />
                        <Row gutter={24}>
                          <Col span={8}>
                            <Form.Item
                              name="declaredRevenue"
                              label="💵 [32] Doanh thu kê khai"
                              rules={[
                                {
                                  required: true,
                                  message: "Vui lòng nhập doanh thu kê khai",
                                },
                                {
                                  type: "number",
                                  min: 0,
                                  message: "Doanh thu phải >= 0",
                                  transform: (value) => Number(value),
                                },
                              ]}
                              tooltip="Tổng doanh thu phát sinh trong kỳ kê khai"
                            >
                              <InputNumber
                                style={{ width: "100%" }}
                                size="large"
                                min={0}
                                formatter={(v) =>
                                  `${v}`.replace(
                                    /\B(?=(\d{3})+(?!\d))/g,
                                    ","
                                  )
                                }
                                parser={(v) =>
                                  v ? v.replace(/\$\s?|(,*)/g, "") : ""
                                }
                                placeholder="Nhập doanh thu..."
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="gtgtRate"
                              label="📊 Thuế GTGT (%)"
                              initialValue={TAX_RATES.DEFAULT_GTGT}
                              tooltip="Thuế suất GTGT (thường 1% đối với hộ kinh doanh)"
                            >
                              <InputNumber
                                min={0}
                                max={TAX_RATES.MAX_GTGT}
                                step={0.1}
                                style={{ width: "100%" }}
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item
                              name="tncnRate"
                              label="👤 Thuế TNCN (%)"
                              initialValue={TAX_RATES.DEFAULT_TNCN}
                              tooltip="Thuế suất TNCN (thường 0.5% đối với hộ kinh doanh)"
                            >
                              <InputNumber
                                min={0}
                                max={TAX_RATES.MAX_TNCN}
                                step={0.1}
                                style={{ width: "100%" }}
                                size="large"
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Divider orientation="left">
                          <Space>
                            <Text>
                              [28-31] Doanh thu theo nhóm ngành nghề
                            </Text>
                            <Tooltip title="Thêm ngành nghề nếu kinh doanh đa ngành">
                              <Button
                                size="small"
                                type="dashed"
                                icon={<PlusOutlined />}
                                onClick={addCategoryRevenue}
                              >
                                Thêm ngành nghề
                              </Button>
                            </Tooltip>
                          </Space>
                        </Divider>

                        {categoryRevenues.length === 0 && (
                          <Alert
                            message="Chưa có phân loại doanh thu theo ngành nghề"
                            description="Nhấn 'Thêm ngành nghề' nếu bạn kinh doanh nhiều ngành và muốn phân loại doanh thu"
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                        )}

                        {categoryRevenues.map((cat, index) => (
                          <Card
                            key={index}
                            size="small"
                            style={{ marginBottom: 16, background: "#fafafa" }}
                          >
                            <Row gutter={16} align="middle">
                              <Col span={6}>
                                <Select
                                  value={cat.category}
                                  onChange={(v) =>
                                    updateCategoryRevenue(index, "category", v)
                                  }
                                  style={{ width: "100%" }}
                                  size="large"
                                >
                                  {Object.keys(CATEGORY_MAP).map((key) => (
                                    <Option key={key} value={key}>
                                      {CATEGORY_MAP[key].code}{" "}
                                      {CATEGORY_MAP[key].name}
                                    </Option>
                                  ))}
                                </Select>
                              </Col>
                              <Col span={5}>
                                <InputNumber
                                  placeholder="Doanh thu"
                                  value={cat.revenue}
                                  onChange={(v) =>
                                    updateCategoryRevenue(index, "revenue", v)
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  formatter={(v) =>
                                    `${v}`.replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ","
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={5}>
                                <InputNumber
                                  placeholder="Thuế GTGT"
                                  value={cat.gtgtTax}
                                  onChange={(v) =>
                                    updateCategoryRevenue(index, "gtgtTax", v)
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={5}>
                                <InputNumber
                                  placeholder="Thuế TNCN"
                                  value={cat.tncnTax}
                                  onChange={(v) =>
                                    updateCategoryRevenue(index, "tncnTax", v)
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={3}>
                                <Tooltip title="Xóa ngành nghề này">
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => removeCategoryRevenue(index)}
                                    size="large"
                                  />
                                </Tooltip>
                              </Col>
                            </Row>
                          </Card>
                        ))}

                        {categoryRevenues.length > 0 && (
                          <Alert
                            message={`Tổng doanh thu theo ngành nghề: ${formatVND(
                              totalDeclaredRevenue
                            )}`}
                            description={
                              totalDeclaredRevenue !==
                                form.getFieldValue("declaredRevenue")
                                ? "Lưu ý: Tổng này chưa khớp với doanh thu kê khai tổng"
                                : "✓ Đã khớp với doanh thu kê khai tổng"
                            }
                            type={
                              totalDeclaredRevenue !==
                                form.getFieldValue("declaredRevenue")
                                ? "warning"
                                : "success"
                            }
                            showIcon
                          />
                        )}
                      </Panel>

                      {/* PHẦN B: THUẾ TTĐB */}
                      <Panel
                        header={
                          <Space>
                            <FilePdfOutlined />
                            <Text strong>
                              PHẦN B: Thuế tiêu thụ đặc biệt (TTĐB)
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              (Chỉ áp dụng cho một số ngành)
                            </Text>
                          </Space>
                        }
                        key="4"
                      >
                        <Alert
                          message="ℹ️ Lưu ý"
                          description="Thuế TTĐB chỉ áp dụng cho các hàng hóa đặc biệt như rượu, bia, thuốc lá, ô tô... Nếu không kinh doanh các mặt hàng này, bạn có thể bỏ qua phần này."
                          type="warning"
                          showIcon
                          style={{ marginBottom: 16 }}
                          closable
                        />
                        <Space style={{ marginBottom: 16 }}>
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={addSpecialTaxItem}
                          >
                            Thêm hàng hóa chịu thuế TTĐB
                          </Button>
                        </Space>

                        {specialTaxItems.length === 0 && (
                          <Empty
                            description="Chưa có hàng hóa chịu thuế TTĐB"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        )}

                        {specialTaxItems.map((item, index) => (
                          <Card
                            key={index}
                            size="small"
                            style={{ marginBottom: 16, background: "#fafafa" }}
                          >
                            <Row gutter={16} align="middle">
                              <Col span={6}>
                                <Input
                                  placeholder="[33] Tên hàng hóa/dịch vụ"
                                  value={item.itemName}
                                  onChange={(e) =>
                                    updateSpecialTaxItem(
                                      index,
                                      "itemName",
                                      e.target.value
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={4}>
                                <Input
                                  placeholder="Đơn vị tính"
                                  value={item.unit}
                                  onChange={(e) =>
                                    updateSpecialTaxItem(
                                      index,
                                      "unit",
                                      e.target.value
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={5}>
                                <InputNumber
                                  placeholder="Doanh thu"
                                  value={item.revenue}
                                  onChange={(v) =>
                                    updateSpecialTaxItem(
                                      index,
                                      "revenue",
                                      v
                                    )
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  formatter={(v) =>
                                    `${v}`.replace(
                                      /\B(?=(\d{3})+(?!\d))/g,
                                      ","
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={4}>
                                <InputNumber
                                  placeholder="Thuế suất (%)"
                                  value={item.taxRate}
                                  onChange={(v) =>
                                    updateSpecialTaxItem(
                                      index,
                                      "taxRate",
                                      v
                                    )
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={3}>
                                <Tooltip
                                  title={`Số thuế: ${formatVND(
                                    item.taxAmount
                                  )}`}
                                >
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: 12 }}
                                  >
                                    {formatVND(item.taxAmount)}
                                  </Text>
                                </Tooltip>
                              </Col>
                              <Col span={2}>
                                <Tooltip title="Xóa mục này">
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() =>
                                      removeSpecialTaxItem(index)
                                    }
                                    size="large"
                                  />
                                </Tooltip>
                              </Col>
                            </Row>
                          </Card>
                        ))}
                      </Panel>

                      {/* PHẦN C: THUẾ MÔI TRƯỜNG */}
                      <Panel
                        header={
                          <Space>
                            <EnvironmentOutlined />
                            <Text strong>
                              PHẦN C: Thuế/Phí bảo vệ môi trường
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              (Nếu có)
                            </Text>
                          </Space>
                        }
                        key="5"
                      >
                        <Alert
                          message="ℹ️ Lưu ý"
                          description="Thuế môi trường áp dụng cho các hoạt động sử dụng tài nguyên, gây ô nhiễm môi trường. Nếu không có, bạn có thể bỏ qua phần này."
                          type="warning"
                          showIcon
                          style={{ marginBottom: 16 }}
                          closable
                        />
                        <Space style={{ marginBottom: 16 }}>
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={addEnvTaxItem}
                          >
                            Thêm mục thuế môi trường
                          </Button>
                        </Space>

                        {envTaxItems.length === 0 && (
                          <Empty
                            description="Chưa có mục thuế môi trường"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        )}

                        {envTaxItems.map((item, index) => (
                          <Card
                            key={index}
                            size="small"
                            style={{ marginBottom: 16, background: "#fafafa" }}
                          >
                            <Row gutter={16} align="middle">
                              <Col span={5}>
                                <Select
                                  value={item.type}
                                  onChange={(v) =>
                                    updateEnvTaxItem(index, "type", v)
                                  }
                                  style={{ width: "100%" }}
                                  size="large"
                                >
                                  <Option value="resource">
                                    [34] Thuế tài nguyên
                                  </Option>
                                  <Option value="environmental_tax">
                                    [35] Thuế BVMT
                                  </Option>
                                  <Option value="environmental_fee">
                                    [36] Phí BVMT
                                  </Option>
                                </Select>
                              </Col>
                              <Col span={5}>
                                <Input
                                  placeholder="Tên tài nguyên/hàng hóa"
                                  value={item.itemName}
                                  onChange={(e) =>
                                    updateEnvTaxItem(
                                      index,
                                      "itemName",
                                      e.target.value
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={3}>
                                <Input
                                  placeholder="ĐVT"
                                  value={item.unit}
                                  onChange={(e) =>
                                    updateEnvTaxItem(
                                      index,
                                      "unit",
                                      e.target.value
                                    )
                                  }
                                  size="large"
                                />
                              </Col>
                              <Col span={3}>
                                <InputNumber
                                  placeholder="Số lượng"
                                  value={item.quantity}
                                  onChange={(v) =>
                                    updateEnvTaxItem(
                                      index,
                                      "quantity",
                                      v
                                    )
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={3}>
                                <InputNumber
                                  placeholder="Đơn giá"
                                  value={item.unitPrice}
                                  onChange={(v) =>
                                    updateEnvTaxItem(
                                      index,
                                      "unitPrice",
                                      v
                                    )
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={2}>
                                <InputNumber
                                  placeholder="T.suất"
                                  value={item.taxRate}
                                  onChange={(v) =>
                                    updateEnvTaxItem(
                                      index,
                                      "taxRate",
                                      v
                                    )
                                  }
                                  style={{ width: "100%" }}
                                  min={0}
                                  size="large"
                                />
                              </Col>
                              <Col span={2}>
                                <Tooltip
                                  title={`Số thuế: ${formatVND(
                                    item.taxAmount
                                  )}`}
                                >
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: 11 }}
                                  >
                                    {formatVND(item.taxAmount)}
                                  </Text>
                                </Tooltip>
                              </Col>
                              <Col span={1}>
                                <Tooltip title="Xóa mục này">
                                  <Button
                                    danger
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => removeEnvTaxItem(index)}
                                    size="large"
                                  />
                                </Tooltip>
                              </Col>
                            </Row>
                          </Card>
                        ))}
                      </Panel>

                      {/* GHI CHÚ */}
                      <Panel
                        header={
                          <Space>
                            <InfoCircleOutlined />
                            <Text strong>Ghi chú & Cam đoan</Text>
                          </Space>
                        }
                        key="6"
                      >
                        <Form.Item
                          name="notes"
                          label="Ghi chú bổ sung"
                          tooltip="Các thông tin bổ sung cho tờ khai (nếu có)"
                        >
                          <TextArea
                            rows={4}
                            placeholder="Nhập các ghi chú bổ sung cho tờ khai..."
                            showCount
                            maxLength={500}
                          />
                        </Form.Item>
                        <Alert
                          message="📝 Cam đoan"
                          description="Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu đã khai."
                          type="info"
                          showIcon
                          icon={<CheckCircleOutlined />}
                        />
                      </Panel>
                    </Collapse>

                    <Space
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                        marginBottom: 24,
                        padding: "16px",
                        background: "#f5f5f5",
                        borderRadius: 8,
                      }}
                    >
                      <Button
                        type="link"
                        icon={<QuestionCircleOutlined />}
                        onClick={() => setShowGuide(!showGuide)}
                      >
                        {showGuide
                          ? "Ẩn hướng dẫn"
                          : "Xem hướng dẫn thuế"}
                      </Button>
                      {/* Hiện bảng hướng dẫn thuế */}
                      <Modal
                        title="Hướng dẫn thuế"
                        open={showGuide}
                        onCancel={() => setShowGuide(false)}
                        footer={null}
                        width={1000}
                      >
                        <ComponentTaxGuide />
                      </Modal>

                      <Space>
                        <Button
                          icon={<CalculatorOutlined />}
                          onClick={handleCalculateTax}
                          size="large"
                        >
                          Tính toán ngay
                        </Button>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={loading}
                          size="large"
                          icon={<CheckCircleOutlined />}
                          style={{ minWidth: 150 }}
                        >
                          Lưu tờ khai
                        </Button>
                      </Space>
                    </Space>

                    {calculatedTax && calculatedTax.total > 0 && (
                      <Alert
                        type="success"
                        showIcon
                        icon={
                          <CheckCircleOutlined style={{ fontSize: 24 }} />
                        }
                        message={
                          <Space
                            direction="vertical"
                            style={{ width: "100%" }}
                            size="small"
                          >
                            <Title
                              level={4}
                              style={{ margin: 0, color: "#52c41a" }}
                            >
                              Tổng thuế phải nộp:{" "}
                              {formatVND(calculatedTax.total)}
                            </Title>
                            <Text
                              type="secondary"
                              style={{ fontSize: 14 }}
                            >
                              ({readNumberSafe(calculatedTax.total)} đồng)
                            </Text>
                            <Divider style={{ margin: "12px 0" }} />
                            <Row gutter={16}>
                              <Col span={8}>
                                <Statistic
                                  title="Thuế GTGT"
                                  value={calculatedTax.gtgt}
                                  precision={0}
                                  formatter={(value) => formatVND(value)}
                                  valueStyle={{
                                    color: "#1890ff",
                                    fontSize: 18,
                                  }}
                                />
                              </Col>
                              <Col span={8}>
                                <Statistic
                                  title="Thuế TNCN"
                                  value={calculatedTax.tncn}
                                  precision={0}
                                  formatter={(value) => formatVND(value)}
                                  valueStyle={{
                                    color: "#722ed1",
                                    fontSize: 18,
                                  }}
                                />
                              </Col>
                              <Col span={8}>
                                <Statistic
                                  title="Tổng cộng"
                                  value={calculatedTax.total}
                                  precision={0}
                                  formatter={(value) => formatVND(value)}
                                  valueStyle={{
                                    color: "#cf1322",
                                    fontSize: 18,
                                    fontWeight: "bold",
                                  }}
                                />
                              </Col>
                            </Row>
                          </Space>
                        }
                        style={{ marginBottom: 24 }}
                      />
                    )}
                  </Form>
                </Card>
              )}

              {/* TABLE */}
              <Card
                title={
                  <Space>
                    <FileDoneOutlined style={{ fontSize: 20 }} />

                    <Title level={4} style={{ margin: 0 }}>
                      Lịch sử các tờ khai đã tạo, tổng
                    </Title>
                    <Tag
                      color="blue"
                      style={{ fontSize: 14, padding: "2px 8px" }}
                    >
                      {totalCount} bản
                    </Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Text type="secondary">
                      Hiển thị {declarations.length} / {totalCount} tờ khai
                    </Text>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={fetchDeclarations}
                      loading={loading}
                    >
                      Tải lại dữ liệu
                    </Button>
                  </Space>
                }
                style={{
                  borderRadius: 12,
                  border: "1px solid #8c8c8c",
                }}
              >
                <Table
                  columns={columns}
                  dataSource={declarations}
                  rowKey="_id"
                  loading={loading}
                  scroll={{ x: 1000 }}
                  pagination={{
                    current: currentPage,
                    pageSize,
                    total: totalCount,
                    showSizeChanger: true,
                    onChange: (page, size) => {
                      setCurrentPage(page);
                      setPageSize(size);
                    },
                    showTotal: (total, range) => (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          fontSize: 14,
                          color: "#555",
                        }}
                      >
                        <div>
                          Đang xem{" "}
                          <span
                            style={{
                              color: "#1890ff",
                              fontWeight: 600,
                            }}
                          >
                            {range[0]} – {range[1]}
                          </span>{" "}
                          trên tổng số{" "}
                          <span
                            style={{
                              color: "#d4380d",
                              fontWeight: 600,
                            }}
                          >
                            {total}
                          </span>{" "}
                          tờ khai
                        </div>
                      </div>
                    ),
                  }}
                  locale={{
                    emptyText: (
                      <div style={{ padding: "60px 0" }}>
                        <Result
                          icon={
                            <FileDoneOutlined
                              style={{ fontSize: 64, color: "#bfbfbf" }}
                            />
                          }
                          title={
                            <Title
                              level={4}
                              style={{ color: "#bfbfbf" }}
                            >
                              Chưa có tờ khai thuế
                            </Title>
                          }
                          subTitle={
                            <Space direction="vertical">
                              <Text type="secondary">
                                Bạn chưa tạo tờ khai thuế nào
                              </Text>
                              <Text type="secondary">
                                Nhấn "Xem doanh thu hệ thống" ở trên để bắt
                                đầu
                              </Text>
                            </Space>
                          }
                        />
                      </div>
                    ),
                  }}
                  rowClassName={(record) => {
                    if (record.status === "approved") return "row-approved";
                    if (record.status === "rejected") return "row-rejected";
                    if (record.status === "submitted") return "row-submitted";
                    return "";
                  }}
                />
              </Card>

              {/* MODAL CHI TIẾT */}
              <Modal
                title={
                  <Space>
                    <EyeOutlined />
                    <Text strong>Chi tiết tờ khai</Text>
                  </Space>
                }
                open={detailVisible}
                footer={[
                  <Button key="close" onClick={() => setDetailVisible(false)}>
                    Đóng
                  </Button>,
                  selectedRecord && (
                    <Button
                      key="export"
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        setDetailVisible(false);
                        handleExport(selectedRecord._id, "pdf");
                      }}
                    >
                      Xuất PDF
                    </Button>
                  ),
                ]}
                width={900}
                onCancel={() => setDetailVisible(false)}
              >
                {selectedRecord && (
                  <>
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="Kỳ kê khai" span={2}>
                        <Tag color="blue">{selectedRecord.periodKey}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Phiên bản">
                        <Tag
                          color={
                            selectedRecord.isClone ? "orange" : "blue"
                          }
                        >
                          v{selectedRecord.version}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Trạng thái">
                        <Tag
                          color={
                            selectedRecord.status === "approved"
                              ? "success"
                              : selectedRecord.status === "rejected"
                                ? "error"
                                : selectedRecord.status === "submitted"
                                  ? "warning"
                                  : "default"
                          }
                        >
                          {STATUS_CONFIG[selectedRecord.status]?.text ||
                            selectedRecord.status}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label="Doanh thu kê khai"
                        span={2}
                      >
                        <Text
                          strong
                          style={{ fontSize: 16, color: "#1890ff" }}
                        >
                          {formatVND(selectedRecord.declaredRevenue)}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Thuế GTGT">
                        <Text>
                          {formatVND(selectedRecord.taxAmounts?.gtgt)}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Thuế TNCN">
                        <Text>
                          {formatVND(selectedRecord.taxAmounts?.tncn)}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item
                        label="Tổng thuế phải nộp"
                        span={2}
                      >
                        <Text
                          strong
                          style={{ fontSize: 18, color: "#d4380d" }}
                        >
                          {formatVND(selectedRecord.taxAmounts?.total)}
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Bằng chữ" span={2}>
                        <Text italic style={{ color: "#666" }}>
                          {readNumberSafe(
                            selectedRecord.taxAmounts?.total
                          )}{" "}
                          đồng
                        </Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Người tạo">
                        {selectedRecord.createdBy?.fullName ||
                          selectedRecord.createdBy?.email ||
                          "N/A"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ngày tạo">
                        {dayjs(selectedRecord.createdAt).format(
                          "DD/MM/YYYY HH:mm"
                        )}
                      </Descriptions.Item>
                      {selectedRecord.submittedAt && (
                        <Descriptions.Item label="Ngày nộp" span={2}>
                          {dayjs(selectedRecord.submittedAt).format(
                            "DD/MM/YYYY HH:mm"
                          )}
                        </Descriptions.Item>
                      )}
                      {selectedRecord.approvedAt && (
                        <>
                          <Descriptions.Item label="Người duyệt">
                            {selectedRecord.approvedBy?.fullName || "N/A"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Ngày duyệt">
                            {dayjs(selectedRecord.approvedAt).format(
                              "DD/MM/YYYY HH:mm"
                            )}
                          </Descriptions.Item>
                        </>
                      )}
                      {selectedRecord.rejectionReason && (
                        <Descriptions.Item
                          label="Lý do từ chối"
                          span={2}
                        >
                          <Text type="danger">
                            {selectedRecord.rejectionReason}
                          </Text>
                        </Descriptions.Item>
                      )}
                      {selectedRecord.notes && (
                        <Descriptions.Item label="Ghi chú" span={2}>
                          {selectedRecord.notes}
                        </Descriptions.Item>
                      )}
                    </Descriptions>

                    {/* Thông tin người nộp thuế */}
                    {selectedRecord.taxpayerInfo && (
                      <>
                        <Divider orientation="left">
                          Thông tin người nộp thuế
                        </Divider>
                        <Descriptions bordered column={2} size="small">
                          {selectedRecord.taxpayerInfo.name && (
                            <Descriptions.Item label="Người nộp thuế">
                              {selectedRecord.taxpayerInfo.name}
                            </Descriptions.Item>
                          )}
                          {selectedRecord.taxpayerInfo.storeName && (
                            <Descriptions.Item label="Tên cửa hàng">
                              {selectedRecord.taxpayerInfo.storeName}
                            </Descriptions.Item>
                          )}
                          {selectedRecord.taxpayerInfo.taxCode && (
                            <Descriptions.Item label="Mã số thuế">
                              {selectedRecord.taxpayerInfo.taxCode}
                            </Descriptions.Item>
                          )}
                          {selectedRecord.taxpayerInfo.phone && (
                            <Descriptions.Item label="Điện thoại">
                              {selectedRecord.taxpayerInfo.phone}
                            </Descriptions.Item>
                          )}
                          {selectedRecord.taxpayerInfo.email && (
                            <Descriptions.Item label="Email" span={2}>
                              {selectedRecord.taxpayerInfo.email}
                            </Descriptions.Item>
                          )}
                          {selectedRecord.taxpayerInfo.businessAddress
                            ?.full && (
                              <Descriptions.Item
                                label="Địa chỉ kinh doanh"
                                span={2}
                              >
                                {
                                  selectedRecord.taxpayerInfo.businessAddress
                                    .full
                                }
                              </Descriptions.Item>
                            )}
                        </Descriptions>
                      </>
                    )}

                    {/* Doanh thu theo ngành nghề */}
                    {selectedRecord.revenueByCategory &&
                      selectedRecord.revenueByCategory.length > 0 && (
                        <>
                          <Divider orientation="left">
                            Doanh thu theo ngành nghề
                          </Divider>
                          <Table
                            size="small"
                            dataSource={selectedRecord.revenueByCategory}
                            pagination={false}
                            columns={[
                              {
                                title: "Ngành nghề",
                                dataIndex: "category",
                                key: "category",
                                render: (cat) => getCategoryName(cat),
                              },
                              {
                                title: "Doanh thu",
                                dataIndex: "revenue",
                                key: "revenue",
                                render: (v) => formatVND(v),
                                align: "right",
                              },
                              {
                                title: "Thuế GTGT",
                                dataIndex: "gtgtTax",
                                key: "gtgtTax",
                                render: (v) => formatVND(v),
                                align: "right",
                              },
                              {
                                title: "Thuế TNCN",
                                dataIndex: "tncnTax",
                                key: "tncnTax",
                                render: (v) => formatVND(v),
                                align: "right",
                              },
                            ]}
                          />
                        </>
                      )}
                  </>
                )}
              </Modal>
            </Space>
          </div>
        </Spin>
      </Layout>
    </ErrorBoundary>
  );
};

export default TaxDeclaration;
