// src/pages/customer/TopCustomer.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  InputNumber,
  Button,
  Table,
  Space,
  Typography,
  Spin,
  Alert,
  Dropdown,
  Menu,
  Input,
} from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  UserOutlined,
  PhoneOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import Layout from "../../components/Layout";

const { Option } = Select;
const { Text, Title } = Typography;
const { Search } = Input;

const TopCustomer = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [range, setRange] = useState("thisMonth");
  const [limitOption, setLimitOption] = useState("");
  const [customLimit, setCustomLimit] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const rangeTextMap = {
    thisWeek: "tuần này",
    thisMonth: "tháng này",
    thisYear: "năm nay",
  };

  const formatVND = (value) => {
    if (!value) return "₫0";
    const num = typeof value === "object" ? value.$numberDecimal || value.toString() : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const fetchTopCustomers = async () => {
    if (!currentStore?._id) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }
    setHasFetched(true);
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      let limit = 10;
      if (["3", "5", "20"].includes(limitOption)) limit = parseInt(limitOption);
      else if (limitOption === "custom" && customLimit) limit = customLimit;

      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("range", range);
      if (limit) params.append("limit", limit);

      const url = `http://localhost:9999/api/orders/top-customers?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data.data || [];
      setCustomers(data);
      setFiltered(data);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải top khách hàng");
    } finally {
      setLoading(false);
    }
  };

  // Tìm kiếm
  useEffect(() => {
    const lower = searchText.toLowerCase();
    const filteredData = customers.filter(
      (c) => c.customerName.toLowerCase().includes(lower) || c.customerPhone.includes(searchText)
    );
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [searchText, customers]);

  // XUẤT FILE
  const handleExport = async (format) => {
    if (filtered.length === 0) {
      message.warning("Chưa có dữ liệu để xuất!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("range", range);
      params.append("format", format);

      const url = `http://localhost:9999/api/orders/top-customers/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `top-khach-hang-${range}-${dayjs().format("DD-MM-YYYY")}.${format}`;
      link.click();
      message.success(`Xuất ${format.toUpperCase()} thành công!`);
    } catch (err) {
      message.error("Lỗi xuất file!");
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
      title: "Khách hàng",
      key: "name",
      width: 220,
      render: (_, record) => (
        <Space>
          <UserOutlined style={{ color: "#1890ff" }} />
          <Text strong>{record.customerName}</Text>
        </Space>
      ),
    },
    {
      title: "Số điện thoại",
      dataIndex: "customerPhone",
      key: "phone",
      width: 100,
      render: (phone) => (
        <Space>
          <PhoneOutlined style={{ color: "#52c41a" }} />
          <Text code>{phone}</Text>
        </Space>
      ),
    },
    {
      title: "Tổng tiền đã chi",
      dataIndex: "totalAmount",
      key: "total",
      width: 160,
      align: "right",
      sorter: (a, b) => {
        const aVal = a.totalAmount.$numberDecimal || a.totalAmount;
        const bVal = b.totalAmount.$numberDecimal || b.totalAmount;
        return Number(bVal) - Number(aVal);
      },
      render: (v) => (
        <Text strong style={{ color: "#d4380d" }}>
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: "Số đơn đã mua",
      dataIndex: "orderCount",
      key: "orders",
      width: 100,
      align: "center",
      sorter: (a, b) => b.orderCount - a.orderCount,
      render: (v) => (
        <Space>
          <ShoppingCartOutlined style={{ color: "#fa8c16" }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: "Điểm tích lũy",
      dataIndex: "loyaltyPoints",
      key: "loyalty",
      width: 130,
      align: "center",
      sorter: (a, b) => (a.loyaltyPoints || 0) - (b.loyaltyPoints || 0),
      render: (v) => (
        <Text strong style={{ color: "#52c41a" }}>
          {v?.toLocaleString() || 0}
        </Text>
      ),
    },
    {
      title: "Lần mua gần nhất",
      dataIndex: "latestOrder",
      key: "latest",
      width: 130,
      align: "center",
      render: (date) => (
        <Space direction="vertical" size={0}>
          <CalendarOutlined style={{ color: "#722ed1" }} />
          <Text type="secondary" style={{ fontSize: 12, color: "black" }}>
            {dayjs(date).format("DD/MM/YYYY HH:mm")}
          </Text>
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* HEADER */}
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
                  {currentStore.name || "Đang tải..."}
                </Title>
                <Text style={{ color: "black", fontSize: "18px" }}>
                  <UserOutlined /> Top Khách Hàng Thân Thiết
                </Text>
              </Col>

              <Col span={5}>
                <Text strong>Kỳ thống kê:</Text>
                <Select style={{ width: "100%", marginTop: 8 }} value={range} onChange={setRange}>
                  <Option value="thisWeek">Tuần này</Option>
                  <Option value="thisMonth">Tháng này</Option>
                  <Option value="thisYear">Năm nay</Option>
                </Select>
              </Col>

              <Col span={4}>
                <Text strong>Số lượng:</Text>
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  value={limitOption}
                  onChange={(v) => {
                    setLimitOption(v);
                    if (v !== "custom") setCustomLimit(null);
                  }}
                >
                  <Option value="3">Top 3</Option>
                  <Option value="5">Top 5</Option>
                  <Option value="">Top 10</Option>
                  <Option value="20">Top 20</Option>
                  <Option value="custom">Tùy chỉnh</Option>
                </Select>
              </Col>

              {limitOption === "custom" && (
                <Col span={3}>
                  <Text strong>&nbsp;</Text>
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
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={fetchTopCustomers}
                  style={{ marginTop: 28, width: "100%" }}
                  size="middle"
                >
                  Xem kết quả
                </Button>
              </Col>

              <Col span={3}>
                <Dropdown overlay={exportMenu} disabled={filtered.length === 0}>
                  <Button icon={<DownloadOutlined />} style={{ marginTop: 28, width: "100%" }} type="default">
                    Xuất file
                  </Button>
                </Dropdown>
              </Col>
            </Row>

            {/* TÌM KIẾM */}
            <Row style={{ marginTop: 16 }}>
              <Col span={24}>
                <Search
                  placeholder="Tìm tên hoặc số điện thoại..."
                  allowClear
                  enterButton="Tìm"
                  size="large"
                  onSearch={setSearchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang tải top khách hàng..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon />}

          {/* BẢNG */}
          <Card
            style={{ border: "1px solid #8c8c8c" }}
            title={
              <Space>
                <DollarOutlined style={{ color: "#d4380d" }} />
                <Text strong>
                  Top {filtered.length} khách hàng thân thiết -{" "}
                  {range === "thisMonth" ? "Tháng này" : range.replace("this", "").replace("today", "Hôm nay")}
                </Text>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey={(r) => r.customerPhone}
              pagination={{
                current: currentPage,
                pageSize,
                total: filtered.length,
                showSizeChanger: true,
                onChange: (page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                },
                showTotal: (total, range) => (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#555" }}>
                    <div>
                      Đang xem{" "}
                      <span style={{ color: "#1890ff", fontWeight: 600 }}>
                        {range[0]} – {range[1]}
                      </span>{" "}
                      trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> khách hàng
                    </div>
                  </div>
                ),
              }}
              locale={{
                emptyText: (
                  <div style={{ color: "#f45a07f7" }}>
                    {hasFetched
                      ? `${
                          rangeTextMap[range]
                            ? rangeTextMap[range][0].toUpperCase() + rangeTextMap[range].slice(1)
                            : range
                        } chưa có dữ liệu nào!`
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

export default TopCustomer;
