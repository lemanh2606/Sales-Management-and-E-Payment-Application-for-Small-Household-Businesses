// src/components/store/StoreDetailModal.jsx
import React from "react";
import {
    Modal,
    Card,
    Row,
    Col,
    Space,
    Button,
    Tag,
    Avatar,
    Divider,
    Typography,
    Tooltip,
    QRCode,
} from "antd";
import {
    EditOutlined,
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
    LinkOutlined,
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
        if (owner._id) return String(owner._id).slice(-8);
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
    const googleMapsUrl =
        store?.location?.lat != null && store?.location?.lng != null
            ? `https://www.google.com/maps/search/?api=1&query=${store.location.lat},${store.location.lng}`
            : store?.address
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`
                : "";

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={980}
            footer={null}
            styles={{
                body: {
                    padding: 0,
                    maxHeight: "calc(100vh - 160px)",
                    overflowY: "auto",
                    background: "#fff",
                },
            }}
            closeIcon={<Text style={{ fontSize: 20 }}>✕</Text>}
        >
            <div>
                {/* Header */}
                <div
                    style={{
                        background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                        padding: "28px 28px 20px",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Decorative */}
                    <div
                        style={{
                            position: "absolute",
                            top: -60,
                            right: -60,
                            width: 160,
                            height: 160,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.12)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: -50,
                            left: -50,
                            width: 140,
                            height: 140,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)",
                        }}
                    />
                    <Row gutter={24} align="middle" style={{ position: "relative", zIndex: 1 }}>
                        <Col flex="none">
                            {imageSrc ? (
                                <Avatar
                                    size={108}
                                    src={imageSrc}
                                    style={{
                                        border: "4px solid rgba(255,255,255,0.35)",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                                    }}
                                />
                            ) : (
                                <Avatar
                                    size={108}
                                    icon={<ShopOutlined />}
                                    style={{
                                        background: "rgba(255,255,255,0.25)",
                                        border: "4px solid rgba(255,255,255,0.35)",
                                        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                                        color: "#fff",
                                    }}
                                />
                            )}
                        </Col>
                        <Col flex="auto">
                            <Space direction="vertical" size={6} style={{ width: "100%" }}>
                                <Title level={3} style={{ color: "#fff", margin: 0, fontSize: 28, fontWeight: 800 }}>
                                    {safeText(store.name)}
                                </Title>
                                <Space size={8} wrap>
                                    <EnvironmentOutlined style={{ color: "rgba(255,255,255,0.95)" }} />
                                    <Text style={{ color: "rgba(255,255,255,0.95)" }}>{safeText(store.address)}</Text>
                                    {googleMapsUrl && (
                                        <Tooltip title="Xem trên Google Maps">
                                            <Button
                                                type="link"
                                                href={googleMapsUrl}
                                                target="_blank"
                                                icon={<LinkOutlined />}
                                                style={{ color: "#fff", padding: 0 }}
                                            >
                                                Maps
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Space>
                                <Tag
                                    color={store.deleted ? "red" : "success"}
                                    style={{
                                        padding: "4px 12px",
                                        borderRadius: 12,
                                        border: "none",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        width: "fit-content",
                                    }}
                                >
                                    {store.deleted ? "Đã xóa" : "✓ Đang hoạt động"}
                                </Tag>
                            </Space>
                        </Col>
                        {googleMapsUrl && (
                            <Col flex="none">
                                <QRCode
                                    value={googleMapsUrl}
                                    size={96}
                                    color="#1f1f1f"
                                    style={{ background: "#fff", padding: 4, borderRadius: 8 }}
                                />
                            </Col>
                        )}
                    </Row>
                </div>

                {/* Content */}
                <div style={{ padding: 24 }}>
                    <Row gutter={[16, 16]}>
                        {/* Left: info grid tối ưu trường dài */}
                        <Col xs={24} md={14}>
                            <div
                                style={{
                                    border: "1px solid #f0f0f0",
                                    borderRadius: 12,
                                    overflow: "hidden",
                                }}
                            >
                                <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 30%) 1fr" }}>
                                    {/* Helper label cell */}
                                    {[
                                        {
                                            icon: <InfoCircleOutlined style={{ color: "#1890ff" }} />,
                                            label: "ID Cửa hàng",
                                            content: (
                                                <Paragraph
                                                    copyable
                                                    style={{
                                                        margin: 0,
                                                        fontFamily:
                                                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    {safeText(store._id)}
                                                </Paragraph>
                                            ),
                                        },
                                        {
                                            icon: <PhoneOutlined style={{ color: "#faad14" }} />,
                                            label: "Số điện thoại",
                                            content: <Text strong>{safeText(store.phone || "-")}</Text>,
                                        },
                                        {
                                            icon: <UserOutlined style={{ color: "#722ed1" }} />,
                                            label: "Chủ sở hữu",
                                            content: <Text>{getOwnerLabel(store.owner_id)}</Text>,
                                        },
                                        {
                                            icon: <ClockCircleOutlined style={{ color: "#52c41a" }} />,
                                            label: "Giờ hoạt động",
                                            content: (
                                                <Tag color="green" style={{ fontWeight: 600 }}>
                                                    {store.openingHours
                                                        ? `${fmtTime(store.openingHours.open)} – ${fmtTime(store.openingHours.close)}`
                                                        : "--"}
                                                </Tag>
                                            ),
                                        },
                                        {
                                            icon: <CalendarOutlined style={{ color: "#13c2c2" }} />,
                                            label: "Ngày tạo",
                                            content: (
                                                <Text>
                                                    {store.createdAt ? new Date(store.createdAt).toLocaleString("vi-VN") : "-"}
                                                </Text>
                                            ),
                                        },
                                    ].map((row, idx) => (
                                        <React.Fragment key={idx}>
                                            <div
                                                style={{
                                                    background: "#fafafa",
                                                    padding: 12,
                                                    borderRight: "1px solid #f0f0f0",
                                                    borderBottom: "1px solid #f0f0f0",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                }}
                                            >
                                                {row.icon}
                                                {row.label}
                                            </div>
                                            <div
                                                style={{
                                                    padding: 12,
                                                    borderBottom: "1px solid #f0f0f0",
                                                    wordBreak: "break-word",
                                                    overflowWrap: "anywhere",
                                                }}
                                            >
                                                {row.content}
                                            </div>
                                        </React.Fragment>
                                    ))}

                                    {/* Tọa độ */}
                                    {(store?.location?.lat != null || store?.location?.lng != null) && (
                                        <>
                                            <div
                                                style={{
                                                    background: "#fafafa",
                                                    padding: 12,
                                                    borderRight: "1px solid #f0f0f0",
                                                    borderBottom: "1px solid #f0f0f0",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                }}
                                            >
                                                <GlobalOutlined style={{ color: "#f5222d" }} />
                                                Tọa độ
                                            </div>
                                            <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
                                                <Space wrap>
                                                    <Tag color="blue">Lat: {safeText(store.location.lat)}</Tag>
                                                    <Tag color="blue">Lng: {safeText(store.location.lng)}</Tag>
                                                </Space>
                                            </div>
                                        </>
                                    )}

                                    {/* Địa chỉ dài */}
                                    <div
                                        style={{
                                            background: "#fafafa",
                                            padding: 12,
                                            borderRight: "1px solid #f0f0f0",
                                            borderBottom: "1px solid #f0f0f0",
                                            fontWeight: 700,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <EnvironmentOutlined style={{ color: "#52c41a" }} />
                                        Địa chỉ
                                    </div>
                                    <div
                                        style={{
                                            padding: 12,
                                            borderBottom: "1px solid #f0f0f0",
                                            wordBreak: "break-word",
                                            overflowWrap: "anywhere",
                                        }}
                                    >
                                        <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: "Xem thêm" }} style={{ margin: 0 }}>
                                            {safeText(store.address)}
                                        </Paragraph>
                                    </div>

                                    {/* Tags */}
                                    {Array.isArray(store.tags) && store.tags.length > 0 && (
                                        <>
                                            <div
                                                style={{
                                                    background: "#fafafa",
                                                    padding: 12,
                                                    borderRight: "1px solid #f0f0f0",
                                                    borderBottom: "1px solid #f0f0f0",
                                                    fontWeight: 700,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                }}
                                            >
                                                <TagsOutlined style={{ color: "#52c41a" }} />
                                                Tags
                                            </div>
                                            <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
                                                <Space size={[6, 8]} wrap>
                                                    {store.tags.map((tag, idx) => (
                                                        <Tag key={idx} color="green" style={{ borderRadius: 8, fontSize: 12 }}>
                                                            {tag}
                                                        </Tag>
                                                    ))}
                                                </Space>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            {store.description && (
                                <>
                                    <Divider orientation="left" style={{ fontSize: 15, fontWeight: 700, marginTop: 24 }}>
                                        <Space>
                                            <InfoCircleOutlined style={{ color: "#1890ff" }} />
                                            <span>Mô tả</span>
                                        </Space>
                                    </Divider>
                                    <Card
                                        size="small"
                                        style={{
                                            background: "#fafafa",
                                            borderRadius: 10,
                                            border: "1px solid #e8e8e8",
                                        }}
                                    >
                                        <Paragraph
                                            ellipsis={{ rows: 5, expandable: true, symbol: "Xem thêm" }}
                                            style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}
                                        >
                                            {safeText(store.description)}
                                        </Paragraph>
                                    </Card>
                                </>
                            )}
                        </Col>

                        {/* Right: Quick actions */}
                        <Col xs={24} md={10}>
                            <Card
                                styles={{ body: { padding: 16 } }}
                                style={{
                                    borderRadius: 12,
                                    border: "1px solid #f0f0f0",
                                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                                }}
                            >
                                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                    <Title level={5} style={{ margin: 0 }}>
                                        Tác vụ nhanh
                                    </Title>

                                    <Button
                                        type="primary"
                                        icon={<DashboardOutlined />}
                                        onClick={() => onSelect && onSelect(store)}
                                        block
                                        size="large"
                                        style={{
                                            background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                                            border: "none",
                                            borderRadius: 10,
                                            fontWeight: 700,
                                            height: 46,
                                        }}
                                    >
                                        Vào Dashboard
                                    </Button>

                                    <Space size={10} style={{ width: "100%" }}>
                                        <Button
                                            icon={<EditOutlined />}
                                            onClick={handleEditClick}
                                            block
                                            size="large"
                                            style={{
                                                borderRadius: 10,
                                                fontWeight: 600,
                                                height: 44,
                                                borderColor: "#faad14",
                                                color: "#faad14",
                                                flex: 1,
                                            }}
                                        >
                                            Sửa
                                        </Button>
                                        <Button
                                            icon={<DeleteOutlined />}
                                            danger
                                            onClick={() => onDelete && onDelete(store._id)}
                                            block
                                            size="large"
                                            style={{
                                                borderRadius: 10,
                                                fontWeight: 600,
                                                height: 44,
                                                flex: 1,
                                            }}
                                        >
                                            Xóa
                                        </Button>
                                    </Space>

                                    <Divider style={{ margin: "12px 0" }} />
                                    <Space direction="vertical" size={8}>
                                        <Space>
                                            <PhoneOutlined style={{ color: "#faad14" }} />
                                            <Text strong>{safeText(store.phone || "Chưa có số điện thoại")}</Text>
                                        </Space>
                                        <Space align="start">
                                            <EnvironmentOutlined style={{ color: "#52c41a", fontSize: 16, marginTop: 2 }} />
                                            <Text type="secondary" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                                {safeText(store.address)}
                                            </Text>
                                        </Space>
                                        {googleMapsUrl && (
                                            <Button
                                                icon={<LinkOutlined />}
                                                type="default"
                                                href={googleMapsUrl}
                                                target="_blank"
                                                style={{ borderRadius: 8 }}
                                            >
                                                Mở Google Maps
                                            </Button>
                                        )}
                                    </Space>
                                </Space>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>

            <style jsx global>{`
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
        .ant-modal-body::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
          border-radius: 10px;
        }
        /* Ngăn xuống dòng từng ký tự, cho phép wrap hợp lý */
        .ant-typography,
        .ant-typography p {
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
        }
      `}</style>
        </Modal>
    );
}
