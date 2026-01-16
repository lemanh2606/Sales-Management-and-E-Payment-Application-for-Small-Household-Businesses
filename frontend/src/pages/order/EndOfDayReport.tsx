// src/pages/order/EndOfDayReport.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  DatePicker,
  Select,
  Button,
  Table,
  Statistic,
  Typography,
  Tag,
  Space,
  Divider,
  message,
  Spin,
  Empty,
  Tooltip as AntdTooltip,
} from "antd";
import {
  DollarOutlined,
  ShoppingOutlined,
  WalletOutlined,
  GiftOutlined,
  PercentageOutlined,
  UndoOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  BarChartOutlined,
  UserOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, PieLabelRenderProps } from "recharts";
import debounce from "../../utils/debounce";
import Swal from "sweetalert2";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "../../premium.css";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";

// Khởi tạo plugin
dayjs.extend(utc); // ✅ THÊM
dayjs.extend(timezone); // ✅ THÊM

// Set timezone mặc định cho toàn app (nếu muốn)
dayjs.tz.setDefault("Asia/Ho_Chi_Minh"); // ✅ THÊM (optional)

const { Title, Text } = Typography;
const { Option } = Select;

const apiUrl = import.meta.env.VITE_API_URL;

const API_BASE = `${apiUrl}`;

// Interface định nghĩa kiểu dữ liệu
interface ReportSummary {
  // Doanh thu
  grossRevenue: number; // Doanh thu gộp (trước hoàn)
  totalRefundAmount: number; // Tiền hoàn
  totalRevenue: number; // Doanh thu thực (đã trừ hoàn)
  vatTotal: number; // Thuế VAT
  netSales: number; // Doanh thu thuần = Doanh thu thực - VAT

  // Chi phí & Lợi nhuận
  totalCOGS: number; // Giá vốn hàng bán
  grossProfit: number; // Lợi nhuận gộp = Doanh thu thuần - COGS
  
  // Tiền mặt
  grossCashInDrawer: number; // Tiền mặt trước hoàn
  cashRefundAmount: number; // Tiền mặt hoàn
  cashInDrawer: number; // Tiền mặt thực
  
  // Thống kê khác
  totalOrders: number;
  totalRefunds: number; // Số lần hoàn
  totalDiscount: number;
  totalLoyaltyUsed: number;
  totalLoyaltyEarned: number;
}

interface PaymentMethodData {
  _id: string;
  revenue: number;
  count: number;
}

interface PieLabelProps {
  name: string;
  percent: number;
  // có thì thêm
}

