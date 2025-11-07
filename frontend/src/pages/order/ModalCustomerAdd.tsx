import React from "react";
import { Modal, Form, Input, Typography, Space, Button } from "antd";
import { UserAddOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface ModalCustomerAddProps {
  open: boolean;
  onCancel: () => void;
  onCreate: (values: any) => void;
  loading?: boolean;
}

const ModalCustomerAdd: React.FC<ModalCustomerAddProps> = ({ open, onCancel, onCreate, loading = false }) => {
  const [form] = Form.useForm();
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");

  return (
    <Modal open={open} onCancel={onCancel} footer={null} centered width={520} destroyOnClose>
      {/* HEADER TITLE */}
      <div style={{ marginBottom: 8 }}>
        <Title
          level={3}
          style={{
            margin: 0,
            textAlign: "start",
            color: "#1890ff",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <UserAddOutlined /> Thêm khách hàng mới
        </Title>
      </div>

      {/* BODY */}
      <div style={{ marginTop: 12 }}>
        <Title
          level={5}
          style={{
            marginBottom: 16,
            textAlign: "start",
            color: "#595959",
            fontWeight: 600,
          }}
        >
          Thông tin cơ bản
        </Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              ...values,
              storeId: currentStore?._id,
            };
            onCreate(payload);
          }}
        >
          <Form.Item
            name="name"
            label={
              <span>
                Họ và tên <Text type="danger">*</Text>
              </span>
            }
            rules={[{ required: true, message: "Vui lòng nhập tên khách hàng!" }]}
          >
            <Input size="large" placeholder="Nhập họ và tên khách hàng" />
          </Form.Item>

          <Form.Item
            name="phone"
            label={
              <span>
                Số điện thoại <Text type="danger">*</Text>
              </span>
            }
            rules={[
              { required: true, message: "Vui lòng nhập số điện thoại!" },
              { pattern: /^[0-9]{9,15}$/, message: "Số điện thoại không hợp lệ!" },
            ]}
          >
            <Input size="large" placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item name="address" label="Địa chỉ">
            <Input size="large" placeholder="Nhập địa chỉ (nếu có)" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về khách hàng (nếu cần)" />
          </Form.Item>

          {/* FOOTER BUTTONS */}
          <div
            style={{
              textAlign: "right",
              marginTop: 8,
              borderTop: "1px solid #f0f0f0",
              paddingTop: 16,
            }}
          >
            <Space>
              <Button onClick={onCancel}>Huỷ</Button>
              <Button
                type="primary"
                loading={loading}
                onClick={() => form.submit()}
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                Tạo mới
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default ModalCustomerAdd;
