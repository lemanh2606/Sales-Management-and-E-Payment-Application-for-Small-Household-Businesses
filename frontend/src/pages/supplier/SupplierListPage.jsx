// src/pages/supplier/SupplierListPage.jsx
import React, { useEffect, useState, useMemo } from "react";
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
  notification,
  Statistic,
  Row,
  Col,
  Divider,
  AutoComplete,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  UserOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import SupplierFormModal from "../../components/supplier/SupplierFormModal";
import SupplierDetailModal from "../../components/supplier/SupplierDetailModal";
import { getSuppliers, deleteSupplier, exportSuppliers } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";

const { Title, Text } = Typography;

export default function SupplierListPage() {
  const [api, contextHolder] = notification.useNotification();
  const { token } = useAuth();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [allSuppliers, setAllSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSupplierId, setDetailSupplierId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchSuppliers = async (showNotification = false) => {
    if (!storeId || !token) {
      api.warning({
        message: "⚠️ Chưa đăng nhập",
        description: "Vui lòng đăng nhập để xem danh sách nhà cung cấp",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);
      const data = await getSuppliers(storeId);
      const supplierList = Array.isArray(data?.suppliers) ? data.suppliers : Array.isArray(data) ? data : [];

      setAllSuppliers(supplierList);
      setFilteredSuppliers(supplierList);

      if (showNotification) {
        api.success({
          message: "🎉 Tải dữ liệu thành công",
          description: `Đã tải ${supplierList.length} nhà cung cấp`,
          placement: "topRight",
          duration: 3,
        });
      }
    } catch (err) {
      console.error(err);
      api.error({
        message: "❌ Lỗi tải dữ liệu",
        description: "Không thể tải danh sách nhà cung cấp. Vui lòng thử lại.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [storeId, token]);

  // Client-side search filter
  useEffect(() => {
    if (!searchValue.trim()) {
      setFilteredSuppliers(allSuppliers);
      setCurrentPage(1);
      return;
    }

    const searchLower = searchValue.toLowerCase().trim();
    const filtered = allSuppliers.filter((supplier) => {
      const name = (supplier.name || "").toLowerCase();
      const phone = (supplier.phone || "").toLowerCase();
      const email = (supplier.email || "").toLowerCase();
      const address = (supplier.address || "").toLowerCase();

      return name.includes(searchLower) || phone.includes(searchLower) || email.includes(searchLower) || address.includes(searchLower);
    });

    setFilteredSuppliers(filtered);
    setCurrentPage(1);

    if (searchValue.trim()) {
      api.info({
        message: `🔍 Kết quả tìm kiếm`,
        description: `Tìm thấy ${filtered.length} nhà cung cấp phù hợp`,
        placement: "topRight",
        duration: 2,
      });
    }
  }, [searchValue, allSuppliers]);

  // AutoComplete options
  const searchOptions = useMemo(() => {
    if (!searchValue.trim()) return [];

    const searchLower = searchValue.toLowerCase();
    const matches = allSuppliers
      .filter((supplier) => {
        const name = (supplier.name || "").toLowerCase();
        const phone = (supplier.phone || "").toLowerCase();
        return name.includes(searchLower) || phone.includes(searchLower);
      })
      .slice(0, 10);

    return matches.map((supplier) => ({
      value: supplier.name,
      label: (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <TeamOutlined style={{ color: "#1890ff" }} />
            <span>{supplier.name}</span>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {supplier.phone || "No phone"}
          </Text>
        </div>
      ),
    }));
  }, [searchValue, allSuppliers]);

  const handleRefresh = async () => {
    api.info({
      message: "🔄 Đang làm mới...",
      description: "Đang tải lại dữ liệu nhà cung cấp",
      placement: "topRight",
      duration: 1,
      key: "refresh",
    });

    await fetchSuppliers(false);
    setSearchValue("");

    api.success({
      message: "✅ Đã làm mới!",
      description: "Dữ liệu nhà cung cấp đã được cập nhật",
      placement: "topRight",
      duration: 2,
      key: "refresh",
    });
  };

  const openFormModal = (supplierId = null) => {
    setEditSupplierId(supplierId);
    setFormModalOpen(true);

    // api.info({
    //   message: supplierId ? "✏️ Chỉnh sửa nhà cung cấp" : "📝 Thêm nhà cung cấp mới",
    //   description: supplierId ? "Vui lòng cập nhật thông tin nhà cung cấp" : "Vui lòng điền đầy đủ thông tin nhà cung cấp",
    //   placement: "topRight",
    //   duration: 2,
    // });
  };

  const openDetail = (supplierId) => {
    setDetailSupplierId(supplierId);
    setDetailModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteSupplier(id);
      setAllSuppliers((prev) => prev.filter((s) => s._id !== id));
      setFilteredSuppliers((prev) => prev.filter((s) => s._id !== id));

      api.success({
        message: "🗑️ Xóa thành công!",
        description: `Đã xóa nhà cung cấp "${name}"`,
        placement: "topRight",
        duration: 3,
      });
    } catch (err) {
      console.error(err);
      api.error({
        message: "❌ Lỗi xóa",
        description: "Không thể xóa nhà cung cấp. Vui lòng thử lại.",
        placement: "topRight",
        duration: 5,
      });
    }
  };

  const onFormSuccess = () => {
    fetchSuppliers(false);
    setFormModalOpen(false);

    api.success({
      message: editSupplierId ? "🎉 Cập nhật thành công!" : "🎉 Tạo mới thành công!",
      description: editSupplierId ? "Thông tin nhà cung cấp đã được cập nhật" : "Nhà cung cấp mới đã được thêm vào danh sách",
      placement: "topRight",
      duration: 4,
    });
  };

  // Statistics
  const activeSuppliers = filteredSuppliers.filter((s) => s.status === "đang hoạt động").length;
  const inactiveSuppliers = filteredSuppliers.length - activeSuppliers;

  // Table columns
  const columns = [
    {
      title: (
        <Space>
          <TeamOutlined style={{ color: "#1890ff" }} />
          <span>Tên nhà cung cấp</span>
        </Space>
      ),
      dataIndex: "name",
      key: "name",
      width: isMobile ? 150 : 200,
      ellipsis: true,
      render: (text) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text}
        </Text>
      ),
    },
    {
      title: (
        <Space>
          <PhoneOutlined style={{ color: "#52c41a" }} />
          <span>SĐT</span>
        </Space>
      ),
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (text) => <Tag color="green">{text || "-"}</Tag>,
    },
    {
      title: (
        <Space>
          <MailOutlined style={{ color: "#faad14" }} />
          <span>Email</span>
        </Space>
      ),
      dataIndex: "email",
      key: "email",
      width: 200,
      ellipsis: true,
      render: (text) => <Text type="secondary">{text || "-"}</Text>,
    },
    {
      title: (
        <Space>
          <EnvironmentOutlined style={{ color: "#f5222d" }} />
          <span>Địa chỉ</span>
        </Space>
      ),
      dataIndex: "address",
      key: "address",
      width: 200,
      ellipsis: true,
      render: (text) => <Text>{text || "-"}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      align: "center",
      render: (status) => (
        <Tag
          icon={status === "đang hoạt động" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={status === "đang hoạt động" ? "success" : "error"}
        >
          {status || "Không xác định"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "action",
      width: 150,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button type="primary" icon={<EyeOutlined />} size="small" onClick={() => openDetail(record._id)} style={{ background: "#1890ff" }} />
          </Tooltip>

          <Tooltip title="Chỉnh sửa">
            <Button
              type="default"
              icon={<EditOutlined />}
              size="small"
              onClick={() => openFormModal(record._id)}
              style={{ color: "#faad14", borderColor: "#faad14" }}
            />
          </Tooltip>

          <Popconfirm
            title="Xóa nhà cung cấp?"
            description={`Bạn có chắc muốn xóa "${record.name}"?`}
            onConfirm={() => handleDelete(record._id, record.name)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setItemsPerPage(pagination.pageSize);
  };

  const handleExportSuppliersExcel = async () => {
    if (!storeId) {
      api.warning({
        message: "⚠️ Không tìm thấy cửa hàng",
        description: "Vui lòng chọn cửa hàng trước khi xuất Excel",
        placement: "topRight",
      });
      return;
    }

    const key = "exporting";
    api.info({
      message: "📤 Đang xuất danh sách nhà cung cấp...",
      placement: "topRight",
      key,
    });

    try {
      await exportSuppliers(storeId);
      // api.success({
      //   message: "✅ Xuất Excel thành công",
      //   description: "Danh sách nhà cung cấp đã được tải xuống",
      //   placement: "topRight",
      //   key,
      //   duration: 3,
      // });
    } catch (error) {
      console.error("Lỗi xuất Excel:", error);
      api.error({
        message: "❌ Xuất Excel thất bại",
        description: error?.message || "Vui lòng thử lại",
        placement: "topRight",
        key,
        duration: 5,
      });
    }
  };

  if (!storeId) {
    return (
      <Layout>
        {contextHolder}
        <Card style={{ margin: 24, borderRadius: 16 }}>
          <Title level={2}>Danh sách nhà cung cấp</Title>
          <Card style={{ background: "#FFF9C4", border: "none", marginTop: 16 }}>
            <Text strong>⚠️ Không tìm thấy cửa hàng hiện hành.</Text>
          </Card>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {contextHolder}

      <div style={{ padding: isMobile ? 12 : 2, background: "#ffffff", minHeight: "100vh" }}>
        <Card style={{ borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 24 }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title
              level={2}
              style={{
                margin: 0,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontSize: isMobile ? 24 : 32,
                fontWeight: 700,
              }}
            >
              🏢 Quản lý Nhà cung cấp
            </Title>
            {!isMobile && <Text type="secondary">Quản lý thông tin và giao dịch với nhà cung cấp</Text>}
          </div>

          {/* Statistics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={12} md={8}>
              <Card
                style={{
                  background: "#2C5364",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Tổng nhà cung cấp</span>}
                  value={filteredSuppliers.length}
                  prefix={<TeamOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>

            <Col xs={12} sm={12} md={8}>
              <Card
                style={{
                  background: "#03cc43ff",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Đang hoạt động</span>}
                  value={activeSuppliers}
                  prefix={<CheckCircleOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>

            <Col xs={12} sm={12} md={8}>
              <Card
                style={{
                  background: "#db1111ff",
                  border: "none",
                  borderRadius: 12,
                }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
              >
                <Statistic
                  title={<span style={{ color: "#fff", fontSize: isMobile ? 11 : 14 }}>Ngừng hoạt động</span>}
                  value={inactiveSuppliers}
                  prefix={<CloseCircleOutlined style={{ fontSize: isMobile ? 16 : 24 }} />}
                  valueStyle={{ color: "#fff", fontWeight: "bold", fontSize: isMobile ? 18 : 24 }}
                />
              </Card>
            </Col>
          </Row>

          {!isMobile && <Divider />}

          {/* Actions */}
          <Space
            direction={isMobile ? "vertical" : "horizontal"}
            style={{ marginBottom: 24, width: "100%", justifyContent: "space-between" }}
            size={16}
          >
            <AutoComplete
              value={searchValue}
              options={searchOptions}
              onChange={(value) => setSearchValue(value)}
              onSelect={(value) => setSearchValue(value)}
              style={{ width: isMobile ? "100%" : 400 }}
              size="large"
              placeholder={isMobile ? "Tìm kiếm..." : "Tìm kiếm nhà cung cấp..."}
              allowClear
              onClear={() => setSearchValue("")}
            >
              <Input
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                suffix={
                  searchValue && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {filteredSuppliers.length} kết quả
                    </Text>
                  )
                }
              />
            </AutoComplete>

            <Space size={12} wrap>
              <Button size="large" icon={<ReloadOutlined />} onClick={handleRefresh}>
                {!isMobile && "Làm mới"}
              </Button>

              <Button
                size={isMobile ? "middle" : "large"}
                icon={<FileExcelOutlined />}
                onClick={handleExportSuppliersExcel}
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
                onClick={() => openFormModal(null)}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                }}
              >
                {isMobile ? "+" : "Thêm NCC"}
              </Button>
            </Space>
          </Space>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredSuppliers}
            rowKey="_id"
            loading={loading}
            showSizeChanger={true}
            pagination={{
              current: currentPage,
              pageSize: itemsPerPage,
              total: filteredSuppliers.length,
              showSizeChanger: !isMobile,
              showTotal: (total, range) => (
                <div>
                  Đang xem{" "}
                  <span style={{ color: "#1677ff", fontWeight: 600 }}>
                    {range[0]} – {range[1]}
                  </span>{" "}
                  trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhà cung cấp
                </div>
              ),
              pageSizeOptions: ["5", "10", "20", "50"],
            }}
            onChange={handleTableChange}
            scroll={{ x: "max-content" }}
            size={isMobile ? "small" : "middle"}
            rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
            locale={{
              emptyText: (
                <div style={{ padding: isMobile ? "24px 0" : "48px 0" }}>
                  <TeamOutlined style={{ fontSize: isMobile ? 32 : 48, color: "#d9d9d9" }} />
                  <div style={{ marginTop: 16, color: "#999" }}>
                    {searchValue ? `Không tìm thấy nhà cung cấp nào với từ khóa "${searchValue}"` : "Không có nhà cung cấp nào"}
                  </div>
                </div>
              ),
            }}
          />
        </Card>

        {/* Modals */}
        <SupplierFormModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          storeId={storeId}
          supplierId={editSupplierId}
          onSuccess={onFormSuccess}
        />

        <SupplierDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} supplierId={detailSupplierId} />
      </div>

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

        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar {
          height: 14px;
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-track {
          background: #f5f5f5;
          border-radius: 10px;
        }
        :global(.ant-table) :global(.ant-table-content)::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          border: 3px solid #f5f5f5;
        }
      `}</style>

      <style jsx global>{`
        .ant-notification-notice {
          border-radius: 12px !important;
        }
      `}</style>
    </Layout>
  );
}
