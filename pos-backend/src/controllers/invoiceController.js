// src/controllers/invoiceController.js
const Order = require('../models/Order');
const Store = require('../models/Store');
const User = require('../models/User');
const { generateInvoicePDF } = require('../utils/invoiceGenerator');

async function getInvoice(req, res) {
  const orderId = req.params.id;
  const order = await Order.findById(orderId).populate('items.product customer store createdBy');
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const store = await Store.findById(order.store);
  const user = await User.findById(order.createdBy);

  const orderPlain = order.toObject();
  // format date and nested product names for template
  orderPlain.orderDate = orderPlain.orderDate.toLocaleString('vi-VN');
  // ensure items have product name accessible
  for (const it of orderPlain.items) {
    if (it.product && it.product.name) continue;
    // if not populated, fetch
  }

  const pdfBuffer = await generateInvoicePDF({ order: orderPlain, store: store.toObject(), user: user.toObject() });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdfBuffer.length,
    'Content-Disposition': `attachment; filename=invoice-${order.orderCode}.pdf`
  });
  res.send(pdfBuffer);
}

module.exports = { getInvoice };
