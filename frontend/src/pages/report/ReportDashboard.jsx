//
/// src/pages/report/ReportDashboard.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  DatePicker,
  Statistic,
  Spin,
  Alert,
  Space,
  InputNumber,
  Button,
  Popover,
  Tag,
  Table,
  Typography,
  Divider,
  Tooltip as AntTooltip,
  Badge,
  Modal,
  Form,
  Input,
  Checkbox,
  Dropdown,
  Menu,
  Empty,
} from "antd";
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  DollarOutlined,
  PercentageOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
} from "@ant-design/icons";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import dayjs from "dayjs";
import "../../premium.css";
import { useNavigate, useLocation } from "react-router-dom";
import localizedFormat from "dayjs/plugin/localizedFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import operatingExpenseService from "../../services/operatingExpenseService";
import "dayjs/locale/vi"; // ✅ LOCALE VI

const { Title, Text, Paragraph } = Typography;

dayjs.locale("vi"); // ✅ SET LOCALE VI
dayjs.extend(localizedFormat);
dayjs.extend(quarterOfYear);
const apiUrl = import.meta.env.VITE_API_URL;
// CUSTOM LOCALE CHO TIẾNG VIỆT ĐẸP
const vietnameseLocale = {
  ...dayjs.Ls.vi,
  formats: {
    ...dayjs.Ls.vi.formats,
    L: "DD/MM/YYYY",
    LL: "D MMMM YYYY",
    LLL: "D MMMM YYYY HH:mm",
    LLLL: "dddd, D MMMM YYYY HH:mm",
  },
};
dayjs.locale(vietnameseLocale);

// Màu sắc biểu đồ
const COLORS = {
  revenue: "#1890ff",
  grossProfit: "#52c41a",
  netProfit: "#722ed1",
  operatingCost: "#fa8c16",
  vat: "#f5222d",
  stockValue: "#13c2c2",
  totalVAT: "#fa8c16",
  totalCOGS: "#52c41a",
  stockValueAtSalePrice: "#e90c77ff",
};

// helper: trả về màu dựa vào giá trị profit (VND)
const getProfitColorByValue = (value) => {
  if (value == null) return "#fa8c16"; // cam cho unknown
  if (Number(value) > 0) return "#52c41a"; // xanh lá
  if (Number(value) < 0) return "#f5222d"; // đỏ
  return "#fa8c16"; // =0 => cam
};

