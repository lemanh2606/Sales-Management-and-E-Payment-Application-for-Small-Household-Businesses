// src/pages/productGroup/ProductGroupsPage.jsx
import React, { useEffect, useState } from "react";
import {
  Card,
  Button,
  Space,
  Empty,
  Spin,
  Row,
  Col,
  Typography,
  Tag,
  Modal,
  Statistic,
  Tooltip,
  Badge,
  Progress,
  notification,
  Table,
  Segmented,
  Input,
  Dropdown,
  Avatar,
  Divider,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  BarChartOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  AppstoreFilled,
  SearchOutlined,
  MoreOutlined,
  FolderOpenOutlined,
  TagsOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { getProductGroupsByStore, deleteProductGroup } from "../../api/productGroupApi";
import ProductGroupForm from "../../components/productGroup/ProductGroupForm";
import Layout from "../../components/Layout";

const { Title, Text, Paragraph } = Typography;

export default function ProductGroupsPage() {
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};
  const storeId = storeObj._id || null;

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // Mặc định là list (chiều ngang)
  const [searchText, setSearchText] = useState("");

  const [deleteModal, deleteContextHolder] = Modal.useModal();

  const fetchGroups = async () => {
    if (!storeId) {
      notification.warning({
        message: "⚠️ Chưa chọn cửa hàng",
        description: "Vui lòng chọn cửa hàng trước khi xem nhóm sản phẩm",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);
      const res = await getProductGroupsByStore(storeId);
      const groupList = res?.productGroups || [];
      setGroups(groupList);
    } catch (err) {
      console.error("Fetch groups error:", err);
      notification.error({
        message: " Lỗi tải dữ liệu",
        description: err?.response?.data?.message || "Không thể tải danh sách nhóm sản phẩm",
        placement: "topRight",
        duration: 4,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [storeId]);

  const handleCreate = () => {
    setEditingGroup(null);
    setModalOpen(true);
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setModalOpen(true);
  };

  const handleDelete = (group) => {
    const groupId = group._id;
    const groupName = group.name;
    const productCount = group.productCount || 0;

    deleteModal.confirm({
      title: (
        <Space>
          <ExclamationCircleOutlined style={{ color: "#faad14", fontSize: 24 }} />
          <span>Xác nhận xóa nhóm sản phẩm</span>
        </Space>
      ),
      content: (
        <div style={{ paddingLeft: 32 }}>
          <Paragraph>
            Bạn có chắc muốn xóa nhóm <Text strong>"{groupName}"</Text>?
          </Paragraph>
          {productCount > 0 && (
            <Paragraph type="warning" style={{ marginTop: 8 }}>
              ⚠️ Nhóm này đang có <Text strong>{productCount} sản phẩm</Text>. Các sản phẩm sẽ không bị xóa nhưng sẽ không còn thuộc nhóm này.
            </Paragraph>
          )}
        </div>
      ),
      okText: "Xóa nhóm",
      okType: "danger",
      cancelText: "Hủy",
      icon: null,
      width: 500,
      onOk: async () => {
        try {
          setDeleting(true);
          await deleteProductGroup(groupId);
          notification.success({
            message: "✅ Xóa thành công",
            description: `Đã xóa nhóm "${groupName}"`,
            placement: "topRight",
            icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
          });
          fetchGroups();
        } catch (err) {
          notification.error({
            message: " Lỗi xóa nhóm",
            description: err?.response?.data?.message || "Không thể xóa nhóm sản phẩm",
            placement: "topRight",
          });
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleFormSuccess = () => {
    setModalOpen(false);
    fetchGroups();
  };

  // Filter groups by search text
  const filteredGroups = groups.filter(
    (g) =>
      g.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      g.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Calculate stats
  const totalProducts = groups.reduce((sum, g) => sum + (g.productCount || 0), 0);
  const avgProducts = groups.length > 0 ? (totalProducts / groups.length).toFixed(1) : 0;
  const maxProducts = groups.length > 0 ? Math.max(...groups.map((g) => g.productCount || 0)) : 0;

  // Table columns for list view
  const columns = [
    {
      title: (
        <Space>
          <AppstoreOutlined style={{ color: "#52c41a" }} />
          <span>Nhóm sản phẩm</span>
        </Space>
      ),
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <Space size={12}>
          <Avatar
            size={44}
            style={{
              background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            icon={<FolderOpenOutlined style={{ fontSize: 20 }} />}
          />
          <div>
            <Text strong style={{ fontSize: 15, display: "block" }}>
              {text}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description || "Không có mô tả"}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: (
        <Space>
          <ShoppingOutlined style={{ color: "#1890ff" }} />
          <span>Số lượng SP</span>
        </Space>
      ),
      dataIndex: "productCount",
      key: "productCount",
      width: 140,
      align: "center",
      sorter: (a, b) => (a.productCount || 0) - (b.productCount || 0),
      render: (count) => (
        <Badge
          count={count || 0}
          showZero
          style={{
            backgroundColor: count > 0 ? "#52c41a" : "#d9d9d9",
            fontSize: 13,
            fontWeight: 600,
            padding: "0 10px",
            height: 24,
            lineHeight: "24px",
          }}
          overflowCount={999}
        />
      ),
    },
    {
      title: (
        <Space>
          <CalendarOutlined style={{ color: "#faad14" }} />
          <span>Ngày tạo</span>
        </Space>
      ),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      align: "center",
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => (
        <Tag
          style={{
            background: "linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)",
            border: "1px solid #ffc53d",
            color: "#d46b08",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {date ? new Date(date).toLocaleDateString("vi-VN") : "N/A"}
        </Tag>
      ),
    },
    {
      title: (
        <Space>
          <InfoCircleOutlined style={{ color: "#722ed1" }} />
          <span>Mã nhóm</span>
        </Space>
      ),
      dataIndex: "_id",
      key: "_id",
      width: 130,
      align: "center",
      render: (id) => (
        <Tooltip title={id}>
          <Tag
            style={{
              background: "linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)",
              border: "1px solid #b37feb",
              color: "#722ed1",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            #{id?.slice(-6)}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 140,
      align: "center",
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              style={{
                borderRadius: 8,
                borderColor: "#52c41a",
                color: "#52c41a",
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa nhóm">
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={deleting}
              onClick={() => handleDelete(record)}
              style={{ borderRadius: 8 }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0 16px",
          background: "#ffffff",
          minHeight: "100vh",
        }}
      >
        {/* Header Card - Premium Design */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 20,
            border: "none",
            background: "linear-gradient(135deg, #52c41a 0%, #237804 50%, #135200 100%)",
            boxShadow: "0 12px 40px rgba(82, 196, 26, 0.35)",
            overflow: "hidden",
            position: "relative",
          }}
          styles={{ body: { padding: "36px 40px" } }}
        >
          {/* Decorative elements */}
          <div
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -40,
              left: 100,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              left: -30,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }}
          />

          <Row gutter={[32, 24]} align="middle">
            <Col xs={24} lg={14}>
              <Space direction="vertical" size={12}>
                <Space align="center" size={16}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    <TagsOutlined style={{ fontSize: 32, color: "#fff" }} />
                  </div>
                  <div>
                    <Title level={2} style={{ color: "#fff", margin: 0, fontSize: 32, fontWeight: 700 }}>
                      Quản lý nhóm sản phẩm
                    </Title>
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>
                      Tổ chức và phân loại sản phẩm thành các nhóm để quản lý dễ dàng hơn
                    </Text>
                  </div>
                </Space>
              </Space>
            </Col>
            <Col xs={24} lg={10}>
              <Space size={12} style={{ width: "100%", justifyContent: "flex-end" }} wrap>
                <Button
                  size="large"
                  icon={<ReloadOutlined />}
                  onClick={fetchGroups}
                  loading={loading}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    borderRadius: 12,
                    height: 50,
                    fontWeight: 600,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  Làm mới
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                  style={{
                    background: "#fff",
                    color: "#52c41a",
                    border: "none",
                    borderRadius: 12,
                    height: 50,
                    fontWeight: 700,
                    fontSize: 16,
                    paddingInline: 28,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  }}
                >
                  Tạo nhóm mới
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Stats Cards */}
        {groups.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={6}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #e6fffb 0%, #b5f5ec 100%)",
                  boxShadow: "0 4px 16px rgba(82, 196, 26, 0.12)",
                }}
                styles={{ body: { padding: "20px 24px" } }}
              >
                <Statistic
                  title={<Text style={{ color: "#006d75", fontWeight: 600 }}>Tổng nhóm</Text>}
                  value={groups.length}
                  prefix={<AppstoreOutlined style={{ color: "#13c2c2" }} />}
                  valueStyle={{ color: "#08979c", fontSize: 28, fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)",
                  boxShadow: "0 4px 16px rgba(82, 196, 26, 0.12)",
                }}
                styles={{ body: { padding: "20px 24px" } }}
              >
                <Statistic
                  title={<Text style={{ color: "#237804", fontWeight: 600 }}>Tổng sản phẩm</Text>}
                  value={totalProducts}
                  prefix={<ShoppingOutlined style={{ color: "#52c41a" }} />}
                  valueStyle={{ color: "#389e0d", fontSize: 28, fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #fff7e6 0%, #ffe58f 100%)",
                  boxShadow: "0 4px 16px rgba(250, 173, 20, 0.12)",
                }}
                styles={{ body: { padding: "20px 24px" } }}
              >
                <Statistic
                  title={<Text style={{ color: "#ad6800", fontWeight: 600 }}>TB sản phẩm/nhóm</Text>}
                  value={avgProducts}
                  prefix={<BarChartOutlined style={{ color: "#faad14" }} />}
                  valueStyle={{ color: "#d48806", fontSize: 28, fontWeight: 700 }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card
                style={{
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #f9f0ff 0%, #d3adf7 100%)",
                  boxShadow: "0 4px 16px rgba(114, 46, 209, 0.12)",
                }}
                styles={{ body: { padding: "20px 24px" } }}
              >
                <Statistic
                  title={<Text style={{ color: "#531dab", fontWeight: 600 }}>Max SP/nhóm</Text>}
                  value={maxProducts}
                  prefix={<FileTextOutlined style={{ color: "#722ed1" }} />}
                  valueStyle={{ color: "#722ed1", fontSize: 28, fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Toolbar */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 16,
            border: "1px solid #e8e8e8",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: "16px 24px" } }}
        >
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col xs={24} sm={12} md={10}>
              <Input
                placeholder="Tìm kiếm nhóm sản phẩm..."
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                size="large"
                style={{ borderRadius: 12 }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Hiển thị:
                </Text>
                <Segmented
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    {
                      value: "list",
                      icon: <UnorderedListOutlined />,
                      label: "Danh sách",
                    },
                    {
                      value: "grid",
                      icon: <AppstoreFilled />,
                      label: "Lưới",
                    },
                  ]}
                  style={{
                    background: "#f0f0f0",
                    borderRadius: 10,
                    padding: 4,
                  }}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Content */}
        {loading ? (
          <Card style={{ borderRadius: 16, textAlign: "center", padding: "80px 20px" }}>
            <Spin size="large" />
            <Text style={{ display: "block", marginTop: 16, fontSize: 16, color: "#8c8c8c" }}>
              Đang tải dữ liệu...
            </Text>
          </Card>
        ) : filteredGroups.length === 0 ? (
          <Card
            style={{
              borderRadius: 20,
              textAlign: "center",
              padding: "80px 20px",
              border: "2px dashed #d9d9d9",
              background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              styles={{ image: { height: 140 } }}
              description={
                <Space direction="vertical" size={20}>
                  <Title level={4} style={{ color: "#595959", margin: 0 }}>
                    {searchText ? "Không tìm thấy nhóm sản phẩm phù hợp" : "Chưa có nhóm sản phẩm nào"}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 15 }}>
                    {searchText
                      ? "Thử tìm kiếm với từ khóa khác"
                      : "Tạo nhóm sản phẩm đầu tiên để bắt đầu tổ chức kho hàng"}
                  </Text>
                  {!searchText && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={handleCreate}
                      style={{
                        background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                        border: "none",
                        borderRadius: 12,
                        height: 52,
                        fontSize: 16,
                        fontWeight: 600,
                        paddingInline: 32,
                        marginTop: 8,
                        boxShadow: "0 8px 24px rgba(82, 196, 26, 0.4)",
                      }}
                    >
                      Tạo nhóm đầu tiên
                    </Button>
                  )}
                </Space>
              }
            />
          </Card>
        ) : viewMode === "list" ? (
          /* List View - Default */
          <Card
            style={{
              borderRadius: 16,
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              dataSource={filteredGroups}
              columns={columns}
              rowKey="_id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} nhóm`,
                style: { padding: "16px 24px" },
              }}
              style={{
                borderRadius: 16,
              }}
              rowClassName={() => "product-group-table-row"}
            />
          </Card>
        ) : (
          /* Grid View */
          <Row gutter={[20, 20]}>
            {filteredGroups.map((group) => {
              const productPercent = maxProducts > 0 ? ((group.productCount || 0) / maxProducts) * 100 : 0;
              const createdDate = group.createdAt ? new Date(group.createdAt).toLocaleDateString("vi-VN") : "N/A";

              return (
                <Col xs={24} sm={12} lg={8} xl={6} key={group._id}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 20,
                      height: "100%",
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      overflow: "hidden",
                    }}
                    styles={{ body: { padding: 0 } }}
                    className="product-group-card"
                  >
                    {/* Card Header with Gradient */}
                    <div
                      style={{
                        background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                        padding: "20px 20px 16px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -20,
                          right: -20,
                          width: 60,
                          height: 60,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.15)",
                        }}
                      />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: "rgba(255,255,255,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backdropFilter: "blur(10px)",
                          }}
                        >
                          <FolderOpenOutlined style={{ fontSize: 24, color: "#fff" }} />
                        </div>
                        <Badge
                          count={group.productCount || 0}
                          overflowCount={999}
                          style={{
                            backgroundColor: "#fff",
                            color: "#52c41a",
                            fontSize: 14,
                            fontWeight: 700,
                            padding: "0 12px",
                            height: 26,
                            lineHeight: "26px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: "20px" }}>
                      <Space direction="vertical" size={14} style={{ width: "100%" }}>
                        {/* Group Name */}
                        <div>
                          <Tooltip title={group.name}>
                            <Title
                              level={5}
                              ellipsis={{ rows: 1 }}
                              style={{
                                margin: 0,
                                fontSize: 18,
                                fontWeight: 700,
                                color: "#1f1f1f",
                              }}
                            >
                              {group.name}
                            </Title>
                          </Tooltip>
                        </div>

                        {/* Description */}
                        <Paragraph
                          ellipsis={{ rows: 2 }}
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#8c8c8c",
                            minHeight: 40,
                          }}
                        >
                          {group.description || "Không có mô tả"}
                        </Paragraph>

                        {/* Progress */}
                        <div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Số lượng sản phẩm
                            </Text>
                            <Text strong style={{ fontSize: 13, color: "#52c41a" }}>
                              {group.productCount || 0}
                            </Text>
                          </div>
                          <Progress
                            percent={productPercent}
                            showInfo={false}
                            strokeColor={{
                              "0%": "#52c41a",
                              "100%": "#73d13d",
                            }}
                            trailColor="#f0f0f0"
                            strokeWidth={6}
                            style={{ borderRadius: 10 }}
                          />
                        </div>

                        {/* Meta Info */}
                        <div
                          style={{
                            background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
                            borderRadius: 12,
                            padding: "12px",
                          }}
                        >
                          <Space direction="vertical" size={6} style={{ width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <CalendarOutlined style={{ color: "#8c8c8c", fontSize: 13 }} />
                              <Text style={{ fontSize: 12, color: "#595959" }}>
                                Ngày tạo: <Text strong>{createdDate}</Text>
                              </Text>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <InfoCircleOutlined style={{ color: "#8c8c8c", fontSize: 13 }} />
                              <Text style={{ fontSize: 12, color: "#595959" }}>
                                Mã: <Text strong style={{ color: "#722ed1" }}>#{group._id?.slice(-6)}</Text>
                              </Text>
                            </div>
                          </Space>
                        </div>

                        <Divider style={{ margin: "8px 0" }} />

                        {/* Actions */}
                        <Space size={10} style={{ width: "100%" }}>
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(group)}
                            style={{
                              flex: 1,
                              borderRadius: 12,
                              height: 42,
                              borderColor: "#52c41a",
                              color: "#52c41a",
                              fontWeight: 600,
                            }}
                          >
                            Chỉnh sửa
                          </Button>
                          <Tooltip title="Xóa nhóm">
                            <Button
                              icon={<DeleteOutlined />}
                              danger
                              loading={deleting}
                              onClick={() => handleDelete(group)}
                              style={{
                                borderRadius: 12,
                                height: 42,
                                width: 42,
                              }}
                            />
                          </Tooltip>
                        </Space>
                      </Space>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Modal Form */}
        <Modal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={600}
          styles={{
            body: { padding: 0 },
          }}
          destroyOnHidden
          centered
        >
          <ProductGroupForm
            storeId={storeId}
            group={editingGroup}
            onSuccess={handleFormSuccess}
            onCancel={() => setModalOpen(false)}
          />
        </Modal>

        {deleteContextHolder}
      </div>

      <style>{`
        .product-group-card:hover {
          box-shadow: 0 16px 48px rgba(82, 196, 26, 0.25) !important;
          transform: translateY(-6px);
        }

        .product-group-table-row:hover {
          background: linear-gradient(135deg, #f6ffed 0%, #e6fffb 100%) !important;
        }

        .ant-table-thead > tr > th {
          background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%) !important;
          font-weight: 600 !important;
          color: #262626 !important;
          border-bottom: 2px solid #e8e8e8 !important;
          padding: 16px !important;
        }

        .ant-table-tbody > tr > td {
          padding: 16px !important;
          border-bottom: 1px solid #f0f0f0 !important;
        }

        .ant-progress-bg {
          border-radius: 10px !important;
        }

        .ant-segmented-item-selected {
          background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%) !important;
          color: #fff !important;
        }
      `}</style>
    </Layout>
  );
}
