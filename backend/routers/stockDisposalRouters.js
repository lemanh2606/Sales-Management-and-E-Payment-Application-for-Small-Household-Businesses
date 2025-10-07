const express = require('express');
const router = express.Router();
const stockDisposalController = require('../controllers/stockDisposalController');
const { verifyToken } = require('../middlewares/authMiddleware');

// ============= STOCK DISPOSAL CRUD ROUTES =============

// CREATE - Tạo phiếu xuất hủy mới trong cửa hàng
router.post('/store/:storeId', verifyToken, stockDisposalController.createStockDisposal);

// READ - Lấy tất cả phiếu xuất hủy của một cửa hàng
router.get('/store/:storeId', verifyToken, stockDisposalController.getStockDisposalsByStore);

// READ - Lấy chi tiết một phiếu xuất hủy
router.get('/:disposalId', verifyToken, stockDisposalController.getStockDisposalById);

// UPDATE - Cập nhật thông tin phiếu xuất hủy
router.put('/:disposalId', verifyToken, stockDisposalController.updateStockDisposal);

// DELETE - Xóa phiếu xuất hủy
router.delete('/:disposalId', verifyToken, stockDisposalController.deleteStockDisposal);

module.exports = router;