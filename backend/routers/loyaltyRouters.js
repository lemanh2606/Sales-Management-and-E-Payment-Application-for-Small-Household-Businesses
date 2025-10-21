// routes/loyaltyRouters.js
const express = require("express");
const router = express.Router();
const { setupLoyaltyConfig, getLoyaltyConfig } = require("../controllers/loyaltyController");
const { verifyToken, isManager, checkStoreAccess } = require("../middlewares/authMiddleware"); // Middleware xác thực/quyền

// POST /api/loyalty/config/:storeId - Manager setup config (chỉ owner store)
router.post("/config/:storeId", verifyToken, checkStoreAccess, isManager, setupLoyaltyConfig);
// GET /api/loyalty/config/:storeId - Lấy config (owner/staff store)
router.get("/config/:storeId", verifyToken, checkStoreAccess, getLoyaltyConfig);

module.exports = router;
