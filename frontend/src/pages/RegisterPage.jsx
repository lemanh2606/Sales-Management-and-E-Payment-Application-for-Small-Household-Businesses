import React, { useState } from "react";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { registerManager } from "../api/userApi";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2"; // ✅ import sweetalert2

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // ✅ để disable nút khi đang gửi

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu nhập lại không trùng khớp, vui lòng nhập lại");
      return;
    }

    try {
      setIsLoading(true); // ✅ bật loading
      const data = await registerManager(form);

      // ✅ hiện popup thông báo đăng ký thành công
      await Swal.fire({
        title: "🎉 Đăng ký thành công!",
        text: "Hãy xác thực OTP gửi tới Email của bạn.",
        icon: "success",
        confirmButtonText: "Xác nhận",
        confirmButtonColor: "#16a34a",
        timer: 2500,
      });

      // ✅ chuyển sang trang xác thực OTP kèm email
      navigate("/verify-otp", { state: { email: form.email } });
    } catch (err) {
      Swal.fire({
        title: "Lỗi",
        text: err?.response?.data?.message || "Đã có lỗi xảy ra, vui lòng thử lại sau.",
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsLoading(false); // ✅ tắt loading
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500 transform hover:scale-[1.01] transition">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-green-600">Smallbiz-Sales</h1>
          <p className="text-gray-500">Đăng ký tài khoản Quản Lý</p>
        </div>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <form onSubmit={handleSubmit}>
          <InputField
            label="Tên đăng nhập"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="ví dụ: nguyenvana1234"
          />
          <InputField
            label="Email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="nguyenvana@mail.com"
          />
          <small className="block mt-0 text-xs text-blue-800">* Hãy nhập Email chính xác để nhận mã OTP xác thực</small>
          <br />
          <InputField label="Phone" name="phone" value={form.phone} onChange={handleChange} placeholder="09xxxxxxxx" />
          <InputField
            label="Mật khẩu"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="********"
          />
          <InputField
            label="Nhập lại Mật khẩu"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="********"
          />

          <Button type="submit" className="w-full mt-3" disabled={isLoading}>
            {isLoading ? "Đang xử lý..." : "Đăng ký"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Đã có tài khoản?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-green-600 font-medium hover:underline"
            >
              Đăng nhập
            </button>
          </p>
        </div>

        <p className="text-center text-gray-400 text-sm mt-4">© 2025 Smallbiz-Sales</p>
      </div>
    </div>
  );
}
