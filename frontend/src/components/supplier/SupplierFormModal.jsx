// src/components/supplier/SupplierFormModal.jsx
import React, { useEffect, useState } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    Space,
    notification,
    Row,
    Col,
} from "antd";
import {
    TeamOutlined,
    PhoneOutlined,
    MailOutlined,
    EnvironmentOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileTextOutlined,
    IdcardOutlined,       // ✅ MST
    UserOutlined,         // ✅ Người liên hệ
    BankOutlined,         // ✅ Ngân hàng
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
                    taxcode: data.taxcode || "",                    // ✅ NEW
                    contact_person: data.contact_person || "",      // ✅ NEW
                    bank_name: data.bank_name || "",                // ✅ NEW
                    bank_account_no: data.bank_account_no || "",    // ✅ NEW
                    bank_account_name: data.bank_account_name || "",// ✅ NEW
                    notes: data.notes || "",                        // ✅ NEW
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
    }, [supplierId, form, api]);

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
            // ✅ Sanitize data
            const submitData = {
                name: values.name?.trim(),
                phone: values.phone?.trim() || "",
                email: values.email?.trim().toLowerCase() || "",
                address: values.address?.trim() || "",
                taxcode: values.taxcode?.trim().toUpperCase() || "",
                contact_person: values.contact_person?.trim() || "",
                bank_name: values.bank_name?.trim() || "",
                bank_account_no: values.bank_account_no?.trim() || "",
                bank_account_name: values.bank_account_name?.trim() || "",
                notes: values.notes?.trim() || "",
                status: values.status,
            };

            if (supplierId) {
                await updateSupplier(supplierId, submitData);
                api.success({
                    message: "🎉 Cập nhật thành công!",
                    description: `NCC "${submitData.name}" đã được cập nhật`,
                    placement: "topRight",
                    duration: 3,
                });
            } else {
                await createSupplier(storeId, submitData);
                api.success({
                    message: "🎉 Tạo mới thành công!",
                    description: `NCC "${submitData.name}" đã được thêm`,
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
                description: err?.response?.data?.message || err?.message || "Không thể lưu thông tin.",
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
                width={900}  // ✅ TĂNG WIDTH CHO NHỮNG TRƯỜNG MỚI
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
                    <Row gutter={24}>
                        {/* ✅ CỘT 1: Thông tin cơ bản */}
                        <Col xs={24} lg={12}>
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
                                    { min: 2, max: 150, message: "Tên phải từ 2-150 ký tự!" },
                                ]}
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: Công ty TNHH ABC"
                                    prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Mã số thuế */}
                            <Form.Item
                                name="taxcode"
                                label={
                                    <Space>
                                        <IdcardOutlined style={{ color: "#722ed1" }} />
                                        <span style={{ fontWeight: 600 }}>Mã số thuế (MST)</span>
                                    </Space>
                                }
                                rules={[
                                    {
                                        pattern: /^[0-9]{10}$|^[0-9]{13}$|^[0-9]{14}$/,
                                        message: "MST phải là 10, 13 hoặc 14 chữ số!"
                                    },
                                ]}
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: 0101234567"
                                    prefix={<IdcardOutlined style={{ color: "#722ed1" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Người liên hệ */}
                            <Form.Item
                                name="contact_person"
                                label={
                                    <Space>
                                        <UserOutlined style={{ color: "#faad14" }} />
                                        <span style={{ fontWeight: 600 }}>Người liên hệ</span>
                                    </Space>
                                }
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: Nguyễn Văn A"
                                    prefix={<UserOutlined style={{ color: "#faad14" }} />}
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
                                    placeholder="VD: 0901234567"
                                    prefix={<PhoneOutlined style={{ color: "#52c41a" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>
                        </Col>

                        {/* ✅ CỘT 2: Email & Ngân hàng */}
                        <Col xs={24} lg={12}>
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
                                    placeholder="VD: contact@abc.com"
                                    prefix={<MailOutlined style={{ color: "#faad14" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Ngân hàng */}
                            <Form.Item
                                name="bank_name"
                                label={
                                    <Space>
                                        <BankOutlined style={{ color: "#1890ff" }} />
                                        <span style={{ fontWeight: 600 }}>Tên ngân hàng</span>
                                    </Space>
                                }
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: Vietcombank, BIDV"
                                    prefix={<BankOutlined style={{ color: "#1890ff" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Số tài khoản */}
                            <Form.Item
                                name="bank_account_no"
                                label={
                                    <Space>
                                        <IdcardOutlined style={{ color: "#52c41a" }} />
                                        <span style={{ fontWeight: 600 }}>Số tài khoản</span>
                                    </Space>
                                }
                                rules={[
                                    { pattern: /^[0-9]{8,20}$/, message: "Số TK phải từ 8-20 chữ số!" },
                                ]}
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: 1234567890"
                                    prefix={<IdcardOutlined style={{ color: "#52c41a" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Chủ tài khoản */}
                            <Form.Item
                                name="bank_account_name"
                                label={
                                    <Space>
                                        <UserOutlined style={{ color: "#722ed1" }} />
                                        <span style={{ fontWeight: 600 }}>Chủ tài khoản</span>
                                    </Space>
                                }
                            >
                                <Input
                                    size="large"
                                    placeholder="VD: NGUYỄN VĂN A"
                                    prefix={<UserOutlined style={{ color: "#722ed1" }} />}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* ✅ Địa chỉ & Ghi chú */}
                    <Row gutter={24} style={{ marginTop: 24 }}>
                        <Col span={24}>
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
                                    placeholder="Nhập địa chỉ đầy đủ: số nhà, đường, phường, quận, tỉnh"
                                    rows={3}
                                    style={{ borderRadius: 8 }}
                                />
                            </Form.Item>

                            {/* ✅ NEW: Ghi chú */}
                            <Form.Item
                                name="notes"
                                label={
                                    <Space>
                                        <FileTextOutlined style={{ color: "#52c41a" }} />
                                        <span style={{ fontWeight: 600 }}>Ghi chú</span>
                                    </Space>
                                }
                            >
                                <TextArea
                                    size="large"
                                    placeholder="Ghi chú thêm về nhà cung cấp, điều kiện thanh toán..."
                                    rows={3}
                                    style={{ borderRadius: 8 }}
                                    showCount
                                    maxLength={1000}
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
                                                    <CloseCircleOutlined style={{ color: "#f5222d" }} />
                                                    <span>Ngừng hoạt động</span>
                                                </Space>
                                            ),
                                        },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            <style jsx>{`
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
