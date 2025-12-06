// src/pages/report/TopProductsReport.jsx
import React, { useState, useEffect } from "react";
import { Card, Col, Row, Select, InputNumber, Button, Table, Space, Typography, Spin, Alert, Dropdown, Menu } from "antd";
import { SearchOutlined, FileExcelOutlined, FilePdfOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
import Layout from "../../components/Layout";

const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const apiUrl = import.meta.env.VITE_API_URL;
const TopProductsReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [range, setRange] = useState("thisMonth");
  const [limitOption, setLimitOption] = useState("");
  const [customLimit, setCustomLimit] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [hasFetched, setHasFetched] = useState(false);

  const rangeTextMap = {
    today: "hôm nay",
    yesterday: "hôm qua",
    thisWeek: "tuần này",
    thisMonth: "tháng này",
    thisYear: "năm nay",
  };

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  const formatVND = (value) => {
    if (!value) return "₫0";
    const num = typeof value === "object" ? value.$numberDecimal || value.toString() : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const fetchTopProducts = async () => {
    if (!currentStore?._id) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }
    setLoading(true);
    setHasFetched(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      let limit = 10;
      if (limitOption === "3") limit = 3;
      else if (limitOption === "5") limit = 5;
      else if (limitOption === "20") limit = 20;
      else if (limitOption === "custom" && customLimit) limit = customLimit;

      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("range", range);
      if (limit) params.append("limit", limit);

      const url = `${apiUrl}/orders/top-products?${params.toString()}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      setProducts(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải top sản phẩm");
    } finally {
      setLoading(false);
    }
  };

  // XUẤT FILE
  const handleExport = async (format) => {
    if (products.length === 0) {
      Swal.fire({
        title: "⚠️ Cảnh báo!",
        text: "Chưa có dữ liệu để xuất file",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#faad14",
        timer: 2000,
      });

      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("range", range);
      params.append("format", format);

      const url = `${apiUrl}/orders/top-products/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      const fileName = `top-san-pham-${range}-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.download = fileName;
      link.click();
      Swal.fire({
        title: "🎉 Thành công!",
        text: "Tải file thành công",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi xuất file",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  };

  const exportMenu = (
    <Menu>
      <Menu.Item key="csv" onClick={() => handleExport("csv")}>
        <FileExcelOutlined /> Xuất CSV
      </Menu.Item>
      <Menu.Item key="pdf" onClick={() => handleExport("pdf")}>
        <FilePdfOutlined /> Xuất PDF
      </Menu.Item>
    </Menu>
  );

  const columns = [
    {
      title: "STT",
      key: "index",
      width: 70,
      align: "center",
      render: (_, __, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "productName",
      key: "productName",
      width: 400,
      render: (text) => (
        <Text strong ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Mã SKU",
      dataIndex: "productSku",
      key: "productSku",
      width: 200,
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: "Số lượng bán",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      width: 110,
      align: "center",
      sorter: (a, b) => b.totalQuantity - a.totalQuantity,
      render: (v) => (
        <Text strong type="danger">
          {v}
        </Text>
      ),
    },
    {
      title: "Doanh thu",
      dataIndex: "totalSales",
      key: "totalSales",
      width: 160,
      align: "right",
      sorter: (a, b) => {
        const aVal = a.totalSales.$numberDecimal || a.totalSales;
        const bVal = b.totalSales.$numberDecimal || b.totalSales;
        return Number(bVal) - Number(aVal);
      },
      render: formatVND,
    },
    {
      title: "Số đơn",
      dataIndex: "countOrders",
      key: "countOrders",
      width: 100,
      align: "center",
    },
  ];

  return (
    <Layout>
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Title level={2} style={{ margin: 0, color: "#1890ff", lineHeight: 1.2 }}>
                  {currentStore.name || "Đang tải..."}
                </Title>
                <Text type="secondary" style={{ color: "#595959", fontSize: "16px", display: "block", marginTop: 4 }}>
                  Danh sách các sản phẩm bán chạy
                </Text>
              </Col>

              <Col span={5}>
                <Text>Kỳ thống kê:</Text>
                <Select style={{ width: "100%", marginTop: 8 }} value={range} onChange={setRange}>
                  <Option value="today">Hôm nay</Option>
                  <Option value="yesterday">Hôm qua</Option>
                  <Option value="thisWeek">Tuần này</Option>
                  <Option value="thisMonth">Tháng này</Option>
                  <Option value="thisYear">Năm nay</Option>
                </Select>
              </Col>

              <Col span={5}>
                <Text>Số lượng:</Text>
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  value={limitOption}
                  onChange={(val) => {
                    setLimitOption(val);
                    if (val !== "custom") setCustomLimit(null);
                  }}
                >
                  <Option value="3">Top 3</Option>
                  <Option value="5">Top 5</Option>
                  <Option value="">Top 10 (mặc định)</Option>
                  <Option value="20">Top 20</Option>
                  <Option value="custom">Tùy chỉnh...</Option>
                </Select>
              </Col>

              {limitOption === "custom" && (
                <Col span={3}>
                  <Text>&nbsp;</Text>
                  <InputNumber
                    min={1}
                    max={200}
                    value={customLimit}
                    onChange={setCustomLimit}
                    style={{ width: "100%", marginTop: 8 }}
                    placeholder="VD: 30"
                  />
                </Col>
              )}

              <Col span={3}>
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchTopProducts} style={{ marginTop: 32, width: "100%" }}>
                  Xem kết quả
                </Button>
              </Col>

              <Col span={2}>
                <Dropdown overlay={exportMenu} disabled={products.length === 0} trigger={["click"]}>
                  <Button icon={<DownloadOutlined />} style={{ marginTop: 32, width: "100%" }} type="default">
                    Xuất File
                  </Button>
                </Dropdown>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang tải top sản phẩm..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          <Card title={`Top sản phẩm bán chạy`} style={{ border: "1px solid #8c8c8c" }}>
            <Table
              columns={columns}
              dataSource={products}
              rowKey="_id"
              pagination={{
                current: currentPage,
                pageSize,
                total: products.length,
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
                      <span style={{ color: "#1890ff", fontWeight: 600 }}>
                        {range[0]} – {range[1]}
                      </span>{" "}
                      trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
                    </div>
                  </div>
                ),
              }}
              locale={{
                emptyText: (
                  <div style={{ color: "#f45a07f7" }}>
                    {hasFetched
                      ? `${rangeTextMap[range] ? rangeTextMap[range][0].toUpperCase() + rangeTextMap[range].slice(1) : range} chưa có dữ liệu nào!`
                      : "Chưa có dữ liệu. Hãy chọn kỳ thống kê và nhấn 'Xem kết quả' để tải!"}
                  </div>
                ),
              }}
            />
          </Card>
        </Space>
      </div>
    </Layout>
  );
};

export default TopProductsReport;
