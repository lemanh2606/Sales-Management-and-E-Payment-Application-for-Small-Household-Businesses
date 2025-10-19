const PurchaseReturn = require('../models/PurchaseReturn');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Store = require('../models/Store');
const User = require('../models/User');
const PurchaseOrder = require('../models/PurchaseOrder');
const mongoose = require('mongoose');

// Hàm hỗ trợ cập nhật tồn kho sản phẩm
const updateStockOnReturn = async (items, storeId, operation) => {
  const bulkOps = [];
  for (const item of items) {
    const stockChange = (operation === 'decrease') ? -item.quantity : item.quantity;
    bulkOps.push({
      updateOne: {
        filter: { _id: item.product_id, store_id: storeId },
        update: { $inc: { stock_quantity: stockChange } }
      }
    });
  }
  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
  }
};

// ============= CREATE - Tạo phiếu trả hàng mới =============
const createPurchaseReturn = async (req, res) => {
  const { storeId } = req.params;
  let {
    purchase_return_code,
    supplier_id,
    purchase_order_id,
    items,
    notes,
    status,
    return_date,
    supplier_refund
  } = req.body;
  const userId = req.user.id;

  if (!supplier_id || !items || items.length === 0) {
    return res.status(400).json({ message: "Nhà cung cấp và danh sách sản phẩm là bắt buộc." });
  }

  try {
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo phiếu trả hàng." });
    }

    const store = await Store.findById(storeId);
    if (!store || store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền tạo phiếu trả hàng trong cửa hàng này." });
    }

    const supplier = await Supplier.findOne({ _id: supplier_id, store_id: storeId });
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại trong cửa hàng này." });
    }
    
    let purchaseOrder = null;
    if (purchase_order_id) {
        purchaseOrder = await PurchaseOrder.findOne({ _id: purchase_order_id, store_id: storeId });
        if (!purchaseOrder) {
            return res.status(404).json({ message: "Đơn nhập hàng không tồn tại trong cửa hàng này." });
        }
        
        // Kiểm tra nhà cung cấp có khớp không
        if (purchaseOrder.supplier_id.toString() !== supplier_id) {
            return res.status(400).json({ message: "Nhà cung cấp không khớp với đơn nhập hàng được chỉ định." });
        }
    }

    // Tạo mới hoặc kiểm tra mã trả hàng
    if (purchase_return_code) {
      // Nếu có mã được cung cấp, kiểm tra xem đã tồn tại chưa
      const existingReturn = await PurchaseReturn.findOne({ 
        purchase_return_code, 
        store_id: storeId 
      });
      
      if (existingReturn) {
        return res.status(400).json({ message: `Mã trả hàng '${purchase_return_code}' đã tồn tại trong cửa hàng này.` });
      }
    } else {
      // Tự động tạo mã nếu không được cung cấp
      const lastReturn = await PurchaseReturn
        .findOne({ store_id: storeId, purchase_return_code: { $regex: /^TH/ } })
        .sort({ purchase_return_code: -1 });

      let sequence = 1;
      if (lastReturn && lastReturn.purchase_return_code) {
        const lastCode = lastReturn.purchase_return_code;
        const lastNumber = parseInt(lastCode.replace('TH', ''), 10);
        if (!isNaN(lastNumber)) {
          sequence = lastNumber + 1;
        }
      }
      
      purchase_return_code = `TH${String(sequence).padStart(6, '0')}`;
    }

    let total_amount = 0;
    const productIds = items.map(item => item.product_id);
    const products = await Product.find({ '_id': { $in: productIds }, store_id: storeId, isDeleted: false });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // Nếu có purchase_order_id, kiểm tra sản phẩm trả có trong đơn nhập gốc không
    if (purchaseOrder) {
      const orderProductIds = purchaseOrder.items.map(item => item.product_id.toString());
      for (const item of items) {
        if (!orderProductIds.includes(item.product_id)) {
          const product = productMap.get(item.product_id);
          const productName = product ? product.name : item.product_id;
          return res.status(400).json({ 
            message: `Sản phẩm '${productName}' không có trong đơn nhập hàng ${purchaseOrder.purchase_order_code}.` 
          });
        }
        
        // Kiểm tra số lượng trả không vượt quá số lượng đã mua
        const orderItem = purchaseOrder.items.find(oi => oi.product_id.toString() === item.product_id);
        if (orderItem && item.quantity > orderItem.quantity) {
          const product = productMap.get(item.product_id);
          const productName = product ? product.name : item.product_id;
          return res.status(400).json({ 
            message: `Số lượng trả '${productName}' (${item.quantity}) vượt quá số lượng đã nhập (${orderItem.quantity}).` 
          });
        }
      }
    }

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return res.status(400).json({ message: `Sản phẩm với ID ${item.product_id} không tồn tại trong cửa hàng.` });
      }
      if (!item.return_price || item.return_price < 0) {
        return res.status(400).json({ message: `Giá trả lại cho sản phẩm ${product.name} là bắt buộc và phải lớn hơn hoặc bằng 0.`});
      }
      item.import_price = product.cost_price; // Gán giá nhập từ sản phẩm
      total_amount += item.return_price * item.quantity;
    }

    const newPurchaseReturn = new PurchaseReturn({
      purchase_return_code,
      store_id: storeId,
      supplier_id,
      purchase_order_id,
      created_by: userId,
      items,
      total_amount,
      supplier_refund,
      notes,
      status: status || 'phiếu tạm',
      return_date
    });

    if (newPurchaseReturn.status === 'đã trả hàng') {
      await updateStockOnReturn(items, storeId, 'decrease');
    }

    const savedPurchaseReturn = await newPurchaseReturn.save();

    res.status(201).json({
      message: "Tạo phiếu trả hàng thành công",
      total: items.length,
      purchaseReturn: savedPurchaseReturn
    });
  } catch (error) {
    console.error("Lỗi tạo phiếu trả hàng:", error);
    res.status(500).json({ message: error.message || "Lỗi server nội bộ." });
  }
};

