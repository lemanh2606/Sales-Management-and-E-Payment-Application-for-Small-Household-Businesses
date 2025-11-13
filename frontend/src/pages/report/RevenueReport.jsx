// src/pages/report/RevenueReport.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  DatePicker,
  Statistic,
  Table,
  Spin,
  Alert,
  Space,
  Button,
  Dropdown,
  Menu,
  message,
} from "antd";
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";

dayjs.locale("vi");

const { Option } = Select;

const RevenueReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Lấy từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  // Filter
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [pickerValue, setPickerValue] = useState(null);

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

      // 1. Tổng doanh thu
      const totalRes = await axios.get(
        `http://localhost:9999/api/revenues?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSummary(totalRes.data.revenue);

      // 2. Doanh thu nhân viên
      const empRes = await axios.get(
        `http://localhost:9999/api/revenues/employee?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
    fetchData();
  }, [periodType, periodKey]);

  const handleTypeChange = (value) => {
    setPeriodType(value);
    setPeriodKey("");
    setPickerValue(null);
    setSummary(null);
    setEmployeeData([]);
  };

  const handlePeriodChange = (date) => {
    if (!date) return;
    let key = "";
    if (periodType === "month") key = date.format("YYYY-MM");
    else if (periodType === "quarter") key = `${date.year()}-Q${date.quarter()}`;
    else if (periodType === "year") key = date.year().toString();
    setPeriodKey(key);
    setPickerValue(date);
  };

  // EXPORT
  const handleExport = async (format, type) => {
    if (!periodType || !periodKey) {
      Swal.fire({
        title: "⚠️ Cảnh báo!",
        text: "Vui lòng chọn kỳ báo cáo",
        icon: "warning",
        confirmButtonText: "OK",
        confirmButtonColor: "#faad14",
        timer: 2000,
      });

      return;
    }

    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/revenues/export?storeId=${currentStore._id}&periodType=${periodType}&periodKey=${periodKey}&format=${format}&type=${type}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download =
        res.headers["content-disposition"]?.split("filename=")[1]?.replace(/"/g, "") || `doanh_thu.${format}`;
      link.click();
      Swal.fire({
        title: "🎉 Thành công!",
        text: "Tải file thành công!",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
      });
    } catch (err) {
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Lỗi tải file",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    }
  };

  const exportMenu = (
    <Menu>
      <Menu.SubMenu key="total" title="Tổng doanh thu" icon={<FileExcelOutlined />}>
        <Menu.Item key="csv-total" onClick={() => handleExport("csv", "total")}>
          <FileExcelOutlined /> Dạng CSV
        </Menu.Item>
        <Menu.Item key="pdf-total" onClick={() => handleExport("pdf", "total")}>
          <FilePdfOutlined /> Dạng PDF
        </Menu.Item>
      </Menu.SubMenu>
      <Menu.SubMenu key="employee" title="Theo nhân viên" icon={<FileExcelOutlined />}>
        <Menu.Item key="csv-emp" onClick={() => handleExport("csv", "employee")}>
          <FileExcelOutlined /> Dạng CSV
        </Menu.Item>
        <Menu.Item key="pdf-emp" onClick={() => handleExport("pdf", "employee")}>
          <FilePdfOutlined /> Dạng PDF
        </Menu.Item>
      </Menu.SubMenu>
    </Menu>
  );

  // TABLE COLUMNS
  const columns = [
    {
      title: <span style={{ fontSize: "16px" }}>Nhân viên</span>,
      dataIndex: ["employeeInfo", "fullName"],
      key: "name",
      render: (text) => <strong style={{ fontSize: "16px" }}>{text}</strong>,
    },
    {
      title: <span style={{ whiteSpace: "nowrap", fontSize: "16px" }}>Số hoá đơn bán được</span>,
      dataIndex: "countOrders",
      key: "orders",
      align: "center",
      width: 150,
      sorter: (a, b) => a.countOrders - b.countOrders,
      render: (value) => <span style={{ fontSize: "16px" }}>{value}</span>,
    },
    {
      title: <span style={{ fontSize: "16px" }}>Doanh thu</span>,
      dataIndex: "totalRevenue",
      key: "revenue",
      align: "right",
      sorter: (a, b) => Number(a.totalRevenue) - Number(b.totalRevenue),
      render: (value) => <span style={{ fontSize: "16px" }}>{formatVND(value)}</span>,
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
                <span style={{ color: "#1890ff", fontWeight: "bold", fontSize: "20px" }}>
                  {currentStore.name || "Đang tải..."}
                </span>
              </Col>
              <Col span={5}>
                <label>Kỳ báo cáo:</label>
                <Select style={{ width: "100%", marginTop: 8 }} value={periodType} onChange={handleTypeChange}>
                  <Option value="">Chọn loại</Option>
                  <Option value="month">Theo tháng</Option>
                  <Option value="quarter">Theo quý</Option>
                  <Option value="year">Theo năm</Option>
                </Select>
              </Col>
              <Col span={5}>
                <label>Chọn kỳ:</label>
                {!periodType && <Alert message="Hãy chọn kỳ báo cáo trước" type="warning" style={{ marginTop: 8 }} />}
                {periodType && (
                  <DatePicker
                    style={{ width: "100%", marginTop: 8 }}
                    picker={periodType}
                    value={pickerValue}
                    onChange={handlePeriodChange}
                    format={(value) => {
                      if (periodType === "quarter") return `Q${value.quarter()}/${value.year()}`;
                      if (periodType === "month") return value.format("MM/YYYY");
                      return value.format("YYYY");
                    }}
                    placeholder={`Chọn ${periodType === "month" ? "tháng" : periodType === "quarter" ? "quý" : "năm"}`}
                    locale={{
                      lang: {
                        locale: "vi_VN",
                        shortMonths: [
                          "Th 1",
                          "Th 2",
                          "Th 3",
                          "Th 4",
                          "Th 5",
                          "Th 6",
                          "Th 7",
                          "Th 8",
                          "Th 9",
                          "Th 10",
                          "Th 11",
                          "Th 12",
                        ],
                        months: [
                          "Tháng 1",
                          "Tháng 2",
                          "Tháng 3",
                          "Tháng 4",
                          "Tháng 5",
                          "Tháng 6",
                          "Tháng 7",
                          "Tháng 8",
                          "Tháng 9",
                          "Tháng 10",
                          "Tháng 11",
                          "Tháng 12",
                        ],
                      },
                    }}
                  />
                )}
              </Col>
              <Col span={8} style={{ textAlign: "center" }}>
                <Dropdown overlay={exportMenu} placement="bottomRight" trigger={["click"]}>
                  <Button type="primary" icon={<DownloadOutlined />}>
                    Xuất file
                  </Button>
                </Dropdown>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang tải báo cáo..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {(!periodType || !periodKey) && !loading && (
            <Alert
              message="Vui lòng chọn kỳ báo cáo để xem dữ liệu."
              type="info"
              showIcon
              closable
              style={{ marginBottom: 16, height: 80 }}
            />
          )}

          {summary && (
            <>
              {/* TỔNG DOANH THU */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={8}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Tổng doanh thu"
                      value={summary.totalRevenue?.$numberDecimal || summary.totalRevenue}
                      formatter={formatVND}
                      valueStyle={{ color: "#1890ff", fontSize: 28 }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Số hóa đơn đã bán của cửa hàng"
                      value={summary.countOrders}
                      valueStyle={{ color: "#52c41a", fontSize: 28 }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* DOANH THU NHÂN VIÊN */}
              <Card
                title={<span style={{ fontSize: "20px" }}>Doanh thu theo nhân viên</span>}
                style={{ marginTop: 24, border: "1px solid #8c8c8c" }}
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
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          fontSize: 14,
                          color: "#595959",
                        }}
                      >
                        <div>
                          Đang xem{" "}
                          <span style={{ color: "#1677ff", fontWeight: 600 }}>
                            {range[0]} – {range[1]}
                          </span>{" "}
                          trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhân viên
                        </div>
                      </div>
                    ),
                  }}
                  onChange={(p) => setPagination(p)}
                  scroll={{ x: 600 }}
                  locale={{ emptyText: "Không có dữ liệu nhân viên" }}
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
