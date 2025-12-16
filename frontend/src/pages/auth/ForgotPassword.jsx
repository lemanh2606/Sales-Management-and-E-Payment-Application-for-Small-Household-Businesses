// src/pages/ForgotPassword.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as userApi from "../../api/userApi";
import InputField from "../../components/InputField";
import Button from "../../components/Button";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const emailRef = useRef(null);

    // 1 = gửi OTP, 2 = nhập OTP + password
    const [step, setStep] = useState(1);

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        // autofocus email on mount
        emailRef.current?.focus();
    }, []);

    // countdown for resend button
    useEffect(() => {
        let t;
        if (resendTimer > 0) {
            t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        }
        return () => clearTimeout(t);
    }, [resendTimer]);

    // ---------------- STEP 1: send OTP ----------------
    const handleSendOtp = async (e) => {
        e?.preventDefault();
        setError("");
        setMessage("");

        if (!email || !email.trim()) {
            setError("Vui lòng nhập email");
            return;
        }

        setLoading(true);
        try {
            // backend expects { email }
            const payload = { email: email.trim().toLowerCase() };
            const res = await userApi.sendForgotPasswordOTP(payload);
            setMessage(res?.message || "Mã OTP đã gửi tới email. Kiểm tra hộp thư.");
            setStep(2);
            setResendTimer(60);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Gửi OTP thất bại");
        } finally {
            setLoading(false);
        }
    };

    // ---------------- resend OTP ----------------
    const handleResend = async () => {
        if (resendTimer > 0) return;
        setError("");
        setMessage("");
        setLoading(true);
        try {
            await userApi.sendForgotPasswordOTP({ email: email.trim().toLowerCase() });
            setMessage("Mã OTP đã gửi lại. Kiểm tra email.");
            setResendTimer(60);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Gửi lại OTP thất bại");
        } finally {
            setLoading(false);
        }
    };

    // ---------------- STEP 2: submit OTP + new password ----------------
    const handleResetPassword = async (e) => {
        e?.preventDefault();
        setError("");
        setMessage("");

        // keep backend phrasing consistent
        if (!email || !otp || !password || !confirmPassword) {
            setError("Thiếu thông tin email, OTP hoặc mật khẩu");
            return;
        }
        if (password.length < 6) {
            setError("Mật khẩu phải ít nhất 6 ký tự");
            return;
        }
        if (password !== confirmPassword) {
            setError("Mật khẩu và xác nhận không khớp");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
                password,
                confirmPassword,
            };
            const res = await userApi.forgotChangePassword(payload);
            setMessage(res?.message || "Đổi mật khẩu thành công. Chuyển về trang đăng nhập...");
            // small delay so user sees message
            setTimeout(() => navigate("/login"), 1400);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Đặt lại mật khẩu thất bại");
        } finally {
            setLoading(false);
        }
    };

    // ---------------- RENDER ----------------
    return (
        <div
            className="min-h-screen flex items-center justify-center bg-fixed bg-center bg-cover relative px-4"
            style={{
                backgroundImage:
                    "url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&q=80')",
            }}
        >
            {/* overlay to make card readable */}
            <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Left: Visual */}
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
                                    <p className="text-sm text-white/80">Hỗ trợ bán hàng & quản trị cửa hàng</p>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold mb-3">Khôi phục mật khẩu nhanh chóng</h2>
                            <p className="text-white/90 mb-6 max-w-sm">
                                Nhập email để nhận mã OTP. Sau khi xác thực, bạn có thể đặt mật khẩu mới ngay lập tức.
                            </p>

                            <ul className="space-y-2 text-sm text-white/90">
                                <li>• OTP an toàn, hết hạn nhanh</li>
                                <li>• Hỗ trợ gửi lại mã (60s)</li>
                                <li>• Bảo mật bằng bcrypt & JWT</li>
                            </ul>
                        </div>

                        <div className="text-xs text-white/80">© 2025 Smallbiz-Sales</div>
                    </div>

                    {/* Right: Form */}
                    <div className="bg-white p-8 md:p-10">
                        <div className="max-w-md mx-auto">
                            <div className="mb-4 text-center md:text-left">
                                <h1 className="text-2xl font-bold text-gray-800">Quên mật khẩu</h1>
                                <p className="text-sm text-gray-500 mt-1">Nhập email để nhận mã xác thực và đặt mật khẩu mới.</p>
                            </div>

                            {message && (
                                <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-100 text-green-700 text-sm">
                                    {message}
                                </div>
                            )}

                            {error && (
                                <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-100 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            {step === 1 && (
                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                        <InputField
                                            ref={emailRef}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="example@domain.com"
                                            className="rounded-lg"
                                            name="email"
                                            type="email"
                                            aria-label="Email"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            type="submit"
                                            className={`flex-1 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
                                            disabled={loading}
                                        >
                                            {loading ? "Đang gửi..." : "Gửi mã OTP"}
                                        </Button>

                                        <Button type="button" variant="ghost" onClick={() => navigate("/login")}>
                                            Quay lại
                                        </Button>
                                    </div>
                                </form>
                            )}

                            {step === 2 && (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Mã OTP</label>
                                        <InputField
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            placeholder="Nhập mã OTP"
                                            className="rounded-lg"
                                            name="otp"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu mới</label>
                                        <InputField
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Ít nhất 6 ký tự"
                                            className="rounded-lg"
                                            name="password"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Xác nhận mật khẩu</label>
                                        <InputField
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Nhập lại mật khẩu"
                                            className="rounded-lg"
                                            name="confirmPassword"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <Button type="submit" className="flex-1" disabled={loading}>
                                            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleResend}
                                            disabled={resendTimer > 0 || loading}
                                        >
                                            {resendTimer > 0 ? `Gửi lại (${resendTimer}s)` : "Gửi lại OTP"}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                                        <span>Mật khẩu tối thiểu 6 ký tự.</span>
                                        <button type="button" className="underline" onClick={() => setStep(1)}>
                                            Thay đổi email
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="mt-6 text-center">
                                <button onClick={() => navigate("/login")} className="text-sm text-gray-600 hover:underline">
                                    Quay về đăng nhập
                                </button>
                            </div>

                            <div className="mt-6 text-center text-xs text-gray-400">Nếu không nhận OTP, kiểm tra Spam hoặc liên hệ admin.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* small animation */}
            <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeSlide { animation: fadeSlide 0.45s ease-out; }
        @media (max-width: 767px) {
          .rounded-3xl { border-radius: 1rem; }
        }
      `}</style>
        </div>
    );
}
