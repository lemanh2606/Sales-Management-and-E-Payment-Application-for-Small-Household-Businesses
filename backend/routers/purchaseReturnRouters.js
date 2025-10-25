// routes/purchaseReturnRouters.js
const express = require("express");
const router = express.Router();

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
  isManager, // vẫn giữ để fallback khi cần
} = require("../middlewares/authMiddleware");

const {
  createPurchaseReturn,
  getPurchaseReturnsByStore,
  getPurchaseReturnById,
  updatePurchaseReturn,
  deletePurchaseReturn,
} = require("../controllers/purchase/purchaseReturnController");

/*
  PHÂN QUYỀN CHUẨN CHO PURCHASE RETURN:

  - verifyToken: xác thực đăng nhập
  - checkStoreAccess: đảm bảo user thuộc store đang thao tác, gán req.store và req.storeRole
  - requirePermission("purchase-returns:<action>"): kiểm tra user.menu có quyền tương ứng
    * purchase-returns:create
    * purchase-returns:view
    * purchase-returns:update
    * purchase-returns:delete

  - Nếu muốn ép manager/owner mới được thực hiện thao tác nào đó → thêm `isManager`
*/

// TẠO phiếu trả hàng nhập mới (thường manager mới được)
router.post(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-returns:create"),
  createPurchaseReturn
);

// LẤY danh sách phiếu trả hàng trong 1 store
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-returns:view"),
  getPurchaseReturnsByStore
);

// LẤY chi tiết phiếu trả hàng theo ID
// Quy tắc "get by ID" -> đặt cuối nhóm GET
router.get(
  "/:returnId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-returns:view"),
  getPurchaseReturnById
);

// CẬP NHẬT phiếu trả hàng
router.put(
  "/:returnId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-returns:update"),
  updatePurchaseReturn
);

// XOÁ phiếu trả hàng (hoặc hủy)
// Có thể thay requirePermission bằng isManager nếu muốn giới hạn quyền cứng
router.delete(
  "/:returnId",
  verifyToken,
  checkStoreAccess,
  requirePermission("purchase-returns:delete"),
  deletePurchaseReturn
);

module.exports = router;
