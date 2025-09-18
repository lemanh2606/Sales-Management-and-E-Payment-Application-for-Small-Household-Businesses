// tests/order.test.js
const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const Product = require('../src/models/Product');
const Stock = require('../src/models/Stock');

let token;
let storeId;
let productId;

beforeAll(async () => {
  await connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_test_db');
  // seed minimal
  await Promise.all([User.deleteMany({}), Store.deleteMany({}), Product.deleteMany({}), Stock.deleteMany({})]);
  const store = await Store.create({ storeCode: 'TST', storeName: 'Test Store' });
  storeId = store._id;
  const passwordHash = await require('bcryptjs').hash('pass', 8);
  const user = await User.create({ username: 'test', passwordHash, fullName: 'Test', role: 'Owner', store: storeId });
  // get token
  const res = await request(app).post('/api/auth/login').send({ username: 'test', password: 'pass' });
  token = res.body.token;
  // product + stock
  const p = await Product.create({ name: 'TestProd', sellPrice: 10000 });
  productId = p._id;
  await Stock.create({ product: productId, store: storeId, quantity: 10 });
});

afterAll(async () => {
  await mongoose.disconnect();
});

test('Create order and pay (cash) reduces stock', async () => {
  // create order
  const createRes = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      orderCode: 'TST-ORD-1',
      orderType: 'Sale',
      store: storeId,
      items: [{ product: productId, quantity: 2, unitPrice: 10000 }],
      vatRate: 0,
      paymentMethod: 'Cash'
    });
  expect(createRes.status).toBe(201);
  const orderId = createRes.body._id;

  // after cash order creation, stock should be reduced (service sets to Paid for Cash)
  const stock = await Stock.findOne({ product: productId, store: storeId });
  expect(stock.quantity).toBe(8);
});
