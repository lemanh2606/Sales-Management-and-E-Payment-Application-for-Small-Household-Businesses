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
  Select,
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
  IdcardOutlined, // NEW: MST
  BankOutlined, // NEW: Ngân hàng
  UserOutlined, // NEW: Người liên hệ
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import SupplierFormModal from "../../components/supplier/SupplierFormModal";
import SupplierDetailModal from "../../components/supplier/SupplierDetailModal";
import {
  getSuppliers, // ✅ CHUYỂN SANG API MỚI
  deleteSupplier,
  exportSuppliers, // ✅ Đồng bộ tên
  restoreSupplier,
} from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// --- Helpers ---
const normalizeMongoId = (idLike) => {
  if (!idLike) return null;
  if (typeof idLike === "object" && idLike.$oid) return String(idLike.$oid);
  if (typeof idLike === "object" && typeof idLike.toString === "function") return String(idLike.toString());
  if (typeof idLike === "string") return idLike;
  return String(idLike);
};

const normalizeMongoDate = (dateLike) => {
  if (!dateLike) return null;
  if (typeof dateLike === "object" && dateLike.$date) return dateLike.$date;
  return dateLike;
};

const normalizeSupplier = (s) => {
  const _id = normalizeMongoId(s?._id) || normalizeMongoId(s?.id);
  return {
    ...s,
    _id,
    store_id: normalizeMongoId(s?.store_id),
    createdAt: normalizeMongoDate(s?.createdAt),
    updatedAt: normalizeMongoDate(s?.updatedAt),
  };
};

const fmtDateTime = (v) => {
  const raw = normalizeMongoDate(v);
  if (!raw) return "Trống";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "Trống";
  return d.toLocaleString("vi-VN");
};

const formatTaxcode = (taxcode) => (taxcode ? `${taxcode}` : "Trống");

