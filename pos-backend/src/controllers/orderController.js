const orderService = require('../services/orderService');
const Order = require('../models/Order');

const createOrder = async (req, res) => {
  const userId = req.user._id;
  const payload = req.body;
  const order = await orderService.createOrder({ orderPayload: payload, userId });
  res.status(201).json(order);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product');
  if (!order) return res.status(404).json({ message: 'Not found' });
  res.json(order);
};

const updateOrder = async (req, res) => {
  const updated = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
};

const deleteOrder = async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};

module.exports = { createOrder, getOrder, updateOrder, deleteOrder };
