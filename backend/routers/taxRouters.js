// routes/taxRouters.js
const express = require("express");
const router = express.Router();
const {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  exportDeclaration,
} = require("../controllers/taxController");
const {
  verifyToken,
  isManager,
  checkStoreAccess,
} = require("../middlewares/authMiddleware");

/**
 * Flow:
 * 1️ Preview doanh thu hệ thống (chưa lưu DB)
 * 2️ Create tờ khai (bản gốc)
 * 3️ Update tờ khai
 * 4️ Clone (bản sao)
 * 5️ Delete tờ khai (Manager only)
 * 6️ List tất cả tờ khai theo cửa hàng/kỳ
 * 7️ Export CSV/PDF
 */

// 1️ PREVIEW: Xem tổng doanh thu hệ thống theo kỳ (chưa tạo DB)
router.get("/preview", verifyToken, checkStoreAccess, previewSystemRevenue);
// 2️ CREATE: Tạo tờ khai thuế mới (bản gốc)
router.post("/", verifyToken, checkStoreAccess, createTaxDeclaration);
// 3️ UPDATE: Cập nhật khai báo doanh thu
router.put("/:id", verifyToken, updateTaxDeclaration);
// 4️ CLONE: Tạo bản sao từ tờ khai cũ
router.post("/:id/clone", verifyToken, cloneTaxDeclaration);
// 5️ DELETE: Xóa tờ khai (chỉ Manager)
router.delete("/:id", verifyToken, isManager, deleteTaxDeclaration);
// 6️ LIST: Lấy danh sách tờ khai theo cửa hàng / kỳ
router.get("/", verifyToken, checkStoreAccess, listDeclarations); // Params: ?shopId=...&periodType=&periodKey=
// 7️ EXPORT: Xuất CSV/PDF
router.get("/:id/export", verifyToken, exportDeclaration); // /api/tax/:id/export?format=csv  OR  format=pdf

module.exports = router;
