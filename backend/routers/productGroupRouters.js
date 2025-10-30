// routes/productGroupRouters.js
const express = require("express");
const router = express.Router();

const productGroupController = require("../controllers/productGroup/productGroupController");
const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

/*
  GHI CHÚ CHUNG:
  - Các thao tác với nhóm sản phẩm đều thuộc phạm vi cửa hàng (store-based).
  - Do đó:
      + verifyToken → user phải đăng nhập
      + checkStoreAccess → đảm bảo user có quyền tại cửa hàng đó (MANAGER hoặc STAFF được gán)
      + requirePermission(...) → kiểm tra quyền chi tiết theo menu user (FE + BE đồng bộ)
  - Quy ước permission gợi ý cho menu:
      * product-groups:create
      * product-groups:view
      * product-groups:update
      * product-groups:delete
  - Nếu bạn lưu menu theo store scope (store:<storeId>:...), middleware requirePermission() đã hỗ trợ sẵn.
*/

/*
  GET /api/product-groups/template/download
  - Tải template import Excel/CSV
*/
router.get("/template/download", verifyToken, productGroupController.downloadProductGroupTemplate);

/*
  POST /api/product-groups/store/:storeId/import
  - Import nhóm sản phẩm từ Excel/CSV
*/
router.post(
  "/store/:storeId/import",
  verifyToken,
  checkStoreAccess,
  upload.single("file"),
  requirePermission("product-groups:create"),
  productGroupController.importProductGroups
);

/*
  POST /api/product-groups/store/:storeId
  - Tạo nhóm sản phẩm mới trong cửa hàng
  - Chỉ MANAGER hoặc STAFF có quyền 'product-groups:create' tại store
*/
router.post(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("product-groups:create"),
  productGroupController.createProductGroup
);

/*
  GET /api/product-groups/store/:storeId
  - Lấy toàn bộ nhóm sản phẩm của một cửa hàng
  - Yêu cầu quyền 'product-groups:view'
*/
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("product-groups:view"),
  productGroupController.getProductGroupsByStore
);

/*
  GET /api/product-groups/:groupId
  - Lấy chi tiết một nhóm sản phẩm (theo ID)
  - Vì groupId thuộc 1 store, vẫn cần verifyToken + checkStoreAccess
  - Quyền: 'product-groups:view'
*/
router.get(
  "/:groupId",
  verifyToken,
  checkStoreAccess,
  requirePermission("product-groups:view"),
  productGroupController.getProductGroupById
);

/*
  PUT /api/product-groups/:groupId
  - Cập nhật nhóm sản phẩm
  - Quyền: 'product-groups:update'
*/
router.put(
  "/:groupId",
  verifyToken,
  checkStoreAccess,
  requirePermission("product-groups:update"),
  productGroupController.updateProductGroup
);

/*
  DELETE /api/product-groups/:groupId
  - Xóa nhóm sản phẩm
  - Quyền: 'product-groups:delete'
*/
router.delete(
  "/:groupId",
  verifyToken,
  checkStoreAccess,
  requirePermission("product-groups:delete"),
  productGroupController.deleteProductGroup
);

module.exports = router;
