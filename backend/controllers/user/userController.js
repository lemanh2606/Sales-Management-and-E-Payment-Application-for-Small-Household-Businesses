// controllers/userController.js (fix changePassword: thêm confirmPassword check khớp, fix compareString scope - paste thay file)
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const logActivity = require("../../utils/logActivity");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail } = require("../../services/emailService");

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

// menu để phân quyền
const ALL_PERMISSIONS = [
  // store
  "store:create",
  "store:view",
  "store:update",
  "store:delete",
  "store:dashboard:view",
  "store:staff:assign",
  "store:employee:create",
  "store:employee:view",
  "store:employee:update",
  "store:employee:delete",

  // customers
  "customers:create",
  "customers:search",
  "customers:update",
  "customers:delete",
  "customers:top-customers",

  // loyalty
  "loyalty:view",
  "loyalty:manage",

  // orders
  "orders:create",
  "orders:pay",
  "orders:print",
  "orders:view",
  "orders:refund",

  // reports
  "reports:top-products",
  "reports:revenue:view",
  "reports:revenue:employee",
  "reports:revenue:export",
  "reports:financial:view",
  "reports:financial:export",
  "reports:financial:list",

  // products
  "products:create",
  "products:view",
  "products:update",
  "products:price",
  "products:delete",
  "products:image:delete",
  "products:search",
  "products:low-stock",

  // product groups
  "product-groups:create",
  "product-groups:view",
  "product-groups:update",
  "product-groups:delete",

  // purchase orders
  "purchase-orders:create",
  "purchase-orders:view",
  "purchase-orders:update",
  "purchase-orders:delete",

  // purchase returns
  "purchase-returns:create",
  "purchase-returns:view",
  "purchase-returns:update",
  "purchase-returns:delete",

  // stock checks / inventory
  "inventory:stock-check:create",
  "inventory:stock-check:view",
  "inventory:stock-check:detail",
  "inventory:stock-check:update",
  "inventory:stock-check:delete",

  // stock disposal
  "inventory:disposal:create",
  "inventory:disposal:view",
  "inventory:disposal:update",
  "inventory:disposal:delete",

  // suppliers
  "supplier:create",
  "supplier:view",
  "supplier:update",
  "supplier:delete",

  // tax
  "tax:preview",
  "tax:create",
  "tax:update",
  "tax:clone",
  "tax:delete",
  "tax:list",
  "tax:export",

  // user
  "users:manage",
  "users:role:update",
  "users:menu:update",
  "users:update",

  // purchase/supplier related reports/exports
  "reports:export",
];
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
const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET || "default_jwt_secret_change_in_env", { expiresIn: ACCESS_TOKEN_EXPIRES });

/**
 * Tạo refresh token (JWT với id, role).
 * Thời hạn từ REFRESH_TOKEN_EXPIRES.
 */
const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

/* ------------------------- 
   Controller: registerManager (đăng ký manager với OTP email)
   - Tạo user MANAGER, hash pass, sinh OTP hash, gửi email, set isVerified = false
   ------------------------- */
/* -------------------------
   Controller: registerManager
   - Khi Manager đăng ký, mặc định cấp toàn bộ permission (ALL_PERMISSIONS)
   - Sinh OTP, lưu user, gửi email xác minh
   ------------------------- */
const registerManager = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input cơ bản
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

    // Tạo user MANAGER với menu mặc định đầy đủ
    const newUser = new User({
      username: username.trim(),
      password_hash,
      role: "MANAGER",
      email: email.toLowerCase().trim(),
      otp_hash,
      otp_expires,
      otp_attempts: 0,
      isVerified: false,
      // Gán menu mặc định toàn quyền cho Manager
      menu: ALL_PERMISSIONS,
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

    const identifier = username.trim();

    // Tìm user bằng username hoặc email (email được chuẩn hóa thành lowercase)
    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });

    if (!user) {
      // Không tiết lộ là username hay email không đúng — giữ message chung
      return res.status(401).json({ message: "Username hoặc password không đúng" });
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
      user: {
        id: user._id,
        username: user.username,
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

/* ------------------------- 
   Controller public: gửi OTP khi quên mật khẩu (không cần login)
   ------------------------- */
const sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại trong hệ thống" });
    }

    const otp = generateOTP();
    const otp_hash = await hashString(otp);
    const otp_expires = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    user.otp_hash = otp_hash;
    user.otp_expires = otp_expires;
    user.otp_attempts = 0;
    await user.save();

    await sendVerificationEmail(user.email, user.username, otp, OTP_EXPIRE_MINUTES, "forgot-password");

    res.json({ message: "OTP đã gửi tới email, hết hạn sau 5 phút" });
  } catch (err) {
    console.error("Lỗi gửi OTP quên mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi gửi OTP" });
  }
};

