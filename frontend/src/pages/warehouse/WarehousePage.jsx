// src/pages/warehouse/WarehousePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    message,
} from "antd";
import {
    HomeOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    EditOutlined,
    DeleteOutlined,
    UndoOutlined,
    StarOutlined,
    StarFilled,
    EnvironmentOutlined,
    PhoneOutlined,
    UserOutlined,
    InboxOutlined,
} from "@ant-design/icons";
import Layout from "../../components/Layout";
import {
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    restoreWarehouse,
    setDefaultWarehouse,
} from "../../api/warehouseApi";

const { Title, Text } = Typography;
const { Option } = Select;

const statusColor = (status) => {
    switch (status) {
        case "active":
            return "success";
        case "inactive":
            return "default";
        case "maintenance":
            return "warning";
        case "archived":
            return "error";
        default:
            return "default";
    }
};

const typeLabel = {
    normal: "Kho thường",
    cold_storage: "Kho lạnh",
    hazardous: "Kho hàng nguy hiểm",
    high_value: "Kho giá trị cao",
    other: "Kho khác",
};

export default function WarehousePage() {
    const [form] = Form.useForm();
    const [filterForm] = Form.useForm();

    const storeObj = JSON.parse(localStorage.getItem("currentStore") || "{}");
    const storeId = storeObj._id || storeObj.id || null;

    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState([]);
    const [deletedMode, setDeletedMode] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

    const [searchText, setSearchText] = useState("");
    const [statusFilter, setStatusFilter] = useState(undefined);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);

    // ===== Load data =====
    const fetchData = async (page = 1, pageSize = pagination.pageSize) => {
        if (!storeId) return;
        try {
            setLoading(true);
            const params = {
                page,
                limit: pageSize,
                deleted: deletedMode,
                status: deletedMode ? undefined : statusFilter,
                q: searchText || undefined,
            };
            const res = await getWarehouses(storeId, params);
            const list = Array.isArray(res?.warehouses) ? res.warehouses : [];
            setWarehouses(list);
            setPagination({
                current: res?.meta?.page || page,
                pageSize: res?.meta?.limit || pageSize,
                total: res?.meta?.total || list.length,
            });
        } catch (err) {
            console.error("Fetch warehouses error:", err);
            message.error(err?.response?.data?.message || "Không thể tải danh sách kho");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeId, deletedMode, statusFilter]);

    // ===== Modal open/close =====
    const openCreate = () => {
        setEditingWarehouse(null);
        form.resetFields();
        form.setFieldsValue({
            status: "active",
            warehouse_type: "normal",
            country: "Việt Nam",
            is_default: false,
        });
        setModalOpen(true);
    };

    const openEdit = (record) => {
        setEditingWarehouse(record);
        form.resetFields();
        form.setFieldsValue({
            code: record.code,
            name: record.name,
            description: record.description,
            address: record.address,
            ward: record.ward,
            district: record.district,
            city: record.city,
            country: record.country || "Việt Nam",
            postal_code: record.postal_code,
            latitude: record.latitude,
            longitude: record.longitude,
            contact_person: record.contact_person,
            phone: record.phone,
            email: record.email,
            warehouse_type: record.warehouse_type || "normal",
            capacity: record.capacity,
            capacity_unit: record.capacity_unit || "m3",
            status: record.status || "active",
            is_default: record.is_default || false,
            allow_negative_stock: record.allow_negative_stock || false,
            auto_reorder: record.auto_reorder || false,
            reorder_point: record.reorder_point,
            barcode_enabled: record.barcode_enabled !== false,
            lot_tracking: record.lot_tracking || false,
            expiry_tracking: record.expiry_tracking || false,
            fifo_enabled: record.fifo_enabled !== false,
            notes: record.notes,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingWarehouse(null);
    };

    // ===== Submit form =====
    const handleSubmit = async (values) => {
        try {
            const payload = {
                ...values,
                capacity: values.capacity ?? null,
                reorder_point: values.reorder_point ?? null,
            };

            setLoading(true);
            if (editingWarehouse) {
                await updateWarehouse(storeId, editingWarehouse._id, payload);
                message.success("Cập nhật kho thành công");
            } else {
                await createWarehouse(storeId, payload);
                message.success("Tạo kho thành công");
            }
            closeModal();
            fetchData(1, pagination.pageSize);
        } catch (err) {
            console.error("Save warehouse error:", err);
            message.error(err?.response?.data?.message || "Lưu kho thất bại");
        } finally {
            setLoading(false);
        }
    };

    // ===== Delete / Restore / Set default =====
    const handleDelete = async (record) => {
        Modal.confirm({
            title: "Xóa kho?",
            content: `Bạn có chắc muốn xóa kho "${record.name}" (${record.code})?`,
            okType: "danger",
            okText: "Xóa",
            cancelText: "Hủy",
            onOk: async () => {
                try {
                    setLoading(true);
                    await deleteWarehouse(storeId, record._id);
                    message.success("Đã xóa kho");
                    fetchData(pagination.current, pagination.pageSize);
                } catch (err) {
                    console.error("Delete warehouse error:", err);
                    message.error(err?.response?.data?.message || "Không thể xóa kho");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleRestore = async (record) => {
        Modal.confirm({
            title: "Khôi phục kho?",
            content: `Khôi phục kho "${record.name}" (${record.code})?`,
            okText: "Khôi phục",
            cancelText: "Hủy",
            onOk: async () => {
                try {
                    setLoading(true);
                    await restoreWarehouse(storeId, record._id);
                    message.success("Đã khôi phục kho");
                    fetchData(pagination.current, pagination.pageSize);
                } catch (err) {
                    console.error("Restore warehouse error:", err);
                    message.error(err?.response?.data?.message || "Không thể khôi phục kho");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleSetDefault = async (record) => {
        Modal.confirm({
            title: "Đặt kho mặc định?",
            content: `Đặt kho "${record.name}" (${record.code}) làm kho mặc định cho cửa hàng?`,
            okText: "Đặt mặc định",
            cancelText: "Hủy",
            onOk: async () => {
                try {
                    setLoading(true);
                    await setDefaultWarehouse(storeId, record._id);
                    message.success("Đã đặt kho mặc định");
                    fetchData(pagination.current, pagination.pageSize);
                } catch (err) {
                    console.error("Set default warehouse error:", err);
                    message.error(err?.response?.data?.message || "Không thể đặt kho mặc định");
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    // ===== Columns =====
    const columns = useMemo(
        () => [
            {
                title: "#",
                key: "index",
                width: 60,
                align: "center",
                render: (_t, _r, index) =>
                    (pagination.current - 1) * pagination.pageSize + index + 1,
            },
            {
                title: "Mã kho",
                dataIndex: "code",
                key: "code",
                width: 120,
                render: (text, record) => (
                    <Space>
                        <HomeOutlined style={{ color: "#1890ff" }} />
                        <Text strong>{text}</Text>
                        {record.is_default && (
                            <Tooltip title="Kho mặc định">
                                <StarFilled style={{ color: "#faad14" }} />
                            </Tooltip>
                        )}
                    </Space>
                ),
            },
            {
                title: "Tên kho",
                dataIndex: "name",
                key: "name",
                width: 200,
                render: (text) => <Text>{text}</Text>,
            },
            {
                title: "Loại",
                dataIndex: "warehouse_type",
                key: "warehouse_type",
                width: 140,
                render: (value) => (
                    <Tag color="blue">{typeLabel[value] || "Kho thường"}</Tag>
                ),
            },
            {
                title: "Địa chỉ",
                key: "address",
                width: 260,
                render: (_, record) => (
                    <Space>
                        <EnvironmentOutlined style={{ color: "#fa541c" }} />
                        <Text type="secondary">
                            {record.address ||
                                [record.ward, record.district, record.city]
                                    .filter(Boolean)
                                    .join(", ") ||
                                "-"}
                        </Text>
                    </Space>
                ),
            },
            {
                title: "Liên hệ",
                key: "contact",
                width: 220,
                render: (record) => (
                    <Space direction="vertical" size={0}>
                        <Space>
                            <UserOutlined />
                            <Text>{record.contact_person || "-"}</Text>
                        </Space>
                        <Space>
                            <PhoneOutlined />
                            <Text type="secondary">{record.phone || "-"}</Text>
                        </Space>
                    </Space>
                ),
            },
            {
                title: "Trạng thái",
                dataIndex: "status",
                key: "status",
                width: 120,
                align: "center",
                render: (value) => (
                    <Tag color={statusColor(value)}>{value || "unknown"}</Tag>
                ),
            },
            {
                title: "Dung tích",
                key: "capacity",
                width: 140,
                align: "right",
                render: (record) =>
                    record.capacity ? (
                        <Text>
                            {record.capacity.toLocaleString("vi-VN")} {record.capacity_unit || "m3"}
                        </Text>
                    ) : (
                        <Text type="secondary">-</Text>
                    ),
            },
            {
                title: "Hành động",
                key: "actions",
                width: 200,
                fixed: "right",
                render: (_, record) => (
                    <Space size="small">
                        {!deletedMode && (
                            <>
                                <Tooltip title="Sửa kho">
                                    <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() => openEdit(record)}
                                    />
                                </Tooltip>

                                <Tooltip
                                    title={
                                        record.is_default
                                            ? "Không thể xóa kho mặc định"
                                            : "Xóa kho"
                                    }
                                >
                                    <Button
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        disabled={record.is_default}
                                        onClick={() => handleDelete(record)}
                                    />
                                </Tooltip>

                                <Tooltip
                                    title={
                                        record.is_default ? "Kho mặc định" : "Đặt làm kho mặc định"
                                    }
                                >
                                    <Button
                                        size="small"
                                        type={record.is_default ? "primary" : "default"}
                                        icon={record.is_default ? <StarFilled /> : <StarOutlined />}
                                        onClick={() => !record.is_default && handleSetDefault(record)}
                                    />
                                </Tooltip>
                            </>
                        )}

                        {deletedMode && (
                            <Tooltip title="Khôi phục kho">
                                <Button
                                    size="small"
                                    icon={<UndoOutlined />}
                                    onClick={() => handleRestore(record)}
                                />
                            </Tooltip>
                        )}
                    </Space>
                ),
            },
        ],
        [deletedMode, pagination]
    );

    if (!storeId) {
        return (
            <Layout>
                <div style={{ padding: 24 }}>
                    <Card>
                        <Title level={3}>Quản lý kho</Title>
                        <Text type="danger">
                            Không tìm thấy cửa hàng hiện tại. Vui lòng chọn cửa hàng trước.
                        </Text>
                    </Card>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div style={{ padding: 24 }}>
                <Card
                    bordered={false}
                    style={{
                        borderRadius: 12,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                >
                    {/* Header */}
                    <Row justify="space-between" align="middle">
                        <Col>
                            <Title
                                level={3}
                                style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
                            >
                                <HomeOutlined style={{ color: "#1890ff" }} />
                                <span>Quản lý Kho</span>
                            </Title>
                            <Text type="secondary">
                                Thiết lập danh mục kho, kho mặc định và thông tin liên hệ.
                            </Text>
                        </Col>

                        <Col>
                            <Space>
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={() => fetchData(pagination.current, pagination.pageSize)}
                                >
                                    Làm mới
                                </Button>
                                <Button
                                    type={deletedMode ? "default" : "dashed"}
                                    onClick={() => {
                                        setDeletedMode((prev) => !prev);
                                        setPagination((p) => ({ ...p, current: 1 }));
                                    }}
                                >
                                    {deletedMode ? "Xem kho đang hoạt động" : "Xem kho đã xóa"}
                                </Button>
                                {!deletedMode && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={openCreate}
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                            border: "none",
                                        }}
                                    >
                                        Thêm kho
                                    </Button>
                                )}
                            </Space>
                        </Col>
                    </Row>

                    <Divider />

                    {/* Filters */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} md={10}>
                            <Input
                                placeholder="Tìm kho theo mã, tên, địa chỉ, liên hệ..."
                                prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
                                allowClear
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onPressEnter={() => fetchData(1, pagination.pageSize)}
                            />
                        </Col>
                        <Col xs={24} md={6}>
                            {!deletedMode && (
                                <Select
                                    allowClear
                                    placeholder="Trạng thái"
                                    style={{ width: "100%" }}
                                    value={statusFilter}
                                    onChange={(v) => {
                                        setStatusFilter(v);
                                        setPagination((p) => ({ ...p, current: 1 }));
                                    }}
                                >
                                    <Option value="active">Đang hoạt động</Option>
                                    <Option value="inactive">Tạm ngưng</Option>
                                    <Option value="maintenance">Bảo trì</Option>
                                    <Option value="archived">Lưu trữ</Option>
                                </Select>
                            )}
                        </Col>
                    </Row>

                    {/* Table */}
                    <Table
                        rowKey={(r) => r._id}
                        columns={columns}
                        dataSource={warehouses}
                        loading={loading}
                        size="middle"
                        pagination={{
                            current: pagination.current,
                            pageSize: pagination.pageSize,
                            total: pagination.total,
                            showSizeChanger: true,
                            onChange: (page, pageSize) => fetchData(page, pageSize),
                            showTotal: (total, range) => (
                                <span>
                                    Hiển thị {range[0]}-{range[1]} / {total} kho
                                </span>
                            ),
                        }}
                        scroll={{ x: "max-content" }}
                    />
                </Card>

                {/* Modal create/edit */}
                <Modal
                    open={modalOpen}
                    onCancel={closeModal}
                    title={editingWarehouse ? "Cập nhật kho" : "Thêm kho mới"}
                    onOk={() => form.submit()}
                    okText={editingWarehouse ? "Lưu thay đổi" : "Tạo kho"}
                    confirmLoading={loading}
                    width={720}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        autoComplete="off"
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="code"
                                    label="Mã kho"
                                    rules={[
                                        { required: true, message: "Vui lòng nhập mã kho" },
                                        { max: 50, message: "Mã kho tối đa 50 ký tự" },
                                    ]}
                                >
                                    <Input placeholder="VD: WH_MAIN" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name="name"
                                    label="Tên kho"
                                    rules={[
                                        { required: true, message: "Vui lòng nhập tên kho" },
                                        { max: 200, message: "Tên kho tối đa 200 ký tự" },
                                    ]}
                                >
                                    <Input placeholder="VD: Kho chính" />
                                </Form.Item>
                            </Col>

                            <Col xs={24}>
                                <Form.Item name="description" label="Mô tả">
                                    <Input.TextArea rows={2} placeholder="Mô tả ngắn về kho" />
                                </Form.Item>
                            </Col>

                            <Col xs={24}>
                                <Form.Item name="address" label="Địa chỉ">
                                    <Input
                                        prefix={<EnvironmentOutlined />}
                                        placeholder="Địa chỉ chi tiết"
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="ward" label="Phường/xã">
                                    <Input placeholder="Phường/xã" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="district" label="Quận/huyện">
                                    <Input placeholder="Quận/huyện" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="city" label="Tỉnh/Thành phố">
                                    <Input placeholder="Tỉnh/Thành phố" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="country" label="Quốc gia">
                                    <Input placeholder="Quốc gia" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="postal_code" label="Mã bưu điện">
                                    <Input placeholder="Mã bưu điện" />
                                </Form.Item>
                            </Col>

                            <Col xs={12} md={4}>
                                <Form.Item name="latitude" label="Vĩ độ (lat)">
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder="Lat"
                                        step={0.000001}
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={12} md={4}>
                                <Form.Item name="longitude" label="Kinh độ (lng)">
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder="Lng"
                                        step={0.000001}
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                                <Form.Item name="contact_person" label="Người phụ trách kho">
                                    <Input
                                        prefix={<UserOutlined />}
                                        placeholder="Họ tên người phụ trách"
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="phone" label="Số điện thoại">
                                    <Input prefix={<PhoneOutlined />} placeholder="SĐT" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={6}>
                                <Form.Item name="email" label="Email">
                                    <Input placeholder="Email" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="warehouse_type" label="Loại kho">
                                    <Select>
                                        <Option value="normal">Kho thường</Option>
                                        <Option value="cold_storage">Kho lạnh</Option>
                                        <Option value="hazardous">Kho hàng nguy hiểm</Option>
                                        <Option value="high_value">Kho giá trị cao</Option>
                                        <Option value="other">Kho khác</Option>
                                    </Select>
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="capacity" label="Dung tích">
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder="VD: 1000"
                                        min={0}
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="capacity_unit" label="Đơn vị dung tích">
                                    <Select>
                                        <Option value="m3">m³</Option>
                                        <Option value="m2">m²</Option>
                                        <Option value="pallet">Pallet</Option>
                                        <Option value="items">Sản phẩm</Option>
                                        <Option value="kg">Kg</Option>
                                    </Select>
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="status" label="Trạng thái">
                                    <Select>
                                        <Option value="active">Đang hoạt động</Option>
                                        <Option value="inactive">Tạm ngưng</Option>
                                        <Option value="maintenance">Bảo trì</Option>
                                        <Option value="archived">Lưu trữ</Option>
                                    </Select>
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="is_default" label="Kho mặc định" valuePropName="checked">
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="allow_negative_stock"
                                    label="Cho phép tồn âm"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="auto_reorder"
                                    label="Tự động cảnh báo đặt hàng"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item name="reorder_point" label="Điểm đặt hàng lại">
                                    <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder="Số lượng"
                                        min={0}
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="barcode_enabled"
                                    label="Dùng barcode/QR"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="lot_tracking"
                                    label="Theo dõi lô / số seri"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="expiry_tracking"
                                    label="Theo dõi hạn sử dụng"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="fifo_enabled"
                                    label="Áp dụng FIFO"
                                    valuePropName="checked"
                                >
                                    <Input type="checkbox" />
                                </Form.Item>
                            </Col>

                            <Col xs={24}>
                                <Form.Item name="notes" label="Ghi chú">
                                    <Input.TextArea rows={3} placeholder="Ghi chú thêm (tuỳ chọn)" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Modal>
            </div>
        </Layout>
    );
}
