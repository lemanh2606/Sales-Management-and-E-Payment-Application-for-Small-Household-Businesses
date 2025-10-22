const express = require("express");
const router = express.Router();
const {
  registerManager,
  verifyOtp,
  login,
  updateProfile,
  sendPasswordOTP,
  changePassword,
  softDeleteUser,
  restoreUser,
} = require("../controllers/user/userController");
const {
  verifyToken,
  isManager,
  isStaff,
} = require("../middlewares/authMiddleware");

// Public routes
router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);

// Protected routes (profile, password – verifyToken)
router.put("/profile", verifyToken, updateProfile); // Thay đổi thông tin cá nhân
router.post("/password/send-otp", verifyToken, sendPasswordOTP); // Gửi OTP đổi pass
router.post("/password/change", verifyToken, changePassword); // Verify OTP + đổi pass
router.post("/delete-staff", verifyToken, isManager, softDeleteUser); // Manager xóa mềm staff theo store hiện tại
router.post("/restore-staff", verifyToken, isManager, restoreUser); // Manager khôi phục staff theo store hiện tại
// Ví dụ route bảo vệ chỉ Manager mới truy cập được
router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({ message: `Welcome Manager ${req.user.id}` });
});

// Ví dụ route bảo vệ chỉ Staff mới truy cập được
router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({ message: `Welcome Staff ${req.user.id}` });
});

module.exports = router;
