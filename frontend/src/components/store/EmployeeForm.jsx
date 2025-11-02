import React from "react";
import { Form, Input, Button, Select } from "antd";

const { Option } = Select;

export default function EmployeeForm({ mode, initialValues = {}, onSubmit, loading }) {
  const [form] = Form.useForm();

  React.useEffect(() => {
    form.setFieldsValue({
      fullName: initialValues?.fullName ?? "",
      username: initialValues?.user_id?.username ?? "",
      email: initialValues?.user_id?.email ?? "",
      phone: initialValues?.user_id?.phone ?? "",
      salary: initialValues?.salary ?? "",
      commission_rate: initialValues?.commission_rate ?? 0,
      shift: initialValues?.shift ?? "Sáng",
    });
  }, [initialValues, form]);

  const handleFinish = (values) => {
    onSubmit(values);
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <Form.Item
        label="Tên nhân viên"
        name="fullName"
        rules={[{ required: true, message: "Nhập tên nhân viên" }]}
      >
        <Input />
      </Form.Item>

      {mode === "create" && (
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: "Nhập username" }]}
        >
          <Input />
        </Form.Item>
      )}

      <Form.Item label="Email" name="email">
        <Input />
      </Form.Item>

      <Form.Item label="Số điện thoại" name="phone">
        <Input />
      </Form.Item>

      <Form.Item
        label="Ca làm việc"
        name="shift"
        rules={[{ required: true, message: "Chọn ca làm việc" }]}
      >
        <Select>
          <Option value="Sáng">Sáng</Option>
          <Option value="Chiều">Chiều</Option>
          <Option value="Tối">Tối</Option>
          <Option value="Fulltime">Fulltime</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label="Lương cơ bản"
        name="salary"
        rules={[{ required: true, message: "Nhập lương cơ bản" }]}
      >
        <Input type="number" />
      </Form.Item>

      <Form.Item label="Hoa hồng (%)" name="commission_rate">
        <Input type="number" />
      </Form.Item>
      <Form.Item
    label="Mật khẩu"
    name="password"
    rules={[{ required: true, message: "Nhập mật khẩu" }]}
  >
    <Input.Password />
  </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          {mode === "edit" ? "Cập nhật" : "Tạo"}
        </Button>
      </Form.Item>
    </Form>
  );
}
