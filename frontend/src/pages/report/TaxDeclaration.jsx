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
  Tooltip,
} from "antd";
import {
  EditOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";

dayjs.locale("vi");

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

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
    const gtgtRate = Number(values.gtgtRate) || 1.0;
    const tncnRate = Number(values.tncnRate) || 0.5;

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

    setEditingId(id);
    modalForm.setFieldsValue({
      declaredRevenue: Number(record.declaredRevenue.$numberDecimal) || Number(record.declaredRevenue),
      gtgtRate: record.taxRates.gtgt,
      tncnRate: record.taxRates.tncn,
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
    { title: "Kỳ", dataIndex: "periodKey", key: "periodKey", width: 150 },
    { title: "Loại kỳ", dataIndex: "periodType", key: "periodType", width: 100 },
    { title: "Phiên bản", dataIndex: "version", key: "version", width: 100 },
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
      render: (v) => formatVND(v?.$numberDecimal || v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => {
        const colorMap = { saved: "#faad14", submitted: "#1890ff" };
        const textMap = { saved: "Đã lưu", submitted: "Đã nộp" };
        return (
          <Text strong style={{ color: colorMap[status] || "#000" }}>
            {textMap[status] || status}
          </Text>
        );
      },
    },
    { title: "Ngày lập", dataIndex: "createdAt", key: "createdAt", render: (t) => dayjs(t).format("DD/MM/YYYY") },
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
          <Card>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <strong>Cửa hàng:</strong>{" "}
                <span style={{ color: "#1890ff", fontWeight: "bold" }}>{currentStore.name || "Đang tải..."}</span>
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
                  Preview doanh thu hệ thống
                </Button>
              </Col>
            </Row>
          </Card>

          {loading && <Spin tip="Đang xử lý..." style={{ width: "100%", margin: "20px 0" }} />}
          {error && <Alert message="Lỗi" description={error} type="error" showIcon style={{ marginBottom: 16 }} />}

          {/* KÊ KHAI */}
          {systemRevenue !== null && (
            <Card title="Kê khai thuế">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="Doanh thu hệ thống (tham khảo)" value={systemRevenue} formatter={formatVND} />
                </Col>
                <Col span={12} style={{ textAlign: "right", paddingTop: 32 }}>
                  <Button icon={<SyncOutlined />} onClick={useSystemRevenue}>
                    Dùng doanh thu hệ thống
                  </Button>
                </Col>
              </Row>

              <Form form={form} onFinish={handleSubmit} style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="declaredRevenue" label="Doanh thu khai báo" initialValue={systemRevenue}>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={0}
                        formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="gtgtRate" label="Thuế GTGT (%)" initialValue={1.0}>
                      <InputNumber min={0} max={100} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="tncnRate" label="Thuế TNCN (%)" initialValue={0.5}>
                      <InputNumber min={0} max={100} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    Tính toán & Lưu
                  </Button>
                </Form.Item>
              </Form>

              <div style={{ marginTop: 24, fontSize: 16, fontWeight: "bold", color: "#d4380d" }}>
                Tổng thuế phải nộp: {formatVND(calculateTax(form.getFieldsValue()).total)}
              </div>
            </Card>
          )}

          {/* LỊCH SỬ */}
          <Card title="Lịch sử kê khai thuế">
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

            <Form.Item style={{ textAlign: "right" }}>
              <Space>
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
