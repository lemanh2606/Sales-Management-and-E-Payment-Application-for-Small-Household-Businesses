// src/pages/order/ListPendingOrders.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Spin,
} from "antd";
import {
  SearchOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import Swal from "sweetalert2";
import Layout from "../../components/Layout";
import debounce from "../../utils/debounce";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;
const apiUrl = import.meta.env.VITE_API_URL;
const API_BASE = `${apiUrl}`;

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
  status: "pending" | "paid" | "refunded" | "partially_refunded" | "cancelled";
  createdAt: string;
}

interface OrderListResponse {
  message: string;
  total: number;
  orders: Order[];
}

const ListPendingOrders: React.FC = () => {
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

  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Helper
  const formatCurrency = (value: MongoDecimal | number): string => {
    const numValue =
      typeof value === "object" && value.$numberDecimal
        ? parseFloat(value.$numberDecimal)
        : Number(value);
    return numValue.toLocaleString("vi-VN") + "₫";
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString("vi-VN");
  };

  // Load pending orders only
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
      const pendingOrders = res.data.orders.filter(
        (o) => o.status === "pending"
      );
      setOrders(pendingOrders);
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

  const debouncedSearch = useCallback(
    debounce((text: string) => setSearchText(text), 300),
    []
  );

  useEffect(() => {
    if (storeId) loadOrders();
  }, [storeId]);

  // Filter search & date
  const filteredOrders = orders.filter((order) => {
    const matchSearch = searchText
      ? order._id.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customer?.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        order.customer?.phone?.includes(searchText)
      : true;

    let matchDate = true;
    if (dateRange[0] && dateRange[1]) {
      const orderDate = dayjs(order.createdAt);
      matchDate =
        orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1]);
    }

    return matchSearch && matchDate;
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
        <div className="flex flex-col sm:flex-row sm:items-center mb-4 gap-3">
          <Title level={3}>
            <ClockCircleOutlined /> Đơn Hàng Chưa Hoàn Tất
          </Title>
          <span
            style={{ marginBottom: 12 }}
            className="px-4 py-2 text-base font-semibold bg-[#e6f4ff] text-[#1890ff] rounded-xl shadow-sm duration-200"
          >
            {currentStore?.name}
          </span>
        </div>

        <Card
          title={
            <Space>
              <FileTextOutlined />
              <span>Danh Sách Đơn Hàng Chưa Hoàn Tất</span>
            </Space>
          }
          extra={
            <Text type="secondary">
              Tổng có:{" "}
              <Text strong style={{ color: "#cf1322" }}>
                {filteredOrders.length}
              </Text>{" "}
              đơn hàng
            </Text>
          }
          style={{ borderRadius: 12 }}
        >
          {/* Bộ lọc hàng ngang */}
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
              style={{ flex: 1, minWidth: 420 }}
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
          </Space>

          {/* Danh sách */}
          <Table
            dataSource={filteredOrders}
            rowKey="_id"
            loading={loading}
            pagination={paginationConfig}
            size="middle"
            scroll={{ y: 580 }}
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
                render: (text) => text || "—",
              },
              {
                title: "Tổng Tiền",
                dataIndex: "totalAmount",
                key: "totalAmount",
                align: "right",
                render: (value) => <Text strong>{formatCurrency(value)}</Text>,
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
              {
                title: "Trạng Thái",
                key: "status",
                align: "center",
                render: () => (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>
                    Chờ Thanh Toán
                  </Tag>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </Layout>
  );
};

export default ListPendingOrders;
