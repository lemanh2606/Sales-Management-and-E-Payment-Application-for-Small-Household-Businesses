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
} from "antd";
import { InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import dayjs from "dayjs";
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

  // Biểu đồ
  const generateBarData = () => {
    if (!data) return [];
    return [
      { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.revenue },
      { name: "Lợi nhuận gộp", value: data.grossProfit, fill: COLORS.grossProfit },
      { name: "Chi phí vận hành", value: data.operatingCost, fill: COLORS.operatingCost },
      { name: "VAT", value: data.totalVAT, fill: COLORS.totalVAT },
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
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {/* HEADER */}
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Title level={2} style={{ margin: 0, color: "#1890ff", lineHeight: 1.2 }}>
                  {currentStore.name}
                </Title>
                <Text type="secondary" style={{ color: "#595959", fontSize: "16px", display: "block", marginTop: 4 }}>
                  Báo cáo tổng quan
                </Text>
              </Col>

              <Col span={5}>
                <label>Kỳ báo cáo:</label>
                <Select style={{ width: "100%", marginTop: 8 }} value={periodType} onChange={handlePeriodTypeChange}>
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
                    picker={periodType === "month" ? "month" : periodType === "year" ? "year" : "quarter"}
                    value={pickerValue}
                    onChange={handlePeriodKeyChange}
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
                        shortMonths: ["Th 1", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "Th 8", "Th 9", "Th 10", "Th 11", "Th 12"],
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
                <label>Chi phí ngoài: </label>
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

                  {/* 🆕 Nút Lưu chi phí */}
                  <Button
                    type={isCurrentUnsaved() && getCurrentExpenses().length > 0 ? "primary" : "default"}
                    danger={isCurrentUnsaved() && getCurrentExpenses().length > 0}
                    onClick={saveExpenses}
                    disabled={!isCurrentUnsaved() || getCurrentExpenses().length === 0}
                  >
                    {isCurrentUnsaved() && getCurrentExpenses().length > 0 ? "Lưu chi phí" : "Đã lưu"}
                  </Button>
                </Space>

                {/* 🆕 Alert cảnh báo chưa lưu - chỉ hiện khi có chi phí thực tế */}
                {isCurrentUnsaved() && getCurrentExpenses().length > 0 && (
                  <Alert type="warning" showIcon message={`Có ${getCurrentExpenses().length} chi phí chưa lưu cho kỳ này`} />
                )}

                <div style={{ marginTop: 8 }}>
                  {getCurrentExpenses().map((exp, i) => (
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
            <Alert message="Vui lòng chọn kỳ báo cáo để xem dữ liệu." type="info" showIcon closable style={{ marginBottom: 16, height: 80 }} />
          )}

          {!loading && data && (
            <>
              {/* CHỈ SỐ */}
              <Row gutter={[16, 16]}>
                {/* Doanh thu */}
                <Col flex="1 1 20%">
                  <AntTooltip title="Doanh thu là tổng số tiền thu được từ việc bán hàng (chưa trừ chi phí).">
                    <Card style={{ border: "1px solid #8c8c8c", cursor: "pointer" }}>
                      <Statistic
                        title={
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "black" }}>Doanh thu</span>
                            <InfoCircleOutlined style={{ color: "#178fff" }} />
                          </span>
                        }
                        value={data.totalRevenue}
                        formatter={formatVND}
                        valueStyle={{ color: COLORS.revenue }}
                      />
                    </Card>
                  </AntTooltip>
                </Col>

                {/* Lợi nhuận gộp */}
                <Col flex="1 1 20%">
                  <AntTooltip title="Lợi nhuận gộp = Doanh thu − Chi phí nhập hàng (COGS).">
                    <Card style={{ border: "1px solid #8c8c8c", cursor: "pointer" }}>
                      <Statistic
                        title={
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "black" }}>Lợi nhuận gộp</span>
                            <InfoCircleOutlined style={{ color: "#178fff" }} />
                          </span>
                        }
                        value={data.grossProfit}
                        formatter={formatVND}
                        valueStyle={{ color: COLORS.grossProfit }}
                      />
                    </Card>
                  </AntTooltip>
                </Col>

                {/* Chi phí vận hành - chỉ tính chi phí ngoài (UPDATED Dec 2025) */}
                <Col flex="1 1 20%">
                  <AntTooltip title="Chi phí vận hành = Chi phí ngoài lệ được nhập tay ở ô 'Chi phí ngoài' bên trên. (Nếu có)">
                    <Card style={{ border: "1px solid #8c8c8c", cursor: "pointer" }}>
                      <Statistic
                        title={
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "black" }}>Chi phí vận hành</span>
                            <InfoCircleOutlined style={{ color: "#178fff" }} />
                          </span>
                        }
                        value={data.operatingCost}
                        formatter={formatVND}
                        valueStyle={{ color: COLORS.operatingCost }}
                      />
                    </Card>
                  </AntTooltip>
                </Col>

                {/* VAT */}
                <Col flex="1 1 20%">
                  <AntTooltip title="Tổng số tiền thuế giá trị gia tăng (VAT) đã thu từ các đơn hàng trong kỳ báo cáo.">
                    <Card style={{ border: "1px solid #8c8c8c", cursor: "pointer" }}>
                      <Statistic
                        title={
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "black" }}>VAT</span>
                            <InfoCircleOutlined style={{ color: "#178fff" }} />
                          </span>
                        }
                        value={data.totalVAT}
                        formatter={formatVND}
                        valueStyle={{ color: "#fa8c16" }}
                      />
                    </Card>
                  </AntTooltip>
                </Col>

                {/* Lợi nhuận ròng */}
                <Col flex="1 1 20%">
                  <AntTooltip title="Lợi nhuận ròng = Lợi nhuận gộp − Chi phí vận hành − Thuế VAT. Đây là số tiền thật sự bạn kiếm được.">
                    <Card style={{ border: "1px solid #8c8c8c", cursor: "pointer" }}>
                      <Statistic
                        title={
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: "black" }}>Lợi nhuận ròng</span>
                            <InfoCircleOutlined style={{ color: "#178fff" }} />
                          </span>
                        }
                        value={data.netProfit}
                        formatter={formatVND}
                        valueStyle={{ color: data.netProfit > 0 ? COLORS.netProfit : "#f5222d" }}
                      />
                    </Card>
                  </AntTooltip>
                </Col>
              </Row>

              {/* BIỂU ĐỒ CỘT */}
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

              {/* ========== 2 Biểu đồ tròn ========== */}
              <Row gutter={[16, 16]}>
                {/* BIỂU ĐỒ TRÒN BÊN TRÁI */}
                <Col xs={24} lg={12}>
                  <Card style={{ border: "1px solid #8c8c8c" }} title="Doanh thu & Giá trị hàng tồn kho">
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Doanh thu", value: data.totalRevenue, fill: COLORS.totalRevenue },
                            { name: "Hàng tồn kho", value: data.stockValue, fill: COLORS.stockValue },
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
                    {/* BOX Ở GIỮA – TỶ LỆ HÀNG TỒN VỚI DOANH THU */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: "16px 20px",
                        background: "linear-gradient(120deg, #e6f7ff 0%, #bae7ff 100%)",
                        borderRadius: 12,
                        border: "2px dashed #1890ff",
                        textAlign: "center",
                      }}
                    >
                      <Text strong style={{ fontSize: 14, color: "#1890ff", display: "block" }}>
                        Tỷ lệ hàng tồn so với doanh thu
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "bold",
                          color: "#1890ff",
                          textShadow: "0 2px 4px rgba(24, 144, 255, 0.3)",
                        }}
                      >
                        {data.totalRevenue > 0 ? ((data.stockValue / data.totalRevenue) * 100).toFixed(1) : 0}%
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color="blue" style={{ fontSize: 14, padding: "4px 12px" }}>
                          {data.totalRevenue > 0 && data.stockValue / data.totalRevenue < 0.5
                            ? "Tốt – Hàng hóa luân chuyển nhanh"
                            : data.stockValue / data.totalRevenue < 1
                            ? "Bình thường – Cần theo dõi"
                            : "Cảnh báo – Hàng tồn quá nhiều"}
                        </Tag>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
                      <div>
                        <span style={{ color: COLORS.vat, marginRight: 4 }}>●</span>
                        <strong style={{ color: COLORS.vat }}>Doanh thu:</strong> {formatVND(data.totalRevenue)}
                        <Tag color="#f5222d" style={{ fontSize: 14, lineHeight: 1.2, marginLeft: 8, padding: "2px 10px" }}>
                          Tổng số tiền thu được từ việc bán hàng
                        </Tag>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <span style={{ color: COLORS.stockValue }}>●</span>
                        <strong style={{ color: COLORS.stockValue }}>Hàng tồn kho:</strong>
                        <span>{formatVND(data.stockValue)}</span>
                        <Tag color="#13c2c2" style={{ fontSize: 14, lineHeight: 1.2, marginLeft: 8, padding: "2px 10px" }}>
                          Tổng số lượng hàng tồn × Giá vốn nhập hàng
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>

                {/* BIỂU ĐỒ TRÒN BÊN PHẢI */}
                <Col xs={24} lg={12}>
                  <Card title="Giá trị hàng tồn kho: Giá vốn & Giá bán" style={{ border: "1px solid #8c8c8c" }}>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Tồn kho (giá vốn)", value: data.stockValue, fill: COLORS.stockValue },
                            { name: "Tồn kho (giá bán)", value: data.stockValueAtSalePrice, fill: COLORS.stockValueAtSalePrice },
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
                          <Cell fill={COLORS.stockValue} />
                          <Cell fill={COLORS.stockValueAtSalePrice} />
                        </Pie>
                        <Tooltip formatter={formatVND} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* LÃI TIỀM NĂNG – BOX Ở GIỮA */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: "16px 20px",
                        background: "linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)",
                        borderRadius: 12,
                        border: "2px dashed #52c41a",
                        textAlign: "center",
                      }}
                    >
                      <Text strong style={{ fontSize: 14, color: "#52c41a", display: "block" }}>
                        Lãi tiềm năng nếu bán hết hàng tồn kho
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "bold",
                          color: "#52c41a",
                          textShadow: "0 2px 4px rgba(82, 196, 26, 0.3)",
                        }}
                      >
                        {formatVND(data.stockValueAtSalePrice - data.stockValue)}
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color="green" style={{ fontSize: 14, padding: "4px 12px" }}>
                          {data.stockValue > 0 ? (((data.stockValueAtSalePrice - data.stockValue) / data.stockValue) * 100).toFixed(1) : 0}% biên lợi
                          nhuận gộp trung bình
                        </Tag>
                      </div>
                    </div>
                    {/* Hiển thị chi tiết giá trị */}
                    <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: COLORS.stockValue }}>●</span>
                        <strong style={{ color: COLORS.stockValue }}>Hàng tồn kho (giá vốn):</strong>
                        <span>{formatVND(data.stockValue)}</span>
                        <Tag color="#13c2c2" style={{ fontSize: 14, lineHeight: 1.2, marginLeft: 8, padding: "2px 10px" }}>
                          Tổng số lượng hàng tồn × Giá vốn nhập hàng
                        </Tag>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <span style={{ color: COLORS.stockValueAtSalePrice }}>●</span>
                        <strong style={{ color: COLORS.stockValueAtSalePrice }}>Hàng tồn kho (giá bán):</strong>
                        <span>{formatVND(data.stockValueAtSalePrice)}</span>
                        <Tag color="#e90c77ff" style={{ fontSize: 14, lineHeight: 1.2, marginLeft: 8, padding: "2px 10px" }}>
                          Tổng số lượng hàng tồn × Giá bán thị trường
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* TOP NHÓM HÀNG HÓA */}
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="Thống Kê Nhóm Hàng Hóa Theo Doanh Thu" style={{ border: "1px solid #8c8c8c" }}>
                    <Table
                      dataSource={data.groupStats || []}
                      rowKey="_id"
                      pagination={{
                        ...groupPagination,
                        total: data.groupStats?.length || 0,
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
                              trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhóm hàng hóa
                            </div>
                          </div>
                        ),
                        onChange: (page, pageSize) => {
                          setGroupPagination({
                            current: page,
                            pageSize: pageSize || 10,
                            total: data.groupStats?.length || 0,
                          });
                        },
                      }}
                      columns={[
                        {
                          title: "Nhóm hàng hoá",
                          dataIndex: "groupName",
                          render: (text) => <strong style={{ fontSize: 15 }}>{text}</strong>,
                        },
                        {
                          title: "Doanh thu",
                          dataIndex: "revenue",
                          align: "right",
                          render: (value) => (
                            <Text strong style={{ color: "#1890ff" }}>
                              {formatVND(value)}
                            </Text>
                          ),
                          sorter: (a, b) => a.revenue - b.revenue,
                        },
                        {
                          title: "SL bán",
                          dataIndex: "quantitySold",
                          align: "center",
                          render: (value) => <Tag color="blue">{value}</Tag>,
                        },
                        {
                          title: "Tồn kho (giá bán)",
                          dataIndex: "stockValueSale",
                          align: "right",
                          render: (value) => formatVND(value),
                        },
                        {
                          title: "Tồn kho (giá vốn)",
                          dataIndex: "stockValueCost",
                          align: "right",
                          render: (value) => (
                            <Text strong style={{ color: value > 1000000000 ? "#ff4d4f" : "#fa8c16" }}>
                              {formatVND(value)}
                            </Text>
                          ),
                        },
                        {
                          title: "Số mặt hàng",
                          dataIndex: "productCount",
                          align: "center",
                          render: (value) => <Tag color="purple">{value}</Tag>,
                          sorter: (a, b) => a.productCount - b.productCount,
                        },
                        {
                          title: "Lãi tiềm năng",
                          dataIndex: "potentialProfit",
                          align: "right",
                          render: (value) => (
                            <Text strong style={{ color: value > 200000000 ? "#52c41a" : "#faad14" }}>
                              {formatVND(value)}
                            </Text>
                          ),
                        },
                        {
                          title: "Tỷ lệ tồn/doanh thu",
                          dataIndex: "stockToRevenueRatio",
                          align: "center",
                          render: (value, record) => {
                            // Nếu doanh thu = 0 → nhóm hàng hoá này chưa bán gì hoặc chưa có sản phẩm gì
                            if (record.revenue === 0) {
                              return (
                                <Tag
                                  icon={<ClockCircleOutlined />}
                                  color="default"
                                  style={{ background: "#f5f5f5", borderColor: "#d9d9d9", color: "#8c8c8c" }}
                                >
                                  Chưa sử dụng
                                </Tag>
                              );
                            }
                            // Nếu có doanh thu → đánh giá như thường
                            if (value > 5)
                              return (
                                <Tag icon={<ExclamationCircleOutlined />} color="red">
                                  TỒN NẶNG
                                </Tag>
                              );
                            if (value > 2)
                              return (
                                <Tag icon={<ExclamationCircleOutlined />} color="orange">
                                  CẦN ĐẨY HÀNG
                                </Tag>
                              );
                            if (value > 1)
                              return (
                                <Tag icon={<WarningOutlined />} color="warning">
                                  {" "}
                                  Cần theo dõi
                                </Tag>
                              );
                            return (
                              <Tag icon={<CheckCircleOutlined />} color="green">
                                TỐT
                              </Tag>
                            );
                          },
                        },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>

              {/* 2 THẺ CARD CHI TIẾT Ở CUỐI */}
              <Row gutter={[16, 16]}>
                {/* CỘT TRÁI */}
                <Col span={24}>
                  <Card
                    title="Chi tiết tài chính"
                    style={{ border: "1px solid #8c8c8c", height: "100%" }}
                    extra={<Text type="secondary">Đơn vị: VND</Text>}
                  >
                    <Space direction="vertical" style={{ width: "100%", fontSize: 15 }}>
                      <div>
                        <strong>Chi phí nhập hàng (COGS):</strong> {formatVND(data.totalCOGS)}
                      </div>
                      <div>
                        <Popover content="Tổng giá trị tất cả phiếu xuất (OUT) trong kỳ - bao gồm bán hàng + hao hụt">
                          <strong style={{ cursor: "help" }}>
                            Tổng xuất kho <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />{" "}
                          </strong>
                        </Popover>
                        : {formatVND(data.totalOutValue)}
                      </div>
                      <div>
                        <Popover content="Hao hụt kho = Tổng xuất - COGS (bán hàng). Bao gồm: Hủy hàng, Thất thoát, Sai sót cân, v.v.">
                          <strong style={{ cursor: "help", color: data.inventoryLoss > 0 ? "#ff4d4f" : "#52c41a" }}>
                            Hao hụt kho <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />{" "}
                          </strong>
                        </Popover>
                        : <strong style={{ color: data.inventoryLoss > 0 ? "#ff4d4f" : "#52c41a" }}>{formatVND(data.inventoryLoss)}</strong>
                      </div>

                      <Divider style={{ margin: "5px 0" }} />

                      {/* Lãi tiềm năng từ tồn kho */}
                      <div>
                        <Popover content="Nếu bán hết hàng tồn kho theo giá bán hiện tại">
                          <strong style={{ cursor: "help", color: "#52c41a" }}>
                            Lãi tiềm năng từ tồn kho <InfoCircleOutlined />{" "}
                          </strong>
                        </Popover>
                        : <strong style={{ color: "#52c41a" }}>{formatVND(data.stockValueAtSalePrice - data.stockValue)}</strong>
                      </div>
                    </Space>
                  </Card>
                </Col>

                {/* CỘT PHẢI: HIỆU SUẤT */}
                {/* <Col span={12}>
                  <Card
                    title="Hiệu suất kinh doanh"
                    style={{ border: "1px solid #8c8c8c", height: "100%" }}
                    extra={<Text type="secondary">Đơn vị: %</Text>}
                  >
                    <Space direction="vertical" style={{ width: "100%", fontSize: 16 }}>
                      <div>
                        <Popover content="Lợi nhuận gộp = Doanh thu - Giá vốn hàng bán">
                          <strong style={{ cursor: "help" }}>
                            Lợi nhuận gộp <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />{" "}
                          </strong>
                        </Popover>
                        :{" "}
                        <strong style={{ color: getProfitColorByValue(data?.grossProfit) }}>
                          {data?.totalRevenue ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </strong>
                      </div>

                      <div>
                        <Popover content="Chi phí vận hành / doanh thu – càng thấp càng tốt">
                          <strong style={{ cursor: "help" }}>
                            Tỷ lệ chi phí vận hành <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />{" "}
                          </strong>
                        </Popover>
                        :{" "}
                        <strong
                          style={{
                            color: data?.operatingCost / data?.totalRevenue > 0.7 ? "#ff4d4f" : "#faad14",
                          }}
                        >
                          {data?.totalRevenue ? ((data.operatingCost / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </strong>
                      </div>

                      <div>
                        <Popover content="Tỷ lệ hàng tồn / doanh thu – nhỏ hơn 50% là tốt, lớn hơn 100% là tồn nặng">
                          <strong style={{ cursor: "help" }}>
                            Tỷ lệ hàng tồn / doanh thu <InfoCircleOutlined style={{ fontSize: 14, marginLeft: 4 }} />{" "}
                          </strong>
                        </Popover>
                        :{" "}
                        <strong
                          style={{
                            color:
                              data.stockValue / data.totalRevenue > 1 ? "#ff4d4f" : data.stockValue / data.totalRevenue > 0.5 ? "#faad14" : "#52c41a",
                          }}
                        >
                          {data?.totalRevenue ? ((data.stockValue / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </strong>
                      </div>

                      <Divider style={{ margin: "5px 0" }} />

                      {/* Lợi nhuận ròng — hiển thị như dòng bình thường */}
                      {/* <div>
                        <Popover content="Lợi nhuận ròng = Lợi nhuận gộp - Chi phí vận hành - Thuế">
                          <strong style={{ cursor: "help", fontSize: 16, color: "#ff1038ff" }}>
                            Lợi nhuận ròng cuối cùng <InfoCircleOutlined />{" "}
                          </strong>
                        </Popover>
                        :{" "}
                        <strong
                          style={{
                            color: getProfitColorByValue(data?.netProfit),
                            fontSize: 20,
                          }}
                        >
                          {data?.totalRevenue ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
                        </strong>
                      </div>
                    </Space>
                  </Card>
                </Col> */}
              </Row>
              {/* ======= Hết ====== */}
            </>
          )}
        </Space>
      </div>
    </Layout>
  );
};

export default ReportDashboard;
