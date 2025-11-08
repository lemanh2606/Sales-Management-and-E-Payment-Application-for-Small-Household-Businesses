// routers/financialRouters.js
const express = require("express");
const { getFinancialSummary, exportFinancial, generateEndOfDayReport } = require("../controllers/financialController");
const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const router = express.Router();

// GET /api/financial?storeId=...&periodType=...&periodKey=...
// Nếu có thêm phí ngoài lề thì nhập tay, API sẽ thành như dưới, giả sử có 2 khoản phí ngoài lề 1,000,000 và 2,000,000 VND:
// GET http://localhost:9999/api/financials?storeId=68e81dbffae46c6d9fe2e895&periodType=year&periodKey=2025&extraExpense=1000000,2000000
router.get("/", verifyToken, checkStoreAccess, requirePermission("reports:financial:view"), getFinancialSummary);
router.get(
  "/end-of-day/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("reports:endofday:view"),
  generateEndOfDayReport
);

// GET /api/financial/export?storeId=...&periodType=...&format=pdf|csv
router.get("/export", verifyToken, checkStoreAccess, requirePermission("reports:financial:export"), exportFinancial);

module.exports = router;
