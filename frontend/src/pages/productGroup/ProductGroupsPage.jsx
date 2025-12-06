// src/pages/ProductGroupsPage.jsx
import React, { useEffect, useState } from "react";
import { Card, Button, Space, Empty, Spin, Row, Col, Typography, Tag, Modal, message, Statistic, Tooltip, Badge, Progress, notification } from "antd";
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

      notification.success({
        message: "✅ Tải dữ liệu thành công",
        description: `Đã tải ${groupList.length} nhóm sản phẩm`,
        placement: "topRight",
        duration: 2,
      });
    } catch (err) {
      console.error("Fetch groups error:", err);
      notification.error({
        message: "❌ Lỗi tải dữ liệu",
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
    notification.info({
      message: "📝 Chế độ chỉnh sửa",
      description: `Đang chỉnh sửa nhóm "${group.name}"`,
      placement: "topRight",
      duration: 2,
    });
  };

  const handleDelete = async (group) => {
    const groupId = group._id;
    const groupName = group.name;
    const productCount = group.productCount || 0;

    Modal.confirm({
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
          <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 8 }}>
            ID: {groupId}
          </Paragraph>
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

          // Call delete API
          await deleteProductGroup(groupId);

          // Success notification
          notification.success({
            message: "✅ Xóa thành công",
            description: (
              <div>
                <div>
                  Đã xóa nhóm <Text strong>"{groupName}"</Text>
                </div>
                {productCount > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: "#8c8c8c" }}>{productCount} sản phẩm đã được giải phóng khỏi nhóm</div>
                )}
              </div>
            ),
            placement: "topRight",
            duration: 4,
            icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
          });

          // Reload groups
          fetchGroups();
        } catch (err) {
          console.error("Delete error:", err);

          // Error notification with details
          notification.error({
            message: "❌ Lỗi xóa nhóm",
            description: (
              <div>
                <div>{err?.response?.data?.message || "Không thể xóa nhóm sản phẩm"}</div>
                {err?.response?.data?.error && (
                  <div style={{ fontSize: 12, marginTop: 4, color: "#8c8c8c" }}>Chi tiết: {err.response.data.error}</div>
                )}
              </div>
            ),
            placement: "topRight",
            duration: 5,
          });
        } finally {
          setDeleting(false);
        }
      },
      onCancel: () => {
        notification.info({
          message: "ℹ️ Đã hủy",
          description: "Không xóa nhóm sản phẩm",
          placement: "topRight",
          duration: 2,
        });
      },
    });
  };

  const handleFormSuccess = () => {
    setModalOpen(false);
    notification.success({
      message: editingGroup ? "✅ Cập nhật thành công" : "✅ Tạo mới thành công",
      description: editingGroup ? `Đã cập nhật nhóm "${editingGroup.name}"` : "Đã tạo nhóm sản phẩm mới",
      placement: "topRight",
      duration: 3,
    });
    fetchGroups();
  };

  // Calculate stats
  const totalProducts = groups.reduce((sum, g) => sum + (g.productCount || 0), 0);
  const avgProducts = groups.length > 0 ? (totalProducts / groups.length).toFixed(1) : 0;
  const maxProducts = groups.length > 0 ? Math.max(...groups.map((g) => g.productCount || 0)) : 0;

  return (
    <Layout>
      <div style={{ maxWidth: 1600, margin: "0 auto" }}>
        {/* Header Card */}
        <Card
          style={{
            marginBottom: 24,
            borderRadius: 16,
            background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
            border: "none",
            boxShadow: "0 8px 24px rgba(82, 196, 26, 0.25)",
          }}
          styles={{ body: { padding: "32px" } }}
        >
          <Row gutter={[24, 16]} align="middle">
            <Col xs={24} md={16}>
              <Space direction="vertical" size={8}>
                <Title level={2} style={{ color: "#fff", margin: 0, fontSize: 32, fontWeight: 700 }}>
                  📦 Quản lý nhóm sản phẩm
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 15 }}>
                  Tổ chức và phân loại sản phẩm thành các nhóm để quản lý dễ dàng hơn
                </Text>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                block
                style={{
                  background: "#fff",
                  color: "#52c41a",
                  border: "none",
                  borderRadius: 12,
                  height: 50,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                }}
              >
                Tạo nhóm sản phẩm mới
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Stats Card */}
        {groups.length > 0 && (
          <Card
            style={{
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Tổng nhóm"
                  value={groups.length}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: "#52c41a", fontSize: 28, fontWeight: 700 }}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      nhóm
                    </Text>
                  }
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Tổng sản phẩm"
                  value={totalProducts}
                  prefix={<ShoppingOutlined />}
                  valueStyle={{ color: "#1890ff", fontSize: 28, fontWeight: 700 }}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      Sản phẩm
                    </Text>
                  }
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Trung bình sản phẩm/nhóm"
                  value={avgProducts}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: "#faad14", fontSize: 28, fontWeight: 700 }}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      Sản phẩm
                    </Text>
                  }
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="Tối đa sản phẩm/nhóm"
                  value={maxProducts}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: "#f5222d", fontSize: 28, fontWeight: 700 }}
                  suffix={
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      Sản phẩm
                    </Text>
                  }
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Spin size="large" tip={<Text style={{ fontSize: 16, marginTop: 16 }}>Đang tải...</Text>} />
          </div>
        ) : groups.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: "center", padding: "60px 20px" }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              imageStyle={{ height: 120 }}
              description={
                <Space direction="vertical" size={16}>
                  <Title level={4} style={{ color: "#8c8c8c" }}>
                    Chưa có nhóm sản phẩm nào
                  </Title>
                  <Text type="secondary" style={{ fontSize: 15 }}>
                    Tạo nhóm sản phẩm đầu tiên để bắt đầu tổ chức kho hàng
                  </Text>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                    style={{
                      background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                      border: "none",
                      borderRadius: 12,
                      height: 48,
                      fontSize: 15,
                      marginTop: 12,
                    }}
                  >
                    Tạo nhóm đầu tiên
                  </Button>
                </Space>
              }
            />
          </Card>
        ) : (
          <Row gutter={[20, 20]}>
            {groups.map((group) => {
              const productPercent = maxProducts > 0 ? ((group.productCount || 0) / maxProducts) * 100 : 0;
              const createdDate = group.createdAt ? new Date(group.createdAt).toLocaleDateString("vi-VN") : "N/A";

              return (
                <Col xs={24} sm={12} lg={8} xl={6} key={group._id}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 16,
                      height: "100%",
                      border: "1px solid #e8e8e8",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    styles={{ body: { padding: 20 } }}
                    className="product-group-card"
                  >
                    <Space direction="vertical" size={14} style={{ width: "100%" }}>
                      {/* Header with Icon & Badge */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(82, 196, 26, 0.3)",
                          }}
                        >
                          <AppstoreOutlined style={{ fontSize: 24, color: "#fff" }} />
                        </div>
                        <Badge
                          count={group.productCount || 0}
                          overflowCount={999}
                          style={{
                            backgroundColor: "#52c41a",
                            fontSize: 14,
                            fontWeight: 600,
                            padding: "0 8px",
                            boxShadow: "0 2px 8px rgba(82, 196, 26, 0.3)",
                          }}
                        />
                      </div>

                      {/* Group Name */}
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                          Tên nhóm
                        </Text>
                        <Tooltip title={group.name}>
                          <Title level={5} ellipsis={{ rows: 1 }} style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 700 }}>
                            {group.name}
                          </Title>
                        </Tooltip>
                      </div>

                      {/* Description */}
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                          Mô tả
                        </Text>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: "4px 0 0", fontSize: 13, color: "#595959", minHeight: 38 }}>
                          {group.description || "Không có mô tả"}
                        </Paragraph>
                      </div>

                      {/* Product Count Progress */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                            Số lượng Sản phẩm
                          </Text>
                          <Text strong style={{ fontSize: 13, color: "#52c41a" }}>
                            {group.productCount || 0} Sản phẩm
                          </Text>
                        </div>
                        <Progress
                          percent={productPercent}
                          showInfo={false}
                          strokeColor={{
                            "0%": "#52c41a",
                            "100%": "#73d13d",
                          }}
                          strokeWidth={8}
                        />
                      </div>

                      {/* Meta Info */}
                      <div style={{ background: "#fafafa", borderRadius: 8, padding: "10px 12px" }}>
                        <Space direction="vertical" size={4} style={{ width: "100%" }}>
                          {/* Ngày tạo */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CalendarOutlined style={{ color: "#8c8c8c", fontSize: 13 }} />

                            <Text type="primary" style={{ fontSize: 12 }}>
                              Ngày tạo:
                            </Text>

                            <Tag
                              style={{
                                background: "#E6F4FF",
                                border: "1px solid #1677FF",
                                color: "#1677FF",
                                borderRadius: 6,
                                padding: "0px 6px",
                                fontSize: 11,
                              }}
                            >
                              {createdDate}
                            </Tag>
                          </div>

                          {/* Mã nhóm */}
                          {group._id && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <InfoCircleOutlined style={{ color: "#8c8c8c", fontSize: 13 }} />

                              <Text type="primary" style={{ fontSize: 11 }}>
                                Mã nhóm:
                              </Text>

                              <Tag
                                style={{
                                  background: "#E6F4FF",
                                  border: "1px solid #1677FF",
                                  color: "#1677FF",
                                  borderRadius: 6,
                                  padding: "0px 6px",
                                  fontSize: 11,
                                }}
                              >
                                {group._id.slice(-8)}
                              </Tag>
                            </div>
                          )}
                        </Space>
                      </div>

                      {/* Actions */}
                      <Space size={8} style={{ width: "100%", marginTop: 4 }}>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(group)}
                          style={{
                            flex: 1,
                            borderRadius: 10,
                            height: 38,
                            borderColor: "#52c41a",
                            color: "#52c41a",
                            fontWeight: 600,
                          }}
                        >
                          Sửa
                        </Button>
                        <Tooltip title="Xóa nhóm">
                          <Button
                            icon={<DeleteOutlined />}
                            danger
                            loading={deleting}
                            onClick={() => handleDelete(group)}
                            style={{
                              borderRadius: 10,
                              height: 38,
                              width: 38,
                            }}
                          />
                        </Tooltip>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {/* Modal */}
        <Modal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={700}
          styles={{
            body: { padding: 0 },
          }}
          destroyOnClose
        >
          <ProductGroupForm storeId={storeId} group={editingGroup} onSuccess={handleFormSuccess} onCancel={() => setModalOpen(false)} />
        </Modal>
      </div>

      <style jsx global>{`
        .product-group-card:hover {
          box-shadow: 0 12px 32px rgba(82, 196, 26, 0.25) !important;
          transform: translateY(-4px);
          border-color: #52c41a !important;
        }

        .ant-progress-bg {
          border-radius: 4px !important;
        }
      `}</style>
    </Layout>
  );
}