/* ------------------------- 
   Controller public: đổi mật khẩu khi quên mật khẩu (không cần login)
   ------------------------- */
const forgotChangePassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ message: "Thiếu thông tin email, OTP hoặc mật khẩu" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải ít nhất 6 ký tự" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu và xác nhận không khớp" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.otp_hash || user.otp_expires < new Date()) {
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

    const password_hash = await hashString(password);
    user.password_hash = password_hash;
    user.otp_hash = null;
    user.otp_expires = null;
    user.otp_attempts = 0;
    await user.save();
    await logActivity({
      //Ghi nhật ký hoạt động
      user,
      store: { _id: user.current_store || null },
      action: "update",
      entity: "User",
      entityId: user._id,
      entityName: user.username || user.email,
      req,
      description: `Người dùng ${user.username || user.email} đã đổi mật khẩu thông qua chức năng quên mật khẩu`,
    });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu quên:", err.message);
    res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
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

/**
 * updateUser
 * - PUT /api/users/:id
 * - Quy tắc:
 *    + Self update: user tự chỉnh được username/email/phone và đổi mật khẩu (phải cung cấp currentPassword)
 *    + Người khác chỉnh user: cần các permission phù hợp trong req.user.menu (vd users:manage, users:role:update, users:menu:update...)
 *    + Nếu payload đổi role => nếu đổi sang "MANAGER" thì tự động gán menu = ALL_PERMISSIONS
 *    + Người chỉnh không được tự do gán menu nếu không có permission users:menu:update (trừ trường hợp role => MANAGER sẽ override)
 */
const updateUser = async (req, res) => {
  try {
    const requester = req.user; // req.user được attach bởi verifyToken (plain object)
    const targetUserId = req.params.id;
    const mongoose = require("mongoose");

    // validate target id
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "User id không hợp lệ" });
    }

    // load target user (mongoose document vì cần save)
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "Người dùng mục tiêu không tồn tại" });
    }

    // chuẩn hóa menu requester
    const menu = Array.isArray(requester.menu) ? requester.menu : [];

    // helper kiểm tra permission (global wildcard hỗ trợ)
    const hasPerm = (p) => menu.includes(p) || menu.includes("*") || menu.includes("all");

    // xác định là self hay không
    const isSelf = String(requester._id || requester.id) === String(targetUserId);

    // Các trường cho self-update
    const selfAllowed = ["username", "email", "phone"];

    // Các field manager-like có thể update nếu có permission
    const managerAllowed = [
      "username",
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

    // ------------------
    // 1) Xử lý đổi mật khẩu (nếu có)
    //    - Self: cần currentPassword
    //    - Người khác: cần users:manage
    //    - confirmPassword phải khớp
    // ------------------
    if (req.body.password) {
      const newPass = req.body.password;
      const confirm = req.body.confirmPassword;
      if (!confirm) {
        return res.status(400).json({ message: "Thiếu confirmPassword khi đổi mật khẩu" });
      }
      if (newPass.length < 6) {
        return res.status(400).json({ message: "Mật khẩu mới phải ít nhất 6 ký tự" });
      }
      if (newPass !== confirm) {
        return res.status(400).json({ message: "Mật khẩu mới và xác nhận không khớp" });
      }

      if (isSelf) {
        const current = req.body.currentPassword;
        if (!current) {
          return res.status(400).json({ message: "Cần currentPassword để đổi mật khẩu" });
        }
        // so sánh current với hash
        if (!(await compareString(current, targetUser.password_hash))) {
          return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
        }
        updates.password_hash = await hashString(newPass);
      } else {
        // người khác đổi mật khẩu => phải có quyền quản lý user
        if (!hasPerm("users:manage") && !hasPerm("users:role:update")) {
          return res.status(403).json({ message: "Không có quyền thay đổi mật khẩu người khác" });
        }
        updates.password_hash = await hashString(newPass);
      }
    }

    // ------------------
    // 2) Kiểm tra unique username/email nếu có thay đổi
    // ------------------
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

    // ------------------
    // 3) Duyệt các field khác trong body
    //    - Self allowed fields xử lý
    //    - Các field khác require permission tương ứng
    // ------------------
    for (const [key, val] of Object.entries(req.body)) {
      // đã xử lý password-related ở trên, skip các field liên quan mật khẩu
      if (["password", "confirmPassword", "currentPassword"].includes(key)) continue;

      // Self-update các trường cơ bản
      if (isSelf && selfAllowed.includes(key)) {
        if (key === "username") updates.username = val.trim();
        else if (key === "email") updates.email = val.trim().toLowerCase();
        else if (key === "phone") updates.phone = (val || "").trim();
        continue;
      }

      // Nếu không self: cần permission (các permission cụ thể)
      // Cập nhật thông tin chung (username/email/phone)
      if (["username", "email", "phone"].includes(key)) {
        if (!hasPerm("users:update") && !hasPerm("users:manage")) {
          return res.status(403).json({ message: `Không có quyền cập nhật trường ${key}` });
        }
        if (key === "username") updates.username = val.trim();
        else if (key === "email") updates.email = val.trim().toLowerCase();
        else if (key === "phone") updates.phone = (val || "").trim();
        continue;
      }

      // Thay đổi role
      if (key === "role") {
        if (!hasPerm("users:role:update") && !hasPerm("users:manage")) {
          return res.status(403).json({ message: "Không có quyền thay đổi role người dùng" });
        }
        if (!["MANAGER", "STAFF"].includes(val)) {
          return res.status(400).json({ message: "role không hợp lệ" });
        }
        updates.role = val;

        // Nếu role đổi thành MANAGER thì tự động gán menu full quyền
        if (String(val).toUpperCase() === "MANAGER") {
          updates.menu = ALL_PERMISSIONS.slice(); // clone mảng ALL_PERMISSIONS
        }
        continue;
      }

      // Thay đổi menu (permissions)
      if (key === "menu") {
        // Nếu payload có role=MANAGER, menu đã bị override ở trên
        // Ngược lại, để gán menu thủ công phải có quyền users:menu:update hoặc users:manage
        if (!hasPerm("users:menu:update") && !hasPerm("users:manage")) {
          return res.status(403).json({ message: "Không có quyền cập nhật menu (permissions)" });
        }
        if (!Array.isArray(val) || !val.every((v) => typeof v === "string")) {
          return res.status(400).json({ message: "menu phải là mảng các chuỗi permission" });
        }
        updates.menu = val;
        continue;
      }

      // stores, store_roles, current_store
      if (["stores", "store_roles", "current_store"].includes(key)) {
        if (!hasPerm("users:stores:update") && !hasPerm("users:manage")) {
          return res.status(403).json({ message: `Không có quyền cập nhật trường ${key}` });
        }

        if (key === "stores") {
          if (!Array.isArray(val) || !val.every((s) => mongoose.Types.ObjectId.isValid(s))) {
            return res.status(400).json({ message: "stores phải là mảng storeId hợp lệ" });
          }
          updates.stores = val;
        } else if (key === "store_roles") {
          if (!Array.isArray(val)) {
            return res.status(400).json({ message: "store_roles phải là mảng" });
          }
          for (const r of val) {
            if (!r || !r.store || !r.role) {
              return res.status(400).json({
                message: "store_roles mỗi phần tử cần có store và role",
              });
            }
            if (!mongoose.Types.ObjectId.isValid(r.store)) {
              return res.status(400).json({ message: "store_roles.store không hợp lệ" });
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
            return res.status(400).json({ message: "current_store không hợp lệ" });
          }
          updates.current_store = val || null;
        }
        continue;
      }

      // isDeleted / deletedAt / restoredAt
      if (["isDeleted", "deletedAt", "restoredAt"].includes(key)) {
        if (!hasPerm("users:delete") && !hasPerm("users:manage")) {
          return res.status(403).json({ message: "Không có quyền xóa/khôi phục người dùng" });
        }
        updates[key] = val;
        continue;
      }

      // Nếu gặp field không support ở đây -> bỏ qua (không trả lỗi chi tiết để tránh leak)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Không có trường hợp lệ để cập nhật" });
    }

    // Áp dụng cập nhật vào document
    Object.assign(targetUser, updates);
    await targetUser.save();

    // Audit log cơ bản
    console.log(
      `UPDATE USER: actor=${requester.username || requester.id} target=${
        targetUser.username || targetUser._id
      } fields=${Object.keys(updates).join(", ")} time=${new Date().toISOString()}`
    );

    //Ghi nhật ký hoạt động
    await logActivity({
      user: requester, // người đang thao tác
      store: { _id: requester.current_store },
      action: "update",
      entity: "User",
      entityId: targetUser._id,
      entityName: targetUser.username,
      req,
      description: `Người dùng ${requester.username} đã cập nhật thông tin của ${
        isSelf ? "chính mình" : `người dùng ${targetUser.username || targetUser._id}`
      }. Các trường thay đổi: ${Object.keys(updates).join(", ")}`,
    });

    // Trả về user không chứa password_hash
    const result = targetUser.toObject();
    delete result.password_hash;
    return res.json({ message: "Cập nhật thành công", user: result });
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật người dùng" });
  }
};

