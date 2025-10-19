const express = require("express");
const router = express.Router();

const { verifyToken, isManager } = require("../middlewares/authMiddleware");
const {
  createPurchaseReturn,
  getPurchaseReturnsByStore,
  getPurchaseReturnById,
  updatePurchaseReturn,
  deletePurchaseReturn,
} = require("../controllers/purchase/purchaseReturnController");

// Routes cho quản lý phiếu trả hàng nhập

// Tạo phiếu trả hàng mới
router.post("/store/:storeId", verifyToken, isManager, createPurchaseReturn);

// Lấy tất cả phiếu trả hàng của cửa hàng
router.get("/store/:storeId", verifyToken, getPurchaseReturnsByStore);

// Lấy chi tiết phiếu trả hàng
router.get("/:returnId", verifyToken, getPurchaseReturnById);

// Cập nhật phiếu trả hàng
router.put("/:returnId", verifyToken, isManager, updatePurchaseReturn);

// Hủy phiếu trả hàng
router.delete("/:returnId", verifyToken, isManager, deletePurchaseReturn);

module.exports = router;
