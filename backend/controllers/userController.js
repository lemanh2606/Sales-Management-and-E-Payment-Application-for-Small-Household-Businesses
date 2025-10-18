// controllers/userController.js (fix changePassword: thêm confirmPassword check khớp, fix compareString scope - paste thay file)
const User = require("../models/User");
const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail } = require("../services/emailService");

const IS_PROD = process.env.NODE_ENV === "production";

/* ------------------------- 
   Cấu hình / hằng số (.env)
   ------------------------- */
// Số chữ số OTP, mặc định 6
const OTP_LENGTH = 6;
// Thời gian hiệu lực OTP (phút)
const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 5);
// Số lần thử tối đa cho OTP
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

// Số lần login sai tối đa trước khi khóa tạm
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
// Thời gian khóa tạm (phút)
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);

// Số vòng salt bcrypt
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

// Thời hạn token
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES || "2d";
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || `${process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7}d`;

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
const hashString = async (str) => {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return await bcrypt.hash(str, salt);
};

/**
 * So sánh chuỗi với hash (password hoặc OTP).
 * Trả về true nếu khớp.
 */
const compareString = async (str, hash) => await bcrypt.compare(str, hash);

/**
 * Tạo access token (JWT với id, role).
 * Thời hạn từ ACCESS_TOKEN_EXPIRES.
 */
const signAccessToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET || "default_jwt_secret_change_in_env", { expiresIn: ACCESS_TOKEN_EXPIRES });

/**
 * Tạo refresh token (JWT với id, role).
 * Thời hạn từ REFRESH_TOKEN_EXPIRES.
 */
const signRefreshToken = (payload) => jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

/* ------------------------- 
   Controller: registerManager (đăng ký manager với OTP email)
   - Tạo user MANAGER, hash pass, sinh OTP hash, gửi email, set isVerified = false
   ------------------------- */
const registerManager = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Thiếu username, email hoặc password" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password phải ít nhất 6 ký tự" });
    }

    // Kiểm tra unique username/email
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "Username hoặc email đã tồn tại" });
    }

    // Hash password
    const password_hash = await hashString(password);

    // Sinh OTP và hash
    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Tạo user MANAGER
    const newUser = new User({
      username: username.trim(),
      password_hash,
      role: "MANAGER",
      email: email.toLowerCase().trim(),
      otp_hash,
      otp_expires,
      otp_attempts: 0,
      isVerified: false,
    });

    await newUser.save();

    // Gửi email OTP
    await sendVerificationEmail(email, username, otp);

    res.status(201).json({ message: "Đăng ký thành công, kiểm tra email để xác minh OTP" });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server khi đăng ký" });
  }
};

/* ------------------------- 
   Controller: verifyOtp (xác minh OTP cho register/change pass)
   - So sánh OTP với hash, check expiry/attempts, nếu OK set isVerified = true hoặc change pass
   ------------------------- */
const verifyOtp = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Thiếu email hoặc OTP" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.otp_hash === null || user.otp_expires < new Date()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(400).json({ message: "Quá số lần thử, vui lòng yêu cầu OTP mới" });
    }

    if (!(await compareString(otp, user.otp_hash))) {
      user.otp_attempts += 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng, thử lại" });
    }

    // OTP OK, reset OTP fields
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    user.isVerified = true;
    await user.save();

    res.json({ message: "Xác minh thành công" });
  } catch (err) {
    console.error("Lỗi xác minh OTP:", err.message);
    res.status(500).json({ message: "Lỗi server khi xác minh OTP" });
  }
};

