// src/seed/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const bcrypt = require('bcryptjs');

const Store = require('../models/Store');
const User = require('../models/User');
const Category = require('../models/Category');
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const Stock = require('../models/Stock');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

async function seed() {
  await connectDB(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_mvp_unified');
  console.log('Connected for seeding...');

  // clear some collections (cẩn thận khi chạy trên production)
  await Promise.all([
    Store.deleteMany({}),
    User.deleteMany({}),
    Category.deleteMany({}),
    Unit.deleteMany({}),
    Product.deleteMany({}),
    Stock.deleteMany({}),
    Customer.deleteMany({}),
    Supplier.deleteMany({}),
    Purchase.deleteMany({}),
    Order.deleteMany({}),
    Transaction.deleteMany({})
  ]);

  // create stores
  const main = await Store.create({ storeCode: 'MAIN', storeName: 'Cửa hàng chính', address: 'HN', phone: '0909000001' });
  const br1 = await Store.create({ storeCode: 'BR01', storeName: 'Chi nhánh 1', address: 'HN', phone: '0909000002' });

  // create user admin
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    username: 'admin',
    passwordHash,
    fullName: 'Chủ cửa hàng',
    role: 'Owner',
    phone: '0909000000',
    email: 'admin@local',
    store: main._id
  });

  // categories & units
  const cat1 = await Category.create({ name: 'Đồ uống' });
  const cat2 = await Category.create({ name: 'Thực phẩm' });
  const u1 = await Unit.create({ name: 'Lon' });
  const u2 = await Unit.create({ name: 'Gói' });

  // products
  const p1 = await Product.create({ sku: 'SKU1', barcode: '8930001', name: 'Nước ngọt 330ml', category: cat1._id, unit: u1._id, costPrice: 5000, sellPrice: 10000 });
  const p2 = await Product.create({ sku: 'SKU2', barcode: '8930002', name: 'Bánh snack', category: cat2._id, unit: u2._id, costPrice: 3000, sellPrice: 6000 });

  // init stock per store
  await Stock.create({ product: p1._id, store: main._id, quantity: 100 });
  await Stock.create({ product: p2._id, store: main._id, quantity: 200 });
  await Stock.create({ product: p1._id, store: br1._id, quantity: 50 });

  // customers & suppliers
  const c1 = await Customer.create({ customerCode: 'CUST1', fullName: 'Khách lẻ', phone: '0909111222' });
  const sup1 = await Supplier.create({ supplierCode: 'SUP1', name: 'NCC A', phone: '0909222333' });

  // a sample purchase (not received yet)
  const pu = await Purchase.create({
    purchaseCode: 'PUR-001',
    supplier: sup1._id,
    store: main._id,
    createdBy: admin._id,
    items: [{ product: p1._id, quantity: 50, unitPrice: 4800, totalPrice: 240000 }],
    totalAmount: 240000,
    status: 'Ordered'
  });

  // sample order draft
  const ord = await Order.create({
    orderCode: 'ORD-001',
    orderType: 'Sale',
    store: main._id,
    createdBy: admin._id,
    customer: c1._id,
    items: [{ product: p1._id, quantity: 2, unitPrice: 10000, totalPrice: 20000 }],
    subTotal: 20000,
    vatRate: 10,
    vatAmount: 2000,
    totalAmount: 22000,
    paymentMethod: 'Cash',
    status: 'Draft'
  });

  console.log('Seeding done.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
