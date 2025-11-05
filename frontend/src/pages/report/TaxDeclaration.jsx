// src/pages/report/TaxDeclaration.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Table,
  Form,
  Spin,
  Alert,
  Space,
  Modal,
  message,
  Dropdown,
  Menu,
  Statistic,
  Typography,
  Divider,
  Tooltip,
} from "antd";
import {
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import readVietnameseNumber from "read-vietnamese-number";
import Layout from "../../components/Layout";

dayjs.locale("vi");

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Paragraph, Text } = Typography;

const TaxDeclaration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [systemRevenue, setSystemRevenue] = useState(null);
  const [previewRevenue, setPreviewRevenue] = useState(null);
  const [declarations, setDeclarations] = useState([]);
  const [form] = Form.useForm(); //form ngoài (của hàm submit)
  const [modalForm] = Form.useForm(); //form trong modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [calculatedTax, setCalculatedTax] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // Lấy từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  // Filter
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [monthRange, setMonthRange] = useState([]);
  const [pickerValue, setPickerValue] = useState(null);

  // Format VND
  const formatVND = (value) => {
    if (!value) return "₫0";
    const num = typeof value === "object" ? value.$numberDecimal || value.toString() : value;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(num);
  };

  // GỌI API ĐỂ XEM PREVIEW
  const fetchPreview = async () => {
    if (!currentStore?._id || !periodType) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      let params = `shopId=${currentStore._id}&periodType=${periodType}`;

      if (periodType === "custom" && monthRange.length === 2) {
        params += `&monthFrom=${monthRange[0].format("YYYY-MM")}&monthTo=${monthRange[1].format("YYYY-MM")}`;
      } else if (periodType !== "custom" && periodKey) {
        params += `&periodKey=${periodKey}`;
      } else {
        throw new Error("Thiếu thông tin kỳ báo cáo");
      }

      const url = `http://localhost:9999/api/taxs/preview?${params}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      setSystemRevenue(res.data.systemRevenue);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải preview");
    } finally {
      setLoading(false);
    }
  };

  // GỌI API LIST
  const fetchDeclarations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/taxs?shopId=${currentStore._id}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setDeclarations(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải danh sách tờ khai");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (currentStore._id && token) fetchDeclarations();
  }, [currentStore._id]);

  const handleTypeChange = (value) => {
    setPeriodType(value);
    setPeriodKey("");
    setMonthRange([]);
    setPickerValue(null);
    setPreviewRevenue(null);
    form.resetFields();
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

  const handleMonthRangeChange = (dates) => {
    setMonthRange(dates || []);
  };

  // TÍNH TOÁN THUẾ
  const calculateTax = (values) => {
    const declared = Number(values.declaredRevenue) || 0;
    const gtgtRate = values.gtgtRate !== undefined && values.gtgtRate !== null ? Number(values.gtgtRate) : 1.0;
    const tncnRate = values.tncnRate !== undefined && values.tncnRate !== null ? Number(values.tncnRate) : 0.5;

    const gtgt = (declared * gtgtRate) / 100;
    const tncn = (declared * tncnRate) / 100;
    const total = gtgt + tncn;

    return { gtgt, tncn, total };
  };

  // TẠO/UPDATE – GỬI shopId QUA QUERY
  const handleSubmit = async (values) => {
    if (!editingId && !systemRevenue) {
      message.warning("Vui lòng preview doanh thu trước để tính toán");
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const baseUrl = "http://localhost:9999/api/taxs";
      let url = `${baseUrl}?shopId=${currentStore._id}`;
      let method = "post";

      if (editingId) {
        url = `${baseUrl}/${editingId}?shopId=${currentStore._id}`;
        method = "put";
      }

      const { gtgt, tncn, total } = calculateTax(values);

      const payload = {
        periodType,
        periodKey:
          periodType === "custom"
            ? `${monthRange[0].format("YYYY-MM")} đến ${monthRange[1].format("YYYY-MM")}`
            : periodKey,
        declaredRevenue: values.declaredRevenue,
        taxRates: { gtgt: values.gtgtRate, tncn: values.tncnRate },
        taxAmounts: { gtgt, tncn, total }, // tự tính
      };

      // ✅ Nếu custom, gửi kèm monthFrom & monthTo
      if (periodType === "custom" && monthRange.length === 2) {
        payload.monthFrom = monthRange[0].format("YYYY-MM");
        payload.monthTo = monthRange[1].format("YYYY-MM");
      }

      await axios[method](url, payload, { headers: { Authorization: `Bearer ${token}` } });
      message.success(editingId ? "Cập nhật thành công" : "Tạo tờ khai thành công");

      setModalVisible(false);
      form.resetFields();
      setEditingId(null);
      setSystemRevenue(null);
      fetchDeclarations();
    } catch (err) {
      console.error("Lỗi POST/PUT:", err.response?.data);
      setError(err.response?.data?.message || "Lỗi lưu tờ khai");
    } finally {
      setLoading(false);
    }
  };

  // DÙNG DOANH THU HỆ THỐNG
  const useSystemRevenue = () => {
    form.setFieldsValue({ declaredRevenue: systemRevenue });
  };

  // EDIT
  const handleEdit = (id) => {
    const record = declarations.find((d) => d._id === id);
    if (!record) return;

    // 🧮 Tính lại tổng thuế dự kiến từ dữ liệu của record (nếu có)
    const declared = Number(record.declaredRevenue.$numberDecimal) || Number(record.declaredRevenue);
    const gtgtRate = record.taxRates.gtgt ?? 1.0;
    const tncnRate = record.taxRates.tncn ?? 0.5;

    const gtgt = (declared * gtgtRate) / 100;
    const tncn = (declared * tncnRate) / 100;
    const total = gtgt + tncn;

    // 🧹 Reset và gán lại cho modal form + calculatedTax đúng với tờ hiện tại
    setCalculatedTax({ gtgt, tncn, total });

    setEditingId(id);
    modalForm.setFieldsValue({
      declaredRevenue: declared,
      gtgtRate,
      tncnRate,
    });

    setModalVisible(true);
  };

  // CLONE
  const handleClone = async (id) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/taxs/${id}/clone`;
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Sao chép thành công");
      fetchDeclarations();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi sao chép");
    } finally {
      setLoading(false);
    }
  };

  // DELETE
  const handleDeleteClick = (id) => {
    setDeletingId(id);
    setConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/taxs/${deletingId}?shopId=${currentStore._id}`;
      await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
      message.success("Xóa thành công");
      fetchDeclarations();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi xóa");
    } finally {
      setLoading(false);
      setConfirmVisible(false);
      setDeletingId(null);
    }
  };

  // EXPORT
  const handleExport = async (id, format) => {
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/taxs/${id}/export?format=${format}&shopId=${currentStore._id}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = res.headers["content-disposition"]?.split("filename=")[1]?.replace(/"/g, "") || `tax.${format}`;
      link.click();
      // ✅ Gọi lại list để cập nhật UI đổi status
      await fetchDeclarations();

      message.success("Tải file thành công!");
    } catch (err) {
      message.error("Lỗi tải file!");
    }
  };

  const exportMenu = (id) => (
    <Menu>
      <Menu.Item key="csv" onClick={() => handleExport(id, "csv")}>
        <FileExcelOutlined /> CSV
      </Menu.Item>
      <Menu.Item key="pdf" onClick={() => handleExport(id, "pdf")}>
        <FilePdfOutlined /> PDF
      </Menu.Item>
    </Menu>
  );

  // TABLE COLUMNS
  const columns = [
    {
      title: "Kỳ",
      dataIndex: "periodKey",
      key: "periodKey",
      width: 150,
      sorter: (a, b) => a.periodKey.localeCompare(b.periodKey),
    },
    {
      title: "Loại kỳ",
      dataIndex: "periodType",
      key: "periodType",
      width: 100,
      render: (value) => {
        const map = {
          custom: "Tùy chỉnh",
          quarter: "Quý",
          month: "Tháng",
          year: "Năm",
        };
        return map[value] || value;
      },
    },
    {
      title: "Phiên bản",
      dataIndex: "version",
      key: "version",
      width: 100,
    },
    {
      title: "Doanh thu khai",
      dataIndex: "declaredRevenue",
      key: "declaredRevenue",
      render: (v) => formatVND(v?.$numberDecimal || v),
    },
    {
      title: "Thuế GTGT",
      dataIndex: ["taxAmounts", "gtgt"],
      key: "gtgt",
      render: (v) => formatVND(v?.$numberDecimal || v),
    },
    {
      title: "Thuế TNCN",
      dataIndex: ["taxAmounts", "tncn"],
      key: "tncn",
      render: (v) => formatVND(v?.$numberDecimal || v),
    },
    {
      title: "Tổng thuế",
      dataIndex: ["taxAmounts", "total"],
      key: "total",
      sorter: (a, b) => {
        const aVal = Number(a.taxAmounts.total?.$numberDecimal || a.taxAmounts.total || 0);
        const bVal = Number(b.taxAmounts.total?.$numberDecimal || b.taxAmounts.total || 0);
        return aVal - bVal;
      },
      render: (v) => formatVND(v?.$numberDecimal || v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => {
        const colorMap = { saved: "#05cf5dff", submitted: "#1890ff" };
        const textMap = { saved: "Đã lưu", submitted: "Đã nộp" };
        return (
          <Text strong style={{ color: colorMap[status] || "#000" }}>
            {textMap[status] || status}
          </Text>
        );
      },
    },
    {
      title: "Ngày lập",
      dataIndex: "createdAt",
      key: "createdAt",
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (t) => dayjs(t).format("DD/MM/YYYY"),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="Nhấn để chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record._id)} />
          </Tooltip>

          <Tooltip title="Nhấn để nhân bản tờ kê khai">
            <Button size="small" icon={<CopyOutlined />} onClick={() => handleClone(record._id)} />
          </Tooltip>

          <Tooltip title="Nhấn để xóa tờ khai này">
            <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDeleteClick(record._id)} />
          </Tooltip>

          <Tooltip title="Xuất file kê khai (PDF/CSV)">
            <Dropdown overlay={exportMenu(record._id)} trigger={["click"]}>
              <Button size="small" icon={<DownloadOutlined />} />
            </Dropdown>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card style={{ border: "1px solid #8c8c8c" }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <span style={{ color: "#1890ff", fontWeight: "bold", fontSize: "20px" }}>
                  {currentStore.name || "Đang tải..."}
                </span>
              </Col>
              <Col span={5}>
                <label>Kỳ kê khai:</label>
                <Select style={{ width: "100%", marginTop: 8 }} value={periodType} onChange={handleTypeChange}>
                  <Option value="">Chọn loại</Option>
                  <Option value="month">Theo tháng</Option>
                  <Option value="quarter">Theo quý</Option>
                  <Option value="year">Theo năm</Option>
                  <Option value="custom">Tùy chọn</Option>
                </Select>
              </Col>
              <Col span={5}>
                <label>Chọn kỳ:</label>
                {!periodType && <Alert message="Hãy chọn kỳ kê khai trước" type="warning" style={{ marginTop: 8 }} />}
                {periodType === "custom" ? (
                  <RangePicker
                    picker="month"
                    style={{ width: "100%", marginTop: 8 }}
                    onChange={handleMonthRangeChange}
                  />
                ) : (
                  periodType && (
                    <DatePicker
                      style={{ width: "100%", marginTop: 8 }}
                      picker={periodType}
                      value={pickerValue}
                      onChange={handlePeriodChange}
                      format={(v) =>
                        periodType === "quarter"
                          ? `Q${v.quarter()}/${v.year()}`
                          : v.format(periodType === "month" ? "MM/YYYY" : "YYYY")
                      }
                    />
                  )
                )}
              </Col>
              <Col span={8}>
                <Button
                  type="primary"
                  onClick={fetchPreview}
                  disabled={
                    !periodType ||
                    (periodType === "custom" && monthRange.length !== 2) ||
                    (periodType !== "custom" && !periodKey)
                  }
                  style={{ marginTop: 32 }}
                >
                  Xem trước doanh thu hệ thống
                </Button>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang xử lý..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {/* KÊ KHAI */}
          {systemRevenue !== null && (
            <Card title="Kê khai thuế" style={{ border: "1px solid #8c8c8c" }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title={
                      <span>
                        Doanh thu hệ thống (tham khảo)&nbsp;
                        <Tooltip title="Được tính dựa trên các giao dịch bán hàng có trạng thái đã thanh toán (bằng tất cả phương thức) và có in hoá đơn">
                          <InfoCircleOutlined style={{ fontSize: 14, color: "#1890ff" }} />
                        </Tooltip>
                      </span>
                    }
                    value={systemRevenue}
                    formatter={formatVND}
                  />
                </Col>
                <Col span={12} style={{ textAlign: "right", paddingTop: 32 }}>
                  <Button icon={<SyncOutlined />} onClick={useSystemRevenue}>
                    Dùng doanh thu hệ thống
                  </Button>
                </Col>
              </Row>

              <Form form={form} onFinish={handleSubmit} style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={10}>
                    <Form.Item name="declaredRevenue" label="Doanh thu khai báo" initialValue={systemRevenue}>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item name="gtgtRate" label="Thuế giá trị gia tăng (GTGT) (%)" initialValue={1.0}>
                      <InputNumber min={0} max={100} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={7}>
                    <Form.Item name="tncnRate" label="Thuế thu nhập cá nhân (TNCN) (%)" initialValue={0.5}>
                      <InputNumber min={0} max={100} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Tooltip title="Nhấp để xem hướng dẫn chi tiết">
                  <Button
                    icon={<InfoCircleOutlined />}
                    type="link"
                    onClick={() => setShowGuide(!showGuide)}
                    style={{ marginBottom: 20 }}
                  >
                    Giải thích thêm về thuế GTGT & TNCN
                  </Button>
                </Tooltip>

                {showGuide && (
                  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col span={24}>
                      <Card
                        bordered={false}
                        style={{
                          background: "#f7f5f5ff",
                          borderLeft: "4px solid #1890ff",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        }}
                      >
                        <Title level={5} style={{ color: "#1890ff" }}>
                          Hướng dẫn về thuế đối với hộ kinh doanh, cá nhân kinh doanh
                        </Title>

                        <Paragraph>
                          Căn cứ theo <Text strong>Luật Quản lý thuế 2019</Text>,
                          <Text strong>Thông tư 40/2021/TT-BTC</Text> và các văn bản sửa đổi bổ sung đến hiện tại, hộ
                          kinh doanh, cá nhân kinh doanh được xác định nghĩa vụ thuế dựa trên doanh thu thực tế.
                        </Paragraph>

                        <Divider />

                        <Paragraph>
                          <Text strong>1. Ngưỡng doanh thu miễn thuế:</Text>
                          Nếu doanh thu trong năm dương lịch từ <Text strong>100 triệu đồng/năm</Text> trở xuống thì
                          <Text strong> không phải nộp</Text> thuế Giá trị gia tăng (GTGT) và thuế Thu nhập cá nhân
                          (TNCN).
                        </Paragraph>

                        <Paragraph>
                          <Text strong>2. Doanh thu tính thuế:</Text> là tổng tiền bán hàng hóa, tiền cung ứng dịch vụ,
                          hoa hồng, phụ thu, phụ trội mà hộ kinh doanh được hưởng, không phân biệt đã thu được tiền hay
                          chưa.
                        </Paragraph>

                        <Paragraph>
                          <Text strong>3. Mức thuế theo phương pháp khoán (tỷ lệ trên doanh thu):</Text>
                        </Paragraph>

                        <ul style={{ marginLeft: 24, marginBottom: 16 }}>
                          <li>
                            <Text strong>Phân phối, cung cấp hàng hóa:</Text> GTGT <Text code>1%</Text> – TNCN{" "}
                            <Text code>0,5%</Text>
                          </li>
                          <li>
                            <Text strong>Dịch vụ, xây dựng không bao thầu nguyên vật liệu:</Text> GTGT{" "}
                            <Text code>5%</Text> – TNCN <Text code>2%</Text>
                          </li>
                          <li>
                            <Text strong>Sản xuất, vận tải, dịch vụ có gắn hàng hóa:</Text> GTGT <Text code>3%</Text> –
                            TNCN <Text code>1,5%</Text>
                          </li>
                          <li>
                            <Text strong>Hoạt động cho thuê tài sản (nhà, xe, máy móc...):</Text> GTGT{" "}
                            <Text code>5%</Text> – TNCN <Text code>5%</Text>
                          </li>
                          <li>
                            <Text strong>Ngành nghề khác:</Text> áp dụng theo tỷ lệ tương ứng do cơ quan thuế thông báo.
                          </li>
                        </ul>

                        <Divider />

                        <Paragraph>
                          <Text strong>4. Cách xác định kỳ kê khai thuế:</Text>
                          Hộ kinh doanh nộp thuế theo <Text underline>tháng, quý hoặc năm</Text> tùy quy mô và yêu cầu
                          của cơ quan thuế. Trường hợp hộ kinh doanh nộp thuế khoán thì chỉ cần kê khai định kỳ hàng
                          năm, trừ khi có thay đổi lớn về doanh thu.
                        </Paragraph>

                        <Paragraph>
                          <Text strong>5. Nghĩa vụ khác:</Text>
                          <ul style={{ marginLeft: 24 }}>
                            <li>Phải có sổ theo dõi doanh thu, hóa đơn (nếu có sử dụng).</li>
                            <li>Phải đăng ký mã số thuế cá nhân hoặc hộ kinh doanh.</li>
                            <li>Khi tạm ngừng kinh doanh trên 15 ngày phải thông báo với cơ quan thuế.</li>
                          </ul>
                        </Paragraph>

                        <Divider />

                        <Paragraph type="secondary">
                          <Text italic>
                            *Lưu ý:* Các mức tỷ lệ thuế có thể thay đổi theo quy định mới của Bộ Tài chính. Cơ quan thuế
                            sẽ căn cứ tình hình thực tế để ấn định hoặc điều chỉnh tỷ lệ thuế phù hợp.
                          </Text>
                        </Paragraph>
                      </Card>
                    </Col>
                  </Row>
                )}

                <Form.Item>
                  <Space>
                    <Button
                      type="default"
                      style={{
                        backgroundColor: "#faad14",
                        color: "#fff",
                        border: "none",
                      }}
                      onClick={() => {
                        const values = form.getFieldsValue();
                        const result = calculateTax(values);
                        setCalculatedTax(result);
                        message.success("Đã tính toán xong, bạn có thể tham khảo trước khi lưu");
                      }}
                    >
                      Tính toán
                    </Button>

                    <Button type="primary" onClick={() => form.submit()}>
                      Lưu
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
              <div
                style={{
                  marginTop: 24,
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "#d4380d",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span>
                  Tổng thuế phải nộp:{" "}
                  {calculatedTax ? `${Number(calculatedTax.total).toLocaleString("vi-VN")} đ` : "0 đ"}
                </span>

                {calculatedTax && (
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#8c8c8c",
                      fontStyle: "italic",
                    }}
                  >
                    (
                    {readVietnameseNumber(String(Math.round(calculatedTax.total)))
                      .replace("đơn vị", "")
                      .trim()}{" "}
                    đồng)
                  </span>
                )}
              </div>
            </Card>
          )}

          {/* LỊCH SỬ */}
          <Card title="Lịch sử kê khai thuế" style={{ border: "1px solid #8c8c8c" }}>
            <Table
              columns={columns}
              dataSource={declarations}
              rowKey="_id"
              pagination={{
                current: currentPage,
                pageSize,
                total: declarations.length,
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
                      trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> tờ khai
                    </div>
                    <div>{/* Pagination info của AntD sẽ hiển thị tự động bên phải */}</div>
                  </div>
                ),
              }}
              loading={loading}
              locale={{ emptyText: "Chưa có tờ khai nào. Tạo tờ khai để xem!" }}
            />
          </Card>
        </Space>
        {/* MODAL CREATE/UPDATE */}
        <Modal
          title={editingId ? "Cập nhật tờ khai" : "Tạo tờ khai thuế mới"}
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            modalForm.resetFields();
            setEditingId(null);
          }}
          footer={null} // 🚨 bỏ onOk, dùng footer custom
          confirmLoading={loading}
          width={600}
        >
          <Form form={modalForm} onFinish={handleSubmit} layout="vertical">
            <Form.Item
              name="declaredRevenue"
              label="Doanh thu khai báo (VND)"
              rules={[{ required: true, message: "Vui lòng nhập doanh thu" }]}
            >
              <InputNumber
                min={0}
                style={{ width: "100%" }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => v.replace(/\$\s?|(,*)/g, "")}
              />
            </Form.Item>

            <Form.Item
              name="gtgtRate"
              label="Thuế suất GTGT (%)"
              rules={[{ required: true, message: "Vui lòng nhập thuế suất" }]}
            >
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="tncnRate"
              label="Thuế suất TNCN (%)"
              rules={[{ required: true, message: "Vui lòng nhập thuế suất" }]}
            >
              <InputNumber min={0} max={100} style={{ width: "100%" }} />
            </Form.Item>

            {calculatedTax && (
              <div
                style={{
                  marginBottom: 16,
                  fontWeight: "bold",
                  color: "#d4380d",
                  textAlign: "center",
                }}
              >
                Tổng thuế: {formatVND(calculatedTax.total)}
              </div>
            )}

            <Form.Item style={{ textAlign: "right" }}>
              <Space>
                <Button
                  style={{
                    backgroundColor: "#faad14",
                    color: "#fff",
                    border: "none",
                  }}
                  onClick={() => {
                    const values = modalForm.getFieldsValue();
                    const result = calculateTax(values);
                    setCalculatedTax(result);
                    message.success("Đã tính toán thử xong!");
                  }}
                >
                  Tính toán
                </Button>
                <Button onClick={() => setModalVisible(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editingId ? "Cập nhật" : "Tạo mới"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="Xác nhận xóa"
          open={confirmVisible}
          onOk={handleConfirmDelete}
          onCancel={() => setConfirmVisible(false)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          Bạn có chắc muốn xóa tờ khai này không?
        </Modal>
      </div>
    </Layout>
  );
};

export default TaxDeclaration;
