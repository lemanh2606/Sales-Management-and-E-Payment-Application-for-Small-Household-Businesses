// src/components/supplier/SupplierDetailModal.jsx
import React, { useEffect, useState } from "react";
import { Modal, Card, Row, Col, Space, Spin, notification, Tag, Divider, Avatar } from "antd";
import {
  TeamOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getSupplierById } from "../../api/supplierApi";
import { useAuth } from "../../context/AuthContext";

const { Meta } = Card;

export default function SupplierDetailModal({ supplierId, open, onOpenChange }) {
  const [api, contextHolder] = notification.useNotification();
  const { token } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplierId) return;

    const fetchSupplier = async () => {
      setLoading(true);
      try {
        const data = await getSupplierById(supplierId);
        setSupplier(data.supplier);
      } catch (err) {
        console.error(err);
        api.error({
          message: "❌ Lỗi tải dữ liệu",
          description: "Không thể tải thông tin nhà cung cấp. Vui lòng thử lại.",
          placement: "topRight",
          duration: 5,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [supplierId, open, token]);

  const getStatusTag = (status) => {
    if (!status) return <Tag>Không xác định</Tag>;

    const normalized = status.toLowerCase().trim();

    if (normalized === "đang hoạt động") {
      return (
        <Tag
          icon={<CheckCircleOutlined />}
          color="success"
          style={{
            fontSize: 14,
            padding: "6px 16px",
            borderRadius: 20,
            fontWeight: 500,
          }}
        >
          Đang hoạt động
        </Tag>
      );
    }

    if (normalized === "ngừng hoạt động") {
      return (
        <Tag
          icon={<CloseCircleOutlined />}
          color="error"
          style={{
            fontSize: 14,
            padding: "6px 16px",
            borderRadius: 20,
            fontWeight: 500,
          }}
        >
          Ngừng hoạt động
        </Tag>
      );
    }

    return <Tag>{status}</Tag>;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSupplier(null);
  };

  const InfoItem = ({ icon, label, value, color = "#1890ff", href }) => (
    <div
      style={{
        padding: "16px",
        background: "#fafafa",
        borderRadius: 12,
        border: "1px solid #f0f0f0",
        transition: "all 0.3s ease",
      }}
      className="info-item-hover"
    >
      <Space align="start" size={12}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {React.cloneElement(icon, { style: { fontSize: 20, color } })}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 4 }}>{label}</div>
          {href ? (
            <a
              href={href}
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: color,
                wordBreak: "break-word",
              }}
            >
              {value || "-"}
            </a>
          ) : (
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "#262626",
                wordBreak: "break-word",
              }}
            >
              {value || "-"}
            </div>
          )}
        </div>
      </Space>
    </div>
  );

  return (
    <>
      {contextHolder}
      <Modal
        open={open}
        onCancel={handleCancel}
        footer={null}
        width={700}
        styles={{
          body: {
            padding: 0,
            maxHeight: "calc(100vh - 150px)",
            overflowY: "auto",
          },
        }}
        closeIcon={<CloseCircleOutlined style={{ fontSize: 20, color: "#8c8c8c" }} />}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
              tip={<div style={{ marginTop: 16, fontSize: 14, color: "#8c8c8c" }}>Đang tải dữ liệu...</div>}
            />
          </div>
        )}

        {!loading && supplier && (
          <div>
            {/* Header Section */}
            <div
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                padding: "32px 24px",
                borderRadius: "16px 16px 0 0",
              }}
            >
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Space size={16}>
                  <Avatar
                    size={64}
                    icon={<TeamOutlined />}
                    style={{
                      background: "rgba(255, 255, 255, 0.2)",
                      border: "3px solid rgba(255, 255, 255, 0.3)",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
                      {supplier.name}
                    </div>
                    {getStatusTag(supplier.status)}
                  </div>
                </Space>
              </Space>
            </div>

            {/* Content Section */}
            <div style={{ padding: 24 }}>
              <Row gutter={[16, 16]}>
                {/* Contact Information */}
                <Col xs={24} md={12}>
                  <InfoItem
                    icon={<PhoneOutlined />}
                    label="Số điện thoại"
                    value={supplier.phone}
                    color="#52c41a"
                    href={supplier.phone ? `tel:${supplier.phone}` : null}
                  />
                </Col>

                <Col xs={24} md={12}>
                  <InfoItem
                    icon={<MailOutlined />}
                    label="Email"
                    value={supplier.email}
                    color="#faad14"
                    href={supplier.email ? `mailto:${supplier.email}` : null}
                  />
                </Col>

                <Col xs={24}>
                  <InfoItem
                    icon={<EnvironmentOutlined />}
                    label="Địa chỉ"
                    value={supplier.address}
                    color="#f5222d"
                  />
                </Col>

                <Col xs={24}>
                  <InfoItem
                    icon={<ShopOutlined />}
                    label="Cửa hàng"
                    value={supplier.store?.name}
                    color="#722ed1"
                  />
                </Col>
              </Row>

              <Divider style={{ margin: "24px 0" }} />

              {/* Timestamp Information */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <InfoItem
                    icon={<CalendarOutlined />}
                    label="Ngày tạo"
                    value={formatDate(supplier.createdAt)}
                    color="#13c2c2"
                  />
                </Col>

                <Col xs={24} md={12}>
                  <InfoItem
                    icon={<ClockCircleOutlined />}
                    label="Cập nhật gần nhất"
                    value={formatDate(supplier.updatedAt)}
                    color="#fa8c16"
                  />
                </Col>
              </Row>
            </div>
          </div>
        )}

        {!loading && !supplier && (
          <div style={{ textAlign: "center", padding: "80px 24px", color: "#999" }}>
            <TeamOutlined style={{ fontSize: 72, color: "#d9d9d9", marginBottom: 16 }} />
            <div style={{ fontSize: 16, color: "#8c8c8c" }}>Không tìm thấy thông tin nhà cung cấp</div>
          </div>
        )}
      </Modal>

      <style>{`
        .ant-modal-content {
          border-radius: 16px !important;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
        }

        .ant-modal-close {
          top: 16px;
          right: 16px;
        }

        .ant-modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .ant-modal-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .ant-modal-body::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
        }

        .info-item-hover:hover {
          background: #f0f5ff !important;
          border-color: #d6e4ff !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
      `}</style>
    </>
  );
}
