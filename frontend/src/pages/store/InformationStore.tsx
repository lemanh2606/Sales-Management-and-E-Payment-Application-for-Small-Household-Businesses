// src/pages/store/InformationStore.tsx
import React, { useEffect, useState } from "react";
import { Form, Input, Button, Space, Card, Row, Col, Typography, Avatar, Upload, Select, Divider, Spin } from "antd";
import {
  ShopOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  CameraOutlined,
  SaveOutlined,
  ReloadOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import Layout from "../../components/Layout";
import axios from "axios";
import Swal from "sweetalert2";

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== INTERFACES ====================

interface OpeningHours {
  open: string;
  close: string;
}

interface Location {
  lat: number | null;
  lng: number | null;
}

interface StoreForm {
  _id?: string;
  name: string;
  address: string;
  phone: string;
  description: string;
  imageUrl: string;
  tags: string[];
  location: Location;
  openingHours: OpeningHours;
  owner_id?: string;
  staff_ids?: string[];
  isDefault?: boolean;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

interface StoreResponse {
  message?: string;
  store: StoreForm;
}

// ==================== COMPONENT ====================

const InformationStore: React.FC = () => {
  const [form] = Form.useForm<StoreForm>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<StoreForm | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Lấy storeId từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId: string | undefined = currentStore?._id;
  const token = localStorage.getItem("token") || "";
  const headers = { Authorization: `Bearer ${token}` };

  // Lấy chi tiết cửa hàng
  const fetchStore = async () => {
    if (!storeId) {
      Swal.fire({
        icon: "warning",
        title: "Không tìm thấy cửa hàng",
        text: "Vui lòng chọn cửa hàng để tiếp tục.",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<StoreResponse>(`http://localhost:9999/api/stores/${storeId}`, { headers });

      const data = res.data?.store || res.data;
      setStore(data);
      setAvatarUrl(data.imageUrl || "");

      // Set form values
      form.setFieldsValue({
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        openingHours: {
          open: data.openingHours?.open || "",
          close: data.openingHours?.close || "",
        },
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Lỗi khi tải thông tin cửa hàng",
        text: err?.response?.data?.message || "Vui lòng thử lại sau.",
        confirmButtonColor: "#d33",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  // Upload avatar - Convert ảnh thành base64
  const handleAvatarUpload: UploadProps["customRequest"] = async (options) => {
    const { file } = options;

    setUploadingAvatar(true);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarUrl(base64);
      form.setFieldValue("imageUrl", base64);
      setUploadingAvatar(false);

      Swal.fire({
        icon: "success",
        title: "Upload ảnh thành công!",
        text: "Nhấn 'Lưu thay đổi' để cập nhật.",
        showConfirmButton: false,
        timer: 1500,
      });
    };

    reader.onerror = () => {
      setUploadingAvatar(false);
      Swal.fire({
        icon: "error",
        title: "Upload ảnh thất bại",
        text: "Vui lòng thử lại.",
        confirmButtonColor: "#d33",
      });
    };

    reader.readAsDataURL(file as File);
  };

  // Cập nhật cửa hàng
  const handleSave = async (values: StoreForm) => {
    if (!storeId) return;

    const payload: Partial<StoreForm> = {
      name: values.name,
      address: values.address,
      phone: values.phone,
      description: values.description,
      imageUrl: avatarUrl || values.imageUrl,
      tags: Array.isArray(values.tags) ? values.tags : [],
      location: values.location,
      openingHours: {
        open: values.openingHours?.open || "",
        close: values.openingHours?.close || "",
      },
    };

    setSaving(true);
    try {
      await axios.put(`http://localhost:9999/api/stores/${storeId}`, payload, { headers });

      Swal.fire({
        icon: "success",
        title: "Cập nhật thành công!",
        showConfirmButton: false,
        timer: 2000,
      });

      // Update localStorage
      const updatedStore = { ...currentStore, ...payload };
      localStorage.setItem("currentStore", JSON.stringify(updatedStore));

      await fetchStore();
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Cập nhật thất bại",
        text: err?.response?.data?.message || "Vui lòng thử lại sau.",
        confirmButtonColor: "#d33",
      });
    } finally {
      setSaving(false);
    }
  };

  // Render loading
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="Đang tải thông tin cửa hàng..." />
      </div>
    );
  }

  return (
    <Layout>
      <div style={{ minHeight: "100vh" }}>
        <div style={{ margin: "0 auto" }}>
          {/* HEADER */}
          <Card
            style={{
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <ShopOutlined style={{ fontSize: 32, color: "#1890ff" }} />
              <div style={{ flex: 1 }}>
                <Title level={3} style={{ margin: 0 }}>
                  Thông Tin Cửa Hàng
                </Title>
                <Text type="secondary">Quản lý thông tin chi tiết về cửa hàng của bạn</Text>
              </div>
              <Space wrap>
                <Button icon={<ReloadOutlined />} onClick={fetchStore} loading={loading}>
                  Tải lại
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => form.submit()}
                  loading={saving}
                  size="large"
                >
                  Lưu thay đổi
                </Button>
              </Space>
            </div>
          </Card>

          <Row gutter={[24, 24]}>
            {/* CỘT TRÁI - AVATAR & INFO NHANH */}
            <Col xs={24} lg={8}>
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  marginBottom: 24,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Upload
                    name="avatar"
                    listType="picture-card"
                    showUploadList={false}
                    customRequest={handleAvatarUpload}
                    beforeUpload={(file) => {
                      const isImage = file.type.startsWith("image/");
                      if (!isImage) {
                        Swal.fire({
                          icon: "error",
                          title: "Chỉ được upload ảnh!",
                          confirmButtonColor: "#d33",
                        });
                      }
                      const isLt5M = file.size / 1024 / 1024 < 5;
                      if (!isLt5M) {
                        Swal.fire({
                          icon: "error",
                          title: "Ảnh phải nhỏ hơn 5MB!",
                          confirmButtonColor: "#d33",
                        });
                      }
                      return isImage && isLt5M;
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <Avatar
                        size={150}
                        src={avatarUrl}
                        icon={!avatarUrl && <ShopOutlined />}
                        style={{
                          border: "4px solid #f0f0f0",
                          cursor: "pointer",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          background: "#1890ff",
                          borderRadius: "50%",
                          width: 40,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          border: "3px solid white",
                        }}
                      >
                        <CameraOutlined style={{ color: "white", fontSize: 18 }} />
                      </div>
                    </div>
                  </Upload>

                  {uploadingAvatar && (
                    <div style={{ marginTop: 12 }}>
                      <Spin size="small" />
                      <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        Đang upload...
                      </Text>
                    </div>
                  )}

                  <Title level={4} style={{ marginTop: 16, marginBottom: 8 }}>
                    {store?.name || "Tên cửa hàng"}
                  </Title>

                  <Space direction="vertical" style={{ width: "100%", marginTop: 16 }} size="small">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PhoneOutlined style={{ color: "#1890ff" }} />
                      <Text>{store?.phone || "Chưa cập nhật"}</Text>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <EnvironmentOutlined style={{ color: "#52c41a", marginTop: 4 }} />
                      <Text style={{ flex: 1, textAlign: "left" }}>{store?.address || "Chưa cập nhật"}</Text>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ClockCircleOutlined style={{ color: "#faad14" }} />
                      <Text>
                        {store?.openingHours?.open || "00:00"} - {store?.openingHours?.close || "00:00"}
                      </Text>
                    </div>
                  </Space>

                  <Divider />

                  <div style={{ textAlign: "left" }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ngày tạo:
                    </Text>
                    <br />
                    <Text>{store?.createdAt ? new Date(store.createdAt).toLocaleDateString("vi-VN") : "N/A"}</Text>
                  </div>
                </div>
              </Card>

              {/* BẢN ĐỒ (nếu có lat/lng) */}
              {store?.location?.lat && store?.location?.lng && (
                <Card
                  style={{
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                >
                  <Title level={5}>
                    <EnvironmentOutlined /> Vị trí trên bản đồ
                  </Title>
                  <div
                    style={{
                      width: "100%",
                      height: 250,
                      background: "#f0f0f0",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      <EnvironmentOutlined style={{ fontSize: 48, color: "#bbb" }} />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                          Lat: {store.location.lat}
                          <br />
                          Lng: {store.location.lng}
                        </Text>
                      </div>
                      <Button
                        type="link"
                        href={`https://www.google.com/maps?q=${store.location.lat},${store.location.lng}`}
                        target="_blank"
                        style={{ marginTop: 8 }}
                      >
                        Xem trên Google Maps
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </Col>

            {/* CỘT PHẢI - FORM CHI TIẾT */}
            <Col xs={24} lg={16}>
              <Card
                style={{
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={{
                    name: "",
                    address: "",
                    phone: "",
                    description: "",
                    imageUrl: "",
                    tags: [],
                    location: { lat: null, lng: null },
                    openingHours: { open: "", close: "" },
                  }}
                >
                  {/* THÔNG TIN CƠ BẢN */}
                  <Title level={5} style={{ marginBottom: 16 }}>
                    <ShopOutlined /> Thông Tin Cơ Bản
                  </Title>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Tên cửa hàng"
                        name="name"
                        rules={[{ required: true, message: "Tên cửa hàng là bắt buộc" }]}
                      >
                        <Input placeholder="Nhập tên cửa hàng" prefix={<ShopOutlined />} size="large" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Số điện thoại"
                        name="phone"
                        rules={[
                          {
                            pattern: /^[0-9+\s()-]{6,20}$/,
                            message: "Số điện thoại không hợp lệ",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập số điện thoại" prefix={<PhoneOutlined />} size="large" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Địa chỉ" name="address">
                    <Input placeholder="Nhập địa chỉ cửa hàng" prefix={<EnvironmentOutlined />} size="large" />
                  </Form.Item>

                  <Form.Item label="Mô tả" name="description">
                    <TextArea rows={4} placeholder="Nhập mô tả về cửa hàng..." showCount maxLength={500} />
                  </Form.Item>

                  <Divider />

                  {/* GIỜ MỞ CỬA */}
                  <Title level={5} style={{ marginBottom: 16 }}>
                    <ClockCircleOutlined /> Giờ Hoạt Động
                  </Title>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Giờ mở cửa" name={["openingHours", "open"]}>
                        <Input type="time" size="large" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Giờ đóng cửa" name={["openingHours", "close"]}>
                        <Input type="time" size="large" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider />

                  {/* VỊ TRÍ */}
                  <Title level={5} style={{ marginBottom: 16 }}>
                    <EnvironmentOutlined /> Tọa Độ Địa Lý
                  </Title>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Vĩ độ (Latitude)" name={["location", "lat"]}>
                        <Input type="number" step="any" placeholder="21.0120439" size="large" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Kinh độ (Longitude)" name={["location", "lng"]}>
                        <Input type="number" step="any" placeholder="105.5252407" size="large" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider />

                  {/* TAGS */}
                  <Title level={5} style={{ marginBottom: 16 }}>
                    <TagsOutlined /> Tags
                  </Title>

                  <Form.Item label="Tags mô tả cửa hàng" name="tags" tooltip="Nhập các tag và nhấn Enter">
                    <Select
                      mode="tags"
                      style={{ width: "100%" }}
                      placeholder="Ví dụ: cà phê, ăn vặt, thời trang..."
                      size="large"
                    />
                  </Form.Item>

                  {/* URL ẢNH (ẩn, chỉ để lưu) */}
                  <Form.Item name="imageUrl" hidden>
                    <Input />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </Layout>
  );
};

export default InformationStore;
