// src/pages/order/PendingOrdersManagerModal.tsx
import React, { useState, useEffect } from "react";
import { Modal, Table, Button, Space, Typography, Tag, Spin, Alert, Popconfirm, Select, Row, Col } from "antd";
import { DeleteOutlined, CloseOutlined, WarningOutlined, ReloadOutlined, DollarOutlined, CreditCardOutlined } from "@ant-design/icons";
import axios from "axios";
import type { ColumnsType } from "antd/es/table";
import Swal from "sweetalert2";

const { Text } = Typography;
const { Option } = Select;

const apiUrl = import.meta.env.VITE_API_URL;

interface MongoDecimal {
  $numberDecimal: string;
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
}

interface Employee {
  _id: string;
  fullName: string;
}

interface PendingOrder {
  _id: string;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  createdAt: string;
  status: string;
  paymentMethod: string;
}

interface PendingOrdersManagerModalProps {
  visible: boolean;
  onClose: () => void;
  onOrdersDeleted: () => void;
}

// Price range options
const PRICE_RANGES = [
  { label: "Tất cả mức giá", value: "all", min: 0, max: Infinity },
  { label: "Dưới 50.000₫", value: "0-50k", min: 0, max: 50000 },
  { label: "50.000₫ - 200.000₫", value: "50k-200k", min: 50000, max: 200000 },
  { label: "200.000₫ - 500.000₫", value: "200k-500k", min: 200000, max: 500000 },
  { label: "500.000₫ - 1.000.000₫", value: "500k-1m", min: 500000, max: 1000000 },
  { label: "1.000.000₫ - 3.000.000₫", value: "1m-3m", min: 1000000, max: 3000000 },
  { label: "Trên 3.000.000₫", value: "3m+", min: 3000000, max: Infinity },
];

