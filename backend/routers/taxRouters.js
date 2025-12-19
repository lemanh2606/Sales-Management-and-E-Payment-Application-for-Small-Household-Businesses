// routes/taxRoutes.js - ✅ BẢN ĐÃ XÓA 404 HANDLER
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const {
  verifyToken,
  requirePermission,
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
// ✅ QUAN TRỌNG: Đặt routes theo thứ tự chính xác

// 1. Routes cụ thể không có :id
router.get(
  "/preview",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:preview"),
  previewSystemRevenue
);

router.get(
  "/",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:list"),
  listDeclarations
);

router.post(
  "/",
  verifyToken,
  taxStoreAccess,
  requirePermission("tax:create"),
  createTaxDeclaration
);

// 2. Routes cụ thể với :id và path phụ
router.post(
  "/:id/clone",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:clone"),
  cloneTaxDeclaration
);

router.post(
  "/:id/approve",
  verifyToken,
  validateObjectId,
  taxStoreAccess,

  requirePermission("tax:approve"),
  approveRejectDeclaration
);

router.get(
  "/:id/export",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:export"),
  exportDeclaration
);

// 3. Routes chính với :id - THEO THỨ TỰ QUAN TRỌNG
// PUT phải được định nghĩa và không bị conflict
router.put(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:update"),
  (req, res, next) => {
    console.log(
      `   🟢 [ROUTE MATCHED] PUT /:id - Calling updateTaxDeclaration`
    );
    next();
  },
  updateTaxDeclaration
);

router.delete(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,

  requirePermission("tax:delete"),
  deleteTaxDeclaration
);

// 4. GET /:id phải ĐẶT CUỐI CÙNG để không ghi đè các routes khác
router.get(
  "/:id",
  verifyToken,
  validateObjectId,
  taxStoreAccess,
  requirePermission("tax:view"),
  (req, res, next) => {
    console.log(`   🟢 [ROUTE MATCHED] GET /:id - Calling getDeclaration`);
    next();
  },
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

// ⚠️ XÓA HOÀN TOÀN PHẦN 404 HANDLER NÀY
// KHÔNG đặt 404 handler trong router con

module.exports = router;