// ============= READ - Lấy tất cả phiếu trả hàng của cửa hàng =============
const getPurchaseReturnsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    // Kiểm tra quyền truy cập tương tự như các controller khác
    const purchaseReturns = await PurchaseReturn.find({ store_id: storeId })
      .populate('supplier_id', 'name')
      .populate('created_by', 'username email')
      .sort({ createdAt: -1 });
      
    res.status(200).json(purchaseReturns);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server: " + error.message });
  }
};

// ============= READ - Lấy chi tiết phiếu trả hàng =============
const getPurchaseReturnById = async (req, res) => {
  try {
    const { returnId } = req.params;
    const purchaseReturn = await PurchaseReturn.findById(returnId)
      .populate('supplier_id', 'name phone email')
      .populate('created_by', 'username email')
      .populate('store_id', 'name address')
      .populate('purchase_order_id', 'purchase_order_code');

    if (!purchaseReturn) {
      return res.status(404).json({ message: "Không tìm thấy phiếu trả hàng." });
    }
    // Có thể thêm kiểm tra quyền truy cập nếu cần
    res.status(200).json(purchaseReturn);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server: " + error.message });
  }
};

// ============= UPDATE - Cập nhật phiếu trả hàng =============
const updatePurchaseReturn = async (req, res) => {
  const { returnId } = req.params;
  const updates = req.body;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật phiếu trả hàng." });
    }

    const purchaseReturn = await PurchaseReturn.findById(returnId);
    if (!purchaseReturn) {
      return res.status(404).json({ message: "Không tìm thấy phiếu trả hàng." });
    }

    if (purchaseReturn.status === 'đã trả hàng') {
      return res.status(400).json({ message: "Không thể cập nhật phiếu đã ở trạng thái 'đã trả hàng'." });
    }

    // Nếu status được cập nhật thành 'đã trả hàng', giảm tồn kho
    if (updates.status && updates.status === 'đã trả hàng' && purchaseReturn.status !== 'đã trả hàng') {
      await updateStockOnReturn(purchaseReturn.items, purchaseReturn.store_id, 'decrease');
    }

    // Cập nhật các trường dữ liệu
    Object.assign(purchaseReturn, updates);
    
    // Nếu danh sách items được cập nhật, cần tính toán lại tổng tiền
    if (updates.items) {
        let total_amount = 0;
        const productIds = updates.items.map(item => item.product_id);
        const products = await Product.find({ '_id': { $in: productIds }, store_id: purchaseReturn.store_id, isDeleted: false });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        for (const item of updates.items) {
            const product = productMap.get(item.product_id);
            if (!product) {
                return res.status(400).json({ message: `Sản phẩm với ID ${item.product_id} không tồn tại.` });
            }
            if (!item.return_price || item.return_price < 0) {
                return res.status(400).json({ message: `Giá trả lại cho sản phẩm ${product.name} là bắt buộc.`});
            }
            item.import_price = product.cost_price;
            total_amount += item.return_price * item.quantity;
        }
        purchaseReturn.total_amount = total_amount;
    }

    const updatedReturn = await purchaseReturn.save();

    res.status(200).json({
      message: "Cập nhật phiếu trả hàng thành công",
      total: updatedReturn.items.length,
      purchaseReturn: updatedReturn
    });
  } catch (error) {
    console.error("Lỗi cập nhật phiếu trả hàng:", error);
    res.status(500).json({ message: error.message || "Lỗi server nội bộ." });
  }
};

// ============= DELETE - Hủy phiếu trả hàng =============
const deletePurchaseReturn = async (req, res) => {
  const { returnId } = req.params;
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được hủy phiếu trả hàng." });
    }

    const purchaseReturn = await PurchaseReturn.findById(returnId);
    if (!purchaseReturn) {
      return res.status(404).json({ message: "Không tìm thấy phiếu trả hàng." });
    }

    if (purchaseReturn.status === 'đã trả hàng') {
      return res.status(400).json({ message: "Không thể hủy phiếu đã ở trạng thái 'đã trả hàng'." });
    }

    // Thay vì xóa hoàn toàn, cập nhật trạng thái thành 'đã hủy'
    // Thêm 'đã hủy' vào danh sách enum trong model nếu chưa có
    const purchaseReturnSchema = require('../models/PurchaseReturn').schema;
    if (!purchaseReturnSchema.path('status').enumValues.includes('đã hủy')) {
        purchaseReturnSchema.path('status').enumValues.push('đã hủy');
    }

    purchaseReturn.status = 'đã hủy';
    const updatedReturn = await purchaseReturn.save();

    res.status(200).json({ message: "Phiếu trả hàng đã được hủy thành công.", purchaseReturn: updatedReturn });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server: " + error.message });
  }
};


module.exports = {
  createPurchaseReturn,
  getPurchaseReturnsByStore,
  getPurchaseReturnById,
  updatePurchaseReturn,
  deletePurchaseReturn
};
