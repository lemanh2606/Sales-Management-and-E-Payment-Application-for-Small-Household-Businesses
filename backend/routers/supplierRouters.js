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
} = require("../controllers/supplier/supplierController");

const { verifyToken, checkStoreAccess, isManager, requirePermission } = require("../middlewares/authMiddleware");

// Tạo nhà cung cấp mới cho cửa hàng
router.post("/stores/:storeId", verifyToken, checkStoreAccess, isManager, requirePermission("supplier:create"), createSupplier);

// Lấy danh sách nhà cung cấp trong cửa hàng
router.get("/stores/:storeId", verifyToken, checkStoreAccess, requirePermission("supplier:view"), getSuppliersByStore);

// Lấy thông tin chi tiết 1 nhà cung cấp
router.get("/:supplierId", verifyToken, requirePermission("supplier:view"), getSupplierById);

// Cập nhật thông tin nhà cung cấp
router.put("/:supplierId", verifyToken, isManager, requirePermission("supplier:update"), updateSupplier);

// Xóa nhà cung cấp (soft delete khuyến nghị)
router.delete("/:supplierId", verifyToken, isManager, requirePermission("supplier:delete"), deleteSupplier);

// Xuất danh sách nhà cung cấp trong cửa hàng ra file Excel
router.get("/stores/:storeId/export", verifyToken, checkStoreAccess, requirePermission("supplier:export"), exportSuppliersByStore);

module.exports = router;
