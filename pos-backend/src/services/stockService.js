// src/services/stockService.js
const Stock = require('../models/Stock');
const InventoryMovement = require('../models/InventoryMovement');

async function reserveStock({ storeId, items, session = null }) {
  // items: [{ product, quantity }]
  for (const it of items) {
    const stock = await Stock.findOne({ product: it.product, store: storeId }).session(session);
    if (!stock || (stock.quantity - stock.reserved) < it.quantity) {
      throw Object.assign(new Error('Insufficient available stock for product ' + it.product), { statusCode: 400 });
    }
    stock.reserved += it.quantity;
    await stock.save({ session });
  }
  return true;
}

async function releaseReservedStock({ storeId, items, session = null }) {
  for (const it of items) {
    const stock = await Stock.findOne({ product: it.product, store: storeId }).session(session);
    if (!stock) continue;
    stock.reserved = Math.max(0, stock.reserved - it.quantity);
    await stock.save({ session });
  }
  return true;
}

async function commitSaleStock({ storeId, items, performedBy, session = null }) {
  for (const it of items) {
    const stock = await Stock.findOne({ product: it.product, store: storeId }).session(session);
    if (!stock || (stock.quantity < it.quantity)) {
      throw Object.assign(new Error('Insufficient stock to commit for ' + it.product), { statusCode: 400 });
    }
    stock.quantity -= it.quantity;
    // also reduce reserved if exists
    stock.reserved = Math.max(0, stock.reserved - it.quantity);
    await stock.save({ session });
    await InventoryMovement.create([{
      product: it.product, store: storeId, quantity: it.quantity, movementType: 'Sale', referenceCode: '', performedBy
    }], { session });
  }
  return true;
}

module.exports = { reserveStock, releaseReservedStock, commitSaleStock };
