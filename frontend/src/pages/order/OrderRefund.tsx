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
  user_id?: string;
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

// Interface cho Đơn gốc (dùng khi chọn đơn để tạo hoàn trả)
interface PaidOrder {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  paymentMethod: string;
  status: "paid" | "partially_refunded" | "refunded";
  createdAt: string;
  updatedAt: string;
}

// ✅ INTERFACE MỚI: Khớp với Schema OrderRefund
// Dùng cho danh sách lịch sử hoàn trả
interface RefundOrder {
  _id: string; // ID của giao dịch hoàn trả
  // orderId được populate, chứa thông tin đơn gốc
  orderId: {
    _id: string;
    totalAmount: MongoDecimal;
    customer?: Customer;
    storeId: Store;
    status: string;
  };
  refundAmount: MongoDecimal; // Số tiền hoàn
  refundReason: string;
  refundedBy: Employee;
  status: "refunded" | "partially_refunded"; // Thường lấy từ đơn gốc hoặc logic FE
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
  // Chi tiết trả về từ API detail
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

interface RefundSummary {
  totalOrderAmount: MongoDecimal;
  totalRefundedAmount: number;
  totalRefundedQty: number;
  totalOrderQty: number;
  remainingRefundableQty: number;
  refundCount: number;
  orderStatus: string;
}

interface OrderItemWithRefundable extends OrderItem {
  refundedQuantity: number;
  maxRefundableQuantity: number;
}

interface OrderRefundDetailResponse {
  message: string;
  order: PaidOrder;
  refundDetail: RefundDetail;
  refundRecords: RefundDetail[];
  orderItems: OrderItemWithRefundable[];
  summary: RefundSummary;
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
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>(
    undefined
  );
  const [selectedSalesperson, setSelectedSalesperson] = useState<string | undefined>(
    undefined
  );

  // State lưu danh sách đơn hoàn (theo interface mới)
  const [refundOrders, setRefundOrders] = useState<RefundOrder[]>([]);

