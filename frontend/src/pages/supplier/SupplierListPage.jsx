// src/pages/supplier/SupplierListPage.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Table,
  Button,
  Space,
  Typography,
  Card,
  Tag,
  Tooltip,
  notification,
  Statistic,
  Row,
  Col,
  Divider,
  Tabs,
  Popconfirm,
  Badge,
  Input,
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
  FileExcelOutlined,
  UndoOutlined,
  InfoCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import SupplierFormModal from "../../components/supplier/SupplierFormModal";
import SupplierDetailModal from "../../components/supplier/SupplierDetailModal";
import { getSuppliers, deleteSupplier, exportSuppliers, restoreSupplier } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";

const { Title, Text } = Typography;
const { Search } = Input;

// --- Helpers: normalize Mongo Extended JSON (_id: {$oid}, createdAt: {$date}) ---
const normalizeMongoId = (idLike) => {
  if (!idLike) return null;

  // Mongo Extended JSON: { $oid: "..." }
  if (typeof idLike === "object" && idLike.$oid) return String(idLike.$oid);

  // Mongoose/ObjectId: has toString()
  if (typeof idLike === "object" && typeof idLike.toString === "function") return String(idLike.toString());

  // Already string
  if (typeof idLike === "string") return idLike;

  return String(idLike);
};

const normalizeMongoDate = (dateLike) => {
  if (!dateLike) return null;

  // Mongo Extended JSON: { $date: "..." }
  if (typeof dateLike === "object" && dateLike.$date) return dateLike.$date;

  return dateLike;
};

const normalizeSupplier = (s) => {
  const _id = normalizeMongoId(s?._id) || normalizeMongoId(s?.id);
  return {
    ...s,
    _id, // luôn là string
    store_id: normalizeMongoId(s?.store_id),
    createdAt: normalizeMongoDate(s?.createdAt),
    updatedAt: normalizeMongoDate(s?.updatedAt),
  };
};

const fmtDateTime = (v) => {
  const raw = normalizeMongoDate(v);
  if (!raw) return "-";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("vi-VN");
};

