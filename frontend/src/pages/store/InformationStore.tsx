// src/pages/store/InformationStore.tsx
import React, { useEffect, useState } from "react";
import { Form, Input, Button, Space, Card, Row, Col, Typography, Avatar, Upload, Select, Divider, Spin, Badge } from "antd";
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
const apiUrl = import.meta.env.VITE_API_URL;

// ==================== COLOR PALETTE ====================
const COLORS = {
  primary: "#52c41a", // Green primary
  primaryLight: "#73d13d",
  primaryDark: "#389e0d",
  secondary: "#95de64",
  accent: "#237804",
  white: "#ffffff",
  offWhite: "#fafafa",
  lightGray: "#f5f5f5",
  textPrimary: "#262626",
  textSecondary: "#8c8c8c",
  border: "#e8e8e8",
};

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
  taxCode: string;
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

  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId: string | undefined = currentStore?._id;
  const token = localStorage.getItem("token") || "";
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStore = async () => {
    if (!storeId) {
      Swal.fire({
        icon: "warning",
        title: "Không tìm thấy cửa hàng",
        text: "Vui lòng chọn cửa hàng để tiếp tục.",
        confirmButtonColor: COLORS.primary,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<StoreResponse>(`${apiUrl}/stores/${storeId}`, { headers });

      const data = res.data?.store || res.data;
      setStore(data);
      setAvatarUrl(data.imageUrl || "");

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

  const handleAvatarUpload: UploadProps["customRequest"] = async (options) => {
    const { file } = options;
    setUploadingAvatar(true);

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
        confirmButtonColor: COLORS.primary,
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
      taxCode: values.taxCode, // Added taxCode here
    };

    setSaving(true);
    try {
      await axios.put(`${apiUrl}/stores/${storeId}`, payload, { headers });

      Swal.fire({
        icon: "success",
        title: "Cập nhật thành công!",
        showConfirmButton: false,
        timer: 2000,
        confirmButtonColor: COLORS.primary,
      });

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

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: COLORS.offWhite,
        }}
      >
        <Spin size="large" tip="Đang tải thông tin cửa hàng..." />
      </div>
    );
  }

  return (
    <Layout>
      <div style={{ background: COLORS.white }}>
        <div style={{ maxWidth: "auto", margin: "0 auto" }}>
          {/* HEADER */}
          <Card
            style={{
              marginBottom: 24,
              borderRadius: 16,
              background: COLORS.primary,
              border: "none",
              boxShadow: "0 4px 20px rgba(82, 196, 26, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: COLORS.white,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShopOutlined style={{ fontSize: 28, color: COLORS.primary }} />
              </div>
              <div style={{ flex: 1 }}>
                <Title level={3} style={{ margin: 0, color: COLORS.white }}>
                  Thông Tin Cửa Hàng
                </Title>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15 }}>Quản lý và cập nhật thông tin chi tiết về cửa hàng của bạn</Text>
              </div>
              <Space wrap>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchStore}
                  loading={loading}
                  size="large"
                  style={{
                    background: COLORS.white,
                    color: COLORS.primary,
                    border: "none",
                    fontWeight: 500,
                  }}
                >
                  Tải lại
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => form.submit()}
                  loading={saving}
                  size="large"
                  style={{
                    background: COLORS.accent,
                    border: "none",
                    fontWeight: 600,
                    boxShadow: "0 2px 8px rgba(35, 120, 4, 0.3)",
                  }}
                >
                  Lưu thay đổi
                </Button>
              </Space>
            </div>
          </Card>

          <Row gutter={[24, 24]}>
            {/* CỘT TRÁI - AVATAR & INFO */}
            <Col xs={24} lg={8}>
              {/* AVATAR CARD */}
              <Card
                style={{
                  borderRadius: 16,
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                  marginBottom: 24,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  {/* Avatar Upload */}
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
                        size={140}
                        src={avatarUrl}
                        icon={!avatarUrl && <ShopOutlined />}
                        style={{
                          border: `4px solid ${COLORS.lightGray}`,
                          cursor: "pointer",
                          background: COLORS.offWhite,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          background: COLORS.primary,
                          borderRadius: "50%",
                          width: 42,
                          height: 42,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          border: `3px solid ${COLORS.white}`,
                          boxShadow: "0 2px 8px rgba(82, 196, 26, 0.3)",
                        }}
                      >
                        <CameraOutlined style={{ color: COLORS.white, fontSize: 18 }} />
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

                  {/* Store Name & Status */}
                  <div style={{ marginTop: 20 }}>
                    <Title level={4} style={{ marginBottom: 8, color: COLORS.textPrimary }}>
                      {store?.name || "Tên cửa hàng"}
                    </Title>
                    <Badge
                      status={store?.deleted ? "error" : "success"}
                      text={
                        <Text
                          style={{
                            color: store?.deleted ? "#cf1322" : COLORS.primary,
                            fontWeight: 500,
                          }}
                        >
                          {store?.deleted ? "Đã đóng" : "Đang hoạt động"}
                        </Text>
                      }
                    />
                  </div>

                  <Divider style={{ margin: "24px 0" }} />

                  {/* Contact Info */}
                  <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    {/* Phone */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        background: COLORS.lightGray,
                        borderRadius: 12,
                        borderLeft: `4px solid ${COLORS.primary}`,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: COLORS.white,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PhoneOutlined style={{ color: COLORS.primary, fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Số điện thoại
                        </Text>
                        <div>
                          <Text strong style={{ fontSize: 15 }}>
                            {store?.phone || "Chưa cập nhật"}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        padding: "14px 16px",
                        background: COLORS.lightGray,
                        borderRadius: 12,
                        borderLeft: `4px solid ${COLORS.secondary}`,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: COLORS.white,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <EnvironmentOutlined style={{ color: COLORS.secondary, fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Địa chỉ
                        </Text>
                        <div>
                          <Text strong style={{ fontSize: 15 }}>
                            {store?.address || "Chưa cập nhật"}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* Opening Hours */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        background: COLORS.lightGray,
                        borderRadius: 12,
                        borderLeft: `4px solid ${COLORS.accent}`,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: COLORS.white,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ClockCircleOutlined style={{ color: COLORS.accent, fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Giờ hoạt động
                        </Text>
                        <div>
                          <Text strong style={{ fontSize: 15 }}>
                            {store?.openingHours?.open || "00:00"} - {store?.openingHours?.close || "00:00"}
                          </Text>
                        </div>
                      </div>
                    </div>
                    {/* Tax Code */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 16px",
                        background: COLORS.lightGray,
                        borderRadius: 12,
                        borderLeft: `4px solid #1890ff`,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: COLORS.white,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TagsOutlined style={{ color: "#1890ff", fontSize: 18 }} />
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Mã số thuế
                        </Text>
                        <div>
                          <Text strong style={{ fontSize: 15 }}>
                            {store?.taxCode || "Chưa cập nhật"}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </Space>

                  <Divider style={{ margin: "24px 0" }} />

                  {/* Created Date */}
                  <div
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      background: COLORS.lightGray,
                      borderRadius: 10,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Ngày tạo
                    </Text>
                    <div>
                      <Text strong style={{ fontSize: 14 }}>
                        {store?.createdAt ? new Date(store.createdAt).toLocaleDateString("vi-VN") : "N/A"}
                      </Text>
                    </div>
                  </div>
                </div>
              </Card>

              {/* MAP CARD */}
              {store?.location?.lat && store?.location?.lng && (
                <Card
                  style={{
                    borderRadius: 16,
                    background: COLORS.white,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: COLORS.lightGray,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <EnvironmentOutlined style={{ color: COLORS.primary, fontSize: 18 }} />
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      Vị trí trên bản đồ
                    </Title>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 240,
                      background: COLORS.lightGray,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                      border: `2px dashed ${COLORS.border}`,
                    }}
                  >
                    <div style={{ textAlign: "center", zIndex: 1 }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: "50%",
                          background: COLORS.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 16px",
                          boxShadow: "0 4px 16px rgba(82, 196, 26, 0.3)",
                        }}
                      >
                        <EnvironmentOutlined style={{ fontSize: 32, color: COLORS.white }} />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ display: "block", fontSize: 13 }}>
                          Lat: {store.location.lat}
                        </Text>
                        <Text strong style={{ display: "block", fontSize: 13 }}>
                          Lng: {store.location.lng}
                        </Text>
                      </div>
                      <Button
                        type="primary"
                        href={`https://www.google.com/maps?q=${store.location.lat},${store.location.lng}`}
                        target="_blank"
                        icon={<EnvironmentOutlined />}
                        style={{
                          background: COLORS.primary,
                          border: "none",
                        }}
                      >
                        Xem Google Maps
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </Col>

            {/* CỘT PHẢI - FORM */}
            <Col xs={24} lg={16}>
              <Card
                style={{
                  borderRadius: 16,
                  background: COLORS.white,
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 24,
                      paddingBottom: 16,
                      borderBottom: `3px solid ${COLORS.primary}`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: COLORS.lightGray,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ShopOutlined style={{ color: COLORS.primary, fontSize: 20 }} />
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      Thông Tin Cơ Bản
                    </Title>
                  </div>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Tên cửa hàng"
                        name="name"
                        rules={[
                          {
                            required: true,
                            message: "Tên cửa hàng là bắt buộc",
                          },
                        ]}
                      >
                        <Input
                          placeholder="Nhập tên cửa hàng"
                          prefix={<ShopOutlined style={{ color: COLORS.primary }} />}
                          size="large"
                          style={{ borderRadius: 8 }}
                        />
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
                        <Input
                          placeholder="Nhập số điện thoại"
                          prefix={<PhoneOutlined style={{ color: COLORS.primary }} />}
                          size="large"
                          style={{ borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Địa chỉ" name="address">
                        <Input
                          placeholder="Nhập địa chỉ cửa hàng"
                          prefix={<EnvironmentOutlined style={{ color: COLORS.secondary }} />}
                          size="large"
                          style={{ borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Mã số thuế" name="taxCode">
                        <Input
                          placeholder="Nhập mã số thuế"
                          prefix={<TagsOutlined style={{ color: "#1890ff" }} />}
                          size="large"
                          style={{ borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Mô tả" name="description">
                    <TextArea rows={4} placeholder="Nhập mô tả về cửa hàng..." showCount maxLength={500} style={{ borderRadius: 8 }} />
                  </Form.Item>

                  <Divider style={{ margin: "32px 0" }} />

                  {/* GIỜ HOẠT ĐỘNG */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 24,
                      paddingBottom: 16,
                      borderBottom: `3px solid ${COLORS.secondary}`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: COLORS.lightGray,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ClockCircleOutlined style={{ color: COLORS.accent, fontSize: 20 }} />
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      Giờ Hoạt Động
                    </Title>
                  </div>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Giờ mở cửa" name={["openingHours", "open"]}>
                        <Input type="time" size="large" style={{ borderRadius: 8, cursor: "pointer" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Giờ đóng cửa" name={["openingHours", "close"]}>
                        <Input type="time" size="large" style={{ borderRadius: 8, cursor: "pointer" }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "32px 0" }} />

                  {/* TỌA ĐỘ */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 24,
                      paddingBottom: 16,
                      borderBottom: `3px solid ${COLORS.accent}`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: COLORS.lightGray,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <EnvironmentOutlined style={{ color: COLORS.secondary, fontSize: 20 }} />
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      Tọa Độ Địa Lý
                    </Title>
                  </div>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Vĩ độ (Latitude)" name={["location", "lat"]}>
                        <Input type="number" step="any" placeholder="21.0120439" size="large" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Kinh độ (Longitude)" name={["location", "lng"]}>
                        <Input type="number" step="any" placeholder="105.5252407" size="large" style={{ borderRadius: 8 }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: "32px 0" }} />

                  {/* TAGS */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 24,
                      paddingBottom: 16,
                      borderBottom: `3px solid ${COLORS.primaryLight}`,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: COLORS.lightGray,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <TagsOutlined style={{ color: COLORS.primaryLight, fontSize: 20 }} />
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      Tags
                    </Title>
                  </div>

                  <Form.Item label="Tags mô tả cửa hàng" name="tags" tooltip="Nhập các tag và nhấn Enter">
                    <Select
                      mode="tags"
                      style={{ width: "100%" }}
                      placeholder="Ví dụ: cà phê, ăn vặt, thời trang..."
                      size="large"
                      tagRender={(props) => {
                        const { label, closable, onClose } = props;
                        return (
                          <div
                            style={{
                              background: COLORS.primary,
                              color: COLORS.white,
                              padding: "6px 14px",
                              borderRadius: 20,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              margin: "2px 4px",
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {label}
                            {closable && (
                              <span
                                onClick={onClose}
                                style={{
                                  cursor: "pointer",
                                  fontSize: 16,
                                  lineHeight: 1,
                                  opacity: 0.8,
                                }}
                              >
                                ×
                              </span>
                            )}
                          </div>
                        );
                      }}
                    />
                  </Form.Item>

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
