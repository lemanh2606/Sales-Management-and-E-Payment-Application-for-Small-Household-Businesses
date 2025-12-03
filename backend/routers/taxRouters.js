// routes/taxRoutes.js - ✅ BẢN ĐẦY ĐỦ ĐÃ FIX
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const {
  verifyToken,
  requirePermission,
  isManager,
} = require("../middlewares/authMiddleware");

const {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  getDeclaration,
  approveRejectDeclaration,
  exportDeclaration,
} = require("../controllers/tax/taxController");

const TaxDeclaration = require("../models/TaxDeclaration");

// ==================== LOGGING MIDDLEWARE ====================
router.use((req, res, next) => {
  console.log(`📋 [TAX] ${req.method} ${req.originalUrl}`);
  console.log(`   Query:`, req.query);
  console.log(`   Params:`, req.params);
  console.log(
    `   Body:`,
    req.body?.storeId ? { storeId: req.body.storeId } : "no storeId"
  );
  next();
});

// ==================== FIXED MIDDLEWARE ====================
const taxStoreAccess = async (req, res, next) => {
  try {
    let storeId = null;

    // 1. Ưu tiên query/body/header
    if (req.query?.storeId) storeId = req.query.storeId;
    if (!storeId && req.body?.storeId) storeId = req.body.storeId;
    if (!storeId && req.headers?.["x-store-id"])
      storeId = req.headers["x-store-id"];

    // 2. Nếu vẫn chưa có, thử lấy từ req.user
    if (!storeId && req.user?.storeId) {
      storeId = req.user.storeId;
    }
    if (!storeId && req.user?.currentStore?._id) {
      storeId = req.user.currentStore._id;
    }

    // 3. Nếu có :id => lấy từ TaxDeclaration
    if (!storeId && req.params?.id) {
      console.log(
        `   🔍 Trying to get storeId from TaxDeclaration ID: ${req.params.id}`
      );

      // Validate ObjectId trước khi query
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.log(`   ❌ Invalid ObjectId: ${req.params.id}`);
        return res.status(400).json({
          success: false,
          message: "ID không hợp lệ",
        });
      }

      try {
        const doc = await TaxDeclaration.findById(req.params.id).select(
          "shopId"
        );
        if (doc?.shopId) {
          storeId = doc.shopId.toString();
          console.log(`   ✅ Found storeId from declaration: ${storeId}`);
        } else {
          console.log(`   ⚠️ Declaration not found or no shopId`);
        }
      } catch (dbError) {
        console.error(`   ❌ DB error getting declaration:`, dbError);
        return res.status(500).json({
          success: false,
          message: "Lỗi truy vấn tờ khai",
        });
      }
    }

    if (!storeId) {
      console.log(`   ❌ No storeId found in request`);
      return res.status(400).json({
        success: false,
        message: "Thiếu storeId (query/body/header/user/declaration)",
      });
    }

    console.log(`   ✅ storeId resolved: ${storeId}`);
    req.storeId = storeId;
    req.currentStoreId = storeId;
    next();
  } catch (error) {
    console.error("❌ taxStoreAccess error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra store access",
      error: error.message,
    });
  }
};

// ==================== VALIDATE ID MIDDLEWARE ====================
const validateObjectId = (req, res, next) => {
  if (req.params.id && !mongoose.Types.ObjectId.isValid(req.params.id)) {
    console.log(`   ❌ Invalid ObjectId in params: ${req.params.id}`);
    return res.status(400).json({
      success: false,
      message: `ID không hợp lệ: ${req.params.id}`,
    });
  }
  next();
};

// ==================== ROUTES ====================
// ✅ QUAN TRỌNG: Đặt routes cụ thể TRƯỚC routes động (:id)

// 1. Preview (route cụ thể)
router.get(
  "/preview",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:preview"),
  previewSystemRevenue
);

// 2. List (route cụ thể)
router.get(
  "/",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:list"),
  listDeclarations
);

// 3. Create (POST /)
router.post(
  "/",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:create"),
  createTaxDeclaration
);

// 4. Clone (POST /:id/clone) - ĐẶT TRƯỚC /:id
router.post(
  "/:id/clone",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:clone"),
  cloneTaxDeclaration
);

// 5. Approve (POST /:id/approve) - ĐẶT TRƯỚC /:id
router.post(
  "/:id/approve",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  isManager,
  requirePermission("tax:approve"),
  approveRejectDeclaration
);

// 6. Export (GET /:id/export) - ĐẶT TRƯỚC /:id
router.get(
  "/:id/export",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:export"),
  exportDeclaration
);

// 7. Update (PUT /:id) - ĐẶT SAU CÁC ROUTES CỤ THỂ
router.put(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:update"),
  (req, res, next) => {
    console.log(
      `   ✅ PUT /:id middleware passed, calling updateTaxDeclaration`
    );
    next();
  },
  updateTaxDeclaration
);

// 8. Delete (DELETE /:id)
router.delete(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  isManager,
  requirePermission("tax:delete"),
  deleteTaxDeclaration
);

// 9. Get single (GET /:id) - ĐẶT CUỐI CÙNG
router.get(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:view"),
  getDeclaration
);

// ==================== ERROR HANDLER ====================
router.use((err, req, res, next) => {
  console.error("❌ Tax route error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Lỗi server",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

module.exports = router;
