import React, { useEffect, useState } from "react";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import { verifyOtp } from "../../api/userApi";
import { registerManager } from "../../api/userApi";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2"; // ✅ import sweetalert2




export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state?.email || "";

  const [email, setEmail] = useState(emailFromState);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60 * Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5));
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const res = await verifyOtp({ email, otp });

      await Swal.fire({
        title: " Xác thực thành công!",
        text: res.message || "Tài khoản của bạn đã được xác thực. Hãy đăng nhập để tiếp tục.",
        icon: "success",
        confirmButtonText: "Đi đến đăng nhập",
        confirmButtonColor: "#16a34a",
        timer: 2500,
      });

      navigate("/login");
    } catch (err) {
      Swal.fire({
        title: " Lỗi xác thực!",
        text: err?.response?.data?.message || err?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.",
        icon: "error",
        confirmButtonText: "Thử lại",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      await registerManager({ username: "resend", email, password: "temporary123!", phone: "" });

      Swal.fire({
        title: "📨 Đã gửi lại OTP!",
        text: `Mã OTP mới đã được gửi đến ${email}.`,
        icon: "info",
        confirmButtonText: "Xác nhận",
        confirmButtonColor: "#16a34a",
        timer: 2000,
      });

      setTimer(60 * Number(import.meta.env.VITE_OTP_EXPIRE_MINUTES || 5));
    } catch (err) {
      Swal.fire({
        title: " Không thể gửi lại OTP!",
        text: err?.response?.data?.message || "Đã xảy ra lỗi khi gửi lại mã OTP.",
        icon: "error",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border-t-4 border-green-500">
        <h2 className="text-2xl font-bold text-green-600 mb-4 text-center">Xác thực OTP</h2>

        <p className="text-gray-600 mb-3">
          OTP đã gửi tới email: <b>{email}</b>
        </p>
        <p className="text-gray-500 mb-4">
          Hết hạn sau: <span className="font-mono text-blue-500">{formatTime(timer)}</span>
        </p>

        <form onSubmit={handleVerify}>
          <InputField
            label="Email"
            name="email"
            value={email}
            disabled
            readOnnly
            className="bg-gray-100 cursor-not-allowed"
          />
          <InputField
            label="OTP"
            name="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Nhập mã 6 chữ số"
          />
          <Button type="submit" className="w-full mt-3" disabled={isVerifying}>
            {isVerifying ? "Đang xác thực..." : "Xác nhận"}
          </Button>
        </form>

        <div className="mt-4 flex justify-between items-center text-sm">
          <button
            onClick={handleResend}
            disabled={timer > 0}
            className="text-green-600 hover:underline disabled:text-gray-300"
          >
            Gửi lại mã OTP
          </button>
          <span className="text-gray-400">
            Bạn có thể yêu cầu lại sau <span className="font-mono text-blue-500">{formatTime(timer)}</span>
          </span>
        </div>
        <small className="block mt-4 text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md text-center border border-yellow-200 italic">
          Nếu không nhận được mã OTP, vui lòng kiểm tra lại địa chỉ email hoặc hộp thư <b>Spam/Junk</b>.
          <br />
          <span className="not-italic text-gray-600">
            Nhập sai email?{" "}
            <button onClick={() => navigate("/register")} className="text-green-600 font-medium hover:underline">
              Đăng ký lại
            </button>
          </span>
        </small>
      </div>
    </div>
  );
}
