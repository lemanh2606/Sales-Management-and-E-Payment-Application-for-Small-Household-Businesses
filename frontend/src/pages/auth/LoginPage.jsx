// src/pages/LoginPage.jsx


import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../api/userApi";
import Button from "../../components/Button";
import InputField from "../../components/InputField";


export default function LoginPage() {
    const { login } = useAuth();
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await loginUser(form);
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
        <div className="min-h-screen flex items-center justify-center p-4 bg-green-50">
            <div className="w-full max-w-md md:max-w-lg p-6 md:p-10 bg-white rounded-3xl shadow-2xl border-t-4 border-green-500 animate-fadeIn">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-green-600 mb-2">Smallbiz-Sales</h1>
                    <p className="text-gray-500 text-sm md:text-base">Đăng nhập vào hệ thống</p>
                </div>

                {/* Error */}
                {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <InputField
                        label="Username"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        className="transition-all duration-200"
                    />
                    <InputField
                        label="Password"
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        className="transition-all duration-200"
                    />
                    <Button type="submit" className={`w-full mt-2 ${loading ? "opacity-70 cursor-not-allowed" : ""}`} disabled={loading}>
                        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                    </Button>
                </form>

                {/* Register */}
                <div className="text-center mt-5">
                    <p className="text-sm text-gray-500">
                        Chưa có tài khoản?{" "}
                        <button
                            type="button"
                            onClick={() => window.location.href = "/register"}
                            className="text-green-600 font-medium hover:underline transition-colors duration-200"
                        >
                            Đăng ký
                        </button>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-xs md:text-sm text-gray-400 mt-6">© 2025 Smallbiz-Sales</p>
            </div>
        </div>
    );
}
