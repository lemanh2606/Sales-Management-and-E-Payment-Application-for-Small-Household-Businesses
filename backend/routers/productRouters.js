const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken } = require('../middlewares/authMiddleware');

// Route để lấy tất cả sản phẩm của một cửa hàng với thông tin nhà cung cấp
router.get('/store/:storeId', verifyToken, productController.getProductsByStore);

// Route để lấy chi tiết một sản phẩm với thông tin nhà cung cấp
router.get('/:productId', verifyToken, productController.getProductById);

module.exports = router;
