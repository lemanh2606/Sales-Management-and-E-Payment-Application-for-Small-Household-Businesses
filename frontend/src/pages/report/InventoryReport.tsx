// src/pages/reports/InventoryReport.tsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  DatePicker,
  Table,
  Tag,
  Space,
  Statistic,
  Input,
  Empty,
  Spin,
  Typography,
  Tooltip,
  Alert,
} from "antd";
import {
  FileExcelOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
  CalendarOutlined,
  ShopOutlined,
  InboxOutlined,
  DollarOutlined,
  AlertOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import * as XLSX from "xlsx";
import "jspdf-autotable";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

dayjs.extend(quarterOfYear);
const apiUrl = import.meta.env.VITE_API_URL;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

// ===== INTERFACES =====
interface MongoDecimal {
  $numberDecimal: string;
}

interface PeriodInfo {
  periodType: string;
  periodKey: string;
  from: string;
  to: string;
}

interface SummaryInfo {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
}

interface ProductDetail {
  index: number;
  productId: string;
  productName: string;
  sku: string;
  openingStock: number;
  importedQty: number;
  exportedQty: number;
  returnedQty: number;
  closingStock: number;
  costPrice: MongoDecimal;
  closingValue: number;
  lowStock: boolean;
}

interface ReportData {
  period: PeriodInfo;
  summary: SummaryInfo;
  details: ProductDetail[];
}

interface ReportResponse {
  success: boolean;
  message: string;
  data: ReportData;
}

// ===== COMPONENT =====
const InventoryReport: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // States
  const [periodType, setPeriodType] = useState<string>("month");
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [selectedQuarter, setSelectedQuarter] = useState<Dayjs>(dayjs());
  const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs());
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Helper: Format currency
  const formatCurrency = (value: number | MongoDecimal): string => {
    const numValue =
      typeof value === "object" && value.$numberDecimal
        ? parseFloat(value.$numberDecimal)
        : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Fetch report data
  const fetchReport = async () => {
    if (!storeId) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Không tìm thấy thông tin cửa hàng",
        timer: 2000, // 2000ms = 2 giây
        timerProgressBar: true,
        confirmButtonText: "Ok",
        confirmButtonColor: "#3085d6",
      });
      return;
    }
    setLoading(true);
    try {
      const params: any = { storeId };

      // Build params based on periodType
      if (periodType === "month") {
        params.periodType = "month";
        params.periodKey = selectedMonth.format("YYYY-MM");
      } else if (periodType === "quarter") {
        params.periodType = "quarter";
        const q = selectedQuarter.quarter();
        params.periodKey = `${selectedQuarter.year()}-Q${q}`;
      } else if (periodType === "year") {
        params.periodType = "year";
        params.periodKey = selectedYear.format("YYYY");
      } else if (periodType === "custom") {
        if (!customRange[0] || !customRange[1]) {
          Swal.fire({
            icon: "warning",
            title: "Cảnh báo",
            text: "Vui lòng chọn khoảng thời gian tùy chỉnh!",
            timer: 2000, // 2000ms = 2 giây
            timerProgressBar: true,
            confirmButtonText: "Ok",
            confirmButtonColor: "#f39c12",
          });
          setLoading(false);
          return;
        }
        params.periodType = "custom";
        params.monthFrom = customRange[0].format("YYYY-MM");
        params.monthTo = customRange[1].format("YYYY-MM");
      }
      // If periodType = "realtime", no extra params needed

      const res = await axios.get<ReportResponse>(
        `${apiUrl}/inventory-reports`,
        { params, headers }
      );

      if (res.data.success) {
        setReportData(res.data.data);
        // Swal.fire({
        //   icon: "success",
        //   title: "Thành công",
        //   text: "Tải báo cáo thành công!",
        //   timer: 2000, // 2000ms = 2 giây
        //   timerProgressBar: true,
        //   confirmButtonText: "Ok",
        //   confirmButtonColor: "#27ae60",
        // });
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err?.response?.data?.message || "Lỗi tải báo cáo",
        timer: 2000, // 2000ms = 2 giây
        timerProgressBar: true,
        confirmButtonText: "Ok",
        confirmButtonColor: "#c0392b",
      });
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Export Excel
  const exportExcel = () => {
    if (!reportData) return;

    // Khai báo type rõ ràng: mỗi row là mảng any
    const ws_data: any[][] = [
      [`BÁO CÁO TỒN KHO - ${currentStore.name}`],
      [`Kỳ báo cáo: ${formatPeriodLabel()}`],
      [],
      [
        "STT",
        "Tên sản phẩm",
        "Mã SKU",
        "Tồn đầu kỳ",
        "Nhập trong kỳ",
        "Xuất trong kỳ",
        "Trả NCC",
        "Tồn cuối kỳ",
        "Giá vốn",
        "Giá trị tồn",
        "Cảnh báo",
      ],
    ];

    reportData.details.forEach((item) => {
      ws_data.push([
        item.index,
        item.productName,
        item.sku,
        item.openingStock,
        item.importedQty,
        item.exportedQty,
        item.returnedQty,
        item.closingStock,
        parseFloat(item.costPrice.$numberDecimal),
        item.closingValue,
        item.lowStock ? "Tồn thấp" : "",
      ]);
    });

    ws_data.push([]);
    ws_data.push([
      "TỔNG CỘNG",
      "",
      "",
      "",
      "",
      "",
      "",
      reportData.summary.totalStock,
      "",
      reportData.summary.totalValue,
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo tồn kho");
    XLSX.writeFile(wb, `BaoCaoTonKho_${dayjs().format("YYYYMMDD")}.xlsx`);
  };

  // Format period label
  const formatPeriodLabel = (): string => {
    if (!reportData || !reportData.period) return "Realtime"; // <--- check null
    const { periodType, periodKey } = reportData.period;

    if (periodType === "month") return `Tháng ${periodKey}`;
    if (periodType === "quarter") return `Quý ${periodKey}`;
    if (periodType === "year") return `Năm ${periodKey}`;
    if (periodType === "custom") {
      return `${dayjs(reportData.period.from).format("MM/YYYY")} - ${dayjs(
        reportData.period.to
      ).format("MM/YYYY")}`;
    }
    return "Realtime";
  };

  // Filter data by search
  const filteredData = reportData?.details.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchText.toLowerCase())
  );

  // Table columns
  const columns: ColumnsType<ProductDetail> = [
    {
      title: "STT",
      dataIndex: "index",
      key: "index",
      width: 50,
      align: "center",
      fixed: "left",
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "productName",
      key: "productName",
      width: 190,
      fixed: "left",
      render: (text: string, record: ProductDetail) => (
        <Space>
          {record.lowStock && (
            <Tooltip title="Tồn kho thấp">
              <WarningOutlined style={{ color: "#ff4d4f" }} />
            </Tooltip>
          )}
          <Text strong={record.lowStock}>{text}</Text>
        </Space>
      ),
    },
    {
      title: "Mã SKU",
      dataIndex: "sku",
      key: "sku",
      width: 110,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Tồn đầu kỳ",
      dataIndex: "openingStock",
      key: "openingStock",
      width: 90,
      align: "center",
      sorter: (a, b) => a.openingStock - b.openingStock,
    },
    {
      title: "Nhập trong kỳ",
      dataIndex: "importedQty",
      key: "importedQty",
      width: 90,
      align: "center",
      render: (val: number) =>
        val > 0 ? <Tag color="green">+{val}</Tag> : val,
    },
    {
      title: "Xuất trong kỳ",
      dataIndex: "exportedQty",
      key: "exportedQty",
      width: 90,
      align: "center",
      render: (val: number) => (val > 0 ? <Tag color="red">-{val}</Tag> : val),
    },
    {
      title: "Trả NCC",
      dataIndex: "returnedQty",
      key: "returnedQty",
      width: 80,
      align: "center",
      render: (val: number) => (val > 0 ? <Tag color="blue">+{val}</Tag> : val),
    },
    {
      title: "Tồn cuối kỳ",
      dataIndex: "closingStock",
      key: "closingStock",
      width: 90,
      align: "center",
      sorter: (a, b) => a.closingStock - b.closingStock,
      render: (val: number, record: ProductDetail) => (
        <Text strong style={{ color: record.lowStock ? "#ff4d4f" : "#389e0d" }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Giá vốn",
      dataIndex: "costPrice",
      key: "costPrice",
      width: 110,
      align: "right",
      sorter: (a, b) =>
        parseFloat(a.costPrice.$numberDecimal) -
        parseFloat(b.costPrice.$numberDecimal),
      render: (val: MongoDecimal) => formatCurrency(val),
    },
    {
      title: (
        <Tooltip title="Công thức tính: 'Tồn cuối kỳ' x 'Giá vốn'">
          <span>
            <InfoCircleOutlined
              style={{ color: "#1890ff", cursor: "pointer", marginLeft: 4 }}
            />{" "}
            Giá trị tồn
          </span>
        </Tooltip>
      ),
      dataIndex: "closingValue",
      key: "closingValue",
      width: 130,
      align: "right",
      render: (val: number) => (
        <Text strong style={{ color: "#1890ff" }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
    {
      title: "Cảnh báo",
      dataIndex: "lowStock",
      key: "lowStock",
      width: 100,
      align: "center",
      render: (val: boolean) =>
        val ? (
          <Tag color="red" icon={<WarningOutlined />}>
            Tồn thấp
          </Tag>
        ) : (
          <Tag color="green">OK</Tag>
        ),
    },
  ];

  // Low stock count
  const lowStockCount =
    reportData?.details.filter((item) => item.lowStock).length || 0;

  return (
    <Layout>
      <div
        style={{
          padding: "0px 10px",
          background: "#ffffff",
          minHeight: "100vh",
          maxWidth: "100%", // Giới hạn chiều rộng nội dung để tránh tràn browser
          overflowX: "hidden", // Ẩn scroll ngang browser
        }}
      >
        {/* FILTER CARD */}
        <Card
          title={
            <Space>
              <Title level={3} style={{ margin: 0 }}>
                Báo cáo tồn kho
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                - {currentStore.name}
              </Text>
            </Space>
          }
          bordered={false}
          style={{
            borderRadius: 12,
            border: "1px solid #8c8c8c",
            marginBottom: 24,
            maxWidth: "100%", // Giới hạn card filter
          }}
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={24} md={6}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                <CalendarOutlined /> Chọn kỳ báo cáo
              </Text>
              <Select
                value={periodType}
                onChange={setPeriodType}
                style={{ width: "100%" }}
                size="large"
              >
                <Option value="realtime">Realtime (tồn hiện tại)</Option>
                <Option value="month">Theo tháng</Option>
                <Option value="quarter">Theo quý</Option>
                <Option value="year">Theo năm</Option>
                <Option value="custom">Tùy chỉnh khoảng tháng</Option>
              </Select>
            </Col>

            <Col xs={24} sm={24} md={8}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                <CalendarOutlined /> Chọn thời gian
              </Text>
              {periodType === "month" && (
                <DatePicker
                  picker="month"
                  value={selectedMonth}
                  onChange={(date) => date && setSelectedMonth(date)}
                  format="MM/YYYY"
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="Chọn tháng"
                />
              )}
              {periodType === "quarter" && (
                <DatePicker
                  picker="quarter"
                  value={selectedQuarter}
                  onChange={(date) => date && setSelectedQuarter(date)}
                  format="[Q]Q YYYY"
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="Chọn quý"
                />
              )}
              {periodType === "year" && (
                <DatePicker
                  picker="year"
                  value={selectedYear}
                  onChange={(date) => date && setSelectedYear(date)}
                  format="YYYY"
                  style={{ width: "100%" }}
                  size="large"
                  placeholder="Chọn năm"
                />
              )}
              {periodType === "custom" && (
                <RangePicker
                  picker="month"
                  value={customRange}
                  onChange={(dates) =>
                    setCustomRange(dates as [Dayjs | null, Dayjs | null])
                  }
                  format="MM/YYYY"
                  style={{ width: "100%" }}
                  size="large"
                  placeholder={["Từ tháng", "Đến tháng"]}
                />
              )}
            </Col>

            <Col xs={24} sm={24} md={10}>
              <Space wrap style={{ marginTop: "21px" }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={fetchReport}
                  loading={loading}
                  icon={<SearchOutlined />}
                >
                  Xem báo cáo
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  size="large"
                  onClick={fetchReport}
                  disabled={!reportData}
                >
                  Làm mới
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  size="large"
                  onClick={exportExcel}
                  disabled={!reportData}
                  style={{ color: "#52c41a", borderColor: "#52c41a" }}
                >
                  Xuất Excel
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {loading ? (
          <Card style={{ textAlign: "center", padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: "#8c8c8c" }}>
              Đang tải dữ liệu...
            </div>
          </Card>
        ) : !reportData ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chọn kỳ báo cáo và nhấn 'Xem báo cáo' để hiển thị dữ liệu"
            style={{ marginTop: 60 }}
          />
        ) : (
          <>
            {/* SUMMARY CARDS - Giảm rộng bằng cách dùng Col responsive, Card width 100% */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6} lg={6}>
                <Card
                  bordered={false}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #8c8c8c",
                    width: "100%", // Giới hạn width theo Col
                  }}
                >
                  <Statistic
                    title="Tổng số sản phẩm"
                    value={reportData.summary.totalProducts}
                    prefix={<ShopOutlined />}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6} lg={6}>
                <Card
                  bordered={false}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #8c8c8c",
                    width: "100%",
                  }}
                >
                  <Statistic
                    title="Tổng tồn kho"
                    value={reportData.summary.totalStock}
                    prefix={<InboxOutlined />}
                    valueStyle={{ color: "#52c41a" }}
                    suffix="sản phẩm"
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6} lg={6}>
                <Card
                  bordered={false}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #8c8c8c",
                    width: "100%",
                  }}
                >
                  <Statistic
                    title="Tổng giá trị tồn"
                    value={reportData.summary.totalValue}
                    prefix={<DollarOutlined />}
                    valueStyle={{ color: "#faad14" }}
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6} lg={6}>
                <Card
                  bordered={false}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #8c8c8c",
                    width: "100%",
                  }}
                >
                  <Statistic
                    title="Sản phẩm tồn thấp"
                    value={lowStockCount}
                    prefix={<AlertOutlined />}
                    valueStyle={{
                      color: lowStockCount > 0 ? "#ff4d4f" : "#52c41a",
                    }}
                    suffix={`/ ${reportData.summary.totalProducts}`}
                  />
                </Card>
              </Col>
            </Row>

            {/* ALERT */}
            {lowStockCount > 0 && (
              <Alert
                message={`Cảnh báo: Có ${lowStockCount} sản phẩm tồn kho thấp!`}
                description="Vui lòng kiểm tra và nhập hàng kịp thời để tránh thiếu hụt."
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                closable
                style={{ marginBottom: 16 }}
              />
            )}

            {/* TABLE CARD - Thêm overflowX auto để scroll ngang trong card */}
            <Card
              title={
                <Space>
                  <Text strong style={{ fontSize: 16 }}>
                    Chi tiết báo cáo - {formatPeriodLabel()}
                  </Text>
                </Space>
              }
              extra={
                <Input
                  placeholder="Tìm tên sản phẩm hoặc mã SKU..."
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 350 }}
                />
              }
              style={{
                borderRadius: 12,
                border: "1px solid #8c8c8c",
                overflowX: "auto", // Scroll ngang trong card
                maxWidth: "100%", // Giới hạn rộng card theo màn hình
              }}
            >
              <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="productId"
                scroll={{ x: 1200, y: 500 }} // Giảm x một chút để fit hơn, nhưng vẫn scroll ngang nếu cần
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showTotal: (total, range) => (
                    <Text>
                      Đang xem{" "}
                      <span style={{ color: "#1890ff", fontWeight: 600 }}>
                        {range[0]} — {range[1]}
                      </span>{" "}
                      trên tổng số{" "}
                      <span style={{ color: "#d4380d", fontWeight: 600 }}>
                        {total}
                      </span>{" "}
                      sản phẩm
                    </Text>
                  ),
                }}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: "#fafafa" }}>
                      <Table.Summary.Cell index={0} colSpan={7} align="center">
                        <Text strong style={{ fontSize: 16 }}>
                          TỔNG CỘNG
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right">
                        <Text strong style={{ fontSize: 16, color: "#1890ff" }}>
                          {reportData.summary.totalStock}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={8} />
                      <Table.Summary.Cell index={9} align="right">
                        <Text strong style={{ fontSize: 16, color: "#faad14" }}>
                          {formatCurrency(reportData.summary.totalValue)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={10} />
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default InventoryReport;
