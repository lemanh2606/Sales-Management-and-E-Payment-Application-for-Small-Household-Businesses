const express = require('express');
const router = express.Router();
const productGroupController = require('../controllers/productGroupController');
const { verifyToken } = require('../middlewares/authMiddleware');

// ============= PRODUCT GROUP CRUD ROUTES =============

// CREATE - Tạo nhóm sản phẩm mới trong cửa hàng
router.post('/store/:storeId', verifyToken, productGroupController.createProductGroup);

// READ - Lấy tất cả nhóm sản phẩm của một cửa hàng
router.get('/store/:storeId', verifyToken, productGroupController.getProductGroupsByStore);

// READ - Lấy chi tiết một nhóm sản phẩm
router.get('/:groupId', verifyToken, productGroupController.getProductGroupById);

// UPDATE - Cập nhật thông tin nhóm sản phẩm
router.put('/:groupId', verifyToken, productGroupController.updateProductGroup);

// DELETE - Xóa nhóm sản phẩm
router.delete('/:groupId', verifyToken, productGroupController.deleteProductGroup);

module.exports = router;