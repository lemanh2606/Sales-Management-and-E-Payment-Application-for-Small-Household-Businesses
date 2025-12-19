// routes/revenueRouters.js
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
  requirePermission,
} = require("../middlewares/authMiddleware");

//GET http://localhost:9999/api/revenues?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10
router.get(
  "/",
  verifyToken,
  requirePermission("reports:revenue:view"),
  getRevenueByPeriod
);

//GET http://localhost:9999/api/revenues/employee?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10
router.get(
  "/employee",
  verifyToken,
  requirePermission("reports:revenue:employee"),
  getRevenueByEmployee
);

//router export ra file có 4 kiểu: total hoặc employee với dạng csv/pdf
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=pdf&type=employee
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=pdf&type=total
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=csv&type=employee
//GET http://localhost:9999/api/revenues/export?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10&format=csv&type=total
router.get(
  "/export",
  verifyToken,
  requirePermission("reports:revenue:export"),
  exportRevenue
);

module.exports = router;