/* ------------------------- 
   Controller: login (đăng nhập với pass, check verified/lock, token)
   ------------------------- */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: "Username hoặc password không đúng" });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: "Tài khoản chưa được xác minh" });
    }

    // Kiểm tra lock
    if (user.lockUntil > new Date()) {
      return res.status(423).json({ message: "Tài khoản bị khóa tạm thời" });
    }

    if (!(await compareString(password, user.password_hash))) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ message: "Username hoặc password không đúng" });
    }

    // Login success, reset counters, update last_login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.last_login = new Date();
    await user.save();

    // Tạo access token (JWT với id, role)
    const accessToken = signAccessToken({ id: user._id, role: user.role });
    // Tạo refresh token (JWT với id, role)
    const refreshToken = signRefreshToken({ id: user._id, role: user.role });

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "Lax",
      maxAge: (() => {
        const days = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7);
        return days * 24 * 60 * 60 * 1000;
      })(),
      path: "/",
    };

    // Set cookie refreshToken
    res.cookie("refreshToken", refreshToken, cookieOptions);

    // Trả access token và info user
    res.json({
      message: "Đăng nhập thành công",
      token: accessToken, // FE dùng header Authorization: Bearer <token>
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

/* ------------------------- 
   Controller: refreshToken (tùy chọn)
   - Đọc cookie refreshToken, verify, tạo access token mới
   ------------------------- */
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Refresh token invalid or expired" });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "User not found" });

    const newAccess = signAccessToken({ id: user._id, role: user.role });
    res.json({ token: newAccess });
  } catch (err) {
    console.error("Lỗi refresh token:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

/* ------------------------- 
   Controller: updateProfile (thay đổi thông tin cá nhân – username, email, phone, fullName nếu STAFF)
   - Chỉ update chính user, unique username/email, update Employee nếu role STAFF
   ------------------------- */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;  // Từ middleware verifyToken
    const { username, email, phone, fullName } = req.body; 

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    // Validate unique username/email nếu thay đổi
    const query = {};
    if (username && username.trim() !== user.username) {
      query.username = username.trim();
    }
    if (email && email.trim() !== user.email) {
      query.email = email.toLowerCase().trim();
    }
    if (Object.keys(query).length > 0) {
      const existing = await User.findOne(query);
      if (existing) {
        return res.status(400).json({ message: "Username hoặc email đã tồn tại" });
      }
    }

    // Update user fields
    if (username) user.username = username.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = phone.trim();

    await user.save();

    // Nếu role STAFF, update Employee fullName/phone (fullName optional nếu input)
    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (employee) {
        if (fullName) employee.fullName = fullName.trim();  // Thêm: fullName optional (nếu input, update Employee)
        if (phone !== undefined) employee.phone = phone.trim();  // Sync phone vào Employee (optional, default '')
        await employee.save();
      }
    }

    // Trả user updated (populate nếu cần)
    const updatedUser = await User.findById(userId).lean();
    res.json({ message: "Cập nhật thông tin thành công", user: updatedUser });
  } catch (err) {
    console.error("Lỗi cập nhật profile:", err.message);
    res.status(500).json({ message: "Lỗi server khi cập nhật profile" });
  }
};

/* ------------------------- 
   Controller: sendPasswordOTP (gửi OTP đổi pass – chỉ nếu email có)
   - Sinh OTP, hash, gửi email, set expiry/attempts
   ------------------------- */
const sendPasswordOTP = async (req, res) => {
  try {
    const userId = req.user.id;  // Từ middleware verifyToken
    const { email } = req.body;  // Email (optional, dùng email user nếu ko input)

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    const useEmail = email || user.email;
    if (!useEmail) {
      return res.status(400).json({ message: "Cần email để gửi OTP đổi mật khẩu, cập nhật profile trước" });
    }

    // Sinh OTP và hash
    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Lưu OTP vào user (reset nếu có cũ)
    user.otp_hash = otp_hash;
    user.otp_expires = otp_expires;
    user.otp_attempts = 0;
    await user.save();

    // Gửi email OTP (đúng tham số, thêm type "change-password" customize)
    await sendVerificationEmail(useEmail, user.username, otp, OTP_EXPIRE_MINUTES, "change-password");

    res.json({ message: "OTP đổi mật khẩu đã gửi đến email, hết hạn sau 5 phút" });
  } catch (err) {
    console.error("Lỗi gửi OTP đổi mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi gửi OTP" });
  }
};

/* ------------------------- 
   Controller: changePassword (xác minh OTP + đổi pass mới)
   - So sánh OTP, nếu OK hash password mới, reset OTP
   ------------------------- */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;  // Từ middleware verifyToken
    const { password, confirmPassword, otp } = req.body;  // Password mới + confirmPassword + OTP

    if (!password || !confirmPassword || !otp) {
      return res.status(400).json({ message: "Thiếu mật khẩu mới, xác nhận mật khẩu hoặc OTP" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải ít nhất 6 ký tự" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu mới và xác nhận không khớp" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    if (user.otp_hash === null || user.otp_expires < new Date()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(400).json({ message: "Quá số lần thử, vui lòng gửi OTP mới" });
    }

    if (!(await compareString(otp, user.otp_hash))) {
      user.otp_attempts += 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng, thử lại" });
    }

    // OTP OK, hash password mới, reset OTP
    const password_hash = await hashString(password);
    user.password_hash = password_hash;
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
  }
};

module.exports = { registerManager, verifyOtp, login, refreshToken, updateProfile, sendPasswordOTP, changePassword };