const express = require("express");
const router = express.Router();
const {
  createStockCheck,
  getStockChecksByStore,
  getStockCheckById,
  updateStockCheck,
  deleteStockCheck,
} = require("../controllers/stock/stockCheckController");
const { verifyToken } = require("../middlewares/authMiddleware");

// ============= CRUD Routes cho StockCheck =============

// Tạo phiếu kiểm kho mới cho một cửa hàng
router.post("/stores/:storeId/stock-checks", verifyToken, createStockCheck);

// Lấy tất cả phiếu kiểm kho của một cửa hàng
router.get("/stores/:storeId/stock-checks", verifyToken, getStockChecksByStore);

// Lấy thông tin chi tiết một phiếu kiểm kho
router.get("/:checkId", verifyToken, getStockCheckById);

// Cập nhật phiếu kiểm kho
router.put("/:checkId", verifyToken, updateStockCheck);

// Xóa phiếu kiểm kho
router.delete("/:checkId", verifyToken, deleteStockCheck);

module.exports = router;
