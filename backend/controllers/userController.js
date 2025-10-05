// controllers/userController.js

/**
 * Controller quản lý người dùng (đăng ký, xác thực OTP, đăng nhập, refresh token)
 *
 * Cơ chế chính:
 * - Khi register: tạo user (chưa verified), sinh OTP ngẫu nhiên, hash OTP và lưu vào DB,
 *   gửi OTP qua email (không trả OTP cho client).
 * - Khi verifyOtp: so sánh OTP (so sánh hash), kiểm tra expiry và số lần thử, nếu OK -> set isVerified = true.
 * - Khi login: kiểm tra verified, kiểm tra lock (nếu login sai nhiều lần), so khớp password, cấp access token và refresh token.
 * - Refresh token được lưu trong cookie HttpOnly (dành cho web).
 *
 * Mục tiêu bảo mật:
 * - Không trả OTP thô cho client.
 * - Lưu otp_hash thay vì otp thô.
 * - Giới hạn số lần thử OTP và login (brute-force protection).
 * - Sử dụng bcrypt để hash (password + OTP hash).
 * - Sử dụng access token + refresh token; refresh token đặt trong cookie HttpOnly.
 */

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const IS_PROD = process.env.NODE_ENV === "production";

/* -------------------------
   Cấu hình / hằng số (tùy chỉnh qua .env)
   ------------------------- */
// Số chữ số OTP, mặc định 6
const OTP_LENGTH = 6;
// Thời gian hiệu lực OTP (phút). Lấy từ .env nếu có
const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 5);
// Số lần thử tối đa cho OTP (sai quá sẽ yêu cầu gửi lại)
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

// Số lần login sai tối đa trước khi khóa tạm
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
// Thời gian khóa tạm (phút) nếu vượt quá login attempts
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);

// Số vòng salt bcrypt
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// Thời hạn token: ưu tiên JWT_EXPIRES (được dùng như access token), fallback hoặc định nghĩa ACCESS_TOKEN_EXPIRES
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES || process.env.ACCESS_TOKEN_EXPIRES || "2d";
// Thời hạn refresh token (chuỗi '7d' hoặc tương tự)
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || `${process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7}d`;

/* -------------------------
   Cấu hình gửi email (Nodemailer)
   ------------------------- */
/**
 * Lưu ý: nếu dùng Gmail, bắt buộc tạo App Password (khi bật 2FA) và dùng ở EMAIL_PASS.
 * Đừng dùng mật khẩu Gmail trực tiếp nếu chưa bật 2FA.
 */
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS || "", // PHẢI cấu hình trong .env
  },
});

/* -------------------------
   Helper functions
   ------------------------- */

/**
 * Sinh OTP ngẫu nhiên có `len` chữ số (mặc định 6).
 * Trả về chuỗi (string) để dễ hash và so sánh.
 */
const generateOTP = (len = OTP_LENGTH) =>
  Math.floor(Math.pow(10, len - 1) + Math.random() * 9 * Math.pow(10, len - 1)).toString();

/**
 * Hash một chuỗi (password hoặc OTP) bằng bcrypt.
 * Trả về hash (string).
 */
const hashString = async (plain) => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(plain, salt);
};

/**
 * So sánh plain text với hash (bcrypt.compare).
 * Trả về boolean.
 */
const compareHash = async (plain, hash) => bcrypt.compare(plain, hash);

/**
 * Tạo access token (JWT) với payload, sử dụng secret từ .env (JWT_SECRET).
 * Access token dùng để authorize API, có thời hạn ngắn.
 */
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

/**
 * Tạo refresh token (JWT) — có thời hạn dài hơn và lưu ở cookie HttpOnly cho web.
 * Refresh token dùng để cấp lại access token khi access hết hạn.
 */
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

/* -------------------------
   Controller: registerManager
   - Tạo user chưa verified
   - Sinh OTP, hash và lưu vào user
   - Gửi OTP qua email
   - KHÔNG trả OTP cho client
   ------------------------- */
