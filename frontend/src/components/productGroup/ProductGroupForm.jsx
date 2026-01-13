// src/components/productGroup/ProductGroupForm.jsx
import React, { useState, useEffect } from "react";
import {
  Form,
  Input,
  Button,
  Typography,
  Space,
  Card,
  Divider,
  notification,
} from "antd";
import {
  AppstoreAddOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  TagOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { createProductGroup, updateProductGroup } from "../../api/productGroupApi";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function ProductGroupForm({ storeId, group, onSuccess, onCancel }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (group) {
      form.setFieldsValue({
        name: group.name || "",
        description: group.description || "",
      });
    } else {
      form.resetFields();
    }
  }, [group, form]);

  const handleSubmit = async (values) => {
    const { name, description } = values;
    if (!name.trim()) {
      notification.error({
        message: "Lỗi",
        description: "Tên nhóm sản phẩm là bắt buộc",
        placement: "topRight",
      });
      return;
    }

    try {
      setLoading(true);
      if (group) {
        await updateProductGroup(group._id, { name, description });
        notification.success({
          message: "✅ Cập nhật thành công",
          description: `Đã cập nhật nhóm "${name}"`,
          placement: "topRight",
          icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        });
      } else {
        await createProductGroup(storeId, { name, description });
        notification.success({
          message: "✅ Tạo mới thành công",
          description: `Đã tạo nhóm "${name}"`,
          placement: "topRight",
          icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
        });
      }
      onSuccess && onSuccess();
    } catch (err) {
      notification.error({
        message: "❌ Có lỗi xảy ra",
        description: err?.response?.data?.message || "Không thể thực hiện thao tác",
        placement: "topRight",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
        border: "none",
      }}
      styles={{ body: { padding: 0 } }}
    >
      {/* Header với gradient */}
      <div
        style={{
          background: "linear-gradient(135deg, #52c41a 0%, #237804 100%)",
          padding: "28px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -40,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        
        <Space align="center" size={16}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(10px)",
            }}
          >
            {group ? (
              <EditOutlined style={{ fontSize: 28, color: "#fff" }} />
            ) : (
              <AppstoreAddOutlined style={{ fontSize: 28, color: "#fff" }} />
            )}
          </div>
          <div>
            <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 700 }}>
              {group ? "Chỉnh sửa nhóm sản phẩm" : "Tạo nhóm sản phẩm mới"}
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 4, display: "block" }}>
              {group ? "Cập nhật thông tin nhóm sản phẩm" : "Thêm một nhóm sản phẩm mới vào hệ thống"}
            </Text>
          </div>
        </Space>
      </div>

      {/* Form Body */}
      <div style={{ padding: "32px" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark="optional"
        >
          <Form.Item
            name="name"
            label={
              <Space size={8}>
                <TagOutlined style={{ color: "#52c41a" }} />
                <Text strong style={{ fontSize: 15 }}>Tên nhóm sản phẩm</Text>
              </Space>
            }
            rules={[
              { required: true, message: "Vui lòng nhập tên nhóm sản phẩm!" },
              { min: 2, message: "Tên nhóm phải có ít nhất 2 ký tự" },
              { max: 100, message: "Tên nhóm không được quá 100 ký tự" },
            ]}
          >
            <Input
              placeholder="Ví dụ: Đồ uống, Thực phẩm khô, Gia vị..."
              size="large"
              style={{
                borderRadius: 12,
                fontSize: 15,
                padding: "12px 16px",
              }}
              prefix={<TagOutlined style={{ color: "#bfbfbf" }} />}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={
              <Space size={8}>
                <FileTextOutlined style={{ color: "#52c41a" }} />
                <Text strong style={{ fontSize: 15 }}>Mô tả</Text>
              </Space>
            }
            rules={[
              { max: 500, message: "Mô tả không được quá 500 ký tự" },
            ]}
          >
            <TextArea
              placeholder="Thêm mô tả chi tiết về nhóm sản phẩm này..."
              rows={4}
              style={{
                borderRadius: 12,
                fontSize: 15,
                padding: "12px 16px",
                resize: "none",
              }}
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Divider style={{ margin: "24px 0" }} />

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={onCancel}
              style={{
                borderRadius: 12,
                height: 48,
                paddingInline: 24,
                fontWeight: 600,
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={loading}
              style={{
                borderRadius: 12,
                height: 48,
                paddingInline: 32,
                fontWeight: 600,
                background: "linear-gradient(135deg, #52c41a 0%, #237804 100%)",
                border: "none",
                boxShadow: "0 4px 16px rgba(82, 196, 26, 0.4)",
              }}
            >
              {group ? "Lưu thay đổi" : "Tạo nhóm"}
            </Button>
          </div>
        </Form>
      </div>
    </Card>
  );
}
