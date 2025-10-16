const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Store = require('../models/Store');
const User = require('../models/User');
const Employee = require('../models/Employee');

// ============= HELPER FUNCTIONS =============

// Tạo mã đơn nhập hàng tự động với format NHXXXXXX - auto expand khi vượt quá NH999999
const generateOrderCode = async (storeId) => {
  try {
    // Tìm đơn hàng cuối cùng của store để lấy số thứ tự
    const lastOrder = await PurchaseOrder.findOne(
      { store_id: storeId },
      {},
      { sort: { createdAt: -1 } }
    );
    
    let nextNumber = 1;
    if (lastOrder && lastOrder.purchase_order_code && lastOrder.purchase_order_code.startsWith('NH')) {
      const lastNumber = parseInt(lastOrder.purchase_order_code.substring(2));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    
    // Tự động mở rộng độ dài khi vượt quá 999999
    let paddingLength = 6;
    if (nextNumber > 999999) {
      paddingLength = Math.max(6, nextNumber.toString().length);
    }
    
    return `NH${nextNumber.toString().padStart(paddingLength, '0')}`;
  } catch (error) {
    throw new Error('Không thể tạo mã đơn hàng: ' + error.message);
  }
};

// Tính tổng tiền từ danh sách items với populated products
const calculateTotalFromItems = (items, products = {}) => {
  return items.reduce((total, item) => {
    const product = products[item.product_id] || item.product_id;
    if (product && product.cost_price) {
      const costPrice = parseFloat(product.cost_price.toString());
      const itemTotal = (item.quantity * costPrice) - (item.discount || 0);
      return total + itemTotal;
    }
    return total;
  }, 0);
};

// Cập nhật stock cho các sản phẩm khi nhập hàng (chỉ cập nhật sản phẩm chưa bị xóa)
const updateProductStock = async (items, operation = 'add') => {
  for (const item of items) {
    const productId = item.product_id._id || item.product_id;
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (product) {
      if (operation === 'add') {
        product.stock_quantity += item.quantity;
      } else if (operation === 'subtract') {
        product.stock_quantity = Math.max(0, product.stock_quantity - item.quantity);
      }
      await product.save();
    }
  }
};

// ============= CREATE - Tạo đơn nhập hàng mới =============
const createPurchaseOrder = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { storeId } = req.params;
    const { purchase_order_code, supplier_id, items, notes, purchase_order_date, status } = req.body;
    const userId = req.user.id;

    // Validation
    if (!supplier_id) {
      return res.status(400).json({ message: "Nhà cung cấp là bắt buộc" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Danh sách sản phẩm không được để trống" });
    }

    // Kiểm tra user có quyền tạo đơn nhập hàng
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo đơn nhập hàng" });
    }

    // Kiểm tra store
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể tạo đơn nhập hàng cho cửa hàng của mình" });
    }

    // Kiểm tra supplier (chỉ kiểm tra nhà cung cấp chưa bị xóa)
    const supplier = await Supplier.findOne({ _id: supplier_id, store_id: storeId, isDeleted: false });
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại hoặc không thuộc cửa hàng này" });
    }

    if (supplier.status !== 'đang hoạt động') {
      return res.status(400).json({ message: "Nhà cung cấp đã ngừng hoạt động" });
    }

    // Validate và format items
    const validatedItems = [];
    const productMap = {};
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.product_id) {
        return res.status(400).json({ message: `Sản phẩm thứ ${i + 1}: product_id là bắt buộc` });
      }

      // Kiểm tra product tồn tại (chỉ kiểm tra sản phẩm chưa bị xóa)
      const product = await Product.findOne({ _id: item.product_id, store_id: storeId, isDeleted: false });
      if (!product) {
        return res.status(404).json({ message: `Sản phẩm thứ ${i + 1} không tồn tại hoặc không thuộc cửa hàng này` });
      }

      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ message: `Sản phẩm thứ ${i + 1}: Số lượng phải lớn hơn 0` });
      }

      // Lưu product vào map để tính tổng tiền
      productMap[item.product_id] = product;

      validatedItems.push({
        product_id: item.product_id,
        quantity: parseFloat(item.quantity),
        discount: parseFloat(item.discount) || 0
      });
    }

    // Xử lý mã đơn hàng - tạo tự động nếu không có mã nhập vào
    let purchaseOrderCode;
    if (purchase_order_code) {
      // Kiểm tra mã đơn hàng tùy chỉnh có trùng không
      const existingOrder = await PurchaseOrder.findOne({
        purchase_order_code: purchase_order_code.trim(),
        store_id: storeId
      });

      if (existingOrder) {
        return res.status(400).json({ message: "Mã đơn hàng này đã tồn tại trong cửa hàng" });
      }

      purchaseOrderCode = purchase_order_code.trim();
    } else {
      // Tạo mã đơn hàng tự động
      purchaseOrderCode = await generateOrderCode(storeId);
    }

    // Validate status nếu được cung cấp
    const orderStatus = status || 'phiếu tạm';
    const validStatuses = ['phiếu tạm', 'đã nhập hàng', 'đã hủy'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ. Chỉ chấp nhận: 'phiếu tạm', 'đã nhập hàng', 'đã hủy'" });
    }

    // Tính tổng tiền
    const totalAmount = calculateTotalFromItems(validatedItems, productMap);

    // Tạo đơn nhập hàng mới
    const newPurchaseOrder = new PurchaseOrder({
      purchase_order_code: purchaseOrderCode,
      purchase_order_date: purchase_order_date ? new Date(purchase_order_date) : new Date(),
      supplier_id: supplier_id,
      store_id: storeId,
      created_by: userId,
      total_amount: totalAmount,
      paid_amount: 0,
      status: orderStatus,
      items: validatedItems,
      notes: notes || ''
    });

    await newPurchaseOrder.save();

    // Nếu trạng thái là "đã nhập hàng", cập nhật stock cho các sản phẩm
    if (newPurchaseOrder.status === 'đã nhập hàng') {
      await updateProductStock(validatedItems, 'add');
    }

    // Populate và trả về
    const populatedOrder = await PurchaseOrder.findById(newPurchaseOrder._id)
      .populate('supplier_id', 'name phone email')
      .populate('store_id', 'name')
      .populate('created_by', 'name email')
      .populate('items.product_id', 'name sku cost_price');

    res.status(201).json({
      message: "Tạo đơn nhập hàng thành công",
      purchaseOrder: populatedOrder
    });

  } catch (error) {
    console.error("❌ Lỗi createPurchaseOrder:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả đơn nhập hàng của store =============
const getPurchaseOrdersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Kiểm tra quyền truy cập store
    if (user.role === "MANAGER" && store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== storeId) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
      }
    }

    // Lấy danh sách đơn nhập hàng
    const purchaseOrders = await PurchaseOrder.find({ store_id: storeId })
      .populate('supplier_id', 'name phone email')
      .populate('store_id', 'name')
      .populate('created_by', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Lấy danh sách đơn nhập hàng thành công",
      total: purchaseOrders.length,
      purchaseOrders: purchaseOrders
    });

  } catch (error) {
    console.error("❌ Lỗi getPurchaseOrdersByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết đơn nhập hàng =============
const getPurchaseOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const purchaseOrder = await PurchaseOrder.findById(orderId)
      .populate('supplier_id', 'name phone email address')
      .populate('store_id', 'name address phone owner_id')
      .populate('created_by', 'name email')
      .populate('items.product_id', 'name sku cost_price');

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Đơn nhập hàng không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && purchaseOrder.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập đơn nhập hàng này" });
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== purchaseOrder.store_id._id.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập đơn nhập hàng này" });
      }
    }

    res.status(200).json({
      message: "Lấy thông tin đơn nhập hàng thành công",
      purchaseOrder: purchaseOrder
    });

  } catch (error) {
    console.error("❌ Lỗi getPurchaseOrderById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật đơn nhập hàng =============
const updatePurchaseOrder = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { orderId } = req.params;
    const { purchase_order_code, supplier_id, items, notes, status, paid_amount } = req.body;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật đơn nhập hàng" });
    }

    // Tìm đơn nhập hàng
    const purchaseOrder = await PurchaseOrder.findById(orderId).populate('store_id', 'owner_id');
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Đơn nhập hàng không tồn tại" });
    }

    if (purchaseOrder.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật đơn nhập hàng trong cửa hàng của mình" });
    }

    // Không cho phép cập nhật đơn hàng đã nhập hàng
    if (purchaseOrder.status === 'đã nhập hàng' || purchaseOrder.status === 'đã hủy') {
      return res.status(400).json({ message: "Không thể cập nhật đơn hàng đã nhập hàng hoặc đã hủy" });
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    
    if (purchase_order_code !== undefined) {
      if (purchase_order_code.trim() !== purchaseOrder.purchase_order_code) {
        // Kiểm tra mã đơn hàng mới có trùng không
        const existingOrder = await PurchaseOrder.findOne({
          purchase_order_code: purchase_order_code.trim(),
          store_id: purchaseOrder.store_id._id,
          _id: { $ne: orderId }
        });

        if (existingOrder) {
          return res.status(400).json({ message: "Mã đơn hàng này đã tồn tại trong cửa hàng" });
        }

        updateData.purchase_order_code = purchase_order_code.trim();
      }
    }
    
    if (supplier_id !== undefined) {
      const supplier = await Supplier.findOne({ _id: supplier_id, store_id: purchaseOrder.store_id._id, isDeleted: false });
      if (!supplier) {
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      }
      updateData.supplier_id = supplier_id;
    }

    if (items !== undefined && Array.isArray(items)) {
      // Validate items như trong create
      const validatedItems = [];
      const productMap = {};
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const product = await Product.findOne({ _id: item.product_id, store_id: purchaseOrder.store_id._id, isDeleted: false });
        if (!product) {
          return res.status(404).json({ message: `Sản phẩm thứ ${i + 1} không tồn tại` });
        }

        if (!item.quantity || item.quantity <= 0) {
          return res.status(400).json({ message: `Sản phẩm thứ ${i + 1}: Số lượng phải lớn hơn 0` });
        }

        // Lưu product vào map để tính tổng tiền
        productMap[item.product_id] = product;

        validatedItems.push({
          product_id: item.product_id,
          quantity: parseFloat(item.quantity),
          discount: parseFloat(item.discount) || 0
        });
      }
      
      updateData.items = validatedItems;
      updateData.total_amount = calculateTotalFromItems(validatedItems, productMap);
    }

    if (notes !== undefined) updateData.notes = notes;
    
    if (status !== undefined) {
      const validStatuses = ['phiếu tạm', 'đã nhập hàng', 'đã hủy'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ. Chỉ chấp nhận: 'phiếu tạm', 'đã nhập hàng', 'đã hủy'" });
      }
      updateData.status = status;
    }

    if (paid_amount !== undefined) {
      if (paid_amount < 0) {
        return res.status(400).json({ message: "Số tiền đã trả không được âm" });
      }
      updateData.paid_amount = parseFloat(paid_amount);
    }

    // Kiểm tra nếu trạng thái thay đổi thành "đã nhập hàng" để cập nhật stock
    const isStatusChangedToImported = status === 'đã nhập hàng' && purchaseOrder.status !== 'đã nhập hàng';
    
    // Cập nhật đơn hàng
    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true }
    ).populate('supplier_id', 'name phone email')
      .populate('store_id', 'name')
      .populate('created_by', 'name email')
      .populate('items.product_id', 'name sku cost_price');

    // Nếu trạng thái thay đổi thành "đã nhập hàng", cập nhật stock
    if (isStatusChangedToImported) {
      const itemsToUpdate = updateData.items || purchaseOrder.items;
      await updateProductStock(itemsToUpdate, 'add');
    }

    res.status(200).json({
      message: "Cập nhật đơn nhập hàng thành công",
      purchaseOrder: updatedOrder
    });

  } catch (error) {
    console.error("❌ Lỗi updatePurchaseOrder:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa đơn nhập hàng =============
const deletePurchaseOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa đơn nhập hàng" });
    }

    // Tìm đơn nhập hàng
    const purchaseOrder = await PurchaseOrder.findById(orderId).populate('store_id', 'owner_id');
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Đơn nhập hàng không tồn tại" });
    }

    if (purchaseOrder.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa đơn nhập hàng trong cửa hàng của mình" });
    }

    // Chỉ cho phép "xóa" (đổi thành đã hủy) nếu trạng thái là "đã nhập hàng"
    if (purchaseOrder.status !== 'đã nhập hàng') {
      return res.status(400).json({ message: "Chỉ có thể hủy đơn hàng đã nhập hàng" });
    }

    // Cập nhật trạng thái thành "đã hủy" thay vì xóa
    purchaseOrder.status = 'đã hủy';
    await purchaseOrder.save();

    // Trừ lại stock của các sản phẩm vì đã hủy đơn nhập hàng
    await updateProductStock(purchaseOrder.items, 'subtract');

    res.status(200).json({
      message: "Hủy đơn nhập hàng thành công",
      purchaseOrder: {
        _id: purchaseOrder._id,
        purchase_order_code: purchaseOrder.purchase_order_code,
        status: purchaseOrder.status
      }
    });

  } catch (error) {
    console.error("❌ Lỗi deletePurchaseOrder:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createPurchaseOrder,
  getPurchaseOrdersByStore,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder
};
