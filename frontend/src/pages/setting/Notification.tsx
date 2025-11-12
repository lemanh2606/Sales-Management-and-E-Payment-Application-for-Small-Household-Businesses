// src/pages/setting/Notification.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Input,
  Select,
  Button,
  Space,
  Tag,
  Dropdown,
  Menu,
  Empty,
  Badge,
  DatePicker,
  Tooltip,
  Modal,
} from "antd";
import {
  SearchOutlined,
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  MoreOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const { RangePicker } = DatePicker;
const { Option } = Select;

// ===== INTERFACES =====
interface UserInfo {
  _id: string;
  fullname: string;
}

interface NotificationItem {
  _id: string;
  storeId: string;
  userId: UserInfo;
  type: "order" | "payment" | "service" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

interface NotificationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NotificationResponse {
  data: NotificationItem[];
  meta: NotificationMeta;
}

interface FilterState {
  type: string;
  read: string;
  dateRange: [Dayjs | null, Dayjs | null] | null;
}

// ===== CONSTANTS =====
const NOTIFICATION_TYPES = {
  order: { label: "Đơn hàng", color: "blue" },
  payment: { label: "Thanh toán", color: "green" },
  service: { label: "Dịch vụ", color: "orange" },
  system: { label: "Hệ thống", color: "purple" },
};

const READ_STATUS = {
  all: "Tất cả",
  true: "Đã đọc",
  false: "Chưa đọc",
};

// ===== COMPONENT =====
const Notification: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    type: "all",
    read: "all",
    dateRange: null,
  });
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const token = localStorage.getItem("token");
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;
  const headers = { Authorization: `Bearer ${token}` };

  // ===== FETCH NOTIFICATIONS =====
  const fetchNotifications = useCallback(
    async (page = 1, pageSize = 10) => {
      if (!storeId) {
        Swal.fire({
          icon: "error",
          title: "Không tìm thấy thông tin cửa hàng",
          showConfirmButton: false,
          timer: 1500,
        });
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          storeId,
          page: String(page),
          limit: String(pageSize),
          sort: "-createdAt",
        });

        if (filters.type !== "all") params.append("type", filters.type);
        if (filters.read !== "all") params.append("read", filters.read);

        const res = await axios.get<NotificationResponse>(`http://localhost:9999/api/notifications?${params}`, {
          headers,
        });

        let data = res.data.data;

        // Search filter (client-side)
        if (searchText.trim()) {
          const search = searchText.toLowerCase().trim();
          data = data.filter(
            (item) => item.title.toLowerCase().includes(search) || item.message.toLowerCase().includes(search)
          );
        }

        // Date range filter (client-side)
        if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
          const [start, end] = filters.dateRange;
          data = data.filter((item) => {
            const date = dayjs(item.createdAt);
            return date.isAfter(start.startOf("day")) && date.isBefore(end.endOf("day"));
          });
        }

        setNotifications(data);
        setPagination({
          current: res.data.meta.page,
          pageSize: res.data.meta.limit,
          total: res.data.meta.total,
        });
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: err?.response?.data?.message || "Lỗi tải thông báo",
          showConfirmButton: false,
          timer: 2000,
        });
      } finally {
        setLoading(false);
      }
    },
    [storeId, filters, searchText, headers]
  );

  useEffect(() => {
    fetchNotifications(pagination.current, pagination.pageSize);
  }, [filters, searchText]);

  // ===== ACTIONS =====
  const handleTableChange = (newPagination: TablePaginationConfig) => {
    fetchNotifications(newPagination.current, newPagination.pageSize);
  };

  const markAsRead = async (id: string, read: boolean) => {
    try {
      await axios.patch(`http://localhost:9999/api/notifications/${id}/read`, { read }, { headers });
      Swal.fire({
        icon: "success",
        title: read ? "Đã đánh dấu đã đọc" : "Đã đánh dấu chưa đọc",
        showConfirmButton: false,
        timer: 1500,
      });
      fetchNotifications(pagination.current, pagination.pageSize);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.message || "Lỗi cập nhật",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  const deleteNotification = async (id: string) => {
    const result = await Swal.fire({
      title: "Xác nhận xóa?",
      text: "Bạn có chắc muốn xóa thông báo này không?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`http://localhost:9999/api/notifications/${id}`, { headers });
        Swal.fire({
          icon: "success",
          title: "Đã xóa thông báo",
          showConfirmButton: false,
          timer: 1500,
        });
        fetchNotifications(pagination.current, pagination.pageSize);
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: err?.response?.data?.message || "Lỗi xóa thông báo",
          showConfirmButton: false,
          timer: 2000,
        });
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`http://localhost:9999/api/notifications/read-all`, {}, { headers });
      Swal.fire({
        icon: "success",
        title: "Đã đánh dấu tất cả là đã đọc",
        showConfirmButton: false,
        timer: 1500,
      });
      fetchNotifications(pagination.current, pagination.pageSize);
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: err?.response?.data?.message || "Lỗi đánh dấu tất cả",
        showConfirmButton: false,
        timer: 2000,
      });
    }
  };

  const bulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;

    const result = await Swal.fire({
      title: `Xóa ${selectedRowKeys.length} thông báo?`,
      text: "Hành động này không thể hoàn tác!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        await Promise.all(
          selectedRowKeys.map((id) => axios.delete(`http://localhost:9999/api/notifications/${id}`, { headers }))
        );
        Swal.fire({
          icon: "success",
          title: `Đã xóa ${selectedRowKeys.length} thông báo`,
          showConfirmButton: false,
          timer: 1500,
        });
        setSelectedRowKeys([]);
        fetchNotifications(pagination.current, pagination.pageSize);
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Lỗi xóa thông báo",
          showConfirmButton: false,
          timer: 2000,
        });
      }
    }
  };

  const clearFilters = () => {
    setFilters({ type: "all", read: "all", dateRange: null });
    setSearchText("");
  };

  // ===== TABLE COLUMNS =====
  const columns: ColumnsType<NotificationItem> = [
    {
      title: "Trạng thái",
      dataIndex: "read",
      key: "read",
      width: 120,
      align: "center",
      render: (read: boolean) => (
        <Badge
          status={read ? "default" : "processing"}
          text={read ? "Đã đọc" : "Chưa đọc"}
          style={{ fontWeight: read ? 400 : 600 }}
        />
      ),
    },
    {
      title: "Thể loại",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (type: keyof typeof NOTIFICATION_TYPES) => (
        <Tag color={NOTIFICATION_TYPES[type].color}>{NOTIFICATION_TYPES[type].label}</Tag>
      ),
    },
    {
      title: "Thông báo",
      key: "notification",
      render: (_, record: NotificationItem) => (
        <div>
          <div
            style={{
              fontWeight: record.read ? 500 : 600,
              color: record.read ? "#262626" : "#000",
              marginBottom: 6,
              fontSize: 14,
            }}
          >
            {record.title}
          </div>
          <div
            style={{
              color: "#595959",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {record.message}
          </div>
        </div>
      ),
    },
    {
      title: "Người tạo",
      dataIndex: "userId",
      key: "userId",
      width: 150,
      render: (user: UserInfo) => user?.fullname || "—",
    },
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (date: string) => (
        <div>
          <div>{dayjs(date).format("DD/MM/YYYY HH:mm")}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{dayjs(date).fromNow()}</div>
        </div>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, record: NotificationItem) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item key="toggle" icon={<CheckOutlined />} onClick={() => markAsRead(record._id, !record.read)}>
                {record.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => deleteNotification(record._id)}>
                Xóa
              </Menu.Item>
            </Menu>
          }
          trigger={["click"]}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  // Phân trang
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

  // ===== RENDER =====
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Layout>
      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BellOutlined style={{ fontSize: 24, color: "#1890ff" }} />
            <span style={{ fontSize: 20, fontWeight: 600 }}>Quản lý thông báo</span>
            {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: "#ff4d4f" }} overflowCount={99} />}
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchNotifications(1, 10)}>
              Làm mới
            </Button>
            {unreadCount > 0 && (
              <Button type="primary" icon={<CheckOutlined />} onClick={markAllAsRead}>
                Đánh dấu tất cả đã đọc
              </Button>
            )}
          </Space>
        }
        bordered={false}
      >
        {/* FILTERS */}
        <Space direction="vertical" size="middle" style={{ width: "100%", marginBottom: 16 }}>
          <Space wrap size="middle">
            <Input
              placeholder="Tìm kiếm thông báo theo nội dung..."
              prefix={<SearchOutlined />}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 450 }}
            />

            <Select
              value={filters.type}
              onChange={(value) => setFilters({ ...filters, type: value })}
              style={{ width: 150 }}
              placeholder="Loại thông báo"
            >
              <Option value="all">Tất cả loại</Option>
              {Object.entries(NOTIFICATION_TYPES).map(([key, val]) => (
                <Option key={key} value={key}>
                  <Tag color={val.color}>{val.label}</Tag>
                </Option>
              ))}
            </Select>

            <Select
              value={filters.read}
              onChange={(value) => setFilters({ ...filters, read: value })}
              style={{ width: 140 }}
              placeholder="Trạng thái"
            >
              {Object.entries(READ_STATUS).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>

            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày", "Đến ngày"]}
              style={{ width: 260 }}
            />

            {(filters.type !== "all" || filters.read !== "all" || searchText || filters.dateRange) && (
              <Button icon={<CloseCircleOutlined />} onClick={clearFilters} danger type="text">
                Xóa bộ lọc
              </Button>
            )}
          </Space>

          {/* BULK ACTIONS */}
          {selectedRowKeys.length > 0 && (
            <Space>
              <Button type="primary" danger icon={<DeleteOutlined />} onClick={bulkDelete}>
                Xóa {selectedRowKeys.length} thông báo
              </Button>
              <Button onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
            </Space>
          )}
        </Space>

        {/* TABLE */}
        <Table
          columns={columns}
          dataSource={notifications}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...paginationConfig,
            current: pagination.current,
            pageSize: pagination.pageSize,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo nào" />,
          }}
        />
      </Card>
    </Layout>
  );
};

export default Notification;
