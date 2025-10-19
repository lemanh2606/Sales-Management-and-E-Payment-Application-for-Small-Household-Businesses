const {
  registerManager,
  verifyOtp,
  login,
  updateProfile,
  sendPasswordOTP,
  changePassword,
} = require("../controllers/user/userController");
const {
  verifyToken,
  isManager,
  isStaff,
} = require("../middlewares/authMiddleware");
const router = require("./storeRouters");

// Public routes
router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);

// Protected routes (profile, password – verifyToken)
router.put("/profile", verifyToken, updateProfile); // Thay đổi thông tin cá nhân
router.post("/password/send-otp", verifyToken, sendPasswordOTP); // Gửi OTP đổi pass
router.post("/password/change", verifyToken, changePassword); // Verify OTP + đổi pass

// Ví dụ route bảo vệ chỉ Manager mới truy cập được
router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({ message: `Welcome Manager ${req.user.id}` });
});

// Ví dụ route bảo vệ chỉ Staff mới truy cập được
router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({ message: `Welcome Staff ${req.user.id}` });
});

module.exports = router;
