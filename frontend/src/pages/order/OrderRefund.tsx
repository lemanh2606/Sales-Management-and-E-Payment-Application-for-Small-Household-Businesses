// src/pages/order/OrderRefund.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Table,
  Tag,
  Space,
  DatePicker,
  Select,
  Modal,
  Form,
  InputNumber,
  Descriptions,
  Divider,
  Typography,
  Empty,
  Spin,
  Checkbox,
  Upload,
} from "antd";
import {
  SearchOutlined,
  RollbackOutlined,
  LoadingOutlined,
  UserOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  PlusOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import debounce from "../../utils/debounce";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;
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

interface RefundOrder {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  status: "refunded" | "partially_refunded";
  refundId: string;
  createdAt: string;
  updatedAt: string;
}

interface PaidOrder {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  paymentMethod: string;
  status: "paid" | "partially_refunded"; // ← Thêm dòng này
  createdAt: string;
  updatedAt: string;
}

interface RefundItem {
  _id: string;
  productId: Product;
  quantity: number;
  priceAtTime: MongoDecimal;
  subtotal: MongoDecimal;
}

interface EvidenceMedia {
  url: string;
  type: "image" | "video";
  public_id?: string;
}

interface RefundDetail {
  _id: string;
  orderId: {
    _id: string;
    totalAmount: MongoDecimal;
    paymentMethod: string;
    status: string;
  };
  refundedAt: string;
  refundedBy: Employee;
  refundTransactionId: string | null;
  refundReason: string;
  refundAmount: MongoDecimal;
  refundItems: RefundItem[];
  evidenceMedia: EvidenceMedia[];
  createdAt: string;
  updatedAt: string;
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
}

interface OrderRefundDetailResponse {
  message: string;
  order: RefundOrder;
  refundDetail: RefundDetail;
  orderItems: OrderItem[];
}

interface SelectedProductItem {
  productId: string;
  quantity: number;
}

// ==================== COMPONENT ====================

const OrderRefund: React.FC = () => {
  const [form] = Form.useForm();
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // Các State
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(undefined);
  const [refundOrders, setRefundOrders] = useState<RefundOrder[]>([]);
  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [refundDetail, setRefundDetail] = useState<OrderRefundDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [evidenceMedia, setEvidenceMedia] = useState<EvidenceMedia[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Các Modal states
  const [paidOrdersModalOpen, setPaidOrdersModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPaidOrder, setSelectedPaidOrder] = useState<PaidOrder | null>(null);
  const [selectedPaidOrderItems, setSelectedPaidOrderItems] = useState<OrderItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [modalSearchText, setModalSearchText] = useState("");
  const [modalSelectedEmployee, setModalSelectedEmployee] = useState<string | undefined>(undefined);
  const [modalSelectedStatus, setModalSelectedStatus] = useState<string | undefined>(undefined);
  const [modalSelectedPaymentMethod, setModalSelectedPaymentMethod] = useState<string | undefined>(undefined);

  //Biến phân trang
  const [paginationOrderRefund, setpaginationOrderRefund] = useState({
    current: 1,
    pageSize: 10,
  });
  const [paginationOrderRefundSelect, setpaginationOrderRefundSelect] = useState({ current: 1, pageSize: 10 });

  // Helper: Format currency
  const formatCurrency = (value: MongoDecimal | number): string => {
    const numValue = typeof value === "object" && value.$numberDecimal ? parseFloat(value.$numberDecimal) : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  // Helper: Format date
  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString("vi-VN");
  };

  // Load refund orders (danh sách đơn đã hoàn trả)
  const loadRefundOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders/list-refund`, {
        params: { storeId },
        headers,
      });
      setRefundOrders(res.data.orders);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tải danh sách đơn hoàn trả",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load paid orders (danh sách đơn đã thanh toán + hoàn 1 phần - để tạo hoàn trả)
  const loadPaidOrders = async () => {
    setPaidLoading(true);
    try {
      // 🔴 FIX: Gọi API với status=paid,partially_refunded để lấy cả đơn chưa hoàn và đơn hoàn 1 phần
      const res = await axios.get(`${API_BASE}/orders/list-paid`, {
        params: {
          storeId,
          status: "paid,partially_refunded", // Lấy cả đơn paid + partially_refunded
        },
        headers,
      });
      setPaidOrders(res.data.orders);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tải danh sách đơn để hoàn trả",
      });
    } finally {
      setPaidLoading(false);
    }
  };

  // Load employees
  const loadEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/stores/${storeId}/employees`, {
        params: { deleted: false },
        headers,
      });
      setEmployees(res.data.employees || []);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Lỗi tải danh sách nhân viên",
      });
    }
  };

  // Load refund detail
  const loadRefundDetail = async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrderId(orderId);
    try {
      const res = await axios.get(`${API_BASE}/orders/order-refund/${orderId}`, {
        params: { storeId },
        headers,
      });
      setRefundDetail(res.data);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tải chi tiết đơn hoàn trả",
      });
      setRefundDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Load order items khi chọn đơn paid để hoàn trả
  const loadPaidOrderItems = async (orderId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/orders/order-refund/${orderId}`, {
        params: { storeId },
        headers,
      });
      setSelectedPaidOrderItems(res.data.orderItems || []);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi định dạng",
        text: "Lỗi tải chi tiết đơn hàng",
      });
      setSelectedPaidOrderItems([]);
    }
  };

  // Handle open refund modal
  const handleOpenRefundModal = async (order: PaidOrder) => {
    setSelectedPaidOrder(order);
    setPaidOrdersModalOpen(false);
    await loadPaidOrderItems(order._id);
    setRefundModalOpen(true);
    setSelectedProducts([]);
    form.resetFields();
  };

  // Submit refund
  const handleSubmitRefund = async (values: any) => {
    setLoading(true);
    if (selectedProducts.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Cảnh báo",
        text: "Vui lòng chọn ít nhất 1 sản phẩm để hoàn trả!",
      });
      return;
    }

    // Chuẩn bị items data
    const items: SelectedProductItem[] = selectedProducts.map((productId) => ({
      productId,
      quantity: values.items?.[productId]?.quantity || 1,
    }));

    // Tạo FormData để gửi cả file và data
    const formData = new FormData();

    // Append data
    formData.append("employeeId", values.employeeId);
    formData.append("refundReason", values.refundReason);
    formData.append("items", JSON.stringify(items));

    // Append files
    uploadedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await axios.post(`${API_BASE}/orders/${selectedPaidOrder!._id}/refund`, formData, {
        params: { storeId },
        headers: {
          ...headers,
          "Content-Type": "multipart/form-data",
        },
      });
      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Tạo đơn hoàn trả thành công!",
        timer: 2000, // tự đóng sau 2s
        showConfirmButton: false,
      });
      // Reset modal
      setRefundModalOpen(false);
      form.resetFields();
      setSelectedProducts([]);
      setEvidenceMedia([]);
      setUploadedFiles([]); // Reset files

      // Revoke preview URLs để tránh memory leak
      evidenceMedia.forEach((m) => {
        if (m.url.startsWith("blob:")) {
          URL.revokeObjectURL(m.url);
        }
      });

      loadRefundOrders(); // Reload danh sách
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tạo đơn hoàn trả",
      });
    } finally {
      setLoading(false); // Kết thúc loading
    }
  };

  // 5. Cleanup khi đóng modal
  const handleCloseRefundModal = () => {
    // Revoke preview URLs
    evidenceMedia.forEach((m) => {
      if (m.url.startsWith("blob:")) {
        URL.revokeObjectURL(m.url);
      }
    });

    setRefundModalOpen(false);
    form.resetFields();
    setSelectedProducts([]);
    setEvidenceMedia([]);
    setUploadedFiles([]);
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
      loadRefundOrders();
      loadEmployees();
    }
  }, [storeId]);

  // Filter refund orders ở ngoài
  const filteredOrders = refundOrders.filter((order) => {
    const matchSearch = searchText
      ? order._id.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.phone.includes(searchText)
      : true;

    const matchEmployee = selectedEmployee ? String(order.employeeId?._id || "N/A") === String(selectedEmployee) : true;

    // Filter by date range
    let matchDate = true;
    if (dateRange[0] && dateRange[1]) {
      const orderDate = dayjs(order.updatedAt);
      matchDate = orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
    }

    return matchSearch && matchEmployee && matchDate;
  });

  // Phần bộ lọc và tìm kiếm trong Modal của các đơn đã paid để tìm và trả nhanh hơn
  const filteredPaidOrders = paidOrders.filter((order) => {
    const matchSearch = modalSearchText
      ? order._id.toLowerCase().includes(modalSearchText.toLowerCase()) ||
        order.customer?.name.toLowerCase().includes(modalSearchText.toLowerCase()) ||
        order.customer?.phone.includes(modalSearchText)
      : true;

    const matchEmployee = modalSelectedEmployee ? order.employeeId?._id === modalSelectedEmployee : true;

    const matchStatus = modalSelectedStatus ? order.status === modalSelectedStatus : true;

    const matchPayment = modalSelectedPaymentMethod ? order.paymentMethod === modalSelectedPaymentMethod : true;

    return matchSearch && matchEmployee && matchStatus && matchPayment;
  });

  //Tính toán và hiển thị thông tin range Phân trang
  const paginationConfig = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => (
      <div>
        Đang xem{" "}
        <span style={{ color: "#1890ff", fontWeight: 600 }}>
          {range[0]} – {range[1]}
        </span>{" "}
        trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản phẩm
      </div>
    ),
  };

  return (
    <div style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
      <div className="flex flex-col sm:flex-row sm:items-center  mb-4 gap-3">
        <Title level={3} style={{ marginBottom: 24 }}>
          <RollbackOutlined /> Quản Lý Hoàn Trả Hàng
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
                <ShoppingOutlined />
                <span>Danh Sách Đơn Đã Hoàn Trả</span>
              </Space>
            }
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  loadPaidOrders();
                  setPaidOrdersModalOpen(true);
                }}
              >
                Tạo Đơn Trả Hàng
              </Button>
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
              />
              <Select placeholder="Lọc theo nhân viên" style={{ width: "100%" }} value={selectedEmployee} onChange={setSelectedEmployee} allowClear>
                {employees.map((emp) => (
                  <Option key={emp._id} value={emp._id}>
                    {emp.fullName}
                  </Option>
                ))}
              </Select>
            </Space>

            {/* Danh sách */}
            <Table
              dataSource={filteredOrders}
              rowKey="_id"
              loading={loading}
              pagination={{
                ...paginationConfig,
                current: paginationOrderRefund.current,
                pageSize: paginationOrderRefund.pageSize,
                onChange: (page, pageSize) => setpaginationOrderRefund({ current: page, pageSize }),
              }}
              size="small"
              scroll={{ y: 500 }}
              rowClassName={(record) => (record._id === selectedOrderId ? "ant-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => loadRefundDetail(record._id),
                style: { cursor: "pointer" },
              })}
              columns={[
                {
                  title: "Mã Đơn",
                  dataIndex: "_id",
                  key: "_id",
                  width: 120,
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
                      <Text strong>{record.customer?.name || "Trống!"}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.customer?.phone || "Trống!"}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: "Tổng Tiền",
                  dataIndex: "totalAmount",
                  key: "totalAmount",
                  align: "right",
                  width: 100,
                  render: (value) => <Text strong>{formatCurrency(value)}</Text>,
                },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  align: "center",
                  render: (status) => (
                    <Tag color={status === "refunded" ? "red" : "orange"}>{status === "refunded" ? "Hoàn Toàn Bộ" : "Hoàn 1 Phần"}</Tag>
                  ),
                },
                {
                  title: "Ngày Hoàn",
                  dataIndex: "updatedAt",
                  key: "updatedAt",
                  align: "center",
                  width: 100,
                  render: (date) => (
                    <Text
                      style={{
                        fontSize: 12,
                        color: "#2274efff",
                        fontWeight: "bold",
                      }}
                    >
                      {formatDate(date)}
                    </Text>
                  ),
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
                <span>Chi Tiết Đơn Hoàn Trả</span>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            {detailLoading ? (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <Spin size="large" />
              </div>
            ) : !refundDetail ? (
              <Empty description="Chọn một đơn hàng để xem chi tiết tại đây" />
            ) : (
              <div>
                {/* Thông tin đơn hàng gốc */}
                <Card type="inner" title={<Text strong>Thông Tin Đơn Hàng</Text>} style={{ marginBottom: 16 }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Mã Đơn">
                      <Text code copyable>
                        {refundDetail.order._id}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cửa Hàng">{refundDetail.order.storeId.name}</Descriptions.Item>
                    <Descriptions.Item label="Nhân Viên">
                      <Space>
                        <UserOutlined />
                        {refundDetail.order.employeeId?.fullName || "Trống"}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách Hàng">
                      {refundDetail.order.customer ? (
                        <Space direction="vertical" size={0}>
                          <Text strong>{refundDetail.order.customer.name}</Text>
                          <Text type="secondary">{refundDetail.order.customer.phone}</Text>
                        </Space>
                      ) : (
                        "Trống!"
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng Tiền">
                      <Text strong style={{ color: "#1890ff", fontSize: 16 }}>
                        {formatCurrency(refundDetail.order.totalAmount)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng Thái">
                      <Tag color={refundDetail.order.status === "refunded" ? "red" : "orange"}>
                        {refundDetail.order.status === "refunded" ? "Hoàn Toàn Bộ" : "Hoàn 1 Phần"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày Tạo" span={2}>
                      {formatDate(refundDetail.order.createdAt)}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                {/* Sản phẩm trong đơn gốc */}
                <Card type="inner" title={<Text strong>Sản Phẩm Trong Đơn Hàng Gốc</Text>} style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={refundDetail.orderItems}
                    rowKey="_id"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: "Mã SKU",
                        key: "sku",
                        width: 150,
                        render: (_, record) => <Text code>{record.productId.sku}</Text>,
                      },
                      {
                        title: "Sản Phẩm",
                        key: "name",
                        render: (_, record) => <Text strong>{record.productId.name}</Text>,
                      },
                      {
                        title: "Số lượng",
                        dataIndex: "quantity",
                        key: "quantity",
                        align: "center",
                        width: 100,
                      },
                      {
                        title: "Đơn Giá",
                        dataIndex: "priceAtTime",
                        key: "priceAtTime",
                        align: "right",
                        render: (value) => formatCurrency(value),
                      },
                      {
                        title: "Thành Tiền",
                        dataIndex: "subtotal",
                        key: "subtotal",
                        align: "right",
                        render: (value) => <Text strong>{formatCurrency(value)}</Text>,
                      },
                    ]}
                  />
                </Card>

                {/* Thông tin hoàn trả */}
                <Card
                  type="inner"
                  title={
                    <Text strong style={{ color: "#ff4d4f" }}>
                      Chi Tiết Hoàn Trả
                    </Text>
                  }
                  style={{ borderColor: "#ffccc7" }}
                >
                  <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="Nhân Viên Xử Lý">
                      <Space>
                        <UserOutlined />
                        {refundDetail?.refundDetail?.refundedBy?.fullName || "Trống"}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời Gian">{formatDate(refundDetail?.refundDetail?.refundedAt)}</Descriptions.Item>
                    <Descriptions.Item label="Tổng Tiền Hoàn" span={2}>
                      <Text strong style={{ color: "#ff4d4f", fontSize: 18 }}>
                        {formatCurrency(refundDetail?.refundDetail?.refundAmount)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Lý Do" span={2}>
                      <Text>{refundDetail?.refundDetail?.refundReason}</Text>
                    </Descriptions.Item>
                  </Descriptions>

                  <Divider />

                  <Text strong>Sản Phẩm Đã Hoàn:</Text>
                  <Table
                    dataSource={refundDetail?.refundDetail?.refundItems}
                    rowKey="_id"
                    pagination={false}
                    size="small"
                    style={{ marginTop: 12 }}
                    columns={[
                      {
                        title: "Mã SKU",
                        key: "sku",
                        width: 150,
                        render: (_, record) => <Text code>{record.productId.sku}</Text>,
                      },
                      {
                        title: "Sản Phẩm",
                        key: "name",
                        render: (_, record) => <Text strong>{record.productId.name}</Text>,
                      },
                      {
                        title: "Số lượng Hoàn",
                        dataIndex: "quantity",
                        key: "quantity",
                        align: "center",
                        width: 120,
                        render: (value) => <Tag color="red">{value}</Tag>,
                      },
                      {
                        title: "Tiền Hoàn",
                        dataIndex: "subtotal",
                        key: "subtotal",
                        align: "right",
                        render: (value) => (
                          <Text strong style={{ color: "#ff4d4f" }}>
                            {formatCurrency(value)}
                          </Text>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* MODAL: Danh sách đơn đã thanh toán */}
      <Modal
        title={
          <Space>
            <ShoppingOutlined />
            <span>Chọn Đơn Hàng Cần Hoàn Trả</span>
          </Space>
        }
        open={paidOrdersModalOpen}
        onCancel={() => {
          setPaidOrdersModalOpen(false);
          // Reset search khi đóng modal
          setModalSearchText("");
          setModalSelectedEmployee(undefined);
        }}
        footer={null}
        width={1200}
      >
        {/* Thêm bộ lọc trong Modal */}
        <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <Input
            placeholder="Tìm mã đơn hàng, tên khách, SĐT..."
            prefix={<SearchOutlined />}
            value={modalSearchText}
            onChange={(e) => setModalSearchText(e.target.value)}
            allowClear
            style={{ width: "100%" }}
          />
          {/* 3 bộ lọc chia đều 3 cột */}
          <Row gutter={12}>
            <Col span={8}>
              <Select
                placeholder="Lọc theo nhân viên bán hàng"
                style={{ width: "100%" }}
                value={modalSelectedEmployee}
                onChange={setModalSelectedEmployee}
                allowClear
              >
                {employees.map((emp) => (
                  <Option key={emp._id} value={emp._id}>
                    <UserOutlined /> {emp.fullName}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col span={8}>
              <Select
                placeholder="Lọc theo trạng thái"
                style={{ width: "100%" }}
                value={modalSelectedStatus}
                onChange={setModalSelectedStatus}
                allowClear
              >
                <Option value="paid">
                  <Tag color="green">Đã Thanh Toán</Tag>
                </Option>
                <Option value="partially_refunded">
                  <Tag color="orange">Hoàn 1 Phần</Tag>
                </Option>
              </Select>
            </Col>

            <Col span={8}>
              <Select
                placeholder="Lọc theo phương thức"
                style={{ width: "100%" }}
                value={modalSelectedPaymentMethod}
                onChange={setModalSelectedPaymentMethod}
                allowClear
              >
                <Option value="cash">
                  <Tag color="green">Tiền Mặt</Tag>
                </Option>
                <Option value="qr">
                  <Tag color="blue">QRCode</Tag>
                </Option>
              </Select>
            </Col>
          </Row>
        </Space>

        <Table
          dataSource={filteredPaidOrders}
          rowKey="_id"
          loading={paidLoading}
          pagination={{
            ...paginationConfig,
            current: paginationOrderRefundSelect.current,
            pageSize: paginationOrderRefundSelect.pageSize,
            onChange: (page, pageSize) => setpaginationOrderRefundSelect({ current: page, pageSize }),
          }}
          columns={[
            {
              title: "Mã Đơn",
              dataIndex: "_id",
              key: "_id",
              render: (text) => <Text code>{text.slice(-8)}</Text>,
            },
            {
              title: "Khách Hàng",
              key: "customer",
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{record.customer?.name || "Trống!"}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.customer?.phone || "Trống!"}
                  </Text>
                </Space>
              ),
            },
            {
              title: "Nhân viên bán hàng",
              key: "employee",
              render: (_, record) => <Space>{record.employeeId?.fullName || "Trống"}</Space>,
            },
            {
              title: "Phương thức",
              dataIndex: "paymentMethod",
              key: "paymentMethod",
              align: "center",
              render: (method) => <Tag color={method === "cash" ? "green" : "blue"}>{method === "cash" ? "Tiền Mặt" : "QRCode"}</Tag>,
            },
            {
              title: "Tổng Tiền",
              dataIndex: "totalAmount",
              key: "totalAmount",
              align: "right",
              render: (value) => <Text strong>{formatCurrency(value)}</Text>,
            },
            // === CỘT MỚI: TRẠNG THÁI (thêm vào đây) ===
            {
              title: "Trạng Thái",
              dataIndex: "status",
              key: "status",
              align: "center",
              render: (status) => <Tag color={status === "paid" ? "green" : "orange"}>{status === "paid" ? "Đã Thanh Toán" : "Hoàn 1 Phần"}</Tag>,
            },
            {
              title: "Ngày Tạo",
              dataIndex: "createdAt",
              key: "createdAt",
              align: "center",
              width: 105,
              render: (date) => <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>,
            },
            {
              title: "Thao tác",
              key: "action",
              align: "center",
              render: (_, record) => (
                <Button type="primary" danger onClick={() => handleOpenRefundModal(record)}>
                  Trả Hàng
                </Button>
              ),
            },
          ]}
        />
      </Modal>

      {/* MODAL: Form tạo đơn hoàn trả */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: "#ff4d4f" }} />
            <span>Tạo Đơn Hoàn Trả</span>
          </Space>
        }
        open={refundModalOpen}
        onCancel={() => {
          setRefundModalOpen(false);
          form.resetFields();
          setSelectedProducts([]);
        }}
        footer={null}
        width={800}
      >
        {selectedPaidOrder && (
          <>
            <Card type="inner" style={{ marginBottom: 16, background: "#f5f5f5" }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Mã Đơn">
                  <Text code>{selectedPaidOrder._id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tổng Tiền">
                  <Text strong style={{ color: "#1890ff" }}>
                    {formatCurrency(selectedPaidOrder.totalAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Khách Hàng">{selectedPaidOrder.customer?.name || "Trống!"}</Descriptions.Item>
                <Descriptions.Item label="SĐT">{selectedPaidOrder.customer?.phone || "Trống!"}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Form form={form} layout="vertical" onFinish={handleSubmitRefund}>
              <Form.Item name="employeeId" label="Nhân Viên Xử Lý" rules={[{ required: true, message: "Vui lòng chọn nhân viên!" }]}>
                <Select placeholder="Chọn nhân viên xử lý hoàn trả">
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      <UserOutlined /> {emp?.fullName || "Chủ cửa hàng"}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="refundReason" label="Lý Do Hoàn Trả" rules={[{ required: true, message: "Vui lòng nhập lý do!" }]}>
                <TextArea rows={3} placeholder="Mô tả rõ lý do khách hoàn trả hàng (nếu có)..." maxLength={500} showCount />
              </Form.Item>
              {/* Upload ảnh hoặc video     */}
              <Form.Item label="Ảnh/Video minh chứng (tùy chọn)">
                <Upload
                  listType="picture-card"
                  multiple
                  accept="image/jpg,image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/mov,video/avi,video/mkv,video/webm"
                  fileList={evidenceMedia.map((m, idx) => ({
                    uid: `${idx}`,
                    name: m.type === "image" ? `image-${idx}` : `video-${idx}`,
                    status: "done" as const,
                    url: m.url,
                  }))}
                  beforeUpload={(file) => {
                    // Kiểm tra loại file
                    const isImage = file.type.startsWith("image/");
                    const isVideo = file.type.startsWith("video/");

                    if (!isImage && !isVideo) {
                      Swal.fire({
                        icon: "error",
                        title: "Cảnh báo",
                        text: "Chỉ được chọn ảnh hoặc video!",
                      });

                      return Upload.LIST_IGNORE;
                    }

                    // Kiểm tra định dạng ảnh
                    const validImageFormats = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
                    const validVideoFormats = ["mp4", "mov", "avi", "mkv", "webm"];
                    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";

                    if (isImage && !validImageFormats.includes(fileExt)) {
                      Swal.fire({
                        icon: "error",
                        title: "Lỗi định dạng",
                        text: `Định dạng ảnh không hợp lệ! Chỉ chấp nhận: ${validImageFormats.join(", ")}`,
                      });
                      return Upload.LIST_IGNORE;
                    }

                    if (isVideo && !validVideoFormats.includes(fileExt)) {
                      Swal.fire({
                        icon: "error",
                        title: "Lỗi định dạng",
                        text: `Định dạng video không hợp lệ! Chỉ chấp nhận: ${validVideoFormats.join(", ")}`,
                      });
                      return Upload.LIST_IGNORE;
                    }

                    // Kiểm tra số lượng tối đa
                    if (evidenceMedia.length >= 5) {
                      Swal.fire({
                        icon: "warning",
                        title: "Cảnh báo",
                        text: "Tải lên tối đa 5 file!",
                      });
                      return Upload.LIST_IGNORE;
                    }

                    // Tạo preview URL local
                    const previewUrl = URL.createObjectURL(file);
                    const type = isImage ? "image" : "video";

                    // Lưu file thật vào state
                    setUploadedFiles((prev) => [...prev, file]);

                    // Lưu preview vào evidenceMedia (không có public_id)
                    const newMedia: EvidenceMedia = {
                      url: previewUrl,
                      type,
                      // public_id sẽ có sau khi upload lên server
                    };
                    setEvidenceMedia((prev) => [...prev, newMedia]);

                    // Không upload ngay, sẽ gửi cùng form
                    return false;
                  }}
                  onRemove={(file) => {
                    const index = parseInt(file.uid);

                    // Xóa khỏi evidenceMedia
                    setEvidenceMedia((prev) => prev.filter((_, i) => i !== index));

                    // Xóa khỏi uploadedFiles
                    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
                  }}
                  showUploadList={{
                    showRemoveIcon: true,
                    showPreviewIcon: false,
                  }}
                >
                  {evidenceMedia.length >= 5 ? null : (
                    <div>
                      <PlusOutlined />
                      <div style={{ marginTop: 8 }}>Thêm</div>
                    </div>
                  )}
                </Upload>

                {/* Preview nhanh */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  {evidenceMedia.map((m, idx) =>
                    m.type === "image" ? (
                      <img
                        key={idx}
                        src={m.url}
                        alt={`media-${idx}`}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          objectFit: "cover",
                          border: "1px solid #d9d9d9",
                        }}
                      />
                    ) : (
                      <video
                        key={idx}
                        src={m.url}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          objectFit: "cover",
                          border: "1px solid #d9d9d9",
                        }}
                        muted
                      />
                    )
                  )}
                </div>

                {evidenceMedia.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                    Đã chọn {evidenceMedia.length}/5 file
                  </Text>
                )}
              </Form.Item>
              {/* Hết upload ảnh/video */}
              <Form.Item label="Chọn Sản Phẩm Hoàn Trả" required>
                <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  Chọn sản phẩm và nhập số lượng cần hoàn
                </Text>

                {/* Danh sách sản phẩm trong đơn */}
                <div
                  style={{
                    maxHeight: 300,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 12,
                  }}
                >
                  {selectedPaidOrderItems.map((item) => (
                    <Card key={item._id} size="small" style={{ marginBottom: 8 }} bodyStyle={{ padding: 12 }}>
                      <Row align="middle" gutter={16}>
                        <Col flex="auto">
                          <Space direction="vertical" size={0}>
                            <Text strong>{item.productId.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Mã SKU: {item.productId.sku} | Đơn giá: {formatCurrency(item.priceAtTime)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Số lượng đã mua: <Tag color="blue">{item.quantity}</Tag>
                            </Text>
                          </Space>
                        </Col>
                        <Col>
                          <Checkbox
                            checked={selectedProducts.includes(item.productId._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([...selectedProducts, item.productId._id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter((id) => id !== item.productId._id));
                              }
                            }}
                          >
                            Hoàn trả
                          </Checkbox>
                        </Col>
                        {selectedProducts.includes(item.productId._id) && (
                          <Col>
                            <Form.Item
                              name={["items", item.productId._id, "quantity"]}
                              style={{ margin: 0 }}
                              rules={[
                                { required: true, message: "Nhập số lượng!" },
                                {
                                  type: "number",
                                  min: 1,
                                  max: item.quantity,
                                  message: `Tối đa ${item.quantity}`,
                                },
                              ]}
                            >
                              <InputNumber min={1} max={item.quantity} placeholder="SL hoàn" style={{ width: 100 }} />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>
                    </Card>
                  ))}
                </div>
              </Form.Item>

              <Divider />

              <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                <Space>
                  <Button onClick={handleCloseRefundModal}>Hủy</Button>
                  <Button
                    type="primary"
                    danger
                    htmlType="submit"
                    icon={loading ? <LoadingOutlined spin /> : <CheckCircleOutlined />}
                    disabled={selectedProducts.length === 0 || loading}
                  >
                    {loading ? "Đang xử lý..." : "Xác Nhận Hoàn Trả"}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default OrderRefund;
