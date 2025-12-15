// src/pages/reports/InventoryReport.tsx
import React, { useState, useEffect } from "react";
import { Card, Row, Col, Button, Table, Tag, Space, Statistic, Input, Empty, Spin, Typography, Tooltip, Alert } from "antd";
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
import axios from "axios";
import * as XLSX from "xlsx";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const apiUrl = import.meta.env.VITE_API_URL;
const { Title, Text } = Typography;

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

// ===== COMPONENT =====
const InventoryReport: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

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

  // Gọi ngay khi component mount
  useEffect(() => {
    fetchRealtimeReport();
  }, [storeId]);

  // Export Excel
  const exportExcel = () => {
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

  // Filter data
  const filteredData =
    reportData?.details.filter(
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
              <Text style={{ color: "#595959", fontSize: "16px", display: "block", marginTop: 5 }}>Báo cáo tồn kho hiện tại</Text>
            </div>

            {/* Bên phải: 2 nút làm mới + xuất Excel */}
            <Space size="middle">
              <Button icon={<ReloadOutlined />} onClick={fetchRealtimeReport} size="large" type="default">
                Làm mới dữ liệu
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

          {/* Đường viền dưới – đẹp như ListAllOrder */}
          <div style={{ borderBottom: "2px solid #e8e8e8", margin: "16px 0" }} />

          {/* Alert realtime */}
          <Alert
            message="Dữ liệu được cập nhật theo thời gian thực theo từng giao dịch nhập/xuất hàng"
            type="info"
            showIcon
            style={{ borderRadius: 8, marginBottom: 0 }}
          />
        </Card>

        {loading ? (
          <Card style={{ textAlign: "center", padding: 80 }}>
            <Spin size="large" tip="Đang tải tồn kho hiện tại..." />
          </Card>
        ) : !reportData || reportData.details.length === 0 ? (
          <Empty description="Chưa có sản phẩm nào trong cửa hàng" />
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
                      <Table.Summary.Cell index={4} /> {/* trống cho minStock */}
                      {/* Tổng giá vốn */}
                      <Table.Summary.Cell index={5} align="right">
                        <Text strong style={{ color: "#1890ff" }}>
                          {formatCurrency(reportData.summary.totalCostPrice)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right">
                        {" "}
                        {/* giá trị tồn */}
                        <Text strong style={{ color: "#faad14" }}>
                          {formatCurrency(reportData.summary.totalValue)}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} /> {/* trống cho trạng thái */}
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
