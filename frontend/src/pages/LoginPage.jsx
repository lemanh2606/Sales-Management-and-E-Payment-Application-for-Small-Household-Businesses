import React, { useState } from "react";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { loginUser } from "../api/userApi";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
    const { login } = useAuth();

    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const data = await loginUser(form);
            // data: { message, token, user }
            if (!data?.token || !data?.user) {
                setError("Server trả thiếu token hoặc user");
                return;
            }
            // login in AuthContext will call ensureStore + redirect
            await login(data.user, data.token);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Lỗi server");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500">
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-extrabold text-green-600">Smallbiz-Sales</h1>
                    <p className="text-gray-500">Đăng nhập vào hệ thống</p>
                </div>

                {error && <p className="text-red-500 mb-3">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <InputField label="Username" name="username" value={form.username} onChange={handleChange} />
                    <InputField label="Password" type="password" name="password" value={form.password} onChange={handleChange} />
                    <Button type="submit" className="w-full mt-3">Đăng nhập</Button>
                </form>

                <div className="text-center mt-4">
                    <p className="text-sm text-gray-500">
                        Chưa có tài khoản?{" "}
                        <button type="button" onClick={() => window.location.href = "/register"} className="text-green-600 font-medium hover:underline">
                            Đăng ký
                        </button>
                    </p>
                </div>

                <p className="text-center text-sm text-gray-400 mt-6">© 2025 Smallbiz-Sales</p>
            </div>
        </div>
    );
}
