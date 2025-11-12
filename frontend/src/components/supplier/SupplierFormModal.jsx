// src/components/supplier/SupplierFormModal.jsx
import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Space, notification } from "antd";
import {
    TeamOutlined,
    PhoneOutlined,
    MailOutlined,
    EnvironmentOutlined,
    CheckCircleOutlined,
} from "@ant-design/icons";
import { createSupplier, updateSupplier, getSupplierById } from "../../api/supplierApi";

const { TextArea } = Input;

export default function SupplierFormModal({ open, onOpenChange, storeId, supplierId, onSuccess }) {
    const [api, contextHolder] = notification.useNotification();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(false);

    // Fetch supplier data for edit mode
    useEffect(() => {
        if (!supplierId) {
            form.resetFields();
            return;
        }

        const fetchSupplier = async () => {
            try {
                setFetchLoading(true);
                const res = await getSupplierById(supplierId);
                const data = res?.supplier ?? res;

                form.setFieldsValue({
                    name: data.name || "",
                    phone: data.phone || "",
                    email: data.email || "",
                    address: data.address || "",
                    status: data.status || "đang hoạt động",
                });
            } catch (err) {
                console.error(err);
                api.error({
                    message: "❌ Lỗi tải dữ liệu",
                    description: "Không thể tải thông tin nhà cung cấp. Vui lòng thử lại.",
                    placement: "topRight",
                    duration: 5,
                });
            } finally {
                setFetchLoading(false);
            }
        };

        fetchSupplier();
    }, [supplierId, form]);

    const handleSubmit = async (values) => {
        if (!storeId) {
            api.warning({
                message: "⚠️ Chưa chọn cửa hàng",
                description: "Vui lòng chọn cửa hàng trước khi thao tác",
                placement: "topRight",
            });
            return;
        }

        setLoading(true);

        try {
            if (supplierId) {
                await updateSupplier(supplierId, values);
                api.success({
                    message: "🎉 Cập nhật thành công!",
                    description: `Nhà cung cấp "${values.name}" đã được cập nhật`,
                    placement: "topRight",
                    duration: 3,
                });
            } else {
                await createSupplier(storeId, values);
                api.success({
                    message: "🎉 Tạo mới thành công!",
                    description: `Nhà cung cấp "${values.name}" đã được thêm vào danh sách`,
                    placement: "topRight",
                    duration: 3,
                });
            }

            onOpenChange(false);
            form.resetFields();
            onSuccess();
        } catch (err) {
            console.error(err);
            api.error({
                message: "❌ Đã xảy ra lỗi",
                description: err?.response?.data?.message || err?.message || "Không thể lưu thông tin. Vui lòng thử lại.",
                placement: "topRight",
                duration: 5,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        onOpenChange(false);
        form.resetFields();
    };

    return (
        <>
            {contextHolder}
            <Modal
                title={
                    <Space style={{ fontSize: 18, fontWeight: 600 }}>
                        <TeamOutlined style={{ color: "#1890ff" }} />
                        <span>{supplierId ? "✏️ Cập nhật nhà cung cấp" : "🧾 Thêm nhà cung cấp mới"}</span>
                    </Space>
                }
                open={open}
                onCancel={handleCancel}
                onOk={() => form.submit()}
                confirmLoading={loading}
                okText={supplierId ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
                cancelText="Hủy"
                width={600}
                styles={{
                    body: {
                        padding: "24px",
                        maxHeight: "calc(100vh - 200px)",
                        overflowY: "auto",
                    },
                }}
                okButtonProps={{
                    style: {
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                    },
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        status: "đang hoạt động",
                    }}
                    disabled={fetchLoading}
                >
                    {/* Tên nhà cung cấp */}
                    <Form.Item
                        name="name"
                        label={
                            <Space>
                                <TeamOutlined style={{ color: "#1890ff" }} />
                                <span style={{ fontWeight: 600 }}>Tên nhà cung cấp</span>
                            </Space>
                        }
                        rules={[
                            { required: true, message: "Vui lòng nhập tên nhà cung cấp!" },
                            { min: 2, message: "Tên phải có ít nhất 2 ký tự!" },
                            { max: 100, message: "Tên không được vượt quá 100 ký tự!" },
                        ]}
                    >
                        <Input
                            size="large"
                            placeholder="Nhập tên nhà cung cấp"
                            prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    {/* Số điện thoại */}
                    <Form.Item
                        name="phone"
                        label={
                            <Space>
                                <PhoneOutlined style={{ color: "#52c41a" }} />
                                <span style={{ fontWeight: 600 }}>Số điện thoại</span>
                            </Space>
                        }
                        rules={[
                            { pattern: /^[0-9]{10,11}$/, message: "Số điện thoại phải có 10-11 chữ số!" },
                        ]}
                    >
                        <Input
                            size="large"
                            placeholder="Nhập số điện thoại"
                            prefix={<PhoneOutlined style={{ color: "#52c41a" }} />}
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    {/* Email */}
                    <Form.Item
                        name="email"
                        label={
                            <Space>
                                <MailOutlined style={{ color: "#faad14" }} />
                                <span style={{ fontWeight: 600 }}>Email</span>
                            </Space>
                        }
                        rules={[
                            { type: "email", message: "Email không hợp lệ!" },
                        ]}
                    >
                        <Input
                            size="large"
                            type="email"
                            placeholder="Nhập email"
                            prefix={<MailOutlined style={{ color: "#faad14" }} />}
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    {/* Địa chỉ */}
                    <Form.Item
                        name="address"
                        label={
                            <Space>
                                <EnvironmentOutlined style={{ color: "#f5222d" }} />
                                <span style={{ fontWeight: 600 }}>Địa chỉ</span>
                            </Space>
                        }
                    >
                        <TextArea
                            size="large"
                            placeholder="Nhập địa chỉ"
                            rows={3}
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    {/* Trạng thái */}
                    <Form.Item
                        name="status"
                        label={
                            <Space>
                                <CheckCircleOutlined style={{ color: "#722ed1" }} />
                                <span style={{ fontWeight: 600 }}>Trạng thái</span>
                            </Space>
                        }
                        rules={[{ required: true, message: "Vui lòng chọn trạng thái!" }]}
                    >
                        <Select
                            size="large"
                            placeholder="Chọn trạng thái"
                            style={{ borderRadius: 8 }}
                            options={[
                                {
                                    value: "đang hoạt động",
                                    label: (
                                        <Space>
                                            <CheckCircleOutlined style={{ color: "#52c41a" }} />
                                            <span>Đang hoạt động</span>
                                        </Space>
                                    ),
                                },
                                {
                                    value: "ngừng hoạt động",
                                    label: (
                                        <Space>
                                            <CheckCircleOutlined style={{ color: "#f5222d" }} />
                                            <span>Ngừng hoạt động</span>
                                        </Space>
                                    ),
                                },
                            ]}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            <style jsx global>{`
        .ant-modal-content {
          border-radius: 16px !important;
          overflow: hidden;
        }

        .ant-modal-header {
          border-bottom: 1px solid #f0f0f0;
          padding: 20px 24px;
        }

        .ant-modal-body::-webkit-scrollbar {
          width: 6px;
        }

        .ant-modal-body::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-radius: 10px;
        }

        .ant-modal-body::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
        }

        .ant-form-item-label > label {
          font-weight: 500;
        }

        .ant-input:focus,
        .ant-input:hover,
        .ant-select-selector:focus,
        .ant-select-selector:hover {
          border-color: #667eea !important;
          box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2) !important;
        }

        .ant-input,
        .ant-select-selector,
        .ant-input-textarea textarea {
          transition: all 0.3s ease;
        }

        .ant-input:hover,
        .ant-select-selector:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      `}</style>
        </>
    );
}
