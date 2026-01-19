import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Input,
  Table,
  Tag,
  Space,
  DatePicker,
  Select,
  Typography,
  Spin,
  Empty,
  Button,
  Row,
  Col,
} from "antd";
import {
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
  FileExcelOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import ModalPrintBill from "./ModalPrintBill";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import debounce from "../../utils/debounce";
import Layout from "../../components/Layout";
import PendingOrdersManagerModal from "./PendingOrdersManagerModal";
import utc from "dayjs/plugin/utc"; //  THÊM
import timezone from "dayjs/plugin/timezone"; //  THÊM

// Khởi tạo plugin
dayjs.extend(utc); //  THÊM
dayjs.extend(timezone); //  THÊM

// Set timezone mặc định (optional)
dayjs.tz.setDefault("Asia/Ho_Chi_Minh"); //  THÊM

const { Option } = Select;
const { Title, Text } = Typography;

const apiUrl = import.meta.env.VITE_API_URL;

// ========== Interfaces ==========
interface MongoDecimal {
  $numberDecimal: string;
}

interface Store {
  _id: string;
  name: string;
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

interface Order {
  _id: string;
  storeId: Store;
  employeeId: Employee;
  customer?: Customer;
  totalAmount: MongoDecimal;
  grossAmount?: MongoDecimal;
  discountAmount?: MongoDecimal;
  status: "pending" | "paid" | "refunded" | "partially_refunded" | "cancelled";
  createdAt: string;
  paymentMethod: string;
  isVATInvoice: boolean;
  printDate?: string;
  printCount: number;
}

interface OrderListResponse {
  message: string;
  total: number;
  orders: Order[];
}

// ========== Component ==========
const ListAllOrder: React.FC = () => {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(
    undefined
  );
  const [paymentFilter, setPaymentFilter] = useState<string | undefined>(
    undefined
  );
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const [pendingModalVisible, setPendingModalVisible] = useState(false);
  
  // Print Modal State
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any>(null);

  // Period filter states
  const [periodType, setPeriodType] = useState<string>("month");
  const [periodKey, setPeriodKey] = useState<string>("");
  const [monthFrom, setMonthFrom] = useState<string>("");
  const [monthTo, setMonthTo] = useState<string>("");

  // Format currency
  const formatCurrency = (value: MongoDecimal): string =>
    parseFloat(value.$numberDecimal).toLocaleString("vi-VN") + "₫";

  const formatDate = (date: string): string =>
    new Date(date).toLocaleString("vi-VN");

  const getStatusConfig = (status: string) => {
    const configs: Record<
      string,
      { color: string; icon: React.ReactNode; text: string }
    > = {
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
      cancelled: { color: "gray", icon: <RollbackOutlined />, text: "Đã Hủy" },
    };
    return configs[status] || configs.pending;
  };

  // Reset periodKey khi đổi periodType
  useEffect(() => {
    setPeriodKey("");
    setMonthFrom("");
    setMonthTo("");
    setOrders([]); // Clear orders khi đổi type để tránh hiển thị data cũ
  }, [periodType]);

  // Load orders với period filter
  const loadOrders = async () => {
    setLoading(true);
    try {
      const params: any = {
        storeId,
        periodType,
        periodKey,
        timezone: "Asia/Ho_Chi_Minh",
      };

      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      }

      const res = await axios.get<OrderListResponse>(
        `${apiUrl}/orders/list-all`,
        {
          params,
          headers,
        }
      );
      setOrders(res.data.orders);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Lỗi tải danh sách đơn hàng",
        text: err.response?.data?.message || "Không thể tải danh sách đơn hàng",
      });
      setOrders([]); // Clear orders khi có lỗi
    } finally {
      setLoading(false);
    }
  };

  // Debounced load orders - đợi 500ms sau khi user chọn xong
  const debouncedLoadOrders = useCallback(
    debounce(() => {
      loadOrders();
    }, 500),
    [storeId, periodType, periodKey, monthFrom, monthTo]
  );

  // Kiểm tra điều kiện đã chọn đủ thông tin chưa
  const isReadyToLoad = () => {
    if (!storeId) return false;

    if (periodType === "custom") {
      // Custom cần cả monthFrom và monthTo
      return monthFrom !== "" && monthTo !== "";
    } else {
      // Các loại khác chỉ cần periodKey
      return periodKey !== "";
    }
  };

  // Gọi API khi đã chọn đủ thông tin (có debounce)
  useEffect(() => {
    if (isReadyToLoad()) {
      debouncedLoadOrders();
    } else {
      // Nếu chưa đủ thông tin thì clear orders
      setOrders([]);
    }

    // Cleanup function để cancel debounce khi component unmount hoặc dependencies thay đổi
    return () => {
      debouncedLoadOrders.cancel?.();
    };
  }, [storeId, periodType, periodKey, monthFrom, monthTo]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      setSearchText(text);
    }, 300),
    []
  );

  // Filter orders (client-side filter trên kết quả đã lọc từ BE)
  const filteredOrders = orders.filter((order) => {
    const matchSearch = searchText
      ? order._id.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        order.customer?.phone?.includes(searchText)
      : true;

    const matchStatus = selectedStatus ? order.status === selectedStatus : true;
    const matchPayment = paymentFilter
      ? order.paymentMethod === paymentFilter
      : true;

    return matchSearch && matchStatus && matchPayment;
  });

  // Export to Excel
  const handleExportExcel = async () => {
    if (!storeId) {
      Swal.fire("Lỗi", "Không tìm thấy cửa hàng", "error");
      return;
    }

    if (!isReadyToLoad()) {
      Swal.fire(
        "Cảnh báo",
        "Vui lòng chọn đủ thông tin kỳ trước khi xuất Excel",
        "warning"
      );
      return;
    }

    try {
      const params: any = {
        storeId,
        periodType,
        periodKey,
        timezone: "Asia/Ho_Chi_Minh",
      };
      if (periodType === "custom") {
        params.monthFrom = monthFrom;
        params.monthTo = monthTo;
      }

      const queryString = new URLSearchParams(params).toString();
      const url = `${apiUrl}/orders/export-all?${queryString}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Danh_Sach_Don_Hang_${dayjs().format("DD-MM-YYYY")}.xlsx`;
      link.click();

      Swal.fire("Thành công!", "Xuất Excel thành công", "success");
    } catch (err) {
      Swal.fire("Lỗi!", "Không thể xuất Excel", "error");
    }
  };

  // --- LOGIC IN BILL ---
  const handleOpenPrintModal = async (orderId: string) => {
    try {
      setLoading(true);
      // Fetch full details (items)
      const res = await axios.get(`${apiUrl}/orders/${orderId}`, { headers });
      setPrintingOrder(res.data.order);
      setPrintModalVisible(true);
    } catch (err) {
      Swal.fire("Lỗi", "Không thể tải chi tiết đơn hàng để in", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintConfirm = async () => {
    try {
      if (printingOrder && printingOrder._id) {
        await axios.post(
          `${apiUrl}/orders/${printingOrder._id}/print-bill`,
          {},
          { headers }
        );
        // Refresh list to update printCount
        loadOrders();
      }
    } catch (err) {}
    setPrintModalVisible(false);
  };

  // Pagination config
  const paginationConfig = {
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: filteredOrders.length,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => (
      <div style={{ fontSize: 14, color: "#595959" }}>
        Đang xem{" "}
        <span style={{ color: "#1890ff", fontWeight: 600 }}>
          {range[0]} – {range[1]}
        </span>{" "}
        trên tổng số{" "}
        <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> đơn
        hàng
      </div>
    ),
    onChange: (page: number, pageSize: number) =>
      setPagination({ current: page, pageSize }),
  };

  return (
    <Layout>
      <div style={{ minHeight: "100vh" }}>
        <Card style={{ borderRadius: 12, border: "1px solid #8c8c8c" }}>
          {/* HEADER + FILTER ROW 1 */}
          <Row
            gutter={[10, 12]}
            align="bottom"
            style={{
              marginBottom: 16,
              paddingBottom: 16,
              borderBottom: "2px solid #e8e8e8",
            }}
          >
            {/* Tên cửa hàng + Mô tả */}
            <Col xs={24} sm={24} md={8} lg={6}>
              <div>
                <Title
                  level={2}
                  style={{ margin: 0, color: "#1890ff", marginBottom: 4 }}
                >
                  {currentStore.name || "Đang tải..."}
                </Title>
                <Text style={{ color: "#595959", fontSize: "14px" }}>
                  <FileTextOutlined /> Danh Sách Đơn Hàng
                </Text>
              </div>
            </Col>

            {/* Loại kỳ */}
            <Col xs={12} sm={8} md={4} lg={3}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Text
                  strong
                  style={{ marginBottom: 8, minHeight: 22, fontSize: 13 }}
                >
                  Loại kỳ
                </Text>
                <Select
                  value={periodType}
                  onChange={setPeriodType}
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <Option value="day">Ngày</Option>
                  <Option value="month">Tháng</Option>
                  <Option value="quarter">Quý</Option>
                  <Option value="year">Năm</Option>
                  <Option value="custom">Tùy chỉnh</Option>
                </Select>
              </div>
            </Col>

            {/* Chọn thời gian - khi không phải custom */}
            {periodType !== "custom" && (
              <Col xs={12} sm={8} md={6} lg={4}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Text
                    strong
                    style={{ marginBottom: 8, minHeight: 22, fontSize: 13 }}
                  >
                    {periodType === "day" && "Ngày"}
                    {periodType === "month" && "Tháng"}
                    {periodType === "quarter" && "Quý"}
                    {periodType === "year" && "Năm"}
                  </Text>

                  {periodType === "day" && (
                    <DatePicker
                      placeholder="Chọn ngày"
                      style={{ width: "100%" }}
                      size="large"
                      format="DD/MM/YYYY"
                      onChange={(date) =>
                        setPeriodKey(
                          date
                            ? date.tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD")
                            : "" //  THÊM .tz()
                        )
                      }
                    />
                  )}

                  {periodType === "month" && (
                    <DatePicker
                      picker="month"
                      format="MM-YYYY"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn"
                      onChange={(date) =>
                        setPeriodKey(date ? date.format("YYYY-MM") : "")
                      }
                    />
                  )}

                  {periodType === "quarter" && (
                    <Select
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn"
                      onChange={(v) => setPeriodKey(v)}
                    >
                      <Option value={`${dayjs().year()}-Q1`}>
                        Q1/{dayjs().year()}
                      </Option>
                      <Option value={`${dayjs().year()}-Q2`}>
                        Q2/{dayjs().year()}
                      </Option>
                      <Option value={`${dayjs().year()}-Q3`}>
                        Q3/{dayjs().year()}
                      </Option>
                      <Option value={`${dayjs().year()}-Q4`}>
                        Q4/{dayjs().year()}
                      </Option>
                    </Select>
                  )}

                  {periodType === "year" && (
                    <DatePicker
                      picker="year"
                      style={{ width: "100%" }}
                      size="middle"
                      placeholder="Chọn"
                      onChange={(date) =>
                        setPeriodKey(date ? date.format("YYYY") : "")
                      }
                    />
                  )}
                </div>
              </Col>
            )}

            {/* Custom - Từ tháng */}
            {periodType === "custom" && (
              <Col xs={12} sm={8} md={5} lg={4}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Text
                    strong
                    style={{ marginBottom: 8, minHeight: 22, fontSize: 13 }}
                  >
                    Từ
                  </Text>
                  <DatePicker
                    picker="month"
                    style={{ width: "100%" }}
                    size="middle"
                    placeholder="Từ tháng"
                    format="MM-YYYY"
                    onChange={(d) => setMonthFrom(d?.format("YYYY-MM") || "")}
                  />
                </div>
              </Col>
            )}

            {/* Custom - Đến tháng */}
            {periodType === "custom" && (
              <Col xs={12} sm={8} md={5} lg={4}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <Text
                    strong
                    style={{ marginBottom: 8, minHeight: 22, fontSize: 13 }}
                  >
                    Đến
                  </Text>
                  <DatePicker
                    picker="month"
                    style={{ width: "100%" }}
                    size="middle"
                    placeholder="Đến tháng"
                    format="MM-YYYY"
                    onChange={(d) => setMonthTo(d?.format("YYYY-MM") || "")}
                  />
                </div>
              </Col>
            )}

            {/* Trạng thái */}
            <Col xs={12} sm={8} md={4} lg={4}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Text
                  strong
                  style={{
                    marginBottom: 8,
                    minHeight: 22,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  Trạng thái
                </Text>
                <Select
                  placeholder="Tất cả"
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  allowClear
                  size="middle"
                  style={{ width: "100%" }}
                >
                  {[
                    "pending",
                    "paid",
                    "refunded",
                    "partially_refunded",
                    "cancelled",
                  ].map((status) => {
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
              </div>
            </Col>

            {/* Phương thức */}
            <Col xs={12} sm={8} md={4} lg={3}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Text
                  strong
                  style={{
                    marginBottom: 8,
                    minHeight: 22,
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  Phương thức
                </Text>
                <Select
                  placeholder="Tất cả"
                  value={paymentFilter}
                  onChange={setPaymentFilter}
                  allowClear
                  size="middle"
                  style={{ width: "100%" }}
                >
                  {["cash", "qr"].map((method) => {
                    const map: Record<
                      string,
                      { label: string; color: string }
                    > = {
                      cash: { label: "Tiền mặt", color: "green" },
                      qr: { label: "Chuyển khoản", color: "blue" },
                    };
                    const item = map[method] || {
                      label: method,
                      color: "default",
                    };
                    return (
                      <Option key={method} value={method}>
                        <Tag color={item.color}>{item.label}</Tag>
                      </Option>
                    );
                  })}
                </Select>
              </div>
            </Col>
          </Row>

          {/* BỘ LỌC - DÒNG 2: Tìm kiếm và Xuất Excel */}
          <Row gutter={[10, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={10} md={12} lg={13}>
              <Input
                placeholder="Tìm kiếm theo mã đơn, tên khách hàng, số điện thoại, ......."
                prefix={<SearchOutlined />}
                onChange={(e) => debouncedSearch(e.target.value)}
                allowClear
                size="large"
                style={{ width: "100%" }}
                disabled={!periodKey && periodType !== "custom"}
              />
            </Col>
            <Col xs={12} sm={7} md={6} lg={6}>
              <Button
                type="default"
                icon={<ClockCircleOutlined />}
                onClick={() => setPendingModalVisible(true)}
                size="large"
                style={{ width: "100%" }}
                disabled={!periodKey && periodType !== "custom"}
              >
                Quản lý đơn chưa thanh toán
              </Button>
            </Col>
            <Col xs={12} sm={7} md={6} lg={5}>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                size="large"
                style={{ width: "100%" }}
                disabled={!periodKey && periodType !== "custom"}
              >
                Xuất ra Excel
              </Button>
            </Col>
          </Row>

          {/* BẢNG DANH SÁCH */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" tip="Đang tải đơn hàng..." />
            </div>
          ) : filteredOrders.length === 0 ? (
            <Empty
              description={
                !periodKey && periodType !== "custom"
                  ? "Vui lòng chọn kỳ để xem danh sách đơn hàng"
                  : "Không có đơn hàng nào trong kỳ này"
              }
            />
          ) : (
            <Table
              dataSource={filteredOrders}
              rowKey="_id"
              pagination={paginationConfig}
              size="middle"
              scroll={{ x: 800, y: 1000 }}
              columns={[
                {
                  title: <span style={{ fontWeight: 600 }}>Mã Đơn</span>,
                  dataIndex: "_id",
                  key: "_id",
                  width: 60,
                  fixed: "left",
                  render: (text) => (
                    <Text code copyable style={{ fontSize: 13 }}>
                      {text.slice(-8)}
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Khách Hàng</span>,
                  key: "customer",
                  width: 110,
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: 14 }}>
                        {record.customer?.name || "Khách lẻ"}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.customer?.phone || "N/A"}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Nhân Viên</span>,
                  dataIndex: ["employeeId", "fullName"],
                  key: "employee",
                  width: 120,
                  render: (text) =>
                    text ? (
                      <Text style={{ fontSize: 14 }}>{text}</Text>
                    ) : (
                      <Tag color="gold">Chủ bán hàng</Tag>
                    ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Phương thức</span>,
                  dataIndex: "paymentMethod",
                  key: "paymentMethod",
                  align: "center",
                  width: 80,
                  render: (method: string) => {
                    const map: Record<
                      string,
                      { label: string; color: string }
                    > = {
                      cash: { label: "Tiền mặt", color: "green" },
                      qr: { label: "Chuyển khoản", color: "blue" },
                    };
                    const item = map[method] || {
                      label: method,
                      color: "default",
                    };
                    return <Tag color={item.color}>{item.label}</Tag>;
                  },
                },
                {
                  title: <span style={{ fontWeight: 600 }}>VAT</span>,
                  dataIndex: "isVATInvoice",
                  key: "isVATInvoice",
                  align: "center",
                  width: 50,
                  render: (val) =>
                    val ? <Tag color="blue">Có</Tag> : <Tag>Không</Tag>,
                },
                {
                  title: <span style={{ fontWeight: 600 }}>In HĐ</span>,
                  dataIndex: "printCount",
                  key: "printCount",
                  align: "center",
                  width: 50,
                  render: (count) => (
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#52c41a",
                      }}
                    >
                      {count} lần
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Tiền Hàng</span>,
                  dataIndex: "grossAmount",
                  key: "grossAmount",
                  align: "right",
                  width: 70,
                  render: (value) => (
                    <Text style={{ fontSize: 14 }}>
                      {value ? formatCurrency(value) : "---"}
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Giảm Giá</span>,
                  dataIndex: "discountAmount",
                  key: "discountAmount",
                  align: "right",
                  width: 70,
                  render: (value) => (
                    <Text
                      style={{
                        color: value ? "#52c41a" : "#ccc",
                        fontSize: 14,
                      }}
                    >
                      {value ? `-${formatCurrency(value)}` : "0₫"}
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Thực Thu</span>,
                  dataIndex: "totalAmount",
                  key: "totalAmount",
                  align: "right",
                  width: 70,
                  render: (value) => (
                    <Text strong style={{ color: "#1890ff", fontSize: 15 }}>
                      {formatCurrency(value)}
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Trạng Thái</span>,
                  dataIndex: "status",
                  key: "status",
                  align: "center",
                  width: 100,
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
                  title: <span style={{ fontWeight: 600 }}>Ngày Tạo</span>,
                  dataIndex: "createdAt",
                  key: "createdAt",
                  align: "center",
                  width: 100,
                  fixed: "right",
                  render: (date) => (
                    <Text style={{ fontSize: 13, color: "#595959" }}>
                      {formatDate(date)}
                    </Text>
                  ),
                },
                {
                  title: <span style={{ fontWeight: 600 }}>Thao tác</span>,
                  key: "action",
                  width: 80,
                  align: "center",
                  fixed: "right",
                  render: (_, record) => (
                    <Button
                      icon={<PrinterOutlined />}
                      size="small"
                      onClick={() => handleOpenPrintModal(record._id)}
                    >
                      In
                    </Button>
                  ),
                },
              ]}
            />
          )}

          {/* MODAL PRINT BILL */}
          {printingOrder && (
            <ModalPrintBill
              open={printModalVisible}
              onCancel={() => setPrintModalVisible(false)}
              onPrint={handlePrintConfirm}
              cart={(printingOrder.items || []).map((i: any) => ({
                productId: i.productId,
                name: i.product?.name || i.productName || "Sản phẩm",
                quantity: i.quantity,
                unit: i.product?.unit || "Cái",
                subtotal: i.subtotal?.$numberDecimal || i.subtotal,
                sku: i.product?.sku || "",
                price: i.priceAtTime?.$numberDecimal || i.priceAtTime || 0,
              }))}
              totalAmount={
                printingOrder.totalAmount?.$numberDecimal ||
                printingOrder.totalAmount ||
                0
              }
              // Store Info
              storeName={currentStore.name}
              address={currentStore.address || ""}
              storePhone={currentStore.phone}
              // Order Info
              orderId={printingOrder._id}
              createdAt={printingOrder.createdAt}
              printCount={printingOrder.printCount} // printCount hiện tại (trước khi in lại)
              customerName={printingOrder.customer?.name}
              customerPhone={printingOrder.customer?.phone}
              paymentMethod={printingOrder.paymentMethod}
              isVAT={printingOrder.isVATInvoice}
              vatAmount={
                printingOrder.vatAmount?.$numberDecimal ||
                printingOrder.vatAmount ||
                0
              }
              subtotal={
                printingOrder.beforeTaxAmount?.$numberDecimal ||
                printingOrder.beforeTaxAmount ||
                0
              }
              discount={
                printingOrder.discountAmount?.$numberDecimal ||
                printingOrder.discountAmount ||
                0
              }
              employeeName={
                printingOrder.employeeId?.fullName ||
                printingOrder.employeeName ||
                currentUser.fullname ||
                "Chủ cửa hàng"
              }
              earnedPoints={0} // Có thể lấy nếu BE trả về
            />
          )}
        </Card>
      </div>

      {/* Phần Modal để ở cuối file trước Tag cuối cùng */}
      <PendingOrdersManagerModal
        visible={pendingModalVisible}
        onClose={() => setPendingModalVisible(false)}
        onOrdersDeleted={() => {
          loadOrders(); // Reload danh sách chính
        }}
      />
      {/* ============== Hết ============== */}
    </Layout>
  );
};

export default ListAllOrder;
