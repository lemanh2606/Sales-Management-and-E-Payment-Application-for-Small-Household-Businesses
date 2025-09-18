// reserve for an order (called when create draft and user chooses reserve)
const mongoose = require('mongoose');
const { reserveStock, releaseReservedStock } = require('../services/stockService');
const Order = require('../models/Order');

async function reserveForOrder(req, res) {
  const orderId = req.params.id;
  const userId = req.user._id;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (order.status !== 'Draft') throw Object.assign(new Error('Only Draft orders can be reserved'), { statusCode: 400 });

    const items = order.items.map(i => ({ product: i.product, quantity: i.quantity }));
    await reserveStock({ storeId: order.store, items, session });
    order.status = 'Pending'; // reserved / waiting payment
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function releaseForOrder(req, res) {
  const orderId = req.params.id;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    const items = order.items.map(i => ({ product: i.product, quantity: i.quantity }));
    await releaseReservedStock({ storeId: order.store, items, session });
    order.status = 'Draft';
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();
    res.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = { reserveForOrder, releaseForOrder };
