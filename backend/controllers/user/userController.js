// controllers/userController.js
// (bản đã chỉnh sửa: dùng Cloudinary cho avatar profile, bỏ ImgBBService trong updateProfile)

const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Subscription = require("../../models/Subscription");
const logActivity = require("../../utils/logActivity");
const ActivityLog = require("../../models/ActivityLog");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { sendVerificationEmail } = require("../../services/emailService");
const {
  ALL_PERMISSIONS,
  STAFF_DEFAULT_MENU,
} = require("../../config/constants/permissions");

// ✅ Dùng Cloudinary thay cho ImgBB cho avatar profile
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinary");

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
const REFRESH_TOKEN_EXPIRES =
  process.env.REFRESH_TOKEN_EXPIRES ||
  `${process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7}d`;

/* -------------------------
   Helper functions
   ------------------------- */

/**
 * Sinh OTP ngẫu nhiên có `len` chữ số (mặc định 6).
 * Trả về chuỗi (string) để dễ hash và so sánh.
 */
const generateOTP = (len = OTP_LENGTH) =>
  Math.floor(
    Math.pow(10, len - 1) + Math.random() * 9 * Math.pow(10, len - 1)
  ).toString();

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
const signAccessToken = (payload) =>
  jwt.sign(
    payload,
    process.env.JWT_SECRET || "default_jwt_secret_change_in_env",
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );

/**
 * Tạo refresh token (JWT với id, role).
 * Thời hạn từ REFRESH_TOKEN_EXPIRES.
 */
const signRefreshToken = (payload) =>
  jwt.sign(
    payload,
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

/* -------------------------
   Controller: registerManager
   ------------------------- */
const registerManager = async (req, res) => {
  try {
    const { username, email, password, fullname } = req.body;

    // ===== VALIDATE INPUT (CHUẨN TEST CASE) =====
    if (
      !username?.trim() ||
      !email?.trim() ||
      !password?.trim() ||
      !fullname?.trim()
    ) {
      return res.status(400).json({
        message: "Thiếu username, email, fullname hoặc password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password phải ít nhất 6 ký tự",
      });
    }

    // ===== CHECK UNIQUE USERNAME / EMAIL =====
    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.toLowerCase().trim() },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email hoặc username đã tồn tại",
      });
    }

    // ===== HASH PASSWORD =====
    const password_hash = await hashString(password);

    // ===== OTP =====
    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // ===== CREATE USER =====
    const newUser = new User({
      username: username.trim(),
      fullname: fullname.trim(),
      password_hash,
      role: "MANAGER",
      email: email.toLowerCase().trim(),
      otp_hash,
      otp_expires,
      otp_attempts: 0,
      isVerified: false,
      menu: ALL_PERMISSIONS,
    });

    await newUser.save();

    // ===== CREATE TRIAL =====
    try {
      await Subscription.createTrial(newUser._id);
    } catch (trialErr) {
      console.error("⚠️ Trial error:", trialErr.message);
    }

    // ===== SEND OTP EMAIL =====
    await sendVerificationEmail(email, username, otp);

    return res.status(201).json({
      message: "Đăng ký thành công, kiểm tra email để xác minh OTP",
    });
  } catch (err) {
    console.error("Lỗi đăng ký:", err.message);
    return res.status(500).json({
      message: "Lỗi server khi đăng ký",
    });
  }
};

/* -------------------------
   Controller: verifyOtp
   ------------------------- */
