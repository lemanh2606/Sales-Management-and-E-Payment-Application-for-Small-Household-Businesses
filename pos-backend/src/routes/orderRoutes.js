const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const orderController = require('../controllers/orderController');

router.post('/', auth(), orderController.createOrder); // create order
router.get('/:id', auth(), orderController.getOrder);
router.put('/:id', auth(), orderController.updateOrder); // update draft
router.delete('/:id', auth(), orderController.deleteOrder);
module.exports = router;
