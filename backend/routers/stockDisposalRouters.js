// routes/stockDisposalRouters.js
const express = require("express");
const router = express.Router();

const stockDisposalController = require("../controllers/stock/stockDisposalController");
const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  ROUTES QUẢN LÝ PHIẾU XUẤT HỦY (Stock Disposal)
  ------------------------------------------------
  Mục tiêu:
  - Tất cả thao tác liên quan phiếu xuất hủy đều thuộc phạm vi cửa hàng (store-based).
  - Luồng chuẩn cho mỗi route:
      1) verifyToken        -> yêu cầu đăng nhập
      2) checkStoreAccess   -> xác định store context (gán req.store, req.storeRole)
      3) requirePermission  -> kiểm tra permission chi tiết trong user.menu (hỗ trợ global và scoped)
  - Quy ước permission gợi ý (lưu trong user.menu):
      * inventory:disposal:create   -> tạo phiếu xuất hủy
      * inventory:disposal:view     -> xem danh sách / xem chi tiết
      * inventory:disposal:update   -> cập nhật phiếu
      * inventory:disposal:delete   -> xóa/hủy phiếu
  - Nếu bạn muốn giới hạn một hành động chỉ cho OWNER/Manager, có thể thay requirePermission bằng isManager
    hoặc kiểm tra req.storeRole === "OWNER" trong middleware/controller.
*/

/*
  POST /api/stock-disposals/store/:storeId
  - Tạo phiếu xuất hủy mới trong cửa hàng
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("inventory:disposal:create")
*/
router.post(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:disposal:create"),
  stockDisposalController.createStockDisposal
);

/*
  GET /api/stock-disposals/store/:storeId
  - Lấy tất cả phiếu xuất hủy của một cửa hàng
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("inventory:disposal:view")
*/
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:disposal:view"),
  stockDisposalController.getStockDisposalsByStore
);

/*
  GET /api/stock-disposals/:disposalId
  - Lấy chi tiết một phiếu xuất hủy theo ID
  - Đặt sau các route /store theo rule "get by ID ở cuối"
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("inventory:disposal:view")
*/
router.get(
  "/:disposalId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:disposal:view"),
  stockDisposalController.getStockDisposalById
);

/*
  PUT /api/stock-disposals/:disposalId
  - Cập nhật thông tin phiếu xuất hủy
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("inventory:disposal:update")
*/
router.put(
  "/:disposalId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:disposal:update"),
  stockDisposalController.updateStockDisposal
);

/*
  DELETE /api/stock-disposals/:disposalId
  - Xóa hoặc hủy phiếu xuất hủy (tùy controller xử lý soft/hard delete)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("inventory:disposal:delete")
  - Nếu muốn chỉ owner mới xóa, thay requirePermission bằng kiểm tra req.storeRole === "OWNER" hoặc isManager.
*/
router.delete(
  "/:disposalId",
  verifyToken,
  checkStoreAccess,
  requirePermission("inventory:disposal:delete"),
  stockDisposalController.deleteStockDisposal
);

module.exports = router;
