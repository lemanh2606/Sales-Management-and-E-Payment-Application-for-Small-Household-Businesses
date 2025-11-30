// src/pages/report/TaxDeclaration.jsx - ✅ FIX readVietnameseNumber + ERROR BOUNDARY
import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Col, Row, Select, DatePicker, InputNumber, Button, Table, Form, Spin,
  Alert, Space, Modal, message, Dropdown, Menu, Statistic, Typography, Divider,
  Tooltip, Tag, Popconfirm, Badge, Descriptions, Result, Input
} from "antd";
import {
  EditOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined,
  FilePdfOutlined, InfoCircleOutlined, SyncOutlined, CheckCircleOutlined, ClockCircleOutlined,
  EyeOutlined, FileDoneOutlined, UndoOutlined, QuestionCircleOutlined, CalculatorOutlined
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import "dayjs/locale/vi";
import readVietnameseNumber from "read-vietnamese-number";
import Layout from "../../components/Layout";
import ComponentTaxGuide from "./ComponentTaxGuide";


dayjs.extend(quarterOfYear);
dayjs.locale("vi");


const apiUrl = import.meta.env.VITE_API_URL;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;


// ==================== ERROR BOUNDARY ====================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }


  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }


  componentDidCatch(error, errorInfo) {
    console.error("TaxDeclaration Error:", error, errorInfo);
  }


  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <Result
            status="error"
            title="Có lỗi xảy ra"
            subTitle="Vui lòng thử lại hoặc liên hệ hỗ trợ"
            extra={[
              <Button key="refresh" onClick={() => window.location.reload()}>
                Tải lại trang
              </Button>,
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}


const TaxDeclaration = () => {
  // ==================== AUTH & STORE ====================
  const token = localStorage.getItem("token");
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id || currentStore?.id;


  // ==================== STATE ====================
  const [loading, setLoading] = useState(false);
  const [declarations, setDeclarations] = useState([]);
  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [calculatedTax, setCalculatedTax] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);


  // Filter & Preview
  const [periodType, setPeriodType] = useState("");
  const [periodKey, setPeriodKey] = useState("");
  const [monthRange, setMonthRange] = useState([]);
  const [pickerValue, setPickerValue] = useState(null);
  const [systemRevenue, setSystemRevenue] = useState(null);


  // ==================== SAFE VIETNAMESE NUMBER ====================
  // ✅ FIX: Chuyển number → string trước khi dùng readVietnameseNumber
  const readNumberSafe = useCallback((num) => {
    try {
      if (!num || isNaN(num)) return "Không xác định";
      // ✅ CHUYỂN NUMBER → STRING
      const numStr = Math.round(Number(num)).toString();
      return readVietnameseNumber(numStr).replace("đơn vị", "").trim();
    } catch (error) {
      console.warn("readVietnameseNumber error:", error);
      return new Intl.NumberFormat("vi-VN").format(Math.round(Number(num)));
    }
  }, []);


  // ==================== API HELPER ====================
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    return axios({
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      ...options,
    });
  }, [token]);


  // ==================== HELPER FUNCTIONS ====================
  const formatVND = useCallback((value) => {
    if (!value) return "₫0";
    try {
      const num = typeof value === "object" ?
        (value.$numberDecimal || value.toString()) :
        value;
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
      }).format(Number(num));
    } catch {
      return "₫0";
    }
  }, []);


  const calculateTax = useCallback((values) => {
    try {
      const declared = Number(values.declaredRevenue) || 0;
      const gtgtRate = Number(values.gtgtRate || 1.0);
      const tncnRate = Number(values.tncnRate || 0.5);
      const gtgt = (declared * gtgtRate) / 100;
      const tncn = (declared * tncnRate) / 100;
      const total = gtgt + tncn;
      return { gtgt, tncn, total };
    } catch {
      return { gtgt: 0, tncn: 0, total: 0 };
    }
  }, []);


  // ==================== API CALLS ====================
  const fetchPreview = async () => {
    if (!storeId || !periodType) {
      message.warning("Vui lòng chọn cửa hàng và kỳ kê khai");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ storeId, periodType });
      if (periodType === "custom" && monthRange.length === 2) {
        params.append('monthFrom', monthRange[0].format("YYYY-MM"));
        params.append('monthTo', monthRange[1].format("YYYY-MM"));
      } else if (periodKey) {
        params.append('periodKey', periodKey);
      }
      const res = await fetchWithAuth(`${apiUrl}/taxs/preview?${params}`);
      setSystemRevenue(res.data.systemRevenue);
      form.setFieldsValue({ declaredRevenue: res.data.systemRevenue });
      message.success("Đã tải doanh thu hệ thống");
    } catch (err) {
      console.error("Preview error:", err);
      message.error(err.response?.data?.message || "Lỗi tải preview");
    } finally {
      setLoading(false);
    }
  };


  const fetchDeclarations = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        storeId,
        page: currentPage,
        limit: pageSize,
      });
      const res = await fetchWithAuth(`${apiUrl}/taxs?${params}`);
      setDeclarations(res.data.data || []);
    } catch (err) {
      console.error("Declarations error:", err);
      message.error(err.response?.data?.message || "Lỗi tải danh sách");
    } finally {
      setLoading(false);
    }
  }, [storeId, token, currentPage, pageSize]);


  const fetchDeclaration = async (id) => {
    try {
      const res = await fetchWithAuth(`${apiUrl}/taxs/${id}`);
      return res.data.data || res.data.declaration;
    } catch (err) {
      console.error("Fetch declaration error:", err);
      throw err;
    }
  };


  useEffect(() => {
    if (storeId && token) {
      fetchDeclarations();
    }
  }, [storeId, fetchDeclarations]);


  // ==================== EVENT HANDLERS ====================
  const handleTypeChange = (value) => {
    setPeriodType(value);
    setPeriodKey("");
    setMonthRange([]);
    setPickerValue(null);
    setSystemRevenue(null);
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


  const handleMonthRangeChange = (dates) => setMonthRange(dates || []);


  const handleSubmit = async (values) => {
    if (!systemRevenue && !editingId) {
      message.warning("Vui lòng xem trước doanh thu");
      return;
    }
    setLoading(true);
    try {
      const url = editingId ? `${apiUrl}/taxs/${editingId}` : `${apiUrl}/taxs`;
      const payload = {
        storeId,
        periodType,
        declaredRevenue: values.declaredRevenue,
        taxRates: { gtgt: values.gtgtRate || 1.0, tncn: values.tncnRate || 0.5 },
      };
      if (periodType === "custom" && monthRange.length === 2) {
        payload.periodKey = `${monthRange[0].format("YYYY-MM")}_${monthRange[1].format("YYYY-MM")}`;
      } else {
        payload.periodKey = periodKey;
      }
      await fetchWithAuth(url, {
        method: editingId ? 'PUT' : 'POST',
        data: payload,
      });
      message.success(editingId ? "Cập nhật thành công" : "Tạo tờ khai thành công");
      setModalVisible(false);
      form.resetFields();
      modalForm.resetFields();
      setEditingId(null);
      setSystemRevenue(null);
      setCalculatedTax(null);
      fetchDeclarations();
    } catch (err) {
      console.error("Submit error:", err);
      message.error(err.response?.data?.message || "Lỗi lưu dữ liệu");
    } finally {
      setLoading(false);
    }
  };


  const useSystemRevenue = () => {
    if (!systemRevenue) {
      message.warning("Vui lòng xem trước doanh thu");
      return;
    }
    form.setFieldsValue({ declaredRevenue: systemRevenue });
    message.success("Đã áp dụng doanh thu hệ thống");
  };


  // ✅ FIX: SAFE CALCULATE + NO RERENDER
  const handleCalculateTax = useCallback(() => {
    try {
      const values = form.getFieldsValue();
      const result = calculateTax(values);
      setCalculatedTax(result);
      message.success("Đã tính toán thuế");
    } catch (error) {
      console.error("Calculate tax error:", error);
      message.error("Lỗi tính toán thuế");
    }
  }, [form, calculateTax]);


  const handleEdit = async (id) => {
    try {
      setLoading(true);
      const record = await fetchDeclaration(id);
      const declared = Number(record.declaredRevenue) || 0;
      const gtgtRate = record.taxRates?.gtgt ?? 1.0;
      const tncnRate = record.taxRates?.tncn ?? 0.5;


      const taxResult = calculateTax({
        declaredRevenue: declared,
        gtgtRate,
        tncnRate
      });


      setCalculatedTax(taxResult);
      setEditingId(id);
      modalForm.setFieldsValue({
        declaredRevenue: declared,
        gtgtRate,
        tncnRate
      });
      setModalVisible(true);
    } catch (err) {
      message.error("Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };


  const handleAction = async (url, method = 'POST', data = {}) => {
    setLoading(true);
    try {
      await fetchWithAuth(url, { method, data });
      message.success("Thành công");
      fetchDeclarations();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi xử lý");
    } finally {
      setLoading(false);
    }
  };


  const handleClone = (id) => handleAction(`${apiUrl}/taxs/${id}/clone`);
  const handleDelete = (id) => handleAction(`${apiUrl}/taxs/${id}`, 'DELETE');
  const handleApproveReject = (id, action) =>
    handleAction(`${apiUrl}/taxs/${id}/approve`, 'POST', { action });


  const handleExport = async (id, format) => {
    try {
      const res = await fetchWithAuth(
        `${apiUrl}/taxs/${id}/export?format=${format}&storeId=${storeId}`,
        { responseType: 'blob' }
      );
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `to-khai-thue_${id}.${format}`;
      link.click();
      message.success("Tải file thành công");
    } catch (err) {
      message.error("Lỗi tải file");
    }
  };


  const handleDetail = (record) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };


  // ==================== TABLE COLUMNS ====================
  const columns = [
    { title: "Kỳ", dataIndex: "periodKey", key: "periodKey", width: 150 },
    {
      title: "Phiên bản",
      dataIndex: "version",
      key: "version",
      width: 100,
      render: (v, record) => (
        <Space>
          <Tag color={record.isClone ? "orange" : "blue"}>v{v}</Tag>
          {record.isClone && <Tag>Bản sao</Tag>}
        </Space>
      )
    },
    { title: "Doanh thu", dataIndex: "declaredRevenue", key: "declaredRevenue", render: formatVND },
    {
      title: "Tổng thuế",
      dataIndex: ["taxAmounts", "total"],
      key: "total",
      render: (v) => <Text strong style={{ color: "#d4380d" }}>{formatVND(v)}</Text>
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status) => {
        const map = {
          draft: { text: "Nháp", color: "default" },
          saved: { text: "Đã lưu", color: "processing" },
          submitted: { text: "Đã nộp", color: "warning" },
          approved: { text: "Đã duyệt", color: "success" },
          rejected: { text: "Từ chối", color: "error" },
        };
        const config = map[status] || { text: status, color: "default" };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    { title: "Ngày tạo", dataIndex: "createdAt", width: 120, render: (t) => dayjs(t).format("DD/MM") },
    {
      title: "Hành động",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)} />
          </Tooltip>
          {["draft", "saved"].includes(record.status) && (
            <Tooltip title="Chỉnh sửa">
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record._id)} />
            </Tooltip>
          )}
          <Tooltip title="Nhân bản">
            <Button size="small" icon={<CopyOutlined />} onClick={() => handleClone(record._id)} />
          </Tooltip>
          {record.status === "submitted" && (
            <>
              <Tooltip title="Duyệt">
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => handleApproveReject(record._id, "approve")} />
              </Tooltip>
              <Tooltip title="Từ chối">
                <Popconfirm title="Từ chối tờ khai?" onConfirm={() => handleApproveReject(record._id, "reject")}>
                  <Button size="small" danger icon={<UndoOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          <Popconfirm title="Xóa tờ khai?" onConfirm={() => handleDelete(record._id)}>
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
          <Dropdown overlay={
            <Menu>
              <Menu.Item key="csv" icon={<FileExcelOutlined />} onClick={() => handleExport(record._id, "csv")}>
                CSV
              </Menu.Item>
              <Menu.Item key="pdf" icon={<FilePdfOutlined />} onClick={() => handleExport(record._id, "pdf")}>
                PDF (Mẫu 01/CNKD)
              </Menu.Item>
            </Menu>
          }>
            <Button size="small" icon={<DownloadOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];


  // ==================== RENDER ====================
  if (!storeId || !token) {
    return (
      <Layout>
        <div style={{ padding: "24px", textAlign: "center" }}>
          <Result
            status="warning"
            title="Vui lòng đăng nhập và chọn cửa hàng"
            extra={
              <Space>
                <Button href="/login">Đăng nhập</Button>
                <Button href="/stores">Chọn cửa hàng</Button>
              </Space>
            }
          />
        </div>
      </Layout>
    );
  }


  return (
    <ErrorBoundary>
      <Layout>
        <div style={{ padding: "24px" }}>
          <Space direction="vertical" size={24} style={{ width: "100%" }}>
            {/* HEADER */}
            <Card style={{ borderRadius: 12 }}>
              <Row gutter={24} align="middle">
                <Col xs={24} lg={6}>
                  <Space direction="vertical">
                    <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
                      {currentStore.name}
                    </Title>
                    <Text type="secondary">{currentStore.phone}</Text>
                  </Space>
                </Col>
                <Col xs={24} lg={5}>
                  <Select
                    value={periodType}
                    onChange={handleTypeChange}
                    style={{ width: "100%" }}
                    placeholder="Chọn kỳ kê khai"
                  >
                    <Option value="month">📅 Tháng</Option>
                    <Option value="quarter">📊 Quý</Option>
                    <Option value="year">📈 Năm</Option>
                    <Option value="custom">⚙️ Tùy chỉnh</Option>
                  </Select>
                </Col>
                <Col xs={24} lg={7}>
                  {periodType === "custom" ? (
                    <RangePicker
                      picker="month"
                      value={monthRange}
                      onChange={handleMonthRangeChange}
                      style={{ width: "100%" }}
                    />
                  ) : periodType ? (
                    <DatePicker
                      picker={periodType}
                      value={pickerValue}
                      onChange={handlePeriodChange}
                      style={{ width: "100%" }}
                    />
                  ) : null}
                </Col>
                <Col xs={24} lg={6}>
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={fetchPreview}
                    loading={loading}
                    disabled={!periodType || (periodType === "custom" && monthRange.length !== 2)}
                    icon={<SyncOutlined />}
                  >
                    Xem doanh thu hệ thống
                  </Button>
                </Col>
              </Row>
            </Card>


            {/* FORM KÊ KHAI */}
            {systemRevenue !== null && (
              <Card title={<Space><FileDoneOutlined /> Kê khai thuế GTGT & TNCN</Space>}>
                <Row gutter={24}>
                  <Col span={12}>
                    <Statistic
                      title="💰 Doanh thu hệ thống (tham khảo)"
                      value={systemRevenue}
                      formatter={formatVND}
                    />
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      size="large"
                      onClick={useSystemRevenue}
                      icon={<CalculatorOutlined />}
                      style={{ height: 64 }}
                    >
                      Áp dụng doanh thu hệ thống
                    </Button>
                  </Col>
                </Row>
                <Divider />
                <Form form={form} onFinish={handleSubmit} layout="vertical">
                  <Row gutter={24}>
                    <Col span={8}>
                      <Form.Item name="declaredRevenue" label="💵 Doanh thu kê khai" rules={[{ required: true }]}>
                        <InputNumber
                          style={{ width: "100%" }}
                          min={0}
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          parser={(v) => v ? v.replace(/\$\s?|(,*)/g, '') : ''}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="gtgtRate" label="📊 Thuế GTGT (%)" initialValue={1.0}>
                        <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="tncnRate" label="👤 Thuế TNCN (%)" initialValue={0.5}>
                        <InputNumber min={0} max={5} step={0.1} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Space style={{ width: "100%", justifyContent: "flex-end", marginBottom: 24 }}>
                    <Button
                      type="link"
                      icon={<QuestionCircleOutlined />}
                      onClick={() => setShowGuide(!showGuide)}
                    >
                      {showGuide ? "Ẩn hướng dẫn" : "Xem hướng dẫn thuế"}
                    </Button>
                    <Button
                      icon={<CalculatorOutlined />}
                      onClick={handleCalculateTax}
                    >
                      Tính thuế
                    </Button>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      💾 Lưu tờ khai
                    </Button>
                  </Space>
                  {calculatedTax && calculatedTax.total > 0 && (
                    <Alert
                      type="success"
                      showIcon
                      message={
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Text strong style={{ fontSize: 20 }}>
                            Tổng thuế phải nộp: {formatVND(calculatedTax.total)}
                          </Text>
                          <Text type="secondary">
                            ({readNumberSafe(calculatedTax.total)} đồng)
                          </Text>
                        </Space>
                      }
                    />
                  )}
                </Form>
                {showGuide && <ComponentTaxGuide />}
              </Card>
            )}


            {/* TABLE */}
            <Card title={<Space><Title level={4}>📋 Lịch sử tờ khai</Title> <Badge count={declarations.length} /></Space>}>
              <Table
                columns={columns}
                dataSource={declarations}
                rowKey="_id"
                loading={loading}
                scroll={{ x: 1400 }}
                pagination={{
                  current: currentPage,
                  pageSize,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `Tổng ${total} tờ khai`,
                  onChange: setCurrentPage,
                  onShowSizeChange: (_, size) => setPageSize(size),
                }}
                locale={{
                  emptyText: (
                    <Space direction="vertical" style={{ textAlign: "center", padding: "60px 0" }}>
                      <FileDoneOutlined style={{ fontSize: 48, color: "#bfbfbf" }} />
                      <Title level={4} style={{ color: "#bfbfbf" }}>Chưa có tờ khai thuế</Title>
                      <Text type="secondary">Nhấn "Xem doanh thu hệ thống" để bắt đầu kê khai</Text>
                    </Space>
                  ),
                }}
              />
            </Card>


            {/* MODAL EDIT */}
            <Modal
              title={<Space><FileDoneOutlined /> {editingId ? "Cập nhật" : "Tạo mới"} tờ khai</Space>}
              open={modalVisible}
              footer={null}
              width={700}
              onCancel={() => {
                setModalVisible(false);
                modalForm.resetFields();
                setEditingId(null);
                setCalculatedTax(null);
              }}
            >
              <Form form={modalForm} onFinish={handleSubmit} layout="vertical">
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item name="declaredRevenue" label="Doanh thu kê khai" rules={[{ required: true }]}>
                      <InputNumber style={{ width: "100%" }} min={0} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="gtgtRate" label="Thuế GTGT (%)" initialValue={1.0}>
                      <InputNumber min={0} max={10} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tncnRate" label="Thuế TNCN (%)" initialValue={0.5}>
                      <InputNumber min={0} max={5} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
                {calculatedTax && calculatedTax.total > 0 && (
                  <Alert
                    message={`Tổng thuế: ${formatVND(calculatedTax.total)}`}
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )}
                <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                  <Button
                    icon={<CalculatorOutlined />}
                    onClick={() => {
                      const values = modalForm.getFieldsValue();
                      setCalculatedTax(calculateTax(values));
                    }}
                  >
                    Tính lại
                  </Button>
                  <Button onClick={() => setModalVisible(false)}>Hủy</Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    {editingId ? "Cập nhật" : "Tạo mới"}
                  </Button>
                </Space>
              </Form>
            </Modal>


            {/* MODAL CHI TIẾT */}
            <Modal
              title="Chi tiết tờ khai"
              open={detailVisible}
              footer={null}
              width={900}
              onCancel={() => setDetailVisible(false)}
            >
              {selectedRecord && (
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="Kỳ kê khai">{selectedRecord.periodKey}</Descriptions.Item>
                  <Descriptions.Item label="Doanh thu kê khai">{formatVND(selectedRecord.declaredRevenue)}</Descriptions.Item>
                  <Descriptions.Item label="Thuế GTGT">{formatVND(selectedRecord.taxAmounts?.gtgt)}</Descriptions.Item>
                  <Descriptions.Item label="Thuế TNCN">{formatVND(selectedRecord.taxAmounts?.tncn)}</Descriptions.Item>
                  <Descriptions.Item label="Tổng thuế phải nộp">
                    <Text strong style={{ color: "#d4380d" }}>{formatVND(selectedRecord.taxAmounts?.total)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <Tag color="blue">{selectedRecord.status}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày tạo">{dayjs(selectedRecord.createdAt).format("DD/MM/YYYY HH:mm")}</Descriptions.Item>
                  {selectedRecord.notes && <Descriptions.Item label="Ghi chú">{selectedRecord.notes}</Descriptions.Item>}
                </Descriptions>
              )}
            </Modal>
          </Space>
        </div>
      </Layout>
    </ErrorBoundary>
  );
};


export default TaxDeclaration;