const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken } = require('../middlewares/authMiddleware');

// ============= CRUD ROUTES =============

// CREATE - Tạo sản phẩm mới trong cửa hàng
router.post('/store/:storeId', verifyToken, productController.createProduct);

// READ - Lấy tất cả sản phẩm của một cửa hàng với thông tin nhà cung cấp
router.get('/store/:storeId', verifyToken, productController.getProductsByStore);

// UPDATE - Cập nhật giá một sản phẩm (specific update)
router.put('/:productId/price', verifyToken, productController.updateProductPrice);

// UPDATE - Cập nhật thông tin sản phẩm đầy đủ
router.put('/:productId', verifyToken, productController.updateProduct);

// DELETE - Xóa sản phẩm
router.delete('/:productId', verifyToken, productController.deleteProduct);

// READ - Lấy chi tiết một sản phẩm với thông tin nhà cung cấp (phải đặt cuối cùng)
router.get('/:productId', verifyToken, productController.getProductById);

module.exports = router;
