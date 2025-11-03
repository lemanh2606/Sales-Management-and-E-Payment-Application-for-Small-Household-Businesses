// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { registerManager } from "../../api/userApi";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    fullname: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) =>
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const validate = () => {
    if (!form.username.trim()) return "Vui lòng nhập tên đăng nhập";
    if (!form.fullname.trim()) return "Vui lòng nhập họ và tên";
    if (!form.email.trim()) return "Vui lòng nhập email";
    // simple email regex
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Email không hợp lệ";
    if (!form.password) return "Vui lòng nhập mật khẩu";
    if (form.password.length < 6) return "Mật khẩu phải ít nhất 6 ký tự";
    if (form.password !== form.confirmPassword) return "Mật khẩu nhập lại không trùng khớp";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      setIsLoading(true);
      const payload = {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        fullname: form.fullname.trim(),
      };
      const res = await registerManager(payload);

      await Swal.fire({
        title: "🎉 Đăng ký thành công",
        text: res?.message || "Vui lòng kiểm tra email để lấy mã OTP xác thực.",
        icon: "success",
        confirmButtonText: "Tiếp tục",
        confirmButtonColor: "#16a34a",
        timer: 2200,
      });

      navigate("/verify-otp", { state: { email: form.email.trim().toLowerCase() } });
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || "Đã có lỗi xảy ra, thử lại sau.";
      // nicer alert
      await Swal.fire({
        title: "Lỗi",
        text: msg,
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-fixed bg-center bg-cover px-4"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&q=80')",
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left info panel (desktop) */}
          <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-b from-green-700 to-green-500 text-white">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-white/20 grid place-items-center">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="3" y="3" width="18" height="18" rx="4" stroke="white" strokeOpacity="0.9" strokeWidth="1.2" />
                    <path d="M7 14h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold">Smallbiz-Sales</h3>
                  <p className="text-sm text-white/80">Quản lý bán hàng & thanh toán cho cửa hàng nhỏ</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-3">Tạo tài khoản Manager</h2>
              <p className="text-white/90 mb-6 max-w-sm">
                Đăng ký nhanh, xác thực bằng email. Sau khi xác minh bằng OTP, bạn sẽ quản lý cửa hàng, nhân viên và báo cáo.
              </p>

              <ul className="space-y-2 text-sm text-white/90 mb-6">
                <li>• Thiết lập cửa hàng & nhân viên</li>
                <li>• Quản lý tồn kho, đơn hàng</li>
                <li>• Báo cáo doanh thu đơn giản</li>
              </ul>
            </div>

            <div className="text-xs text-white/80">© 2025 Smallbiz-Sales</div>
          </div>

          {/* Right: form */}
          <div className="bg-white p-8 md:p-10">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Đăng ký Manager</h1>
                <p className="text-sm text-gray-500 mt-1">Nhập thông tin để tạo tài khoản quản lý</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label="Tên đăng nhập"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="ví dụ: nguyenvana123"
                  className="rounded-lg"
                />
                <InputField
                  label="Họ và tên"
                  name="fullname"
                  value={form.fullname}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  className="rounded-lg"
                />

                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="example@domain.com"
                  className="rounded-lg"
                />
                <small className="block text-xs text-blue-800 mb-2">* Hãy nhập email chính xác để nhận mã OTP.</small>

                <InputField
                  label="Số điện thoại (tùy chọn)"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="09xxxxxxxx"
                  className="rounded-lg"
                />

                <InputField
                  label="Mật khẩu"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Ít nhất 6 ký tự"
                  className="rounded-lg"
                />

                <InputField
                  label="Xác nhận mật khẩu"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className="rounded-lg"
                />

                <div className="flex gap-3">
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? "Đang xử lý..." : "Đăng ký"}
                  </Button>
                </div>
              </form>

              <div className="mt-5 text-center">
                <p className="text-sm text-gray-600">
                  Đã có tài khoản?{" "}
                  <button onClick={() => navigate("/login")} className="text-green-600 font-medium hover:underline">
                    Đăng nhập
                  </button>
                </p>
              </div>

              <div className="mt-6 text-center text-xs text-gray-400">© 2025 Smallbiz-Sales</div>
            </div>
          </div>
        </div>
      </div>

      {/* small animations */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeSlide { animation: fadeSlide .45s ease-out; }
        @media (max-width: 767px) {
          .rounded-3xl { border-radius: 1rem; }
        }
      `}</style>
    </div>
  );
}
