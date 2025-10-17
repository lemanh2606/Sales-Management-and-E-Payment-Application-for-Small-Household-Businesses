const express = require("express");
const router = express.Router();
const { verifyToken, isManager, checkStoreAccess } = require("../middlewares/authMiddleware");
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
} = require("../controllers/productController");

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error("❌ Multer Error:", err);
    return res.status(400).json({ 
      message: "Lỗi upload file", 
      error: err.message 
    });
  }
  next();
};

// ROUTE CỤ THỂ & STATIC TRƯỚC
router.get('/search', verifyToken, checkStoreAccess, searchProducts);  // Search theo tên hoặc SKU
router.get("/low-stock", verifyToken, isManager, getLowStockProducts); // Low stock (manager only)
// ROUTE THEO STORE (tiền tố /store)
router.post("/store/:storeId", verifyToken, uploadProductImage.single("image"), handleMulterError, createProduct);           // Tạo sản phẩm trong store
router.get("/store/:storeId", verifyToken, getProductsByStore);       // Lấy sp theo store
// ROUTE UPDATE CHI TIẾT (có /price trước /:productId)
router.put("/:productId/price", verifyToken, updateProductPrice);     // Update giá
router.put("/:productId", verifyToken, uploadProductImage.single("image"), handleMulterError, updateProduct);                // Update toàn bộ
// DELETE
router.delete("/:productId/image", verifyToken, deleteProductImage);  // Xóa ảnh sản phẩm
router.delete("/:productId", verifyToken, deleteProduct);             // Xóa sp

router.get("/:productId", verifyToken, getProductById);               // Get by ID RUlE: (LUÔN CUỐI)


module.exports = router;
