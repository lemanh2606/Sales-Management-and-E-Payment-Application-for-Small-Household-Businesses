const express = require("express");
const router = express.Router();
const { verifyToken, isManager, checkStoreAccess } = require("../middlewares/authMiddleware");
const {
  createProduct,
  getProductsByStore,
  updateProductPrice,
  searchProducts,
  updateProduct,
  deleteProduct,
  getProductById,
  getLowStockProducts,
} = require("../controllers/productController");

// ROUTE CỤ THỂ & STATIC TRƯỚC
router.get('/search', verifyToken, checkStoreAccess, searchProducts);  // Search theo tên hoặc SKU
router.get("/low-stock", verifyToken, isManager, getLowStockProducts); // Low stock (manager only)
// ROUTE THEO STORE (tiền tố /store)
router.post("/store/:storeId", verifyToken, createProduct);           // Tạo sản phẩm trong store
router.get("/store/:storeId", verifyToken, getProductsByStore);       // Lấy sp theo store
// ROUTE UPDATE CHI TIẾT (có /price trước /:productId)
router.put("/:productId/price", verifyToken, updateProductPrice);     // Update giá
router.put("/:productId", verifyToken, updateProduct);                // Update toàn bộ
// DELETE
router.delete("/:productId", verifyToken, deleteProduct);             // Xóa sp

router.get("/:productId", verifyToken, getProductById);               // Get by ID RUlE: (LUÔN CUỐI)


module.exports = router;