exports.registerManager = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email và password bắt buộc" });
    }

    // Chuẩn hoá email: trim + lowercase
    const emailNorm = String(email).trim().toLowerCase();

    // Kiểm tra username/email đã tồn tại chưa
    const existUser = await User.findOne({ $or: [{ username }, { email: emailNorm }] });
    if (existUser) {
      // Trả lỗi 400 để client biết cần đổi username/email
      return res.status(400).json({ message: "Username hoặc email đã tồn tại" });
    }

    // Chính sách password cơ bản: yêu cầu >= 8 ký tự (bạn có thể nâng cấp)
    if (password.length < 8) {
      return res.status(400).json({ message: "Password phải có ít nhất 8 ký tự" });
    }

    // Hash password để lưu vào DB (bcrypt)
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Sinh OTP và hash OTP trước khi lưu (lưu hash để an toàn)
    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    // Tính thời hạn OTP (timestamp ms)
    const otp_expires = Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000;

    // Tạo document user mới (chưa kích hoạt)
    const newUser = new User({
      username,
      email: emailNorm,
      phone: phone || null,
      password_hash,
      role: "MANAGER",
      isVerified: false,    // mặc định chưa verified
      otp_hash,             // lưu hash của OTP
      otp_expires,          // thời hạn OTP
      otp_attempts: 0,      // số lần thử OTP hiện tại
      loginAttempts: 0,     // số lần login sai hiện tại
      lockUntil: null,      // nếu account bị khóa tạm thời
    });

    // Lưu user vào DB
    await newUser.save();

    // Gửi email chứa OTP cho user (nếu gửi mail lỗi, rollback user vừa tạo để tránh tài khoản "dead")
    try {
      await transporter.sendMail({
        from: `"Smallbiz-Sales" <${process.env.EMAIL_USER}>`,
        to: emailNorm,
        subject: "Smallbiz-Sales - Mã OTP xác nhận email",
        html: `
          <div>
            <p>Xin chào <b>${username}</b>,</p>
            <p>Mã OTP xác nhận đăng ký của bạn là:</p>
            <h2 style="color:green">${otp}</h2>
            <p>Mã có hiệu lực trong ${OTP_EXPIRE_MINUTES} phút.</p>
            <p>Nếu bạn không yêu cầu mã này, hãy bỏ qua email này.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      // Nếu gửi mail thất bại, xóa user vừa tạo để tránh có user không thể active.
      console.error("Mail send error:", mailErr);
      await User.deleteOne({ _id: newUser._id }).catch((e) => console.error("Rollback delete failed:", e));
      return res.status(500).json({ message: "Không thể gửi OTP tới email. Vui lòng thử lại sau." });
    }

    // Trả response cho client: KHÔNG bao gồm OTP hoặc otp_hash.
    // Client sẽ hiển thị form nhập OTP (client gửi email + otp để verify).
    return res.status(201).json({
      message: "Đăng ký thành công. Mã OTP đã được gửi tới email của bạn.",
      user: { id: newUser._id, username: newUser.username, email: newUser.email },
    });
  } catch (err) {
    console.error("registerManager error:", err);
    // Trả lỗi tổng quát để tránh lộ thông tin nhạy cảm
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/* -------------------------
   Controller: verifyOtp
   - Nhận email + otp từ client
   - Tìm user, kiểm tra expiry, số lần thử
   - So sánh otp (so sánh hash bằng bcrypt.compare)
   - Nếu đúng => set isVerified = true, xóa otp_hash, reset attempts
   ------------------------- */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email và OTP bắt buộc" });

    const emailNorm = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: emailNorm });
    if (!user) return res.status(400).json({ message: "User không tồn tại" });

    // Nếu đã verified trước đó thì báo cho client
    if (user.isVerified) return res.status(400).json({ message: "Tài khoản đã được xác thực" });

    // Kiểm tra OTP có tồn tại và chưa hết hạn
    if (!user.otp_expires || Date.now() > new Date(user.otp_expires).getTime()) {
      return res.status(400).json({ message: "OTP đã hết hạn. Vui lòng yêu cầu gửi lại hoặc đăng ký lại." });
    }

    // Kiểm tra số lần thử để chống brute-force
    if ((user.otp_attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Quá nhiều lần thử OTP. Vui lòng yêu cầu gửi lại sau." });
    }

    // So sánh OTP (plain) với otp_hash trong DB
    const isMatch = await compareHash(otp, user.otp_hash || "");
    if (!isMatch) {
      // Nếu sai, tăng counter otp_attempts và lưu
      user.otp_attempts = (user.otp_attempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng" });
    }

    // Nếu đúng: đánh dấu verified, xoá otp fields để không thể reuse
    user.isVerified = true;
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    await user.save();

    return res.json({ message: "Xác thực OTP thành công, tài khoản đã được kích hoạt." });
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/* -------------------------
   Controller: login
   - Nhận username + password
   - Kiểm tra user tồn tại, chưa bị khóa, đã verified
   - So khớp password, nếu sai tăng loginAttempts; nếu vượt threshold thì lockUntil
   - Nếu đúng: reset attempts, cập nhật last_login, cấp access + refresh token
   - Refresh token set vào cookie HttpOnly (để client web không thể đọc JS)
   ------------------------- */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Username và password bắt buộc" });

    // Tìm user theo username
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Sai username hoặc password" });

    // Kiểm tra xem tài khoản có đang bị khóa tạm thời (lockUntil)
    if (user.lockUntil && Date.now() < new Date(user.lockUntil).getTime()) {
      const waitSec = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 1000);
      // 423 Locked: resource is locked
      return res.status(423).json({ message: `Tài khoản bị khoá tạm thời. Thử lại sau ${waitSec} giây.` });
    }

    // Kiểm tra tài khoản đã xác thực email chưa
    if (!user.isVerified) return res.status(403).json({ message: "Vui lòng xác thực email (OTP) trước khi đăng nhập" });

    // So sánh mật khẩu (bcrypt.compare)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Nếu sai, tăng loginAttempts; nếu vượt LOGIN_MAX_ATTEMPTS, set lockUntil
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        user.lockUntil = Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000; // khoá tạm
      }
      await user.save();
      return res.status(400).json({ message: "Sai username hoặc password" });
    }

    // Nếu login thành công: reset counters, cập nhật last_login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.last_login = new Date();
    await user.save();

    // Tạo access token (dùng để authorize các request protected)
    const accessToken = signAccessToken({ id: user._id, role: user.role });
    // Tạo refresh token (lưu vào cookie HttpOnly)
    const refreshToken = signRefreshToken({ id: user._id, role: user.role });

    // Tùy chọn cookie: httpOnly để JS client không thể đọc; secure chỉ dùng trên HTTPS/production
    const cookieOptions = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "Lax",
      maxAge: (() => {
        // Sử dụng biến REFRESH_TOKEN_EXPIRES_DAYS nếu có, mặc định 7 ngày
        const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);
        return days * 24 * 60 * 60 * 1000;
      })(),
      path: "/",
    };

    // Gửi cookie refreshToken cho client (trình duyệt sẽ lưu cookie)
    // Lưu ý: nếu frontend là SPA trên domain khác, cần cors credentials và axios withCredentials để gửi cookie
    res.cookie("refreshToken", refreshToken, cookieOptions);

    // Trả access token và thông tin user (không trả refresh token trong body)
    return res.json({
      message: "Đăng nhập thành công",
      token: accessToken, // client dùng header Authorization: Bearer <token>
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/* -------------------------
   Controller: refreshToken (tùy chọn)
   - Đọc cookie refreshToken từ req.cookies (cần cookie-parser)
   - Nếu hợp lệ, cấp access token mới
   - Nếu không hợp lệ, trả 401
   ------------------------- */
exports.refreshToken = async (req, res) => {
  try {
    // Lấy refresh token từ cookie (yêu cầu dùng cookie-parser middleware)
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    let payload;
    try {
      // Verify refresh token (sử dụng REFRESH_TOKEN_SECRET hoặc JWT_SECRET fallback)
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Refresh token invalid or expired" });
    }

    // Kiểm tra user còn tồn tại
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    // Tạo access token mới
    const newAccess = signAccessToken({ id: user._id, role: user.role });
    return res.json({ token: newAccess });
  } catch (err) {
    console.error("refreshToken error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
