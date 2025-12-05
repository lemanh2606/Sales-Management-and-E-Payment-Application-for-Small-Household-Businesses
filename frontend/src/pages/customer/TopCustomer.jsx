// src/pages/customer/TopCustomer.jsx
import React, { useState, useEffect } from "react";
import { Card, Col, Row, Select, InputNumber, Button, Table, Space, Typography, Spin, Alert, Input, Tooltip, DatePicker } from "antd";
import { SearchOutlined, FileExcelOutlined, UserOutlined, DollarOutlined, ShoppingCartOutlined, CalendarOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import Layout from "../../components/Layout";

const apiUrl = import.meta.env.VITE_API_URL;

const { Option } = Select;
const { Text, Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

const TopCustomer = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [limitOption, setLimitOption] = useState("");
  const [customLimit, setCustomLimit] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Thêm state mới
  const [periodType, setPeriodType] = useState("month");
  const [periodKey, setPeriodKey] = useState("");
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");
  // Reset thời gian khi đổi loại kỳ
  useEffect(() => {
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
  }, [periodType]);
  // 🟩 NEW: Reset dữ liệu bảng khi đổi loại kỳ
  useEffect(() => {
    setCustomers([]);
    setFiltered([]);
    setHasFetched(false);
  }, [periodType]);

  const formatVND = (value) => {
    if (value === null || value === undefined || value === "") return "₫0";
    let num;
    if (typeof value === "object" && value !== null) {
      num = value.$numberDecimal ? parseFloat(value.$numberDecimal) : parseFloat(value.toString());
    } else {
      num = parseFloat(value);
    }
    if (isNaN(num)) return "₫0";
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
      params.append("periodType", periodType);
      params.append("periodKey", periodKey);
      if (periodType === "custom") {
        params.append("monthFrom", monthFrom);
        params.append("monthTo", monthTo);
      }
      if (limit) params.append("limit", limit);

      const url = `${apiUrl}/orders/top-customers?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data.data || [];
      console.log("DATA RAW sau khi lấy từ API:", data); // <-- đây là đúng

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
    const filteredData = customers.filter((c) => c.customerName.toLowerCase().includes(lower) || c.customerPhone.includes(searchText));
    setFiltered(filteredData);
    setCurrentPage(1);
  }, [searchText, customers]);

  // XUẤT FILE
  const handleExport = async (format) => {
    if (filtered.length === 0) {
      Swal.fire({
        title: "⚠️ Cảnh báo!",
        text: "Chưa có dữ liệu để xuất!",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#faad14",
        timer: 2000,
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");

      // Xác định limit
      let limit = 10;
      if (["3", "5", "20"].includes(limitOption)) limit = parseInt(limitOption);
      else if (limitOption === "custom" && customLimit) limit = customLimit;

      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("periodType", periodType);
      params.append("periodKey", periodKey);
      if (periodType === "custom") {
        params.append("monthFrom", monthFrom);
        params.append("monthTo", monthTo);
      }
      if (limit) params.append("limit", limit);
      params.append("format", format); // "xlsx" | "csv" | "pdf"

      const url = `${apiUrl}/orders/top-customers/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob", // cực kỳ quan trọng
      });

      // Tạo blob và tải về
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      // Tạo tên kỳ đẹp cho file export
      const periodForFile = () => {
        switch (periodType) {
          case "day":
            return dayjs(periodKey, "YYYY-MM-DD").format("DD-MM-YYYY");
          case "month":
            return dayjs(periodKey, "YYYY-MM").format("MM-YYYY");
          case "quarter":
            const q = periodKey.split("-Q")[1];
            const y = periodKey.split("-Q")[0];
            return `Q${q}-${y}`;
          case "year":
            return periodKey;
          case "custom":
            if (monthFrom && monthTo) {
              const from = dayjs(monthFrom, "YYYY-MM").format("MM-YYYY");
              const to = dayjs(monthTo, "YYYY-MM").format("MM-YYYY");
              return `${from}_den_${to}`;
            }
            return "khoang-tuy-chinh";
          default:
            return "ky-hien-tai";
        }
      };
      link.download = `Top_Khach_Hang_${periodForFile()}_${dayjs().format("DD-MM-YYYY")}.${format}`;
      link.click();

      Swal.fire({
        title: "🎉 Thành công!",
        text: `Xuất ${format.toUpperCase()} thành công!`,
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: err.response?.data?.message || "Lỗi xuất file",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  };

  const getPeriodDisplayText = () => {
    if (!periodKey) return "Chưa chọn kỳ";

    switch (periodType) {
      case "day":
        return dayjs(periodKey, "YYYY-MM-DD").format("DD/MM/YYYY");

      case "month":
        return dayjs(periodKey, "YYYY-MM").format("MM/YYYY");

      case "quarter": {
        const year = periodKey.split("-Q")[0];
        const q = periodKey.split("-Q")[1];
        return `Quý ${q} - ${year}`;
      }

      case "year":
        return `Năm ${periodKey}`;

      case "custom":
        if (!monthFrom || !monthTo) return "Khoảng tùy chỉnh";
        const from = dayjs(monthFrom, "YYYY-MM").format("MM/YYYY");
        const to = dayjs(monthTo, "YYYY-MM").format("MM/YYYY");
        return `${from} → ${to}`;

      default:
        return "Kỳ đã chọn";
    }
  };

  const columns = [
    {
      title: "STT",
      key: "index",
      width: 62,
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
      width: 155,
      render: (phone) => {
        // Hàm format kiểu xxxx xxx xxx
        const formatPhone = (num) => {
          if (!num) return "—";
          const cleaned = num.replace(/\D/g, "");
          if (cleaned.length === 10) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
          }
          return num;
        };

        return (
          <Space>
            {phone ? (
              <Typography.Text code style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "0.5px" }}>
                {formatPhone(phone)}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: "15px" }}>
                —
              </Typography.Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "Địa chỉ",
      dataIndex: "address",
      key: "address",
      width: 180,
      ellipsis: { showTitle: false }, // tự động ... nếu dài
      render: (addr) => (
        <Tooltip title={addr}>
          <span style={{ cursor: "pointer" }}>{addr || "—"}</span>
        </Tooltip>
      ),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      width: 150,
      ellipsis: { showTitle: false },
      render: (note) => (
        <Tooltip title={note}>
          <span style={{ cursor: "pointer" }}>{note || "—"}</span>
        </Tooltip>
      ),
    },

    {
      title: "Tổng chi tiêu",
      dataIndex: "totalSpent",
      key: "total",
      width: 160,
      align: "right",
      sorter: (a, b) => {
        const aVal = a.totalAmount.$numberDecimal || a.totalAmount;
        const bVal = b.totalAmount.$numberDecimal || b.totalAmount;
        return Number(bVal) - Number(aVal);
      },
      render: (text) => (
        <Text strong style={{ color: "#d4380d" }}>
          {formatVND(text)}
        </Text>
      ),
    },
    {
      title: "Đơn đã mua",
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
      title: "Điểm",
      dataIndex: "loyaltyPoints",
      key: "loyalty",
      width: 100,
      align: "center",
      sorter: (a, b) => (a.loyaltyPoints || 0) - (b.loyaltyPoints || 0),
      render: (v) => (
        <Text strong style={{ color: "#52c41a" }}>
          {v?.toLocaleString() || 0}
        </Text>
      ),
    },
    {
      title: "Mua gần nhất",
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
          {/* CARD FILTER */}
          <Card style={{ border: "1px solid #8c8c8c" }}>
            {/* HEADER */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #e8e8e8" }}>
              <Title level={2} style={{ margin: 0, color: "#1890ff", marginBottom: 4 }}>
                {currentStore.name || "Đang tải..."}
              </Title>
              <Text style={{ color: "black", fontSize: "18px" }}>
                <UserOutlined /> Top Khách Hàng Thân Thiết
              </Text>
            </div>

            {/* FILTERS ROW 1 */}
            <Row gutter={[10, 12]} align="bottom">
              {/* Loại kỳ */}
              <Col xs={24} sm={12} md={6} lg={4}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                    Loại kỳ
                  </Text>
                  <Select value={periodType} onChange={setPeriodType} style={{ width: "100%" }} size="middle">
                    <Option value="day">Ngày</Option>
                    <Option value="month">Tháng</Option>
                    <Option value="quarter">Quý</Option>
                    <Option value="year">Năm</Option>
                    <Option value="custom">Tùy chỉnh</Option>
                  </Select>
                </div>
              </Col>

              {/* Chọn thời gian */}
              <Col xs={24} sm={12} md={8} lg={5}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                    {periodType === "day" && "Chọn ngày"}
                    {periodType === "month" && "Chọn tháng"}
                    {periodType === "quarter" && "Chọn quý"}
                    {periodType === "year" && "Chọn năm"}
                    {periodType === "custom" && "Từ tháng"}
                  </Text>

                  {/* Ngày cụ thể */}
                  {periodType === "day" && (
                    <DatePicker
                      picker="date"
                      format="DD-MM-YYYY"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn ngày"
                      onChange={(date) => setPeriodKey(date ? date.format("YYYY-MM-DD") : "")}
                    />
                  )}

                  {/* Tháng */}
                  {periodType === "month" && (
                    <DatePicker
                      picker="month"
                      format="MM-YYYY"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn tháng"
                      onChange={(date) => setPeriodKey(date ? date.format("YYYY-MM") : "")}
                    />
                  )}

                  {/* Quý */}
                  {periodType === "quarter" && (
                    <Select style={{ width: "100%" }} size="middle" placeholder="Chọn quý" onChange={(v) => setPeriodKey(v)}>
                      <Option value={`${dayjs().year()}-Q1`}>Quý 1 - {dayjs().year()}</Option>
                      <Option value={`${dayjs().year()}-Q2`}>Quý 2 - {dayjs().year()}</Option>
                      <Option value={`${dayjs().year()}-Q3`}>Quý 3 - {dayjs().year()}</Option>
                      <Option value={`${dayjs().year()}-Q4`}>Quý 4 - {dayjs().year()}</Option>
                    </Select>
                  )}

                  {/* Năm */}
                  {periodType === "year" && (
                    <DatePicker
                      picker="year"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn năm"
                      value={periodKey ? dayjs(periodKey, "YYYY") : null}
                      onChange={(date) => {
                        setPeriodKey(date ? date.format("YYYY") : "");
                      }}
                      disabledDate={(current) => {
                        const start = dayjs().subtract(10, "year");
                        const end = dayjs().add(5, "year");
                        return current && (current < start.startOf("year") || current > end.endOf("year"));
                      }}
                    />
                  )}

                  {/* Tùy chỉnh - Từ tháng */}
                  {periodType === "custom" && (
                    <DatePicker
                      picker="month"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Từ tháng"
                      onChange={(d) => setMonthFrom(d?.format("YYYY-MM") || "")}
                    />
                  )}
                </div>
              </Col>

              {/* Đến tháng - chỉ hiện khi custom */}
              {periodType === "custom" && (
                <Col xs={24} sm={12} md={8} lg={5}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                      Đến tháng
                    </Text>
                    <DatePicker
                      picker="month"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Đến tháng"
                      onChange={(d) => setMonthTo(d?.format("YYYY-MM") || "")}
                    />
                  </div>
                </Col>
              )}

              {/* Số lượng */}
              <Col xs={12} sm={8} md={6} lg={3}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                    Số lượng
                  </Text>
                  <Select
                    style={{ width: "100%" }}
                    size="middle"
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
                </div>
              </Col>

              {/* Input tùy chỉnh số lượng */}
              {limitOption === "custom" && (
                <Col xs={12} sm={8} md={6} lg={3}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                      Nhập số
                    </Text>
                    <InputNumber
                      min={1}
                      max={200}
                      value={customLimit}
                      onChange={setCustomLimit}
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="VD: 30"
                    />
                  </div>
                </Col>
              )}

              {/* Nút Xem kết quả */}
              <Col xs={24} sm={12} md={6} lg={4}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" }}>
                  <Button type="primary" icon={<SearchOutlined />} onClick={fetchTopCustomers} style={{ width: "100%" }} size="middle">
                    Xem kết quả
                  </Button>
                </div>
              </Col>

              {/* Nút Xuất Excel - ẩn khi custom */}
              {periodType !== "custom" && (
                <Col xs={24} sm={12} md={6} lg={4}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" }}>
                    <Button
                      icon={<FileExcelOutlined />}
                      style={{ width: "100%" }}
                      size="middle"
                      type="primary"
                      onClick={() => handleExport("xlsx")}
                      disabled={filtered.length === 0}
                    >
                      Xuất Excel
                    </Button>
                  </div>
                </Col>
              )}
            </Row>

            {/* ROW 2 - Nút Excel khi custom */}
            {periodType === "custom" && (
              <Row gutter={[10, 12]} style={{ marginTop: 12 }}>
                <Col xs={24} sm={12} md={8} lg={4} lgOffset={20}>
                  <Button
                    icon={<FileExcelOutlined />}
                    style={{ width: "100%" }}
                    size="middle"
                    type="primary"
                    onClick={() => handleExport("xlsx")}
                    disabled={filtered.length === 0}
                  >
                    Xuất Excel
                  </Button>
                </Col>
              </Row>
            )}

            {/* TÌM KIẾM */}
            <Row style={{ marginTop: 16 }}>
              <Col span={24}>
                <Search
                  placeholder="Tìm tên hoặc số điện thoại..."
                  allowClear
                  enterButton="Tìm kiếm"
                  size="large"
                  onSearch={setSearchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>
          </Card>

          {/* LOADING & ERROR */}
          {loading && <Spin tip="Đang tải top khách hàng..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon />}

          {/* BẢNG */}
          <Card
            style={{ border: "1px solid #8c8c8c" }}
            title={
              <Space>
                <DollarOutlined style={{ color: "#d4380d" }} />
                <Text strong>
                  Top {filtered.length} khách hàng thân thiết - {getPeriodDisplayText()}
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
                  <div style={{ color: "#f45a07f7", textAlign: "center", padding: "20px" }}>
                    {hasFetched ? (
                      <>
                        Không có dữ liệu khách hàng trong kỳ: <strong>{getPeriodDisplayText()}</strong>
                      </>
                    ) : (
                      "Chưa có dữ liệu. Hãy chọn kỳ thống kê và nhấn 'Xem kết quả' để tải!"
                    )}
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
