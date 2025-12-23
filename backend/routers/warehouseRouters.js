// routes/warehouseRoutes.js
const express = require("express");
const router = express.Router();
const { verifyToken, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  restoreWarehouse,
  setDefaultWarehouse,
} = require("../controllers/warehouseController");

// ==================== PUBLIC (nếu cần) ====================
// Thường tất cả route kho nên bảo vệ -> không khai báo public ở đây

// ==================== PROTECTED ROUTES (theo store) ====================
// Prefix dự kiến: /api/stores/:storeId/warehouses...

// Lấy danh sách kho theo store
router.get("/:storeId/warehouses", verifyToken, checkStoreAccess, requirePermission("warehouses:view"), getWarehouses);

// Lấy chi tiết 1 kho
router.get("/:storeId/warehouses/:warehouseId", verifyToken, checkStoreAccess, requirePermission("warehouses:view"), getWarehouseById);

// Tạo kho mới
router.post("/:storeId/warehouses", verifyToken, checkStoreAccess, requirePermission("warehouses:create"), createWarehouse);

// Cập nhật kho
router.put("/:storeId/warehouses/:warehouseId", verifyToken, checkStoreAccess, requirePermission("warehouses:update"), updateWarehouse);

// Xóa mềm kho
router.delete("/:storeId/warehouses/:warehouseId", verifyToken, checkStoreAccess, requirePermission("warehouses:delete"), deleteWarehouse);

// Khôi phục kho đã xóa
router.patch("/:storeId/warehouses/:warehouseId/restore", verifyToken, checkStoreAccess, requirePermission("warehouses:update"), restoreWarehouse);

// Đặt kho mặc định
router.patch(
  "/:storeId/warehouses/:warehouseId/set-default",
  verifyToken,
  checkStoreAccess,
  requirePermission("warehouses:update"),
  setDefaultWarehouse
);

module.exports = router;
