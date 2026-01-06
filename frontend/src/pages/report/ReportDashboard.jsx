// src/pages/report/ReportDashboard.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  DatePicker,
  Statistic,
  Spin,
  Alert,
  Space,
  InputNumber,
  Button,
  Popover,
  Tag,
  Table,
  Typography,
  Divider,
  Tooltip as AntTooltip,
  Badge,
  Modal,
  Form,
  Input,
} from "antd";
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  DollarOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import dayjs from "dayjs";
import "../../premium.css";
import localizedFormat from "dayjs/plugin/localizedFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import "dayjs/locale/vi"; // ✅ LOCALE VI

const { Title, Text, Paragraph } = Typography;

dayjs.locale("vi"); // ✅ SET LOCALE VI
dayjs.extend(localizedFormat);
dayjs.extend(quarterOfYear);
const apiUrl = import.meta.env.VITE_API_URL;
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
  totalVAT: "#fa8c16",
  totalCOGS: "#52c41a",
  stockValueAtSalePrice: "#e90c77ff",
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
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}"); // Lấy từ localStorage
  const [groupPagination, setGroupPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Filter - không có ngày tháng cụ thể để tránh lỗi
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [pickerValue, setPickerValue] = useState(null);

  // 🆕 Chi phí ngoài lệ: theo từng kỳ báo cáo (storeId + periodType + periodKey)
  const [extraExpensesByPeriod, setExtraExpensesByPeriod] = useState({}); // { [periodId]: number[] }
  const [unsavedByPeriod, setUnsavedByPeriod] = useState({}); // { [periodId]: boolean }
  const [newExpense, setNewExpense] = useState("");

  // Format tiền tệ việt nam (VND)
  const formatVND = (value) => {
    if (value === null || value === undefined) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // ====== HELPERS ======
  // periodId: store-based để tránh đổi store bị dính chi phí
  const getPeriodId = (storeId, type, key) => `${storeId || "no-store"}|${type || "no-type"}|${key || "no-key"}`;

  const currentPeriodId = getPeriodId(currentStore?._id, periodType, periodKey);

  const getCurrentExpenses = () => extraExpensesByPeriod[currentPeriodId] || [];
  const getCurrentTotalExpense = () => getCurrentExpenses().reduce((a, b) => a + (Number(b) || 0), 0);
  const isCurrentUnsaved = () => !!unsavedByPeriod[currentPeriodId];

  const setCurrentExpenses = (expenses) => {
    setExtraExpensesByPeriod((prev) => ({ ...prev, [currentPeriodId]: expenses }));
  };

  const setCurrentUnsaved = (val) => {
    setUnsavedByPeriod((prev) => ({ ...prev, [currentPeriodId]: !!val }));
  };

  // Chuẩn hoá periodKey theo type (đảm bảo quarter có năm)
  const buildPeriodKey = (type, dateObj) => {
    if (!dateObj) return "";
    if (type === "month") return dateObj.format("YYYY-MM");
    if (type === "quarter") {
      const q = Math.floor(dateObj.month() / 3) + 1;
      return `${dateObj.year()}-Q${q}`; // ✅ có năm
    }
    if (type === "year") return dateObj.year().toString();
    return "";
  };

  // Parse quarterKey "2025-Q4" -> {year:2025, quarter:4}
  const parseQuarterKey = (qKey) => {
    const m = String(qKey).match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    return { year: Number(m[1]), quarter: Number(m[2]) };
  };

  // Allocate quarter expense -> 3 months in the same year-quarter
  const allocateQuarterToMonths = ({ storeId, quarterPeriodKey, totalExpense }) => {
    const parsed = parseQuarterKey(quarterPeriodKey);
    if (!parsed) return;

    const { year, quarter } = parsed;
    const startMonth = (quarter - 1) * 3 + 1; // 1,4,7,10

    // chia đều nhưng giữ đúng tổng
    const m1 = Math.floor(totalExpense / 3);
    const m2 = Math.floor(totalExpense / 3);
    const m3 = totalExpense - m1 - m2;

    setExtraExpensesByPeriod((prev) => {
      const next = { ...prev };
      const makeMonthId = (month) => getPeriodId(storeId, "month", `${year}-${String(month).padStart(2, "0")}`);

      next[makeMonthId(startMonth)] = m1 > 0 ? [m1] : [];
      next[makeMonthId(startMonth + 1)] = m2 > 0 ? [m2] : [];
      next[makeMonthId(startMonth + 2)] = m3 > 0 ? [m3] : [];
      return next;
    });

    setUnsavedByPeriod((prev) => {
      const next = { ...prev };
      const makeMonthId = (month) => getPeriodId(storeId, "month", `${year}-${String(month).padStart(2, "0")}`);
      next[makeMonthId(startMonth)] = true;
      next[makeMonthId(startMonth + 1)] = true;
      next[makeMonthId(startMonth + 2)] = true;
      return next;
    });
  };

  // ⚠️ Handle đổi PeriodType
  // ====== CORE: CHANGE PERIOD TYPE / KEY WITH CONFIRM ======
  const commitChangePeriodType = (newType) => {
    setPeriodType(newType);
    setPeriodKey("");
    setPickerValue(null);
    setData(null);
  };

  const handlePeriodTypeChange = (newType) => {
    if (newType === periodType) return;

    const totalCost = getCurrentTotalExpense();
    if (isCurrentUnsaved() && totalCost > 0) {

      // quarter -> month special flow
      if (periodType === "quarter" && newType === "month") {
        Swal.fire({
          title: "Chuyển từ Quý sang Tháng",
          html: `
            <div style="text-align: center; font-size: 14px;">
              <p>Chi phí chưa lưu của quý hiện tại:</p>
              <p style="font-size: 18px; font-weight: bold; color: #722ed1; margin: 12px 0;">
                ${totalCost.toLocaleString("vi-VN")} VND
              </p>
              <p style="margin-top: 12px;">Bạn muốn phân bổ xuống 3 tháng trong quý không?</p>
            </div>
          `,
          icon: "question",
          confirmButtonText: "Phân bổ",
          cancelButtonText: "Bỏ qua",
          showCancelButton: true,
          confirmButtonColor: "#52c41a",
          cancelButtonColor: "#d9534f",
        }).then((result) => {
          if (result.isConfirmed) {
            // phân bổ dựa trên quarter periodKey hiện tại (vd 2025-Q4)
            allocateQuarterToMonths({ storeId: currentStore?._id, quarterPeriodKey: periodKey, totalExpense: totalCost });
            // bỏ dirty của quý hiện tại vì đã chuyển thành dữ liệu tháng
            setCurrentUnsaved(false);
            commitChangePeriodType(newType);
          } else {
            // bỏ thay đổi quý (dirty) và chuyển type
            setCurrentUnsaved(false);
            commitChangePeriodType(newType);
          }
        });
        return;
      }

      // other type change: warn discard
      Swal.fire({
        title: "⚠️ Chi phí chưa lưu",
        html: `
          <div style="text-align: center; font-size: 14px;">
            <p>Kỳ hiện tại có chi phí chưa lưu:</p>
            <p style="font-size: 18px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
              ${totalCost.toLocaleString("vi-VN")} VND
            </p>
            <p style="margin-top: 12px; color: #ff4d4f;">Nếu tiếp tục đổi loại kỳ, thay đổi sẽ bị bỏ.</p>
          </div>
        `,
        icon: "warning",
        confirmButtonText: "Tiếp tục",
        cancelButtonText: "Hủy",
        showCancelButton: true,
        confirmButtonColor: "#ff7a45",
        cancelButtonColor: "#1890ff",
      }).then((result) => {
        if (result.isConfirmed) {
          setCurrentUnsaved(false);
          commitChangePeriodType(newType);
        }
      });
      return;
    }

    commitChangePeriodType(newType);
  };

  // ⚠️ Handle đổi PeriodKey (trong cùng loại)
  const commitChangePeriodKey = (newKey, dateObj) => {
    setPeriodKey(newKey);
    setPickerValue(dateObj);
    setData(null);
  };

  const handlePeriodKeyChange = (dateObj) => {
    if (!dateObj) return;

    const newKey = buildPeriodKey(periodType, dateObj);
    if (!newKey || newKey === periodKey) return;

    const totalCost = getCurrentTotalExpense();
    if (isCurrentUnsaved() && totalCost > 0) {

      Swal.fire({
        title: "⚠️ Chi phí chưa lưu",
        html: `
          <div style="text-align: center; font-size: 14px;">
            <p>Kỳ hiện tại có chi phí chưa lưu:</p>
            <p style="font-size: 18px; font-weight: bold; color: #ff7a45; margin: 12px 0;">
              ${totalCost.toLocaleString("vi-VN")} VND
            </p>
            <p style="margin-top: 12px; color: #ff4d4f;">Nếu chuyển sang kỳ khác, thay đổi sẽ bị bỏ.</p>
          </div>
        `,
        icon: "warning",
        confirmButtonText: "Tiếp tục",
        cancelButtonText: "Quay lại",
        showCancelButton: true,
        confirmButtonColor: "#ff7a45",
        cancelButtonColor: "#1890ff",
      }).then((result) => {
        if (result.isConfirmed) {
          setCurrentUnsaved(false);
          commitChangePeriodKey(newKey, dateObj);
        }
      });
      return;
    }

    commitChangePeriodKey(newKey, dateObj);
  };

  const generateBarData = () => {
    if (!data) return [];
    return [
      { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
      { name: "Lợi nhuận gộp", value: data.grossProfit, fill: COLORS.grossProfit },
      { name: "Chi phí vận hành", value: data.operatingCost, fill: COLORS.operatingCost },
      { name: "Lợi nhuận ròng", value: data.netProfit, fill: COLORS.netProfit },
    ];
  };

  // ====== API ======
  const fetchFinancial = async () => {
    if (!currentStore?._id) {
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

      const expenses = getCurrentExpenses();
      if (expenses.length > 0) params.append("extraExpense", expenses.join(","));

      const url = `${apiUrl}/financials?${params.toString()}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 });

      setData(res.data.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setError(`Lỗi: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Gọi lại khi filter đổi hoặc khi chi phí của kỳ hiện tại đổi
  useEffect(() => {
    fetchFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType, periodKey, currentPeriodId, extraExpensesByPeriod[currentPeriodId]?.length]);

  // "Save" theo cách A: chỉ đánh dấu đã lưu tạm (không ghi DB)
  const saveExpenses = () => {
    setCurrentUnsaved(false);
    Swal.fire({
      icon: "success",
      title: "Đã lưu tạm chi phí",
      text: `Chi phí kỳ này: ${getCurrentTotalExpense().toLocaleString("vi-VN")} VND`,
      timer: 1200,
      showConfirmButton: false,
    });
    fetchFinancial();
  };

  // TỰ ĐỘNG GỌI KHI THAY ĐỔI FILTER
  useEffect(() => {
    fetchFinancial();
  }, [periodType, periodKey, extraExpensesByPeriod]);

  // XỬ LÝ THAY ĐỔI TYPE
  const handleTypeChange = (value) => {
    handlePeriodTypeChange(value);
  };

  // XỬ LÝ KỲ (KEY)
  const handlePeriodChange = (date) => {
    if (!date) return;
    let key = "";
    if (periodType === "month") {
      key = date.format("YYYY-MM");
    } else if (periodType === "quarter") {
      const q = Math.floor(date.month() / 3) + 1;
      key = `Q${q}`;
    } else if (periodType === "year") {
      key = date.year().toString();
    }
    handlePeriodKeyChange(key);
    setPickerValue(date);
  };

  // CHI PHÍ NGOÀI LỀ (tự nhập thêm nếu cần)
  // ====== ACTIONS: ADD/REMOVE/SAVE ======
  const addExtraExpense = () => {
    if (newExpense === "" || newExpense === null || newExpense === undefined) return;
    const val = Number(newExpense);
    if (Number.isNaN(val) || val < 0) return;

    const next = [...getCurrentExpenses(), val];
    setCurrentExpenses(next);
    setNewExpense("");
    // Chỉ đánh dấu unsaved nếu tổng > 0
    const total = next.reduce((a, b) => a + (Number(b) || 0), 0);
    if (total > 0) setCurrentUnsaved(true);
  };

  const removeExpense = (index) => {
    const next = getCurrentExpenses().filter((_, i) => i !== index);
    setCurrentExpenses(next);
    // Nếu xóa hết hoặc tổng = 0 → reset unsaved
    const total = next.reduce((a, b) => a + (Number(b) || 0), 0);
    if (total > 0) {
      setCurrentUnsaved(true);
    } else {
      setCurrentUnsaved(false);
    }
  };

  return (
    <Layout>
      <div className="premium-layout">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* HEADER & FILTERS */}
          <Card className="glass-card">
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} lg={6}>
                <Title level={2} className="premium-title" style={{ margin: 0 }}>
                  {currentStore.name}
                </Title>
                <Text type="secondary" style={{ fontSize: "14px" }}>
                  Phân tích kinh doanh & Tài chính
                </Text>
              </Col>

              <Col xs={12} lg={4}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>Kỳ báo cáo</Text>
                <Select
                  style={{ width: "100%" }}
                  size="large"
                  value={periodType}
                  onChange={handlePeriodTypeChange}
                  placeholder="Chọn kỳ"
                >
                  <Select.Option value="month">Theo tháng</Select.Option>
                  <Select.Option value="quarter">Theo quý</Select.Option>
                  <Select.Option value="year">Theo năm</Select.Option>
                </Select>
              </Col>

              <Col xs={12} lg={4}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>Chọn kỳ cụ thể</Text>
                {!periodType ? (
                  <Button disabled size="large" style={{ width: "100%" }}>Chọn kỳ trước</Button>
                ) : (
                  <DatePicker
                    style={{ width: "100%" }}
                    size="large"
                    picker={periodType === "month" ? "month" : periodType === "year" ? "year" : "quarter"}
                    value={pickerValue}
                    onChange={handlePeriodKeyChange}
                    format={(value) => {
                      if (periodType === "quarter") return `Quý ${value.quarter()} - ${value.year()}`;
                      if (periodType === "month") return `Tháng ${value.format("MM/YYYY")}`;
                      return `Năm ${value.format("YYYY")}`;
                    }}
                    placeholder={`Chọn ${periodType === "month" ? "tháng" : periodType === "quarter" ? "quý" : "năm"}`}
                  />
                )}
              </Col>

              <Col xs={24} lg={10}>
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Chi phí ngoài hệ thống (Điện, nước, mặt bằng...)
                </Text>
                <Space.Compact style={{ width: "100%" }}>
                  <InputNumber
                    size="large"
                    min={0}
                    value={newExpense}
                    onChange={setNewExpense}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(v) => v.replace(/\$\s?|(,*)/g, "")}
                    style={{ flex: 1 }}
                    placeholder="Nhập chi phí (VND)"
                  />
                  <Button type="primary" size="large" onClick={addExtraExpense} icon={<PlusOutlined />}>
                    Thêm
                  </Button>
                  <Button
                    size="large"
                    type={isCurrentUnsaved() && getCurrentExpenses().length > 0 ? "primary" : "default"}
                    danger={isCurrentUnsaved() && getCurrentExpenses().length > 0}
                    onClick={saveExpenses}
                    disabled={!isCurrentUnsaved() || getCurrentExpenses().length === 0}
                  >
                    {isCurrentUnsaved() && getCurrentExpenses().length > 0 ? "Lưu" : <CheckCircleOutlined />}
                  </Button>
                </Space.Compact>
                
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {getCurrentExpenses().map((exp, i) => (
                    <Tag key={i} closable onClose={() => removeExpense(i)} className="premium-tag" color="processing">
                      {formatVND(exp)}
                    </Tag>
                  ))}
                </div>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang tải..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {(!periodType || !periodKey) && !loading && (
            <Alert message="Vui lòng chọn kỳ báo cáo để xem dữ liệu." type="info" showIcon closable style={{ marginBottom: 16, height: 80 }} />
          )}

          {!loading && data && (
            <>
              {/* CHỈ SỐ */}
              <Row gutter={[20, 20]}>
                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner gradient-info">
                    <Statistic
                      title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Doanh thu</span>}
                      value={data.totalRevenue}
                      formatter={formatVND}
                      valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '24px' }}
                      prefix={<DollarOutlined />}
                    />
                  </div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner gradient-success">
                    <Statistic
                      title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Lợi nhuận gộp</span>}
                      value={data.grossProfit}
                      formatter={formatVND}
                      valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '24px' }}
                      prefix={<DollarOutlined />}
                    />
                  </div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner gradient-warning">
                    <AntTooltip title="Bao gồm: Lương nhân viên, Hoa hồng & Chi phí ngoài hệ thống">
                      <Statistic
                        title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Chi phí vận hành</span>}
                        value={data.operatingCost}
                        formatter={formatVND}
                        valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '24px' }}
                        prefix={<DollarOutlined />}
                      />
                    </AntTooltip>
                  </div>
                </Col>

                <Col xs={24} sm={12} lg={6}>
                  <div className="stat-card-inner gradient-primary">
                    <Statistic
                      title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Lợi nhuận ròng</span>}
                      value={data.netProfit}
                      formatter={formatVND}
                      valueStyle={{ color: '#fff', fontWeight: 800, fontSize: '24px' }}
                      prefix={<DollarOutlined />}
                    />
                  </div>
                </Col>
              </Row>

              {/* BIỂU ĐỒ & PHÂN TÍCH */}
              <Row gutter={[20, 20]}>
                <Col xs={24} lg={16}>
                  <Card className="glass-card" title={<Title level={4}>Cơ cấu tài chính tổng quan</Title>}>
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={generateBarData()}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fff" stopOpacity={0.2} />
                            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>{payload[0].payload.name}</div>
                                  <div style={{ fontWeight: 700, fontSize: '16px', color: payload[0].payload.fill }}>{formatVND(payload[0].value)}</div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[8, 8, 0, 0]} 
                          barSize={50}
                        >
                          {generateBarData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card className="glass-card" title={<Title level={4}>Hàng tồn kho</Title>}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
                            { name: "Hàng tồn kho", value: data.stockValue, fill: COLORS.stockValue },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill={COLORS.revenue} />
                          <Cell fill={COLORS.stockValue} />
                        </Pie>
                        <Tooltip formatter={formatVND} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text strong color="primary">Tỷ lệ Tồn/Doanh thu</Text>
                        <Tag color={data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5 ? "green" : "orange"} className="premium-tag">
                          {data.totalRevenue > 0 ? ((data.stockValue / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </Tag>
                      </div>
                      <Alert 
                        message={
                          data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5 
                            ? "Sức khỏe kho hàng: Tốt" 
                            : "Cần tối ưu vòng quay hàng tồn"
                        }
                        type={data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5 ? "success" : "warning"}
                        showIcon
                      />
                    </div>
                  </Card>
                </Col>
              </Row>



              {/* THỐNG KÊ NHÓM HÀNG */}
              <Card className="glass-card" title={<Title level={4}>Phân tích hiệu quả theo nhóm hàng</Title>}>
                <Table
                  dataSource={data.groupStats || []}
                  rowKey="_id"
                  className="premium-table"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    {
                      title: "Nhóm hàng",
                      dataIndex: "groupName",
                      render: (text) => <Text strong style={{ fontSize: '15px' }}>{text}</Text>,
                    },
                    {
                      title: "Doanh thu",
                      dataIndex: "revenue",
                      align: "right",
                      render: (val) => <Text strong color="primary">{formatVND(val)}</Text>,
                      sorter: (a, b) => a.revenue - b.revenue,
                    },
                    {
                      title: "Số lượng bán",
                      dataIndex: "quantitySold",
                      align: "center",
                      render: (val) => <Badge count={val} color="#6366f1" />,
                    },
                    {
                      title: "Tồn kho (Giá vốn)",
                      dataIndex: "stockValueCost",
                      align: "right",
                      render: (val) => formatVND(val),
                    },
                    {
                      title: "Tỷ lệ quay vòng",
                      dataIndex: "stockToRevenueRatio",
                      align: "center",
                      render: (val, record) => {
                        if (record.revenue === 0) return <Tag color="default">Chưa bán</Tag>;
                        if (val > 2) return <Tag color="error" className="premium-tag">Tồn cao</Tag>;
                        return <Tag color="success" className="premium-tag">Ổn định</Tag>;
                      }
                    }
                  ]}
                />
              </Card>


              {/* ======= Hết ====== */}
            </>
          )}
        </Space>
      </div>
    </Layout>
  );
};

export default ReportDashboard;
