// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as userApi from "../../api/userApi";
import Button from "../../components/Button";
import InputField from "../../components/InputField";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await userApi.loginUser(form);
            if (!data?.token || !data?.user) {
                setError("Server trả thiếu token hoặc user");
                setLoading(false);
                return;
            }
            await login(data.user, data.token);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Lỗi server");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-200 via-white to-gray-200 p-6">
            <div className="w-full max-w-md md:max-w-lg p-8 md:p-12 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-green-200 animate-fadeSlide hover:scale-105 transform transition-all duration-500">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-green-700 mb-2 tracking-tight drop-shadow-md">
                        Smallbiz-Sales
                    </h1>
                    <p className="text-gray-500 text-sm md:text-base">
                        Hệ thống quản lý bán hàng cho doanh nghiệp nhỏ
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-300 text-red-700 text-sm py-2 px-4 rounded-lg mb-4 text-center font-medium animate-pulse">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <InputField
                        label="Tên đăng nhập"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        className="focus:ring-2 focus:ring-green-400 rounded-xl transition-all duration-300"
                    />
                    <InputField
                        label="Mật khẩu"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        className="focus:ring-2 focus:ring-green-400 rounded-xl transition-all duration-300"
                    />
                    <Button
                        type="submit"
                        className={`w-full mt-3 text-white bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-2xl transition-all duration-300 rounded-xl py-3 font-semibold tracking-wide ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                        disabled={loading}
                    >
                        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                    </Button>

                    {/* Quên mật khẩu */}
                    <div className="text-right mt-1">
                        <button
                            type="button"
                            className="text-green-700 font-medium text-sm hover:underline hover:text-green-800 transition-colors duration-200"
                            onClick={() => navigate("/forgot-password")}
                        >
                            Quên mật khẩu?
                        </button>
                    </div>
                </form>

                {/* Register */}
                <div className="text-center mt-6">
                    <p className="text-sm text-gray-600">
                        Chưa có tài khoản?{" "}
                        <button
                            type="button"
                            onClick={() => navigate("/register")}
                            className="text-green-700 font-semibold hover:underline hover:text-green-800 transition-colors duration-200"
                        >
                            Đăng ký ngay
                        </button>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-xs md:text-sm text-gray-400 mt-8">
                    © 2025 Smallbiz-Sales. All rights reserved.
                </p>
            </div>

            {/* Custom Animations */}
            <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeSlide {
          animation: fadeSlide 0.6s ease-out;
        }
      `}</style>
        </div>
    );
}
