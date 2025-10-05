import React, { useState } from "react";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { registerManager } from "../api/userApi";
import { useNavigate } from "react-router-dom";

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
    const [info, setInfo] = useState("");

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (form.password !== form.confirmPassword) {
            setError("Mật khẩu nhập lại không khớp");
            return;
        }

        try {
            const data = await registerManager(form);
            setInfo(data.message || "Đã gửi OTP. Kiểm tra email.");
            // chuyển sang trang xác thực OTP kèm email
            navigate("/verify-otp", { state: { email: form.email } });
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Lỗi server"
            );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500 transform hover:scale-[1.01] transition">
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-extrabold text-green-600">Smallbiz-Sales</h1>
                    <p className="text-gray-500">Đăng ký tài khoản Manager</p>
                </div>

                {error && <p className="text-red-500 mb-3">{error}</p>}
                {info && <p className="text-green-600 mb-3">{info}</p>}

                <form onSubmit={handleSubmit}>
                    <InputField
                        label="Username"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        placeholder="ví dụ: manh123"
                    />
                    <InputField
                        label="Email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@mail.com"
                    />
                    <InputField
                        label="Phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="097..."
                    />
                    <InputField
                        label="Password"
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="********"
                    />
                    <InputField
                        label="Nhập lại Password"
                        name="confirmPassword"
                        type="password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="********"
                    />

                    <Button type="submit" className="w-full mt-3">
                        Đăng ký
                    </Button>
                </form>

                {/* Nút chuyển qua login */}
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

                <p className="text-center text-gray-400 text-sm mt-4">
                    © 2025 Smallbiz-Sales
                </p>
            </div>
        </div>
    );
}
