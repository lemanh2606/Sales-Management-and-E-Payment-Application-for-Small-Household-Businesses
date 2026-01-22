// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

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
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

// ==================== MULTER CONFIG (Cloudinary avatar) ====================

// Lưu file tạm ra ổ đĩa để Cloudinary đọc từ req.file.path
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads", "tmp"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

const uploadAvatar = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("🔍 Multer fileFilter:", {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetypeOk = allowedTypes.test(file.mimetype);
    const extnameOk = allowedTypes.test(
      (file.originalname || "").toLowerCase()
    );

    if (mimetypeOk && extnameOk) {
      console.log(" File type accepted");
      return cb(null, true);
    }

    console.log(" File type rejected");
    cb(new Error("Only images are allowed (jpeg, jpg, png, gif, webp)"));
  },
});

// ==================== PUBLIC ROUTES ====================

router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/resend-register-otp", resendRegisterOtp);
router.post("/login", login);

router.post("/forgot-password/send-otp", sendForgotPasswordOTP);
router.post("/forgot-password/change", forgotChangePassword);

router.get("/refresh-token", refreshToken);

// ==================== PROTECTED ROUTES ====================

/**
 * PUT /api/users/profile
 * - Cập nhật thông tin cá nhân
 * - Hỗ trợ:
 *   + upload file avatar (field "avatar") từ Web (FormData)
 *   + image base64 từ mobile (field "image")
 *   + các trường text: fullname, email, phone...
 */

router.put(
  "/profile",
  verifyToken,
  uploadAvatar.single("avatar"),
  updateProfile
);

router.get("/profile", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post("/password/send-otp", verifyToken, sendPasswordOTP);
router.post("/password/change", verifyToken, changePassword);
router.post("/logout", verifyToken, logout);

/**
 * POST /api/users/push-token
 * Lưu Expo Push Token để gửi push notifications
 */
router.post("/push-token", verifyToken, async (req, res) => {
  try {
    const { pushToken, platform, deviceName, userId } = req.body;

    // Dùng userId từ body hoặc từ token
    const targetUserId = userId || req.user._id || req.user.id;

    if (!pushToken) {
      return res.status(400).json({ message: "pushToken là bắt buộc" });
    }

    // Import User model
    const User = require("../models/User");

    const user = await User.findByIdAndUpdate(
      targetUserId,
      {
        pushToken: pushToken,
        pushTokenPlatform: platform || null,
        pushTokenDeviceName: deviceName || null,
        pushTokenUpdatedAt: new Date(),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    console.log(
      `✅ Push token saved for user ${user.username}: ${pushToken.substring(
        0,
        30
      )}...`
    );

    return res.json({
      message: "Push token đã được lưu",
      pushToken: user.pushToken,
      updatedAt: user.pushTokenUpdatedAt,
    });
  } catch (err) {
    console.error("⚠️ Lỗi khi lưu push token:", err);
    return res.status(500).json({ message: "Lỗi lưu push token" });
  }
});

// ==================== MANAGER ROUTES ====================

router.post(
  "/staff/soft-delete",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:delete"),
  softDeleteUser
);
router.post(
  "/staff/restore",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:update"),
  restoreUser
);
router.get(
  "/permissions/catalog",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:view"),
  getPermissionCatalog
);

// ==================== ADMIN / MANAGER UPDATE USER ====================

router.put(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:update"),
  updateUser
);

// ==================== DEMO/TEST ROUTES ====================

router.get("/manager-dashboard", verifyToken, (req, res) => {
  res.json({
    message: `Welcome Manager ${
      req.user.username || req.user.id || req.user._id
    }`,
    role: "MANAGER",
    userId: req.user.id || req.user._id,
  });
});

router.get("/staff-dashboard", verifyToken, (req, res) => {
  res.json({
    message: `Welcome Staff ${
      req.user.username || req.user.id || req.user._id
    }`,
    role: "STAFF",
    userId: req.user.id || req.user._id,
  });
});

// ==================== MULTER ERROR HANDLER ====================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error(" Multer Error:", err);

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

  if (err.message && err.message.includes("Only images")) {
    console.error(" File Filter Error:", err);
    return res.status(400).json({
      message: err.message,
    });
  }

  next(err);
});

module.exports = router;
