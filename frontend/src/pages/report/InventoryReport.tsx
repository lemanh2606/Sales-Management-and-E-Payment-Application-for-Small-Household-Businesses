// src/pages/reports/InventoryReport.tsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Button,
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
  DatePicker,
  Tabs,
  Select,
  InputNumber,
} from "antd";
import {
  FileExcelOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
  ShopOutlined,
  InboxOutlined,
  DollarOutlined,
  AlertOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import axios from "axios";
import * as XLSX from "xlsx";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const apiUrl = import.meta.env.VITE_API_URL;
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ===== INTERFACES =====
interface MongoDecimal {
  $numberDecimal: string;
}

interface SummaryInfo {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  totalCostPrice: number;
}

interface ProductDetail {
  index: number;
  productId: string;
  productName: string;
  sku: string;
  closingStock: number;
  costPrice: MongoDecimal;
  closingValue: number;
  lowStock: boolean;
  minStock: number;
}

interface ReportData {
  summary: SummaryInfo;
  details: ProductDetail[];
}

interface ReportResponse {
  success: boolean;
  message: string;
  data: ReportData;
}

// Biến thiên tồn kho
interface VarianceDetail {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  minStock: number;
  costPrice: number;
  beginningStock: number;
  importQty: number;
  exportQty: number;
  endingStock: number;
  periodCOGS: number;
  beginningValue: number;
  endingValue: number;
}

interface VarianceSummary {
  totalProducts: number;
  totalBeginningStock: number;
  totalImportQty: number;
  totalExportQty: number;
  totalEndingStock: number;
  totalCOGS: number;
}

interface VarianceData {
  reportPeriod: {
    from: string;
    to: string;
  };
  summary: VarianceSummary;
  details: VarianceDetail[];
}

interface VarianceResponse {
  success: boolean;
  message: string;
  data: VarianceData;
}

// ===== COMPONENT =====
const InventoryReport: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [varianceData, setVarianceData] = useState<VarianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  
  // Period selector states
  const [periodType, setPeriodType] = useState<string | null>(null);
  const [periodKey, setPeriodKey] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [activeTab, setActiveTab] = useState("realtime");

  // Helper: Format currency
  const formatCurrency = (value: number | MongoDecimal): string => {
    const numValue = typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Fetch realtime inventory - gọi ngay khi vào trang
  const fetchRealtimeReport = async () => {
    if (!storeId) {
      Swal.fire("Lỗi", "Không tìm thấy cửa hàng", "error");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<ReportResponse>(`${apiUrl}/inventory-reports`, {
        params: { storeId },
        headers,
      });

      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err: any) {
      Swal.fire("Lỗi", err?.response?.data?.message || "Không thể tải báo cáo tồn kho", "error");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch variance report
  const fetchVarianceReport = async (periodType?: string, periodKey?: string, monthFrom?: string, monthTo?: string) => {
    if (!storeId) {
      Swal.fire("Lỗi", "Không tìm thấy cửa hàng", "error");
      return;
    }

    setLoading(true);
    try {
      const params: any = { storeId };
      if (periodType) params.periodType = periodType;
      if (periodKey) params.periodKey = periodKey;
      if (monthFrom) params.monthFrom = monthFrom;
      if (monthTo) params.monthTo = monthTo;

      const res = await axios.get<VarianceResponse>(`${apiUrl}/inventory-reports/variance`, {
        params,
        headers,
      });

      if (res.data.success) {
        setVarianceData(res.data.data);
      }
    } catch (err: any) {
      Swal.fire("Lỗi", err?.response?.data?.message || "Không thể tải báo cáo biến thiên", "error");
      setVarianceData(null);
    } finally {
      setLoading(false);
    }
  };

  // Gọi ngay khi component mount
  useEffect(() => {
    fetchRealtimeReport();
  }, [storeId]);

  // Export Excel - Realtime
  const exportRealtimeExcel = () => {
    if (!reportData) return;

    const ws_data: any[][] = [
      [`BÁO CÁO TỒN KHO HIỆN TẠI - ${currentStore.name}`],
      [`Thời điểm: ${new Date().toLocaleString("vi-VN")}`],
      [],
      ["STT", "Tên sản phẩm", "Mã SKU", "Tồn kho", "Giá vốn", "Giá trị tồn", "Cảnh báo"],
    ];

    reportData.details.forEach((item) => {
      ws_data.push([
        item.index,
        item.productName,
        item.sku,
        item.closingStock,
        parseFloat(item.costPrice.$numberDecimal),
        item.closingValue,
        item.lowStock ? "Tồn thấp" : "",
      ]);
    });

    ws_data.push([]);
    ws_data.push(["TỔNG CỘNG", "", "", reportData.summary.totalStock, "", reportData.summary.totalValue, ""]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tồn kho hiện tại");
    XLSX.writeFile(wb, `TonKho_HienTai_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export Excel - Variance Report
  const exportVarianceExcel = () => {
    if (!varianceData) return;

    const { from, to } = varianceData.reportPeriod;
    const ws_data: any[][] = [
      [`BÁO CÁO BIẾN THIÊN TỒN KHO - ${currentStore.name}`],
      [`Từ ngày: ${from} đến ${to}`],
      [],
      [
        "STT",
        "Sản phẩm",
        "Mã SKU",
        "Đơn vị",
        "Tồn đầu kỳ",
        "Nhập trong kỳ",
        "Xuất trong kỳ",
        "Tồn cuối kỳ",
        "Giá vốn",
        "COGS",
        "Giá trị tồn đầu",
        "Giá trị tồn cuối",
      ],
    ];

    varianceData.details.forEach((item, idx) => {
      ws_data.push([
        idx + 1,
        item.productName,
        item.sku,
        item.unit,
        item.beginningStock,
        item.importQty,
        item.exportQty,
        item.endingStock,
        item.costPrice,
        item.periodCOGS,
        item.beginningValue,
        item.endingValue,
      ]);
    });

    ws_data.push([]);
    ws_data.push([
      "TỔNG CỘNG",
      "",
      "",
      "",
      varianceData.summary.totalBeginningStock,
      varianceData.summary.totalImportQty,
      varianceData.summary.totalExportQty,
      varianceData.summary.totalEndingStock,
      "",
      varianceData.summary.totalCOGS,
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Biến thiên tồn kho");
    XLSX.writeFile(wb, `TonKho_BiemThien_${from}_${to}.xlsx`);
  };

  // Export Excel
  const exportExcel = () => {
    if (activeTab === "realtime") {
      exportRealtimeExcel();
    } else {
      exportVarianceExcel();
    }
  };

  // Columns cho Variance Report
  const varianceColumns: ColumnsType<VarianceDetail> = [
    {
      title: "STT",
      key: "index",
      width: 50,
      align: "center",
      fixed: "left",
      render: (_, __, idx) => idx + 1,
    },
    {
      title: "Sản phẩm",
      dataIndex: "productName",
      key: "productName",
      width: 170,
      fixed: "left",
    },
    {
      title: "Mã SKU",
      dataIndex: "sku",
      key: "sku",
      width: 110,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      key: "unit",
      width: 60,
      align: "center",
    },
    {
      title: "Tồn đầu kỳ",
      dataIndex: "beginningStock",
      key: "beginningStock",
      width: 100,
      align: "center",
      sorter: (a, b) => a.beginningStock - b.beginningStock,
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: "Nhập trong kỳ",
      dataIndex: "importQty",
      key: "importQty",
      width: 100,
      align: "center",
      sorter: (a, b) => a.importQty - b.importQty,
      render: (val: number) => (
        <Text strong style={{ color: "#52c41a" }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Xuất trong kỳ",
      dataIndex: "exportQty",
      key: "exportQty",
      width: 100,
      align: "center",
      sorter: (a, b) => a.exportQty - b.exportQty,
      render: (val: number) => (
        <Text strong style={{ color: "#ff4d4f" }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Tồn cuối kỳ",
      dataIndex: "endingStock",
      key: "endingStock",
      width: 100,
      align: "center",
      sorter: (a, b) => a.endingStock - b.endingStock,
      render: (val: number) => (
        <Text strong style={{ color: "#1890ff" }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Giá vốn",
      dataIndex: "costPrice",
      key: "costPrice",
      width: 100,
      align: "right",
      render: (val: number) => formatCurrency(val),
    },
    {
      title: "Tổng chi phí (COGS)",
      dataIndex: "periodCOGS",
      key: "periodCOGS",
      width: 130,
      align: "right",
      render: (val: number) => (
        <Text strong style={{ color: "#faad14" }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
  ];

  // Filter data
  const filteredData =
    reportData?.details.filter(
      (item) => item.productName.toLowerCase().includes(searchText.toLowerCase()) || item.sku.toLowerCase().includes(searchText.toLowerCase())
    ) || [];

  const filteredVarianceData =
    varianceData?.details.filter(
      (item) => item.productName.toLowerCase().includes(searchText.toLowerCase()) || item.sku.toLowerCase().includes(searchText.toLowerCase())
    ) || [];

  const lowStockCount = reportData?.details.filter((item) => item.lowStock).length || 0;

  // Table columns - chỉ còn lại những cột cần thiết cho realtime
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
      width: 220,
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
      width: 120,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Tồn kho",
      dataIndex: "closingStock",
      key: "closingStock",
      width: 100,
      align: "center",
      sorter: (a, b) => a.closingStock - b.closingStock,
      render: (val: number, record: ProductDetail) => (
        <Text strong style={{ color: record.lowStock ? "#ff4d4f" : "#389e0d", fontSize: 15 }}>
          {val}
        </Text>
      ),
    },
    {
      title: "Tồn tối thiểu",
      dataIndex: "minStock",
      key: "minStock",
      width: 120,
      align: "center",
      render: (val: number) => (
        <Text strong style={{ color: "#faad14" }}>
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
      render: (val: MongoDecimal) => (
        <Text strong style={{ color: "#1890ff" }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
    {
      title: (
        <Tooltip title="Tồn kho × Giá vốn">
          <span
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <InfoCircleOutlined style={{ color: "#1890ff", marginRight: 4 }} />
            Giá trị tồn
          </span>
        </Tooltip>
      ),
      dataIndex: "closingValue",
      key: "closingValue",
      width: 140,
      align: "right",
      render: (val: number) => (
        <Text strong style={{ color: "#faad14", fontSize: 15 }}>
          {formatCurrency(val)}
        </Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "lowStock",
      key: "lowStock",
      width: 100,
      align: "center",
      render: (val: boolean) =>
        val ? (
          <Tag icon={<WarningOutlined />} color="red">
            Tồn thấp
          </Tag>
        ) : (
          <Tag color="green">Bình thường</Tag>
        ),
    },
  ];

  return (
    <Layout>
      <div>
        {/* HEADER CARD */}
        <Card bodyStyle={{ padding: "20px 24px 24px 24px" }} style={{ borderRadius: 12, border: "1px solid #8c8c8c", marginBottom: 24 }}>
          {/* HEADER + NÚT + ALERT – TẤT CẢ TRONG MỘT DÒNG ĐẸP ĐẼ */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            {/* Bên trái: Tên shop + tiêu đề */}
            <div>
              <Title level={2} style={{ margin: 0, color: "#1890ff", lineHeight: 1.2 }}>
                {currentStore.name || "Đang tải..."}
              </Title>
              <Text style={{ color: "#595959", fontSize: "16px", display: "block", marginTop: 5 }}>
                {activeTab === "realtime" ? "Báo cáo tồn kho hiện tại" : "Báo cáo biến thiên tồn kho"}
              </Text>
            </div>

            {/* Bên phải: 2 nút làm mới + xuất Excel */}
            <Space size="middle">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (activeTab === "realtime") {
                    fetchRealtimeReport();
                  } else if (periodType) {
                    if (periodType === "custom" && dateRange && dateRange[0] && dateRange[1]) {
                      const monthFrom = dateRange[0].format("YYYY-MM");
                      const monthTo = dateRange[1].format("YYYY-MM");
                      fetchVarianceReport("custom", undefined, monthFrom, monthTo);
                    } else if (periodType !== "custom" && periodKey) {
                      fetchVarianceReport(periodType, periodKey);
                    }
                  }
                }}
                size="large"
                type="default"
              >
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={exportExcel}
                size="large"
                style={{ background: "#52c41a", borderColor: "#52c41a" }}
              >
                Xuất Excel
              </Button>
            </Space>
          </div>

          {/* Đường viền dưới */}
          <div style={{ borderBottom: "2px solid #e8e8e8", margin: "16px 0" }} />

          {/* Alert */}
          {activeTab === "realtime" ? (
            <Alert
              message="Dữ liệu được cập nhật theo thời gian thực theo từng giao dịch nhập/xuất hàng"
              type="info"
              showIcon
              style={{ borderRadius: 8, marginBottom: 0 }}
            />
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <Text strong>Chọn loại kỳ báo cáo:</Text>
              <Select
                style={{ width: 180 }}
                placeholder="Chọn loại kỳ..."
                value={periodType}
                onChange={(val) => {
                  setPeriodType(val);
                  setPeriodKey(null);
                  setDateRange(null);
                }}
                allowClear
                options={[
                  { label: "Tháng", value: "month" },
                  { label: "Quý", value: "quarter" },
                  { label: "Năm", value: "year" },
                  { label: "Tùy chỉnh (Khoảng ngày)", value: "custom" },
                ]}
              />

              {/* Conditional input based on periodType */}
              {periodType === "month" && (
                <>
                  <Text strong>Chọn tháng:</Text>
                  <DatePicker
                    picker="month"
                    value={periodKey ? dayjs(periodKey, "YYYY-MM") : null}
                    onChange={(date) => {
                      if (date) {
                        const monthKey = date.format("YYYY-MM");
                        setPeriodKey(monthKey);
                        fetchVarianceReport("month", monthKey);
                      }
                    }}
                    allowClear
                    placeholder="Chọn tháng"
                    format="MM/YYYY"
                  />
                </>
              )}

              {periodType === "quarter" && (
                <>
                  <Text strong>Chọn quý:</Text>
                  <Select
                    style={{ width: 180 }}
                    placeholder="Chọn quý..."
                    value={periodKey}
                    onChange={(val) => {
                      setPeriodKey(val);
                      if (val) {
                        fetchVarianceReport("quarter", val);
                      }
                    }}
                    allowClear
                    options={[
                      { label: "Quý I (01-03)", value: "Q1" },
                      { label: "Quý II (04-06)", value: "Q2" },
                      { label: "Quý III (07-09)", value: "Q3" },
                      { label: "Quý IV (10-12)", value: "Q4" },
                    ]}
                  />
                </>
              )}

              {periodType === "year" && (
                <>
                  <Text strong>Chọn năm:</Text>
                  <InputNumber
                    style={{ width: 120 }}
                    placeholder="Năm"
                    min={2000}
                    max={2100}
                    value={periodKey ? parseInt(periodKey, 10) : null}
                    onChange={(val) => {
                      if (val) {
                        const yearKey = val.toString();
                        setPeriodKey(yearKey);
                        fetchVarianceReport("year", yearKey);
                      }
                    }}
                  />
                </>
              )}

              {periodType === "custom" && (
                <>
                  <Text strong>Chọn khoảng ngày:</Text>
                  <RangePicker
                    value={dateRange}
                    onChange={(dates) => {
                      setDateRange(dates as [Dayjs, Dayjs] | null);
                      if (dates && dates[0] && dates[1]) {
                        const monthFrom = dates[0].format("YYYY-MM");
                        const monthTo = dates[1].format("YYYY-MM");
                        fetchVarianceReport("custom", undefined, monthFrom, monthTo);
                      }
                    }}
                    format="DD/MM/YYYY"
                  />
                </>
              )}
            </div>
          )}
        </Card>

        {/* TABS */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 24 }}
          items={[
            {
              key: "realtime",
              label: "📊 Tồn kho hiện tại",
              children: (
                <>
                  {loading ? (
                    <Card style={{ textAlign: "center", padding: 80 }}>
                      <Spin size="large" tip="Đang tải tồn kho..." />
                    </Card>
                  ) : !reportData || reportData.details.length === 0 ? (
                    <Empty description="Chưa có sản phẩm nào" />
                  ) : (
                    <>
                      {/* SUMMARY CARDS */}
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tổng sản phẩm"
                              value={reportData.summary.totalProducts}
                              suffix="mặt hàng"
                              prefix={<ShopOutlined />}
                              valueStyle={{ color: "#1890ff" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tổng tồn kho"
                              value={reportData.summary.totalStock}
                              suffix="sản phẩm"
                              prefix={<InboxOutlined />}
                              valueStyle={{ color: "#52c41a" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tổng giá trị tồn"
                              value={reportData.summary.totalValue}
                              prefix={<DollarOutlined />}
                              formatter={(v) => formatCurrency(v as number)}
                              valueStyle={{ color: "#faad14" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tồn kho thấp"
                              value={lowStockCount}
                              prefix={<AlertOutlined />}
                              suffix={`/ ${reportData.summary.totalProducts}`}
                              valueStyle={{ color: lowStockCount > 0 ? "#ff4d4f" : "#52c41a" }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      {/* LOW STOCK ALERT */}
                      {lowStockCount > 0 && (
                        <Alert
                          message={`Cảnh báo: Có ${lowStockCount} sản phẩm đang tồn kho thấp!`}
                          description="Vui lòng kiểm tra và nhập hàng gấp để tránh hết hàng."
                          type="warning"
                          showIcon
                          icon={<WarningOutlined />}
                          closable
                          style={{ marginBottom: 24 }}
                        />
                      )}

                      {/* TABLE */}
                      <Card
                        title={
                          <Title level={4} style={{ margin: 0 }}>
                            Chi tiết tồn kho
                          </Title>
                        }
                        extra={
                          <Input
                            placeholder="Tìm sản phẩm hoặc mã SKU..."
                            prefix={<SearchOutlined />}
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 500 }}
                          />
                        }
                        style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}
                      >
                        <Table
                          columns={columns}
                          dataSource={filteredData}
                          rowKey="productId"
                          pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => (
                              <div style={{ fontSize: 14, color: "#595959" }}>
                                Đang xem{" "}
                                <span style={{ color: "#1890ff", fontWeight: 600, fontSize: 15 }}>
                                  {range[0]} – {range[1]}
                                </span>{" "}
                                trên tổng số <span style={{ color: "#d4380d", fontWeight: 600, fontSize: 15 }}>{total.toLocaleString("vi-VN")}</span> sản phẩm
                              </div>
                            ),
                          }}
                          scroll={{ x: 1000 }}
                          summary={() => (
                            <Table.Summary fixed>
                              <Table.Summary.Row style={{ background: "#fafafa", fontWeight: "bold" }}>
                                <Table.Summary.Cell index={0} colSpan={3} align="center">
                                  TỔNG CỘNG
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="center">
                                  <Text strong style={{ color: "#52c41a" }}>
                                    {reportData.summary.totalStock}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={4} />
                                <Table.Summary.Cell index={5} align="right">
                                  <Text strong style={{ color: "#1890ff" }}>
                                    {formatCurrency(reportData.summary.totalCostPrice)}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="right">
                                  <Text strong style={{ color: "#faad14" }}>
                                    {formatCurrency(reportData.summary.totalValue)}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={7} />
                              </Table.Summary.Row>
                            </Table.Summary>
                          )}
                        />
                      </Card>
                    </>
                  )}
                </>
              ),
            },
            {
              key: "variance",
              label: "📈 Biến thiên tồn kho",
              children: (
                <>
                  {loading ? (
                    <Card style={{ textAlign: "center", padding: 80 }}>
                      <Spin size="large" tip="Đang tải báo cáo biến thiên..." />
                    </Card>
                  ) : !varianceData || varianceData.details.length === 0 ? (
                    <Empty description="Chưa có dữ liệu cho kỳ này" />
                  ) : (
                    <>
                      {/* VARIANCE SUMMARY */}
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tồn đầu kỳ"
                              value={varianceData.summary.totalBeginningStock}
                              suffix="sản phẩm"
                              valueStyle={{ color: "#1890ff" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Nhập trong kỳ"
                              value={varianceData.summary.totalImportQty}
                              suffix="sản phẩm"
                              valueStyle={{ color: "#52c41a" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Xuất trong kỳ"
                              value={varianceData.summary.totalExportQty}
                              suffix="sản phẩm"
                              valueStyle={{ color: "#ff4d4f" }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
                            <Statistic
                              title="Tồn cuối kỳ"
                              value={varianceData.summary.totalEndingStock}
                              suffix="sản phẩm"
                              valueStyle={{ color: "#faad14" }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} sm={12}>
                          <Card bordered={false} style={{ borderRadius: 12, border: "1px solid #8c8c8c", background: "#fafafa" }}>
                            <Statistic
                              title="Tổng COGS (Chi phí bán hàng)"
                              value={varianceData.summary.totalCOGS}
                              prefix={<DollarOutlined />}
                              formatter={(v) => formatCurrency(v as number)}
                              valueStyle={{ color: "#ff7a45", fontSize: 20 }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      {/* VARIANCE TABLE */}
                      <Card
                        title={
                          <Title level={4} style={{ margin: 0 }}>
                            Chi tiết biến thiên
                          </Title>
                        }
                        extra={
                          <Input
                            placeholder="Tìm sản phẩm hoặc mã SKU..."
                            prefix={<SearchOutlined />}
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ width: 500 }}
                          />
                        }
                        style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}
                      >
                        <Table
                          columns={varianceColumns}
                          dataSource={filteredVarianceData}
                          rowKey="productId"
                          pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total, range) => (
                              <div style={{ fontSize: 14, color: "#595959" }}>
                                Đang xem{" "}
                                <span style={{ color: "#1890ff", fontWeight: 600, fontSize: 15 }}>
                                  {range[0]} – {range[1]}
                                </span>{" "}
                                trên tổng số <span style={{ color: "#d4380d", fontWeight: 600, fontSize: 15 }}>{total.toLocaleString("vi-VN")}</span> sản phẩm
                              </div>
                            ),
                          }}
                          scroll={{ x: "max-content" }}
                          summary={() => (
                            <Table.Summary fixed>
                              <Table.Summary.Row style={{ background: "#fafafa", fontWeight: "bold" }}>
                                <Table.Summary.Cell index={0} colSpan={4} align="center">
                                  TỔNG CỘNG
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="center">
                                  <Text strong style={{ color: "#1890ff" }}>
                                    {varianceData.summary.totalBeginningStock}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="center">
                                  <Text strong style={{ color: "#52c41a" }}>
                                    {varianceData.summary.totalImportQty}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="center">
                                  <Text strong style={{ color: "#ff4d4f" }}>
                                    {varianceData.summary.totalExportQty}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={7} align="center">
                                  <Text strong style={{ color: "#faad14" }}>
                                    {varianceData.summary.totalEndingStock}
                                  </Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={8} />
                                <Table.Summary.Cell index={9} align="right">
                                  <Text strong style={{ color: "#ff7a45" }}>
                                    {formatCurrency(varianceData.summary.totalCOGS)}
                                  </Text>
                                </Table.Summary.Cell>
                              </Table.Summary.Row>
                            </Table.Summary>
                          )}
                        />
                      </Card>
                    </>
                  )}
                </>
              ),
            },
          ]}
        />
      </div>
    </Layout>
  );
};

export default InventoryReport;
