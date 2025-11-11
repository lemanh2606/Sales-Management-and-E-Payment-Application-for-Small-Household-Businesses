// src/pages/user/Profile.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Alert, Spin, Row, Col, Badge, Divider, Upload, Avatar } from "antd";
import { SaveOutlined, LockOutlined, MailOutlined, UserOutlined, UploadOutlined, CameraOutlined, DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";

const { useForm } = Form;

export default function Profile() {
  const { token, user, setUser } = useAuth();
  const [form] = useForm();
  const [passForm] = useForm();
  const [loading, setLoading] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [infoError, setInfoError] = useState(null);
  const [passError, setPassError] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const otpExpireMinutes = Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5);
  const [timer, setTimer] = useState(0);

  // Load info user vào form khi mount
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username || "",
        fullname: user.fullname || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "",
        isVerified: user.isVerified || "",
        isDeleted: user.isDeleted || "",
      });

      // Set ảnh đại diện nếu có
      if (user.image) {
        setImagePreview(user.image);
      }

      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user, form]);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (sec) => {
    if (!sec || sec <= 0) return "00:00";
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  // Xử lý chọn ảnh
  const handleImageSelect = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      Swal.fire({
        title: "Lỗi",
        text: "Chỉ được chọn file ảnh!",
        icon: "error",
        confirmButtonText: "OK"
      });
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      Swal.fire({
        title: "Lỗi",
        text: "Ảnh phải nhỏ hơn 5MB!",
        icon: "error",
        confirmButtonText: "OK"
      });
      return false;
    }

    setSelectedImage(file);

    // Tạo preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    return false; // Ngăn không cho Upload component tự động upload
  };

  // Xử lý save info cá nhân (có ảnh)
  const onFinishInfo = async (values) => {
    setSavingInfo(true);
    setInfoError(null);

    try {
      let response;

      // Nếu có ảnh mới, dùng FormData
      if (selectedImage) {
        const formData = new FormData();

        // Thêm các trường dữ liệu
        Object.keys(values).forEach(key => {
          if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
            formData.append(key, values[key]);
          }
        });

        // Thêm ảnh
        formData.append('avatar', selectedImage);

        response = await axios.put("http://localhost:9999/api/users/profile", formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
        });
      } else {
        // Không có ảnh, gửi JSON bình thường
        response = await axios.put("http://localhost:9999/api/users/profile", values, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      console.log("Cập nhật thông tin thành công:", response.data.user);

      Swal.fire({
        title: "Cập nhật thành công",
        text: "Thông tin cá nhân đã được lưu!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
      });

      // Cập nhật user context và localStorage
      setUser(response.data.user);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Reset selected image sau khi upload thành công
      setSelectedImage(null);

    } catch (err) {
      console.error("Lỗi cập nhật thông tin:", err.response?.data?.error || err.response?.data?.message || err.message);
      setInfoError(err.response?.data?.error || err.response?.data?.message || "Lỗi cập nhật thông tin");

      Swal.fire({
        title: "Lỗi cập nhật",
        text: err.response?.data?.error || err.response?.data?.message || "Không thể cập nhật thông tin",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSavingInfo(false);
    }
  };

  // Xóa ảnh đại diện
  const removeImage = async () => {
    try {
      const values = form.getFieldsValue();
      const response = await axios.put("http://localhost:9999/api/users/profile",
        { ...values, image: null }, // Gửi null để xóa ảnh
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setUser(response.data.user);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      setImagePreview(null);
      setSelectedImage(null);

      Swal.fire({
        title: "Thành công",
        text: "Đã xóa ảnh đại diện!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
      });

    } catch (err) {
      console.error("Lỗi xóa ảnh:", err);
      Swal.fire({
        title: "Lỗi",
        text: "Không thể xóa ảnh đại diện",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  // 👈 Xử lý gửi OTP đổi pass (POST /password/send-otp)
  const sendOTP = async () => {
    if (timer > 0) return;

    setSendingOTP(true);
    setPassError(null);

    try {
      const email = form.getFieldValue("email");
      if (!email) throw new Error("Cần email để gửi OTP, cập nhật thông tin trước");

      const res = await axios.post(
        "http://localhost:9999/api/users/password/send-otp",
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setOtpSent(true);
      setTimer(60 * otpExpireMinutes);

      Swal.fire({
        title: "Gửi OTP thành công",
        text: res.data?.message || "Kiểm tra email để lấy mã OTP (hết hạn sau 5 phút)",
        icon: "success",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } catch (err) {
      console.error("Lỗi gửi OTP:", err.response?.data?.message || err.message);
      setOtpSent(false);
      setPassError(err.response?.data?.message || err.message || "Không thể gửi OTP");

      Swal.fire({
        title: "OTP chưa được gửi",
        text: err.response?.data?.message || "Không thể gửi OTP",
        icon: "warning",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSendingOTP(false);
    }
  };

  // 👈 Xử lý đổi pass (POST /password/change, validate OTP + new pass match length 6)
  const onFinishPass = async (values) => {
    setChangingPass(true);
    setPassError(null);
    try {
      if (values.newPassword !== values.confirmPassword) {
        Swal.fire({
          icon: "error",
          title: "Mật khẩu không khớp",
          text: "Vui lòng nhập lại cho đúng.",
        });
        return;
      }
      if (values.newPassword.length < 6) {
        setPassError("Mật khẩu mới phải ít nhất 6 ký tự");
        return;
      }
      const payload = {
        password: values.newPassword,
        confirmPassword: values.confirmPassword,
        otp: values.otp,
      };
      const response = await axios.post("http://localhost:9999/api/users/password/change", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Đổi mật khẩu thành công:", response.data.message);
      passForm.resetFields();
      setOtpSent(false);
      Swal.fire({
        title: "Đổi mật khẩu thành công",
        text: "Mật khẩu đã được cập nhật!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
      });
    } catch (err) {
      console.error("Lỗi đổi mật khẩu:", err.response?.data?.message || err.message);
      setPassError(err.response?.data?.message || "Lỗi đổi mật khẩu");
      Swal.fire({
        title: "Lỗi đổi mật khẩu",
        text: err.response?.data?.message || "Không thể đổi mật khẩu",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setChangingPass(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <Alert message="Lỗi" description="Chưa đăng nhập. Vui lòng đăng nhập để xem hồ sơ." type="error" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card
        title={
          <div className="flex items-center gap-3">
            <UserOutlined className="text-green-600 text-xl" />
            <span className="text-3xl font-bold text-gray-800">Hồ Sơ Cá Nhân</span>
          </div>
        }
        style={{ border: "none" }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="Đang tải dữ liệu hồ sơ..." />
          </div>
        ) : (
          <>
            {infoError && (
              <Alert
                message="Lỗi"
                description={infoError}
                type="error"
                showIcon
                className="mb-4"
                closable
                onClose={() => setInfoError(null)}
              />
            )}

            {/* Form thông tin cá nhân */}
            <Form form={form} name="profile-form" onFinish={onFinishInfo} layout="vertical" className="space-y-4 mb-8">
              <Card title={<span className="font-semibold text-gray-800">Thông Tin Cá Nhân</span>} className="bg-white">
                <Row gutter={24}>
                  {/* Avatar Upload Section */}
                  <Col span={24} className="mb-6">
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar
                          size={100}
                          src={imagePreview}
                          icon={<UserOutlined />}
                          className="border-2 border-gray-300 shadow-md"
                        />
                        {imagePreview && (
                          <Button
                            type="link"
                            danger
                            size="small"
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg"
                          >
                            <DeleteOutlined />
                          </Button>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ảnh đại diện
                          </label>
                          <Upload
                            name="avatar"
                            beforeUpload={handleImageSelect}
                            showUploadList={false}
                            accept="image/*"
                          >
                            <Button
                              icon={<CameraOutlined />}
                              className="flex items-center gap-2"
                            >
                              Chọn ảnh
                            </Button>
                          </Upload>
                        </div>
                        <p className="text-xs text-gray-500">
                          Chọn ảnh JPG, PNG nhỏ hơn 5MB
                        </p>
                        {selectedImage && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ Đã chọn: {selectedImage.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </Col>

                  {/* Username */}
                  <Col span={8}>
                    <Form.Item
                      name="username"
                      label="Tên đăng nhập"
                      rules={[{ required: true, message: "Vui lòng nhập tên đăng nhập" }]}
                    >
                      <Input
                        placeholder="Tên đăng nhập"
                        disabled
                        className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 bg-gray-100 cursor-not-allowed"
                      />
                    </Form.Item>
                  </Col>

                  {/* Fullname */}
                  <Col span={8}>
                    <Form.Item
                      name="fullname"
                      label="Họ và tên"
                      rules={[{ required: false, message: "Vui lòng nhập họ và tên" }]}
                    >
                      <Input
                        placeholder="Họ và tên"
                        className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                      />
                    </Form.Item>
                  </Col>

                  {/* Email */}
                  <Col span={8}>
                    <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email không hợp lệ" }]}>
                      <Input
                        placeholder="Email"
                        className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                      />
                    </Form.Item>
                  </Col>

                  {/* Phone - Role - Verified */}
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item name="phone" label={<span className="font-medium">Số điện thoại</span>}>
                      <Input placeholder="Số điện thoại" className="h-11 text-base rounded-lg" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12} lg={8}>
                    <Form.Item label={<span className="font-medium">Vai trò</span>}>
                      <div className="flex items-center gap-2 h-11 px-3 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <span className="font-semibold text-blue-700">
                          {user?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12} lg={8}>
                    <Form.Item label={<span className="font-medium">Xác thực Email</span>}>
                      <div
                        className={`flex items-center gap-2 h-11 px-3 rounded-lg border ${user?.isVerified ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                          }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full ${user?.isVerified ? "bg-green-500" : "bg-yellow-500"}`}
                        ></span>
                        <span className={`font-semibold ${user?.isVerified ? "text-green-700" : "text-yellow-700"}`}>
                          {user?.isVerified ? "Đã xác thực" : "Chưa xác thực"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>

                  {/* Trạng thái tài khoản */}
                  <Col xs={24} md={12} lg={8}>
                    <Form.Item label={<span className="font-medium">Trạng thái tài khoản</span>}>
                      <div
                        className={`flex items-center gap-2 h-11 px-3 rounded-lg border ${user?.isDeleted ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                          }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full ${user?.isDeleted ? "bg-red-500" : "bg-green-500"}`}
                        ></span>
                        <span className={`font-semibold ${user?.isDeleted ? "text-red-700" : "text-green-700"}`}>
                          {user?.isDeleted ? "Đã bị khóa" : "Đang hoạt động"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>
                </Row>

                <div className="flex justify-center pt-4">
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    size="large"
                    loading={savingInfo}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 min-w-[120px]"
                  >
                    Lưu Thông Tin
                  </Button>
                </div>
              </Card>
            </Form>

            {/* 👈 Section đổi mật khẩu */}
            <Card
              title={
                <div className="flex items-center gap-2">
                  <LockOutlined className="text-red-600" />
                  <span className="font-semibold text-gray-800">Đổi Mật Khẩu</span>
                  <small className="text-blue-500 font-normal">(Yêu cầu gửi OTP qua email)</small>
                </div>
              }
              style={{ marginTop: "30px", backgroundColor: "white" }}
            >
              <div className="space-y-4">
                {/* Lỗi riêng của pass, không còn dùng chung setError */}
                {passError && (
                  <Alert
                    message="Lỗi"
                    description={passError}
                    type="error"
                    showIcon
                    className="mb-4"
                    closable
                    onClose={() => setPassError(null)}
                  />
                )}
                <Button
                  type="dashed"
                  onClick={sendOTP}
                  icon={<MailOutlined />}
                  size="large"
                  disabled={timer > 0 || sendingOTP || changingPass}
                  loading={sendingOTP && !otpSent}
                  className={`w-full py-3 text-lg rounded-lg border-dashed border-gray-300 ${timer > 0 ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500 hover:bg-blue-50"
                    }`}
                >
                  {sendingOTP
                    ? "Đang gửi..."
                    : timer > 0
                      ? `Chờ gửi lại (${formatTime(timer)})`
                      : otpSent
                        ? "Gửi OTP mới"
                        : "Gửi OTP đến Email"}
                </Button>

                {otpSent && (
                  <Form
                    form={passForm}
                    name="password-form"
                    onFinish={onFinishPass}
                    layout="vertical"
                    className="space-y-4"
                  >
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="otp"
                          label="Mã OTP"
                          rules={[{ required: true, message: "Vui lòng nhập mã OTP" }]}
                        >
                          <Input
                            placeholder="Nhập mã OTP từ email"
                            maxLength={6}
                            className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="newPassword"
                          label="Mật khẩu mới"
                          rules={[
                            { required: true, message: "Vui lòng nhập mật khẩu mới" },
                            { min: 6, message: "Mật khẩu phải ít nhất 6 ký tự" },
                          ]}
                        >
                          <Input.Password
                            placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                            className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="confirmPassword"
                          label="Xác nhận mật khẩu mới"
                          rules={[{ required: true, message: "Vui lòng xác nhận mật khẩu" }]}
                        >
                          <Input.Password
                            placeholder="Xác nhận mật khẩu"
                            className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <div className="flex justify-end pt-4">
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        size="large"
                        loading={changingPass}
                        disabled={sendingOTP}
                        className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold px-8 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 min-w-[120px]"
                      >
                        Đổi Mật Khẩu
                      </Button>
                    </div>
                  </Form>
                )}
              </div>
            </Card>
          </>
        )}
      </Card>
    </Layout>
  );
}
