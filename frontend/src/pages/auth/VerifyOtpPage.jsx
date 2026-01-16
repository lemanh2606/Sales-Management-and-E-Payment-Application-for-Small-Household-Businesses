// src/pages/VerifyOtpPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { userApi } from "../../api/index";

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || "";

  // form state
  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState("");
  const otpExpireMinutes = Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5);
  const [timer, setTimer] = useState(60 * otpExpireMinutes);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    // if email provided from state and it's empty timer won't run; keep it as default.
    // You may want to start timer only after first send; here we assume OTP was sent before arriving.
    // If you prefer to start timer only after clicking "Gửi lại", change logic accordingly.
  }, []);

  const formatTime = (sec) => {
    if (!sec || sec <= 0) return "00:00";
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    setIsVerifying(true);
    try {
      if (!email) throw new Error("Email trống");
      if (!otp) throw new Error("Vui lòng nhập mã OTP");

      const payload = { email: email.trim(), otp: otp.trim() };
      const res = await userApi.verifyOtp(payload);

      await Swal.fire({
        title: "Xác thực thành công",
        text: res?.message || "Tài khoản đã được xác thực. Vui lòng đăng nhập.",
        icon: "success",
        confirmButtonText: "Đăng nhập",
        confirmButtonColor: "#16a34a",
        timer: 2000,
      });

      navigate("/login");
    } catch (err) {
      console.error("verifyOtp error", err);
      Swal.fire({
        title: "Lỗi xác thực",
        text: err?.response?.data?.message || err?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return; // chưa đến lượt gửi lại
    if (!email) {
      Swal.fire({
        title: "Thiếu email",
        text: "Vui lòng nhập / kiểm tra email trước khi gửi lại mã OTP.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    setIsResending(true);
    try {
      // Prefer explicit resend API if available
      if (typeof userApi.resendRegisterOtp === "function") {
        await userApi.resendRegisterOtp({ email: email.trim() });
      } else {
        // fallback: call registerManager as last resort (backend may reject duplicate users)
        // NOTE: better to implement a dedicated resend endpoint on backend.
        await userApi.registerManager({
          username: `resend_${Date.now()}`, // dummy username to provoke OTP send only if backend supports
          email: email.trim(),
          password: "temporary!A1", // dummy - backend SHOULD treat this path specially or provide dedicated endpoint
        });
      }

      await Swal.fire({
        title: "Đã gửi lại OTP",
        text: `Mã OTP đã được gửi tới ${email}. Kiểm tra hộp thư (hoặc thư mục Spam).`,
        icon: "info",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
        timer: 1600,
      });

      // reset timer
      setTimer(60 * otpExpireMinutes);
    } catch (err) {
      console.error("resend error", err);
      Swal.fire({
        title: "Không thể gửi lại OTP",
        text: err?.response?.data?.message || err?.message || "Đã xảy ra lỗi khi gửi lại mã OTP.",
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center p-6"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1600&q=80')",
      }}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md p-6 md:p-10 bg-white/95 rounded-3xl shadow-2xl border border-gray-100">
        <div className="text-center mb-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">Xác thực tài khoản</h2>
          <p className="text-sm text-gray-500 mt-1">
            Nhập mã OTP được gửi tới email để hoàn tất đăng ký.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <InputField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            name="email"
            placeholder="your@email.com"
            className="bg-gray-50 rounded-lg"
          // allow editing email in case user wants to correct
          />

          <InputField
            label="Mã OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            name="otp"
            placeholder="Nhập mã 6 chữ số"
            className="bg-gray-50 rounded-lg"
          />

          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="text-xs text-gray-500">Hết hạn sau</span>
              <div className="font-mono text-gray-800 text-lg">{formatTime(timer)}</div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-2"
                onClick={() => {
                  // small convenience: go back to register to change email
                  navigate("/register", { state: { email } });
                }}
              >
                Chỉnh email
              </Button>

              <Button
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || isResending}
                className={`px-3 py-2 ${timer > 0 ? "opacity-60 cursor-not-allowed" : ""}`}
                aria-disabled={timer > 0}
              >
                {isResending ? "Đang gửi..." : timer > 0 ? "Chờ gửi lại" : "Gửi lại mã OTP"}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isVerifying}>
            {isVerifying ? "Đang xác thực..." : "Xác nhận"}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500">
          Nếu không nhận được email, kiểm tra thư mục <span className="italic">Spam/Junk</span> hoặc thử gửi lại.
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            onClick={() => navigate("/login")}
            className="text-gray-600 hover:underline"
          >
            Quay lại đăng nhập
          </button>
          <span className="text-gray-400">© 2025 Smallbiz-Sales</span>
        </div>
      </div>

      <style>{`
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: floatIn 0.5s ease-out; }
      `}</style>
    </div>
  );
}