const verifyOtp = async (req, res) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Thiếu email hoặc OTP" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.otp_hash === null || user.otp_expires < new Date()) {
      return res
        .status(400)
        .json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      return res
        .status(400)
        .json({ message: "Quá số lần thử, vui lòng yêu cầu OTP mới" });
    }

    if (!(await compareString(otp, user.otp_hash))) {
      user.otp_attempts += 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng, thử lại" });
    }

    // OTP OK
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

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const identifier = username.trim();

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Username hoặc password không đúng" });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: "Tài khoản chưa được xác minh" });
    }

    // Kiểm tra lock
    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(423).json({ message: "Tài khoản bị khóa tạm thời" });
    }

    if (!(await compareString(password, user.password_hash))) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
      }
      await user.save();
      return res
        .status(401)
        .json({ message: "Username hoặc password không đúng" });
    }

    // ========== 👇 SYNC MENU - CẬP NHẬT VÀO DB 👇 ==========
    let menuUpdated = false;

    if (user.role === "MANAGER") {
      // MANAGER: Kiểm tra nếu thiếu quyền -> restore toàn bộ
      const missingPermissions = ALL_PERMISSIONS.filter(
        (perm) => !user.menu || !user.menu.includes(perm)
      );

      if (missingPermissions.length > 0) {
        console.log(
          `⚠️ MANAGER ${user.username}: thiếu ${missingPermissions.length}/${ALL_PERMISSIONS.length} quyền`
        );

        // Cập nhật đầy đủ quyền
        user.menu = [...ALL_PERMISSIONS];
        menuUpdated = true;

        console.log(`✅ Đã restore full menu cho MANAGER ${user.username}`);
      }
    } else if (user.role === "STAFF") {
      // STAFF: Chỉ bổ sung các quyền mặc định nếu thiếu, GIỮ NGUYÊN quyền thừa
      const currentMenu = user.menu || [];

      // Tìm các quyền mặc định bị thiếu
      const missingDefaultPermissions = STAFF_DEFAULT_MENU.filter(
        (perm) => !currentMenu.includes(perm)
      );

      if (missingDefaultPermissions.length > 0) {
        console.log(
          `⚠️ STAFF ${user.username}: thiếu ${missingDefaultPermissions.length}/${STAFF_DEFAULT_MENU.length} quyền mặc định`
        );
        console.log(`   Các quyền thiếu:`, missingDefaultPermissions);

        // Bổ sung thêm các quyền thiếu, GIỮ NGUYÊN quyền cũ
        user.menu = [
          ...new Set([...currentMenu, ...missingDefaultPermissions]),
        ];
        menuUpdated = true;

        console.log(
          `✅ Đã bổ sung ${missingDefaultPermissions.length} quyền cho STAFF ${user.username}`
        );
        console.log(
          `   Menu hiện tại có ${user.menu.length} quyền (bao gồm cả custom)`
        );
      }
    }
    // ========== 👆 END SYNC LOGIC 👆 ==========

    // Login success - cập nhật thông tin login
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.last_login = new Date();
    user.last_ip = req.ip || req.connection.remoteAddress;
    user.last_user_agent = req.headers["user-agent"] || "unknown";

    // Lưu vào database
    await user.save();

    if (menuUpdated) {
      console.log(
        `💾 Menu đã được lưu vào MongoDB cho ${user.role} ${user.username}`
      );
    }

    const accessToken = signAccessToken({ id: user._id, role: user.role });
    const refreshToken = signRefreshToken({ id: user._id, role: user.role });

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

    res.cookie("refreshToken", refreshToken, cookieOptions);

    res.json({
      message: "Đăng nhập thành công",
      token: accessToken,
      user: {
        id: user._id,
        username: user.username,
        fullname: user.fullname,
        image: user.image,
        role: user.role,
        email: user.email,
        phone: user.phone,
        isDeleted: user.isDeleted,
        isVerified: user.isVerified,
        menu: Array.isArray(user.menu) ? user.menu : [],
      },
      store: user.current_store || null,
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};
// ================== LOGOUT ==================
const logout = async (req, res) => {
  try {
    const user = req.user;

    const loginTime = user.last_login;
    const logoutTime = new Date();
    const duration = loginTime
      ? Math.round((logoutTime - loginTime) / 60000)
      : 0;

    user.last_logout = logoutTime;
    user.online_duration_today = (user.online_duration_today || 0) + duration;
    await user.save();

    await logActivity({
      req,
      action: "auth",
      entity: "User",
      entityId: user._id,
      entityName: user.username,
      description: `Đăng xuất sau ${duration} phút làm việc`,
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "Lax",
      path: "/",
    });

    res.json({ success: true, message: "Đăng xuất thành công" });
  } catch (err) {
    console.error("Lỗi logout:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/* -------------------------
   OTP quên mật khẩu, resend OTP, đổi mật khẩu quên
   ------------------------- */

const sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Email không tồn tại trong hệ thống" });
    }

    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    user.otp_hash = otp_hash;
    user.otp_expires = otp_expires;
    user.otp_attempts = 0;
    await user.save();

    await sendVerificationEmail(
      user.email,
      user.username,
      otp,
      OTP_EXPIRE_MINUTES,
      "forgot-password"
    );

    res.json({ message: "OTP đã gửi tới email, hết hạn sau 5 phút" });
  } catch (err) {
    console.error("Lỗi gửi OTP quên mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi gửi OTP" });
  }
};

const resendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res
        .status(404)
        .json({ message: "Email không tồn tại trong hệ thống" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "Email đã được xác minh. Vui lòng đăng nhập." });
    }

    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    user.otp_hash = otp_hash;
    user.otp_expires = otp_expires;
    user.otp_attempts = 0;
    await user.save();

    await sendVerificationEmail(
      user.email,
      user.username,
      otp,
      OTP_EXPIRE_MINUTES,
      "register"
    );

    res.json({
      message: "OTP đã được gửi lại thành công",
      email: user.email,
    });
  } catch (err) {
    console.error("Lỗi gửi lại OTP đăng ký:", err.message);
    res.status(500).json({ message: "Lỗi server khi gửi lại OTP" });
  }
};

const forgotChangePassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin email, OTP hoặc mật khẩu" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải ít nhất 6 ký tự" });
    }
    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Mật khẩu và xác nhận không khớp" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.otp_hash || user.otp_expires < new Date()) {
      return res
        .status(400)
        .json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      return res
        .status(400)
        .json({ message: "Quá số lần thử, vui lòng gửi OTP mới" });
    }

    if (!(await compareString(otp, user.otp_hash))) {
      user.otp_attempts += 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng, thử lại" });
    }

    const password_hash = await hashString(password);
    user.password_hash = password_hash;
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    await user.save();

    await logActivity({
      user,
      store: { _id: user.current_store || null },
      action: "update",
      entity: "User",
      entityId: user._id,
      entityName: user.username || user.email,
      req,
      description: `Người dùng ${
        user.username || user.email
      } đã đổi mật khẩu thông qua chức năng quên mật khẩu`,
    });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu quên:", err.message);
    res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
  }
};

