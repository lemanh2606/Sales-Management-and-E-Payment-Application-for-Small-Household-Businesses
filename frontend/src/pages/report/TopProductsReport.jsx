// src/pages/report/TopProductsReport.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, Col, Row, Select, InputNumber, Table, Space, Typography, Spin, Empty, Dropdown, Menu, DatePicker, Button, Tag } from "antd";
import { FileExcelOutlined, FilePdfOutlined, DownloadOutlined } from "@ant-design/icons";
import axios from "axios";
import Layout from "../../components/Layout";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "react-router-dom";
import debounce from "../../utils/debounce"; // File debounce của bạn

dayjs.extend(quarterOfYear);

const { Option } = Select;
const { Title, Text } = Typography;
const { MonthPicker, YearPicker } = DatePicker;

const apiUrl = import.meta.env.VITE_API_URL;

const TopProductsReport = () => {
  const { currentStore: authStore } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlStoreId = queryParams.get("storeId");

  // Ưu tiên store từ AuthContext, sau đó đến URL, cuối cùng là localStorage fallback
  const currentStore = authStore || (urlStoreId ? { _id: urlStoreId } : JSON.parse(localStorage.getItem("currentStore") || "{}"));
  const token = localStorage.getItem("token");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Period states
  const [periodType, setPeriodType] = useState("month");
  const [periodKey, setPeriodKey] = useState(""); // "" = chưa chọn
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");

  // Limit
  const [limitOption, setLimitOption] = useState("");
  const [customLimit, setCustomLimit] = useState(null);

  // Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset khi đổi loại kỳ (giống ListAllOrder)
  useEffect(() => {
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
    setProducts([]); // Xóa dữ liệu cũ ngay lập tức
  }, [periodType]);

  // Kiểm tra đã đủ điều kiện để gọi API chưa
  const isReadyToLoad = () => {
    if (!currentStore?._id) return false;

    if (periodType === "custom") {
      return monthFrom !== "" && monthTo !== "";
    }
    return periodKey !== "";
  };

  // Hàm gọi API
  const loadTopProducts = async () => {
    if (!isReadyToLoad()) return;

    setLoading(true);
    try {
      let limit = 10;
      if (limitOption === "3") limit = 3;
      else if (limitOption === "5") limit = 5;
      else if (limitOption === "20") limit = 20;
      else if (limitOption === "custom" && customLimit) limit = customLimit;

      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("periodType", periodType);

      // Chỉ gửi periodKey nếu không phải custom
      if (periodType !== "custom") {
        params.append("periodKey", periodKey);
      }

      if (periodType === "custom") {
        params.append("monthFrom", monthFrom);
        params.append("monthTo", monthTo);
      }
      if (limit) params.append("limit", limit);

      const res = await axios.get(`${apiUrl}/orders/top-products?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProducts(res.data.data || []);
    } catch (err) {
      setProducts([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce 500ms giống hệt trang ListAllOrder
  const debouncedLoad = useCallback(
    debounce(() => {
      loadTopProducts();
    }, 300),
    [periodType, periodKey, monthFrom, monthTo, limitOption, customLimit, currentStore._id]
  );

  // Gọi API khi đủ điều kiện
  useEffect(() => {
    if (isReadyToLoad()) {
      debouncedLoad();
    } else {
      setProducts([]);
    }

    return () => debouncedLoad.cancel?.(); // Cleanup debounce
  }, [periodType, periodKey, monthFrom, monthTo, limitOption, customLimit, currentStore._id]);

  // Format tiền
  const formatVND = (value) => {
    if (!value) return "₫0";
    const num = typeof value === "object" ? value.$numberDecimal || value : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Export file
  const handleExport = async (format) => {
    if (!isReadyToLoad()) return;

    try {
      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("periodType", periodType);
      params.append("periodKey", periodKey);
      if (periodType === "custom") {
        params.append("monthFrom", monthFrom);
        params.append("monthTo", monthTo);
      }
      params.append("format", format);

      const res = await axios.get(`${apiUrl}/orders/top-products/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `top-san-pham-${periodType}-${periodKey || `${monthFrom}_den_${monthTo}`}.${format}`;
      link.click();
    } catch (err) {
      console.error(err);
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
    { title: "STT", width: 70, align: "center", render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 },
    {
      title: "Tên sản phẩm",
      dataIndex: "productName",
      render: (t) => (
        <Text strong ellipsis={{ tooltip: t }}>
          {t}
        </Text>
      ),
      width: 400,
    },
    { title: "SKU", dataIndex: "productSku", render: (t) => <Text code>{t || "-"}</Text> },
    {
      title: "SL bán",
      dataIndex: "totalQuantity",
      align: "center",
      render: (v) => (
        <Text strong type="danger">
          {v}
        </Text>
      ),
    },
    { title: "Doanh thu", dataIndex: "totalSales", align: "right", render: formatVND },
    { title: "Số đơn", dataIndex: "countOrders", align: "center" },
  ];

  const getPeriodDisplay = () => {
    if (!isReadyToLoad()) return "Chọn kỳ báo cáo";

    if (periodType === "day") return periodKey ? `Ngày ${dayjs(periodKey).format("DD/MM/YYYY")}` : "";
    if (periodType === "month") return periodKey ? `Tháng ${dayjs(periodKey).format("MM/YYYY")}` : "";
    if (periodType === "quarter") return periodKey ? periodKey.replace("-Q", " Quý ") : "";
    if (periodType === "year") return periodKey ? `Năm ${periodKey}` : "";
    if (periodType === "custom") return monthFrom && monthTo ? `Từ ${dayjs(monthFrom).format("MM/YYYY")} → ${dayjs(monthTo).format("MM/YYYY")}` : "";

    return "";
  };

  return (
    <Layout>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card style={{ border: "1px solid #8c8c8c" }}>
          <Row gutter={[16, 16]} align="middle">
            <Col span={8}>
              <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
                {currentStore.name || "Chọn cửa hàng"}
              </Title>
              <Text type="secondary" strong style={{ fontSize: 16, display: "block", marginTop: 8 }}>
                Top sản phẩm bán chạy
              </Text>
            </Col>

            {/* Loại kỳ */}
            <Col span={4}>
              <Text strong>Loại kỳ</Text>
              <Select style={{ width: "100%", marginTop: 8 }} value={periodType} onChange={setPeriodType}>
                <Option value="day">Ngày</Option>
                <Option value="month">Tháng</Option>
                <Option value="quarter">Quý</Option>
                <Option value="year">Năm</Option>
                <Option value="custom">Tùy chỉnh</Option>
              </Select>
            </Col>

            {/* Kỳ không custom */}
            {periodType !== "custom" && (
              <Col span={5}>
                <Text strong>
                  {periodType === "day" && "Chọn ngày"}
                  {periodType === "month" && "Chọn tháng"}
                  {periodType === "quarter" && "Chọn quý"}
                  {periodType === "year" && "Chọn năm"}
                </Text>

                {periodType === "day" && (
                  <DatePicker
                    style={{ width: "100%", marginTop: 8 }}
                    format="DD/MM/YYYY"
                    placeholder="Chọn ngày"
                    onChange={(d) => setPeriodKey(d ? d.format("YYYY-MM-DD") : "")}
                    allowClear
                  />
                )}

                {periodType === "month" && (
                  <MonthPicker
                    style={{ width: "100%", marginTop: 8 }}
                    format="MM/YYYY"
                    placeholder="Chọn tháng"
                    onChange={(d) => setPeriodKey(d ? d.format("YYYY-MM") : "")}
                    allowClear
                  />
                )}

                {periodType === "quarter" && (
                  <Select style={{ width: "100%", marginTop: 8 }} value={periodKey} onChange={setPeriodKey} allowClear placeholder="Chọn quý">
                    {(() => {
                      const options = [];
                      const now = dayjs();
                      let q = now.quarter(); // quý hiện tại
                      let y = now.year();

                      // Lặp 4 quý gần nhất
                      for (let i = 0; i < 4; i++) {
                        options.push(
                          <Option key={`${y}-Q${q}`} value={`${y}-Q${q}`}>
                            Quý {q}/{y}
                          </Option>
                        );

                        // Giảm quý
                        q--;
                        if (q === 0) {
                          q = 4;
                          y--;
                        }
                      }
                      return options;
                    })()}
                  </Select>
                )}

                {periodType === "year" && (
                  <YearPicker
                    style={{ width: "100%", marginTop: 8 }}
                    format="YYYY"
                    placeholder="Chọn năm"
                    onChange={(d) => setPeriodKey(d ? d.format("YYYY") : "")}
                    allowClear
                  />
                )}
              </Col>
            )}

            {/* Custom từ/tháng */}
            {periodType === "custom" && (
              <>
                <Col span={3}>
                  <Text strong>Từ tháng</Text>
                  <MonthPicker
                    style={{ width: "100%", marginTop: 8 }}
                    format="MM/YYYY"
                    placeholder="Từ"
                    onChange={(d) => setMonthFrom(d ? d.format("YYYY-MM") : "")}
                    allowClear
                  />
                </Col>
                <Col span={3}>
                  <Text strong>Đến tháng</Text>
                  <MonthPicker
                    style={{ width: "100%", marginTop: 8 }}
                    format="MM/YYYY"
                    placeholder="Đến"
                    onChange={(d) => setMonthTo(d ? d.format("YYYY-MM") : "")}
                    disabledDate={(current) => monthFrom && current < dayjs(monthFrom)}
                    allowClear
                  />
                </Col>
              </>
            )}

            {/* Top N */}
            <Col span={3}>
              <Text strong>Top</Text>
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
              <Col span={2}>
                <InputNumber
                  min={1}
                  max={500}
                  value={customLimit}
                  onChange={setCustomLimit}
                  style={{ width: "100%", marginTop: 32 }}
                  placeholder="50"
                />
              </Col>
            )}

            {/* Nút Xuất – chỉ enable khi có dữ liệu */}
            <Col span={2}>
              <Dropdown overlay={exportMenu} disabled={!isReadyToLoad() || products.length === 0}>
                <Button icon={<DownloadOutlined />} style={{ width: "100%", marginTop: 32 }}>
                  Xuất
                </Button>
              </Dropdown>
            </Col>
          </Row>
        </Card>

        {/* BẢNG DỮ LIỆU */}
        {!isReadyToLoad() ? (
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Empty description="Vui lòng chọn kỳ báo cáo để xem top sản phẩm" />
          </Card>
        ) : loading ? (
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <Spin size="large" tip="Đang tải top sản phẩm..." />
            </div>
          </Card>
        ) : products.length === 0 ? (
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Empty description="Không có dữ liệu trong kỳ này" />
          </Card>
        ) : (
          <Card
            title={
              <>
                Top sản phẩm bán chạy – <Tag color="blue">{getPeriodDisplay()}</Tag>
              </>
            }
            style={{ border: "1px solid #8c8c8c" }}
          >
            <Table
              columns={columns}
              dataSource={products}
              rowKey={(_, i) => i}
              pagination={{
                current: currentPage,
                pageSize,
                total: products.length,
                showSizeChanger: true,
                onChange: (p, s) => {
                  setCurrentPage(p);
                  setPageSize(s);
                },
                showTotal: (total, range) => (
                  <div style={{ fontSize: 14, color: "#595959" }}>
                    Đang xem{" "}
                    <span style={{ color: "#1890ff", fontWeight: 600 }}>
                      {range[0]} – {range[1]}
                    </span>{" "}
                    trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
                  </div>
                ),
              }}
            />
          </Card>
        )}
      </Space>
    </Layout>
  );
};

export default TopProductsReport;