/* ------------------------- 
   Controller: updateProfile (thay đổi thông tin cá nhân – username, email, phone, fullName nếu STAFF)
   - Chỉ update chính user, unique username/email, update Employee nếu role STAFF
   ------------------------- */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // Từ middleware verifyToken
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
        if (fullName) employee.fullName = fullName.trim(); // Thêm: fullName optional (nếu input, update Employee)
        if (phone !== undefined) employee.phone = phone.trim(); // Sync phone vào Employee (optional, default '')
        await employee.save();
      }
    }
    //Ghi nhật ký hoạt động
    await logActivity({
      user, // req.user cũng được, nhưng user đang là document chuẩn
      store: { _id: user.current_store },
      action: "update",
      entity: "User",
      entityId: user._id,
      entityName: user.username,
      req,
      description: `Người dùng ${user.username} đã cập nhật thông tin cá nhân: ${[
        username ? "username" : null,
        email ? "email" : null,
        phone ? "phone" : null,
        fullName ? "fullName" : null,
      ]
        .filter(Boolean)
        .join(", ")}`,
    });
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
    const userId = req.user.id || req.user._id; // Từ middleware verifyToken
    const { email } = req.body; // Email (optional, dùng email user nếu ko input)

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

    res.json({
      message: "OTP đổi mật khẩu đã gửi đến email, hết hạn sau 5 phút",
    });
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
    const userId = req.user.id || req.user._id; // Từ middleware verifyToken
    const { password, confirmPassword, otp } = req.body; // Password mới + confirmPassword + OTP

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
    // Ghi nhật ký hoạt động
    await logActivity({
      user,
      store: { _id: user.current_store || null },
      action: "update",
      entity: "User",
      entityId: user._id,
      entityName: user.username || user.email,
      req,
      description: `Người dùng ${user.username || user.email} đã đổi mật khẩu thành công (xác thực bằng OTP)`,
    });

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err.message);
    res.status(500).json({ message: "Lỗi server khi đổi mật khẩu" });
  }
};

