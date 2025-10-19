// routes/revenueRouters.js (route báo cáo doanh thu - tạo file mới)
const express = require("express");
const router = express.Router();
const {
  getRevenueByPeriod,
  getRevenueByEmployee,
  exportRevenue,
} = require("../controllers/revenueController");
const {
  verifyToken,
  checkStoreAccess,
} = require("../middlewares/authMiddleware");

// Tổng doanh thu theo period
router.get("/", verifyToken, checkStoreAccess, getRevenueByPeriod);
// Doanh thu theo nhân viên
router.get("/employee", verifyToken, checkStoreAccess, getRevenueByEmployee);
// Export CSV/PDF
router.get("/export", verifyToken, checkStoreAccess, exportRevenue);

module.exports = router;
