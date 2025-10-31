// routes/revenueRouters.js
const express = require("express");
const router = express.Router();
const { getRevenueByPeriod, getRevenueByEmployee, exportRevenue } = require("../controllers/revenueController");
const { verifyToken, checkStoreAccess, requirePermission, isManager } = require("../middlewares/authMiddleware");

//GET http://localhost:9999/api/revenues?storeId=<id>&periodType=month&periodKey=2025-10
router.get("/", verifyToken, checkStoreAccess, requirePermission("reports:revenue:view"), getRevenueByPeriod);

//GET http://localhost:9999/api/revenues/employee?storeId=<id>&periodType=month&periodKey=2025-10
router.get("/employee", verifyToken, checkStoreAccess, requirePermission("reports:revenue:employee"), getRevenueByEmployee);

//GET http://localhost:9999/api/revenues/export?storeId=<id>&periodType=month&periodKey=2025-10&format=pdf&type=employee
//GET http://localhost:9999/api/revenues/export?storeId=<id>&periodType=month&periodKey=2025-10&format=csv&type=total
router.get("/export", verifyToken, checkStoreAccess, requirePermission("reports:revenue:export"), exportRevenue);

module.exports = router;
