const StockDisposal = require("../models/StockDisposal");
const Product = require("../models/Product");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");

// ============= HELPER FUNCTIONS =============
// Tạo mã xuất hủy tự động với format XH-DDMMYYYY-XXXX
const generateDisposalCode = async () => {
  const today = new Date();
  const dateStr = today.getDate().toString().padStart(2, '0') + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getFullYear().toString();
  
  const prefix = `XH-${dateStr}-`;
  
  // Tìm phiếu xuất hủy cuối cùng trong ngày
  const lastDisposal = await StockDisposal.findOne({
    disposal_code: { $regex: `^${prefix}` }
  }).sort({ disposal_code: -1 });
  
  let nextNumber = 1;
  
  if (lastDisposal && lastDisposal.disposal_code) {
    const lastNumber = parseInt(lastDisposal.disposal_code.substring(prefix.length));
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// ============= CREATE - Tạo phiếu xuất hủy mới =============
const createStockDisposal = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { disposal_date, note, status, items } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!disposal_date) {
      return res.status(400).json({ message: "Thời gian xuất hủy là bắt buộc" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Danh sách sản phẩm xuất hủy là bắt buộc" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo phiếu xuất hủy" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể tạo phiếu xuất hủy trong cửa hàng của mình" });
    }

    // Kiểm tra và xác thực từng sản phẩm trong danh sách
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_cost_price) {
        return res.status(400).json({ message: "Mỗi sản phẩm phải có đầy đủ product_id, quantity và unit_cost_price" });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({ message: "Số lượng xuất hủy phải lớn hơn 0" });
      }

      if (item.unit_cost_price <= 0) {
        return res.status(400).json({ message: "Giá vốn phải lớn hơn 0" });
      }

      // Kiểm tra sản phẩm có tồn tại và thuộc store này không (chỉ kiểm tra sản phẩm chưa bị xóa)
      const product = await Product.findOne({ _id: item.product_id, isDeleted: false });
      if (!product) {
        return res.status(404).json({ message: `Sản phẩm với ID ${item.product_id} không tồn tại` });
      }

      if (product.store_id.toString() !== storeId) {
        return res.status(400).json({ message: `Sản phẩm ${product.name} không thuộc cửa hàng này` });
      }
    }

    // Tạo mã xuất hủy tự động
    const disposalCode = await generateDisposalCode();

    // Tạo phiếu xuất hủy mới
    const newStockDisposal = new StockDisposal({
      disposal_code: disposalCode,
      disposal_date: new Date(disposal_date),
      created_by: userId,
      note: note || '',
      status: status || 'phiếu tạm',
      store_id: storeId,
      items: items
    });

    await newStockDisposal.save();

    // Lấy thông tin chi tiết và định dạng dữ liệu trả về (chỉ lấy phiếu chưa bị xóa)
    const populatedDisposal = await StockDisposal.findOne({ _id: newStockDisposal._id, isDeleted: false })
      .populate('created_by', 'username full_name')
      .populate('store_id', 'name address')
      .populate('items.product_id', 'name sku unit');

    const formattedDisposal = {
      _id: populatedDisposal._id,
      disposal_code: populatedDisposal.disposal_code,
      disposal_date: populatedDisposal.disposal_date,
      created_by: populatedDisposal.created_by,
      note: populatedDisposal.note,
      status: populatedDisposal.status,
      store: populatedDisposal.store_id,
      items: populatedDisposal.items.map(item => ({
        _id: item._id,
        product: item.product_id,
        quantity: item.quantity,
        unit_cost_price: parseFloat(item.unit_cost_price.toString())
      })),
      createdAt: populatedDisposal.createdAt,
      updatedAt: populatedDisposal.updatedAt
    };

    res.status(201).json({
      message: "Tạo phiếu xuất hủy thành công",
      stockDisposal: formattedDisposal
    });

  } catch (error) {
    console.error("❌ Lỗi createStockDisposal:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả phiếu xuất hủy của một cửa hàng =============
const getStockDisposalsByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user có quyền truy cập store này không
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra store có tồn tại không
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Kiểm tra quyền truy cập
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

    // Lấy tất cả phiếu xuất hủy của store (chỉ lấy phiếu chưa bị xóa)
    const stockDisposals = await StockDisposal.find({ store_id: storeId, isDeleted: false })
      .populate('created_by', 'username full_name')
      .populate('store_id', 'name')
      .populate('items.product_id', 'name sku')
      .sort({ disposal_date: -1 });

    // Định dạng dữ liệu trả về
    const formattedDisposals = stockDisposals.map(disposal => ({
      _id: disposal._id,
      disposal_code: disposal.disposal_code,
      disposal_date: disposal.disposal_date,
      created_by: disposal.created_by,
      note: disposal.note,
      status: disposal.status,
      store: disposal.store_id,
      total_items: disposal.items.length,
      total_quantity: disposal.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: disposal.createdAt,
      updatedAt: disposal.updatedAt
    }));

    res.status(200).json({
      message: "Lấy danh sách phiếu xuất hủy thành công",
      total: formattedDisposals.length,
      stockDisposals: formattedDisposals
    });

  } catch (error) {
    console.error("❌ Lỗi getStockDisposalsByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết một phiếu xuất hủy =============
const getStockDisposalById = async (req, res) => {
  try {
    const { disposalId } = req.params;
    const userId = req.user.id;

    const stockDisposal = await StockDisposal.findOne({ _id: disposalId, isDeleted: false })
      .populate('created_by', 'username full_name')
      .populate('store_id', 'name address phone owner_id')
      .populate('items.product_id', 'name sku unit');

    if (!stockDisposal) {
      return res.status(404).json({ message: "Phiếu xuất hủy không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && stockDisposal.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập phiếu xuất hủy này" });
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== stockDisposal.store_id._id.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập phiếu xuất hủy này" });
      }
    }

    // Định dạng dữ liệu trả về
    const formattedDisposal = {
      _id: stockDisposal._id,
      disposal_code: stockDisposal.disposal_code,
      disposal_date: stockDisposal.disposal_date,
      created_by: stockDisposal.created_by,
      note: stockDisposal.note,
      status: stockDisposal.status,
      store: stockDisposal.store_id,
      items: stockDisposal.items.map(item => ({
        _id: item._id,
        product: item.product_id,
        quantity: item.quantity,
        unit_cost_price: parseFloat(item.unit_cost_price.toString()),
        total_cost: item.quantity * parseFloat(item.unit_cost_price.toString())
      })),
      total_quantity: stockDisposal.items.reduce((sum, item) => sum + item.quantity, 0),
      total_cost_value: stockDisposal.items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.unit_cost_price.toString())), 0),
      createdAt: stockDisposal.createdAt,
      updatedAt: stockDisposal.updatedAt
    };

    res.status(200).json({
      message: "Lấy thông tin phiếu xuất hủy thành công",
      stockDisposal: formattedDisposal
    });

  } catch (error) {
    console.error("❌ Lỗi getStockDisposalById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật phiếu xuất hủy =============
const updateStockDisposal = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { disposalId } = req.params;
    const { disposal_date, note, status, items } = req.body;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật phiếu xuất hủy" });
    }

    // Tìm phiếu xuất hủy và kiểm tra quyền (chỉ tìm phiếu chưa bị xóa)
    const stockDisposal = await StockDisposal.findOne({ _id: disposalId, isDeleted: false }).populate('store_id', 'owner_id');
    if (!stockDisposal) {
      return res.status(404).json({ message: "Phiếu xuất hủy không tồn tại" });
    }

    if (stockDisposal.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật phiếu xuất hủy trong cửa hàng của mình" });
    }

    // Không cho phép cập nhật phiếu đã hoàn thành
    if (stockDisposal.status === 'hoàn thành' && status !== 'hoàn thành') {
      return res.status(400).json({ message: "Không thể cập nhật phiếu xuất hủy đã hoàn thành" });
    }

    // Kiểm tra và xác thực items nếu được cung cấp
    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Danh sách sản phẩm phải là mảng và không được trống" });
      }

      for (const item of items) {
        if (!item.product_id || !item.quantity || !item.unit_cost_price) {
          return res.status(400).json({ message: "Mỗi sản phẩm phải có đầy đủ product_id, quantity và unit_cost_price" });
        }

        if (item.quantity <= 0) {
          return res.status(400).json({ message: "Số lượng xuất hủy phải lớn hơn 0" });
        }

        if (item.unit_cost_price <= 0) {
          return res.status(400).json({ message: "Giá vốn phải lớn hơn 0" });
        }

        // Kiểm tra sản phẩm có tồn tại và thuộc store này không
        const product = await Product.findById(item.product_id);
        if (!product) {
          return res.status(404).json({ message: `Sản phẩm với ID ${item.product_id} không tồn tại` });
        }

        if (product.store_id.toString() !== stockDisposal.store_id._id.toString()) {
          return res.status(400).json({ message: `Sản phẩm ${product.name} không thuộc cửa hàng này` });
        }
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (disposal_date !== undefined) updateData.disposal_date = new Date(disposal_date);
    if (note !== undefined) updateData.note = note;
    if (status !== undefined) updateData.status = status;
    if (items !== undefined) updateData.items = items;

    // Cập nhật phiếu xuất hủy
    const updatedDisposal = await StockDisposal.findByIdAndUpdate(
      disposalId,
      updateData,
      { new: true }
    ).populate('created_by', 'username full_name')
     .populate('store_id', 'name address')
     .populate('items.product_id', 'name sku unit');

    // Định dạng dữ liệu trả về
    const formattedDisposal = {
      _id: updatedDisposal._id,
      disposal_code: updatedDisposal.disposal_code,
      disposal_date: updatedDisposal.disposal_date,
      created_by: updatedDisposal.created_by,
      note: updatedDisposal.note,
      status: updatedDisposal.status,
      store: updatedDisposal.store_id,
      items: updatedDisposal.items.map(item => ({
        _id: item._id,
        product: item.product_id,
        quantity: item.quantity,
        unit_cost_price: parseFloat(item.unit_cost_price.toString())
      })),
      createdAt: updatedDisposal.createdAt,
      updatedAt: updatedDisposal.updatedAt
    };

    res.status(200).json({
      message: "Cập nhật phiếu xuất hủy thành công",
      stockDisposal: formattedDisposal
    });

  } catch (error) {
    console.error("❌ Lỗi updateStockDisposal:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa phiếu xuất hủy =============
const deleteStockDisposal = async (req, res) => {
  try {
    const { disposalId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa phiếu xuất hủy" });
    }

    // Tìm phiếu xuất hủy và kiểm tra quyền (chỉ tìm phiếu chưa bị xóa)
    const stockDisposal = await StockDisposal.findOne({ _id: disposalId, isDeleted: false }).populate('store_id', 'owner_id');
    if (!stockDisposal) {
      return res.status(404).json({ message: "Phiếu xuất hủy không tồn tại" });
    }

    if (stockDisposal.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa phiếu xuất hủy trong cửa hàng của mình" });
    }

    // Không cho phép xóa phiếu đã hoàn thành
    if (stockDisposal.status === 'hoàn thành') {
      return res.status(400).json({ message: "Không thể xóa phiếu xuất hủy đã hoàn thành" });
    }

    // Soft delete - đánh dấu phiếu xuất hủy đã bị xóa
    stockDisposal.isDeleted = true;
    await stockDisposal.save();

    res.status(200).json({
      message: "Xóa phiếu xuất hủy thành công",
      deletedDisposalId: disposalId
    });

  } catch (error) {
    console.error("❌ Lỗi deleteStockDisposal:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createStockDisposal,
  getStockDisposalsByStore,
  getStockDisposalById,
  updateStockDisposal,
  deleteStockDisposal
};