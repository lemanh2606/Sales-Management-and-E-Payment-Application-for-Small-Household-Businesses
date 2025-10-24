// routes/productRouters.js
const express = require("express");
const router = express.Router();
const {
  verifyToken,
  isManager,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");
const { uploadProductImage } = require("../utils/cloudinary");
const {
  createProduct,
  getProductsByStore,
  updateProductPrice,
  searchProducts,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  getProductById,
  getLowStockProducts,
} = require("../controllers/product/productController");

/*
  GHI CHÚ CHUNG VỀ PHÂN QUYỀN CHO SẢN PHẨM:
  - Quy ước permission (gợi ý) trong user.menu:
      * products:create      -> tạo sản phẩm
      * products:view        -> xem sản phẩm / chi tiết
      * products:update      -> cập nhật sản phẩm (ngoại trừ giá nếu bạn tách)
      * products:price       -> cập nhật giá
      * products:delete      -> xóa sản phẩm
      * products:image:delete-> xóa ảnh sản phẩm
      * products:low-stock   -> xem báo cáo tồn (thường manager)
      * products:search      -> tìm kiếm sản phẩm
  - Luồng chung khi thao tác theo cửa hàng:
      1) verifyToken  -> yêu cầu đăng nhập
      2) checkStoreAccess -> xác định store context (gán req.store, req.storeRole)
      3) requirePermission(...) -> kiểm tra quyền chi tiết (hỗ trợ cả scoped store:<id>:...)
  - Một vài route (ví dụ callback công khai của payment) có thể không cần verifyToken. Ở đây tất cả route quản lý sản phẩm yêu cầu verifyToken.
  - Theo quy tắc: route GET by ID được đặt cuối cùng.
*/

/*
  Multer error handler (giữ nguyên)
  - Nếu Multer gặp lỗi khi upload sẽ trả 400 và message lỗi
*/
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error("Multer Error:", err);
    return res.status(400).json({
      message: "Lỗi upload file",
      error: err.message,
    });
  }
  next();
};

/*
  ROUTE: GET /api/products/search
  - Tìm kiếm sản phẩm theo tên / SKU / barcode...
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:search")
  - Lưu ý: checkStoreAccess sẽ dùng query.storeId / query.shopId / req.user.current_store nếu không truyền storeId
*/
router.get(
  "/search",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:search"),
  searchProducts
);

/*
  ROUTE: GET /api/products/low-stock
  - Lấy danh sách sản phẩm tồn thấp để cảnh báo
  - Hiện tại giới hạn cho Manager (isManager). Nếu muốn granular, thay bằng requirePermission("products:low-stock")
*/
router.get("/low-stock", verifyToken, isManager, getLowStockProducts);

/*
  ROUTE: POST /api/products/store/:storeId
  - Tạo sản phẩm mới trong cửa hàng
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:create")
  - uploadProductImage.single("image") xử lý upload ảnh (nếu có)
*/
router.post(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  uploadProductImage.single("image"),
  handleMulterError,
  requirePermission("products:create"),
  createProduct
);

/*
  ROUTE: GET /api/products/store/:storeId
  - Lấy danh sách sản phẩm theo store
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:view")
*/
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:view"),
  getProductsByStore
);

/*
  ROUTE: PUT /api/products/:productId/price
  - Cập nhật giá sản phẩm
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:price")
  - Lưu ý: update giá thường là thao tác nhạy cảm, tách permission riêng cho dễ quản lý
*/
router.put(
  "/:productId/price",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:price"),
  updateProductPrice
);

/*
  ROUTE: PUT /api/products/:productId
  - Cập nhật thông tin sản phẩm (có thể kèm upload ảnh)
  - Middleware: verifyToken -> checkStoreAccess -> uploadProductImage -> requirePermission("products:update")
*/
router.put(
  "/:productId",
  verifyToken,
  checkStoreAccess,
  uploadProductImage.single("image"),
  handleMulterError,
  requirePermission("products:update"),
  updateProduct
);

/*
  ROUTE: DELETE /api/products/:productId/image
  - Xóa ảnh sản phẩm
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:image:delete")
*/
router.delete(
  "/:productId/image",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:image:delete"),
  deleteProductImage
);

/*
  ROUTE: DELETE /api/products/:productId
  - Xóa sản phẩm (soft/hard tùy controller)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:delete")
*/
router.delete(
  "/:productId",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:delete"),
  deleteProduct
);

/*
  ROUTE: GET /api/products/:productId
  - Lấy chi tiết sản phẩm theo ID
  - Đặt cuối cùng theo rule của bạn
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("products:view")
*/
router.get(
  "/:productId",
  verifyToken,
  checkStoreAccess,
  requirePermission("products:view"),
  getProductById
);

module.exports = router;
