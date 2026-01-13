// backend/routers/supplierRouters.js
const express = require("express");
const router = express.Router();

const {
  createSupplier,
  getSuppliersByStore,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  exportSuppliersByStore,
  restoreSupplier, // ✅ thêm
} = require("../controllers/supplier/supplierController");

const {
  verifyToken,
  checkStoreAccess,

  requirePermission,
} = require("../middlewares/authMiddleware");

// Tạo nhà cung cấp mới cho cửa hàng
router.post(
  "/stores/:storeId",
  verifyToken,
  checkStoreAccess,

  requirePermission("suppliers:create"),
  createSupplier
);

// Lấy danh sách nhà cung cấp trong cửa hàng
router.get(
  "/stores/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("suppliers:view"),
  getSuppliersByStore
);

// Xuất danh sách nhà cung cấp trong cửa hàng ra file Excel
router.get(
  "/stores/:storeId/export",
  verifyToken,
  checkStoreAccess,
  requirePermission("suppliers:export"),
  exportSuppliersByStore
);

// ✅ Khôi phục nhà cung cấp đã bị xóa (soft delete restore)
// Lưu ý: đặt trước "/:supplierId" để không bị route param bắt nhầm. [web:52][web:53]
router.put(
  "/:id/restore",
  verifyToken,
  requirePermission("suppliers:restore"),
  restoreSupplier
);

// Lấy thông tin chi tiết 1 nhà cung cấp
router.get(
  "/:supplierId",
  verifyToken,
  requirePermission("suppliers:view"),
  getSupplierById
);

// Cập nhật thông tin nhà cung cấp
router.put(
  "/:supplierId",
  verifyToken,

  requirePermission("suppliers:update"),
  updateSupplier
);

// Xóa nhà cung cấp (soft delete khuyến nghị)
router.delete(
  "/:supplierId",
  verifyToken,

  requirePermission("suppliers:delete"),
  deleteSupplier
);

module.exports = router;
