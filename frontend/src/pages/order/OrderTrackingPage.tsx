// src/pages/order/OrderTrackingPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Input, Table, Tag, Space, DatePicker, Select, Typography, Empty, Spin, Descriptions, Divider, Button } from "antd";
import {
  SearchOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  CalendarOutlined,
  UserOutlined,
  DollarOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import debounce from "../../utils/debounce";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}`;

// ==================== INTERFACES ====================

interface MongoDecimal {
  $numberDecimal: string;
}

interface Store {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  fullName: string;
}

interface Customer {
  _id: string;
  name: string;
  phone: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  price: MongoDecimal;
}

interface OrderItem {
  _id: string;
  orderId: string;
  productId: Product;
  quantity: number;
  priceAtTime: MongoDecimal;
  subtotal: MongoDecimal;
  createdAt: string;
  updatedAt: string;
  productName: string;
  productSku: string;
}

interface Order {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  paymentMethod: "cash" | "qr";
  qrExpiry: string | null;
  status: "pending" | "paid" | "refunded" | "partially_refunded";
  refundId: string | null;
  printDate: string | null;
  printCount: number;
  isVATInvoice: boolean;
  vatAmount: MongoDecimal;
  beforeTaxAmount: MongoDecimal;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface OrderListResponse {
  message: string;
  total: number;
  orders: Order[];
}

interface OrderDetailResponse {
  message: string;
  order: Order & { items: OrderItem[] };
}

// ==================== COMPONENT ====================

const OrderTrackingPage: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // State
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Helper: Format currency
  const formatCurrency = (value: MongoDecimal | number): string => {
    const numValue = typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Helper: Format date
  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString("vi-VN");
  };

  // Helper: Get status config
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: {
        color: "orange",
        icon: <ClockCircleOutlined />,
        text: "Chờ Thanh Toán",
      },
      paid: {
        color: "green",
        icon: <CheckCircleOutlined />,
        text: "Đã Thanh Toán",
      },
      refunded: {
        color: "red",
        icon: <RollbackOutlined />,
        text: "Hoàn Toàn Bộ",
      },
      partially_refunded: {
        color: "volcano",
        icon: <RollbackOutlined />,
        text: "Hoàn 1 Phần",
      },
      cancelled: {
        color: "gray",
        icon: <RollbackOutlined />,
        text: "Đã Huỷ",
      },
    };
    return configs[status] || configs.pending;
  };

  // Load all orders
  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OrderListResponse>(`${API_BASE}/orders/list-all`, {
        params: { storeId },
        headers,
      });
      setOrders(res.data.orders);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi tải danh sách đơn hàng",
        text: err.response?.data?.message || "Không thể tải danh sách đơn hàng",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load order detail
  const loadOrderDetail = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrderId(orderId);
    try {
      const res = await axios.get<OrderDetailResponse>(`${API_BASE}/orders/${orderId}`, {
        params: { storeId },
        headers,
      });
      setOrderDetail(res.data);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi tải chi tiết đơn hàng",
        text: err.response?.data?.message || "Không thể tải chi tiết đơn hàng",
      });
      setOrderDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      setSearchText(text);
    }, 300),
    []
  );

  useEffect(() => {
    if (storeId) {
      loadOrders();
    }
  }, [storeId]);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchSearch = searchText
      ? order._id.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.phone.includes(searchText)
      : true;

    const matchStatus = selectedStatus ? order.status === selectedStatus : true;

    // Filter by date range
    let matchDate = true;
    if (dateRange[0] && dateRange[1]) {
      const orderDate = dayjs(order.createdAt);
      matchDate = orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
    }

    return matchSearch && matchStatus && matchDate;
  });

  // Pagination config
  const paginationConfig = {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: filteredOrders.length,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => (
      <div>
        Đang xem{" "}
        <span style={{ color: "#1890ff", fontWeight: 600 }}>
          {range[0]} – {range[1]}
        </span>{" "}
        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> đơn hàng
      </div>
    ),
    onChange: (page: number, pageSize: number) => setPagination({ current: page, pageSize }),
  };

  return (
    <div style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
      <div className="flex flex-col sm:flex-row sm:items-center  mb-4 gap-3">
        <Title level={3} style={{ marginBottom: 24 }}>
          <ShoppingOutlined /> Tra Cứu Đơn Hàng
        </Title>
        <span
          style={{ marginBottom: 24 }}
          className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm duration-200"
        >
          {currentStore?.name}
        </span>
      </div>

      <Row gutter={16}>
        {/* PANEL TRÁI */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>Danh Sách Đơn Hàng</span>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadOrders} loading={loading} type="default">
                  Làm mới
                </Button>
                <Text type="secondary">
                  Tổng có:{" "}
                  <Text strong style={{ color: "#1890ff" }}>
                    {filteredOrders.length}
                  </Text>{" "}
                  đơn hàng
                </Text>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            {/* Bộ lọc */}
            <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
              <Input
                placeholder="Tìm mã đơn hàng, tên khách, SĐT..."
                prefix={<SearchOutlined />}
                onChange={(e) => debouncedSearch(e.target.value)}
                allowClear
                size="large"
              />
              <RangePicker
                style={{ width: "100%" }}
                placeholder={["Từ ngày", "Đến ngày"]}
                format="DD/MM/YYYY"
                onChange={(dates) => {
                  if (!dates) {
                    setDateRange([null, null]);
                  } else {
                    setDateRange(dates as [Dayjs | null, Dayjs | null]);
                  }
                }}
                size="large"
              />
              <Select placeholder="Trạng Thái" onChange={(value) => setSelectedStatus(value)} allowClear style={{ width: "100%" }} size="large">
                {["pending", "paid", "refunded", "partially_refunded", "cancelled"].map((status) => {
                  const cfg = getStatusConfig(status);
                  return (
                    <Option key={status} value={status}>
                      <Tag color={cfg.color} icon={cfg.icon}>
                        {cfg.text}
                      </Tag>
                    </Option>
                  );
                })}
              </Select>
            </Space>

            {/* Danh sách */}
            <Table
              dataSource={filteredOrders}
              rowKey="_id"
              loading={loading}
              pagination={paginationConfig}
              size="small"
              scroll={{ y: 500 }}
              rowClassName={(record) => (record._id === selectedOrderId ? "ant-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => loadOrderDetail(record._id),
                style: { cursor: "pointer" },
              })}
              columns={[
                {
                  title: "Mã Đơn",
                  dataIndex: "_id",
                  key: "_id",
                  width: 110,
                  render: (text) => (
                    <Text code copyable>
                      {text.slice(-8)}
                    </Text>
                  ),
                },
                {
                  title: "Khách Hàng",
                  key: "customer",
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{record.customer?.name || "Khách lẻ"}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.customer?.phone || "Trống"}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: "Tổng Tiền",
                  dataIndex: "totalAmount",
                  key: "totalAmount",
                  width: 110,
                  align: "right",
                  render: (value) => <Text strong>{formatCurrency(value)}</Text>,
                },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  align: "center",
                  width: 135,
                  render: (status) => {
                    const config = getStatusConfig(status);
                    return (
                      <Tag color={config.color} icon={config.icon}>
                        {config.text}
                      </Tag>
                    );
                  },
                },
                {
                  title: "Ngày Tạo",
                  dataIndex: "createdAt",
                  key: "createdAt",
                  align: "center",
                  width: 100,
                  render: (date) => <Text style={{ fontSize: 12, color: "#2274efff", fontWeight: "bold" }}>{formatDate(date)}</Text>,
                },
              ]}
            />
          </Card>
        </Col>

        {/* PANEL PHẢI */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>Chi Tiết Đơn Hàng</span>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            {detailLoading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <Spin size="large" tip="Đang tải chi tiết..." />
              </div>
            ) : !orderDetail ? (
              <Empty description="Chọn một đơn hàng bên cạnh để xem chi tiết nó" />
            ) : (
              <div>
                {/* Thông tin đơn hàng */}
                <Card
                  type="inner"
                  title={
                    <Space>
                      <Text strong>Thông Tin Đơn Hàng:</Text>
                      <Tag color={getStatusConfig(orderDetail.order.status).color}>
                        {getStatusConfig(orderDetail.order.status).text} {getStatusConfig(orderDetail.order.status).icon}
                      </Tag>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Mã Đơn">
                      <Text code copyable>
                        {orderDetail.order._id}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cửa Hàng">{orderDetail.order.storeId.name}</Descriptions.Item>
                    <Descriptions.Item label="Nhân Viên">
                      <Space>
                        <UserOutlined />
                        {orderDetail.order.employeeId?.fullName ? orderDetail.order.employeeId.fullName : <Tag color="gold">Chủ cửa hàng</Tag>}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách Hàng">
                      {orderDetail.order.customer ? (
                        <Space direction="vertical" size={0}>
                          <Text strong>{orderDetail.order.customer.name}</Text>
                          <Text type="secondary">{orderDetail.order.customer.phone}</Text>
                        </Space>
                      ) : (
                        "Khách lẻ"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phương Thức TT">
                      <Tag color={orderDetail.order.paymentMethod === "cash" ? "green" : "blue"}>
                        <DollarOutlined /> {orderDetail.order.paymentMethod === "cash" ? "Tiền Mặt" : "QR Code"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Xuất VAT">
                      <Tag color={orderDetail.order.isVATInvoice ? "cyan" : "default"}>{orderDetail.order.isVATInvoice ? "Có" : "Không"}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày Tạo" span={2}>
                      <span style={{ marginRight: 10 }}>{formatDate(orderDetail.order.createdAt)}</span>
                    </Descriptions.Item>
                    {orderDetail.order.printDate && (
                      <Descriptions.Item label="Ngày In Hoá Đơn" span={2}>
                        <span style={{ marginRight: 10 }}>{formatDate(orderDetail.order.printDate)}</span>
                        <Tag color="blue"> Đã in hoá đơn: {orderDetail.order.printCount} lần</Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>

                {/* Sản phẩm trong đơn */}
                <Card type="inner" title={<Text strong>Sản Phẩm Trong Đơn</Text>} style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={orderDetail.order.items}
                    rowKey="_id"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: "STT",
                        key: "stt",
                        width: 60,
                        align: "center",
                        render: (_, __, index) => index + 1,
                      },
                      {
                        title: "Mã SKU",
                        key: "sku",
                        width: 120,
                        render: (_, record) => <Text code>{record.productSku}</Text>,
                      },
                      {
                        title: "Sản Phẩm",
                        key: "name",
                        render: (_, record) => <Text strong>{record.productName}</Text>,
                      },
                      {
                        title: "Số Lượng",
                        dataIndex: "quantity",
                        key: "quantity",
                        align: "center",
                        width: 100,
                        render: (value) => <Tag color="blue">{value}</Tag>,
                      },
                      {
                        title: "Đơn Giá",
                        dataIndex: "priceAtTime",
                        key: "priceAtTime",
                        align: "right",
                        width: 130,
                        render: (value) => formatCurrency(value),
                      },
                      {
                        title: "Thành Tiền",
                        dataIndex: "subtotal",
                        key: "subtotal",
                        align: "right",
                        width: 130,
                        render: (value) => <Text strong>{formatCurrency(value)}</Text>,
                      },
                    ]}
                  />
                </Card>

                {/* Tổng tiền */}
                <Card type="inner" title={<Text strong>Thông Tin Thanh Toán</Text>} style={{ borderColor: "#1890ff" }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Tiền Trước Thuế">
                      <Text style={{ fontSize: 16 }}>{formatCurrency(orderDetail.order.beforeTaxAmount)}</Text>
                    </Descriptions.Item>
                    {orderDetail.order.isVATInvoice && (
                      <Descriptions.Item label="VAT (10%)">
                        <Text style={{ fontSize: 16, color: "#faad14" }}>+{formatCurrency(orderDetail.order.vatAmount)}</Text>
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Tổng Tiền">
                      <Text strong style={{ fontSize: 20, color: "#1890ff" }}>
                        {formatCurrency(orderDetail.order.totalAmount)}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>

                  {orderDetail.order.refundId && (
                    <>
                      <Divider style={{ margin: "12px 0" }} />
                      <Space style={{ width: "100%", justifyContent: "center" }}>
                        <Tag icon={<RollbackOutlined />} color="red" style={{ fontSize: 14, padding: "4px 12px" }}>
                          Đơn hàng này đã được hoàn trả
                        </Tag>
                      </Space>
                    </>
                  )}
                </Card>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OrderTrackingPage;