//Chỉ manager xóa staff khác, check store match current_store, set isDeleted=true + deletedAt=now
const softDeleteUser = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // Manager ID từ verifyToken
    const { targetUserId } = req.body; // Target staff ID để xóa

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu targetUserId" });
    }
    //check xem có phải role manager đang thao tác không
    const manager = await User.findById(userId);
    if (!manager || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ manager mới được xóa nhân viên" });
    }
    //check nhân viên trong chính store đó
    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.role !== "STAFF") {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }
    //check nhân viên đã bị xoá từ trước hay chưa
    if (targetUser.isDeleted) {
      return res.status(400).json({ message: "Tài khoản nhân viên này đã bị xoá trước đó rồi!" });
    }
    // Check quyền: Manager chỉ xóa staff bind store hiện tại (current_store match)
    if (String(manager.current_store) !== String(targetUser.current_store)) {
      return res.status(403).json({ message: "Bạn chỉ xóa được nhân viên ở cửa hàng hiện tại" });
    }
    // Xóa mềm: đặt isDeleted=true, deletedAt=now
    targetUser.isDeleted = true;
    targetUser.deletedAt = new Date();
    await targetUser.save();

    // Optional: Xóa Employee bind (set isDeleted=true nếu Employee có field)
    const employee = await Employee.findOne({ user_id: targetUserId });
    if (employee) {
      employee.isDeleted = true; //đặt isDeleted = true ở models/Employee.js để không bị mất dữ liệu
      await employee.save();
    }
    // ghi nhật ký hoạt động
    await logActivity({
      user: manager, // người thực hiện
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

// khôi phục lại tài khoản của nhân viên
const restoreUser = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // Manager ID từ verifyToken
    const { targetUserId } = req.body; // Target staff ID để khôi phục

    if (!targetUserId) {
      return res.status(400).json({ message: "Thiếu targetUserId" });
    }

    const manager = await User.findById(userId);
    if (!manager || manager.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ manager mới được khôi phục nhân viên" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || targetUser.role !== "STAFF") {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    if (!targetUser.isDeleted) {
      return res.status(400).json({ message: "Nhân viên chưa bị xóa mềm" });
    }

    // Check quyền: Manager chỉ khôi phục staff bind store hiện tại (current_store match)
    if (String(manager.current_store) !== String(targetUser.current_store)) {
      return res.status(403).json({
        message: "Bạn chỉ khôi phục được nhân viên ở cửa hàng hiện tại",
      });
    }

    // Khôi phục: set isDeleted=false, restoredAt=now
    targetUser.isDeleted = false;
    targetUser.restoredAt = new Date();
    await targetUser.save();

    // Optional: Khôi phục Employee bind (set isDeleted=false)
    const employee = await Employee.findOne({ user_id: targetUserId });
    if (employee) {
      employee.isDeleted = false;
      await employee.save();
    }
    // Ghi nhật ký hoạt động
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
  sendForgotPasswordOTP,
  forgotChangePassword,
  refreshToken,
  updateUser,
  updateProfile,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
};
