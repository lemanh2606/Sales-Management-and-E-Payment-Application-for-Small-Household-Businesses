const express = require("express");
const router = express.Router();
const { registerManager, login, verifyOtp } = require("../controllers/userController");
const { verifyToken, isManager, isStaff } = require("../middlewares/authMiddleware");

// Public routes
router.post("/register", registerManager);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);

// Ví dụ route bảo vệ chỉ Manager mới truy cập được
router.get("/manager-dashboard", verifyToken, isManager, (req, res) => {
  res.json({ message: `Welcome Manager ${req.user.id}` });
});

// Ví dụ route bảo vệ chỉ Staff mới truy cập được
router.get("/staff-dashboard", verifyToken, isStaff, (req, res) => {
  res.json({ message: `Welcome Staff ${req.user.id}` });
});

module.exports = router;
