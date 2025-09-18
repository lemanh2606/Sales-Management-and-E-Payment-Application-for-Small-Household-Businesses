const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const stockController = require('../controllers/stockController');

router.post('/orders/:id/reserve', auth(), stockController.reserveForOrder);
router.post('/orders/:id/release', auth(), stockController.releaseForOrder);

module.exports = router;
