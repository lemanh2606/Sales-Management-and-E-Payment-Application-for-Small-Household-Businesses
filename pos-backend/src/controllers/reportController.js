const Order = require('../models/Order');

async function dailySales(req, res) {
  const { storeId, from, to } = req.query;
  const match = { status: 'Paid' };
  if (storeId) match.store = require('mongoose').Types.ObjectId(storeId);
  if (from || to) match.orderDate = {};
  if (from) match.orderDate.$gte = new Date(from);
  if (to) match.orderDate.$lte = new Date(to);
  const rows = await Order.aggregate([
    { $match: match },
    { $group: {
       _id: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
       totalRevenue: { $sum: "$totalAmount" },
       totalVAT: { $sum: "$vatAmount" },
       orders: { $sum: 1 }
    }},
    { $sort: { "_id": 1 } }
  ]);
  res.json(rows);
}

module.exports = { dailySales };
