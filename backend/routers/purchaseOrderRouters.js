const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middlewares/authMiddleware");
const {
  createPurchaseOrder,
  getPurchaseOrdersByStore,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
} = require("../controllers/purchase/purchaseOrderController");

// ============= CRUD Routes cho Purchase Order =============

// Tạo đơn nhập hàng mới cho một cửa hàng
router.post("/store/:storeId", verifyToken, createPurchaseOrder);

// Lấy tất cả đơn nhập hàng của một cửa hàng
router.get("/store/:storeId", verifyToken, getPurchaseOrdersByStore);

// Lấy thông tin chi tiết một đơn nhập hàng
router.get("/:orderId", verifyToken, getPurchaseOrderById);

// Cập nhật đơn nhập hàng
router.put("/:orderId", verifyToken, updatePurchaseOrder);

// Xóa đơn nhập hàng
router.delete("/:orderId", verifyToken, deletePurchaseOrder);

module.exports = router;