export default function SupplierListPage() {
  const [api, contextHolder] = notification.useNotification();
  const { token } = useAuth();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || storeObj.id || null;

  const [tabKey, setTabKey] = useState("active"); // active | deleted
  const [searchTerm, setSearchTerm] = useState("");

  const [activeSuppliers, setActiveSuppliers] = useState([]);
  const [deletedSuppliers, setDeletedSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSupplierId, setDetailSupplierId] = useState(null);

  const [paginationActive, setPaginationActive] = useState({ current: 1, pageSize: 10 });
  const [paginationDeleted, setPaginationDeleted] = useState({ current: 1, pageSize: 10 });

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchActiveSuppliers = useCallback(
    async (showNoti = false) => {
      if (!storeId || !token) return;

      try {
        setLoading(true);
        const res = await getSuppliers(storeId, { deleted: false });
        const list = Array.isArray(res?.suppliers) ? res.suppliers : [];
        const normalized = list.map(normalizeSupplier);
        setActiveSuppliers(normalized);

        if (showNoti) {
          api.success({
            message: "🎉 Tải dữ liệu thành công",
            description: `Đã tải ${normalized.length} nhà cung cấp`,
            placement: "topRight",
            duration: 3,
          });
        }
      } catch (e) {
        console.error(e);
        api.error({
          message: "❌ Lỗi tải dữ liệu",
          description: "Không thể tải danh sách nhà cung cấp.",
          placement: "topRight",
          duration: 5,
        });
      } finally {
        setLoading(false);
      }
    },
    [storeId, token, api]
  );

  const fetchDeletedSuppliers = useCallback(
    async (showNoti = false) => {
      if (!storeId || !token) return;

      try {
        setLoading(true);
        const res = await getSuppliers(storeId, { deleted: true });
        const list = Array.isArray(res?.suppliers) ? res.suppliers : [];
        const normalized = list.map(normalizeSupplier);
        setDeletedSuppliers(normalized);

        if (showNoti) {
          api.success({
            message: "🎉 Tải dữ liệu thành công",
            description: `Đã tải ${normalized.length} nhà cung cấp đã xóa`,
            placement: "topRight",
            duration: 3,
          });
        }
      } catch (e) {
        console.error(e);
        api.error({
          message: "❌ Lỗi tải dữ liệu",
          description: "Không thể tải danh sách nhà cung cấp đã xóa.",
          placement: "topRight",
          duration: 5,
        });
      } finally {
        setLoading(false);
      }
    },
    [storeId, token, api]
  );

  useEffect(() => {
    if (!storeId || !token) return;
    fetchActiveSuppliers(false);
    fetchDeletedSuppliers(false);
  }, [storeId, token, fetchActiveSuppliers, fetchDeletedSuppliers]);

  useEffect(() => {
    if (tabKey === "active") setPaginationActive((p) => ({ ...p, current: 1 }));
    else setPaginationDeleted((p) => ({ ...p, current: 1 }));
  }, [tabKey, searchTerm]);

  const currentData = tabKey === "active" ? activeSuppliers : deletedSuppliers;

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return currentData;

    const term = searchTerm.trim().toLowerCase();
    return currentData.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const address = (s.address || "").toLowerCase();
      return name.includes(term) || phone.includes(term) || email.includes(term) || address.includes(term);
    });
  }, [currentData, searchTerm]);

  const totalActive = activeSuppliers.length;
  const totalDeleted = deletedSuppliers.length;

  const activeStatusCount = activeSuppliers.filter((s) => s.status === "đang hoạt động").length;
  const inactiveStatusCount = Math.max(activeSuppliers.length - activeStatusCount, 0);

  const openCreate = () => {
    setEditSupplierId(null);
    setFormModalOpen(true);
  };

  // IMPORTANT: supplierId đã là string sau normalizeSupplier
  const openEdit = (supplierId) => {
    setEditSupplierId(supplierId);
    setFormModalOpen(true);
  };

  const openDetail = (supplierId) => {
    setDetailSupplierId(supplierId);
    setDetailModalOpen(true);
  };

  const onFormSuccess = async () => {
    await fetchActiveSuppliers(false);
    await fetchDeletedSuppliers(false);
    setFormModalOpen(false);
  };

  const handleSoftDelete = async (id, name) => {
    if (!id) {
      api.error({
        message: "❌ Lỗi dữ liệu",
        description: "Không tìm thấy ID nhà cung cấp để xóa.",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);
      await deleteSupplier(id);

      api.success({
        message: "🗑️ Xóa thành công!",
        description: `Đã xóa nhà cung cấp "${name}"`,
        placement: "topRight",
        duration: 3,
      });

      await fetchActiveSuppliers(false);
      await fetchDeletedSuppliers(false);
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Lỗi xóa",
        description: e?.response?.data?.message || "Không thể xóa nhà cung cấp.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id, name) => {
    if (!id) {
      api.error({
        message: "❌ Lỗi dữ liệu",
        description: "Không tìm thấy ID nhà cung cấp để khôi phục.",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);
      await restoreSupplier(id);

      api.success({
        message: "✅ Khôi phục thành công!",
        description: `Đã khôi phục nhà cung cấp "${name}"`,
        placement: "topRight",
        duration: 3,
      });

      await fetchActiveSuppliers(false);
      await fetchDeletedSuppliers(false);
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Lỗi khôi phục",
        description: e?.response?.data?.message || "Không thể khôi phục nhà cung cấp.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchActiveSuppliers(false);
    await fetchDeletedSuppliers(false);
    setSearchTerm("");
  };

  const handleExportSuppliersExcel = async () => {
    try {
      await exportSuppliers(storeId);
    } catch (e) {
      console.error(e);
      api.error({
        message: "❌ Xuất Excel thất bại",
        description: e?.message || "Vui lòng thử lại",
        placement: "topRight",
        duration: 5,
      });
    }
  };

  const handleTableChange = (pagination, tab) => {
    if (tab === "active") setPaginationActive({ current: pagination.current, pageSize: pagination.pageSize });
    else setPaginationDeleted({ current: pagination.current, pageSize: pagination.pageSize });
  };

  const getColumns = (showRestore = false) => [
    {
      title: "STT",
      key: "index",
      width: 70,
      align: "center",
      render: (_, __, index) => {
        const pagination = tabKey === "active" ? paginationActive : paginationDeleted;
        return <Badge count={(pagination.current - 1) * pagination.pageSize + index + 1} style={{ backgroundColor: "#52c41a" }} />;
      },
    },
    {
      title: (
        <Space>
          <TeamOutlined style={{ color: "#1890ff" }} />
          <span>Tên nhà cung cấp</span>
        </Space>
      ),
      dataIndex: "name",
      key: "name",
      width: isMobile ? 170 : 230,
      ellipsis: true,
      render: (text) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text || "-"}
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
      width: 150,
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
      width: 240,
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
      width: 260,
      ellipsis: true,
      render: (text) => <Text>{text || "-"}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 160,
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
      title: (
        <Space>
          <CalendarOutlined />
          <span>Ngày tạo</span>
        </Space>
      ),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (v) => <Text type="secondary">{fmtDateTime(v)}</Text>,
    },
    {
      title: (
        <Space>
          <CalendarOutlined />
          <span>Cập nhật</span>
        </Space>
      ),
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (v) => <Text type="secondary">{fmtDateTime(v)}</Text>,
    },
    {
      title: "Hành động",
      key: "action",
      width: showRestore ? 260 : 300,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        // record._id đã là string sau normalizeSupplier
        const supplierId = record?._id;

        console.log("Rendering actions for supplierId:", supplierId);

        return (
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="primary"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => openDetail(supplierId)}
                style={{ background: "#1890ff" }}
              />
            </Tooltip>

            {!showRestore && (
              <Tooltip title="Chỉnh sửa">
                <Button
                  type="default"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => openEdit(supplierId)}
                  style={{ color: "#faad14", borderColor: "#faad14" }}
                />
              </Tooltip>
            )}

            {showRestore ? (
              <Popconfirm
                title="Khôi phục nhà cung cấp?"
                description={`Bạn có chắc muốn khôi phục "${record.name}"?`}
                onConfirm={() => handleRestore(supplierId, record.name)}
                okText="Khôi phục"
                cancelText="Hủy"
              >
                <Tooltip title="Khôi phục nhà cung cấp">
                  <Button
                    type="default"
                    icon={<UndoOutlined />}
                    size="small"
                    style={{ color: "#52c41a", borderColor: "#52c41a" }}
                  >
                    Khôi phục
                  </Button>
                </Tooltip>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Xóa nhà cung cấp?"
                description={`Bạn có chắc muốn xóa "${record.name}"?`}
                onConfirm={() => handleSoftDelete(supplierId, record.name)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Xóa">
                  <Button type="primary" danger icon={<DeleteOutlined />} size="small" />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

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

  const currentTotal = tabKey === "active" ? totalActive : totalDeleted;
  const paginationTotal = searchTerm.trim() ? filteredSuppliers.length : currentTotal;

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
            {!isMobile && <Text type="secondary">Quản lý thông tin nhà cung cấp theo cửa hàng</Text>}
          </div>

          {/* Statistics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={8}>
              <Tooltip title="Tổng số nhà cung cấp trong cửa hàng (kể cả đã xóa)">
                <Card style={{ background: "#2C5364", border: "none", borderRadius: 12 }}>
                  <Statistic
                    title={
                      <span style={{ color: "#fff" }}>
                        Tổng nhà cung cấp <InfoCircleOutlined style={{ marginLeft: 6, color: "#1890ff" }} />
                      </span>
                    }
                    value={totalActive + totalDeleted}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: "#fff", fontWeight: "bold" }}
                  />
                </Card>
              </Tooltip>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Card style={{ background: "#2C5364", border: "none", borderRadius: 12 }}>
                <Statistic
                  title={<span style={{ color: "#fff" }}>{tabKey === "active" ? "Nhà cung cấp đang hoạt động" : "Nhà cung cấp đã xóa"}</span>}
                  value={tabKey === "active" ? totalActive : totalDeleted}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={24} md={8}>
              <Card style={{ background: "#2C5364", border: "none", borderRadius: 12 }}>
                <Statistic
                  title={<span style={{ color: "#fff" }}>Trạng thái (active)</span>}
                  value={`${activeStatusCount} / ${inactiveStatusCount}`}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Col>
          </Row>

          {!isMobile && <Divider />}

          {/* Actions */}
          <Space style={{ marginBottom: 24, width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ flex: 1, maxWidth: 700 }}>
              <Search
                placeholder="Tìm kiếm theo tên / SĐT / email / địa chỉ..."
                allowClear
                size="large"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                style={{ width: isMobile ? "100%" : 550 }}
              />
            </div>

            <Space>
              <Button size="large" icon={<ReloadOutlined />} onClick={handleRefresh}>
                Làm mới
              </Button>

              <Button
                size={isMobile ? "middle" : "large"}
                icon={<FileExcelOutlined />}
                onClick={handleExportSuppliersExcel}
                style={{ borderColor: "#52c41a", color: "#52c41a" }}
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
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                  }}
                >
                  {isMobile ? "+" : "Thêm NCC"}
                </Button>
              )}
            </Space>
          </Space>

          {/* Tabs */}
          <Tabs
            activeKey={tabKey}
            onChange={(key) => {
              setTabKey(key);
              setSearchTerm("");
            }}
            items={[
              {
                key: "active",
                label: `Nhà cung cấp đang hoạt động (${totalActive})`,
                children: (
                  <Table
                    columns={getColumns(false)}
                    dataSource={filteredSuppliers}
                    // rowKey nên là function để chắc chắn trả string id hợp lệ
                    rowKey={(record) => record?._id || `${record?.name || "supplier"}-${Math.random()}`}
                    loading={loading}
                    pagination={{
                      current: paginationActive.current,
                      pageSize: paginationActive.pageSize,
                      total: paginationTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ["5", "10", "20", "50", "100"],
                      showTotal: (total, range) => (
                        <div style={{ fontSize: 14, color: "#595959" }}>
                          Đang xem{" "}
                          <span style={{ color: "#1677ff", fontWeight: 600 }}>
                            {range[0]} – {range[1]}
                          </span>{" "}
                          trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhà cung cấp
                        </div>
                      ),
                      style: { marginTop: 16 },
                    }}
                    onChange={(pag) => handleTableChange(pag, "active")}
                    scroll={{ x: "max-content" }}
                    size={isMobile ? "small" : "middle"}
                    rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  />
                ),
              },
              {
                key: "deleted",
                label: `Nhà cung cấp đã bị xóa (${totalDeleted})`,
                children: (
                  <Table
                    columns={getColumns(true)}
                    dataSource={filteredSuppliers}
                    rowKey={(record) => record?._id || `${record?.name || "supplier"}-${Math.random()}`}
                    loading={loading}
                    pagination={{
                      current: paginationDeleted.current,
                      pageSize: paginationDeleted.pageSize,
                      total: paginationTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ["5", "10", "20", "50", "100"],
                      showTotal: (total, range) => (
                        <div style={{ fontSize: 14, color: "#595959" }}>
                          Đang xem{" "}
                          <span style={{ color: "#1677ff", fontWeight: 600 }}>
                            {range[0]} – {range[1]}
                          </span>{" "}
                          trên tổng số <span style={{ color: "#fa541c", fontWeight: 600 }}>{total}</span> nhà cung cấp
                        </div>
                      ),
                      style: { marginTop: 16 },
                    }}
                    onChange={(pag) => handleTableChange(pag, "deleted")}
                    scroll={{ x: "max-content" }}
                    size={isMobile ? "small" : "middle"}
                    rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  />
                ),
              },
            ]}
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
      `}</style>

      <style jsx global>{`
        .ant-notification-notice {
          border-radius: 12px !important;
        }
      `}</style>
    </Layout>
  );
}
