// src/pages/report/RevenueReport.jsx
import React, { useState, useEffect } from "react";
import { Card, Col, Row, Select, DatePicker, Statistic, Table, Spin, Alert, Space, Button, Dropdown, message, Typography } from "antd";
import { DownloadOutlined, FileExcelOutlined, DollarOutlined, ShoppingOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";
import { Bold } from "lucide-react";

dayjs.locale("vi");

const { Option } = Select;
const { Text, Title } = Typography;

const apiUrl = import.meta.env.VITE_API_URL;

const RevenueReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // Lấy từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  // Filter
  const [periodType, setPeriodType] = useState("month");
  const [periodKey, setPeriodKey] = useState("");
  const [pickerValue, setPickerValue] = useState(null);
  const [monthFrom, setMonthFrom] = useState("");
  const [monthTo, setMonthTo] = useState("");

  useEffect(() => {
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
  }, [periodType]);

  // Format VND
  const formatVND = (value) => {
    if (!value) return "₫0";
    const num = typeof value === "object" ? value.$numberDecimal : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // GỌI API
  const fetchData = async () => {
    if (!currentStore?._id || !periodType || !periodKey) {
      setSummary(null);
      setEmployeeData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Không có token!");

      const params = new URLSearchParams();
      params.append("storeId", currentStore._id);
      params.append("periodType", periodType);
      params.append("periodKey", periodKey);
      if (periodType === "custom") {
        params.append("monthFrom", monthFrom);
        params.append("monthTo", monthTo);
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
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodType !== "custom" && !periodKey) return;
    if (periodType === "custom" && (!monthFrom || !monthTo)) return;
    fetchData();
  }, [periodType, periodKey, monthFrom, monthTo]);

  // EXPORT ra excel
  const handleExportExcel = async (exportType) => {
    if (!periodKey) {
      message.warning("Vui lòng chọn kỳ báo cáo");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        storeId: currentStore._id,
        periodType,
        periodKey,
        format: "xlsx",
        type: exportType, // ← QUAN TRỌNG: total hoặc employee
        ...(periodType === "custom" && { monthFrom, monthTo }),
      });

      const url = `${apiUrl}/revenues/export?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Bao_Cao_Doanh_Thu_${periodKey.replace(/-/g, "_")}_${dayjs().format("DD-MM-YYYY")}.xlsx`;
      link.click();

      message.success("Xuất Excel thành công!");
    } catch (err) {
      message.error("Lỗi xuất file Excel");
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

  // TABLE COLUMNS
  const columns = [
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
      title: <span style={{ whiteSpace: "nowrap", fontSize: "16px", fontWeight: 600 }}>Số hoá đơn</span>,
      dataIndex: "countOrders",
      key: "orders",
      align: "center",
      width: 150,
      sorter: (a, b) => a.countOrders - b.countOrders,
      render: (value) => <span style={{ fontSize: "16px", color: "#52c41a", fontWeight: 600 }}>{value}</span>,
    },
    {
      title: <span style={{ fontSize: "16px", fontWeight: 600 }}>Doanh thu</span>,
      dataIndex: "totalRevenue",
      key: "revenue",
      align: "right",
      sorter: (a, b) => Number(a.totalRevenue) - Number(b.totalRevenue),
      render: (value) => <span style={{ fontSize: "16px", color: "#1890ff", fontWeight: 600 }}>{formatVND(value)}</span>,
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
              <Text style={{ color: "#595959", fontSize: "16px" }}>
                <DollarOutlined /> Báo Cáo Doanh Thu
              </Text>
            </div>

            {/* FILTERS */}
            <Row gutter={[10, 12]} align="bottom">
              {/* Loại kỳ */}
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
                    <Option value="custom">Tùy chỉnh</Option>
                  </Select>
                </div>
              </Col>

              {/* Chọn kỳ - hiện khi không phải custom */}
              {periodType !== "custom" && (
                <Col xs={24} sm={12} md={8} lg={6}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                      Chọn kỳ
                    </Text>
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
                          setPickerValue(null);
                          return;
                        }
                        let key = "";
                        if (periodType === "day") key = date.format("YYYY-MM-DD");
                        else if (periodType === "month") key = date.format("YYYY-MM");
                        else if (periodType === "quarter") key = `${date.year()}-Q${date.quarter()}`;
                        else if (periodType === "year") key = date.format("YYYY");
                        setPeriodKey(key);
                        setPickerValue(date);
                      }}
                      format={(value) => {
                        if (periodType === "day") return value.format("DD/MM/YYYY");
                        if (periodType === "month") return value.format("MM/YYYY");
                        if (periodType === "quarter") return `Quý ${value.quarter()} ${value.year()}`;
                        if (periodType === "year") return value.format("YYYY");
                        return "";
                      }}
                      placeholder={`Chọn ${
                        periodType === "day" ? "ngày" : periodType === "month" ? "tháng" : periodType === "quarter" ? "quý" : "năm"
                      }`}
                    />
                  </div>
                </Col>
              )}

              {/* Custom - Từ tháng */}
              {periodType === "custom" && (
                <Col xs={24} sm={12} md={8} lg={5}>
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <Text strong style={{ marginBottom: 8, minHeight: 22 }}>
                      Từ tháng
                    </Text>
                    <DatePicker
                      picker="month"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Từ tháng"
                      onChange={(d) => setMonthFrom(d?.format("YYYY-MM") || "")}
                    />
                  </div>
                </Col>
              )}

              {/* Custom - Đến tháng */}
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

              {/* Nút xuất file */}
              <Col xs={24} sm={12} md={8} lg={4}>
                <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" }}>
                  <Button
                    type="primary"
                    icon={<FileExcelOutlined />}
                    onClick={() => handleExportExcel("employees")} // hoặc "total", backend sẽ trả đủ 2 sheet
                  >
                    Xuất Excel
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>

          {/* LOADING */}
          {loading && <Spin tip="Đang tải báo cáo..." style={{ width: "100%", margin: "20px 0" }} />}

          {/* ERROR */}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {/* THÔNG BÁO CHƯA CHỌN KỲ */}
          {(!periodType || !periodKey) && !loading && (
            <Alert message="Vui lòng chọn kỳ báo cáo để xem dữ liệu." type="info" showIcon closable style={{ marginBottom: 16 }} />
          )}

          {/* HIỂN THỊ DỮ LIỆU KHI ĐÃ CHỌN KỲ */}
          {periodKey && summary && (
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
                  <Card style={{ border: "1px solid #8c8c8c", borderLeft: "4px solid #52c41a" }}>
                    <Statistic
                      title={<span style={{ fontSize: "16px", color: "#595959" }}>Số hóa đơn đã bán</span>}
                      value={summary.countOrders}
                      valueStyle={{ color: "#52c41a", fontSize: 32, fontWeight: 700 }}
                      prefix={<ShoppingOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

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
                  onChange={(p) => setPagination(p)}
                  scroll={{ x: 600 }}
                  locale={{
                    emptyText: <div style={{ color: "#8c8c8c", padding: "20px" }}>Không có dữ liệu nhân viên trong kỳ này</div>,
                  }}
                />
              </Card>
            </>
          )}
        </Space>
      </div>
    </Layout>
  );
};

export default RevenueReport;
