const Product = require("../models/Product");
const Store = require("../models/Store");
const User = require("../models/User");

// Lấy tất cả sản phẩm của một cửa hàng với thông tin nhà cung cấp
exports.getProductsByStore = async (req, res) => {
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

    // Kiểm tra quyền truy cập: chỉ owner của store mới được xem sản phẩm
    if (user.role === "MANAGER" && store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập cửa hàng này" });
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
exports.getProductById = async (req, res) => {
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

    // Format lại dữ liệu
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
