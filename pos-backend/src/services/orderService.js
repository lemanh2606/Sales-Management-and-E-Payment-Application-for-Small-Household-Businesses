const mongoose = require('mongoose');
const Order = require('../models/Order');
const Stock = require('../models/Stock');
const InventoryMovement = require('../models/InventoryMovement');
const Transaction = require('../models/Transaction');

async function createOrder({ orderPayload, userId }) {
  // orderPayload contains store, items, paymentMethod, orderType, etc.
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // compute totals
    let subTotal = 0;
    for (const it of orderPayload.items) {
      it.totalPrice = (it.unitPrice * it.quantity) - (it.lineDiscount || 0) + (it.vatAmount || 0);
      subTotal += (it.unitPrice * it.quantity) - (it.lineDiscount || 0);
    }
    const vatAmount = orderPayload.vatRate ? subTotal * (orderPayload.vatRate / 100) : 0;
    const totalAmount = subTotal + vatAmount - (orderPayload.discountAmount || 0);

    const order = await Order.create([{
      ...orderPayload,
      createdBy: userId,
      subTotal,
      vatAmount,
      totalAmount,
      status: orderPayload.paymentMethod === 'Cash' ? 'Paid' : 'Pending'
    }], { session });
    // If payment method is Cash and status Paid, we need to adjust stock and log inventory movements
    if (orderPayload.paymentMethod === 'Cash' || orderPayload.status === 'Paid') {
      // apply stock change immediately for 'Sale' or 'Return'
      const ord = order[0];
      for (const it of ord.items) {
        // find stock record
        const stock = await Stock.findOne({ product: it.product, store: ord.store }).session(session);
        if (!stock) {
          // create stock doc if not exist
          await Stock.create([{ product: it.product, store: ord.store, quantity: 0 }], { session });
        }
        if (ord.orderType === 'Sale') {
          // ensure available
          const s = await Stock.findOne({ product: it.product, store: ord.store }).session(session);
          if (s.quantity - s.reserved < it.quantity) {
            throw Object.assign(new Error('Insufficient stock for product ' + it.product), { statusCode: 400 });
          }
          s.quantity -= it.quantity;
          await s.save({ session });
          await InventoryMovement.create([{
            product: it.product, store: ord.store, quantity: it.quantity, movementType: 'Sale', referenceCode: ord.orderCode, performedBy: userId
          }], { session });
        } else { // Return
          const s = await Stock.findOne({ product: it.product, store: ord.store }).session(session);
          s.quantity += it.quantity;
          await s.save({ session });
          await InventoryMovement.create([{
            product: it.product, store: ord.store, quantity: it.quantity, movementType: 'ReturnIn', referenceCode: ord.orderCode, performedBy: userId
          }], { session });
        }
      }
    }
    await session.commitTransaction();
    session.endSession();
    return order[0];
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function confirmTransaction({ orderId, transactionPayload, userId }) {
  // create transaction then if success adjust stock if not yet done (e.g., for non-cash payments)
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tx = await Transaction.create([{ ...transactionPayload, order: orderId, createdBy: userId }], { session });
    const transaction = tx[0];
    if (transaction.status === 'Success') {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
      // if order not yet Paid, mark Paid and apply stock changes (same logic as above)
      if (order.status !== 'Paid') {
        order.status = 'Paid';
        await order.save({ session });
        for (const it of order.items) {
          const s = await Stock.findOne({ product: it.product, store: order.store }).session(session);
          if (!s) {
            await Stock.create([{ product: it.product, store: order.store, quantity: 0 }], { session });
          }
          if (order.orderType === 'Sale') {
            if (s.quantity - s.reserved < it.quantity) {
              throw Object.assign(new Error('Insufficient stock for product ' + it.product), { statusCode: 400 });
            }
            s.quantity -= it.quantity;
            await s.save({ session });
            await InventoryMovement.create([{
              product: it.product, store: order.store, quantity: it.quantity, movementType: 'Sale', referenceCode: order.orderCode, performedBy: userId
            }], { session });
          } else {
            s.quantity += it.quantity;
            await s.save({ session });
            await InventoryMovement.create([{
              product: it.product, store: order.store, quantity: it.quantity, movementType: 'ReturnIn', referenceCode: order.orderCode, performedBy: userId
            }], { session });
          }
        }
      }
    }
    await session.commitTransaction();
    session.endSession();
    return transaction;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = { createOrder, confirmTransaction };
