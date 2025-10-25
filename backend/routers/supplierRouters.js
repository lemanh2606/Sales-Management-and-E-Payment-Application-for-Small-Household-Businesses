// backend/routers/supplierRouters.js
const express = require("express");
const router = express.Router();

const {
  createSupplier,
  getSuppliersByStore,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplier/supplierController");

const {
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  ROUTES QUẢN LÝ NHÀ CUNG CẤP (Supplier Management)
  --------------------------------------------------
  Phân quyền gợi ý:
  * supplier:create       -> Tạo nhà cung cấp
  * supplier:view         -> Xem danh sách / chi tiết nhà cung cấp
  * supplier:update       -> Chỉnh sửa thông tin nhà cung cấp
  * supplier:delete       -> Xóa nhà cung cấp
*/

//
// ===================== SUPPLIER ROUTES =====================
//

// Tạo nhà cung cấp mới cho cửa hàng
router.post(
  "/stores/:storeId",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("supplier:create"),
  createSupplier
);

// Lấy danh sách nhà cung cấp trong cửa hàng
router.get(
  "/stores/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("supplier:view"),
  getSuppliersByStore
);

// Lấy thông tin chi tiết 1 nhà cung cấp
router.get(
  "/:supplierId",
  verifyToken,
  requirePermission("supplier:view"),
  getSupplierById
);

// Cập nhật thông tin nhà cung cấp
router.put(
  "/:supplierId",
  verifyToken,
  isManager,
  requirePermission("supplier:update"),
  updateSupplier
);

// Xóa nhà cung cấp (soft delete khuyến nghị)
router.delete(
  "/:supplierId",
  verifyToken,
  isManager,
  requirePermission("supplier:delete"),
  deleteSupplier
);

module.exports = router;
