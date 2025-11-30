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
} from "antd";
import {
  SearchOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import debounce from "../../utils/debounce";
import Layout from "../../components/Layout";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const apiUrl = import.meta.env.VITE_API_URL;

const API_BASE = `${apiUrl}`;

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
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(
    undefined
  );
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

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
    };
    return configs[status] || configs.pending;
  };

  // Load orders
  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OrderListResponse>(
        `${API_BASE}/orders/list-all`,
        {
          params: { storeId },
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
        order.customer?.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        order.customer?.phone?.includes(searchText)
      : true;

    const matchStatus = selectedStatus ? order.status === selectedStatus : true;

    let matchDate = true;
    if (dateRange[0] && dateRange[1]) {
      const orderDate = dayjs(order.createdAt);
      matchDate =
        orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
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
            <Input
              placeholder="Tìm mã đơn hàng, tên khách, SĐT..."
              prefix={<SearchOutlined />}
              onChange={(e) => debouncedSearch(e.target.value)}
              allowClear
              size="large"
              style={{ flex: 1, minWidth: 450 }}
            />
            <RangePicker
              style={{ flex: 1, minWidth: 440 }}
              placeholder={["Từ ngày", "Đến ngày"]}
              format="DD/MM/YYYY"
              onChange={(dates) =>
                setDateRange(dates as [Dayjs | null, Dayjs | null])
              }
              size="large"
            />
            <Select
              placeholder="Lọc theo trạng thái"
              value={selectedStatus}
              onChange={setSelectedStatus}
              allowClear
              size="large"
              style={{ flex: 1, minWidth: 300 }}
            >
              <Option value="pending">Chờ Thanh Toán</Option>
              <Option value="paid">Đã Thanh Toán</Option>
              <Option value="refunded">Hoàn Toàn Bộ</Option>
              <Option value="partially_refunded">Hoàn 1 Phần</Option>
            </Select>
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
              scroll={{ y: 600 }}
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
                },
                {
                  title: "Tổng Tiền",
                  dataIndex: "totalAmount",
                  key: "totalAmount",
                  align: "right",
                  render: (value) => (
                    <Text strong>{formatCurrency(value)}</Text>
                  ),
                },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  align: "center",
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
                  render: (date) => (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(date)}
                    </Text>
                  ),
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
