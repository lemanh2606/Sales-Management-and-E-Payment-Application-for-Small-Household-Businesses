// routes/purchaseOrderRouters.js
const express = require("express");
const router = express.Router();

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
  isManager,
} = require("../middlewares/authMiddleware");

const {
  createPurchaseOrder,
  getPurchaseOrdersByStore,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
} = require("../controllers/purchase/purchaseOrderController");

/*
  GHI CHÚ CHUNG VỀ PHÂN QUYỀN CHO PURCHASE ORDER:
  - Các hành động liên quan đơn nhập hàng thường thuộc phạm vi cửa hàng (store-based).
  - Luồng chuẩn:
      1) verifyToken            -> đảm bảo user đã đăng nhập
      2) checkStoreAccess       -> xác định context store (gán req.store, req.storeRole)
      3) requirePermission(...) -> kiểm tra quyền chi tiết trong user.menu
  - Quy ước permission gợi ý:
      * purchase-orders:create   -> tạo đơn nhập
      * purchase-orders:view     -> xem danh sách/chi tiết
      * purchase-orders:update   -> cập nhật đơn nhập
      * purchase-orders:delete   -> xóa đơn nhập
  - Hỗ trợ scoped permission theo store: "store:<storeId>:purchase-orders:..." nếu bạn muốn giới hạn theo cửa hàng cụ thể.
  - Nếu bạn muốn giới hạn triệt để quyền xóa cho MANAGER/OWNER, có thể giữ isManager hoặc kiểm tra req.storeRole === "OWNER".
*/

/*
  POST /api/purchase-orders/store/:storeId
  - Tạo đơn nhập cho cửa hàng
  - Middleware:
      verifyToken -> checkStoreAccess -> requirePermission("purchase-orders:create")
*/
router.post(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-orders:create"),
  createPurchaseOrder
);

/*
  GET /api/purchase-orders/store/:storeId
  - Lấy tất cả đơn nhập của cửa hàng
  - Middleware:
      verifyToken -> checkStoreAccess -> requirePermission("purchase-orders:view")
*/
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-orders:view"),
  getPurchaseOrdersByStore
);

/*
  GET /api/purchase-orders/:orderId
  - Lấy chi tiết một đơn nhập theo ID
  - Đặt cuối cùng theo quy tắc 'get by ID'
  - Middleware:
      verifyToken -> checkStoreAccess -> requirePermission("purchase-orders:view")
*/
router.get(
  "/:orderId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-orders:view"),
  getPurchaseOrderById
);

/*
  PUT /api/purchase-orders/:orderId
  - Cập nhật đơn nhập (ví dụ thay đổi trạng thái, chỉnh số lượng, giá)
  - Middleware:
      verifyToken -> checkStoreAccess -> requirePermission("purchase-orders:update")
  - Nếu bạn muốn hạn chế cập nhật chỉ OWNER mới được phép, thay requirePermission bằng kiểm tra req.storeRole === "OWNER" hoặc thêm isManager/logic tương tự.
*/
router.put(
  "/:orderId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-orders:update"),
  updatePurchaseOrder
);

/*
  DELETE /api/purchase-orders/:orderId
  - Xóa đơn nhập (soft delete hoặc hard delete tùy controller)
  - Hiện tại mặc định dùng permission granular "purchase-orders:delete"
  - Nếu bạn muốn chỉ owner/manager mới xóa được, thay bằng isManager hoặc kiểm tra req.storeRole === "OWNER"
*/
router.delete(
  "/:orderId",
  verifyToken,
  checkStoreAccess,
  // Nếu muốn chỉ Manager/Owner: thay dòng dưới bằng isManager hoặc custom middleware kiểm tra req.storeRole === "OWNER"
  requirePermission("purchase-orders:delete"),
  deletePurchaseOrder
);

module.exports = router;
