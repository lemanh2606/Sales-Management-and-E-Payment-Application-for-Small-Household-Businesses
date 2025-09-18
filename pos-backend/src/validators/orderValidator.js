const Joi = require('joi');

const orderSchema = Joi.object({
  orderCode: Joi.string().optional(),
  orderType: Joi.string().valid('Sale','Return').default('Sale'),
  store: Joi.string().required(),
  customer: Joi.string().optional().allow(null),
  items: Joi.array().items(Joi.object({
    product: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    unitPrice: Joi.number().precision(2).required(),
    lineDiscount: Joi.number().precision(2).optional().default(0),
    vatAmount: Joi.number().precision(2).optional().default(0)
  })).min(1).required(),
  vatRate: Joi.number().precision(2).optional().default(0),
  discountAmount: Joi.number().precision(2).optional().default(0),
  paymentMethod: Joi.string().valid('Cash','QR','EWallet','Card','Bank','Credit').default('Cash')
});

module.exports = orderSchema;