export default function SupplierListPage() {
  const [api, contextHolder] = notification.useNotification();
  const { token } = useAuth();

  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || storeObj.id || null;

  // States
  const [tabKey, setTabKey] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // NEW: Filter trạng thái

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

  // Responsive
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch active suppliers (NEW: hỗ trợ filter + search + pagination)
  const fetchActiveSuppliers = useCallback(
    async (showNoti = false) => {
      if (!storeId || !token) return;

      try {
        setLoading(true);
        const params = {
          deleted: false,
          status: statusFilter === "all" ? undefined : statusFilter,
          q: searchTerm.trim() || undefined,
          page: paginationActive.current,
          limit: paginationActive.pageSize,
        };
        const res = await getSuppliers(storeId, params);
        const list = Array.isArray(res?.suppliers) ? res.suppliers : [];
        setActiveSuppliers(list.map(normalizeSupplier));

        if (showNoti) {
          api.success({
            message: "🎉 Tải dữ liệu thành công",
            description: `Đã tải ${list.length} nhà cung cấp`,
            placement: "topRight",
            duration: 3,
          });
        }
      } catch (e) {
        console.error("Fetch active suppliers error:", e);
        api.error({
          message: "❌ Lỗi tải dữ liệu",
          description: e?.response?.data?.message || "Không thể tải danh sách nhà cung cấp.",
          placement: "topRight",
          duration: 5,
        });
      } finally {
        setLoading(false);
      }
    },
    [storeId, token, api, statusFilter, searchTerm, paginationActive]
  );

  // Fetch deleted suppliers
  const fetchDeletedSuppliers = useCallback(
    async (showNoti = false) => {
      if (!storeId || !token) return;

      try {
        setLoading(true);
        const params = {
          deleted: true,
          page: paginationDeleted.current,
          limit: paginationDeleted.pageSize,
        };
        const res = await getSuppliers(storeId, params);
        const list = Array.isArray(res?.suppliers) ? res.suppliers : [];
        setDeletedSuppliers(list.map(normalizeSupplier));

        if (showNoti) {
          api.success({
            message: "🎉 Tải dữ liệu thành công",
            description: `Đã tải ${list.length} nhà cung cấp đã xóa`,
            placement: "topRight",
            duration: 3,
          });
        }
      } catch (e) {
        console.error("Fetch deleted suppliers error:", e);
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
    [storeId, token, api, paginationDeleted]
  );

  // Auto fetch on mount + dependencies
  useEffect(() => {
    if (!storeId || !token) return;
    if (tabKey === "active") {
      fetchActiveSuppliers(false);
    } else {
      fetchDeletedSuppliers(false);
    }
  }, [storeId, token, tabKey, fetchActiveSuppliers, fetchDeletedSuppliers]);

  // Reset pagination on filter change
  useEffect(() => {
    if (tabKey === "active") {
      setPaginationActive((p) => ({ ...p, current: 1 }));
    } else {
      setPaginationDeleted((p) => ({ ...p, current: 1 }));
    }
  }, [tabKey, searchTerm, statusFilter]);

  const currentData = tabKey === "active" ? activeSuppliers : deletedSuppliers;

  // Client-side search (backup khi backend chưa hỗ trợ)
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return currentData;
    const term = searchTerm.trim().toLowerCase();
    return currentData.filter((s) => {
      const fields = [
        s.name || "",
        s.phone || "",
        s.email || "",
        s.address || "",
        s.taxcode || "",
        s.contact_person || "",
        s.bank_name || "",
        s.bank_account_name || "",
        s.notes || "",
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
  }, [currentData, searchTerm]);

  const totalActive = activeSuppliers.length;
  const totalDeleted = deletedSuppliers.length;
  const activeStatusCount = activeSuppliers.filter((s) => s.status === "đang hoạt động").length;
  const inactiveStatusCount = activeSuppliers.length - activeStatusCount;

  // Actions
  const openCreate = () => {
    setEditSupplierId(null);
    setFormModalOpen(true);
  };

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
      api.error({ message: "❌ Lỗi dữ liệu", description: "Không tìm thấy ID NCC", placement: "topRight" });
      return;
    }

    try {
      setLoading(true);
      await deleteSupplier(id);
      api.success({
        message: "🗑️ Xóa thành công!",
        description: `Đã xóa NCC "${name}"`,
        placement: "topRight",
        duration: 3,
      });
      await Promise.all([fetchActiveSuppliers(false), fetchDeletedSuppliers(false)]);
    } catch (e) {
      api.error({
        message: "❌ Lỗi xóa",
        description: e?.response?.data?.message || "Không thể xóa NCC.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id, name) => {
    if (!id) {
      api.error({ message: "❌ Lỗi dữ liệu", description: "Không tìm thấy ID NCC", placement: "topRight" });
      return;
    }

    try {
      setLoading(true);
      await restoreSupplier(id);
      api.success({
        message: "✅ Khôi phục thành công!",
        description: `Đã khôi phục NCC "${name}"`,
        placement: "topRight",
        duration: 3,
      });
      await Promise.all([fetchActiveSuppliers(false), fetchDeletedSuppliers(false)]);
    } catch (e) {
      api.error({
        message: "❌ Lỗi khôi phục",
        description: e?.response?.data?.message || "Không thể khôi phục NCC.",
        placement: "topRight",
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setSearchTerm("");
    setStatusFilter("all");
    await Promise.all([fetchActiveSuppliers(false), fetchDeletedSuppliers(false)]);
  };

  const handleExportSuppliersExcel = async () => {
    try {
      await exportSuppliers(storeId);
    } catch (e) {
      api.error({
        message: "❌ Xuất Excel thất bại",
        description: e?.message || "Vui lòng thử lại",
        placement: "topRight",
        duration: 5,
      });
    }
  };

  const handleTableChange = (pagination, tab) => {
    if (tab === "active") {
      setPaginationActive({ current: pagination.current, pageSize: pagination.pageSize });
    } else {
      setPaginationDeleted({ current: pagination.current, pageSize: pagination.pageSize });
    }
  };

  // NEW: Cột đầy đủ với MST, Ngân hàng, Người liên hệ
  const getColumns = (showRestore = false) => [
    {
      title: "STT",
      key: "index",
      width: 50,
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
      width: isMobile ? 150 : 200,
      ellipsis: true,
      render: (text) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text || "Trống"}
        </Text>
      ),
    },
    // NEW: Cột MST
    {
      title: (
        <Space>
          <IdcardOutlined style={{ color: "#722ed1" }} />
          <span>MST</span>
        </Space>
      ),
      dataIndex: "taxcode",
      key: "taxcode",
      width: isMobile ? 90 : 110,
      align: "center",
      render: (text) => <Tag color="purple">{formatTaxcode(text)}</Tag>,
    },
    // NEW: Cột người liên hệ
    {
      title: (
        <Space>
          <UserOutlined style={{ color: "#faad14" }} />
          <span>Liên hệ</span>
        </Space>
      ),
      dataIndex: "contact_person",
      key: "contact_person",
      width: isMobile ? 100 : 130,
      ellipsis: true,
      render: (text) =>
        text ? (
          <Tooltip title={text}>
            <Text ellipsis style={{ maxWidth: 120 }}>
              {text}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">trống</Text>
        ),
    },
    {
      title: (
        <Space>
          <PhoneOutlined style={{ color: "#52c41a" }} />
          <span>Điện thoại</span>
        </Space>
      ),
      dataIndex: "phone",
      key: "phone",
      width: 110,
      render: (text) => <Tag color="green">{text || "Trống"}</Tag>,
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
      width: isMobile ? 140 : 180,
      ellipsis: true,
      render: (text) =>
        text ? (
          <Tooltip title={text}>
            <Text type="secondary" ellipsis style={{ maxWidth: 160, cursor: "pointer" }}>
              {text}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">trống</Text>
        ),
    },
    // NEW: Cột Ngân hàng (gọn)
    {
      title: (
        <Space>
          <BankOutlined style={{ color: "#1890ff" }} />
          <span>Ngân hàng</span>
        </Space>
      ),
      key: "bank_info",
      width: isMobile ? 120 : 130,
      ellipsis: true,
      render: (_, record) => {
        const bankInfo = [];
        if (record.bank_name) bankInfo.push(record.bank_name);
        if (record.bank_account_no) bankInfo.push(record.bank_account_no);

        return bankInfo.length ? (
          <Tooltip title={bankInfo.join(" | ")}>
            <Space direction="vertical" size={0} style={{ fontSize: 11 }}>
              {record.bank_name && <Text type="secondary">{record.bank_name}</Text>}
              {record.bank_account_no && (
                <Text type="secondary" style={{ color: "#52c41a" }}>
                  TK: {record.bank_account_no}
                </Text>
              )}
            </Space>
          </Tooltip>
        ) : (
          <Text type="secondary">trống</Text>
        );
      },
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
      width: isMobile ? 100 : 160,
      ellipsis: true,
      render: (text) =>
        text ? (
          <Tooltip title={text}>
            <Text ellipsis style={{ maxWidth: 140, cursor: "pointer" }}>
              {text}
            </Text>
          </Tooltip>
        ) : (
          <Text>trống</Text>
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
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
      align: "center",
      width: 130,
      render: (v) => <Text type="secondary">{fmtDateTime(v)}</Text>,
    },
    {
      title: "Hành động",
      key: "action",
      width: showRestore ? 100 : 120,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const supplierId = record?._id;
        return (
          <Space size="small">
            <Tooltip title="Chi tiết">
              <Button type="primary" icon={<EyeOutlined />} size="small" onClick={() => openDetail(supplierId)} />
            </Tooltip>
            {!showRestore && (
              <Tooltip title="Sửa">
                <Button
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => openEdit(supplierId)}
                  style={{ color: "#faad14", borderColor: "#faad14" }}
                />
              </Tooltip>
            )}
            {showRestore ? (
              <Popconfirm
                title="Khôi phục NCC?"
                description={`Khôi phục "${record.name}"?`}
                onConfirm={() => handleRestore(supplierId, record.name)}
                okText="Khôi phục"
                cancelText="Hủy"
              >
                <Tooltip title="Khôi phục">
                  <Button icon={<UndoOutlined />} size="small" style={{ color: "#52c41a", borderColor: "#52c41a" }} />
                </Tooltip>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="Xóa NCC?"
                description={`Xóa "${record.name}"?`}
                onConfirm={() => handleSoftDelete(supplierId, record.name)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Xóa">
                  <Button icon={<DeleteOutlined />} danger size="small" />
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
        <div style={{ padding: 24 }}>
          <Card style={{ margin: 24, borderRadius: 16 }}>
            <Title level={2}>Danh sách nhà cung cấp</Title>
            <Alert message="⚠️ Không tìm thấy cửa hàng hiện hành" type="warning" showIcon style={{ marginTop: 16 }} />
          </Card>
        </div>
      </Layout>
    );
  }

  const currentTotal = tabKey === "active" ? totalActive : totalDeleted;
  const paginationTotal = filteredSuppliers.length;

  return (
    <Layout>
      {contextHolder}
      <div style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}>
        <Card style={{ borderRadius: 12 }}>
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
            <Text type="secondary">Quản lý NCC đầy đủ (MST, ngân hàng, liên hệ) theo cửa hàng</Text>
          </div>

          {/* Statistics */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Tooltip title="Tổng NCC trong cửa hàng">
                <Card style={{ background: "#2C5364", border: "none", borderRadius: 12, cursor: "pointer" }}>
                  <Statistic
                    title={
                      <span style={{ color: "#fff" }}>
                        Tổng NCC <InfoCircleOutlined style={{ color: "#1890ff" }} />
                      </span>
                    }
                    value={totalActive + totalDeleted}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: "#fff", fontWeight: "bold" }}
                  />
                </Card>
              </Tooltip>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: "#52c41a", border: "none", borderRadius: 12, cursor: "pointer" }}>
                <Statistic
                  title={<span style={{ color: "#fff" }}>Đang hoạt động</span>}
                  value={totalActive}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: "#f5222d", border: "none", borderRadius: 12, cursor: "pointer" }}>
                <Statistic
                  title={<span style={{ color: "#fff" }}>Đã xóa</span>}
                  value={totalDeleted}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: "#1890ff", border: "none", borderRadius: 12, cursor: "pointer" }}>
                <Statistic
                  title={<span style={{ color: "#fff" }}>Trạng thái hoạt động</span>}
                  value={`${activeStatusCount}/${inactiveStatusCount}`}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: "#fff", fontWeight: "bold" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Filters & Actions */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={8}>
              <Search
                placeholder="Tìm NCC: tên/MST/SĐT/email/liên hệ/ngân hàng..."
                allowClear
                size="large"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
              />
            </Col>
            <Col xs={24} md={16}>
              <Space style={{ width: "100%", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>
                {tabKey === "active" && (
                  <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 160 }} size="large" allowClear placeholder="Trạng thái">
                    <Option value="all">Tất cả</Option>
                    <Option value="đang hoạt động">Đang hoạt động</Option>
                    <Option value="ngừng hoạt động">Ngừng hoạt động</Option>
                  </Select>
                )}
                <Button size="large" icon={<ReloadOutlined />} onClick={handleRefresh}>
                  Làm mới
                </Button>
                <Button
                  size="large"
                  icon={<FileExcelOutlined />}
                  onClick={handleExportSuppliersExcel}
                  style={{ borderColor: "#52c41a", color: "#52c41a" }}
                >
                  Xuất Excel
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
                    Thêm NCC
                  </Button>
                )}
              </Space>
            </Col>
          </Row>

          {/* Tabs */}
          <Tabs
            activeKey={tabKey}
            onChange={(key) => {
              setTabKey(key);
              setSearchTerm("");
              if (key === "active") setStatusFilter("all");
            }}
            items={[
              {
                key: "active",
                label: `Đang hoạt động (${totalActive})`,
                children: (
                  <Table
                    columns={getColumns(false)}
                    dataSource={filteredSuppliers}
                    rowKey={(record) => record?._id || `supplier-${Math.random()}`}
                    loading={loading}
                    pagination={{
                      current: paginationActive.current,
                      pageSize: paginationActive.pageSize,
                      total: paginationTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ["10", "20", "50", "100"],
                      showTotal: (total, range) => (
                        <span style={{ color: "#595959" }}>
                          Hiển thị {range[0]}-{range[1]} / {total} NCC
                        </span>
                      ),
                    }}
                    onChange={(pag) => handleTableChange(pag, "active")}
                    scroll={{ x: isMobile ? 1200 : "max-content" }}
                    size={isMobile ? "small" : "middle"}
                    rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  />
                ),
              },
              {
                key: "deleted",
                label: `Đã xóa (${totalDeleted})`,
                children: (
                  <Table
                    columns={getColumns(true)}
                    dataSource={filteredSuppliers}
                    rowKey={(record) => record?._id || `supplier-${Math.random()}`}
                    loading={loading}
                    pagination={{
                      current: paginationDeleted.current,
                      pageSize: paginationDeleted.pageSize,
                      total: paginationTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ["10", "20", "50", "100"],
                      showTotal: (total, range) => (
                        <span style={{ color: "#595959" }}>
                          Hiển thị {range[0]}-{range[1]} / {total} NCC
                        </span>
                      ),
                    }}
                    onChange={(pag) => handleTableChange(pag, "deleted")}
                    scroll={{ x: isMobile ? 1200 : "max-content" }}
                    size={isMobile ? "small" : "middle"}
                    rowClassName={(_, index) => (index % 2 === 0 ? "table-row-light" : "table-row-dark")}
                  />
                ),
              },
            ]}
          />

          {/* Modals */}
          <SupplierFormModal
            open={formModalOpen}
            onOpenChange={setFormModalOpen}
            storeId={storeId}
            supplierId={editSupplierId}
            onSuccess={onFormSuccess}
          />
          <SupplierDetailModal open={detailModalOpen} onOpenChange={setDetailModalOpen} supplierId={detailSupplierId} />
        </Card>

        <style jsx>{`
          :global(.table-row-light) {
            background-color: #fafbfc;
          }
          :global(.table-row-dark) {
            background-color: #ffffff;
          }
          :global(.table-row-light:hover, .table-row-dark:hover) {
            background-color: #e6f7ff !important;
          }
        `}</style>
      </div>
    </Layout>
  );
}
