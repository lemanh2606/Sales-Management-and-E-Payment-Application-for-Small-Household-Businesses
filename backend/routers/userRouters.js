const express = require("express");
const router = express.Router();
const {
  registerManager,
  verifyOtp,
  login,
  refreshToken,
  updateProfile,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
  sendForgotPasswordOTP, // public forgot password
  forgotChangePassword, //  public forgot password
} = require("../controllers/user/userController");
const {
  verifyToken,
  isManager,
  isStaff,
} = require("../middlewares/authMiddleware");

// -------------------------
// Public routes
// -------------------------
router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);

// Public Forgot Password routes (không cần login)
router.post("/forgot-password/send-otp", sendForgotPasswordOTP); // Nhập email, nhận OTP
router.post("/forgot-password/change", forgotChangePassword); // Nhập email + OTP + pass mới

// Refresh token route (dùng cookie refreshToken)
router.get("/refresh-token", refreshToken);

// -------------------------
// Protected routes (cần login)
// -------------------------
router.put("/profile", verifyToken, updateProfile); // Thay đổi thông tin cá nhân
router.post("/password/send-otp", verifyToken, sendPasswordOTP); // Gửi OTP đổi pass
router.post("/password/change", verifyToken, changePassword); // Verify OTP + đổi pass

// Manager routes
router.post("/staff/soft-delete", verifyToken, isManager, softDeleteUser); // Xóa mềm staff theo store hiện tại
router.post("/staff/restore", verifyToken, isManager, restoreUser); // Khôi phục staff theo store hiện tại

// Dashboard routes
router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({ message: `Welcome Manager ${req.user.id}` });
});
router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({ message: `Welcome Staff ${req.user.id}` });
});

module.exports = router;