/* -------------------------
   Controller: refreshToken
   ------------------------- */
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    let payload;
    try {
      payload = jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
      );
    } catch (e) {
      return res
        .status(401)
        .json({ message: "Refresh token invalid or expired" });
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
   Controller: updateUser (admin/manager)
   ------------------------- */

const updateUser = async (req, res) => {
  try {
    const requester = req.user;
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "User id không hợp lệ" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res
        .status(404)
        .json({ message: "Người dùng mục tiêu không tồn tại" });
    }

    const menu = Array.isArray(requester.menu) ? requester.menu : [];

    const hasPerm = (p) =>
      menu.includes(p) || menu.includes("*") || menu.includes("all");

    const isSelf =
      String(requester._id || requester.id) === String(targetUserId);

    const selfAllowed = ["username", "email", "phone"];

    const managerAllowed = [
      "username",
      "fullname",
      "email",
      "phone",
      "role",
      "menu",
      "stores",
      "current_store",
      "store_roles",
      "isDeleted",
      "deletedAt",
      "restoredAt",
    ];

    const updates = {};

    // 1) Đổi mật khẩu
    if (req.body.password) {
      const newPass = req.body.password;
      const confirm = req.body.confirmPassword;
      if (!confirm) {
        return res
          .status(400)
          .json({ message: "Thiếu confirmPassword khi đổi mật khẩu" });
      }
      if (newPass.length < 6) {
        return res
          .status(400)
          .json({ message: "Mật khẩu mới phải ít nhất 6 ký tự" });
      }
      if (newPass !== confirm) {
        return res
          .status(400)
          .json({ message: "Mật khẩu mới và xác nhận không khớp" });
      }

      if (isSelf) {
        const current = req.body.currentPassword;
        if (!current) {
          return res
            .status(400)
            .json({ message: "Cần currentPassword để đổi mật khẩu" });
        }
        if (!(await compareString(current, targetUser.password_hash))) {
          return res
            .status(401)
            .json({ message: "Mật khẩu hiện tại không đúng" });
        }
        updates.password_hash = await hashString(newPass);
      } else {
        if (!hasPerm("users:manage") && !hasPerm("users:role:update")) {
          return res
            .status(403)
            .json({ message: "Không có quyền thay đổi mật khẩu người khác" });
        }
        updates.password_hash = await hashString(newPass);
      }
    }

    // 2) Unique username/email
    const wantUsername = req.body.username && req.body.username.trim();
    const wantEmail = req.body.email && req.body.email.trim().toLowerCase();

    if (wantUsername && wantUsername !== targetUser.username) {
      const ex = await User.findOne({ username: wantUsername });
      if (ex) return res.status(400).json({ message: "Username đã tồn tại" });
    }
    if (wantEmail && wantEmail !== targetUser.email) {
      const ex2 = await User.findOne({ email: wantEmail });
      if (ex2) return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // 3) Các field khác
    for (const [key, val] of Object.entries(req.body)) {
      if (["password", "confirmPassword", "currentPassword"].includes(key))
        continue;

      if (isSelf && selfAllowed.includes(key)) {
        if (key === "username") updates.username = val.trim();
        else if (key === "email") updates.email = val.trim().toLowerCase();
        else if (key === "phone") updates.phone = (val || "").trim();
        continue;
      }

      if (["username", "email", "phone"].includes(key)) {
        if (!hasPerm("users:update") && !hasPerm("users:manage")) {
          return res
            .status(403)
            .json({ message: `Không có quyền cập nhật trường ${key}` });
        }
        if (key === "username") updates.username = val.trim();
        else if (key === "email") updates.email = val.trim().toLowerCase();
        else if (key === "phone") updates.phone = (val || "").trim();
        continue;
      }

      if (key === "role") {
        if (!hasPerm("users:role:update") && !hasPerm("users:manage")) {
          return res
            .status(403)
            .json({ message: "Không có quyền thay đổi role người dùng" });
        }
        if (!["MANAGER", "STAFF"].includes(val)) {
          return res.status(400).json({ message: "role không hợp lệ" });
        }
        updates.role = val;

        const normalizedRole = String(val).toUpperCase();
        if (normalizedRole === "MANAGER") {
          updates.menu = ALL_PERMISSIONS.slice();
        } else if (normalizedRole === "STAFF") {
          updates.menu = STAFF_DEFAULT_MENU.slice();
        }
        continue;
      }

      if (key === "menu") {
        if (!hasPerm("users:menu:update") && !hasPerm("users:manage")) {
          return res
            .status(403)
            .json({ message: "Không có quyền cập nhật menu (permissions)" });
        }
        if (!Array.isArray(val) || !val.every((v) => typeof v === "string")) {
          return res
            .status(400)
            .json({ message: "menu phải là mảng các chuỗi permission" });
        }
        updates.menu = val;
        continue;
      }

      if (["stores", "store_roles", "current_store"].includes(key)) {
        if (!hasPerm("users:stores:update") && !hasPerm("users:manage")) {
          return res
            .status(403)
            .json({ message: `Không có quyền cập nhật trường ${key}` });
        }

        if (key === "stores") {
          if (
            !Array.isArray(val) ||
            !val.every((s) => mongoose.Types.ObjectId.isValid(s))
          ) {
            return res
              .status(400)
              .json({ message: "stores phải là mảng storeId hợp lệ" });
          }
          updates.stores = val;
        } else if (key === "store_roles") {
          if (!Array.isArray(val)) {
            return res
              .status(400)
              .json({ message: "store_roles phải là mảng" });
          }
          for (const r of val) {
            if (!r || !r.store || !r.role) {
              return res.status(400).json({
                message: "store_roles mỗi phần tử cần có store và role",
              });
            }
            if (!mongoose.Types.ObjectId.isValid(r.store)) {
              return res
                .status(400)
                .json({ message: "store_roles.store không hợp lệ" });
            }
            if (!["OWNER", "STAFF"].includes(r.role)) {
              return res.status(400).json({
                message: "store_roles.role phải là 'OWNER' hoặc 'STAFF'",
              });
            }
          }
          updates.store_roles = val;
        } else if (key === "current_store") {
          if (val && !mongoose.Types.ObjectId.isValid(val)) {
            return res
              .status(400)
              .json({ message: "current_store không hợp lệ" });
          }
          updates.current_store = val || null;
        }
        continue;
      }

      if (["isDeleted", "deletedAt", "restoredAt"].includes(key)) {
        if (!hasPerm("users:delete") && !hasPerm("users:manage")) {
          return res
            .status(403)
            .json({ message: "Không có quyền xóa/khôi phục người dùng" });
        }
        updates[key] = val;
        continue;
      }

      // field khác: bỏ qua
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có trường hợp lệ để cập nhật" });
    }

    Object.assign(targetUser, updates);
    await targetUser.save();

    await logActivity({
      user: requester,
      store: { _id: requester.current_store },
      action: "update",
      entity: "User",
      entityId: targetUser._id,
      entityName: targetUser.username,
      req,
      description: `Người dùng ${
        requester.username
      } đã cập nhật thông tin của ${
        isSelf
          ? "chính mình"
          : `người dùng ${targetUser.username || targetUser._id}`
      }. Các trường thay đổi: ${Object.keys(updates).join(", ")}`,
    });

    const result = targetUser.toObject();
    delete result.password_hash;
    return res.json({ message: "Cập nhật thành công", user: result });
  } catch (err) {
    console.error("updateUser error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật người dùng" });
  }
};

