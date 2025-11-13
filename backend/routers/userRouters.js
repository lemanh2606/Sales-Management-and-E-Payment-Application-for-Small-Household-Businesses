// routes/userRouters.js
const express = require("express");
const router = express.Router();
const uploadAvatar = require("../middlewares/upload");

const {
  registerManager,
  verifyOtp,
  login,
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
} = require("../controllers/user/userController");

const {
  verifyToken,
  isManager,
  isStaff,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

// -------------------------
// Public routes
// -------------------------
router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/resend-register-otp", resendRegisterOtp);
router.post("/login", login);

router.post("/forgot-password/send-otp", sendForgotPasswordOTP);
router.post("/forgot-password/change", forgotChangePassword);
router.get("/refresh-token", refreshToken);

// -------------------------
// Protected routes
// -------------------------
// Thêm vào userRouters.js tạm thời
router.put(
  "/profile",
  verifyToken,
  (req, res, next) => {
    console.log("=== BEFORE MULTER ===");
    console.log("Headers:", req.headers["content-type"]);
    console.log("Body before multer:", req.body);
    next();
  },
  uploadAvatar.single("avatar"),
  (req, res, next) => {
    console.log("=== AFTER MULTER ===");
    console.log("File:", req.file);
    console.log("Body after multer:", req.body);
    next();
  },
  updateProfile
);
router.post("/password/send-otp", verifyToken, sendPasswordOTP);
router.post("/password/change", verifyToken, changePassword);

// -------------------------
// Manager / Staff routes
// -------------------------
router.post("/staff/soft-delete", verifyToken, isManager, softDeleteUser);
router.post("/staff/restore", verifyToken, isManager, restoreUser);

// Update User (Manager hoặc có quyền users:update)
router.put(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("users:update"),
  updateUser
);

router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({ message: `Welcome Manager ${req.user.id || req.user._id}` });
});

router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({ message: `Welcome Staff ${req.user.id || req.user._id}` });
});

module.exports = router;
