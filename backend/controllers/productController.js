const Product = require("../models/Product");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");

// ============= CREATE - Tạo sản phẩm mới =============
const createProduct = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json" 
      });
    }

    const { name, description, price, cost_price, stock_quantity, unit, supplier_id } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!name || !price || !cost_price) {
      return res.status(400).json({ message: "Tên sản phẩm, giá bán và giá vốn là bắt buộc" });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    if (isNaN(cost_price) || cost_price < 0) {
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    }

    if (stock_quantity !== undefined && (isNaN(stock_quantity) || stock_quantity < 0)) {
      return res.status(400).json({ message: "Số lượng tồn kho phải là số không âm" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo sản phẩm" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể tạo sản phẩm trong cửa hàng của mình" });
    }

    // Tạo sản phẩm mới
    const newProduct = new Product({
      name,
      description,
      price,
      cost_price,
      stock_quantity: stock_quantity || 0,
      unit,
      store_id: storeId,
      supplier_id: supplier_id || null
    });

    await newProduct.save();

    // Lấy thông tin chi tiết và định dạng dữ liệu trả về
    const populatedProduct = await Product.findById(newProduct._id)
      .populate('supplier_id', 'name')
      .populate('store_id', 'name address phone');

    const formattedProduct = {
      _id: populatedProduct._id,
      name: populatedProduct.name,
      description: populatedProduct.description,
      price: parseFloat(populatedProduct.price.toString()),
      cost_price: parseFloat(populatedProduct.cost_price.toString()),
      stock_quantity: populatedProduct.stock_quantity,
      unit: populatedProduct.unit,
      created_at: populatedProduct.created_at,
      store: populatedProduct.store_id,
      supplier: populatedProduct.supplier_id
    };

    res.status(201).json({
      message: "Tạo sản phẩm thành công",
      product: formattedProduct
    });

  } catch (error) {
    console.error("❌ Lỗi createProduct:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật sản phẩm đầy đủ =============
const updateProduct = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json" 
      });
    }

    const { productId } = req.params;
    const { name, description, price, cost_price, stock_quantity, unit, supplier_id } = req.body;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    if (cost_price !== undefined && (isNaN(cost_price) || cost_price < 0)) {
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    }

    if (stock_quantity !== undefined && (isNaN(stock_quantity) || stock_quantity < 0)) {
      return res.status(400).json({ message: "Số lượng tồn kho phải là số không âm" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật sản phẩm" });
    }

    // Tìm sản phẩm và kiểm tra quyền
    const product = await Product.findById(productId).populate('store_id', 'owner_id');
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật sản phẩm trong cửa hàng của mình" });
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (cost_price !== undefined) updateData.cost_price = cost_price;
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity;
    if (unit !== undefined) updateData.unit = unit;
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;

    // Cập nhật sản phẩm
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    ).populate('supplier_id', 'name')
     .populate('store_id', 'name address phone');

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: updatedProduct._id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: parseFloat(updatedProduct.price.toString()),
      cost_price: parseFloat(updatedProduct.cost_price.toString()),
      stock_quantity: updatedProduct.stock_quantity,
      unit: updatedProduct.unit,
      created_at: updatedProduct.created_at,
      store: updatedProduct.store_id,
      supplier: updatedProduct.supplier_id
    };

    res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      product: formattedProduct
    });

  } catch (error) {
    console.error("❌ Lỗi updateProduct:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa sản phẩm =============
const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa sản phẩm" });
    }

    // Tìm sản phẩm và kiểm tra quyền
    const product = await Product.findById(productId).populate('store_id', 'owner_id');
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa sản phẩm trong cửa hàng của mình" });
    }

    // Xóa sản phẩm
    await Product.findByIdAndDelete(productId);

    res.status(200).json({
      message: "Xóa sản phẩm thành công",
      deletedProductId: productId
    });

  } catch (error) {
    console.error("❌ Lỗi deleteProduct:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả sản phẩm của một cửa hàng =============
const getProductsByStore = async (req, res) => {
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

    // Kiểm tra quyền truy cập: owner của store hoặc employee thuộc store đó
    if (user.role === "MANAGER" && store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
    }

    if (user.role === "STAFF") {
      // Tìm thông tin employee để lấy store_id
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== storeId) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
      }
    }

    // Lấy tất cả sản phẩm của store với thông tin supplier
    const products = await Product.find({ store_id: storeId })
      .populate('supplier_id', 'name')
      .populate('store_id', 'name address phone')
      .sort({ created_at: -1 }); // Sắp xếp theo ngày tạo mới nhất

    // Chuyển đổi price và cost_price từ Decimal128 sang number
    const formattedProducts = products.map(product => ({
      _id: product._id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price.toString()),
      cost_price: parseFloat(product.cost_price.toString()),
      stock_quantity: product.stock_quantity,
      unit: product.unit,
      created_at: product.created_at,
      store: product.store_id,
      supplier: product.supplier_id
    }));

    res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total: formattedProducts.length,
      products: formattedProducts
    });

  } catch (error) {
    console.error("❌ Lỗi getProductsByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy chi tiết một sản phẩm với thông tin nhà cung cấp
const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const product = await Product.findById(productId)
      .populate('supplier_id', 'name')
      .populate('store_id', 'name address phone owner_id');

    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập sản phẩm này" });
    }
    
    if (user.role === "STAFF") {
      // Tìm thông tin employee để lấy store_id
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== product.store_id._id.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập sản phẩm này" });
      }
    }

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: product._id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price.toString()),
      cost_price: parseFloat(product.cost_price.toString()),
      stock_quantity: product.stock_quantity,
      unit: product.unit,
      created_at: product.created_at,
      store: product.store_id,
      supplier: product.supplier_id
    };

    res.status(200).json({
      message: "Lấy thông tin sản phẩm thành công",
      product: formattedProduct
    });

  } catch (error) {
    console.error("❌ Lỗi getProductById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật giá bán sản phẩm (chỉ manager)
const updateProductPrice = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json" 
      });
    }

    const { productId } = req.params;
    const { price } = req.body;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!price) {
      return res.status(400).json({ message: "Giá bán (price) là bắt buộc" });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật giá sản phẩm" });
    }

    // Tìm sản phẩm và populate store để kiểm tra quyền
    const product = await Product.findById(productId).populate('store_id', 'owner_id');
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra quyền: chỉ owner của store mới được cập nhật giá
    if (product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật giá sản phẩm trong cửa hàng của mình" });
    }

    // Cập nhật giá bán sản phẩm
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { price: price },
      { new: true }
    ).populate('supplier_id', 'name')
     .populate('store_id', 'name address phone');

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: updatedProduct._id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: parseFloat(updatedProduct.price.toString()),
      cost_price: parseFloat(updatedProduct.cost_price.toString()),
      stock_quantity: updatedProduct.stock_quantity,
      unit: updatedProduct.unit,
      created_at: updatedProduct.created_at,
      store: updatedProduct.store_id,
      supplier: updatedProduct.supplier_id
    };

    res.status(200).json({
      message: "Cập nhật giá bán sản phẩm thành công",
      product: formattedProduct
    });

  } catch (error) {
    console.error("❌ Lỗi updateProductPrice:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = { 
  // CUD 
  createProduct,
  updateProduct,
  deleteProduct,
  // Reads
  getProductsByStore, 
  getProductById, 
  // Updates
  updateProductPrice 
};