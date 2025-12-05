import React, { useEffect, useState, useCallback } from "react";
import { Card, Input, Table, Tag, Space, DatePicker, Select, Typography, Spin, Empty, Button } from "antd";
import { SearchOutlined, FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, RollbackOutlined, FileExcelOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import debounce from "../../utils/debounce";
import Layout from "../../components/Layout";

const { RangePicker } = DatePicker;
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
  status: "pending" | "paid" | "refunded" | "partially_refunded";
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
  const storeId = currentStore._id;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [paymentFilter, setPaymentFilter] = useState<string | undefined>(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Format currency
  const formatCurrency = (value: MongoDecimal): string => parseFloat(value.$numberDecimal).toLocaleString("vi-VN") + "₫";

  const formatDate = (date: string): string => new Date(date).toLocaleString("vi-VN");

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
    };
    return configs[status] || configs.pending;
  };

  // Load orders
  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OrderListResponse>(`${apiUrl}/orders/list-all`, {
        params: { storeId },
        headers,
      });
      setOrders(res.data.orders);
      //console.log("Orders xem có những gì nhiều:", res.data.orders[0]);
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

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      setSearchText(text);
    }, 300),
    []
  );

  useEffect(() => {
    if (storeId) loadOrders();
  }, [storeId]);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const matchSearch = searchText
      ? order._id.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.phone?.includes(searchText)
      : true;

    const matchStatus = selectedStatus ? order.status === selectedStatus : true;
    const matchPayment = paymentFilter ? order.paymentMethod === paymentFilter : true;

    let matchDate = true;
    if (dateRange?.[0] && dateRange?.[1]) {
      const orderDate = dayjs(order.createdAt);
      matchDate = orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
    }

    return matchSearch && matchStatus && matchPayment && matchDate;
  });

  // Export to Excel
  const handleExportExcel = async () => {
    if (!storeId) {
      Swal.fire("Lỗi", "Không tìm thấy cửa hàng", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const url = `${apiUrl}/orders/export-all?storeId=${storeId}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `Danh_Sach_Don_Hang_${dayjs().format("DD-MM-YYYY")}.xlsx`;
      link.click();
    } catch (err) {
      Swal.fire("Lỗi!", "Không thể xuất Excel", "error");
    }
  };

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
    <Layout>
      <div style={{ minHeight: "100vh" }}>
        <Title level={3}>
          <FileTextOutlined /> Danh Sách Tất Cả Đơn Hàng
        </Title>
        <Card style={{ borderRadius: 12, marginTop: 16 }}>
          {/* Bộ lọc */}
          <Space
            direction="horizontal"
            style={{
              width: "100%",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            {/* Search */}
            <Input
              placeholder="Tìm mã đơn, tên khách, SĐT,...."
              prefix={<SearchOutlined />}
              onChange={(e) => debouncedSearch(e.target.value)}
              allowClear
              size="large"
              style={{ flex: 1, minWidth: 340 }}
            />

            {/* Date Range */}
            <RangePicker
              style={{ flex: 1, minWidth: 320 }}
              placeholder={["Từ ngày", "Đến ngày"]}
              format="DD/MM/YYYY"
              onChange={(dates) => setDateRange(dates ?? [null, null])}
              size="large"
            />

            {/* Trạng thái */}
            <Select placeholder="Trạng thái" value={selectedStatus} onChange={setSelectedStatus} allowClear size="large" style={{ width: 200 }}>
              {["pending", "paid", "refunded", "partially_refunded"].map((status) => {
                const cfg = getStatusConfig(status);
                return (
                  <Option key={status} value={status}>
                    <Tag color={cfg.color} icon={cfg.icon} style={{ marginRight: 8 }}>
                      {cfg.text}
                    </Tag>
                  </Option>
                );
              })}
            </Select>

            {/* Phương thức thanh toán */}
            <Select placeholder="Phương thức" value={paymentFilter} onChange={setPaymentFilter} allowClear size="large" style={{ width: 200 }}>
              {["cash", "qr"].map((method) => {
                const map: Record<string, { label: string; color: string }> = {
                  cash: { label: "Tiền mặt", color: "green" },
                  qr: { label: "Chuyển khoản", color: "blue" },
                };
                const item = map[method] || { label: method, color: "default" };
                return (
                  <Option key={method} value={method}>
                    <Tag color={item.color} style={{ marginRight: 8 }}>
                      {item.label}
                    </Tag>
                  </Option>
                );
              })}
            </Select>

            <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ marginLeft: 8 }}>
              Xuất Excel
            </Button>
          </Space>

          {/* Bảng danh sách */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Spin size="large" tip="Đang tải đơn hàng..." />
            </div>
          ) : filteredOrders.length === 0 ? (
            <Empty description="Không có đơn hàng nào" />
          ) : (
            <Table
              dataSource={filteredOrders}
              rowKey="_id"
              pagination={paginationConfig}
              size="middle"
              scroll={{ y: 800 }}
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
                  width: 210,
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{record.customer?.name || "Khách lẻ"}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.customer?.phone || "N/A"}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: "Nhân Viên",
                  dataIndex: ["employeeId", "fullName"],
                  key: "employee",
                  width: 240,
                  align: "start",
                },
                {
                  title: "Phương thức",
                  dataIndex: "paymentMethod",
                  key: "paymentMethod",
                  align: "center",
                  width: 110,
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
                  title: "VAT",
                  dataIndex: "isVATInvoice",
                  key: "isVATInvoice",
                  align: "center",
                  width: 90,
                  render: (val) => (val ? <Tag color="blue">Có</Tag> : <Tag>Không</Tag>),
                },
                {
                  title: "In hoá đơn",
                  dataIndex: "printCount",
                  key: "printCount",
                  align: "center",
                  width: 80,
                },
                {
                  title: "Tổng Tiền",
                  dataIndex: "totalAmount",
                  key: "totalAmount",
                  align: "right",
                  render: (value) => (
                    <Text strong style={{ color: "#1677ff" }}>
                      {formatCurrency(value)}
                    </Text>
                  ),
                },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  align: "center",
                  width: 170,
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
                  align: "end",
                  render: (date) => <Text style={{ fontSize: 12, color: "black" }}>{formatDate(date)}</Text>,
                },
              ]}
            />
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default ListAllOrder;
