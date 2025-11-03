// src/pages/report/ReportDashboard.jsx
import React, { useState, useEffect } from "react";
import { Card, Col, Row, Select, DatePicker, Statistic, Spin, Alert, Space, InputNumber, Button, Popover } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import Layout from "../../components/Layout";
import "dayjs/locale/vi"; // ✅ LOCALE VI

dayjs.locale("vi"); // ✅ SET LOCALE VI
dayjs.extend(localizedFormat);
dayjs.extend(quarterOfYear);

// CUSTOM LOCALE CHO TIẾNG VIỆT ĐẸP
const vietnameseLocale = {
  ...dayjs.Ls.vi,
  formats: {
    ...dayjs.Ls.vi.formats,
    L: "DD/MM/YYYY",
    LL: "D MMMM YYYY",
    LLL: "D MMMM YYYY HH:mm",
    LLLL: "dddd, D MMMM YYYY HH:mm",
  },
};
dayjs.locale(vietnameseLocale);

// Màu sắc biểu đồ
const COLORS = {
  revenue: "#1890ff",
  grossProfit: "#52c41a",
  netProfit: "#722ed1",
  operatingCost: "#fa8c16",
  vat: "#f5222d",
  stockValue: "#13c2c2",
};

// helper: trả về màu dựa vào giá trị profit (VND)
const getProfitColorByValue = (value) => {
  if (value == null) return "#fa8c16"; // cam cho unknown
  if (Number(value) > 0) return "#52c41a"; // xanh lá
  if (Number(value) < 0) return "#f5222d"; // đỏ
  return "#fa8c16"; // =0 => cam
};

const ReportDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}"); // Lấy từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}"); // Lấy từ localStorage

  // Filter - không có ngày tháng cụ thể để tránh lỗi
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [extraExpenses, setExtraExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState("");
  const [pickerValue, setPickerValue] = useState(null);

  // Format tiền tệ việt nam (VND)
  const formatVND = (value) => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Biểu đồ
  const generateBarData = () => {
    if (!data) return [];
    return [
      { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
      { name: "Lợi nhuận gộp", value: data.grossProfit, fill: COLORS.grossProfit },
      { name: "Chi phí vận hành", value: data.operatingCost, fill: COLORS.operatingCost },
      { name: "Lợi nhuận ròng", value: data.netProfit, fill: COLORS.netProfit },
    ];
  };

  // GỌI API
  const fetchFinancial = async () => {
    if (!currentStore?._id) {
      console.warn("Không có currentStore");
      setError("Vui lòng chọn cửa hàng trước.");
      return;
    }
    if (!periodType || !periodKey) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Không có token!");

      const params = new URLSearchParams({
        storeId: currentStore._id,
        periodType,
        periodKey,
      });

      if (extraExpenses.length > 0) {
        params.append("extraExpense", extraExpenses.join(","));
      }

      const url = `http://localhost:9999/api/financials?${params.toString()}`;
      console.log("URL:", url);

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      console.log("API OK:", res.data);
      setData(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error("Lỗi API:", err);
      setError(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // TỰ ĐỘNG GỌI KHI THAY ĐỔI FILTER
  useEffect(() => {
    fetchFinancial();
  }, [periodType, periodKey, extraExpenses.length]);

  // XỬ LÝ THAY ĐỔI TYPE
  const handleTypeChange = (value) => {
    setPeriodType(value);
    setPeriodKey(""); // Reset key
    setPickerValue(null);
    setData(null); // Reset data
  };

  // XỬ LÝ KỲ (KEY)
  const handlePeriodChange = (date) => {
    if (!date) return;
    let key = "";
    if (periodType === "month") {
      key = date.format("YYYY-MM");
    } else if (periodType === "quarter") {
      const q = Math.floor(date.month() / 3) + 1;
      key = `${date.year()}-Q${q}`;
    } else if (periodType === "year") {
      key = date.year().toString();
    }
    setPeriodKey(key);
    setPickerValue(date);
  };

  // CHI PHÍ NGOÀI LỀ (tự nhập thêm nếu cần)
  const addExtraExpense = () => {
    if (newExpense && !isNaN(newExpense)) {
      const val = Number(newExpense);
      setExtraExpenses([...extraExpenses, val]);
      setNewExpense("");
    }
  };

  const removeExpense = (i) => {
    const removed = extraExpenses[i];
    setExtraExpenses(extraExpenses.filter((_, idx) => idx !== i));
    console.log("Xóa chi phí:", removed);
  };

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
                  <Select.Option value="">Chưa chọn</Select.Option>
                  <Select.Option value="month">Theo tháng</Select.Option>
                  <Select.Option value="quarter">Theo quý</Select.Option>
                  <Select.Option value="year">Theo năm</Select.Option>
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
                    // CUSTOM FORMAT CHO QUÝ: "Q4/2025"
                    format={(value) => {
                      if (periodType === "quarter") {
                        return `Q${value.quarter()}/${value.year()}`;
                      }
                      if (periodType === "month") {
                        return value.format("MM/YYYY");
                      }
                      return value.format("YYYY");
                    }}
                    placeholder={`Chọn ${periodType === "month" ? "tháng" : periodType === "quarter" ? "quý" : "năm"}`}
                    // TIẾNG VIỆT TRONG LỊCH
                    locale={{
                      lang: {
                        locale: "vi_VN",
                        monthFormat: "MMMM",
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
              <Col span={8}>
                <label>Chi phí ngoài:{" "}</label>
                <Space style={{ marginTop: 8 }}>
                  <InputNumber
                    min={0}
                    value={newExpense}
                    onChange={setNewExpense}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(v) => v.replace(/\$\s?|(,*)/g, "")}
                    style={{ width: 120 }}
                    placeholder="VD: 1000000"
                    onKeyPress={(e) => {
                      if (/[a-zA-Z]/.test(e.key)) {
                        e.preventDefault(); // ⛔ chặn nhập chữ cái
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pastedText = e.clipboardData.getData("text"); // lấy nội dung vừa paste
                      const numericOnly = pastedText.replace(/[^0-9]/g, ""); // chỉ giữ lại số
                      const value = Number(numericOnly || 0);
                      setNewExpense(value); // cập nhật lại state
                    }}
                  />

                  <Button type="primary" onClick={addExtraExpense} disabled={!newExpense || isNaN(newExpense)}>
                    Thêm
                  </Button>
                </Space>
                <div style={{ marginTop: 8 }}>
                  {extraExpenses.map((exp, i) => (
                    <span
                      key={i}
                      style={{
                        marginRight: 8,
                        background: "#f0f0f0",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    >
                      {formatVND(exp)}{" "}
                      <a onClick={() => removeExpense(i)} style={{ color: "#ff4d4f" }}>
                        x
                      </a>
                    </span>
                  ))}
                </div>
                <small style={{ display: "block", color: "blue", marginBottom: 4 }}>
                  (Chi phí không nằm trong hệ thống, VD: mặt bằng, điện-nước, marketing,...)
                </small>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang tải..." style={{ width: "100%", margin: "20px 0" }} />}
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

          {!loading && data && (
            <>
              {/* CHỈ SỐ */}
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Doanh thu"
                      value={data.totalRevenue}
                      formatter={formatVND}
                      valueStyle={{ color: COLORS.revenue }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Lợi nhuận gộp"
                      value={data.grossProfit}
                      formatter={formatVND}
                      valueStyle={{ color: COLORS.grossProfit }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Chi phí vận hành"
                      value={data.operatingCost}
                      formatter={formatVND}
                      valueStyle={{ color: COLORS.operatingCost }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card style={{ border: "1px solid #8c8c8c" }}>
                    <Statistic
                      title="Lợi nhuận ròng"
                      value={data.netProfit}
                      formatter={formatVND}
                      valueStyle={{ color: data.netProfit > 0 ? COLORS.netProfit : "#f5222d" }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* BIỂU ĐỒ */}
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={24}>
                  <Card style={{ border: "1px solid #8c8c8c" }} title="Cơ cấu tài chính">
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={generateBarData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                        <Tooltip formatter={formatVND} />
                        <Bar dataKey="value" fill={(e) => e.fill} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} lg={24}>
                  <Card style={{ border: "1px solid #8c8c8c" }} title="Thuế & Tồn kho">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Thuế GTGT", value: data.totalVAT, fill: COLORS.vat },
                            { name: "Tồn kho", value: data.stockValue, fill: COLORS.stockValue },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          label={(entry) => `${entry.name}: ${formatVND(entry.value)}`}
                          dataKey="value"
                          onMouseEnter={(e, idx) => {
                            e.target.outerRadius = 110;
                          }}
                          onMouseLeave={(e, idx) => {
                            e.target.outerRadius = 100;
                          }}
                        >
                          <Cell fill={COLORS.vat} />
                          <Cell fill={COLORS.stockValue} />
                        </Pie>
                        <Tooltip formatter={formatVND} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Hiển thị chi tiết giá trị */}
                    <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
                      <div>
                        <span style={{ color: COLORS.vat, marginRight: 4 }}>●</span>
                        <strong style={{ color: COLORS.vat }}>Thuế GTGT:</strong> {formatVND(data.totalVAT)}
                      </div>
                      <div>
                        <span style={{ color: COLORS.stockValue, marginRight: 4 }}>●</span>
                        <strong style={{ color: COLORS.stockValue }}>Tồn kho:</strong> {formatVND(data.stockValue)}
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* CHI TIẾT */}
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card style={{ border: "1px solid #8c8c8c" }} title="Chi tiết">
                    <p>
                      <strong>Chi phí nhập hàng (COGS):</strong> {formatVND(data.totalCOGS)}
                    </p>
                    <p>
                      <strong>Điều chỉnh tồn kho:</strong> {formatVND(data.stockAdjustmentValue)}
                    </p>
                    <p>
                      <strong>Chi phí hàng hoá huỷ:</strong> {formatVND(data.stockDisposalCost)}
                    </p>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card style={{ border: "1px solid #8c8c8c" }} title="Hiệu suất">
                    <p>
                      <Popover
                        content={
                          <>
                            <strong>Lợi nhuận gộp</strong> = Doanh thu - Giá vốn hàng bán.
                            <br />
                            Cho biết bạn lời bao nhiêu sau khi trừ chi phí nhập hàng.
                          </>
                        }
                      >
                        <strong style={{ cursor: "help" }}>
                          Lợi nhuận gộp <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />
                        </strong>
                      </Popover>
                      :{" "}
                      <span
                        style={{
                          color: getProfitColorByValue(data?.grossProfit),
                          fontWeight: "bold",
                          transition: "color 0.4s ease",
                        }}
                      >
                        {data?.totalRevenue ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
                      </span>
                    </p>

                    <p>
                      <Popover
                        content={
                          <>
                            <strong>Lợi nhuận ròng</strong> = Lợi nhuận gộp - Chi phí vận hành - Thuế.
                            <br />
                            Đây là phần tiền bạn thực sự lãi sau khi trừ hết mọi chi phí.
                          </>
                        }
                      >
                        <strong style={{ cursor: "help" }}>
                          Lợi nhuận ròng <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />
                        </strong>
                      </Popover>
                      :{" "}
                      <span
                        style={{
                          color: getProfitColorByValue(data?.netProfit),
                          fontWeight: "bold",
                          transition: "color 0.4s ease",
                        }}
                      >
                        {data?.totalRevenue ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
                      </span>
                    </p>
                  </Card>
                </Col>
                {/* Hết */}
              </Row>
            </>
          )}
        </Space>
      </div>
    </Layout>
  );
};

export default ReportDashboard;
