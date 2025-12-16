// src/pages/LoginPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import * as userApi from "../../api/userApi";
import Button from "../../components/Button";
import InputField from "../../components/InputField";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({ username: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const userRef = useRef(null);

    useEffect(() => {
        // Autofocus username input for better UX
        userRef.current?.focus();
    }, []);

    const handleChange = (e) =>
        setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

   const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            console.log('👉 LoginPage: Calling API loginUser'); // DEBUG
            const data = await userApi.loginUser(form);
            console.log('👉 LoginPage: API success, data=', { role: data?.user?.role, hasStore: !!data?.store }); // DEBUG

            if (!data?.token || !data?.user) {
                setError("Server trả thiếu token hoặc user");
                setLoading(false);
                return;
            }

            // Lưu vào context
            console.log('👉 LoginPage: Calling AuthContext.login'); // DEBUG
            await login(data.user, data.token);

            // Nếu muốn nhớ token lâu dài: lưu thêm vào localStorage khi remember=true
            if (remember) {
                localStorage.setItem("remember_session", "1");
                // token already persisted by AuthContext
            } else {
                localStorage.removeItem("remember_session");
            }

            console.log('👉 LoginPage: login() done, setLoading(false)'); // DEBUG
            setLoading(false);
        } catch (err) {
            console.error('👉 LoginPage ERROR:', err); // DEBUG
            console.error(err);
            setError(err?.response?.data?.message || err?.message || "Lỗi server");
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-fixed bg-center bg-cover relative"
            style={{
                backgroundImage:
                    "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80')",
            }}
        >
            {/* dim + subtle vignette */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/30 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-5xl mx-4 rounded-3xl overflow-hidden shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* LEFT: visual panel (illustration + features) */}
                    <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-b from-white/6 to-white/3">
                        <div>
                            <div className="inline-flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
                                    {/* simple logo mark */}
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="white" strokeOpacity="0.9" strokeWidth="1.2" />
                                        <path d="M7 14h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.9" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-white text-xl font-extrabold">Smallbiz-Sales</h3>
                                    <p className="text-sm text-white/80">Quản lý bán hàng — thanh toán — báo cáo</p>
                                </div>
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-lg">Trải nghiệm quản lý chuyên nghiệp</h2>
                            <p className="text-white/80 max-w-sm mb-6">
                                Tối ưu cho cửa hàng nhỏ: quản lý tồn kho, đơn hàng và doanh thu trực quan. Nhanh, nhẹ, bảo mật.
                            </p>

                            <ul className="space-y-3 text-white/90 text-sm">
                                <li>• Báo cáo theo thời gian thực</li>
                                <li>• Quản lý kho và đơn nhập trả</li>
                                <li>• Thanh toán QR & ghi nhận nhanh</li>
                            </ul>
                        </div>

                        <div className="text-white/70 text-xs">© 2025 Smallbiz-Sales</div>
                    </div>

                    {/* RIGHT: form card */}
                    <div className="bg-white/95 p-6 md:p-10 flex items-center justify-center">
                        <div className="w-full max-w-sm">
                            <div className="mb-6 text-center md:text-left">
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Chào mừng trở lại</h1>
                                <p className="text-sm text-gray-500 mt-1">Đăng nhập để quản lý cửa hàng của bạn.</p>
                            </div>

                            {/* error */}
                            {error && (
                                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Tên đăng nhập</label>
                                    <InputField
                                        ref={userRef}
                                        name="username"
                                        value={form.username}
                                        onChange={handleChange}
                                        placeholder="Username hoặc email"
                                        className="w-full rounded-xl"
                                        aria-label="username"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
                                    <div className="relative">
                                        <InputField
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={form.password}
                                            onChange={handleChange}
                                            placeholder="Mật khẩu"
                                            className="w-full rounded-xl pr-12"
                                            aria-label="password"
                                        />
                                        <button
                                            type="button"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            onClick={() => setShowPassword((s) => !s)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                                        >
                                            {showPassword ? "Ẩn" : "Hiện"}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                                        <input
                                            type="checkbox"
                                            checked={remember}
                                            onChange={() => setRemember((r) => !r)}
                                            className="h-4 w-4 rounded border-gray-300"
                                        />
                                        <span>Ghi nhớ đăng nhập</span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => navigate("/forgot-password")}
                                        className="text-sm text-green-600 hover:underline"
                                    >
                                        Quên mật khẩu?
                                    </button>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-3 rounded-xl font-semibold ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                                >
                                    {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                                </Button>
                            </form>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-gray-600">
                                    Chưa có tài khoản?{" "}
                                    <button
                                        onClick={() => navigate("/register")}
                                        className="text-green-700 font-semibold hover:underline"
                                    >
                                        Đăng ký ngay
                                    </button>
                                </p>
                            </div>

                            <div className="mt-6 text-center text-xs text-gray-400">© 2025 Smallbiz-Sales</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* subtle animation */}
            <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeSlide { animation: fadeSlide 0.55s cubic-bezier(.2,.9,.3,1); }
        /* small responsive tweak */
        @media (max-width: 767px) {
          .bg-white\\/95 { background: rgba(255,255,255,0.96); }
        }
      `}</style>
        </div>
    );
}
