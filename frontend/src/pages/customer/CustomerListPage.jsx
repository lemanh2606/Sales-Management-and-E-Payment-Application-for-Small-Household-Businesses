// src/pages/customer/CustomerListPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Space,
  Typography,
  Card,
  Input,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Badge,
  Divider,
  Tabs,
  Slider,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  WalletOutlined,
  FileExcelOutlined,
  UndoOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import CustomerForm from "../../components/customer/CustomerForm";
import { saveAs } from "file-saver";
import { searchCustomers, softDeleteCustomer, getCustomersByStore, exportCustomers, restoreCustomer } from "../../api/customerApi";
import Swal from "sweetalert2";

const { Title, Text } = Typography;
const { Search } = Input;

const formatMoney = (value) => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} tỷ₫`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")} triệu₫`;
  } else {
    return value.toLocaleString("vi-VN") + "₫";
  }
};

export default function CustomerListPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || storeObj.id || null;

  const [tabKey, setTabKey] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [spendingRange, setSpendingRange] = useState([0, 1000000000]);

  const [activeCustomers, setActiveCustomers] = useState([]);
  const [deletedCustomers, setDeletedCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);

  const [paginationActive, setPaginationActive] = useState({ current: 1, pageSize: 10 });
  const [paginationDeleted, setPaginationDeleted] = useState({ current: 1, pageSize: 10 });
  const [totalActive, setTotalActive] = useState(0);
  const [totalDeleted, setTotalDeleted] = useState(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch customers
  const fetchByStore = useCallback(async ({ sId, page = 1, limit = 10, isDeleted = false } = {}) => {
    if (!sId) {
      if (isDeleted) {
        setDeletedCustomers([]);
        setTotalDeleted(0);
      } else {
        setActiveCustomers([]);
        setTotalActive(0);
      }
      return;
    }
    try {
      setLoading(true);
      const res = await getCustomersByStore(sId, { page, limit, query: "", deleted: isDeleted });
      const list = Array.isArray(res.customers) ? res.customers : [];
      if (isDeleted) {
        setDeletedCustomers(Array.isArray(list) ? list : []);
        setTotalDeleted(res?.total ?? (Array.isArray(list) ? list.length : 0));
      } else {
        setActiveCustomers(Array.isArray(list) ? list : []);
        setTotalActive(res?.total ?? (Array.isArray(list) ? list.length : 0));
      }
    } catch (err) {
      console.error("getCustomersByStore error:", err);
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không thể tải danh sách khách hàng của cửa hàng",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. Reset page khi search/spending filter
  useEffect(() => {
    if (tabKey === "active") {
      setPaginationActive({ current: 1, pageSize: paginationActive.pageSize });
    } else {
      setPaginationDeleted({ current: 1, pageSize: paginationDeleted.pageSize });
    }
  }, [searchTerm, spendingRange]);

  // 2. Load tab active/deleted
  useEffect(() => {
    if (!storeId) return;
    const isDeleted = tabKey === "deleted";
    const pagination = isDeleted ? paginationDeleted : paginationActive;

    const timer = setTimeout(() => {
      fetchByStore({
        sId: storeId,
        page: pagination.current,
        limit: pagination.pageSize,
        isDeleted,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [storeId, tabKey, paginationActive, paginationDeleted, fetchByStore]);

  const openCreate = () => {
    setModalCustomer(null);
    setIsModalOpen(true);
  };

  const openEdit = (c) => {
    setModalCustomer(c);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalCustomer(null);
  };

  const onFormSuccess = (savedCustomer) => {
    const isDeleted = tabKey === "deleted";
    const pagination = isDeleted ? paginationDeleted : paginationActive;
    fetchByStore({
      sId: storeId,
      page: pagination.current,
      limit: pagination.pageSize,
      isDeleted,
    });
    closeModal();
  };

  const handleSoftDelete = async (id) => {
    try {
      setLoading(true);
      await softDeleteCustomer(id);
      Swal.fire({
        title: "🎉 Thành công!",
        text: "Xoá khách hàng thành công!",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
        timer: 2000,
      });
      // Fetch cả active và deleted để tổng khách hàng luôn đúng
      await fetchByStore({ sId: storeId, page: paginationActive.current, limit: paginationActive.pageSize, isDeleted: false });
      await fetchByStore({ sId: storeId, page: paginationDeleted.current, limit: paginationDeleted.pageSize, isDeleted: true });

      const pagination = paginationActive;
      fetchByStore({
        sId: storeId,
        page: pagination.current,
        limit: pagination.pageSize,
        isDeleted: false,
      });
    } catch (err) {
      console.error("delete error:", err);
      const errorMsg = err?.response?.data?.message || "Lỗi server khi xóa";
      Swal.fire({
        title: "❌ Lỗi!",
        text: errorMsg,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      setLoading(true);
      await restoreCustomer(id);
      Swal.fire({
        title: "🎉 Thành công!",
        text: "Khôi phục khách hàng thành công!",
        icon: "success",
        confirmButtonText: "OK",
        confirmButtonColor: "#52c41a",
        timer: 2000,
      });
      // Fetch cả active và deleted để tổng khách hàng luôn đúng
      await fetchByStore({ sId: storeId, page: paginationActive.current, limit: paginationActive.pageSize, isDeleted: false });
      await fetchByStore({ sId: storeId, page: paginationDeleted.current, limit: paginationDeleted.pageSize, isDeleted: true });

      const pagination = paginationDeleted;
      fetchByStore({
        sId: storeId,
        page: pagination.current,
        limit: pagination.pageSize,
        isDeleted: true,
      });
    } catch (err) {
      console.error("restore error:", err);
      const errorMsg = err?.response?.data?.message || "Lỗi server khi khôi phục";
      Swal.fire({
        title: "❌ Lỗi!",
        text: errorMsg,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const isDeleted = tabKey === "deleted";
    const pagination = isDeleted ? paginationDeleted : paginationActive;
    await fetchByStore({
      sId: storeId,
      page: pagination.current,
      limit: pagination.pageSize,
      isDeleted,
    });
    Swal.fire({
      title: "🎉 Thành công!",
      text: "Đã làm mới danh sách!",
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#52c41a",
    });
  };

  const handleTableChange = (pagination, tab) => {
    if (tab === "active") {
      setPaginationActive({ current: pagination.current, pageSize: pagination.pageSize });
    } else {
      setPaginationDeleted({ current: pagination.current, pageSize: pagination.pageSize });
    }
  };

  // Calculate total spending từ tất cả khách hàng hiển thị
  const currentData = tabKey === "active" ? activeCustomers : deletedCustomers;
  const totalSpending = currentData.reduce((sum, customer) => {
    const v = customer?.totalSpent ?? "0";
    const str = typeof v === "object" && v?.$numberDecimal ? v.$numberDecimal : String(v);
    const num = parseFloat(str.replace(/,/g, "")) || 0;
    return sum + num;
  }, 0);

  // Filter customers for display based on search term and spending range
  const filteredCustomers = currentData.filter((customer) => {
    const spent =
      typeof customer.totalSpent === "object" ? parseFloat(customer.totalSpent.$numberDecimal || "0") : parseFloat(customer.totalSpent || "0");

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        (customer.name && customer.name.toLowerCase().includes(term)) ||
        (customer.phone && customer.phone.toLowerCase().includes(term)) ||
        (customer.address && customer.address.toLowerCase().includes(term)) ||
        (customer.note && customer.note.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }

    // Filter by spending range
    return spent >= spendingRange[0] && spent <= spendingRange[1];
  });

  // Khi có search term hoặc spending filter, phân trang dựa trên filteredCustomers.length
  // Khi không có filter, phân trang dựa trên total từ API
  const currentTotal = tabKey === "active" ? totalActive : totalDeleted;
  const paginationTotal = searchTerm.trim() || spendingRange[0] > 0 || spendingRange[1] < 999999999 ? filteredCustomers.length : currentTotal;

  const handleExportCustomersExcel = async () => {
    try {
      if (!storeId) {
        console.warn("Không có storeId, không thể xuất Excel");
        return;
      }

      // Gọi API export
      const blob = await exportCustomers(storeId);

      // Tạo file Excel và download
      const fileName = `Danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Lỗi xuất danh sách khách hàng:", error);
    }
  };

  // Table columns
  const parseTotalSpent = (value) => {
    const str = typeof value === "object" && value?.$numberDecimal ? value.$numberDecimal : String(value);
    return parseFloat(str.replace(/,/g, "")) || 0;
  };

  const getColumns = (showRestore = false) => [
    {
      title: "STT",
      key: "index",
      width: 70,
      align: "center",
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (_, __, index) => {
        const pagination = tabKey === "active" ? paginationActive : paginationDeleted;
        return <Badge count={(pagination.current - 1) * pagination.pageSize + index + 1} style={{ backgroundColor: "#52c41a" }} />;
      },
    },
    {
      title: (
        <Space>
          <UserOutlined />
          <span>Tên khách hàng</span>
        </Space>
      ),
      dataIndex: "name",
      key: "name",
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (text) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text}
        </Text>
      ),
    },
    {
      title: (
        <Space>
          <PhoneOutlined />
          <span>Số điện thoại</span>
        </Space>
      ),
      dataIndex: "phone",
      key: "phone",
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (text) => (
        <Tag icon={<PhoneOutlined />} color="processing">
          {text}
        </Tag>
      ),
    },
    {
      title: (
        <Space>
          <EnvironmentOutlined />
          <span>Địa chỉ</span>
        </Space>
      ),
      dataIndex: "address",
      key: "address",
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (text) => text || <Text type="secondary">Chưa có</Text>,
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      ellipsis: { showTitle: false },
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          <span style={{ cursor: "pointer" }}>{text || <Text type="secondary">-</Text>}</span>
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <WalletOutlined />
          <span>Tổng chi tiêu</span>
        </Space>
      ),
      dataIndex: "totalSpent",
      key: "totalSpent",
      align: "right",
      render: (value) => {
        const num = parseTotalSpent(value);
        return (
          <Text strong style={{ color: "#52c41a" }}>
            {num.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}₫
          </Text>
        );
      },
      filters: [
        { text: "< 1 triệu", value: "lt1m" },
        { text: "1 – 5 triệu", value: "1m-5m" },
        { text: "5 – 10 triệu", value: "5m-10m" },
        { text: "> 10 triệu", value: "gt10m" },
      ],
      onFilter: (value, record) => {
        const num = parseTotalSpent(record.totalSpent);
        switch (value) {
          case "lt1m":
            return num < 1_000_000;
          case "1m-5m":
            return num >= 1_000_000 && num <= 5_000_000;
          case "5m-10m":
            return num > 5_000_000 && num <= 10_000_000;
          case "gt10m":
            return num > 10_000_000;
          default:
            return true;
        }
      },
      sorter: (a, b) => parseTotalSpent(a.totalSpent) - parseTotalSpent(b.totalSpent),
    },

    // Cột hành động - DYNAMIC dựa vào tab
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 250,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          {!showRestore && (
            <Tooltip title="Cập nhật thông tin">
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                }}
              >
                Sửa
              </Button>
            </Tooltip>
          )}

          {showRestore ? (
            <Popconfirm title="Khôi phục khách hàng này?" onConfirm={() => handleRestore(record._id)} okText="Có" cancelText="Không">
              <Tooltip title="Khôi phục khách hàng">
                <Button type="default" icon={<UndoOutlined />} style={{ color: "#52c41a", borderColor: "#52c41a" }}>
                  Khôi phục
                </Button>
              </Tooltip>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Xóa khách hàng"
              description="Bạn có chắc muốn xóa khách hàng này không?"
              onConfirm={() => handleSoftDelete(record._id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa khách hàng">
                <Button danger icon={<DeleteOutlined />}>
                  Xóa
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (!storeId) {
    return (
      <Layout>
        <Card
          style={{
            margin: "24px",
            borderRadius: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
        >
          <Title level={2}>Danh sách Khách hàng</Title>
          <Card
            style={{
              background: "linear-gradient(135deg, #FFF9C4 0%, #FFF59D 100%)",
              border: "none",
              marginTop: "16px",
            }}
          >
            <Text strong style={{ fontSize: "16px" }}>
              ⚠️ Không tìm thấy cửa hàng hiện hành. Vui lòng chọn cửa hàng trước khi xem danh sách khách hàng.
            </Text>
          </Card>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card style={{ borderRadius: "16px", marginBottom: "24px", border: "1px solid #8c8c8c" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <Title
            level={2}
            style={{
              margin: 0,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontSize: "32px",
              fontWeight: 700,
            }}
          >
            👥 Quản lý Khách hàng
          </Title>
          <Text type="secondary" style={{ fontSize: "14px" }}>
            Quản lý thông tin khách hàng - tên, số điện thoại và lịch sử chi tiêu
          </Text>
        </div>

        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: "24px" }}>
          <Col xs={24} sm={12} md={8}>
            <Tooltip title="Tổng số khách hàng trong cửa hàng, kể cả khách hàng đang hoạt động và khách hàng đã bị xoá">
              <Card
                style={{
                  background: "#2C5364",
                  border: "none",
                  borderRadius: "12px",
                  cursor: "pointer", // thêm cursor pointer
                }}
              >
                <Statistic
                  title={
                    <span style={{ color: "#fff" }}>
                      Tổng số khách hàng <InfoCircleOutlined style={{ marginLeft: 6, color: "#1890ff", cursor: "pointer" }} />
                    </span>
                  }
                  value={totalActive + totalDeleted}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Tooltip>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              style={{
                background: "#2C5364",
                border: "none",
                borderRadius: "12px",
              }}
            >
              <Statistic
                title={<span style={{ color: "#fff" }}>{tabKey === "active" ? "Khách hàng đang hoạt động" : "Khách hàng đã xóa"}</span>}
                value={tabKey === "active" ? totalActive : totalDeleted}
                prefix={<UserOutlined />}
                valueStyle={{ color: "#fff", fontWeight: "bold" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Card
              style={{
                background: "#2C5364",
                border: "none",
                borderRadius: "12px",
              }}
            >
              <Statistic
                title={<span style={{ color: "#fff" }}>Tổng chi tiêu của khách</span>}
                value={totalSpending}
                prefix={<WalletOutlined />}
                suffix="₫"
                valueStyle={{ color: "#fff", fontWeight: "bold" }}
              />
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* Actions Bar */}
        <Space
          style={{
            marginBottom: "24px",
            width: "100%",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, maxWidth: "700px" }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Search
                placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
                allowClear
                size="large"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "550px",
                }}
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
              />
              <div>
                <Text style={{ fontSize: "12px", color: "#666" }}>Lọc theo tổng chi tiêu</Text>
                <Slider
                  range
                  min={0}
                  max={1_000_000_000}
                  step={10_000}
                  value={spendingRange}
                  onChange={setSpendingRange}
                  tooltip={{
                    formatter: (value) => formatMoney(value), // Hiển thị khi kéo
                    placement: "top", // Tùy chọn vị trí
                  }}
                  marks={{
                    0: "0₫",
                    100_000_000: "100 triệu",
                    500_000_000: "500 triệu",
                    1_000_000_000: "1tỷ",
                  }}
                />
              </div>
            </Space>
          </div>

          <Space>
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              style={{
                borderRadius: "8px",
                fontWeight: 500,
              }}
            >
              Làm mới
            </Button>
            <Button
              size={isMobile ? "middle" : "large"}
              icon={<FileExcelOutlined />}
              onClick={handleExportCustomersExcel}
              style={{
                borderColor: "#52c41a",
                color: "#52c41a",
              }}
            >
              {!isMobile ? "Xuất Excel" : "Xuất"}
            </Button>
            {tabKey === "active" && (
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={openCreate}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 500,
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                }}
              >
                Thêm khách hàng
              </Button>
            )}
          </Space>
        </Space>

        {/* Tabs - Active vs Deleted */}
        <Tabs
          activeKey={tabKey}
          onChange={(key) => {
            setTabKey(key);
            setSearchTerm("");
            setSpendingRange([0, 999999999]);
          }}
          items={[
            {
              key: "active",
              label: "Khách hàng đang hoạt động",
              children: (
                <Table
                  columns={getColumns(false)}
                  dataSource={filteredCustomers}
                  rowKey="_id"
                  loading={loading}
                  pagination={{
                    current: paginationActive.current,
                    pageSize: paginationActive.pageSize,
                    total: paginationTotal,
                    showSizeChanger: true,
                    showTotal: (total, range) => (
                      <div style={{ fontSize: 14, color: "#595959" }}>
                        Đang xem{" "}
                        <span style={{ color: "#1677ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> khách hàng
                      </div>
                    ),
                    pageSizeOptions: ["5", "10", "20", "50", "100"],
                    style: { marginTop: "16px" },
                  }}
                  onChange={(pag) => handleTableChange(pag, "active")}
                  scroll={{ x: 1200 }}
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                  rowClassName={(record, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  locale={{
                    emptyText: (
                      <div style={{ padding: "48px 0" }}>
                        <UserOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
                        <div style={{ marginTop: "16px", color: "#999" }}>Không có khách hàng nào</div>
                      </div>
                    ),
                  }}
                />
              ),
            },
            {
              key: "deleted",
              label: "Khách hàng đã bị xóa",
              children: (
                <Table
                  columns={getColumns(true)}
                  dataSource={filteredCustomers}
                  rowKey="_id"
                  loading={loading}
                  pagination={{
                    current: paginationDeleted.current,
                    pageSize: paginationDeleted.pageSize,
                    total: paginationTotal,
                    showSizeChanger: true,
                    showTotal: (total, range) => (
                      <div style={{ fontSize: 14, color: "#595959" }}>
                        Đang xem{" "}
                        <span style={{ color: "#1677ff", fontWeight: 600 }}>
                          {range[0]} – {range[1]}
                        </span>{" "}
                        trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> khách hàng
                      </div>
                    ),
                    pageSizeOptions: ["5", "10", "20", "50", "100"],
                    style: { marginTop: "16px" },
                  }}
                  onChange={(pag) => handleTableChange(pag, "deleted")}
                  scroll={{ x: 1200 }}
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                  rowClassName={(record, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  locale={{
                    emptyText: (
                      <div style={{ padding: "48px 0" }}>
                        <UserOutlined style={{ fontSize: "48px", color: "#d9d9d9" }} />
                        <div style={{ marginTop: "16px", color: "#999" }}>Không có khách hàng đã xóa</div>
                      </div>
                    ),
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: "#1890ff" }} />
            <span style={{ fontSize: "18px", fontWeight: 600 }}>{modalCustomer ? "Cập nhật khách hàng" : "Thêm khách hàng mới"}</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{
          maxHeight: "calc(100vh - 200px)",
          overflowY: "auto",
          padding: "24px",
        }}
      >
        <CustomerForm customer={modalCustomer} onSuccess={onFormSuccess} onCancel={closeModal} />
      </Modal>

      {/* Custom CSS for table rows */}
      <style jsx>{`
        :global(.table-row-light) {
          background-color: #ffffff;
        }
        :global(.table-row-dark) {
          background-color: #fafafa;
        }
        :global(.table-row-light:hover),
        :global(.table-row-dark:hover) {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </Layout>
  );
}
