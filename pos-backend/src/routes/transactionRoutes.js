const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const txController = require('../controllers/transactionController.js');

router.post('/', auth(), txController.createTransaction);

module.exports = router;
