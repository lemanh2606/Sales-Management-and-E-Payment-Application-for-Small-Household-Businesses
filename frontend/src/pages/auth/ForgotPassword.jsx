// src/pages/ForgotPassword.jsx
import React, { useEffect, useState } from "react";
import * as userApi from "../../api/userApi";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { useNavigate } from "react-router-dom";

/**
 * ForgotPassword (public)
 * Flow:
 *  1. user nhập email hoặc phone -> gọi requestPasswordReset(identifier)
 *  2. user nhập OTP -> gọi verifyPasswordResetOtp({ identifier, otp })
 *     (backend có thể trả resetToken)
 *  3. user nhập mật khẩu mới -> gọi resetPassword({ resetToken, newPassword })
 *
 * Lưu ý: API được gọi ở đây là public (không cần token).
 */

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1); // 1: send identifier, 2: verify otp, 3: reset password
    const [identifier, setIdentifier] = useState(""); // email or phone
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        let t;
        if (resendTimer > 0) t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Simple password strength check
    const pwdCheck = (pwd) => {
        if (!pwd) return { ok: false, msg: "Mật khẩu rỗng" };
        if (pwd.length < 8) return { ok: false, msg: "Ít nhất 8 ký tự" };
        if (!/[A-Z]/.test(pwd)) return { ok: false, msg: "Cần ít nhất 1 chữ hoa" };
        if (!/\d/.test(pwd)) return { ok: false, msg: "Cần ít nhất 1 chữ số" };
        return { ok: true };
    };

    // Step 1: request password reset (send OTP)
    const handleRequestReset = async (e) => {
        e?.preventDefault();
        setError("");
        setMessage("");
        if (!identifier) {
            setError("Vui lòng nhập email ");
            return;
        }
        setLoading(true);
        try {
            const res = await userApi.requestPasswordReset(identifier);
            setMessage(res?.message || "Đã gửi mã OTP. Kiểm tra email/sms.");
            setStep(2);
            setResendTimer(60);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Gửi OTP thất bại");
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResend = async () => {
        if (resendTimer > 0) return;
        setError("");
        setMessage("");
        setLoading(true);
        try {
            const res = await userApi.requestPasswordReset(identifier);
            setMessage(res?.message || "Đã gửi lại OTP.");
            setResendTimer(60);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Gửi lại thất bại");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: verify OTP
    const handleVerifyOtp = async (e) => {
        e?.preventDefault();
        setError("");
        setMessage("");
        if (!otp) {
            setError("Vui lòng nhập mã OTP.");
            return;
        }
        setLoading(true);
        try {
            // backend có thể trả resetToken
            const res = await userApi.verifyPasswordResetOtp({ identifier, otp });
            setMessage(res?.message || "Xác thực OTP thành công.");
            if (res?.resetToken) sessionStorage.setItem("resetToken", res.resetToken);
            setStep(3);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Xác thực OTP thất bại");
        } finally {
            setLoading(false);
        }
    };

    // Step 3: reset password
    const handleResetPassword = async (e) => {
        e?.preventDefault();
        setError("");
        setMessage("");

        if (!newPassword || !confirmPassword) {
            setError("Vui lòng nhập mật khẩu mới và xác nhận.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Mật khẩu xác nhận không khớp.");
            return;
        }
        const check = pwdCheck(newPassword);
        if (!check.ok) {
            setError(`Mật khẩu không hợp lệ: ${check.msg}`);
            return;
        }

        setLoading(true);
        try {
            const resetToken = sessionStorage.getItem("resetToken");
            const payload = resetToken ? { resetToken, newPassword } : { identifier, otp, newPassword };
            const res = await userApi.resetPassword(payload);
            setMessage(res?.message || "Đặt lại mật khẩu thành công. Chuyển về trang đăng nhập...");
            sessionStorage.removeItem("resetToken");
            setTimeout(() => navigate("/login"), 1400);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Đặt lại mật khẩu thất bại");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-green-50 p-6">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-1 text-center">Quên mật khẩu</h2>
                <p className="text-sm text-gray-500 mb-4 text-center">
                    Nhập email hoặc số điện thoại để nhận mã xác thực.
                </p>

                {message && <div className="bg-green-50 border border-green-100 text-green-700 p-2 rounded mb-4 text-sm">{message}</div>}
                {error && <div className="bg-red-50 border border-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}

                {step === 1 && (
                    <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
                        <InputField
                            label="Email hoặc số điện thoại"
                            name="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className="rounded-lg"
                        />
                        <div className="flex gap-3">
                            <Button type="submit" className={`flex-1 ${loading ? "opacity-70 cursor-not-allowed" : ""}`} disabled={loading}>
                                {loading ? "Đang gửi..." : "Gửi mã OTP"}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => navigate("/login")}>Quay lại</Button>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                        <InputField label="Mã OTP" name="otp" value={otp} onChange={(e) => setOtp(e.target.value)} className="rounded-lg" />
                        <div className="flex gap-3">
                            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Đang xác thực..." : "Xác thực OTP"}</Button>
                            <Button type="button" variant="ghost" onClick={handleResend} disabled={resendTimer > 0}>{resendTimer > 0 ? `Gửi lại (${resendTimer}s)` : "Gửi lại"}</Button>
                        </div>
                        <div className="text-center mt-2">
                            <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-600 hover:underline">Thay đổi email/số điện thoại</button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                        <InputField label="Mật khẩu mới" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-lg" />
                        <InputField label="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-lg" />
                        <div className="flex gap-3">
                            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}</Button>
                            <Button type="button" variant="ghost" onClick={() => setStep(2)}>Quay lại OTP</Button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Mật khẩu tối thiểu 8 ký tự, có chữ hoa và số.</p>
                    </form>
                )}

                <p className="text-xs text-center text-gray-400 mt-6">Nếu không nhận OTP, kiểm tra thư mục Spam hoặc liên hệ quản trị viên.</p>
            </div>
        </div>
    );
}