/* -------------------------
   Controller: updateProfile (dùng Cloudinary cho avatar)
   ------------------------- */

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    console.log("👤 Updating profile for user:", userId);

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in token" });
    }

    if (!req.body && !req.file) {
      console.error("❌ No data received");
      return res.status(400).json({
        message: "Không có dữ liệu để cập nhật",
      });
    }

    const { username, email, phone, fullname, removeImage } = req.body || {};

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    console.log("✅ Current user found:", {
      id: user._id,
      username: user.username,
      email: user.email,
      image: user.image,
      avatarPublicId: user.avatarPublicId,
    });

    const changedFields = [];
    let hasChanges = false;

    // ============ HANDLE AVATAR REMOVE ============
    if (removeImage === "true" || removeImage === true) {
      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId, "image");
          console.log("🗑️ Avatar deleted from Cloudinary");
        } catch (e) {
          console.warn("⚠️ Không xoá được avatar trên Cloudinary:", e.message);
        }
      }
      user.image = null;
      user.avatarPublicId = null;
      changedFields.push("image");
      hasChanges = true;
    }

    // ============ HANDLE AVATAR UPLOAD (multer.diskStorage) ============
    if (req.file) {
      try {
        console.log("🔄 Processing avatar upload via Cloudinary...");

        const allowedMimes = [
          "image/jpeg",
          "image/png",
          "image/jpg",
          "image/gif",
          "image/webp",
        ];
        if (!allowedMimes.includes(req.file.mimetype)) {
          return res.status(400).json({
            message:
              "Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPEG, PNG, JPG, GIF, WEBP",
          });
        }

        const maxSize = 5 * 1024 * 1024;
        if (req.file.size > maxSize) {
          return res.status(400).json({
            message: "Kích thước ảnh quá lớn. Tối đa 5MB",
          });
        }

        // req.file.path phải được multer cấu hình dest (disk) giống fileController
        const localPath = req.file.path;
        const folder = `avatars/${userId}`;

        const result = await uploadToCloudinary(localPath, folder, "image");
        if (!result || !result.secure_url || !result.public_id) {
          return res.status(500).json({
            message: "Upload ảnh lên Cloudinary thất bại",
          });
        }

        // Xoá avatar cũ nếu có
        if (user.avatarPublicId && user.avatarPublicId !== result.public_id) {
          try {
            await deleteFromCloudinary(user.avatarPublicId, "image");
          } catch (e) {
            console.warn(
              "⚠️ Không xoá được avatar cũ trên Cloudinary:",
              e.message
            );
          }
        }

        user.image = result.secure_url;
        user.avatarPublicId = result.public_id;

        changedFields.push("image");
        hasChanges = true;

        console.log("✅ Avatar uploaded to Cloudinary:", result.secure_url);
      } catch (uploadError) {
        console.error("❌ Avatar upload error:", uploadError);
        return res.status(500).json({
          message: "Lỗi xử lý file ảnh",
          error: uploadError.message,
        });
      }
    }

    // ============ HANDLE TEXT FIELDS ============

    if (username && username.trim() !== user.username) {
      const existingUsername = await User.findOne({
        username: username.trim(),
        _id: { $ne: userId },
      });
      if (existingUsername) {
        return res.status(400).json({ message: "Username đã tồn tại" });
      }
      user.username = username.trim();
      changedFields.push("username");
      hasChanges = true;
    }

    if (email && email.trim().toLowerCase() !== user.email) {
      const existingEmail = await User.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(400).json({ message: "Email đã tồn tại" });
      }
      user.email = email.trim().toLowerCase();
      changedFields.push("email");
      hasChanges = true;
    }

    if (phone !== undefined && phone.trim() !== (user.phone || "")) {
      user.phone = phone.trim();
      changedFields.push("phone");
      hasChanges = true;
    }

    if (fullname !== undefined && fullname.trim() !== (user.fullname || "")) {
      user.fullname = fullname.trim();
      changedFields.push("fullname");
      hasChanges = true;
    }

    if (!hasChanges) {
      return res.status(400).json({
        message: "Không có thông tin nào thay đổi",
      });
    }

    await user.save();
    console.log("✅ User updated successfully");

    // Sync Employee nếu STAFF
    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (employee) {
        let employeeChanged = false;

        // ⚠️ Lưu ý: Employee model dùng fullName (camelCase), User model dùng fullname (camelCase)
        if (fullname && changedFields.includes("fullname")) {
          employee.fullName = fullname.trim(); // 🔴 FIX: fullName thay vì fullname
          employeeChanged = true;
        }

        // 🔴 FIX: phone có thể là empty string "" nên dùng changedFields để kiểm tra thay vì `if (phone &&...)`
        if (changedFields.includes("phone")) {
          employee.phone = phone?.trim() || "";
          employeeChanged = true;
        }

        if (user.image && changedFields.includes("image")) {
          employee.image = user.image;
          employeeChanged = true;
        }

        if (employeeChanged) {
          await employee.save();
          console.log(
            "✅ Employee data synced with fullName:",
            employee.fullName
          );
        }
      }
    }

    if (changedFields.length > 0) {
      await logActivity({
        user,
        store: { _id: user.current_store },
        action: "update",
        entity: "User",
        entityId: user._id,
        entityName: user.username,
        req,
        description: `Người dùng ${
          user.username
        } đã cập nhật thông tin cá nhân: ${changedFields.join(", ")}`,
      });
    }

    const updatedUser = await User.findById(userId)
      .select("-password_hash")
      .lean();

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("❌ Lỗi cập nhật profile:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({
      message: "Lỗi server khi cập nhật profile",
      error: err.message,
    });
  }
};

