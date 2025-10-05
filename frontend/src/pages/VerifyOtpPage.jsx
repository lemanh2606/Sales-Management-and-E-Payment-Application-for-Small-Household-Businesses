import React, { useEffect, useState } from "react";
import InputField from "../components/InputField";
import Button from "../components/Button";
import { verifyOtp, registerManager } from "../api/userApi";
import { useLocation, useNavigate } from "react-router-dom";

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || "";

  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [timer, setTimer] = useState(60 * Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5));

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await verifyOtp({ email, otp });
      setSuccess(res.message || "Xác thực thành công");
      setTimeout(() => navigate("/login"), 1400);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Lỗi server");
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      // Chúng tôi sử dụng lại điểm cuối register để gửi lại OTP: tạo người dùng phải thất bại nếu tồn tại,
      // vì vậy để gửi lại, bạn có thể cần một điểm cuối chuyên dụng. Một cách tiếp cận đơn giản là
      // chỉ gọi register một lần nữa nếu máy chủ hỗ trợ gửi lại; nếu không, hãy triển khai điểm cuối resend ở phía sau.
      // Ở đây, chúng tôi gọi một điểm cuối giả định /resend-otp. Nếu phía sau không có, hãy xóa điểm cuối này.
      await registerManager({ username: "resend", email, password: "temporary123!", phone: "" });
      setTimer(60 * Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5));
    } catch (err) {
      setError(err?.response?.data?.message || "Không thể gửi lại OTP");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500">
        <h2 className="text-2xl font-bold text-green-600 mb-4 text-center">Xác thực OTP</h2>

        <p className="text-gray-600 mb-3">
          OTP đã gửi tới: <b>{email}</b>
        </p>
        <p className="text-gray-500 mb-4">
          Hết hạn sau: <span className="font-mono">{formatTime(timer)}</span>
        </p>

        {error && <p className="text-red-500 mb-2">{error}</p>}
        {success && <p className="text-green-600 mb-2">{success}</p>}

        <form onSubmit={handleVerify}>
          <InputField label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <InputField
            label="OTP"
            name="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Nhập mã 6 chữ số"
          />
          <Button type="submit" className="w-full mt-3">
            Xác nhận
          </Button>
        </form>

        <div className="mt-4 flex justify-between items-center text-sm">
          <button
            onClick={handleResend}
            disabled={timer > 0}
            className="text-green-600 hover:underline disabled:text-gray-300"
          >
            Gửi lại OTP
          </button>
          <span className="text-gray-400">Bạn có thể yêu cầu lại sau {formatTime(timer)}</span>
        </div>
      </div>
    </div>
  );
}
