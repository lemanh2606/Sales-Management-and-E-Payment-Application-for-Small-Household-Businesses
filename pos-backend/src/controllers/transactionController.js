const transactionService = require('../services/orderService'); // using confirmTransaction
const Transaction = require('../models/Transaction');

const createTransaction = async (req, res) => {
  const userId = req.user._id;
  const { orderId, amount, paymentMethod, status, reference, voiceConfirmData } = req.body;
  const tx = await transactionService.confirmTransaction({
    orderId,
    transactionPayload: {
      transactionCode: 'TRX-' + Date.now(),
      amount,
      paymentMethod,
      status,
      reference,
      voiceConfirmData,
      voiceConfirmed: !!voiceConfirmData
    },
    userId
  });
  res.status(201).json(tx);
};

module.exports = { createTransaction };