/* -------------------------
   sendPasswordOTP & changePassword
   ------------------------- */

const sendPasswordOTP = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { email } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    const useEmail = email || user.email;
    if (!useEmail) {
      return res.status(400).json({
        message: "Cần email để gửi OTP đổi mật khẩu, cập nhật profile trước",
      });
    }

    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    user.otp_hash = otp_hash;
    user.otp_expires = otp_expires;
    user.otp_attempts = 0;
    await user.save();

    await sendVerificationEmail(
      useEmail,
      user.username,
      otp,
      OTP_EXPIRE_MINUTES,
      "change-password"
    );

    res.json({
      message: "OTP đổi mật khẩu đã gửi đến email, hết hạn sau 5 phút",
    });
  } catch (err) {
    console.error("Lỗi gửi OTP đổi mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi gửi OTP" });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { password, confirmPassword, otp } = req.body;

    if (!password || !confirmPassword || !otp) {
      return res
        .status(400)
        .json({ message: "Thiếu mật khẩu mới, xác nhận mật khẩu hoặc OTP" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới phải ít nhất 6 ký tự" });
    }
    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới và xác nhận không khớp" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    if (user.otp_hash === null || user.otp_expires < new Date()) {
      return res
        .status(400)
        .json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    if (user.otp_attempts >= OTP_MAX_ATTEMPTS) {
      return res
        .status(400)
        .json({ message: "Quá số lần thử, vui lòng gửi OTP mới" });
    }

    if (!(await compareString(otp, user.otp_hash))) {
      user.otp_attempts += 1;
      await user.save();
      return res.status(400).json({ message: "OTP không đúng, thử lại" });
    }

    const password_hash = await hashString(password);
    user.password_hash = password_hash;
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    await user.save();

    await logActivity({
      user,
      store: { _id: user.current_store || null },
      action: "update",
      entity: "User",
      entityId: user._id,
      entityName: user.username || user.email,
      req,
      description: `Người dùng ${
        user.username || user.email
      } đã đổi mật khẩu thành công (xác thực bằng OTP)`,
    });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
  }
};