interface EmployeeData {
  _id: string;
  name: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface ProductData {
  _id: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
  refundQuantity: number;
  netSold: number;
}

interface StockData {
  productId: string;
  name: string;
  sku: string;
  stock: number;
}

interface RefundByEmployee {
  refundedBy: string;
  name: string;
  refundAmount: any; // Có thể là number hoặc { $numberDecimal: string }
  refundedAt: string;
}

interface ReportData {
  date: string;
  store: {
    _id: string;
    name: string;
  };
  summary: ReportSummary;
  byPayment: PaymentMethodData[];
  byEmployee: EmployeeData[];
  byProduct: ProductData[];
  stockSnapshot: StockData[];
  refundsByEmployee: RefundByEmployee[];
}

// Màu sắc cho biểu đồ
const COLORS = ["#55ed09ff", "#1890ff", "#faad14", "#f5222d", "#722ed1", "#13c2c2"];

// Mapping tên phương thức thanh toán
const PAYMENT_METHOD_NAMES: Record<string, string> = {
  cash: "Tiền mặt",
  qr: "QR Code",
};
//map từ khóa PeriodType sang tiếng Việt
const PERIOD_LABELS: Record<string, string> = {
  day: "hôm nay",
  month: "tháng này",
  quarter: "quý này",
  year: "năm nay",
};

const EndOfDayReport: React.FC = () => {
  const { currentStore: authStore } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlStoreId = queryParams.get("storeId");

  // Ưu tiên store từ AuthContext, sau đó đến URL, cuối cùng là localStorage fallback
  const currentStore = authStore || (urlStoreId ? { _id: urlStoreId } : JSON.parse(localStorage.getItem("currentStore") || "{}"));
  const storeId = currentStore?._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [periodType, setPeriodType] = useState<string>("day");
  const [selectedDate, setSelectedDate] = useState(dayjs().tz("Asia/Ho_Chi_Minh")); // ✅ THÊM .tz()

  //dùng setPagination riêng (đỡ giẫm nhau nếu người dùng lật trang nhiều bảng khác loại cùng lúc)
  const [paginationEmployee, setPaginationEmployee] = useState({
    current: 1,
    pageSize: 10,
  });
  const [paginationProduct, setPaginationProduct] = useState({
    current: 1,
    pageSize: 10,
  });
  const [paginationRefund, setPaginationRefund] = useState({
    current: 1,
    pageSize: 10,
  });
  const [paginationStock, setPaginationStock] = useState({
    current: 1,
    pageSize: 10,
  });

  const toNumber = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === "object" && "$numberDecimal" in (value as any)) {
      return parseFloat((value as any).$numberDecimal);
    }
    return Number(value);
  };

  // Load báo cáo từ API
  const loadReport = useCallback(
    async (date: Dayjs, period: string) => {
      setLoading(true);
      try {
        let periodKey = "";

        // ✅ Convert sang UTC+7 rồi mới format
        const vnDate = date.tz("Asia/Ho_Chi_Minh");

        switch (period) {
          case "day":
            // periodKey dạng YYYY-MM-DD
            periodKey = vnDate.format("YYYY-MM-DD");
            break;
          case "month":
            periodKey = vnDate.format("YYYY-MM");
            break;
          case "quarter":
            periodKey = `${vnDate.year()}-Q${Math.floor(vnDate.month() / 3 + 1)}`;
            break;
          case "year":
            periodKey = vnDate.format("YYYY");
            break;
          default:
            periodKey = vnDate.format("YYYY-MM-DD");
        }

        const res = await axios.get(`${API_BASE}/financials/end-of-day/${storeId}`, {
          params: { periodType: period, periodKey, timezone: "Asia/Ho_Chi_Minh" },
          headers,
        });
        setReportData(res.data.report);
      } catch (err: any) {
        Swal.fire({
          title: " Lỗi!",
          text: err.response?.data?.message || "Lỗi tải báo cáo",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#ff4d4f",
          timer: 2000,
        });

        setReportData(null);
      } finally {
        setLoading(false);
      }
    },
    [storeId, headers]
  );

  // Load lần đầu khi component mount
  useEffect(() => {
    if (storeId) {
      loadReport(selectedDate, periodType);
    }
  }, [storeId]);

  // Debounce khi thay đổi ngày
  const debouncedLoad = useCallback(
    debounce((date: Dayjs, period: string) => {
      loadReport(date, period);
    }, 500),
    [loadReport]
  );

  // Xử lý thay đổi ngày
  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedDate(date);
      debouncedLoad(date, periodType);
    }
  };

  // Xử lý thay đổi khoảng thời gian
  const handlePeriodChange = (value: string) => {
    setPeriodType(value);
    loadReport(selectedDate, value);
  };

  // Format số tiền
  const formatCurrency = (value: number | any): string => {
    // Xử lý trường hợp $numberDecimal từ MongoDB
    const numValue = typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Tạo periodKey cho export
  const getPeriodKey = (): string => {
    const vnDate = selectedDate.tz("Asia/Ho_Chi_Minh");
    switch (periodType) {
      case "day": return vnDate.format("YYYY-MM-DD");
      case "month": return vnDate.format("YYYY-MM");
      case "quarter": return `${vnDate.year()}-Q${Math.floor(vnDate.month() / 3 + 1)}`;
      case "year": return vnDate.format("YYYY");
      default: return vnDate.format("YYYY-MM-DD");
    }
  };

  // Xuất Excel
  const handleExportExcel = async () => {
    try {
      message.loading({ content: "Đang xuất Excel...", key: "export" });
      const periodKey = getPeriodKey();
      const res = await axios.get(`${API_BASE}/financials/end-of-day/${storeId}/export`, {
        params: { periodType, periodKey, format: "xlsx" },
        headers,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Bao_Cao_Cuoi_Ngay_${periodKey}.xlsx`;
      link.click();
      message.success({ content: "Xuất Excel thành công!", key: "export" });
    } catch (err: any) {
      message.error({ content: err.response?.data?.message || "Lỗi xuất Excel", key: "export" });
    }
  };

  // Xuất PDF
  const handleExportPDF = async () => {
    try {
      message.loading({ content: "Đang xuất PDF...", key: "export" });
      const periodKey = getPeriodKey();
      const res = await axios.get(`${API_BASE}/financials/end-of-day/${storeId}/export`, {
        params: { periodType, periodKey, format: "pdf" },
        headers,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Bao_Cao_Cuoi_Ngay_${periodKey}.pdf`;
      link.click();
      message.success({ content: "Xuất PDF thành công!", key: "export" });
    } catch (err: any) {
      message.error({ content: err.response?.data?.message || "Lỗi xuất PDF", key: "export" });
    }
  };

  // Render loading
  if (loading && !reportData) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="Đang tải báo cáo..." />
      </div>
    );
  }

  // Render empty
  if (!reportData) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Không có dữ liệu báo cáo" />
      </div>
    );
  }

  // Chuẩn bị dữ liệu cho biểu đồ Pie
  const pieData = reportData.byPayment.map((item) => ({
    name: PAYMENT_METHOD_NAMES[item._id] || item._id,
    value: toNumber(item.revenue),
    count: item.count,
  }));
  console.log("PieData:", pieData);
  console.log(
    "Tổng value:",
    pieData.reduce((a, b) => a + b.value, 0)
  );

  //Tính toán và hiển thị thông tin range Phân trang
  const paginationConfig = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => (
      <div>
        Đang xem{" "}
        <span style={{ color: "#1890ff", fontWeight: 600 }}>
          {range[0]} – {range[1]}
        </span>{" "}
        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
      </div>
    ),
  };

  return (
    <div className="premium-layout">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* HEADER & FILTERS */}
        <Card className="glass-card">
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} lg={8}>
              <Title level={2} className="premium-title" style={{ margin: 0 }}>
                Báo cáo kết quả bán hàng
              </Title>
              <Text type="secondary">
                {currentStore.name} • {PERIOD_LABELS[periodType] || ""} {selectedDate.format("DD/MM/YYYY")}
              </Text>
            </Col>

            <Col xs={12} lg={4}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>Chọn phạm vi</Text>
              <Select
                value={periodType}
                onChange={handlePeriodChange}
                style={{ width: "100%" }}
                size="large"
              >
                <Option value="day">Hàng ngày</Option>
                <Option value="month">Hàng tháng</Option>
                <Option value="quarter">Hàng quý</Option>
                <Option value="year">Hàng năm</Option>
              </Select>
            </Col>

            <Col xs={12} lg={4}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>Chọn thời gian</Text>
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                picker={periodType === "month" ? "month" : periodType === "year" ? "year" : periodType === "quarter" ? "quarter" : "date"}
                style={{ width: "100%" }}
                size="large"
                allowClear={false}
              />
            </Col>

            <Col xs={24} lg={8} style={{ textAlign: "right" }}>
              <Space>
                <Button 
                  size="large" 
                  icon={<UndoOutlined />} 
                  onClick={() => loadReport(selectedDate, periodType)}
                >
                  Làm mới
                </Button>
                <Button 
                  type="default" 
                  size="large" 
                  icon={<FileExcelOutlined />} 
                  onClick={handleExportExcel}
                  style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                >
                  Xuất Excel
                </Button>
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<FilePdfOutlined />} 
                  onClick={handleExportPDF}
                  className="gradient-primary"
                  style={{ border: 'none' }}
                >
                  Xuất PDF
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* SUMMARY STATS - Hàng 1: Doanh thu & Tiền mặt */}
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card-inner gradient-info">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Doanh thu thực</span>}
                value={reportData.summary.totalRevenue}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<DollarOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card-inner gradient-primary">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Doanh thu thuần</span>}
                value={reportData.summary.netSales || 0}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<DollarOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card-inner gradient-success">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Lợi nhuận gộp</span>}
                value={reportData.summary.grossProfit || 0}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<DollarOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <div className="stat-card-inner" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Tiền mặt (Két)</span>}
                value={reportData.summary.cashInDrawer}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<WalletOutlined />}
              />
            </div>
          </Col>
        </Row>

        {/* SUMMARY STATS - Hàng 2: Chi tiết khác */}
        <Row gutter={[20, 20]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} lg={4}>
            <div className="stat-card-inner gradient-warning">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Số đơn hàng</span>}
                value={reportData.summary.totalOrders}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<ShoppingOutlined />}
                suffix="đơn"
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <div className="stat-card-inner gradient-error">
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Tiền hoàn hàng</span>}
                value={reportData.summary.totalRefundAmount}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<UndoOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <div className="stat-card-inner" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Giá vốn (COGS)</span>}
                value={reportData.summary.totalCOGS || 0}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<BarChartOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <div className="stat-card-inner" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>VAT Tổng</span>}
                value={reportData.summary.vatTotal}
                formatter={(v) => formatCurrency(Number(v))}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<PercentageOutlined />}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <div className="stat-card-inner" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' }}>
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Điểm tích lũy</span>}
                value={reportData.summary.totalLoyaltyEarned}
                valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}
                prefix={<GiftOutlined />}
                suffix="đ"
              />
            </div>
          </Col>
        </Row>

      {/* BIỂU ĐỒ VÀ BẢNG */}
      <Row gutter={[16, 16]}>
        {/* BIỂU ĐỒ PIE */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span>
                <DollarOutlined style={{ marginRight: 8 }} />
                Phân Loại Theo Phương Thức Thanh Toán
              </span>
            }
            style={{ borderRadius: 12, height: "100%" }}
          >
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  minAngle={3}
                  labelLine={true}
                  label={(props: PieLabelRenderProps) => {
                    const { name, percent } = props;
                    const p = typeof percent === "number" ? percent : 0;
                    // Chuyển sang phần trăm, giữ nguyên 2 chữ số thập phân nhưng KHÔNG làm tròn
                    const exactPercent = Math.floor(p * 10000) / 100; // 0.99957*10000=9995.7 -> floor=9995 -> /100 làm tròn 2 số sau ,
                    return `${name}: ${exactPercent}%`;
                  }}
                  outerRadius={110}
                  innerRadius={50}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>

                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <Divider />

            <Space direction="vertical" style={{ width: "100%" }}>
              {reportData.byPayment.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text>
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: COLORS[idx % COLORS.length],
                        marginRight: 8,
                      }}
                    />
                    {PAYMENT_METHOD_NAMES[item._id]} ({item.count} đơn)
                  </Text>
                  <Text strong>{formatCurrency(item.revenue)}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* BẢNG NHÂN VIÊN */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <span>
                <UserOutlined style={{ marginRight: 8 }} />
                Doanh Thu Theo Nhân Viên & Admin
                <AntdTooltip title="Bao gồm doanh thu từ nhân viên và cả chủ cửa hàng (Admin)">
                  <InfoCircleOutlined style={{ marginLeft: 6, color: "#1890ff", cursor: "pointer" }} />
                </AntdTooltip>
              </span>
            }
            style={{ borderRadius: 12 }}
          >
            <Table
              dataSource={reportData.byEmployee}
              rowKey="_id"
              pagination={{
                ...paginationConfig,
                current: paginationEmployee.current,
                pageSize: paginationEmployee.pageSize,
                onChange: (page, pageSize) => setPaginationEmployee({ current: page, pageSize }),
              }}
              scroll={{ x: 600, y: 300 }}
              columns={[
                {
                  title: "Nhân Viên",
                  dataIndex: "name",
                  key: "name",
                  render: (text) => <Text strong>{text}</Text>,
                },
                {
                  title: "Số Đơn",
                  dataIndex: "orders",
                  key: "orders",
                  align: "center",
                  sorter: (a, b) => a.orders - b.orders,
                  render: (value) => <Tag color="blue">{value}</Tag>,
                },
                {
                  title: "Doanh Thu",
                  dataIndex: "revenue",
                  key: "revenue",
                  align: "right",
                  sorter: (a, b) => a.revenue - b.revenue,
                  render: (value) => (
                    <Text strong style={{ color: "#52c41a" }}>
                      {formatCurrency(value)}
                    </Text>
                  ),
                },
                {
                  title: "Giá Trị Trung bình / Đơn",
                  dataIndex: "avgOrderValue",
                  key: "avgOrderValue",
                  align: "right",
                  render: (value) => {
                    const roundedValue = Math.round(
                      typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value)
                    );
                    return (
                      <Text strong style={{ color: "#1249c1ff" }}>
                        {formatCurrency(roundedValue)}
                      </Text>
                    );
                  },
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* BẢNG SẢN PHẨM BÁN CHẠY */}
      <Card
        title={
          <span>
            <InboxOutlined style={{ marginRight: 8 }} />
            Sản Phẩm Bán Chạy Trong Ngày
          </span>
        }
        style={{ marginTop: 16, borderRadius: 12 }}
      >
        <Table
          dataSource={reportData.byProduct}
          rowKey="_id"
          pagination={{
            ...paginationConfig,
            current: paginationProduct.current,
            pageSize: paginationProduct.pageSize,
            onChange: (page, pageSize) => setPaginationProduct({ current: page, pageSize }),
          }}
          scroll={{ x: 700 }}
          columns={[
            {
              title: "Tên Sản Phẩm",
              dataIndex: "name",
              key: "name",
              ellipsis: true,
              width: 380,
              render: (text) => <Text strong>{text}</Text>,
            },
            {
              title: "Mã SKU",
              dataIndex: "sku",
              key: "sku",
              width: 280,
              render: (text) => <Text code>{text}</Text>,
            },
            {
              title: "Số Lượng Bán",
              dataIndex: "quantitySold",
              key: "quantitySold",
              align: "center",
              sorter: (a, b) => a.quantitySold - b.quantitySold,
              render: (value) => <Tag color="green">{value}</Tag>,
            },
            {
              title: "Doanh Thu",
              dataIndex: "revenue",
              key: "revenue",
              align: "right",
              sorter: (a, b) => a.revenue - b.revenue,
              render: (value) => (
                <Text strong style={{ color: "#1890ff" }}>
                  {formatCurrency(value)}
                </Text>
              ),
            },
            {
              title: "Hoàn Trả",
              dataIndex: "refundQuantity",
              key: "refundQuantity",
              align: "center",
              render: (value) => (value > 0 ? <Tag color="red">{value}</Tag> : <Text type="secondary">0</Text>),
            },
            {
              title: "Còn Lại Trong Kho",
              dataIndex: "netSold",
              key: "netSold",
              align: "center",
              render: (value) => <Tag color="blue">{value}</Tag>,
            },
          ]}
        />
      </Card>

      {/* PHẦN HOÀN HÀNG */}
      {reportData.summary.totalRefunds > 0 && (
        <Card
          title={
            <span>
              <UndoOutlined style={{ marginRight: 8, color: "#ff4d4f" }} />
              Chi Tiết Hoàn Hàng
            </span>
          }
          style={{ marginTop: 16, borderRadius: 12, borderColor: "#ffccc7" }}
        >
          <div
            style={{
              background: "#fff1f0",
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>
              {`Trong ${PERIOD_LABELS[periodType] || "khoảng thời gian này"} có ${
                reportData.summary.totalRefunds
              } đơn hoàn, tổng giá trị: ${formatCurrency(reportData.summary.totalRefundAmount)}`}
            </Text>
          </div>
          <Table
            dataSource={reportData.refundsByEmployee}
            rowKey={(record) => record.refundedBy}
            pagination={{
              ...paginationConfig,
              current: paginationRefund.current,
              pageSize: paginationRefund.pageSize,
              onChange: (page, pageSize) => setPaginationRefund({ current: page, pageSize }),
            }}
            scroll={{ x: 600 }}
            columns={[
              {
                title: "Nhân Viên Xử Lý",
                dataIndex: "name",
                key: "name",
                render: (text) => <Text strong> {text}</Text>,
              },
              {
                title: "Số Tiền Hoàn",
                dataIndex: "refundAmount",
                key: "refundAmount",
                align: "center",
                render: (value) => (
                  <Text strong style={{ color: "#ff4d4f" }}>
                    {formatCurrency(value)}
                  </Text>
                ),
              },
              {
                title: "Thời Gian",
                dataIndex: "refundedAt",
                key: "refundedAt",
                align: "center",
                render: (value) => new Date(value).toLocaleString("vi-VN"),
              },
            ]}
          />
        </Card>
      )}

      {/* SNAPSHOT TỒN KHO */}
      <Card
        title={
          <span>
            <InboxOutlined style={{ marginRight: 8 }} />
            Tồn Kho Cuối Ngày
          </span>
        }
        style={{ marginTop: 16, borderRadius: 12 }}
      >
        <Table
          dataSource={reportData.stockSnapshot}
          rowKey="productId"
          pagination={{
            ...paginationConfig,
            current: paginationStock.current,
            pageSize: paginationStock.pageSize,
            onChange: (page, pageSize) => setPaginationStock({ current: page, pageSize }),
          }}
          scroll={{ x: 600 }}
          columns={[
            {
              title: "Tên Sản Phẩm",
              dataIndex: "name",
              key: "name",
              ellipsis: true,
              render: (text) => <Text strong>{text}</Text>,
            },
            {
              title: "Mã SKU",
              dataIndex: "sku",
              key: "sku",
              width: 400,
              render: (text) => <Text code>{text}</Text>,
            },
            {
              title: "Tồn Kho",
              dataIndex: "stock",
              key: "stock",
              align: "center",
              width: 150,
              sorter: (a, b) => a.stock - b.stock,
              render: (value) => <Tag color={value < 10 ? "red" : value < 50 ? "orange" : "green"}>{value}</Tag>,
            },
            {
              title: "Trạng Thái",
              key: "status",
              align: "center",
              width: 190,
              render: (_, record) => {
                if (record.stock < 10) {
                  return (
                    <Tag icon={<WarningOutlined />} color="error">
                      Thấp
                    </Tag>
                  );
                } else if (record.stock < 50) {
                  return (
                    <Tag icon={<WarningOutlined />} color="warning">
                      Cần Nhập
                    </Tag>
                  );
                } else {
                  return (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                      Đủ
                    </Tag>
                  );
                }
              },
            },
          ]}
        />
      </Card>
      </Space>
    </div>
  );
};

export default EndOfDayReport;
