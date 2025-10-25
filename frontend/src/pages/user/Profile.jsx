// src/pages/user/Profile.jsx
import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card, Alert, Spin, Row, Col, Badge, Divider } from "antd";
import { SaveOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import axios from "axios";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import Layout from "../../components/Layout";

const { useForm } = Form;

export default function Profile() {
  const { token, user } = useAuth(); // 👈 Lấy token/user từ context (user có username/email/role)
  const [form] = useForm();
  const [passForm] = useForm(); // 👈 Form riêng cho đổi pass
  const [loading, setLoading] = useState(true); // 👈 Loading chung
  const [savingInfo, setSavingInfo] = useState(false); // 👈 Loading save info
  const [savingPass, setSavingPass] = useState(false); // 👈 Loading save pass
  const [error, setError] = useState(null); // 👈 Lỗi chung
  const [otpSent, setOtpSent] = useState(false); // 👈 Trạng thái gửi OTP thành công
  //đếm ngược gửi lại otp, tránh spam
  const otpExpireMinutes = Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5);
  const [timer, setTimer] = useState(0);

  // 👈 Load info user vào form khi mount
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "",
        isVerified: user.isVerified || "",
        isDeleted: user.isDeleted || "",
      });
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

  // 👈 Xử lý save info cá nhân (POST /profile, validate unique)
  const onFinishInfo = async (values) => {
    setSavingInfo(true);
    setError(null);
    try {
      const response = await axios.put("http://localhost:9999/api/users/profile", values, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Cập nhật thông tin thành công:", response.data.user);
      // 👈 Swal.fire success đẹp (icon xanh, animation mượt)
      Swal.fire({
        title: "Cập nhật thành công",
        text: "Thông tin cá nhân đã được lưu!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000, // Tự đóng sau 3s
      });
      // Reload user từ context nếu cần (giả sử useAuth refetch)
    } catch (err) {
      console.error("Lỗi cập nhật thông tin:", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Lỗi cập nhật thông tin");
      // 👈 Swal.fire error đẹp (icon đỏ, animation)
      Swal.fire({
        title: "Lỗi cập nhật",
        text: err.response?.data?.message || "Không thể cập nhật thông tin",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSavingInfo(false);
    }
  };

  // 👈 Xử lý gửi OTP đổi pass (POST /password/send-otp)
  // 👈 Xử lý gửi OTP đổi pass (POST /password/send-otp)
  const sendOTP = async () => {
    if (timer > 0) return;

    setSavingPass(true);
    setError(null);

    try {
      const email = form.getFieldValue("email");
      if (!email) throw new Error("Cần email để gửi OTP, cập nhật thông tin trước");

      const res = await axios.post(
        "http://localhost:9999/api/users/password/send-otp",
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOtpSent(true);
      setTimer(60 * otpExpireMinutes); // bắt đầu countdown

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
      setError(err.response?.data?.message || err.message || "Không thể gửi OTP");

      Swal.fire({
        title: "Lỗi gửi OTP",
        text: err.response?.data?.message || "Không thể gửi OTP",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSavingPass(false);
    }
  };

  // 👈 Xử lý đổi pass (POST /password/change, validate OTP + new pass match length 6)
  const onFinishPass = async (values) => {
    setSavingPass(true);
    setError(null);
    try {
      if (values.newPassword !== values.confirmPassword) {
        setError("Mật khẩu mới không khớp");
        return;
      }
      if (values.newPassword.length < 6) {
        setError("Mật khẩu mới phải ít nhất 6 ký tự");
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
      // 👈 Swal.fire success đổi pass
      Swal.fire({
        title: "Đổi mật khẩu thành công",
        text: "Mật khẩu đã được cập nhật!",
        icon: "success",
        confirmButtonText: "OK",
        timer: 3000,
      });
    } catch (err) {
      console.error("Lỗi đổi mật khẩu:", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Lỗi đổi mật khẩu");
      // 👈 Swal.fire error đổi pass
      Swal.fire({
        title: "Lỗi đổi mật khẩu",
        text: err.response?.data?.message || "Không thể đổi mật khẩu",
        icon: "error",
        confirmButtonText: "OK",
        timer: 4000,
      });
    } finally {
      setSavingPass(false);
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
            <SaveOutlined className="text-green-600 text-xl" />
            <span className="text-3xl font-bold text-gray-800">Hồ Sơ Cá Nhân</span>
          </div>
        }
        className="shadow-xl border-0 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100"
      >
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="Đang tải dữ liệu hồ sơ..." />
          </div>
        ) : (
          <>
            {/* 👈 Thông báo lỗi chung */}
            {error && (
              <Alert
                message="Lỗi"
                description={error}
                type="error"
                showIcon
                className="mb-6"
                closable
                onClose={() => setError(null)}
              />
            )}

            {/* 👈 Form thông tin cá nhân */}
            <Form form={form} name="profile-form" onFinish={onFinishInfo} layout="vertical" className="space-y-4 mb-8">
              <Card
                title={<span className="font-semibold text-gray-800">Thông Tin Cá Nhân</span>}
                className="shadow-lg border-0 rounded-xl bg-white"
              >
                <Row gutter={24}>
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

                  {/* Email */}
                  <Col span={8}>
                    <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Email không hợp lệ" }]}>
                      <Input
                        placeholder="Email"
                        className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                      />
                    </Form.Item>
                  </Col>

                  {/* Phone */}
                  <Col span={8}>
                    <Form.Item name="phone" label="Số điện thoại">
                      <Input
                        placeholder="Số điện thoại"
                        className="!py-2 !px-3 !text-lg rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-300"
                      />
                    </Form.Item>
                  </Col>

                  {/* Role */}
                  <Col span={8}>
                    <Form.Item name="role" label="Vai trò">
                      <div className="py-2 px-3 bg-blue-100 rounded-lg inline-flex items-center gap-2 shadow-sm">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <span className="text-lg font-semibold text-blue-700 tracking-wide">
                          {user?.role === "MANAGER" ? "Quản lý" : "Nhân viên"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>

                  {/* Verified */}
                  <Col span={8}>
                    <Form.Item name="isVerified" label="Xác thực Email">
                      <div
                        className={`py-2 px-3 rounded-lg inline-flex items-center gap-2 shadow-sm ${
                          user?.isVerified ? "bg-green-100" : "bg-yellow-100"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full ${user?.isVerified ? "bg-green-500" : "bg-yellow-500"}`}
                        ></span>
                        <span
                          className={`text-lg font-semibold tracking-wide ${
                            user?.isVerified ? "text-green-700" : "text-yellow-700"
                          }`}
                        >
                          {user?.isVerified ? "Đã xác thực" : "Chưa xác thực"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>

                  {/* Deleted */}
                  <Col span={8}>
                    <Form.Item name="isDeleted" label="Trạng thái tài khoản">
                      <div
                        className={`py-2 px-3 rounded-lg inline-flex items-center gap-2 shadow-sm ${
                          user?.isDeleted ? "bg-red-100" : "bg-green-100"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded-full ${user?.isDeleted ? "bg-red-500" : "bg-green-500"}`}
                        ></span>
                        <span
                          className={`text-lg font-semibold tracking-wide ${
                            user?.isDeleted ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {user?.isDeleted ? "Đã bị khóa" : "Đang hoạt động"}
                        </span>
                      </div>
                    </Form.Item>
                  </Col>
                </Row>

                <div className="flex justify-end pt-4">
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
                </div>
              }
              className="shadow-lg border-0 rounded-xl bg-white"
            >
              <div className="space-y-4">
                <Button
                  type="dashed"
                  onClick={sendOTP}
                  icon={<MailOutlined />}
                  size="large"
                  disabled={timer > 0 || savingPass}
                  loading={savingPass && !otpSent}
                  className={`w-full py-3 text-lg rounded-lg border-dashed border-gray-300 ${
                    timer > 0 ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500 hover:bg-blue-50"
                  }`}
                >
                  {savingPass
                    ? "Đang gửi..."
                    : timer > 0
                    ? `Chờ gửi lại (${formatTime(timer)})`
                    : otpSent
                    ? "Gửi OTP mới"
                    : "Gửi OTP qua email"}
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
                        loading={savingPass}
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
