// src/pages/ActivityLog.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Select,
  Input,
  Button,
  Table,
  DatePicker,
  Statistic,
  Spin,
  Space,
  Modal,
  Typography,
  Switch,
  Timeline,
  Tag,
  Descriptions,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  QuestionCircleOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ClockCircleOutlined,
  DownOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import Layout from "../../components/Layout";

dayjs.locale("vi");

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const ActivityLog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [entities, setEntities] = useState([]);
  const [actions] = useState(["create", "update", "delete", "restore", "other"]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filterApplied, setFilterApplied] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // table / timeline
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);

  // state phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalLogs, setTotalLogs] = useState(0);

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  const [filters, setFilters] = useState({
    userName: "",
    action: "",
    entity: "",
    fromDate: "",
    toDate: "",
    keyword: "",
    page: 1,
    limit: 20,
    sort: "-createdAt",
  });

  const formatDate = (date) => dayjs(date).format("DD/MM/YYYY HH:mm:ss");
  const formatVND = (value) => {
    if (!value) return "₫0";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // LOAD USERS & ENTITIES (unique từ logs) - giữ cách bạn sẵn có
  useEffect(() => {
    const fetchLogsForFilters = async () => {
      try {
        const token = localStorage.getItem("token");
        const url = `http://localhost:9999/api/activity-logs?storeId=${currentStore._id}&limit=1000`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const logsData = res.data.data.logs || [];

        // Unique entities
        const uniqueEntities = [...new Set(logsData.map((l) => l.entity).filter(Boolean))];
        setEntities(uniqueEntities);

        // Unique users (dựa vào userName)
        const uniqueUsers = [...new Set(logsData.map((l) => l.userName).filter(Boolean))];
        setUsers(uniqueUsers);
      } catch (err) {
        console.error("Lỗi load filter data:", err);
      }
    };

    if (currentStore._id) fetchLogsForFilters();
  }, [currentStore._id]);

  // LOAD STATS
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const url = `http://localhost:9999/api/activity-logs/stats?storeId=${currentStore._id}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data.data.stats || null);
      } catch (err) {
        console.error("Lỗi load stats:", err);
      }
    };
    if (currentStore._id) fetchStats();
  }, [currentStore._id]);

  // BUILD params helper: chỉ append khi có giá trị (non-empty)
  const buildParamsFromFilters = (f) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      // treat empty string as skip
      if (typeof v === "string" && v.trim() === "") return;
      params.append(k, v);
    });
    return params;
  };

  // FETCH LOGS
  const fetchLogs = async (overrideFilters = null) => {
    if (!currentStore?._id) {
      setError("Vui lòng chọn cửa hàng");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // if overrideFilters passed, merge it
      const mergedFilters = overrideFilters ? { ...filters, ...overrideFilters } : filters;
      // ensure page/limit reflect current pagination state
      mergedFilters.page = mergedFilters.page || currentPage || 1;
      mergedFilters.limit = mergedFilters.limit || pageSize || 20;

      const token = localStorage.getItem("token");
      const params = buildParamsFromFilters({
        ...mergedFilters, // 👈 giải phẳng object ra
        storeId: currentStore._id, // 👈 thêm storeId vào cùng cấp
      });
      if (currentStore?._id);
      const url = `http://localhost:9999/api/activity-logs?${params.toString()}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

      const respLogs = res.data.data.logs || [];
      const pagination = res.data.data.pagination || {};

      // NẾU GỌI VỚI action=auth → LƯU VÀO attendance
      if (overrideFilters?.action === "auth" && overrideFilters?.entity === "Store") {
        setAttendance(respLogs);
      } else {
        setLogs(respLogs);
      }
      // xét logic phân trang (fallbacks)
      setCurrentPage(pagination.current || mergedFilters.page || 1);
      setPageSize(pagination.pageSize || pagination.limit || mergedFilters.limit || 20);
      setTotalLogs(pagination.total || 0);
      // also reflect into filters so next requests use correct page/limit
      setFilters((prev) => ({
        ...prev,
        page: pagination.current || mergedFilters.page || 1,
        limit: pagination.limit || mergedFilters.limit || 20,
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi tải nhật ký");
    } finally {
      setLoading(false);
    }
  };

  //hàm fetch lấy thông tin điểm danh
  const fetchAttendance = async () => {
    if (!currentStore?._id) return;
    setAttendanceLoading(true);
    try {
      // DÙNG CHUNG fetchLogs → ĐÃ PASS checkStoreAccess
      await fetchLogs({
        action: "auth",
        entity: "Store",
        fromDate: dayjs().format("YYYY-MM-DD"),
        toDate: dayjs().format("YYYY-MM-DD"),
        page: 1,
        limit: 100,
        sort: "-createdAt",
      });
    } catch (err) {
      console.error("Lỗi load vào ca:", err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // FETCH DETAIL
  const fetchLogDetail = async (id) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = `http://localhost:9999/api/activity-logs/${id}?storeId=${currentStore._id}`;
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedLog(res.data.data);
      setDetailVisible(true);
    } catch (err) {
      // use console since message might not be imported in this scope
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch logs on component mount if store exists
  useEffect(() => {
    if (currentStore?._id) {
      fetchLogs();
      if (viewMode === "attendance") {
        fetchAttendance(); // ← GỌI NGAY KHI CHỌN STORE VÀ ĐANG Ở TAB VÀO CA
      }
    }
  }, [currentStore._id, viewMode]);

  // helper: when user changes filters in UI
  const handleFilterChange = (key, value) => {
    // if user chose the "Tất cả" option (value === ""), we want to clear that filter
    const val = value === "" ? "" : value;
    setFilters((prev) => ({ ...prev, [key]: val, page: 1 }));
  };
  // hàm chọn ngày tháng đến ngày tháng
  const handleDateRange = (dates) => {
    if (dates) {
      setFilters((prev) => ({
        ...prev,
        fromDate: dates[0].format("YYYY-MM-DD"),
        toDate: dates[1].format("YYYY-MM-DD"),
        page: 1,
      }));
    } else {
      setFilters((prev) => ({ ...prev, fromDate: "", toDate: "", page: 1 }));
    }
  };
  // Table columns
  const columns = [
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 130,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => dayjs(date).format("DD/MM/YYYY HH:mm:ss"),
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Người dùng",
      dataIndex: "userName",
      key: "userName",
      width: 180,
      render: (name) => <Text strong>{name}</Text>,
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Vai trò",
      dataIndex: "userRole",
      key: "userRole",
      width: 85,
      render: (role) => <Tag color={role === "MANAGER" ? "blue" : "green"}>{role}</Tag>,
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Hành động",
      dataIndex: "action",
      key: "action",
      width: 85,
      render: (action) => <Tag color="volcano">{action.toUpperCase()}</Tag>,
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Đối tượng",
      dataIndex: "entity",
      key: "entity",
      width: 95,
      render: (entity) => <Tag color="cyan">{entity}</Tag>,
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Tên đối tượng",
      dataIndex: "entityName",
      key: "entityName",
      width: 180,
      ellipsis: { showTitle: false },
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      width: 280,
      ellipsis: { showTitle: false },
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 50,
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="Nhấp để xem chi tiết log này">
          <Button type="link" icon={<InfoCircleOutlined />} onClick={() => fetchLogDetail(record._id)} />
        </Tooltip>
      ),
      onCell: () => ({
        style: { cursor: "pointer" }, // cursor pointer cho body cell
      }),
    },
  ];
  //hàm tạo cách hiển thị timeline
  const timelineItems = logs.map((log) => ({
    label: formatDate(log.createdAt),
    color:
      log.action === "create"
        ? "green"
        : log.action === "update"
        ? "blue"
        : log.action === "delete"
        ? "red"
        : log.action === "auth"
        ? "purple"
        : "gray",
    children: (
      <div>
        <Text strong>{log.userName}</Text>
        <Tag color={log.userRole === "MANAGER" ? "blue" : "green"} style={{ marginLeft: 6 }}>
          {log.userRole}
        </Tag>
        đã
        <Tag color="volcano" style={{ margin: "0 4px" }}>
          {log.action.toUpperCase()}
        </Tag>
        <Tag color="cyan" style={{ marginLeft: 4 }}>
          {log.entity}
        </Tag>
        :
        <Text code style={{ marginLeft: 4 }}>
          {log.entityName}
        </Text>
        <br />
        <Text italic type="secondary">
          {log.description || "Không có mô tả"}
        </Text>
      </div>
    ),
  }));

  // Callbacks lại cho các điều khiển phân trang (Table)
  const handleTableChange = (page, size) => {
    // cập nhật trạng thái phân trang cục bộ và bộ lọc, sau đó lấy trang mới
    setFilterApplied(true);
    setCurrentPage(page);
    setPageSize(size);
    // cập nhật bộ lọc và chạy fetch
    const newFilters = { ...filters, page, limit: size };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  return (
    <Layout>
      <div>
        {!currentStore?._id ? (
          <Card style={{ border: "1px solid #8c8c8c", textAlign: "center", padding: "40px" }}>
            <Text type="danger" style={{ fontSize: 18 }}>
              Vui lòng chọn cửa hàng để xem nhật ký hoạt động
            </Text>
          </Card>
        ) : (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* HEADER: TIÊU ĐỀ + CHẾ ĐỘ XEM */}
            <Card style={{ border: "1px solid #8c8c8c" }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Text strong style={{ fontSize: 22, color: "#1890ff" }}>
                    📋 Nhật ký hoạt động - {currentStore.name || "Đang tải..."}
                  </Text>
                </Col>
                <Col>
                  <Space size="middle">
                    <Text strong style={{ color: "#595959" }}>
                      Chế độ xem:
                    </Text>
                    <Button
                      type={viewMode === "table" ? "primary" : "default"}
                      icon={<UnorderedListOutlined />}
                      onClick={() => setViewMode("table")}
                      style={{
                        borderRadius: 8,
                        fontWeight: 500,
                      }}
                    >
                      Nhật ký chung
                    </Button>
                    <Button
                      type={viewMode === "attendance" ? "primary" : "default"}
                      icon={<AppstoreOutlined />}
                      onClick={() => {
                        setViewMode("attendance");
                        fetchAttendance();
                      }}
                      style={{
                        borderRadius: 8,
                        fontWeight: 500,
                      }}
                    >
                      Vào ca hôm nay
                    </Button>
                    <Button
                      type={viewMode === "timeline" ? "primary" : "default"}
                      icon={<ClockCircleOutlined />}
                      onClick={() => setViewMode("timeline")}
                      style={{
                        borderRadius: 8,
                        fontWeight: 500,
                      }}
                    >
                      Timeline
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* FILTERS - CHỈ HIỆN KHI Ở CHẾ ĐỘ TABLE HOẶC TIMELINE */}
            {(viewMode === "table" || viewMode === "timeline") && (
              <Card style={{ border: "1px solid #8c8c8c" }}>
                <Row gutter={16} align="middle">
                  <Col span={4}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Lọc theo user"
                      value={filters.userName || ""}
                      onChange={(v) => handleFilterChange("userName", v)}
                      allowClear
                    >
                      <Option value="">
                        <AppstoreOutlined /> Tất cả người dùng
                      </Option>
                      {users.map((u) => (
                        <Option key={u} value={u}>
                          {u}
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Lọc theo hành động"
                      value={filters.action || ""}
                      onChange={(v) => handleFilterChange("action", v)}
                      allowClear
                    >
                      <Option value="">
                        <AppstoreOutlined /> Tất cả hành động
                      </Option>
                      {actions.map((a) => (
                        <Option key={a} value={a}>
                          {a.toUpperCase()}
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Lọc theo đối tượng"
                      value={filters.entity || ""}
                      onChange={(v) => handleFilterChange("entity", v)}
                      allowClear
                    >
                      <Option value="">
                        <AppstoreOutlined /> Tất cả đối tượng
                      </Option>
                      {entities.map((e) => (
                        <Option key={e} value={e}>
                          {e}
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <RangePicker
                      style={{ width: "100%" }}
                      onChange={handleDateRange}
                      format="YYYY-MM-DD"
                      placeholder={["Từ ngày", "Đến ngày"]}
                    />
                  </Col>
                  <Col span={6}>
                    <Input
                      placeholder="Tìm kiếm keyword"
                      onChange={(e) => handleFilterChange("keyword", e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </Col>
                </Row>
                <Row style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={() => {
                          setFilterApplied(true);
                          fetchLogs();
                        }}
                      >
                        Xem nhật ký
                      </Button>
                      <Tooltip title="Thu gọn/Mở rộng thống kê">
                        <Button
                          icon={<DownOutlined rotate={statsCollapsed ? 0 : 180} />}
                          onClick={() => setStatsCollapsed(!statsCollapsed)}
                        >
                          {statsCollapsed ? "Hiện" : "Ẩn"} thống kê
                        </Button>
                      </Tooltip>
                    </Space>
                  </Col>
                </Row>
              </Card>
            )}

            {/* STATS */}
            {stats && !statsCollapsed && (
              <Card title="Thống kê tổng quan" style={{ border: "1px solid #8c8c8c" }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="Tổng nhật ký hoạt động" value={stats.totalLogs} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="Người dùng hoạt động" value={stats.uniqueUsers} />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Hành động phổ biến"
                      value={Object.keys(stats.actionCounts)[0] || "N/A"}
                      formatter={(val) => (
                        <Tag color="volcano" style={{ fontSize: 20, padding: "0 8px" }}>
                          {(val || "N/A").toUpperCase()}
                        </Tag>
                      )}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Đối tượng phổ biến"
                      value={Object.keys(stats.entityCounts)[0] || "N/A"}
                      formatter={(val) => (
                        <Tag color="cyan" style={{ fontSize: 20, padding: "0 8px" }}>
                          {(val || "N/A").toUpperCase()}
                        </Tag>
                      )}
                    />
                  </Col>
                </Row>
              </Card>
            )}

            {loading && <Spin tip="Đang tải nhật ký..." style={{ width: "100%", margin: "20px 0" }} />}
            {error && <div style={{ color: "red" }}>{error}</div>}

            {/* VIEW MODE: TABLE */}
            {viewMode === "table" && (
              <Card title="Danh sách nhật ký chi tiết" style={{ border: "1px solid #8c8c8c" }}>
                <Table
                  columns={columns}
                  dataSource={logs}
                  rowKey="_id"
                  pagination={{
                    current: currentPage,
                    pageSize,
                    total: totalLogs,
                    showSizeChanger: true,
                    onChange: handleTableChange,
                    onShowSizeChange: (current, size) => handleTableChange(1, size),
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
                          trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> nhật ký
                        </div>
                      </div>
                    ),
                  }}
                  scroll={{ x: 1200 }}
                  locale={{
                    emptyText:
                      logs.length === 0 ? (
                        <div style={{ color: "#f45a07f7" }}>
                          {filterApplied ? "Phần này chưa có nhật ký" : "Chưa có nhật ký. Hãy lọc và xem!"}
                        </div>
                      ) : null,
                  }}
                  onRow={(record) => ({ onClick: () => fetchLogDetail(record._id) })}
                />
              </Card>
            )}

            {/* VIEW MODE: ATTENDANCE (VÀO CA HÔM NAY) */}
            {viewMode === "attendance" && (
              <Card
                title={
                  <Space>
                    <AppstoreOutlined style={{ color: "#1890ff" }} />
                    <span>Nhân viên vào ca hôm nay</span>
                    <Tag color="blue">{dayjs().format("DD/MM/YYYY")}</Tag>
                  </Space>
                }
                style={{ border: "1px solid #8c8c8c" }}
              >
                {attendanceLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <Spin tip="Đang tải danh sách vào ca..." />
                  </div>
                ) : attendance.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#999", fontSize: 16 }}>
                    Chưa có nhân viên nào vào ca hôm nay
                  </div>
                ) : (
                  <Table
                    dataSource={attendance}
                    rowKey="_id"
                    pagination={false}
                    columns={[
                      {
                        title: "Nhân viên",
                        render: (_, log) => (
                          <Space>
                            <img
                              src={log.userDetail?.image || "/default-avatar.png"}
                              alt="avatar"
                              width={32}
                              style={{ borderRadius: "50%", objectFit: "cover" }}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>{log.userDetail?.fullname || log.userName}</div>
                              <div style={{ fontSize: 12, color: "#888" }}>
                                {log.userDetail?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
                              </div>
                            </div>
                          </Space>
                        ),
                      },
                      {
                        title: "Email",
                        dataIndex: ["userDetail", "email"],
                        render: (email) => <span style={{ color: "#555" }}>{email || "-"}</span>,
                      },
                      {
                        title: "Cửa hàng",
                        dataIndex: ["storeDetail", "name"],
                        render: (name) => (
                          <Tag color="purple" style={{ fontSize: 13, padding: "2px 8px" }}>
                            {name || "-"}
                          </Tag>
                        ),
                      },
                      {
                        title: "Giờ vào ca",
                        dataIndex: "createdAt",
                        render: (date) => (
                          <Tag color="blue" style={{ fontWeight: 600, fontSize: 14 }}>
                            {dayjs(date).format("HH:mm")}
                          </Tag>
                        ),
                      },
                      {
                        title: "Thiết bị",
                        render: (_, log) => {
                          const isStoreIP =
                            log.ip && ["192.168.", "10.0.", "172.16."].some((p) => log.ip.startsWith(p));
                          return (
                            <Tag
                              color={isStoreIP ? "green" : "orange"}
                              icon={isStoreIP ? <AppstoreOutlined /> : <QuestionCircleOutlined />}
                            >
                              {isStoreIP ? "Máy tại quán" : "Thiết bị lạ"}
                            </Tag>
                          );
                        },
                      },
                      {
                        title: "Địa chỉ IP",
                        dataIndex: "ip",
                        render: (ip) =>
                          ip ? (
                            <code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>{ip}</code>
                          ) : (
                            "-"
                          ),
                      },
                    ]}
                  />
                )}
              </Card>
            )}

            {/* VIEW MODE: TIMELINE */}
            {viewMode === "timeline" && (
              <Card title="Timeline nhật ký" style={{ border: "1px solid #8c8c8c" }}>
                <Timeline mode="alternate" items={timelineItems} />
                {totalLogs > logs.length && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <Button
                      onClick={async () => {
                        const nextPage = currentPage + 1;
                        const newFilters = { ...filters, page: nextPage, limit: pageSize };
                        setLoading(true);
                        try {
                          const token = localStorage.getItem("token");
                          const params = new URLSearchParams({ ...newFilters, storeId: currentStore._id });
                          const res = await axios.get(`http://localhost:9999/api/activity-logs?${params.toString()}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const newLogs = res.data.data.logs || [];
                          setLogs((prev) => [...prev, ...newLogs]);
                          setCurrentPage(nextPage);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Xem thêm
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </Space>
        )}

        {/* DETAIL MODAL */}
        <Modal
          open={detailVisible}
          title={<div style={{ textAlign: "center", fontSize: 30, fontWeight: 600 }}>Chi tiết nhật ký</div>}
          footer={null}
          onCancel={() => setDetailVisible(false)}
          width={1000}
        >
          {selectedLog ? (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Người dùng">{selectedLog.userName}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">
                <Tag color={selectedLog.userRole === "MANAGER" ? "blue" : "green"}>{selectedLog.userRole}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Hành động">
                <Tag color="volcano">{selectedLog.action.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng">
                <Tag color="cyan">{selectedLog.entity}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tên đối tượng">{selectedLog.entityName}</Descriptions.Item>
              <Descriptions.Item label="Mô tả">{selectedLog.description}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ IP">{selectedLog.ip}</Descriptions.Item>
              <Descriptions.Item label="Thiết bị & Trình duyệt">{selectedLog.userAgent}</Descriptions.Item>
              <Descriptions.Item label="Thời gian">{formatDate(selectedLog.createdAt)}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Spin />
          )}
        </Modal>
      </div>
    </Layout>
  );
};

export default ActivityLog;
