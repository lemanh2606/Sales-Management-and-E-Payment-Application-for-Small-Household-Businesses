// routers/financialRouters.js
const express = require("express");
const { getFinancialSummary, exportFinancial } = require("../controllers/financialController");
const {
  verifyToken,
  isManager,  
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");
const router = express.Router();


// GET /api/financial?storeId=...&periodType=...&periodKey=...
router.get("/", verifyToken, checkStoreAccess, requirePermission("reports:financial:view"), getFinancialSummary);

// GET /api/financial/export?storeId=...&periodType=...&format=pdf|csv
router.get("/export", verifyToken, checkStoreAccess, requirePermission("reports:financial:export"), exportFinancial);

module.exports = router;