const PendingOrdersManagerModal: React.FC<PendingOrdersManagerModalProps> = ({ visible, onClose, onOrdersDeleted }) => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // State cho filter
  const [paymentFilter, setPaymentFilter] = useState<string | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<string>("all");

  useEffect(() => {
    if (visible) {
      fetchPendingOrders();
    }
  }, [visible]);

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${apiUrl}/orders/list-all`, {
        params: {
          storeId,
          periodType: "year",
          periodKey: new Date().getFullYear(),
        },
        headers,
      });

      // Filter only pending orders
      const pendingOnly = res.data.orders.filter((order: any) => order.status === "pending");
      setOrders(pendingOnly);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tải danh sách đơn chưa thanh toán",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) return;

    try {
      setDeleting(true);
      await Promise.all(selectedRowKeys.map((id) => axios.delete(`${apiUrl}/orders/delete-pending/${id}`, { headers, params: { storeId } })));

      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: `Đã xoá ${selectedRowKeys.length} đơn hàng thành công!`,
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });

      setSelectedRowKeys([]);
      fetchPendingOrders();
      onOrdersDeleted();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi khi xoá đơn hàng",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Delete single order
  const handleDeleteSingle = async (orderId: string) => {
    try {
      setDeleting(true);
      await axios.delete(`${apiUrl}/orders/delete-pending/${orderId}`, {
        headers,
        params: { storeId },
      });
      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Đã xoá đơn hàng thành công!",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });

      fetchPendingOrders();
      onOrdersDeleted();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi khi xoá đơn hàng",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: true,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const total = parseFloat(order.totalAmount.$numberDecimal);

    // Filter by payment method
    const matchPayment = paymentFilter ? order.paymentMethod === paymentFilter : true;

    // Filter by price range
    const selectedRange = PRICE_RANGES.find((r) => r.value === priceRange);
    const matchPrice = selectedRange ? total >= selectedRange.min && total <= selectedRange.max : true;

    return matchPayment && matchPrice;
  });

  // Reset filters
  const handleResetFilters = () => {
    setPaymentFilter(undefined);
    setPriceRange("all");
  };

  // Format currency
  const formatCurrency = (value: MongoDecimal): string => parseFloat(value.$numberDecimal).toLocaleString("vi-VN") + "₫";

  // Format date
  const formatDate = (date: string): string => new Date(date).toLocaleString("vi-VN");

  // Table columns
  const columns: ColumnsType<PendingOrder> = [
    {
      title: "Mã đơn",
      dataIndex: "_id",
      key: "_id",
      width: 90,
      fixed: "left",
      render: (text) => (
        <Text code copyable style={{ fontSize: 12 }}>
          {text.slice(-8)}
        </Text>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.customer?.name || "Khách lẻ"}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.customer?.phone || "N/A"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Nhân viên",
      dataIndex: ["employeeId", "fullName"],
      key: "employee",
      width: 160,
    },
    {
      title: "Phương thức",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 120,
      align: "center",
      render: (method: string) => {
        const map: Record<string, { label: string; color: string }> = {
          cash: { label: "Tiền mặt", color: "green" },
          qr: { label: "Chuyển khoản", color: "blue" },
        };
        const item = map[method] || { label: method, color: "default" };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 110,
      align: "right",
      render: (value) => (
        <Text strong style={{ color: "#1890ff", fontSize: 14 }}>
          {formatCurrency(value)}
        </Text>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: () => <Tag color="orange">Chưa thanh toán</Tag>,
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      align: "center",
      render: (date) => <Text style={{ fontSize: 13, color: "#171616ff" }}>{formatDate(date)}</Text>,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 70,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Popconfirm
          title="Xác nhận xoá đơn hàng này?"
          description="Hành động này không thể hoàn tác!"
          onConfirm={() => handleDeleteSingle(record._id)}
          okText="Xoá"
          cancelText="Huỷ"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" icon={<DeleteOutlined />} loading={deleting} />
        </Popconfirm>
      ),
    },
  ];

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <Modal
      title={
        <Space>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Quản lý các đơn hàng Chưa Thanh Toán</span>
          <Tag color="orange" style={{ marginLeft: 8, fontSize: 14, padding: "2px 12px" }}>
            Tổng số: {orders.length} đơn
          </Tag>
        </Space>
      }
      open={visible}
      onCancel={() => {
        setSelectedRowKeys([]);
        onClose();
      }}
      footer={null}
      width={1350}
      style={{ top: 20 }}
    >
      {/* Alert Warning */}
      <Alert
        message="Lưu ý quan trọng"
        description="Chức năng này chỉ dùng để xoá các đơn hàng có trạng thái 'Chưa thanh toán', thường là của khách vãng lai không quay lại. Hành động xoá sẽ **không thể hoàn tác**. Vui lòng **kiểm tra kỹ thông tin đơn hàng**, tránh xoá nhầm các đơn mà khách có khả năng quay lại."
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 10 }}
      />

      {/* Toolbar - Chỉ hiện ra khi có item được chọn */}
      {selectedRowKeys.length > 0 && (
        <div
          style={{
            background: "#e6f7ff",
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid #91d5ff",
          }}
        >
          <Text strong style={{ color: "#1890ff", fontSize: 14 }}>
            Đã chọn {selectedRowKeys.length} đơn hàng
          </Text>
          <Space>
            <Button icon={<CloseOutlined />} onClick={() => setSelectedRowKeys([])}>
              Bỏ chọn
            </Button>
            <Popconfirm
              title={`Xác nhận xoá ${selectedRowKeys.length} đơn hàng?`}
              description="Hành động này không thể hoàn tác!"
              onConfirm={handleDeleteSelected}
              okText="Xoá tất cả"
              cancelText="Huỷ"
              okButtonProps={{ danger: true }}
            >
              <Button danger type="primary" icon={<DeleteOutlined />} loading={deleting}>
                Xoá các đơn đã chọn
              </Button>
            </Popconfirm>
          </Space>
        </div>
      )}

      {/* Filter Bar */}
      <div
        style={{
          marginBottom: 16,
          padding: "16px",
          background: "#fafafa",
          borderRadius: 8,
          border: "1px solid #e8e8e8",
        }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col>
            <Text strong style={{ color: "#595959" }}>
              Bộ lọc:
            </Text>
          </Col>

          {/* Payment Method Filter */}
          <Col>
            <Select
              placeholder="Phương thức thanh toán"
              allowClear
              style={{ width: 200 }}
              value={paymentFilter}
              onChange={(val) => setPaymentFilter(val)}
              suffixIcon={<CreditCardOutlined />}
            >
              <Option value="cash">
                <Tag color="green" style={{ marginRight: 8 }}>
                  Tiền mặt
                </Tag>
              </Option>
              <Option value="qr">
                <Tag color="blue" style={{ marginRight: 8 }}>
                  Chuyển khoản
                </Tag>
              </Option>
            </Select>
          </Col>

          {/* Price Range Filter */}
          <Col>
            <Select value={priceRange} allowClear onChange={(val) => setPriceRange(val)} style={{ width: 220 }} suffixIcon={<DollarOutlined />}>
              {PRICE_RANGES.map((range) => (
                <Option key={range.value} value={range.value}>
                  {range.label}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Reset Button */}
          <Col>
            <Button onClick={handleResetFilters}>Đặt lại bộ lọc</Button>
          </Col>

          {/* Spacer */}
          <Col flex="auto" />

          {/* Refresh Button */}
          <Col>
            <Button icon={<ReloadOutlined />} onClick={fetchPendingOrders} loading={loading} type="default">
              Làm mới
            </Button>
          </Col>
        </Row>

        {/* Filter Status */}
        {(paymentFilter || priceRange !== "all") && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e8e8e8" }}>
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đang lọc:
              </Text>
              {paymentFilter && (
                <Tag closable onClose={() => setPaymentFilter(undefined)} color={paymentFilter === "cash" ? "green" : "blue"}>
                  {paymentFilter === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                </Tag>
              )}
              {priceRange !== "all" && (
                <Tag closable onClose={() => setPriceRange("all")} color="orange">
                  {PRICE_RANGES.find((r) => r.value === priceRange)?.label}
                </Tag>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                • Tìm thấy <strong style={{ color: "#1890ff" }}>{filteredOrders.length}</strong> đơn
              </Text>
            </Space>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Spin size="large" tip="Đang tải danh sách..." />
        </div>
      ) : (
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredOrders}
          rowKey="_id"
          scroll={{ x: 900, y: 400 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => (
              <Text>
                Đang xem{" "}
                <span style={{ color: "#1890ff", fontWeight: 600 }}>
                  {range[0]} – {range[1]}
                </span>{" "}
                trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> đơn hàng
              </Text>
            ),
          }}
          locale={{
            emptyText: (
              <div style={{ padding: "40px 0" }}>
                <Text type="secondary" style={{ fontSize: 16 }}>
                  {paymentFilter || priceRange !== "all" ? "Không tìm thấy đơn hàng phù hợp với bộ lọc" : "Không có đơn hàng pending nào"}
                </Text>
              </div>
            ),
          }}
        />
      )}

      {/* Footer Info */}
      <div
        style={{
          marginTop: 0,
          padding: "12px 16px",
          background: "#f0f0f0",
          borderRadius: 8,
        }}
      >
        <Space>
          <WarningOutlined style={{ color: "#fa8c16" }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            <strong>Mẹo:</strong> Sử dụng bộ lọc để tìm nhanh các đơn theo phương thức thanh toán hoặc khoảng giá. Chọn nhiều đơn hàng bằng 'Ô đánh
            dấu' để xoá hàng loạt.
          </Text>
        </Space>
      </div>
    </Modal>
  );
};

export default PendingOrdersManagerModal;
