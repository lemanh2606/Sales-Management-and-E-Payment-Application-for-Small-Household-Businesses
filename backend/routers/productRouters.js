const express = require("express");
const router = express.Router();
const { verifyToken, isManager } = require("../middlewares/authMiddleware");
const {
  createProduct,
  getProductsByStore,
  updateProductPrice,
  updateProduct,
  deleteProduct,
  getProductById,
  getLowStockProducts,
} = require("../controllers/productController");

router.post("/store/:storeId", verifyToken, createProduct); //Tạo sản phẩm mới trong cửa hàng
router.get("/store/:storeId", verifyToken, getProductsByStore); //Lấy tất cả sản phẩm của một cửa hàng với thông tin nhà cung cấp
router.put("/:productId/price", verifyToken, updateProductPrice); //Cập nhật giá một sản phẩm (specific update)
router.put("/:productId", verifyToken, updateProduct); //Cập nhật thông tin sản phẩm đầy đủ
router.delete("/:productId", verifyToken, deleteProduct); // DELETE - Xóa sản phẩm
router.get("/:productId", verifyToken, getProductById); //Lấy detail 1 product với In4 supplier (đặt cuối)
router.get("/low-stock", verifyToken, isManager, getLowStockProducts); //Lấy list sản phẩm tồn kho thấp (chỉ manager)

module.exports = router;
