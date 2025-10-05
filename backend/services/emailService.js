// services/emailService.js
const nodemailer = require("nodemailer");

/**
 * Gửi OTP xác thực đến email người dùng
 * @param {string} to - địa chỉ email người nhận
 * @param {string} username - tên người dùng để chào trong nội dung
 * @param {string} otp - mã OTP (chuỗi)
 * @param {number} expireMinutes - thời gian hiệu lực OTP (phút)
 */

/* -------------------------
   Cấu hình gửi email (Nodemailer)
   ------------------------- */
/**
 * Lưu ý: nếu dùng Gmail, bắt buộc tạo App Password (khi bật 2FA) và dùng ở EMAIL_PASS.
 * Đừng dùng mật khẩu Gmail trực tiếp nếu chưa bật 2FA.
 */
async function sendVerificationEmail(to, username, otp, expireMinutes = 5) {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

   const mailOptions = {
    from: `"SmartRetail System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Mã OTP xác thực tài khoản của bạn",
    html: `
      <div style="font-family: sans-serif; color: #333;">
        <p>Xin chào <b>${username}</b>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản SmartRetail.</p>
        <p>Mã OTP của bạn là:</p>
        <h2 style="color:#007bff; letter-spacing: 2px;">${otp}</h2>
        <p>Mã có hiệu lực trong ${expireMinutes} phút.</p>
        <p>Nếu bạn không yêu cầu đăng ký này, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };