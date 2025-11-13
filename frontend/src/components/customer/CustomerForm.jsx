// src/components/customer/CustomerForm.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Button, Space, Row, Col, message, Divider } from "antd";
import {
  SaveOutlined,
  CloseOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import Swal from "sweetalert2";
import { createCustomer, updateCustomer } from "../../api/customerApi";

const { TextArea } = Input;

export default function CustomerForm({ customer, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const storeObj = JSON.parse(localStorage.getItem("currentStore")) || {};

  useEffect(() => {
    if (customer) {
      form.setFieldsValue({
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        note: customer.note || "",
      });
    } else {
      form.resetFields();
    }
  }, [customer, form]);

  const handleSave = async (values) => {
    try {
      setSaving(true);

      if (customer && customer._id) {
        const res = await updateCustomer(customer._id, {
          name: values.name.trim(),
          phone: values.phone.trim(),
          address: values.address?.trim() || "",
          note: values.note?.trim() || "",
        });
        const updated = res?.customer ?? res;
        Swal.fire({
          title: "🎉 Thành công!",
          text: "Cập nhật khách hàng thành công!",
          icon: "success",
          confirmButtonText: "Tuyệt vời!",
          confirmButtonColor: "#52c41a",
          buttonsStyling: false,
        });
        onSuccess?.(updated);
      } else {
        const res = await createCustomer({
          storeId: storeObj._id,
          name: values.name.trim(),
          phone: values.phone.trim(),
          address: values.address?.trim() || "",
          note: values.note?.trim() || "",
        });
        const created = res?.customer ?? res;
        Swal.fire({
          title: "🎉 Thành công!",
          text: "Thêm khách hàng thành công!",
          icon: "success",
          confirmButtonText: "OK luôn!",
          confirmButtonColor: "#52c41a",
          buttonsStyling: false,
        });
        onSuccess?.(created);
      }
    } catch (err) {
      console.error("Customer save error:", err);
      const errorMessage = err?.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại";
      Swal.fire({
        title: "❌ Lỗi!",
        text: errorMessage,
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Form form={form} layout="vertical" onFinish={handleSave} autoComplete="off" size="large">
        <Row gutter={16}>
          {/* Name Field */}
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={<span style={{ fontWeight: 600, color: "#262626" }}>Tên khách hàng</span>}
              rules={[
                { required: true, message: "Vui lòng nhập tên khách hàng!" },
                { whitespace: true, message: "Tên không được chỉ chứa khoảng trắng!" },
                { max: 100, message: "Tên không được quá 100 ký tự!" },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: "#1890ff" }} />}
                placeholder="Nhập tên khách hàng"
                autoFocus
                style={{
                  borderRadius: "8px",
                }}
              />
            </Form.Item>
          </Col>

          {/* Phone Field */}
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label={<span style={{ fontWeight: 600, color: "#262626" }}>Số điện thoại</span>}
              rules={[
                { required: true, message: "Vui lòng nhập số điện thoại!" },
                { pattern: /^[0-9 +()-]{9,20}$/, message: "Số điện thoại không hợp lệ!" },
              ]}
            >
              <Input
                prefix={<PhoneOutlined style={{ color: "#52c41a" }} />}
                placeholder="Ví dụ: 0971079629"
                style={{
                  borderRadius: "8px",
                }}
              />
            </Form.Item>
          </Col>

          {/* Address Field */}
          <Col xs={24}>
            <Form.Item
              name="address"
              label={<span style={{ fontWeight: 600, color: "#262626" }}>Địa chỉ</span>}
              rules={[{ max: 300, message: "Địa chỉ không được quá 300 ký tự!" }]}
            >
              <Input
                prefix={<EnvironmentOutlined style={{ color: "#faad14" }} />}
                placeholder="Nhập địa chỉ (tùy chọn)"
                style={{
                  borderRadius: "8px",
                }}
              />
            </Form.Item>
          </Col>

          {/* Note Field */}
          <Col xs={24}>
            <Form.Item
              name="note"
              label={<span style={{ fontWeight: 600, color: "#262626" }}>Ghi chú</span>}
              rules={[{ max: 2000, message: "Ghi chú không được quá 2000 ký tự!" }]}
            >
              <TextArea
                placeholder="Nhập ghi chú về khách hàng (tùy chọn)"
                rows={4}
                showCount
                maxLength={2000}
                style={{
                  borderRadius: "8px",
                  resize: "none",
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: "24px 0 20px" }} />

        {/* Action Buttons */}
        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: "100%", justifyContent: "flex-end" }} size="middle">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={onCancel}
              disabled={saving}
              style={{
                borderRadius: "8px",
                fontWeight: 500,
              }}
            >
              Hủy
            </Button>

            <Button
              type="primary"
              size="large"
              icon={!saving && <SaveOutlined />}
              htmlType="submit"
              loading={saving}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                minWidth: "160px",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
              }}
            >
              {customer ? "Lưu thay đổi" : "Tạo khách hàng"}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