const ReportDashboard = () => {
  const { currentStore: authStore, user } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlStoreId = queryParams.get("storeId");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Ưu tiên store từ AuthContext, sau đó đến URL, cuối cùng là localStorage fallback
  const currentStore = authStore || (urlStoreId ? { _id: urlStoreId } : JSON.parse(localStorage.getItem("currentStore") || "{}"));
  const [groupPagination, setGroupPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Filter - không có ngày tháng cụ thể để tránh lỗi
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [pickerValue, setPickerValue] = useState(null);
  const [previousPeriodType, setPreviousPeriodType] = useState(""); // Track loại kỳ trước đó

  // Chi phí ngoài lệ: items từ DB
  const [expenseItems, setExpenseItems] = useState([]); // array of {amount, note}
  const [operatingExpenseId, setOperatingExpenseId] = useState(null); // _id của document OperatingExpense
  const [selectedExpenseIds, setselectedExpenseIds] = useState([]);
  const [allocationSuggestion, setAllocationSuggestion] = useState(null); // suggestion từ API
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [prevPeriodKey, setPrevPeriodKey] = useState(""); // Track period key trước đó

  // Drill-down modal: Chi tiết giá vốn theo sản phẩm
  const [selectedGroup, setSelectedGroup] = useState(null); // Track nhóm được chọn
  const [detailModalVisible, setDetailModalVisible] = useState(false); // Toggle modal

  // Form input
  const [newExpenseAmount, setNewExpenseAmount] = useState(null);
  const [newExpenseNote, setNewExpenseNote] = useState("");

  // Format tiền tệ việt nam (VND)
  const formatVND = (value) => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const renderComparison = (change) => {
    if (change === null || change === undefined) return null;
    const isPositive = change > 0;
    const color = isPositive ? "#52c41a" : "#ff4d4f";
    const Icon = isPositive ? CaretUpOutlined : CaretDownOutlined;

    return (
      <div style={{ fontSize: "12px", color: "#fff", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            padding: "2px 6px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Icon />
          <span>{Math.abs(change)}%</span>
        </div>
        <span style={{ opacity: 0.8 }}>so với kỳ trước</span>
      </div>
    );
  };

  const handleExport = (format) => {
    if (!currentStore?._id || !periodType || !periodKey) {
      Swal.fire("Cảnh báo", "Vui lòng chọn kỳ báo cáo trước khi xuất", "warning");
      return;
    }
    const token = localStorage.getItem("token");
    const url = `${apiUrl}/financials/export?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}&format=${format}&token=${token}`;

    window.open(url, "_blank"); // Redirect to download URL
  };

  const exportMenu = (
    <Menu onClick={({ key }) => handleExport(key)}>
      <Menu.Item key="xlsx" icon={<FileExcelOutlined style={{ color: "#1d6f42" }} />}>
        Xuất file Excel (.xlsx)
      </Menu.Item>
      <Menu.Item key="pdf" icon={<FilePdfOutlined style={{ color: "#e60101" }} />}>
        Xuất file PDF (.pdf)
      </Menu.Item>
      <Menu.Item key="csv" icon={<FileTextOutlined style={{ color: "#1890ff" }} />}>
        Xuất file CSV (.csv)
      </Menu.Item>
    </Menu>
  );

  // Check xem kỳ đang chọn có phải tương lai không
  const isFuturePeriod = () => {
    if (!periodType || !periodKey) return false;
    const now = dayjs();

    if (periodType === "month") {
      return dayjs(periodKey, "YYYY-MM").isAfter(now, "month");
    }
    if (periodType === "year") {
      return dayjs(periodKey, "YYYY").isAfter(now, "year");
    }
    if (periodType === "quarter") {
      const [year, qStr] = periodKey.split("-Q");
      const q = parseInt(qStr);
      const currentQuarter = Math.floor(now.month() / 3) + 1;
      const currentYear = now.year();
      if (parseInt(year) > currentYear) return true;
      if (parseInt(year) === currentYear && q > currentQuarter) return true;
      return false;
    }
    return false;
  };

  // ====== HELPERS ======
  const getCurrentTotalExpense = () => expenseItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const getUnsavedItems = () => expenseItems.filter((it) => it && it.isSaved === false);
  const getUnsavedTotalExpense = () => getUnsavedItems().reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const getUnsavedCount = () => getUnsavedItems().length;

  // Chuẩn hoá periodKey theo type (đảm bảo quarter có năm)
  const buildPeriodKey = (type, dateObj) => {
    if (!dateObj) return "";
    if (type === "month") return dateObj.format("YYYY-MM");
    if (type === "quarter") {
      const q = Math.floor(dateObj.month() / 3) + 1;
      return `${dateObj.year()}-Q${q}`; // ✅ có năm
    }
    if (type === "year") return dateObj.year().toString();
    return "";
  };

  // ⚠️ Handle đổi PeriodType - CHỈ HỎI NẾU CÓ UNSAVED
  const handlePeriodTypeChange = (newType) => {
    if (newType === periodType) return;

    const commitSwitchType = async () => {
      // Lưu type cũ trước khi thay đổi
      setPreviousPeriodType(periodType);
      setPrevPeriodKey(periodKey);

      setPeriodType(newType);
      setPeriodKey("");
      setPickerValue(null);
      setData(null);
      setAllocationSuggestion(null); // Reset suggestion khi đổi type
    };

    if (!unsavedChanges) {
      commitSwitchType();
      return;
    }

    Swal.fire({
      title: "Bạn có thay đổi chưa lưu",
      html: `
      <div style="text-align: center; font-size: 14px;">
        <p>Bạn có <b>${getUnsavedCount()}</b> khoản chi phí chưa lưu:</p>
        <p style="font-size: 18px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
          ${getUnsavedTotalExpense().toLocaleString("vi-VN")} VND
        </p>
        <p style="margin-top: 12px;">Bạn muốn làm gì?</p>
      </div>
    `,
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Lưu và Chuyển",
      denyButtonText: "Ở lại trang",
      cancelButtonText: "Không lưu, chuyển",
      confirmButtonColor: "#52c41a",
      denyButtonColor: "#1677ff",
      cancelButtonColor: "#d9534f",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await saveOperatingExpense();
        await commitSwitchType();
        return;
      }

      if (result.isDenied) {
        return; // ở lại
      }

      // Cancel button
      if (result.isDismissed) {
        setUnsavedChanges(false);
        await commitSwitchType();
      }
    });
  };

  // ⚠️ Handle đổi PeriodKey (trong cùng loại)
  const handlePeriodKeyChange = (dateObj) => {
    if (!dateObj) return;

    const newKey = buildPeriodKey(periodType, dateObj);
    if (!newKey || newKey === periodKey) return;

    const commitSwitchKey = async () => {
      setPeriodKey(newKey);
      setPickerValue(dateObj);
      setData(null);

      // Chỉ gọi allocation khi type VỪA thay đổi (previousPeriodType != periodType)
      // Không gọi khi chuyển key trong cùng type
      if (previousPeriodType && previousPeriodType !== periodType && prevPeriodKey && currentStore?._id) {
        const suggestion = await operatingExpenseService.suggestAllocation({
          storeId: currentStore._id,
          fromPeriodType: previousPeriodType, // Type cũ
          fromPeriodKey: prevPeriodKey, // Key cũ
          toPeriodType: periodType, // Type mới
        });

        if (suggestion && suggestion.success && suggestion.canAllocate) {
          setAllocationSuggestion(suggestion);
        } else {
          setAllocationSuggestion(null);
        }
      } else {
        // Không gọi allocation nếu cùng type
        setAllocationSuggestion(null);
      }
    };

    if (!unsavedChanges) {
      commitSwitchKey();
      return;
    }

    Swal.fire({
      title: "⚠️ Bạn có thay đổi chưa lưu",
      html: `
      <div style="text-align: center; font-size: 14px;">
        <p>Bạn có <b>${getUnsavedCount()}</b> khoản chi phí chưa lưu:</p>
        <p style="font-size: 18px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
          ${getUnsavedTotalExpense().toLocaleString("vi-VN")} VND
        </p>
        <p style="margin-top: 12px;">Bạn muốn làm gì?</p>
      </div>
    `,
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Lưu & Chuyển",
      denyButtonText: "Ở lại trang",
      cancelButtonText: "Không lưu, chuyển",
      confirmButtonColor: "#52c41a",
      denyButtonColor: "#1677ff",
      cancelButtonColor: "#d9534f",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await saveOperatingExpense();
        await commitSwitchKey();
        return;
      }

      if (result.isDenied) {
        return;
      }

      if (result.isDismissed) {
        setUnsavedChanges(false);
        await commitSwitchKey();
      }
    });
  };

  const generateBarData = () => {
    if (!data) return [];
    return [
      { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
      { name: "Lợi nhuận gộp", value: data.grossProfit, fill: COLORS.grossProfit },
      { name: "Chi phí vận hành", value: data.operatingCost, fill: COLORS.operatingCost },
      { name: "Lợi nhuận ròng", value: data.netProfit, fill: COLORS.netProfit },
    ];
  };

  // ====== API ======
  // Load operating expenses từ DB
  const loadOperatingExpenses = async () => {
    if (!currentStore?._id || !periodType || !periodKey) {
      setExpenseItems([]);
      setOperatingExpenseId(null);
      setUnsavedChanges(false);
      return;
    }

    try {
      const data = await operatingExpenseService.getOperatingExpenseByPeriod({
        storeId: currentStore._id,
        periodType,
        periodKey,
      });

      setExpenseItems(data.items || []);
      setOperatingExpenseId(data._id || null);
      setUnsavedChanges(false);
    } catch (error) {
      console.error("loadOperatingExpenses error:", error);
      setExpenseItems([]);
      setOperatingExpenseId(null);
      setUnsavedChanges(false);
    }
  };

  // Gọi fetch financial report
  const fetchFinancial = async () => {
    if (!currentStore?._id) {
      setError("Vui lòng chọn cửa hàng trước.");
      return;
    }
    if (!periodType || !periodKey) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Không có token!");

      const params = new URLSearchParams({
        storeId: currentStore._id,
        periodType,
        periodKey,
      });
      // ✅ Không gửi extraExpense nữa vì backend tự lấy từ DB

      const url = `${apiUrl}/financials?${params.toString()}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });

      setData(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto load expenses khi period thay đổi
  useEffect(() => {
    loadOperatingExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?._id, periodType, periodKey]);

  // Auto fetch financial khi period hoặc expenses thay đổi
  useEffect(() => {
    fetchFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?._id, periodType, periodKey]);

  // ====== SAVE OPERATING EXPENSE =======
  const saveOperatingExpense = async () => {
    if (!currentStore?._id || !periodType || !periodKey) {
      Swal.fire({
        icon: "warning",
        title: "Thiếu dữ liệu",
        text: "Vui lòng chọn đầy đủ kỳ báo cáo",
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    if (isFuturePeriod()) {
      Swal.fire({
        icon: "warning",
        title: "Kỳ báo cáo không hợp lệ",
        text: "Không thể lưu chi phí cho thời gian ở tương lai",
      });
      return;
    }

    try {
      setLoading(true);

      const itemsToSave = expenseItems.map((it) => ({
        amount: it.amount,
        note: it.note,
        isSaved: true,
      }));

      await operatingExpenseService.upsertOperatingExpense({
        storeId: currentStore._id,
        periodType,
        periodKey,
        items: itemsToSave,
      });

      setExpenseItems(itemsToSave);
      setUnsavedChanges(false);
      setselectedExpenseIds([]); // Reset checkbox

      Swal.fire({
        icon: "success",
        title: "Lưu thành công",
        text: `Chi phí kỳ này: ${getCurrentTotalExpense().toLocaleString("vi-VN")} VND`,
        timer: 1500,
        showConfirmButton: false,
      });

      // Reload expense items từ DB để có _id thực
      await loadOperatingExpenses();
      // Reload financial data
      await fetchFinancial();
    } catch (error) {
      console.error("saveOperatingExpense error:", error);
      Swal.fire({
        icon: "error",
        title: " Lỗi khi lưu",
        text: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ====== CHI PHÍ NGOÀI LỀ ======
  // Thêm 1 khoản chi phí
  const addExpenseItem = () => {
    if (isFuturePeriod()) {
      Swal.fire({
        icon: "warning",
        title: "Không thể thêm",
        text: "Không thể thêm chi phí cho thời gian ở tương lai",
      });
      return;
    }

    if (newExpenseAmount === null || newExpenseAmount === undefined || newExpenseAmount <= 0) {
      Swal.fire({
        icon: "warning",
        title: "Số tiền không hợp lệ",
        text: "Vui lòng nhập số tiền > 0",
        timer: 1000,
        showConfirmButton: false,
      });
      return;
    }

    const newItem = {
      amount: Number(newExpenseAmount),
      note: newExpenseNote.trim(),
      isSaved: false,
    };

    setExpenseItems([...expenseItems, newItem]);
    setNewExpenseAmount(null);
    setNewExpenseNote("");
    setUnsavedChanges(true);
  };

  // Xoá 1 khoản chi phí (hard delete từ DB)
  const removeExpenseItem = (index) => {
    const item = expenseItems[index];

    if (!item) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Không tìm thấy khoản chi phí",
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    Swal.fire({
      title: "Xoá khoản chi phí",
      html: `
        <div style="text-align: center; font-size: 14px;">
          <p>Bạn chắc chắn muốn xoá khoản chi phí này không?</p>
          <p style="font-size: 16px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
            ${formatVND(item.amount || 0)}
          </p>
          <p style="font-size: 12px; color: #8c8c8c; margin: 8px 0;">
            ${item.note || "(không có ghi chú)"}
          </p>
        </div>
      `,
      icon: "question",
      confirmButtonText: "Xoá",
      cancelButtonText: "Quay lại",
      showCancelButton: true,
      confirmButtonColor: "#ff4d4f",
      cancelButtonColor: "#1890ff",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setLoading(true);

          // Nếu item đã lưu (isSaved: true), gọi API xoá từ DB theo _id
          if (item.isSaved && item._id && operatingExpenseId) {
            await operatingExpenseService.deleteMultipleItems({
              id: operatingExpenseId,
              itemIds: [item._id],
            });
          }

          // Cập nhật state
          setExpenseItems(expenseItems.filter((_, i) => i !== index));

          // Re-fetch financial report để cập nhật chi phí vận hành
          await fetchFinancial();

          Swal.fire({
            icon: "success",
            title: "Đã xoá",
            text: "Chi phí vận hành đã cập nhật",
            timer: 800,
            showConfirmButton: false,
          });
        } catch (error) {
          console.error("removeExpenseItem error:", error);
          Swal.fire({
            icon: "error",
            title: "Lỗi khi xoá",
            text: error.message || "Vui lòng thử lại",
            timer: 1500,
            showConfirmButton: false,
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Xoá nhiều khoản chi phí (hàng loạt)
  const deleteMultipleExpenseItems = async () => {
    // Validate: chỉ cho phép xóa items đã lưu (có _id từ DB)
    const validSelectedIds = selectedExpenseIds.filter((id) => {
      const item = expenseItems.find((it) => String(it._id) === String(id));
      return item && item._id; // Phải có _id thực từ DB
    });

    if (validSelectedIds.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Không thể xóa",
        text: "Bạn chỉ có thể xóa các khoản đã lưu. Vui lòng lưu chi phí trước khi xóa.",
        timer: 1500,
        showConfirmButton: false,
      });
      return;
    }

    const deleteCount = validSelectedIds.length;
    const selectedSet = new Set(validSelectedIds.map(String));
    const selectedItems = expenseItems.filter((it) => selectedSet.has(String(it._id)));
    const totalSelectedAmount = selectedItems.reduce((sum, it) => sum + (Number(it?.amount) || 0), 0);

    Swal.fire({
      title: "Xoá các khoản chi phí",
      html: `
        <div style="text-align: center; font-size: 14px;">
          <p>Bạn chắc chắn muốn xoá ${selectedExpenseIds.length} khoản chi phí này không?</p>
          <p style="font-size: 16px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
            Tổng: ${formatVND(totalSelectedAmount)}
          </p>
        </div>
      `,
      icon: "question",
      confirmButtonText: "Xoá tất cả",
      cancelButtonText: "Quay lại",
      showCancelButton: true,
      confirmButtonColor: "#ff4d4f",
      cancelButtonColor: "#1890ff",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setLoading(true);

          // Gọi API xoá hàng loạt
          if (operatingExpenseId) {
            await operatingExpenseService.deleteMultipleItems({
              id: operatingExpenseId,
              itemIds: selectedExpenseIds,
            });
          }

          // Cập nhật state: xoá các items theo _id
          const deletedSet = new Set(selectedExpenseIds.map(String));
          const newItems = expenseItems.filter((it) => !deletedSet.has(String(it._id)));

          setExpenseItems(newItems);
          setselectedExpenseIds([]);

          // Re-fetch financial report để cập nhật chi phí vận hành
          await fetchFinancial();

          Swal.fire({
            icon: "success",
            title: "Đã xoá thành công",
            text: `Xoá ${deleteCount} khoản, chi phí vận hành đã cập nhật`,
            timer: 800,
            showConfirmButton: false,
          });
        } catch (error) {
          console.error("deleteMultipleExpenseItems error:", error);
          Swal.fire({
            icon: "error",
            title: "Lỗi khi xoá",
            text: error.message || "Vui lòng thử lại",
            timer: 1500,
            showConfirmButton: false,
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // Hàm xử lý allocation (phân bổ chi phí)
  const handleAllocationSuggestion = async () => {
    if (!allocationSuggestion || !allocationSuggestion.canAllocate) return;

    Swal.fire({
      title: "Phân bổ chi phí",
      html: `
        <div style="text-align: left; font-size: 13px;">
          <p>${allocationSuggestion.message}</p>
          <div style="background: #f6f8fb; padding: 12px; border-radius: 4px; margin-top: 12px;">
            <p style="margin: 0 0 8px 0; font-weight: 500; color: #333;">Chi tiết phân bổ:</p>
            ${allocationSuggestion.suggestions
              .map(
                (s, idx) =>
                  `<p style="margin: 4px 0; color: #555;">
                    <span style="font-weight: 500;">${s.periodKey}</span>: ${formatVND(s.amount)}
                  </p>`
              )
              .join("")}
            <p style="margin: 8px 0 0 0; color: #faad14; font-weight: 500;">
              Tổng: ${formatVND(allocationSuggestion.suggestions.reduce((sum, s) => sum + s.amount, 0))}
            </p>
          </div>
        </div>
      `,
      icon: "question",
      confirmButtonText: "Đồng ý phân bổ",
      cancelButtonText: "Hủy",
      showCancelButton: true,
      confirmButtonColor: "#1890ff",
      cancelButtonColor: "#f80707ff",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          setLoading(true);

          await operatingExpenseService.executeAllocation({
            storeId: currentStore._id,
            fromPeriodType: allocationSuggestion.fromData.periodType,
            fromPeriodKey: allocationSuggestion.fromData.periodKey,
            allocations: allocationSuggestion.suggestions,
          });

          setAllocationSuggestion(null);

          Swal.fire({
            icon: "success",
            title: "Phân bổ thành công",
            text: `Đã phân bổ chi phí sang ${allocationSuggestion.suggestions.length} khoảng thời gian`,
            timer: 2000,
            showConfirmButton: false,
          });

          // Reload expenses sau phân bổ
          await loadOperatingExpenses();
          await fetchFinancial();
        } catch (error) {
          console.error("handleAllocationSuggestion error:", error);
          Swal.fire({
            icon: "error",
            title: "Lỗi phân bổ",
            text: error.message || "Vui lòng thử lại",
            timer: 1500,
            showConfirmButton: false,
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <Layout>
      <div className="premium-layout">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* HEADER & FILTERS */}
          <Card className="glass-card" style={{ border: "1px solid #8c8c8c" }}>
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} lg={6}>
                <Title level={2} className="premium-title" style={{ margin: 0 }}>
                  {currentStore.name}
                </Title>
                <Text type="secondary" style={{ fontSize: "14px" }}>
                  Phân tích kinh doanh & Tài chính
                </Text>
              </Col>

              <Col xs={12} lg={4} span={9}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Kỳ báo cáo
                </Text>
                <Select style={{ width: "100%" }} size="large" value={periodType} onChange={handlePeriodTypeChange} placeholder="Chọn kỳ">
                  <Select.Option value="month">Theo tháng</Select.Option>
                  <Select.Option value="quarter">Theo quý</Select.Option>
                  <Select.Option value="year">Theo năm</Select.Option>
                </Select>
              </Col>

              <Col xs={12} lg={4} span={9}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Chọn kỳ cụ thể
                </Text>
                {!periodType ? (
                  <Button disabled size="large" style={{ width: "100%" }}>
                    Chọn kỳ trước
                  </Button>
                ) : (
                  <DatePicker
                    style={{ width: "100%" }}
                    size="large"
                    picker={periodType === "month" ? "month" : periodType === "year" ? "year" : "quarter"}
                    value={pickerValue}
                    onChange={handlePeriodKeyChange}
                    format={(value) => {
                      if (periodType === "quarter") return `Quý ${value.quarter()} - ${value.year()}`;
                      if (periodType === "month") return `Tháng ${value.format("MM/YYYY")}`;
                      return `Năm ${value.format("YYYY")}`;
                    }}
                    placeholder={`Chọn ${periodType === "month" ? "tháng" : periodType === "quarter" ? "quý" : "năm"}`}
                  />
                )}
              </Col>

              <Col xs={24} lg={10} style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                <Dropdown overlay={exportMenu} trigger={["click"]}>
                  <Button type="primary" size="large" icon={<DownloadOutlined />} className="premium-btn">
                    Xuất báo cáo <CaretDownOutlined />
                  </Button>
                </Dropdown>
              </Col>
            </Row>
          </Card>

          {/* CHI PHÍ NGOÀI LỄ - RIÊNG */}

          {isFuturePeriod() ? (
            <Alert
              type="warning"
              showIcon
              message="Thời gian ở tương lai"
              description={`Kỳ báo cáo bạn chọn (${periodKey}) chưa diễn ra. Hệ thống không cho phép ghi nhận chi phí trước cho tương lai.`}
              style={{ padding: "24px", borderRadius: "12px", border: "1px solid #ffe58f" }}
            />
          ) : (
            <Card style={{ border: "1px solid #8c8c8c" }}>
            {/* Allocation Suggestion Alert */}
            {allocationSuggestion && allocationSuggestion.canAllocate && (
              <Alert
                type="info"
                message={
                  <div
                    style={{
                      cursor: "pointer",
                      padding: "8px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      userSelect: "none",
                    }}
                    onClick={handleAllocationSuggestion}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(24, 144, 255, 0.08)";
                      e.currentTarget.style.borderRadius = "4px";
                      e.currentTarget.style.padding = "8px 8px";
                      e.currentTarget.style.marginLeft = "-8px";
                      e.currentTarget.style.marginRight = "-8px";
                      e.currentTarget.style.paddingLeft = "16px";
                      e.currentTarget.style.paddingRight = "16px";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.padding = "8px 0";
                      e.currentTarget.style.marginLeft = "0";
                      e.currentTarget.style.marginRight = "0";
                      e.currentTarget.style.paddingLeft = "0";
                      e.currentTarget.style.paddingRight = "0";
                    }}
                    title="Bấm để xem chi tiết và thực hiện phân bổ"
                  >
                    <div style={{ flex: 1 }}>
                      <strong>Gợi ý phân bổ:</strong> {allocationSuggestion.message}
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#1890ff",
                        fontWeight: "600",
                        whiteSpace: "nowrap",
                        marginLeft: "auto",
                        paddingLeft: 12,
                      }}
                    >
                      Bấm để xem →
                    </span>
                  </div>
                }
                showIcon
                closable
                onClose={() => setAllocationSuggestion(null)}
                style={{ marginBottom: 16 }}
              />
            )}

            <Space align="center" style={{ marginBottom: 12 }}>
              <Title level={4} style={{ margin: 0 }}>
                Chi phí ngoài lề
              </Title>

              <AntTooltip title="Bạn có thể thêm các chi phí bên ngoài hệ thống vào đây để hệ thống tính toán hộ. Số tiền này sẽ được cộng vào mục chi phí vận hành">
                <InfoCircleOutlined style={{ color: "#1677ff", fontSize: 16, cursor: "pointer" }} />
              </AntTooltip>
            </Space>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <label style={{ display: "block", marginBottom: 8 }}>Nhập Số Tiền</label>
                <InputNumber
                  min={0}
                  value={newExpenseAmount}
                  onChange={setNewExpenseAmount}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => v.replace(/\$\s?|(,*)/g, "")}
                  style={{ width: "100%" }}
                  placeholder="Số tiền (VND)"
                  size="large"
                />
              </Col>

              <Col span={8}>
                <label style={{ display: "block", marginBottom: 8 }}>Ghi Chú</label>
                <Input
                  placeholder="VD: Mặt bằng, điện, nước, lương nhân viên, tiếp thị..."
                  value={newExpenseNote}
                  onChange={(e) => setNewExpenseNote(e.target.value)}
                  maxLength={100}
                  size="large"
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newExpenseAmount && newExpenseAmount > 0) {
                      addExpenseItem();
                    }
                  }}
                />
              </Col>

              <Col span={8}>
                <label style={{ display: "block", marginBottom: 8 }}>Hành Động</label>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Button type="primary" block onClick={addExpenseItem} disabled={!newExpenseAmount || newExpenseAmount <= 0} size="large">
                    Thêm Khoản
                  </Button>
                </Space>
              </Col>

              {/* Danh sách chi phí */}
              {expenseItems.length > 0 && (
                <Col span={24}>
                  <Divider style={{ margin: "12px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      Danh Sách Chi Phí ({expenseItems.length} khoản)
                    </Text>
                    <div
                      style={{
                        background: "#fff7e6",
                        padding: "6px 16px",
                        borderRadius: 4,
                        fontWeight: "bold",
                        color: "#faad14",
                        fontSize: 14,
                      }}
                    >
                      Tổng: {formatVND(getCurrentTotalExpense())}
                    </div>
                  </div>

                  <Table
                    rowKey={(record) => record._id}
                    rowSelection={{
                      selectedRowKeys: selectedExpenseIds,
                      onChange: (keys) => setselectedExpenseIds(keys),
                      getCheckboxProps: (record) => ({
                        disabled: !!record.originPeriod,
                      }),
                    }}
                    dataSource={expenseItems}
                    columns={[
                      {
                        title: "STT",
                        render: (_, __, idx) => idx + 1,
                        width: 50,
                        align: "center",
                      },
                      {
                        title: "Số Tiền",
                        dataIndex: "amount",
                        render: (val) => <span style={{ fontWeight: "bold", color: "#faad14", fontSize: 14 }}>{formatVND(val)}</span>,
                        width: "30%",
                      },
                      {
                        title: "Ghi Chú",
                        dataIndex: "note",
                        render: (text) => <span style={{ fontSize: 13 }}>{text || "—"}</span>,
                        flex: 1,
                      },
                      {
                        title: "Kỳ Gốc",
                        dataIndex: "originPeriod",
                        render: (text) => (text ? <Tag color="blue">{text}</Tag> : <Tag color="green">Hiện tại</Tag>),
                        width: 120,
                        hidden: periodType === "month",
                      },
                      {
                        title: "Trạng Thái",
                        dataIndex: "isSaved",
                        render: (saved) => (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: "3px",
                              fontSize: 12,
                              fontWeight: "500",
                              backgroundColor: saved ? "#f6ffed" : "#fff1f0",
                              color: saved ? "#52c41a" : "#f5222d",
                            }}
                          >
                            {saved ? "Đã lưu" : "Chưa lưu"}
                          </span>
                        ),
                        width: 90,
                        align: "center",
                      },
                      {
                        title: "Thao Tác",
                        width: 80,
                        align: "center",
                        render: (_, record, idx) => (
                          <AntTooltip
                            title={record.originPeriod ? `Khoản chi này thuộc ${record.originPeriod}. Vui lòng chuyển sang kỳ đó để xoá.` : ""}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeExpenseItem(idx)}
                              disabled={!!record.originPeriod}
                              title={record.originPeriod ? "" : "Xoá khoản chi phí này"}
                            />
                          </AntTooltip>
                        ),
                      },
                    ]}
                    pagination={false}
                    size="small"
                    bordered
                  />

                  {selectedExpenseIds.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, padding: 8 }}>
                      <Button
                        type="primary"
                        danger
                        size="small"
                        onClick={deleteMultipleExpenseItems}
                        loading={loading}
                        disabled={getUnsavedCount() > 0 || loading}
                        title={getUnsavedCount() > 0 ? "Vui lòng lưu chi phí trước khi xoá" : ""}
                      >
                        Xoá {selectedExpenseIds.length} khoản đã chọn
                      </Button>
                      <Button size="small" onClick={() => setselectedExpenseIds([])} disabled={loading}>
                        Bỏ chọn
                      </Button>
                    </div>
                  )}
                </Col>
              )}

              {/* Nút Lưu + Alert */}
              <Col span={24}>
                <Space style={{ width: "100%" }}>
                  <Button
                    type={unsavedChanges && expenseItems.length > 0 ? "primary" : "default"}
                    onClick={saveOperatingExpense}
                    disabled={!unsavedChanges || expenseItems.length === 0 || loading}
                    loading={loading}
                    size="large"
                    style={{ minWidth: 180 }}
                  >
                    {unsavedChanges && expenseItems.length > 0 ? "Lưu Chi Phí" : "Đã Lưu"}
                  </Button>

                  {unsavedChanges && expenseItems.filter((it) => !it.isSaved).length > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      message={`Có ${expenseItems.filter((it) => !it.isSaved).length} khoản chi phí chưa lưu`}
                      style={{ flex: 1, margin: 0 }}
                    />
                  )}
                </Space>
              </Col>
            </Row>
          </Card>
          )}

          {loading && <Spin tip="Đang tải..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {(!periodType || !periodKey) && !loading && (
            <Alert message="Vui lòng chọn kỳ báo cáo để xem dữ liệu." type="info" showIcon closable style={{ marginBottom: 16, height: 80 }} />
          )}

          {!loading && data && (
            <>
              {/* CHỈ SỐ - Hàng 1 */}
              <Row gutter={[20, 20]}>
                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner gradient-info">
                    <Statistic
                      title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Doanh thu thực</span>}
                      value={data.totalRevenue}
                      formatter={formatVND}
                      valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                    />
                    {renderComparison(data.comparison?.revenueChange)}
                  </div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <AntTooltip title="Doanh thu thuần = Doanh thu thực - VAT thu hộ">
                    <div className="stat-card-inner" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Doanh thu thuần</span>}
                        value={data.netSales || 0}
                        formatter={formatVND}
                        valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                      />
                    </div>
                  </AntTooltip>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <AntTooltip title="Lợi nhuận gộp = Doanh thu thuần - Giá vốn hàng bán (COGS)">
                    <div className="stat-card-inner gradient-success">
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Lợi nhuận gộp</span>}
                        value={data.grossProfit}
                        formatter={formatVND}
                        valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                      />
                      {renderComparison(data.comparison?.grossProfitChange)}
                    </div>
                  </AntTooltip>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <AntTooltip title="Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành">
                    <div className="stat-card-inner gradient-primary">
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Lợi nhuận ròng</span>}
                        value={data.netProfit}
                        formatter={formatVND}
                        valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                      />
                      {renderComparison(data.comparison?.netProfitChange)}
                    </div>
                  </AntTooltip>
                </Col>
              </Row>

              {/* CHỈ SỐ - Hàng 2: Chi phí */}
              <Row gutter={[20, 20]} style={{ marginTop: 16 }}>
                <Col xs={24} sm={12} lg={6}>
                  <AntTooltip title="Giá vốn hàng bán = Tổng giá nhập của hàng đã bán trong kỳ">
                    <div className="stat-card-inner" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }}>
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Giá vốn (COGS)</span>}
                        value={data.totalCOGS || 0}
                        formatter={formatVND}
                        valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                      />
                    </div>
                  </AntTooltip>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <AntTooltip title="Bao gồm: Lương nhân viên, Hoa hồng & Chi phí ngoài hệ thống">
                    <div className="stat-card-inner gradient-warning">
                      <Statistic
                        title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Chi phí vận hành</span>}
                        value={data.operatingCost}
                        formatter={formatVND}
                        valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                      />
                      {renderComparison(data.comparison?.operatingCostChange)}
                    </div>
                  </AntTooltip>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner" style={{ background: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)" }}>
                    <Statistic
                      title={<span style={{ color: "rgba(255,255,255,0.8)" }}>VAT thu hộ</span>}
                      value={data.totalVAT || 0}
                      formatter={formatVND}
                      valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                    />
                  </div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner" style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}>
                    <Statistic
                      title={<span style={{ color: "rgba(255,255,255,0.8)" }}>Giá trị tồn kho</span>}
                      value={data.stockValue || 0}
                      formatter={formatVND}
                      valueStyle={{ color: "#fff", fontWeight: 800, fontSize: "24px" }}
                    />
                  </div>
                </Col>
              </Row>

              {/* BIỂU ĐỒ & PHÂN TÍCH */}
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={16}>
                  <Card
                    className="glass-card"
                    title={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Title level={4} style={{ margin: 0 }}>
                          Cơ cấu tài chính tổng quan
                        </Title>

                        <AntTooltip title="Đơn vị tính là triệu đồng">
                          <InfoCircleOutlined
                            style={{
                              color: "#1890ff",
                              fontSize: 16,
                              cursor: "pointer",
                            }}
                          />
                        </AntTooltip>
                      </div>
                    }
                  >
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={generateBarData()}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fff" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                        <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}tr`} axisLine={false} tickLine={false} tick={{ fill: "#64748b" }} />
                        <Tooltip
                          cursor={{ fill: "#f8fafc" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div
                                  style={{
                                    background: "#fff",
                                    padding: "12px 16px",
                                    borderRadius: "12px",
                                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "4px" }}>{payload[0].payload.name}</div>
                                  <div style={{ fontWeight: 700, fontSize: "16px", color: payload[0].payload.fill }}>
                                    {formatVND(payload[0].value)}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={50}>
                          {generateBarData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card className="glass-card" title={<Title level={4}>Hàng tồn kho</Title>}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
                            { name: "Hàng tồn kho", value: data.stockValue, fill: COLORS.stockValue },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill={COLORS.revenue} />
                          <Cell fill={COLORS.stockValue} />
                        </Pie>
                        <Tooltip formatter={formatVND} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: 16,
                        marginTop: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: COLORS.revenue,
                            display: "inline-block",
                          }}
                        />
                        <Text style={{ fontSize: 13 }}>Doanh thu</Text>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: COLORS.stockValue,
                            display: "inline-block",
                          }}
                        />
                        <Text style={{ fontSize: 13 }}>Hàng tồn kho</Text>
                      </div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <Text strong color="primary">
                          Tỷ lệ Tồn/Doanh thu
                        </Text>
                        <Tag color={data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5 ? "green" : "orange"} className="premium-tag">
                          {data.totalRevenue > 0 ? ((data.stockValue / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </Tag>
                      </div>
                      <Alert
                        message={
                          data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5
                            ? "Sức khỏe kho hàng: Tốt"
                            : "Cần tối ưu vòng quay hàng tồn"
                        }
                        type={data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5 ? "success" : "warning"}
                        showIcon
                      />
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* THỐNG KÊ NHÓM HÀNG */}
              <Card className="glass-card" title={<Title level={4}>Phân tích hiệu quả theo nhóm hàng</Title>}>
                <Table
                  dataSource={data.groupStats || []}
                  rowKey="_id"
                  className="premium-table"
                  pagination={{
                    pageSize: 5,
                    showTotal: (total, range) => (
                      <div style={{ fontSize: 14, color: "#595959" }}>
                        Đang xem{" "}
                        <span style={{ color: "#1677ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhóm hàng
                      </div>
                    ),
                  }}
                  columns={[
                    {
                      title: "Nhóm hàng",
                      dataIndex: "groupName",
                      render: (text) => (
                        <Text strong style={{ fontSize: "15px" }}>
                          {text}
                        </Text>
                      ),
                    },
                    {
                      title: "Doanh thu",
                      dataIndex: "revenue",
                      align: "right",
                      render: (val) => (
                        <Text strong color="primary">
                          {formatVND(val)}
                        </Text>
                      ),
                      sorter: (a, b) => a.revenue - b.revenue,
                    },
                    {
                      title: "Số lượng bán",
                      dataIndex: "quantitySold",
                      align: "center",
                      render: (val) => <Badge count={val} showZero overflowCount={999999} color={val === 0 ? "#d9d9d9" : "#6366f1"} />,
                    },
                    {
                      title: (
                        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                          <span>Tồn kho(theo giá vốn)</span>

                          <AntTooltip title="Giá trị được tính theo giá vốn: Tồn kho = Số lượng tồn × Giá vốn">
                            <InfoCircleOutlined
                              style={{
                                color: "#1890ff",
                                fontSize: 14,
                                cursor: "pointer",
                              }}
                            />
                          </AntTooltip>
                        </div>
                      ),
                      dataIndex: "stockValueCost",
                      align: "right",
                      render: (val, record) => (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <Text strong color="primary">
                            {formatVND(val)}
                          </Text>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setSelectedGroup(record);
                              setDetailModalVisible(true);
                            }}
                            style={{ padding: 0, height: "auto", fontSize: 12 }}
                          >
                            Xem chi tiết
                          </Button>
                        </div>
                      ),
                    },
                    {
                      title: (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer", // 👈 thêm dòng này
                          }}
                        >
                          <span>Tỷ lệ quay vòng</span>

                          <AntTooltip title="Tỷ lệ quay vòng = Doanh thu / Tồn kho">
                            <InfoCircleOutlined
                              style={{
                                color: "#1890ff",
                                fontSize: 14,
                                cursor: "pointer", // 👈 icon cũng có pointer
                              }}
                            />
                          </AntTooltip>
                        </div>
                      ),
                      dataIndex: "stockToRevenueRatio",
                      align: "center",
                      render: (val, record) => {
                        if (record.revenue === 0)
                          return (
                            <AntTooltip title="Chưa phát sinh doanh thu trong kỳ">
                              <Tag color="default" style={{ cursor: "help" }}>
                                Chưa bán
                              </Tag>
                            </AntTooltip>
                          );

                        if (val > 2)
                          return (
                            <AntTooltip title="Hàng tồn nhiều so với doanh thu → bán chậm">
                              <Tag color="error" className="premium-tag" style={{ cursor: "help" }}>
                                Tồn cao
                              </Tag>
                            </AntTooltip>
                          );

                        return (
                          <AntTooltip title="Doanh thu và tồn kho ở mức hợp lý">
                            <Tag color="success" className="premium-tag" style={{ cursor: "help" }}>
                              Ổn định
                            </Tag>
                          </AntTooltip>
                        );
                      },
                    },
                  ]}
                />
              </Card>

              {/* ======= Hết ====== */}
            </>
          )}
        </Space>
      </div>

      {/* ========== MODAL DRILL-DOWN: CHI TIẾT GIÁA VỐN ==========  */}
      <Modal
        title={`Chi tiết giá vốn - Nhóm: ${selectedGroup?.groupName || ""}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedGroup && selectedGroup.productDetails && selectedGroup.productDetails.length > 0 ? (
          <Table
            dataSource={selectedGroup.productDetails}
            rowKey="_id"
            pagination={false}
            size="small"
            columns={[
              {
                title: "Sản phẩm",
                dataIndex: "name",
                render: (text, record) => (
                  <div>
                    <Text strong>{text}</Text>
                    {record.code && <div style={{ fontSize: 12, color: "#999" }}>{record.code}</div>}
                  </div>
                ),
              },
              {
                title: "Giá vốn",
                dataIndex: "cost_price",
                align: "right",
                render: (val) => formatVND(val),
              },
              {
                title: "SL tồn",
                dataIndex: "stock_quantity",
                align: "center",
              },
              {
                title: "Tổng giá vốn",
                dataIndex: "stockValueCost",
                align: "right",
                render: (val) => (
                  <Text strong color="primary">
                    {formatVND(val)}
                  </Text>
                ),
              },
            ]}
            summary={(pageData) => {
              const total = pageData.reduce((sum, record) => sum + record.stockValueCost, 0);
              return (
                <Table.Summary.Row style={{ fontWeight: "bold" }}>
                  <Table.Summary.Cell colSpan={3} align="right">
                    <Text strong>Tổng cộng:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell align="right">
                    <Text strong color="primary">
                      {formatVND(total)}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        ) : (
          <Empty description="Không có sản phẩm trong nhóm này" />
        )}
      </Modal>
    </Layout>
  );
};

export default ReportDashboard;
