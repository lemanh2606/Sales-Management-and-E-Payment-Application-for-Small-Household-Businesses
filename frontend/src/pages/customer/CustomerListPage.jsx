// src/pages/customer/CustomerListPage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Table, Button, Modal, Space, Typography, Card, Input, Tag, Tooltip, message, Popconfirm, Statistic, Row, Col, Badge, Divider } from "antd";
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
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import CustomerForm from "../../components/customer/CustomerForm";
import { saveAs } from "file-saver";
import { searchCustomers, softDeleteCustomer, getCustomersByStore, exportCustomers } from "../../api/customerApi";

const { Title, Text } = Typography;
const { Search } = Input;

export default function CustomerListPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || storeObj.id || null;

  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch customers
  const fetchByStore = useCallback(async ({ sId, page = 1, limit = 10, query = "" } = {}) => {
    if (!sId) {
      setCustomers([]);
      setTotalItems(0);
      return;
    }
    try {
      setLoading(true);
      const res = await getCustomersByStore(sId, { page, limit, query });
      const list = Array.isArray(res) ? res : res?.customers ?? [];
      setCustomers(Array.isArray(list) ? list : []);
      setTotalItems(res?.total ?? (Array.isArray(list) ? list.length : 0));
      setCurrentPage(res?.page ? Number(res.page) : page);
      setItemsPerPage(res?.limit ? Number(res.limit) : limit);
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

  useEffect(() => {
    setCurrentPage(1);
    fetchByStore({ sId: storeId, page: 1, limit: itemsPerPage, query: "" });
  }, [storeId, fetchByStore, itemsPerPage]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchByStore({ sId: storeId, page: 1, limit: itemsPerPage, query: searchTerm.trim() });
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm, storeId, fetchByStore, itemsPerPage]);

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
    fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
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
      });
      fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
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

  const handleRefresh = async () => {
    await fetchByStore({ sId: storeId, page: currentPage, limit: itemsPerPage, query: searchTerm.trim() });
    Swal.fire({
      title: "🎉 Thành công!",
      text: "Đã làm mới danh sách!",
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#52c41a",
    });
  };

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setItemsPerPage(pagination.pageSize);
    fetchByStore({
      sId: storeId,
      page: pagination.current,
      limit: pagination.pageSize,
      query: searchTerm.trim(),
    });
  };

  // Calculate total spending
  const totalSpending = customers.reduce((sum, customer) => {
    const v = customer?.totalSpent ?? "0";
    const str = typeof v === "object" && v?.$numberDecimal ? v.$numberDecimal : String(v);
    const num = parseFloat(str.replace(/,/g, "")) || 0;
    return sum + num;
  }, 0);

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
  const columns = [
    {
      title: "STT",
      key: "index",
      width: 70,
      align: "center",
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (_, __, index) => <Badge count={(currentPage - 1) * itemsPerPage + index + 1} style={{ backgroundColor: "#52c41a" }} />,
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
      onCell: () => ({ style: { cursor: "pointer" } }),
      render: (value) => {
        const v = value ?? "0";
        const str = typeof v === "object" && v?.$numberDecimal ? v.$numberDecimal : String(v);
        const num = parseFloat(str.replace(/,/g, "")) || 0;
        return (
          <Text strong style={{ color: "#52c41a" }}>
            {num.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}₫
          </Text>
        );
      },
    },

    // Cột hành động KHÔNG thêm cursor pointer
    {
      title: "Hành động",
      key: "action",
      align: "center",
      width: 200,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
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
            <Card
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                borderRadius: "12px",
              }}
            >
              <Statistic
                title={<span style={{ color: "#fff" }}>Tổng khách hàng</span>}
                value={totalItems}
                prefix={<UserOutlined />}
                valueStyle={{ color: "#fff", fontWeight: "bold" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card
              style={{
                background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                border: "none",
                borderRadius: "12px",
              }}
            >
              <Statistic
                title={<span style={{ color: "#fff" }}>Khách hàng hiện tại</span>}
                value={customers.length}
                prefix={<UserOutlined />}
                valueStyle={{ color: "#fff", fontWeight: "bold" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Card
              style={{
                background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                border: "none",
                borderRadius: "12px",
              }}
            >
              <Statistic
                title={<span style={{ color: "#fff" }}>Tổng doanh thu</span>}
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
          <Search
            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
            allowClear
            size="large"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "400px",
            }}
            prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
          />

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
          </Space>
        </Space>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: itemsPerPage,
            total: totalItems,
            showSizeChanger: true,
            showTotal: (total, range) => (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  fontSize: 14,
                  color: "#595959",
                }}
              >
                <div>
                  Đang xem{" "}
                  <span style={{ color: "#1677ff", fontWeight: 600 }}>
                    {range[0]} – {range[1]}
                  </span>{" "}
                  trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> khách hàng
                </div>
              </div>
            ),
            pageSizeOptions: ["5", "10", "20", "50", "100"],
            style: { marginTop: "16px" },
          }}
          onChange={handleTableChange}
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
