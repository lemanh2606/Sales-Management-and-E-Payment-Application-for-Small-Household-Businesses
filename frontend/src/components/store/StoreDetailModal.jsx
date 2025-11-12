// src/components/store/StoreDetailModal.jsx
import React from "react";
import { Modal, Card, Row, Col, Space, Button, Tag, Descriptions, Avatar, Divider, Typography } from "antd";
import {
    EditOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    ShopOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
    UserOutlined,
    CalendarOutlined,
    InfoCircleOutlined,
    GlobalOutlined,
    TagsOutlined,
    DashboardOutlined,
} from "@ant-design/icons";

const { Text, Title, Paragraph } = Typography;

export default function StoreDetailModal({ open, onClose, store, onEdit, onSelect, onDelete }) {
    if (!store) return null;

    const safeText = (v) => (v === undefined || v === null ? "-" : String(v));

    const getOwnerLabel = (owner) => {
        if (!owner) return "-";
        if (typeof owner === "string") return owner;
        if (owner.name) return owner.name;
        if (owner.email) return owner.email;
        if (owner._id) return String(owner._id).slice(0, 8);
        return "-";
    };

    const fmtTime = (v) => {
        if (v === undefined || v === null || v === "") return "--";
        try {
            const s = String(v).trim();
            if (s.includes(":")) {
                const parts = s.split(":").map((p) => p.padStart(2, "0"));
                return `${parts[0].padStart(2, "0")}:${(parts[1] || "00").slice(0, 2)}`;
            }
            if (/^\d{1,2}$/.test(s)) {
                const hh = s.padStart(2, "0");
                return `${hh}:00`;
            }
            if (/^\d{3,4}$/.test(s)) {
                const padded = s.padStart(4, "0");
                const hh = padded.slice(0, padded.length - 2);
                const mm = padded.slice(-2);
                return `${hh.padStart(2, "0")}:${mm}`;
            }
            return s;
        } catch {
            return String(v);
        }
    };

    const handleEditClick = () => {
        onClose && onClose();
        setTimeout(() => {
            try {
                onEdit && onEdit(store);
            } catch (err) {
                console.error("onEdit error", err);
            }
        }, 100);
    };

    const imageSrc = store.imageUrl || "";

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={900}
            footer={null}
            styles={{
                body: {
                    padding: 0,
                    maxHeight: "calc(100vh - 200px)",
                    overflowY: "auto",
                },
            }}
            closeIcon={<Text style={{ fontSize: 20 }}>✕</Text>}
        >
            <div>
                {/* Header Section với Image/Avatar */}
                <div
                    style={{
                        background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                        padding: "32px 32px 24px",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Decorative circles */}
                    <div
                        style={{
                            position: "absolute",
                            top: -40,
                            right: -40,
                            width: 120,
                            height: 120,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: -30,
                            left: -30,
                            width: 100,
                            height: 100,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)",
                        }}
                    />

                    <Row gutter={24} align="middle" style={{ position: "relative", zIndex: 1 }}>
                        <Col>
                            {imageSrc ? (
                                <Avatar
                                    size={100}
                                    src={imageSrc}
                                    style={{
                                        border: "4px solid rgba(255,255,255,0.3)",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                    }}
                                />
                            ) : (
                                <Avatar
                                    size={100}
                                    icon={<ShopOutlined />}
                                    style={{
                                        background: "rgba(255,255,255,0.2)",
                                        border: "4px solid rgba(255,255,255,0.3)",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                    }}
                                />
                            )}
                        </Col>
                        <Col flex={1}>
                            <Space direction="vertical" size={8}>
                                <Title level={3} style={{ color: "#fff", margin: 0, fontSize: 28, fontWeight: 700 }}>
                                    {safeText(store.name)}
                                </Title>
                                <Space size={8}>
                                    <EnvironmentOutlined style={{ color: "rgba(255,255,255,0.9)", fontSize: 16 }} />
                                    <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: 15 }}>
                                        {safeText(store.address)}
                                    </Text>
                                </Space>
                                <Tag
                                    color={store.deleted ? "red" : "success"}
                                    style={{
                                        padding: "4px 12px",
                                        borderRadius: 12,
                                        border: "none",
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    {store.deleted ? "Đã xóa" : "✓ Đang hoạt động"}
                                </Tag>
                            </Space>
                        </Col>
                    </Row>
                </div>

                {/* Content Section */}
                <div style={{ padding: "32px" }}>
                    <Descriptions
                        bordered
                        column={{ xs: 1, sm: 2 }}
                        size="middle"
                        labelStyle={{
                            fontWeight: 600,
                            backgroundColor: "#fafafa",
                            width: "35%",
                        }}
                        contentStyle={{
                            backgroundColor: "#ffffff",
                        }}
                    >
                        {/* Thông tin cơ bản */}
                        <Descriptions.Item
                            label={
                                <Space>
                                    <InfoCircleOutlined style={{ color: "#1890ff" }} />
                                    <span>ID Cửa hàng</span>
                                </Space>
                            }
                            span={2}
                        >
                            <Text code copyable style={{ fontSize: 13 }}>
                                {safeText(store._id)}
                            </Text>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <PhoneOutlined style={{ color: "#faad14" }} />
                                    <span>Số điện thoại</span>
                                </Space>
                            }
                        >
                            <Text strong style={{ fontSize: 14 }}>
                                {safeText(store.phone || "-")}
                            </Text>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <UserOutlined style={{ color: "#722ed1" }} />
                                    <span>Chủ sở hữu</span>
                                </Space>
                            }
                        >
                            <Text style={{ fontSize: 14 }}>{getOwnerLabel(store.owner_id)}</Text>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <ClockCircleOutlined style={{ color: "#52c41a" }} />
                                    <span>Giờ hoạt động</span>
                                </Space>
                            }
                        >
                            <Text style={{ fontSize: 14 }}>
                                {store.openingHours
                                    ? `${fmtTime(store.openingHours.open)} - ${fmtTime(store.openingHours.close)}`
                                    : "--"}
                            </Text>
                        </Descriptions.Item>

                        <Descriptions.Item
                            label={
                                <Space>
                                    <CalendarOutlined style={{ color: "#13c2c2" }} />
                                    <span>Ngày tạo</span>
                                </Space>
                            }
                        >
                            <Text style={{ fontSize: 14 }}>
                                {store.createdAt
                                    ? new Date(store.createdAt).toLocaleString("vi-VN")
                                    : "-"}
                            </Text>
                        </Descriptions.Item>

                        {store.location && (store.location.lat !== null || store.location.lng !== null) && (
                            <Descriptions.Item
                                label={
                                    <Space>
                                        <GlobalOutlined style={{ color: "#f5222d" }} />
                                        <span>Toạ độ</span>
                                    </Space>
                                }
                                span={2}
                            >
                                <Space>
                                    <Tag color="blue">Lat: {safeText(store.location.lat)}</Tag>
                                    <Tag color="blue">Lng: {safeText(store.location.lng)}</Tag>
                                </Space>
                            </Descriptions.Item>
                        )}

                        {Array.isArray(store.tags) && store.tags.length > 0 && (
                            <Descriptions.Item
                                label={
                                    <Space>
                                        <TagsOutlined style={{ color: "#52c41a" }} />
                                        <span>Tags</span>
                                    </Space>
                                }
                                span={2}
                            >
                                <Space size={[4, 8]} wrap>
                                    {store.tags.map((tag, idx) => (
                                        <Tag key={idx} color="green" style={{ borderRadius: 8, fontSize: 12 }}>
                                            {tag}
                                        </Tag>
                                    ))}
                                </Space>
                            </Descriptions.Item>
                        )}
                    </Descriptions>

                    {/* Mô tả */}
                    {store.description && (
                        <>
                            <Divider orientation="left" style={{ fontSize: 15, fontWeight: 600 }}>
                                <Space>
                                    <InfoCircleOutlined style={{ color: "#1890ff" }} />
                                    <span>Mô tả</span>
                                </Space>
                            </Divider>
                            <Card
                                size="small"
                                style={{
                                    background: "#fafafa",
                                    borderRadius: 8,
                                    border: "1px solid #e8e8e8",
                                }}
                            >
                                <Paragraph
                                    ellipsis={{ rows: 4, expandable: true, symbol: "Xem thêm" }}
                                    style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}
                                >
                                    {safeText(store.description)}
                                </Paragraph>
                            </Card>
                        </>
                    )}

                    {/* Action Buttons */}
                    <Divider style={{ margin: "24px 0 16px" }} />
                    <Row gutter={12}>
                        <Col xs={24} sm={6}>
                            <Button
                                icon={<DashboardOutlined />}
                                onClick={() => {
                                    try {
                                        onSelect && onSelect(store);
                                    } catch (err) {
                                        console.error("onSelect error", err);
                                    }
                                }}
                                type="primary"
                                block
                                size="large"
                                style={{
                                    background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                                    border: "none",
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    height: 48,
                                }}
                            >
                                Vào Dashboard
                            </Button>
                        </Col>
                        <Col xs={24} sm={6}>
                            <Button
                                icon={<EditOutlined />}
                                onClick={handleEditClick}
                                size="large"
                                block
                                style={{
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    height: 48,
                                    borderColor: "#faad14",
                                    color: "#faad14",
                                }}
                            >
                                Sửa
                            </Button>
                        </Col>
                        <Col xs={24} sm={6}>
                            <Button
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                    try {
                                        onDelete && onDelete(store._id);
                                    } catch (err) {
                                        console.error("onDelete error", err);
                                    }
                                }}
                                danger
                                size="large"
                                block
                                style={{
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    height: 48,
                                }}
                            >
                                Xóa
                            </Button>
                        </Col>
                        <Col xs={24} sm={6}>
                            <Button
                                onClick={onClose}
                                size="large"
                                block
                                style={{
                                    borderRadius: 8,
                                    fontWeight: 600,
                                    height: 48,
                                }}
                            >
                                Đóng
                            </Button>
                        </Col>
                    </Row>
                </div>
            </div>

            <style jsx global>{`
        .ant-descriptions-item-label {
          font-size: 13px !important;
        }

        .ant-modal-content {
          border-radius: 16px !important;
          overflow: hidden;
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
          background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
          border-radius: 10px;
        }
      `}</style>
        </Modal>
    );
}