const getPermissionCatalog = async (req, res) => {
  try {
    return res.json({
      permissions: ALL_PERMISSIONS,
      staffDefault: STAFF_DEFAULT_MENU,
    });
  } catch (err) {
    console.error("Lỗi lấy danh sách quyền:", err.message);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy danh sách quyền" });
  }
};

/* -------------------------
   softDeleteUser & restoreUser
   ------------------------- */

const softDeleteUser = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu targetUserId" });
    }

    const manager = await User.findById(userId);
    if (!manager || manager.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ manager mới được xóa nhân viên" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.role !== "STAFF") {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    if (targetUser.isDeleted) {
      return res
        .status(400)
        .json({ message: "Tài khoản nhân viên này đã bị xoá trước đó rồi!" });
    }

    if (String(manager.current_store) !== String(targetUser.current_store)) {
      return res
        .status(403)
        .json({ message: "Bạn chỉ xóa được nhân viên ở cửa hàng hiện tại" });
    }

    targetUser.isDeleted = true;
    targetUser.deletedAt = new Date();
    await targetUser.save();

    const employee = await Employee.findOne({ user_id: targetUserId });
    if (employee) {
      employee.isDeleted = true;
      await employee.save();
    }

    await logActivity({
      user: manager,
      store: { _id: manager.current_store },
      action: "delete",
      entity: "User",
      entityId: targetUser._id,
      entityName: targetUser.username,
      req,
      description: `Manager ${manager.username} đã xóa mềm nhân viên ${targetUser.username} tại cửa hàng ${manager.current_store}`,
    });

    console.log(
      `Manager ${manager.username} xóa mềm nhân viên ${targetUser.username} ở store ${manager.current_store}`
    );
    res.json({ message: "Xóa mềm nhân viên thành công" });
  } catch (err) {
    console.error("Lỗi xóa mềm nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi xóa nhân viên" });
  }
};

const restoreUser = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu targetUserId" });
    }

    const manager = await User.findById(userId);
    if (!manager || manager.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ manager mới được khôi phục nhân viên" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.role !== "STAFF") {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    if (!targetUser.isDeleted) {
      return res.status(400).json({ message: "Nhân viên chưa bị xóa mềm" });
    }

    if (String(manager.current_store) !== String(targetUser.current_store)) {
      return res.status(403).json({
        message: "Bạn chỉ khôi phục được nhân viên ở cửa hàng hiện tại",
      });
    }

    targetUser.isDeleted = false;
    targetUser.restoredAt = new Date();
    await targetUser.save();

    const employee = await Employee.findOne({ user_id: targetUserId });
    if (employee) {
      employee.isDeleted = false;
      await employee.save();
    }

    await logActivity({
      user: manager,
      store: { _id: manager.current_store },
      action: "restore",
      entity: "User",
      entityId: targetUser._id,
      entityName: targetUser.username,
      req,
      description: `Manager ${manager.username} đã khôi phục nhân viên ${targetUser.username} tại cửa hàng ${manager.current_store}`,
    });

    console.log(
      `Manager ${manager.username} khôi phục nhân viên ${targetUser.username} ở store ${manager.current_store}`
    );
    res.json({ message: "Khôi phục nhân viên thành công" });
  } catch (err) {
    console.error("Lỗi khôi phục nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi khôi phục nhân viên" });
  }
};

module.exports = {
  registerManager,
  verifyOtp,
  login,
  logout,
  sendForgotPasswordOTP,
  forgotChangePassword,
  refreshToken,
  updateUser,
  updateProfile,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
  resendRegisterOtp,
  getPermissionCatalog,
};
