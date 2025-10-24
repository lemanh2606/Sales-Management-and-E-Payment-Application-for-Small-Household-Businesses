// routes/stockCheckRouters.js
const express = require("express");
const router = express.Router();

const {
  createStockCheck,
  getStockChecksByStore,
  getStockCheckById,
  updateStockCheck,
  deleteStockCheck,
} = require("../controllers/stock/stockCheckController");

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  ROUTES QUẢN LÝ KIỂM KHO (Stock Check)
  -------------------------------------
  Mục tiêu:
  - Quản lý phiếu kiểm kho cho từng cửa hàng (multi-tenant)
  - Cần đăng nhập (verifyToken)
  - Cần thuộc cửa hàng (checkStoreAccess)
  - Phân quyền chi tiết qua requirePermission(...) dựa vào menu FE
  - Gợi ý các key menu (permission code) tương ứng:

      * inventory:stock-check:create     -> Tạo phiếu kiểm kho
      * inventory:stock-check:view       -> Xem danh sách phiếu kiểm kho
      * inventory:stock-check:detail     -> Xem chi tiết 1 phiếu kiểm kho
      * inventory:stock-check:update     -> Cập nhật phiếu kiểm kho
      * inventory:stock-check:delete     -> Xóa phiếu kiểm kho

  ⚙ FE khi đăng nhập → gửi menu quyền của user trong token payload hoặc qua DB
  ⚙ BE sẽ dùng middleware requirePermission để quyết định truy cập.
*/

//  TẠO phiếu kiểm kho (chỉ nhân viên có quyền create)
router.post(
  "/stores/:storeId/stock-checks",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:stock-check:create"),
  createStockCheck
);

//  LẤY danh sách phiếu kiểm kho theo cửa hàng
router.get(
  "/stores/:storeId/stock-checks",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:stock-check:view"),
  getStockChecksByStore
);

//  LẤY chi tiết 1 phiếu kiểm kho
router.get(
  "/:checkId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:stock-check:detail"),
  getStockCheckById
);

//  CẬP NHẬT phiếu kiểm kho
router.put(
  "/:checkId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:stock-check:update"),
  updateStockCheck
);

//  XOÁ (hoặc huỷ) phiếu kiểm kho
router.delete(
  "/:checkId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:stock-check:delete"),
  deleteStockCheck
);

module.exports = router;
