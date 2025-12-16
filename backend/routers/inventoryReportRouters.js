//backend/router/inventoryReportRouters.js
const express = require("express");
const router = express.Router();
const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const { getInventoryReport } = require("../controllers/inventoryReport");

//server: http://localhost:9999
// # Tháng 10/2025
// GET /api/inventory-reports?storeId=68f8f19a4d723cad0bda9fa5&periodType=month&periodKey=2025-10

// # Quý 4/2025
// GET http://localhost:9999/api/inventory-reports?storeId=68f8f19a4d723cad0bda9fa5&periodType=quarter&periodKey=2025-Q4

// # Cả năm 2025
// GET http://localhost:9999/api/inventory-reports?storeId=68f8f19a4d723cad0bda9fa5&periodType=year&periodKey=2025

// # Tùy chỉnh từ T1->T6/2025
// GET http://localhost:9999/api/inventory-reports?storeId=68f8f19a4d723cad0bda9fa5&periodType=custom&monthFrom=2025-01&monthTo=2025-06

// # Realtime (không kỳ)
// GET http://localhost:9999/api/inventory-reports?storeId=68f8f19a4d723cad0bda9fa5

router.get(
  "/",
  verifyToken,
  isManager,
  checkStoreAccess,
  requirePermission("inventory:stock-check:view"),
  getInventoryReport
);

module.exports = router;