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
} from "antd";
import {
  DollarOutlined,
  ShoppingOutlined,
  WalletOutlined,
  GiftOutlined,
  PercentageOutlined,
  UndoOutlined,
  FilePdfOutlined,
  BarChartOutlined,
  UserOutlined,
  ShopOutlined,
  InboxOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, PieLabelRenderProps } from "recharts";
import debounce from "../../utils/debounce";
import Swal from "sweetalert2";

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE = "http://localhost:9999/api";

// Interface định nghĩa kiểu dữ liệu
interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  vatTotal: number;
  totalRefunds: number;
  refundAmount: number;
  cashInDrawer: number;
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
const COLORS = ["#52c41a", "#1890ff", "#faad14", "#f5222d", "#722ed1", "#13c2c2"];

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
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [periodType, setPeriodType] = useState<string>("day");
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  //dùng setPagination riêng (đỡ giẫm nhau nếu người dùng lật trang nhiều bảng khác loại cùng lúc)
  const [paginationEmployee, setPaginationEmployee] = useState({ current: 1, pageSize: 10 });
  const [paginationProduct, setPaginationProduct] = useState({ current: 1, pageSize: 10 });
  const [paginationRefund, setPaginationRefund] = useState({ current: 1, pageSize: 10 });
  const [paginationStock, setPaginationStock] = useState({ current: 1, pageSize: 10 });

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
        switch (period) {
          case "day":
            periodKey = date.format("YYYY-MM-DD");
            break;
          case "month":
            periodKey = date.format("YYYY-MM");
            break;
          case "quarter":
            periodKey = `${date.year()}-Q${Math.floor(date.month() / 3 + 1)}`;
            break;
          case "year":
            periodKey = date.format("YYYY");
            break;
          default:
            periodKey = date.format("YYYY-MM-DD");
        }
        const res = await axios.get(`${API_BASE}/financials/end-of-day/${storeId}`, {
          params: { periodType: period, periodKey },
          headers,
        });
        setReportData(res.data.report);
        Swal.fire({
          title: "🎉 Thành công!",
          text: "Tải báo cáo thành công!",
          icon: "success",
          confirmButtonText: "OK",
          confirmButtonColor: "#52c41a",
        });
      } catch (err: any) {
        Swal.fire({
          title: "❌ Lỗi!",
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
    const numValue =
      typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Xuất PDF
  const handleExportPDF = () => {
    message.info("Tính năng xuất PDF đang được phát triển...");
  };

  // Render loading
  if (loading && !reportData) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
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
    <div style={{ padding: "24px", background: "#f0f2f5", minHeight: "100vh" }}>
      {/* HEADER */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <div className="flex flex-col sm:flex-row sm:items-center  mb-4 gap-3">
              <Title level={3} style={{ margin: 0 }}>
                <BarChartOutlined /> Báo Cáo Cuối Ngày
              </Title>
              <span className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm duration-200">
                {currentStore?.name}
              </span>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <Space size="middle" wrap style={{ justifyContent: "flex-end", width: "100%" }}>
              <Select value={periodType} onChange={handlePeriodChange} style={{ width: 150 }} size="large">
                <Option value="day">Hôm nay</Option>
                <Option value="month">Tháng này</Option>
                <Option value="quarter">Quý này</Option>
                <Option value="year">Năm này</Option>
              </Select>
              <DatePicker
                format="DD/MM/YYYY"
                size="large"
                placeholder="Chọn ngày"
                style={{ width: 180 }}
                onChange={handleDateChange}
              />
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                size="large"
                style={{ background: "#ff4d4f", borderColor: "#ff4d4f" }}
              >
                Xuất PDF
              </Button>
            </Space>
          </Col>
        </Row>
        <Divider style={{ margin: "16px 0" }} />
        <Text strong style={{ fontSize: 16 }}>
          {periodType === "day" && `Ngày báo cáo: ${selectedDate.format("DD/MM/YYYY")}`}
          {periodType === "month" && `Tháng báo cáo: ${selectedDate.format("MM/YYYY")}`}
          {periodType === "quarter" &&
            `Báo cáo quý ${Math.floor(selectedDate.month() / 3) + 1} - ${selectedDate.year()}`}
          {periodType === "year" && `Báo cáo năm ${selectedDate.year()}`}
        </Text>
      </Card>

      {/* SUMMARY CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>Tổng Đơn Hàng</span>}
              value={reportData.summary.totalOrders}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: "#fff", fontSize: 32, fontWeight: 700 }}
              suffix="đơn"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>Doanh Thu Trong Ngày</span>}
              value={reportData.summary.totalRevenue}
              prefix={<DollarOutlined />}
              valueStyle={{ color: "#fff", fontSize: 32, fontWeight: 700 }}
              formatter={(value) => formatCurrency(Number(value))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>VAT Tổng</span>}
              value={reportData.summary.vatTotal}
              prefix={<PercentageOutlined />}
              valueStyle={{ color: "#fff", fontSize: 32, fontWeight: 700 }}
              formatter={(value) => formatCurrency(Number(value))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>Tiền Mặt Trong Két</span>}
              value={reportData.summary.cashInDrawer}
              prefix={<WalletOutlined />}
              valueStyle={{ color: "#fff", fontSize: 32, fontWeight: 700 }}
              formatter={(value) => formatCurrency(Number(value))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>Điểm Thưởng Đã Cộng</span>}
              value={reportData.summary.totalLoyaltyEarned}
              prefix={<GiftOutlined />}
              valueStyle={{ color: "#fff", fontSize: 32, fontWeight: 700 }}
              suffix="điểm"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: "linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)",
              borderRadius: 12,
              border: "none",
            }}
          >
            <Statistic
              title={<span style={{ color: "#fff", opacity: 0.9 }}>Hoàn Hàng</span>}
              value={reportData.summary.refundAmount}
              prefix={<UndoOutlined />}
              valueStyle={{ color: "#fff", fontSize: 28, fontWeight: 700 }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Text style={{ color: "#fff", opacity: 0.85, fontSize: 12 }}>({reportData.summary.totalRefunds} đơn)</Text>
          </Card>
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
                Doanh Thu Theo Nhân Viên
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
                      typeof value === "object" && value.$numberDecimal
                        ? parseFloat(value.$numberDecimal)
                        : Number(value)
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
          <div style={{ background: "#fff1f0", padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>
              {`Trong ${PERIOD_LABELS[periodType] || "khoảng thời gian này"} có ${
                reportData.summary.totalRefunds
              } đơn hoàn, tổng giá trị: ${formatCurrency(reportData.summary.refundAmount)}`}
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
                render: (text) => <Text strong>{text}</Text>,
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
    </div>
  );
};

export default EndOfDayReport;
