// src/pages/report/RevenueReport.jsx
import React, { useState, useEffect } from "react";
import { Card, Col, Row, Select, DatePicker, Statistic, Table, Spin, Alert, Space, Button, Tooltip, message, Typography } from "antd";
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CaretDownOutlined,
  DollarOutlined,
  ShoppingOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Dropdown, Menu } from "antd";
import axios from "axios";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";

dayjs.extend(quarterOfYear);
dayjs.locale("vi");

const { Option } = Select;
const { Text, Title } = Typography;

const apiUrl = import.meta.env.VITE_API_URL;

// Các loại báo cáo
const REPORT_TYPES = {
  MONTHLY_SUMMARY: "monthly_summary",
  YEARLY_PRODUCTGROUP_PRODUCTS: "yearly_productgroup_products",
  DAILY_PRODUCTS: "daily_products",
  DETAILED_OLD: "detailed_old",
};

const RevenueReport = () => {
  const { currentStore: authStore } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlStoreId = queryParams.get("storeId");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [reportPagination, setReportPagination] = useState({ current: 1, pageSize: 10 });

  // Ưu tiên store từ AuthContext, sau đó đến URL, cuối cùng là localStorage fallback
  const currentStore = authStore || (urlStoreId ? { _id: urlStoreId } : JSON.parse(localStorage.getItem("currentStore") || "{}"));

  // Filter
  const [reportType, setReportType] = useState(REPORT_TYPES.MONTHLY_SUMMARY);
  const [periodType, setPeriodType] = useState("month");
  const [periodKey, setPeriodKey] = useState("");
  const [selectedYear, setSelectedYear] = useState(dayjs());
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [yearCompareMeta, setYearCompareMeta] = useState({ year: dayjs().year(), prevYear: dayjs().year() - 1 });

  useEffect(() => {
    if (reportType !== REPORT_TYPES.DETAILED_OLD) return;
    setPeriodKey("");
  }, [periodType, reportType]);

  // Format VND
  const formatVND = (value) => {
    if (!value) return "0";
    const num = typeof value === "object" ? value.$numberDecimal : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const getExporterNameForFile = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}") || {};
      const raw = user.fullname || user.fullName || user.username || user.email || "NguoiDung";
      return String(raw)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\\/:*?\"<>|]/g, "-")
        .trim()
        .replace(/\s+/g, "_");
    } catch {
      return "NguoiDung";
    }
  };

  const getReportNameForFile = () => {
    if (reportType === REPORT_TYPES.MONTHLY_SUMMARY) return "Bao_cao_tong_hop_theo_thang";
    if (reportType === REPORT_TYPES.DAILY_PRODUCTS) return "Bao_cao_ban_hang_theo_ngay";
    if (reportType === REPORT_TYPES.YEARLY_PRODUCTGROUP_PRODUCTS) return "Bao_cao_doanh_thu_hang_nam";
    return "Bao_cao_doanh_thu_chi_tiet";
  };

  const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "object") {
      const n = parseFloat(value.$numberDecimal);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  // GỌI API
  const fetchData = async () => {
    if (!currentStore?._id) {
      setSummary(null);
      setEmployeeData([]);
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Không có token!");

      // ====== Báo cáo theo yêu cầu mới ======
      if (reportType === REPORT_TYPES.MONTHLY_SUMMARY) {
        const year = selectedYear.year();
        const res = await axios.get(`${apiUrl}/revenues/monthly-summary?storeId=${currentStore._id}&year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSummary(null);
        setEmployeeData([]);
        setReportRows(res.data.data || []);
        return;
      }

      if (reportType === REPORT_TYPES.DAILY_PRODUCTS) {
        const date = selectedDate.format("YYYY-MM-DD");
        const res = await axios.get(`${apiUrl}/revenues/daily-products?storeId=${currentStore._id}&date=${date}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Lưu tổng discount vào summary để hiển thị ở footer
        setSummary({ totalDailyDiscount: res.data.totalDailyDiscount || 0 });
        setEmployeeData([]);
        setReportRows(res.data.data || []);
        return;
      }

      if (reportType === REPORT_TYPES.YEARLY_PRODUCTGROUP_PRODUCTS) {
        const year = selectedYear.year();
        const res = await axios.get(`${apiUrl}/revenues/yearly-productgroup-products?storeId=${currentStore._id}&year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const groups = res.data.data || [];
        const flatRows = [];
        groups.forEach((g, gi) => {
          flatRows.push({
            key: `g-${gi}`,
            rowType: "group",
            label: g.productGroup?.name || "(Chưa phân nhóm)",
          });
          (g.items || []).forEach((it, ii) => {
            flatRows.push({
              key: `p-${gi}-${ii}`,
              rowType: "item",
              productName: it.productName,
              revenuePrevYear: it.revenuePrevYear,
              revenueThisYear: it.revenueThisYear,
              difference: it.difference,
              totalTwoYears: it.totalTwoYears,
            });
          });
        });
        setSummary(null);
        setEmployeeData([]);
        setYearCompareMeta({ year: res.data.year || year, prevYear: res.data.prevYear || year - 1 });
        setReportRows(flatRows);
        return;
      }

      // ====== Báo cáo chi tiết kiểu cũ ======
      if (!periodType || !periodKey) {
        setSummary(null);
        setEmployeeData([]);
        setReportRows([]);
        return;
      }

      // 1. Tổng doanh thu
      const totalRes = await axios.get(`${apiUrl}/revenues?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummary(totalRes.data.revenue);
      // 2. Doanh thu theo nhân viên
      const empRes = await axios.get(`${apiUrl}/revenues/employee?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = empRes.data.data || [];
      setEmployeeData(data);
      setPagination((prev) => ({ ...prev, total: data.length }));

      setReportRows([]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Tự tải lại khi đổi bộ lọc
    if (reportType === REPORT_TYPES.DETAILED_OLD) {
      if (!periodKey) return;
      fetchData();
      return;
    }
    fetchData();
  }, [reportType, periodType, periodKey, selectedYear, selectedMonth, selectedDate]);

  useEffect(() => {
    // Khi đổi bộ lọc của báo cáo theo mẫu mới, reset trang về 1 để tránh "trang rỗng"
    if (reportType === REPORT_TYPES.DETAILED_OLD) return;
    if (reportType === REPORT_TYPES.MONTHLY_SUMMARY) return; // tháng theo năm hiển thị 12 dòng, không phân trang
    setReportPagination((prev) => ({ ...prev, current: 1 }));
  }, [reportType, selectedYear, selectedMonth, selectedDate]);

  useEffect(() => {
    // Khi đổi kỳ báo cáo chi tiết, reset phân trang nhân viên
    if (reportType !== REPORT_TYPES.DETAILED_OLD) return;
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [reportType, periodKey, periodType]);

  // EXPORT ra file
  const handleExport = async (format) => {
    if (!currentStore?._id) {
      message.warning("Chưa chọn cửa hàng");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      let url = "";
      let fileName = "";

      const exportDate = dayjs().format("DD-MM-YYYY");
      const exporterName = getExporterNameForFile();
      const reportName = getReportNameForFile();

      if (reportType === REPORT_TYPES.MONTHLY_SUMMARY) {
        const year = selectedYear.year();
        const params = new URLSearchParams({ storeId: currentStore._id, year: String(year), format });
        url = `${apiUrl}/revenues/export-monthly-summary?${params.toString()}`;
        fileName = `${reportName}_${exportDate}_${exporterName}.${format}`;
      } else if (reportType === REPORT_TYPES.DAILY_PRODUCTS) {
        const date = selectedDate.format("YYYY-MM-DD");
        const params = new URLSearchParams({ storeId: currentStore._id, date, format });
        url = `${apiUrl}/revenues/export-daily-products?${params.toString()}`;
        fileName = `${reportName}_${exportDate}_${exporterName}.${format}`;
      } else if (reportType === REPORT_TYPES.YEARLY_PRODUCTGROUP_PRODUCTS) {
        const year = selectedYear.year();
        const params = new URLSearchParams({ storeId: currentStore._id, year: String(year), format });
        url = `${apiUrl}/revenues/export-yearly-productgroup-products?${params.toString()}`;
        fileName = `${reportName}_${exportDate}_${exporterName}.${format}`;
      } else {
        // Báo cáo chi tiết kiểu cũ
        if (!periodKey) {
          message.warning("Vui lòng chọn kỳ báo cáo");
          return;
        }
        const params = new URLSearchParams({ storeId: currentStore._id, periodType, periodKey, format });
        url = `${apiUrl}/revenues/export?${params.toString()}`;
        // Kì xuất chỉ có nếu là báo cáo chi tiết
        fileName = `${reportName}_${exportDate}_${exporterName}_${String(periodKey).replace(/[\\/:*?\"<>|]/g, "-")}.${format}`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      message.success(`Xuất ${format.toUpperCase()} thành công!`);
    } catch (err) {
      let msg = "Lỗi xuất file Excel";
      try {
        const data = err?.response?.data;
        if (data && typeof data === "object" && data.message) {
          msg = data.message;
        } else if (data instanceof Blob) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (json?.message) msg = json.message;
          } catch {
            if (text) msg = text;
          }
        } else if (err?.message) {
          msg = err.message;
        }
      } catch {
        // ignore
      }
      message.error(msg);
    }
  };

  const formatPhone = (num) => {
    if (!num) return "—";
    const cleaned = num.replace(/\D/g, ""); // loại bỏ ký tự không phải số
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    }
    return num; // fallback nếu không đủ 10 số
  };

  const formatPeriodTypeVi = (t) => {
    const v = String(t || "").toLowerCase();
    if (v === "day") return "Ngày";
    if (v === "month") return "Tháng";
    if (v === "quarter") return "Quý";
    if (v === "year") return "Năm";
    if (!v) return "—";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  // TABLE COLUMNS
  const totalRevenueNum = toNumber(summary?.totalRevenue);

  // Bảng tổng hợp kiểu cũ (sheet "Tổng hợp" trong exportRevenue)
  const detailedSummaryColumns = [
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Loại kỳ</span>,
      dataIndex: "periodType",
      key: "periodType",
      width: 120,
      render: (t) => <span style={{ fontSize: 16, fontWeight: 600 }}>{formatPeriodTypeVi(t)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Mã kỳ</span>,
      dataIndex: "periodKey",
      key: "periodKey",
      width: 140,
      render: (t) => <span style={{ fontSize: 16 }}>{t}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Từ ngày</span>,
      dataIndex: "periodStart",
      key: "periodStart",
      width: 140,
      render: (v) => <span style={{ fontSize: 16 }}>{v ? dayjs(v).format("DD/MM/YYYY") : "—"}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Đến ngày</span>,
      dataIndex: "periodEnd",
      key: "periodEnd",
      width: 140,
      render: (v) => <span style={{ fontSize: 16 }}>{v ? dayjs(v).format("DD/MM/YYYY") : "—"}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng doanh thu</span>,
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      align: "right",
      render: (v) => <span style={{ fontSize: 16, color: "#1890ff", fontWeight: 700 }}>{formatVND(v)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Số hóa đơn</span>,
      dataIndex: "countOrders",
      key: "countOrders",
      align: "center",
      width: 130,
      render: (v) => <span style={{ fontSize: 16, color: "#52c41a", fontWeight: 700 }}>{v}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Đơn đã hoàn tất</span>,
      dataIndex: "completedOrders",
      key: "completedOrders",
      align: "center",
      width: 120,
      render: (v) => <span style={{ fontSize: 16 }}>{v ?? 0}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Đơn hoàn 1 phần</span>,
      dataIndex: "partialRefundOrders",
      key: "partialRefundOrders",
      align: "center",
      width: 140,
      render: (v) => <span style={{ fontSize: 16 }}>{v ?? 0}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Giá trị TB/đơn</span>,
      dataIndex: "avgOrderValue",
      key: "avgOrderValue",
      align: "right",
      render: (v) => <span style={{ fontSize: 16 }}>{formatVND(v)}</span>,
    },
  ];

  // BÁO CÁO TỔNG HỢP THEO THÁNG
  const monthlySummaryColumns = [
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tháng (MM/YYYY)</span>,
      dataIndex: "monthLabel",
      key: "monthLabel",
      width: 150,
      render: (t) => <span style={{ fontSize: 16, fontWeight: 600 }}>{t}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng doanh thu</span>,
      dataIndex: "totalRevenue",
      key: "totalRevenue",
      align: "right",
      width: 200,
      render: (v) => <span style={{ fontSize: 16, color: "#1890ff", fontWeight: 700 }}>{formatVND(v)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng số đơn</span>,
      dataIndex: "orderCount",
      key: "orderCount",
      align: "right",
      width: 140,
      render: (v, r) => <span style={{ fontSize: 16, fontWeight: r?.isTotal ? 700 : 400 }}>{v ?? 0}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng số lượng sản phẩm bán</span>,
      dataIndex: "itemsSold",
      key: "itemsSold",
      align: "right",
      width: 190,
      render: (v, r) => <span style={{ fontSize: 16, fontWeight: r?.isTotal ? 700 : 400 }}>{v ?? 0}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Doanh thu trung bình / ngày</span>,
      dataIndex: "avgRevenuePerDay",
      key: "avgRevenuePerDay",
      align: "right",
      width: 220,
      render: (v, r) => <span style={{ fontSize: 16, fontWeight: r?.isTotal ? 700 : 400 }}>{r?.isTotal ? "—" : formatVND(v)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>So với tháng trước (+/−)</span>,
      dataIndex: "diffVsPrevMonth",
      key: "diffVsPrevMonth",
      align: "right",
      width: 210,
      render: (v, r) => {
        if (r?.isTotal) return <span style={{ fontSize: 16, fontWeight: 700 }}>—</span>;
        const n = toNumber(v);
        const sign = n > 0 ? "+" : "";
        return <span style={{ fontSize: 16 }}>{sign + formatVND(n)}</span>;
      },
    },
  ];

  const reportTableRows = React.useMemo(() => {
    const rows = Array.isArray(reportRows) ? reportRows : [];
    if (reportType !== REPORT_TYPES.MONTHLY_SUMMARY) return rows;
    const totalRevenue = rows.reduce((sum, r) => sum + toNumber(r.totalRevenue), 0);
    const totalOrderCount = rows.reduce((sum, r) => sum + toNumber(r.orderCount), 0);
    const totalItemsSold = rows.reduce((sum, r) => sum + toNumber(r.itemsSold), 0);
    const totalAvgRevenuePerDay = rows.reduce((sum, r) => sum + toNumber(r.avgRevenuePerDay), 0);
    const totalDiffVsPrevMonth = rows.reduce((sum, r) => sum + toNumber(r.diffVsPrevMonth), 0);

    return [
      ...rows,
      {
        isTotal: true,
        monthLabel: "Tổng cộng",
        totalRevenue,
        orderCount: totalOrderCount,
        itemsSold: totalItemsSold,
        avgRevenuePerDay: null,
        diffVsPrevMonth: null,
      },
    ];
  }, [reportRows, reportType]);

  // BÁO CÁO BÁN HÀNG THEO NGÀY (theo sản phẩm) - giữ lại theo yêu cầu
  const dailyProductColumns = [
    { title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Mã hàng</span>, dataIndex: "sku", key: "sku", width: 140 },
    { title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tên sản phẩm</span>, dataIndex: "productName", key: "productName", width: 240 },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Mô tả</span>,
      dataIndex: "productDescription",
      key: "productDescription",
      width: 320,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Đơn giá</span>,
      dataIndex: "unitPrice",
      key: "unitPrice",
      align: "right",
      width: 140,
      render: (v) => <span style={{ fontSize: 16 }}>{formatVND(v)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Số lượng</span>,
      dataIndex: "quantity",
      key: "quantity",
      align: "right",
      width: 110,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng doanh thu</span>,
      dataIndex: "grossTotal",
      key: "grossTotal",
      align: "right",
      width: 160,
      render: (v) => <span style={{ fontSize: 16 }}>{formatVND(v)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Thực thu ( tính VAT)</span>,
      dataIndex: "netTotal",
      key: "netTotal",
      align: "right",
      width: 160,
      render: (v) => <span style={{ fontSize: 16, color: "#1890ff", fontWeight: 700 }}>{formatVND(v)}</span>,
    },
  ];

  // BÁO CÁO DOANH THU HẰNG NĂM (productGroup -> sản phẩm)
  const yearlyGroupedColumns = [
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>DANH MỤC SẢN PHẨM</span>,
      key: "name",
      width: 360,
      render: (_, r) => {
        if (r.rowType === "group") {
          return <span style={{ fontSize: 16, fontWeight: 700 }}>{r.label}</span>;
        }
        return <span style={{ fontSize: 16 }}>{r.productName}</span>;
      },
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>{`Doanh số năm trước (${yearCompareMeta.prevYear})`}</span>,
      dataIndex: "revenuePrevYear",
      key: "revenuePrevYear",
      align: "right",
      width: 200,
      render: (_, r) => (r.rowType === "group" ? "" : <span style={{ fontSize: 16 }}>{formatVND(r.revenuePrevYear)}</span>),
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>{`Doanh số năm nay (${yearCompareMeta.year})`}</span>,
      dataIndex: "revenueThisYear",
      key: "revenueThisYear",
      align: "right",
      width: 200,
      render: (_, r) =>
        r.rowType === "group" ? "" : <span style={{ fontSize: 16, color: "#1890ff", fontWeight: 700 }}>{formatVND(r.revenueThisYear)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Chênh lệch</span>,
      dataIndex: "difference",
      key: "difference",
      align: "right",
      width: 170,
      render: (_, r) => {
        if (r.rowType === "group") return "";
        const n = toNumber(r.difference);
        const sign = n > 0 ? "+" : "";
        return <span style={{ fontSize: 16 }}>{sign + formatVND(n)}</span>;
      },
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Tổng doanh số hai năm</span>,
      dataIndex: "totalTwoYears",
      key: "totalTwoYears",
      align: "right",
      width: 220,
      render: (_, r) => (r.rowType === "group" ? "" : <span style={{ fontSize: 16 }}>{formatVND(r.totalTwoYears)}</span>),
    },
  ];

  const columns = [
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Loại kỳ</span>,
      dataIndex: "periodType",
      key: "periodType",
      width: 90,
      render: (t) => <span style={{ fontSize: 16 }}>{formatPeriodTypeVi(t || periodType)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Mã kỳ</span>,
      dataIndex: "periodKey",
      key: "periodKey",
      width: 85,
      render: (t) => <span style={{ fontSize: 16 }}>{t || periodKey}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Từ ngày</span>,
      dataIndex: "periodStart",
      key: "periodStart",
      width: 120,
      render: (v) => <span style={{ fontSize: 16 }}>{v ? dayjs(v).format("DD/MM/YYYY") : "—"}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Đến ngày</span>,
      dataIndex: "periodEnd",
      key: "periodEnd",
      width: 120,
      render: (v) => <span style={{ fontSize: 16 }}>{v ? dayjs(v).format("DD/MM/YYYY") : "—"}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Nhân viên</span>,
      dataIndex: ["employeeInfo", "fullName"],
      key: "name",
      render: (text) => <strong style={{ fontSize: "16px", color: "#262626" }}>{text}</strong>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Số điện thoại</span>,
      dataIndex: ["employeeInfo", "phone"],
      key: "phone",
      align: "center",
      width: 150,
      render: (text) => <span style={{ fontSize: "16px", color: "#595959", fontWeight: "bold" }}>{formatPhone(text)}</span>,
    },
    {
      title: <span style={{ whiteSpace: "nowrap", fontSize: "16px", fontWeight: 600 }}>Số đơn</span>,
      dataIndex: "countOrders",
      key: "orders",
      align: "center",
      width: 50,
      sorter: (a, b) => a.countOrders - b.countOrders,
      render: (value) => <span style={{ fontSize: "16px", color: "#52c41a", fontWeight: 600 }}>{value}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Doanh thu</span>,
      dataIndex: "totalRevenue",
      key: "revenue",
      align: "right",
      width: 130,
      sorter: (a, b) => toNumber(a.totalRevenue) - toNumber(b.totalRevenue),
      render: (value) => <span style={{ fontSize: "16px", color: "#1890ff", fontWeight: 600 }}>{formatVND(value)}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Giá trị TB/đơn</span>,
      key: "avgOrderValue",
      align: "right",
      width: 160,
      sorter: (a, b) => {
        const avga = a.countOrders ? toNumber(a.totalRevenue) / a.countOrders : 0;
        const avgb = b.countOrders ? toNumber(b.totalRevenue) / b.countOrders : 0;
        return avga - avgb;
      },
      render: (_, record) => {
        const avg = record.countOrders ? toNumber(record.totalRevenue) / record.countOrders : 0;
        return <span style={{ fontSize: 16 }}>{formatVND(avg)}</span>;
      },
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>%Tổng</span>,
      key: "sharePct",
      align: "right",
      width: 110,
      sorter: (a, b) => {
        const pa = totalRevenueNum > 0 ? (toNumber(a.totalRevenue) / totalRevenueNum) * 100 : 0;
        const pb = totalRevenueNum > 0 ? (toNumber(b.totalRevenue) / totalRevenueNum) * 100 : 0;
        return pa - pb;
      },
      render: (_, record) => {
        const pct = totalRevenueNum > 0 ? (toNumber(record.totalRevenue) / totalRevenueNum) * 100 : 0;
        return <span style={{ fontSize: 16 }}>{pct.toFixed(2)}%</span>;
      },
    },
  ];

  return (
    <Layout>
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* CARD FILTER */}
          <Card style={{ border: "1px solid #8c8c8c" }}>
            {/* HEADER */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
              <Title level={2} style={{ margin: 0, color: "#1890ff", marginBottom: 4 }}>
                {currentStore.name || "Đang tải..."}
              </Title>
              <Text style={{ color: "#595959", fontSize: "16px" }}>Báo Cáo Doanh Thu</Text>
            </div>

            {/* FILTERS */}
            <Row gutter={[10, 12]} align="bottom">
              {/* Loại báo cáo */}
              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                    Loại báo cáo
                  </Text>
                  <Select
                    value={reportType}
                    onChange={(v) => {
                      setReportType(v);
                      setError(null);
                      setReportPagination({ current: 1, pageSize: 10 });
                      // reset dữ liệu hiển thị khi đổi loại báo cáo
                      setSummary(null);
                      setEmployeeData([]);
                      setReportRows([]);
                    }}
                    style={{ width: "100%" }}
                    size="middle"
                  >
                    <Option value={REPORT_TYPES.DAILY_PRODUCTS}>Doanh thu theo ngày</Option>
                    <Option value={REPORT_TYPES.MONTHLY_SUMMARY}>Doanh thu theo tháng</Option>
                    <Option value={REPORT_TYPES.YEARLY_PRODUCTGROUP_PRODUCTS}>Doanh thu theo năm</Option>
                    <Option value={REPORT_TYPES.DETAILED_OLD}>Báo cáo doanh thu chi tiết</Option>
                  </Select>
                </div>
              </Col>

              {/* Loại kỳ */}
              {reportType === REPORT_TYPES.DETAILED_OLD && (
                <Col xs={24} sm={12} md={8} lg={5}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                      Loại kỳ báo cáo
                    </Text>
                    <Select value={periodType} onChange={setPeriodType} style={{ width: "100%" }} size="middle">
                      <Option value="day">Theo ngày</Option>
                      <Option value="month">Theo tháng</Option>
                      <Option value="quarter">Theo quý</Option>
                      <Option value="year">Theo năm</Option>
                    </Select>
                  </div>
                </Col>
              )}

              {/* Chọn kỳ */}
              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                    {reportType === REPORT_TYPES.DETAILED_OLD ? "Chọn kỳ" : reportType === REPORT_TYPES.DAILY_PRODUCTS ? "Chọn ngày" : "Chọn năm"}
                  </Text>
                  {reportType === REPORT_TYPES.DETAILED_OLD ? (
                    <DatePicker
                      style={{ width: "100%" }}
                      size="middle"
                      picker={periodType === "day" ? "date" : periodType === "quarter" ? "quarter" : periodType}
                      value={
                        !periodKey
                          ? null
                          : periodType === "day"
                            ? dayjs(periodKey, "YYYY-MM-DD")
                            : periodType === "month"
                              ? dayjs(periodKey, "YYYY-MM")
                              : periodType === "quarter"
                                ? dayjs(periodKey.replace("Q", ""), "YYYY-Q")
                                : periodType === "year"
                                  ? dayjs(periodKey, "YYYY")
                                  : null
                      }
                      onChange={(date) => {
                        if (!date) {
                          setPeriodKey("");
                          return;
                        }
                        let key = "";
                        if (periodType === "day") key = date.format("YYYY-MM-DD");
                        else if (periodType === "month") key = date.format("YYYY-MM");
                        else if (periodType === "quarter") key = `${date.year()}-Q${date.quarter()}`;
                        else if (periodType === "year") key = date.format("YYYY");
                        setPeriodKey(key);
                      }}
                      format={(value) => {
                        if (periodType === "day") return value.format("DD/MM/YYYY");
                        if (periodType === "month") return value.format("MM/YYYY");
                        if (periodType === "quarter") return `Quý ${value.quarter()} ${value.year()}`;
                        if (periodType === "year") return value.format("YYYY");
                        return "";
                      }}
                      placeholder={`Chọn ${
                        periodType === "day" ? "Ngày" : periodType === "month" ? "Tháng" : periodType === "quarter" ? "Quý" : "Năm"
                      }`}
                    />
                  ) : reportType === REPORT_TYPES.DAILY_PRODUCTS ? (
                    <DatePicker
                      style={{ width: "100%" }}
                      size="middle"
                      picker="date"
                      value={selectedDate}
                      onChange={(v) => v && setSelectedDate(v)}
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày"
                    />
                  ) : (
                    <DatePicker
                      style={{ width: "100%" }}
                      size="middle"
                      picker="year"
                      value={selectedYear}
                      onChange={(v) => v && setSelectedYear(v)}
                      format="YYYY"
                      placeholder="Chọn năm"
                    />
                  )}
                </div>
              </Col>

              {/* Nút xuất file */}
              <Col xs={24} sm={12} md={8} lg={4}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" }}>
                  <Dropdown
                    overlay={
                      <Menu onClick={({ key }) => handleExport(key)}>
                        <Menu.Item key="xlsx" icon={<FileExcelOutlined />}>
                          Xuất Excel
                        </Menu.Item>
                        <Menu.Item key="pdf" icon={<FilePdfOutlined />}>
                          Xuất PDF
                        </Menu.Item>
                      </Menu>
                    }
                  >
                    <Button type="primary" icon={<DownloadOutlined />}>
                      Xuất báo cáo <CaretDownOutlined />
                    </Button>
                  </Dropdown>
                </div>
              </Col>
            </Row>
          </Card>

          {/* LOADING */}
          {loading && <Spin tip="Đang tải báo cáo..." style={{ width: "100%", margin: "20px 0" }} />}

          {/* ERROR */}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {/* THÔNG BÁO CHƯA CHỌN KỲ */}
          {reportType === REPORT_TYPES.DETAILED_OLD && (!periodType || !periodKey) && !loading && (
            <Alert message="Vui lòng chọn kỳ báo cáo để xem dữ liệu." type="info" showIcon closable style={{ marginBottom: 16 }} />
          )}

          {/* HIỂN THỊ DỮ LIỆU */}
          {reportType === REPORT_TYPES.DETAILED_OLD && periodKey && summary && (
            <>
              {/* TỔNG DOANH THU */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={12}>
                  <Card style={{ border: "1px solid #8c8c8c", borderLeft: "4px solid #1890ff" }}>
                    <Statistic
                      title={<span style={{ fontSize: "16px", color: "#595959" }}>Tổng doanh thu</span>}
                      value={summary.totalRevenue?.$numberDecimal || summary.totalRevenue}
                      formatter={formatVND}
                      valueStyle={{ color: "#1890ff", fontSize: 32, fontWeight: 700 }}
                      prefix={<DollarOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={12}>
                  <Tooltip
                    title="Tổng số hóa đơn đã bán trong khoảng thời gian đã chọn, tính cả trường hợp chủ cửa hàng trực tiếp bán"
                    placement="top"
                  >
                    <Card
                      hoverable
                      style={{
                        border: "1px solid #8c8c8c",
                        borderLeft: "4px solid #52c41a",
                        cursor: "pointer",
                      }}
                    >
                      <Statistic
                        title={
                          <span
                            style={{
                              fontSize: 16,
                              color: "#595959",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            Số hóa đơn đã bán
                            <InfoCircleOutlined style={{ color: "#1890ff", fontSize: 14 }} />
                          </span>
                        }
                        value={summary.countOrders}
                        valueStyle={{
                          color: "#52c41a",
                          fontSize: 32,
                          fontWeight: 700,
                        }}
                        prefix={<ShoppingOutlined />}
                      />
                    </Card>
                  </Tooltip>
                </Col>
              </Row>

              {/* BẢNG TỔNG HỢP (GIỐNG SHEET "Tổng hợp" trong Excel) */}
              <Card
                title={
                  <span style={{ fontSize: "18px", color: "#262626", fontWeight: 600 }}>
                    <DollarOutlined style={{ color: "#1890ff", marginRight: 8 }} />
                    Bảng tổng hợp doanh thu
                  </span>
                }
                style={{ border: "1px solid #8c8c8c" }}
              >
                <Table
                  columns={detailedSummaryColumns}
                  dataSource={[
                    {
                      ...summary,
                      periodType,
                      periodKey,
                    },
                  ]}
                  rowKey={() => "summary"}
                  pagination={false}
                  scroll={{ x: 1100 }}
                />
              </Card>

              {/* DOANH THU NHÂN VIÊN */}
              <Card
                title={
                  <span style={{ fontSize: "18px", color: "#262626", fontWeight: 600 }}>
                    <DollarOutlined style={{ color: "#1890ff", marginRight: 8 }} />
                    Doanh thu theo nhân viên
                  </span>
                }
                style={{ border: "1px solid #8c8c8c" }}
              >
                {/* MÔ TẢ NHẸ
                <Alert
                  type="info"
                  showIcon
                  style={{
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                  message={
                    <span style={{ fontSize: 14 }}>
                      Bảng này <strong>thống kê doanh thu từ các hóa đơn do nhân viên trực tiếp bán</strong>
                    </span>
                  }
                /> */}

                {/* ĐƯỜNG NGĂN */}
                <div
                  style={{
                    borderBottom: "2px solid #e8e8e8",
                    margin: "5px 0 16px",
                  }}
                />

                <Table
                  columns={columns}
                  dataSource={employeeData}
                  rowKey={(record) => record._id}
                  pagination={{
                    ...pagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    showTotal: (total, range) => (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#595959" }}>
                        <div>
                          Đang xem{" "}
                          <span style={{ color: "#1890ff", fontWeight: 600 }}>
                            {range[0]} – {range[1]}
                          </span>{" "}
                          trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhân viên
                        </div>
                      </div>
                    ),
                  }}
                  onChange={(p) =>
                    setPagination((prev) => ({
                      ...prev,
                      current: p.current,
                      pageSize: p.pageSize,
                    }))
                  }
                  scroll={{ x: 600 }}
                  locale={{
                    emptyText: <div style={{ color: "#8c8c8c", padding: "20px" }}>Không có dữ liệu nhân viên trong kỳ này</div>,
                  }}
                />
              </Card>
            </>
          )}

          {/* ====== BÁO CÁO THEO MẪU MỚI: 1 bảng thay đổi theo loại báo cáo ====== */}
          {reportType !== REPORT_TYPES.DETAILED_OLD && !loading && (
            <Card
              title={
                <span style={{ fontSize: "18px", color: "#262626", fontWeight: 600 }}>
                  <DollarOutlined style={{ color: "#1890ff", marginRight: 8 }} />
                  {reportType === REPORT_TYPES.MONTHLY_SUMMARY
                    ? "Báo cáo tổng hợp theo tháng"
                    : reportType === REPORT_TYPES.DAILY_PRODUCTS
                      ? "Báo cáo bán hàng theo ngày"
                      : "Báo cáo doanh thu hằng năm theo danh mục & sản phẩm"}
                </span>
              }
              style={{ border: "1px solid #8c8c8c" }}
            >
              <Table
                columns={
                  reportType === REPORT_TYPES.MONTHLY_SUMMARY
                    ? monthlySummaryColumns
                    : reportType === REPORT_TYPES.DAILY_PRODUCTS
                      ? dailyProductColumns
                      : yearlyGroupedColumns
                }
                dataSource={reportTableRows
                  .filter((r) => {
                    if (reportType === REPORT_TYPES.DAILY_PRODUCTS) {
                      return toNumber(r.quantity) > 0;
                    }
                    return true;
                  })
                  .map((r, idx) => ({ key: idx, ...r }))}
                pagination={
                  reportType === REPORT_TYPES.MONTHLY_SUMMARY
                    ? false
                    : {
                        ...reportPagination,
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50", "100"],
                        showQuickJumper: true,
                      }
                }
                onChange={(p) => {
                  if (reportType === REPORT_TYPES.MONTHLY_SUMMARY) return;
                  setReportPagination({ current: p.current, pageSize: p.pageSize });
                }}
                scroll={{ x: 1100 }}
                locale={{ emptyText: <div style={{ color: "#8c8c8c", padding: "20px" }}>Không có dữ liệu</div> }}
                summary={(pageData) => {
                  if (reportType !== REPORT_TYPES.DAILY_PRODUCTS) return undefined;

                  // Tính tổng trên toàn bộ dữ liệu (reportRows)
                  const totalGross = reportRows.reduce((a, b) => a + toNumber(b.grossTotal), 0);
                  // Tính tổng thực thu từ các item (đã trừ hoàn)
                  // Lưu ý: netTotal ở đây là (doanh thu item - hoàn item), chưa trừ discount order
                  const totalNetOfItems = reportRows.reduce((a, b) => a + toNumber(b.netTotal), 0);

                  const totalDiscount = toNumber(summary?.totalDailyDiscount);
                  const finalRevenue = totalNetOfItems - totalDiscount;

                  return (
                    <Table.Summary fixed>
                      {/* Dòng 1: Tổng tiền hàng */}
                      <Table.Summary.Row style={{ background: "#fff" }}>
                        <Table.Summary.Cell index={0} colSpan={5}>
                           <div style={{ textAlign: "right", paddingRight: 8 }}>
                              <Text type="secondary" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>Tổng tiền hàng:</Text>
                           </div>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong style={{ fontSize: 15 }}>{formatVND(totalGross)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong style={{ fontSize: 15 }}>{formatVND(totalNetOfItems)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>

                      {/* Dòng 2: Giảm giá hóa đơn (chỉ hiện nếu có) */}
                      {totalDiscount > 0 && (
                        <Table.Summary.Row style={{ background: "#fff" }}>
                          <Table.Summary.Cell index={0} colSpan={5} style={{ border: "none" }}>
                            <div style={{ textAlign: "right", paddingRight: 8 }}>
                               <Text type="danger" style={{ fontSize: 13 }}>- Giảm giá hóa đơn:</Text>
                            </div>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right" style={{ border: "none" }}>
                             {/* Empty cell to maintain alignment */}
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right" style={{ border: "none" }}>
                            <Text type="danger">-{formatVND(totalDiscount)}</Text>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}

                      {/* Dòng 3: Doanh thu thực tế (Highlight) */}
                      <Table.Summary.Row style={{ background: "#fff" }}>
                        <Table.Summary.Cell index={0} colSpan={5} style={{ borderTop: "2px solid #52c41a" }}>
                           <div style={{ textAlign: "right", paddingRight: 8, paddingTop: 4 }}>
                              <Text style={{ fontSize: 16, color: "#389e0d", fontWeight: 800, textTransform: "uppercase" }}>
                                TỔNG DOANH THU THỰC TẾ:
                              </Text>
                           </div>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right" style={{ borderTop: "2px solid #52c41a" }}>
                             {/* Empty cell to maintain alignment */}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right" style={{ borderTop: "2px solid #52c41a" }}>
                           <div style={{ paddingTop: 4 }}>
                               <div style={{ background: "#389e0d", padding: "6px 16px", borderRadius: 4, color: "#fff", display: "inline-block" }}>
                                  <Text style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                                    {formatVND(finalRevenue)}
                                  </Text>
                               </div>
                           </div>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </Card>
          )}
        </Space>
      </div>
    </Layout>
  );
};

export default RevenueReport;