  const [paidOrders, setPaidOrders] = useState<PaidOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null); // Highlight row
  const [refundDetail, setRefundDetail] =
    useState<OrderRefundDetailResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);

  const [evidenceMedia, setEvidenceMedia] = useState<EvidenceMedia[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Các Modal states
  const [paidOrdersModalOpen, setPaidOrdersModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedPaidOrder, setSelectedPaidOrder] = useState<PaidOrder | null>(
    null
  );
  const [selectedPaidOrderItems, setSelectedPaidOrderItems] = useState<
    OrderItem[]
  >([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [modalSearchText, setModalSearchText] = useState("");
  const [modalSelectedEmployee, setModalSelectedEmployee] = useState<
    string | undefined
  >(undefined);
  const [modalSelectedStatus, setModalSelectedStatus] = useState<
    string | undefined
  >(undefined);
  const [modalSelectedPaymentMethod, setModalSelectedPaymentMethod] = useState<
    string | undefined
  >(undefined);

  //Biến phân trang
  const [paginationOrderRefund, setpaginationOrderRefund] = useState({
    current: 1,
    pageSize: 10,
  });
  const [paginationOrderRefundSelect, setpaginationOrderRefundSelect] =
    useState({ current: 1, pageSize: 10 });

  // ✅ Helper Format currency an toàn
  const formatCurrency = (value: any): string => {
    if (value === undefined || value === null) return "0₫";
    const numValue =
      typeof value === "object" && value.$numberDecimal
        ? parseFloat(value.$numberDecimal)
        : Number(value);

    if (isNaN(numValue)) return "0₫";
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  const formatDate = (date: string): string => {
    if (!date) return "";
    return new Date(date).toLocaleString("vi-VN");
  };

  // Load refund orders (Danh sách lịch sử hoàn)
  const loadRefundOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders/list-refund`, {
        params: { storeId },
        headers,
      });
      console.log("Dữ liệu đơn hoàn trả:", res.data.orders);
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

  // Load paid orders (Để tạo đơn mới)
  const loadPaidOrders = async () => {
    setPaidLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders/list-paid`, {
        params: {
          storeId,
          status: "paid,partially_refunded",
        },
        headers,
      });
      setPaidOrders(res.data.orders);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text:
          err.response?.data?.message || "Lỗi tải danh sách đơn để hoàn trả",
      });
    } finally {
      setPaidLoading(false);
    }
  };

  const normalizeEmployee = (emp: any): Employee => ({
    _id: String(emp?._id ?? emp?.id ?? ""),
    fullName: emp?.fullName ?? emp?.full_name ?? emp?.name ?? "Nhân viên",
    user_id: emp?.user_id?.toString?.() ?? emp?.userId?.toString?.(),
  });

  const loadEmployees = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await axios.get(`${API_BASE}/stores/${storeId}/employees`, {
        params: { deleted: false },
        headers,
      });
      const apiEmployees: Employee[] = Array.isArray(res.data?.employees)
        ? res.data.employees.map(normalizeEmployee).filter((e: any) => e._id)
        : [];
      setEmployees(apiEmployees);
    } catch (err: any) {
      console.error(" Load employees error:", err);
      setEmployees([]);
    }
  };

  // Load chi tiết (Khi click vào row)
  // Lưu ý: record._id là Refund ID, nhưng API detail cũ có thể cần Order ID.
  // Ta lấy OrderID từ record.orderId._id
  const loadRefundDetail = async (refundRecord: RefundOrder) => {
    setDetailLoading(true);
    setSelectedRefundId(refundRecord._id); // Highlight dòng

    // Lấy ID đơn gốc từ object orderId đã populate
    const originalOrderId = refundRecord.orderId?._id;

    try {
      // Gọi API lấy chi tiết theo Order ID (dựa trên logic cũ của bạn)
      // Nếu bạn đã sửa API detail để nhận RefundID thì đổi ở đây
      const res = await axios.get(
        `${API_BASE}/orders/order-refund/${originalOrderId}`,
        {
          params: { storeId },
          headers,
        }
      );
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

  const loadPaidOrderItems = async (orderId: string) => {
    try {
      const res = await axios.get(
        `${API_BASE}/orders/order-refund/${orderId}`,
        {
          params: { storeId },
          headers,
        }
      );
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

  const handleOpenRefundModal = async (order: PaidOrder) => {
    setSelectedPaidOrder(order);
    setPaidOrdersModalOpen(false);
    await loadPaidOrderItems(order._id);
    setRefundModalOpen(true);
    setSelectedProducts([]);
    form.resetFields();
  };

  const handleSubmitRefund = async (values: any) => {
    setLoading(true);
    if (selectedProducts.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Cảnh báo",
        text: "Vui lòng chọn ít nhất 1 sản phẩm để hoàn trả!",
      });
      setLoading(false);
      return;
    }

    const items: SelectedProductItem[] = selectedProducts.map((productId) => ({
      productId,
      quantity: values.items?.[productId]?.quantity || 1,
    }));

    const formData = new FormData();
    if (values.employeeId) {
      formData.append("employeeId", values.employeeId);
    }
    formData.append("refundReason", values.refundReason);
    formData.append("items", JSON.stringify(items));
    uploadedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      await axios.post(
        `${API_BASE}/orders/${selectedPaidOrder!._id}/refund`,
        formData,
        {
          params: { storeId },
          headers: {
            ...headers,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Tạo đơn hoàn trả thành công!",
        timer: 2000,
        showConfirmButton: false,
      });
      setRefundModalOpen(false);
      form.resetFields();
      setSelectedProducts([]);
      setEvidenceMedia([]);
      setUploadedFiles([]);
      evidenceMedia.forEach((m) => {
        if (m.url.startsWith("blob:")) URL.revokeObjectURL(m.url);
      });
      loadRefundOrders();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: err.response?.data?.message || "Lỗi tạo đơn hoàn trả",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRefundModal = () => {
    evidenceMedia.forEach((m) => {
      if (m.url.startsWith("blob:")) URL.revokeObjectURL(m.url);
    });
    setRefundModalOpen(false);
    form.resetFields();
    setSelectedProducts([]);
    setEvidenceMedia([]);
    setUploadedFiles([]);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // ✅ LOGIC FILTER MỚI: Truy cập vào nested object orderId
  const filteredOrders = refundOrders.filter((refund) => {
    // Thông tin nằm trong object orderId
    const customerName = refund.orderId?.customer?.name || "Khách vãng lai";
    const customerPhone = refund.orderId?.customer?.phone || "";
    const orderCode = refund.orderId?._id || "";

    const matchSearch = searchText
      ? orderCode.toLowerCase().includes(searchText.toLowerCase()) ||
        customerName.toLowerCase().includes(searchText.toLowerCase()) ||
        customerPhone.includes(searchText)
      : true;

    // Filter theo người xử lý hoàn
    let matchEmployee = true;
    if (selectedEmployee) {
      if (selectedEmployee === "owner") {
        // Chủ cửa hàng = refundedBy là null
        matchEmployee = !refund.refundedBy || !refund.refundedBy._id;
      } else {
        matchEmployee = String(refund.refundedBy?._id || "") === String(selectedEmployee);
      }
    }

    // Filter theo nhân viên bán hàng gốc
    let matchSalesperson = true;
    if (selectedSalesperson) {
      const orderEmpId = (refund.orderId as any)?.employeeId?._id;
      if (selectedSalesperson === "owner") {
        matchSalesperson = !orderEmpId;
      } else {
        matchSalesperson = String(orderEmpId || "") === String(selectedSalesperson);
      }
    }

    let matchDate = true;
    if (dateRange[0] && dateRange[1]) {
      const orderDate = dayjs(refund.createdAt); // Dùng ngày tạo phiếu hoàn
      matchDate =
        orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
    }
    return matchSearch && matchEmployee && matchSalesperson && matchDate;
  });

  const filteredPaidOrders = paidOrders.filter((order) => {
    const customerName = order.customer?.name || "Khách vãng lai";
    const customerPhone = order.customer?.phone || "";

    const matchSearch = modalSearchText
      ? order._id.toLowerCase().includes(modalSearchText.toLowerCase()) ||
        customerName.toLowerCase().includes(modalSearchText.toLowerCase()) ||
        customerPhone.includes(modalSearchText)
      : true;

    // Filter theo nhân viên bán hàng
    let matchEmployee = true;
    if (modalSelectedEmployee) {
      if (modalSelectedEmployee === "owner") {
        matchEmployee = !order.employeeId || !order.employeeId._id;
      } else {
        matchEmployee = order.employeeId?._id === modalSelectedEmployee;
      }
    }

    const matchStatus = modalSelectedStatus
      ? order.status === modalSelectedStatus
      : true;
    const matchPayment = modalSelectedPaymentMethod
      ? order.paymentMethod === modalSelectedPaymentMethod
      : true;
    return matchSearch && matchEmployee && matchStatus && matchPayment;
  });

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
        trên tổng số{" "}
        <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> sản
        phẩm
      </div>
    ),
  };

  return (
    <div style={{ padding: 24, background: "#f0f2f5", minHeight: "100vh" }}>
      <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3">
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
        {/* PANEL TRÁI: DANH SÁCH HOÀN TRẢ */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ShoppingOutlined />
                <span>Lịch Sử Hoàn Trả</span>
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
            <Space
              direction="vertical"
              style={{ width: "100%", marginBottom: 16 }}
            >
              <Input
                placeholder="Tìm mã đơn gốc, tên khách, SĐT..."
                prefix={<SearchOutlined />}
                onChange={(e) => debouncedSearch(e.target.value)}
                allowClear
              />
              <RangePicker
                style={{ width: "100%" }}
                placeholder={["Từ ngày", "Đến ngày"]}
                format="DD/MM/YYYY"
                onChange={(dates) => {
                  if (!dates) setDateRange([null, null]);
                  else setDateRange(dates as [Dayjs | null, Dayjs | null]);
                }}
              />
              <Select
                placeholder="Người thực hiện hoàn"
                style={{ width: "100%" }}
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                allowClear
              >
                <Option value="owner">
                  <UserOutlined /> Chủ cửa hàng
                </Option>
                {employees.map((emp) => (
                  <Option key={emp._id} value={emp._id}>
                    {emp.fullName}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="Nhân viên bán hàng gốc"
                style={{ width: "100%" }}
                value={selectedSalesperson}
                onChange={setSelectedSalesperson}
                allowClear
              >
                <Option value="owner">
                  <UserOutlined /> Chủ cửa hàng
                </Option>
                {employees.map((emp) => (
                  <Option key={emp._id} value={emp._id}>
                    {emp.fullName}
                  </Option>
                ))}
              </Select>
            </Space>

            <Table
              dataSource={filteredOrders}
              rowKey="_id"
              loading={loading}
              pagination={{
                ...paginationConfig,
                current: paginationOrderRefund.current,
                pageSize: paginationOrderRefund.pageSize,
                onChange: (page, pageSize) =>
                  setpaginationOrderRefund({ current: page, pageSize }),
              }}
              size="small"
              scroll={{ y: 500 }}
              rowClassName={(record) =>
                record._id === selectedRefundId ? "ant-table-row-selected" : ""
              }
              onRow={(record) => ({
                onClick: () => loadRefundDetail(record),
                style: { cursor: "pointer" },
              })}
              columns={[
                {
                  title: "Mã Đơn Gốc",
                  // Truy cập vào nested object orderId._id
                  dataIndex: ["orderId", "_id"],
                  key: "orderId",
                  width: 120,
                  render: (text) => (
                    <Text code copyable>
                      {text ? text.slice(-8) : "---"}
                    </Text>
                  ),
                },
                {
                  title: "Khách Hàng",
                  key: "customer",
                  render: (_: any, record: RefundOrder) => {
                    const cust = record.orderId?.customer;
                    return (
                      <Space direction="vertical" size={0}>
                        <Text strong>{cust?.name || "Khách vãng lai"}</Text>
                        {cust?.phone && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {cust.phone}
                          </Text>
                        )}
                      </Space>
                    );
                  },
                },
                {
                  title: "NV Thực Hiện",
                  key: "refundedBy",
                  render: (_: any, record: RefundOrder) => (
                    <Text type="secondary">
                       {record.refundedBy?.fullName || "Chủ cửa hàng"}
                    </Text>
                  ),
                },
                {
                  title: "NV Bán Gốc",
                  key: "salesperson",
                  render: (_: any, record: RefundOrder) => {
                    const emp = (record.orderId as any)?.employeeId;
                    return (
                      <Text type="secondary">
                        {emp?.fullName || "Chủ cửa hàng"}
                      </Text>
                    );
                  },
                },
                {
                  title: "Tiền Hoàn",
                  // ✅ Lấy trực tiếp refundAmount từ bảng Refund
                  dataIndex: "refundAmount",
                  key: "refundAmount",
                  align: "right",
                  width: 110,
                  render: (value: any) => (
                    <Text strong style={{ color: "#ff4d4f" }}>
                      {formatCurrency(value)}
                    </Text>
                  ),
                },
                {
                  title: "Ngày Hoàn",
                  dataIndex: "createdAt",
                  key: "createdAt",
                  align: "center",
                  width: 100,
                  render: (date: any) => (
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

        {/* PANEL PHẢI: CHI TIẾT */}
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
              <Empty description="Chọn một đơn hàng bên trái để xem chi tiết" />
            ) : (
              <div>
                <Card
                  type="inner"
                  title={<Text strong>Thông Tin Đơn Hàng Gốc</Text>}
                  style={{ marginBottom: 16 }}
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Mã Đơn">
                      <Text code copyable>
                        {refundDetail.order._id}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cửa Hàng">
                      {refundDetail.order.storeId.name}
                    </Descriptions.Item>
                    <Descriptions.Item label="Nhân Viên Bán">
                      <Space>
                        <UserOutlined />
                        {refundDetail.order.employeeId?.fullName || "Chủ cửa hàng"}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Khách Hàng">
                      {/* FIX: Hiển thị Khách vãng lai */}
                      {refundDetail.order.customer ? (
                        <Space direction="vertical" size={0}>
                          <Text strong>{refundDetail.order.customer.name}</Text>
                          <Text type="secondary">
                            {refundDetail.order.customer.phone}
                          </Text>
                        </Space>
                      ) : (
                        <Text strong>Khách vãng lai</Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng Tiền Gốc">
                      <Text strong style={{ color: "#1890ff", fontSize: 16 }}>
                        {formatCurrency(refundDetail.order.totalAmount)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Trạng Thái">
                      <Tag
                        color={
                          refundDetail.order.status === "refunded"
                            ? "red"
                            : refundDetail.order.status === "partially_refunded"
                            ? "orange"
                            : "green"
                        }
                      >
                        {refundDetail.order.status === "refunded"
                          ? "Hoàn toàn bộ"
                          : refundDetail.order.status === "partially_refunded"
                          ? "Hoàn 1 phần"
                          : "Đã thanh toán"}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày Tạo" span={2}>
                      {formatDate(refundDetail.order.createdAt)}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card
                  type="inner"
                  title={
                    <Text strong style={{ color: "#ff4d4f" }}>
                      Chi Tiết Phiếu Hoàn
                    </Text>
                  }
                  style={{ borderColor: "#ffccc7" }}
                >
                  <Descriptions
                    column={2}
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <Descriptions.Item label="Người Xử Lý">
                      <Space>
                        <UserOutlined />
                        {(refundDetail?.refundDetail as any)?.refundedByName ||
                          refundDetail?.refundDetail?.refundedBy?.fullName ||
                          "Chủ cửa hàng"}
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời Gian Hoàn">
                      {formatDate(refundDetail?.refundDetail?.refundedAt)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tổng Tiền Hoàn" span={2}>
                      <Text strong style={{ color: "#ff4d4f", fontSize: 18 }}>
                        {formatCurrency(
                          refundDetail?.refundDetail?.refundAmount
                        )}
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
                        render: (_: any, record: RefundItem) => (
                          <Text code>{record.productId.sku}</Text>
                        ),
                      },
                      {
                        title: "Sản Phẩm",
                        key: "name",
                        render: (_: any, record: RefundItem) => (
                          <Text strong>{record.productId.name}</Text>
                        ),
                      },
                      {
                        title: "SL Hoàn",
                        dataIndex: "quantity",
                        key: "quantity",
                        align: "center",
                        width: 100,
                        render: (value: any) => <Tag color="red">{value}</Tag>,
                      },
                      {
                        title: "Tiền Hoàn",
                        dataIndex: "subtotal",
                        key: "subtotal",
                        align: "right",
                        render: (value: any) => (
                          <Text strong style={{ color: "#ff4d4f" }}>
                            {formatCurrency(value)}
                          </Text>
                        ),
                      },
                    ]}
                  />

                  {/* Hiển thị Media nếu có */}
                  {refundDetail?.refundDetail?.evidenceMedia &&
                    refundDetail.refundDetail.evidenceMedia.length > 0 && (
                      <>
                        <Divider orientation="left" style={{ fontSize: 14 }}>
                          Minh chứng
                        </Divider>
                        <Space wrap>
                          {refundDetail.refundDetail.evidenceMedia.map(
                            (media, idx) =>
                              media.type === "image" ? (
                                <img
                                  key={idx}
                                  src={media.url}
                                  style={{
                                    height: 100,
                                    border: "1px solid #ddd",
                                    borderRadius: 4,
                                  }}
                                  alt="Evidence"
                                />
                              ) : (
                                <video
                                  key={idx}
                                  src={media.url}
                                  controls
                                  style={{ height: 100 }}
                                />
                              )
                          )}
                        </Space>
                      </>
                    )}
                </Card>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* MODAL: Danh sách đơn đã thanh toán (ĐỂ TẠO MỚI) */}
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
          setModalSearchText("");
          setModalSelectedEmployee(undefined);
        }}
        footer={null}
        width={1200}
      >
        <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
          <Input
            placeholder="Tìm mã đơn hàng, tên khách, SĐT..."
            prefix={<SearchOutlined />}
            value={modalSearchText}
            onChange={(e) => setModalSearchText(e.target.value)}
            allowClear
            style={{ width: "100%" }}
          />

          <Row gutter={12}>
            <Col span={8}>
              <Select
                placeholder="Lọc theo nhân viên bán hàng"
                style={{ width: "100%" }}
                value={modalSelectedEmployee}
                onChange={setModalSelectedEmployee}
                allowClear
              >
                <Option value="owner">
                  <UserOutlined /> Chủ cửa hàng
                </Option>
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
            onChange: (page, pageSize) =>
              setpaginationOrderRefundSelect({ current: page, pageSize }),
          }}
          columns={[
            {
              title: "Mã Đơn",
              dataIndex: "_id",
              key: "_id",
              render: (text: string) => <Text code>{text.slice(-8)}</Text>,
            },
            {
              title: "Khách Hàng",
              key: "customer",
              render: (_: any, record: PaidOrder) => (
                <Space direction="vertical" size={0}>
                  {/* FIX: Hiển thị Khách vãng lai */}
                  <Text strong>
                    {record.customer?.name || "Khách vãng lai"}
                  </Text>
                  {record.customer?.phone && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {record.customer.phone}
                    </Text>
                  )}
                </Space>
              ),
            },
            {
              title: "Nhân viên bán hàng",
              key: "employee",
              render: (_: any, record: PaidOrder) => (
                <Space>{record.employeeId?.fullName || "Chủ cửa hàng"}</Space>
              ),
            },
            {
              title: "Phương thức",
              dataIndex: "paymentMethod",
              key: "paymentMethod",
              align: "center",
              render: (method: string) => (
                <Tag color={method === "cash" ? "green" : "blue"}>
                  {method === "cash" ? "Tiền Mặt" : "QRCode"}
                </Tag>
              ),
            },
            {
              title: "Tổng Tiền",
              dataIndex: "totalAmount",
              key: "totalAmount",
              align: "right",
              render: (value: any) => (
                <Text strong>{formatCurrency(value)}</Text>
              ),
            },
            {
              title: "Trạng Thái",
              dataIndex: "status",
              key: "status",
              align: "center",
              render: (status: any) => (
                <Tag color={status === "paid" ? "green" : "orange"}>
                  {status === "paid" ? "Đã Thanh Toán" : "Hoàn 1 Phần"}
                </Tag>
              ),
            },
            {
              title: "Ngày Tạo",
              dataIndex: "createdAt",
              key: "createdAt",
              align: "center",
              width: 105,
              render: (date: string) => (
                <Text style={{ fontSize: 12 }}>{formatDate(date)}</Text>
              ),
            },
            {
              title: "Thao tác",
              key: "action",
              align: "center",
              render: (_: any, record: PaidOrder) => (
                <Button
                  type="primary"
                  danger
                  onClick={() => handleOpenRefundModal(record)}
                >
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
            <Card
              type="inner"
              style={{ marginBottom: 16, background: "#f5f5f5" }}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Mã Đơn">
                  <Text code>{selectedPaidOrder._id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tổng Tiền">
                  <Text strong style={{ color: "#1890ff" }}>
                    {formatCurrency(selectedPaidOrder.totalAmount)}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Khách Hàng">
                  {/* FIX: Hiển thị Khách vãng lai */}
                  {selectedPaidOrder.customer?.name || "Khách vãng lai"}
                </Descriptions.Item>
                <Descriptions.Item label="SĐT">
                  {selectedPaidOrder.customer?.phone || "Trống!"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Form form={form} layout="vertical" onFinish={handleSubmitRefund}>
              {/* Người xử lý sẽ được lấy tự động từ backend dựa vào người đăng nhập */}

              <Form.Item
                name="refundReason"
                label="Lý Do Hoàn Trả"
                rules={[{ required: true, message: "Vui lòng nhập lý do!" }]}
              >
                <TextArea
                  rows={3}
                  placeholder="Mô tả rõ lý do khách hoàn trả hàng (nếu có)..."
                  maxLength={500}
                  showCount
                />
              </Form.Item>

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

                    const validImageFormats = [
                      "jpg",
                      "jpeg",
                      "png",
                      "gif",
                      "webp",
                      "avif",
                    ];
                    const validVideoFormats = [
                      "mp4",
                      "mov",
                      "avi",
                      "mkv",
                      "webm",
                    ];
                    const fileExt =
                      file.name.split(".").pop()?.toLowerCase() || "";

                    if (isImage && !validImageFormats.includes(fileExt)) {
                      Swal.fire({
                        icon: "error",
                        title: "Lỗi định dạng",
                        text: `Định dạng ảnh không hợp lệ! Chỉ chấp nhận: ${validImageFormats.join(
                          ", "
                        )}`,
                      });
                      return Upload.LIST_IGNORE;
                    }

                    if (isVideo && !validVideoFormats.includes(fileExt)) {
                      Swal.fire({
                        icon: "error",
                        title: "Lỗi định dạng",
                        text: `Định dạng video không hợp lệ! Chỉ chấp nhận: ${validVideoFormats.join(
                          ", "
                        )}`,
                      });
                      return Upload.LIST_IGNORE;
                    }

                    if (evidenceMedia.length >= 5) {
                      Swal.fire({
                        icon: "warning",
                        title: "Cảnh báo",
                        text: "Tải lên tối đa 5 file!",
                      });
                      return Upload.LIST_IGNORE;
                    }

                    const previewUrl = URL.createObjectURL(file);
                    const type = isImage ? "image" : "video";

                    setUploadedFiles((prev) => [...prev, file]);

                    const newMedia: EvidenceMedia = {
                      url: previewUrl,
                      type,
                    };
                    setEvidenceMedia((prev) => [...prev, newMedia]);

                    return false;
                  }}
                  onRemove={(file) => {
                    const index = parseInt(file.uid, 10);

                    setEvidenceMedia((prev) =>
                      prev.filter((_, i) => i !== index)
                    );
                    setUploadedFiles((prev) =>
                      prev.filter((_, i) => i !== index)
                    );
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
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block", marginTop: 8 }}
                  >
                    Đã chọn {evidenceMedia.length}/5 file
                  </Text>
                )}
              </Form.Item>

              <Form.Item label="Chọn Sản Phẩm Hoàn Trả" required>
                <Text
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Chọn sản phẩm và nhập số lượng cần hoàn
                </Text>

                <div
                  style={{
                    maxHeight: 300,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 12,
                  }}
                >
                  {selectedPaidOrderItems.map((item) => {
                    const maxRefundable = (item as any).maxRefundableQuantity ?? item.quantity;
                    const alreadyRefunded = (item as any).refundedQuantity ?? 0;
                    const isFullyRefunded = maxRefundable <= 0;

                    return (
                    <Card
                      key={item._id}
                      size="small"
                      style={{ marginBottom: 8, opacity: isFullyRefunded ? 0.5 : 1 }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <Row align="middle" gutter={16}>
                        <Col flex="auto">
                          <Space direction="vertical" size={0}>
                            <Text strong>{item.productId.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Mã SKU: {item.productId.sku} | Đơn giá:{" "}
                              {formatCurrency(item.priceAtTime)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Đã mua: <Tag color="blue">{item.quantity}</Tag>
                              {alreadyRefunded > 0 && (
                                <>
                                  {" | "}<Text type="danger">Đã hoàn: {alreadyRefunded}</Text>
                                </>
                              )}
                              {" | "}<Text type="success">Còn hoàn được: {maxRefundable}</Text>
                            </Text>
                            {isFullyRefunded && (
                              <Text type="secondary" style={{ color: "#ff4d4f" }}>(Đã hoàn hết)</Text>
                            )}
                          </Space>
                        </Col>

                        <Col>
                          <Checkbox
                            disabled={isFullyRefunded}
                            checked={selectedProducts.includes(
                              item.productId._id
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProducts([
                                  ...selectedProducts,
                                  item.productId._id,
                                ]);
                              } else {
                                setSelectedProducts(
                                  selectedProducts.filter(
                                    (id) => id !== item.productId._id
                                  )
                                );
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
                              initialValue={1}
                              rules={[
                                { required: true, message: "Nhập số lượng!" },
                                {
                                  type: "number",
                                  min: 1,
                                  max: maxRefundable,
                                  message: `Tối đa ${maxRefundable}`,
                                },
                              ]}
                            >
                              <InputNumber
                                min={1}
                                max={maxRefundable}
                                placeholder="SL hoàn"
                                style={{ width: 100 }}
                              />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>
                    </Card>
                  );
                  })}
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
                    icon={
                      loading ? (
                        <LoadingOutlined spin />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
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
