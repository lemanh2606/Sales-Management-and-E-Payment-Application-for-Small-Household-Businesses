const express = require("express");
const router = express.Router();
const {
  createSupplier,
  getSuppliersByStore,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplier/supplierController");
const { verifyToken } = require("../middlewares/authMiddleware");

// ============= CRUD Routes cho Supplier =============

// Tạo nhà cung cấp mới cho một cửa hàng
router.post("/stores/:storeId", verifyToken, createSupplier);

// Lấy tất cả nhà cung cấp của một cửa hàng
router.get("/stores/:storeId", verifyToken, getSuppliersByStore);

// Lấy thông tin chi tiết một nhà cung cấp
router.get("/:supplierId", verifyToken, getSupplierById);

// Cập nhật nhà cung cấp
router.put("/:supplierId", verifyToken, updateSupplier);

// Xóa nhà cung cấp
router.delete("/:supplierId", verifyToken, deleteSupplier);

module.exports = router;
