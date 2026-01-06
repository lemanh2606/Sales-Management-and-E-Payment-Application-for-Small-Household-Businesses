// routers/operatingExpenseRouters.js
const express = require("express");
const { verifyToken, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const {
  create,
  getByPeriod,
  getTotalByPeriod,
  getAll,
  deleteItem,
  deleteItemWithCheckbox,
  update,
  hardDelete,
} = require("../controllers/operatingExpenseController");

const router = express.Router();

// ========== PROTECTED: Yêu cầu auth ==========

// POST: Tạo mới chi phí ngoài cho 1 kỳ báo cáo
router.post("/", verifyToken, create);

// GET: Lấy chi phí ngoài cho 1 kỳ báo cáo cụ thể (query: storeId, periodType, periodKey)
router.get("/by-period", verifyToken, getByPeriod);

// GET: Lấy tổng chi phí ngoài cho 1 kỳ (query: storeId, periodType, periodKey)
router.get("/total", verifyToken, getTotalByPeriod);

// GET: Lấy tất cả chi phí ngoài (có filter, query: storeId, periodType, status)
router.get("/", verifyToken, getAll);

// DELETE: Xoá 1 item trong danh sách
router.delete("/:id/item/:itemIndex", verifyToken, deleteItem);

// DELETE: Xoá nhiều items trong danh sách
router.delete("/:id/items", verifyToken, deleteItemWithCheckbox);

// PUT: Sửa chi phí ngoài (thay items hoặc status)
router.put("/:id", verifyToken, update);

// DELETE: Hard delete toàn bộ record (xoá cứng khỏi DB)
router.delete("/:id", verifyToken, hardDelete);

module.exports = router;
