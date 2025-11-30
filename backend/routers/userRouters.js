// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  registerManager,
  verifyOtp,
  login,
  logout,
  refreshToken,
  updateProfile,
  updateUser,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
  sendForgotPasswordOTP,
  forgotChangePassword,
  resendRegisterOtp,
  getPermissionCatalog,
} = require("../controllers/user/userController");

const {
  verifyToken,
  isManager,
  isStaff,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

// ==================== MULTER CONFIG ====================
// ✅ Config multer với memory storage cho ImgBB
const storage = multer.memoryStorage();

const uploadAvatar = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 Multer fileFilter:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(file.originalname.toLowerCase());

    if (mimetype && extname) {
      console.log("✅ File type accepted");
      return cb(null, true);
    } else {
      console.log("❌ File type rejected");
      cb(new Error("Only images are allowed (jpeg, jpg, png, gif, webp)"));
    }
  },
});

// ==================== PUBLIC ROUTES ====================

/**
 * POST /api/users/register
 * Đăng ký tài khoản Manager mới
 */
router.post("/register", registerManager);

/**
 * POST /api/users/verify-otp
 * Xác thực OTP đăng ký
 */
router.post("/verify-otp", verifyOtp);

/**
 * POST /api/users/resend-register-otp
 * Gửi lại OTP đăng ký
 */
router.post("/resend-register-otp", resendRegisterOtp);

/**
 * POST /api/users/login
 * Đăng nhập hệ thống
 */
router.post("/login", login);

/**
 * POST /api/users/forgot-password/send-otp
 * Gửi OTP quên mật khẩu
 */
router.post("/forgot-password/send-otp", sendForgotPasswordOTP);

/**
 * POST /api/users/forgot-password/change
 * Đổi mật khẩu bằng OTP (quên mật khẩu)
 */
router.post("/forgot-password/change", forgotChangePassword);

/**
 * GET /api/users/refresh-token
 * Refresh access token
 */
router.get("/refresh-token", refreshToken);

// ==================== PROTECTED ROUTES ====================

/**
 * PUT /api/users/profile
 * Cập nhật thông tin cá nhân
 * Hỗ trợ:
 * - File upload (multer) từ Web
 * - Base64 image từ React Native
 * - Text fields update
 */
router.put(
  "/profile",
  verifyToken,
  // Debug middleware (optional - có thể xóa sau khi test xong)
  (req, res, next) => {
    console.log("=== 📥 BEFORE MULTER ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Has body:", !!req.body);
    console.log("Body keys:", Object.keys(req.body || {}));
    next();
  },
  // Multer middleware
  uploadAvatar.single("avatar"),
  // Debug middleware (optional)
  (req, res, next) => {
    console.log("=== 📤 AFTER MULTER ===");
    console.log("Has file:", !!req.file);
    if (req.file) {
      console.log("File info:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferLength: req.file.buffer?.length,
      });
    }
    console.log("Body keys:", Object.keys(req.body || {}));
    if (req.body.image) {
      console.log("Has base64 image:", req.body.image.substring(0, 50) + "...");
    }
    next();
  },
  // Controller
  updateProfile
);

/**
 * GET /api/users/profile
 * Lấy thông tin cá nhân
 */
router.get("/profile", verifyToken, (req, res) => {
  // Controller có thể tách ra nếu cần
  res.json({ user: req.user });
});

/**
 * POST /api/users/password/send-otp
 * Gửi OTP đổi mật khẩu
 */
router.post("/password/send-otp", verifyToken, sendPasswordOTP);

/**
 * POST /api/users/password/change
 * Đổi mật khẩu bằng OTP
 */
router.post("/password/change", verifyToken, changePassword);

/**
 * POST /api/users/logout
 * Đăng xuất
 */
router.post("/logout", verifyToken, logout);

// ==================== MANAGER ROUTES ====================

/**
 * POST /api/users/staff/soft-delete
 * Xóa mềm nhân viên (chỉ Manager)
 */
router.post("/staff/soft-delete", verifyToken, isManager, softDeleteUser);

/**
 * POST /api/users/staff/restore
 * Khôi phục nhân viên (chỉ Manager)
 */
router.post("/staff/restore", verifyToken, isManager, restoreUser);

/**
 * GET /api/users/permissions/catalog
 * Lấy danh sách quyền và preset cho Manager phân quyền
 */
router.get("/permissions/catalog", verifyToken, isManager, getPermissionCatalog);

// ==================== ADMIN ROUTES ====================

/**
 * PUT /api/users/:id
 * Cập nhật thông tin user (Manager hoặc có quyền users:update)
 */
router.put(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:update"),
  updateUser
);

// ==================== DEMO/TEST ROUTES ====================

/**
 * GET /api/users/manager-dashboard
 * Dashboard test cho Manager
 */
router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({
    message: `Welcome Manager ${
      req.user.username || req.user.id || req.user._id
    }`,
    role: "MANAGER",
    userId: req.user.id || req.user._id,
  });
});

/**
 * GET /api/users/staff-dashboard
 * Dashboard test cho Staff
 */
router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({
    message: `Welcome Staff ${
      req.user.username || req.user.id || req.user._id
    }`,
    role: "STAFF",
    userId: req.user.id || req.user._id,
  });
});

// ==================== ERROR HANDLER ====================

/**
 * Multer error handler
 * Bắt lỗi từ multer (file size, file type, etc.)
 */
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("❌ Multer Error:", err);

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "File quá lớn. Kích thước tối đa là 5MB",
        error: err.message,
      });
    }

    return res.status(400).json({
      message: "Lỗi upload file",
      error: err.message,
    });
  }

  // Lỗi từ fileFilter
  if (err.message && err.message.includes("Only images")) {
    console.error("❌ File Filter Error:", err);
    return res.status(400).json({
      message: err.message,
    });
  }

  // Pass to next error handler
  next(err);
});

module.exports = router;
