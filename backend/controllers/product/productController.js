// controllers/productController.js
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const ProductGroup = require("../../models/ProductGroup");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Supplier = require("../../models/Supplier");
const { cloudinary, deleteFromCloudinary } = require("../../utils/cloudinary");

// ============= HELPER FUNCTIONS =============
const generateSKU = async (storeId) => {
  const lastProduct = await Product.findOne({ store_id: storeId }).sort({
    createdAt: -1,
  });
  let nextNumber = 1;

  if (lastProduct && lastProduct.sku && lastProduct.sku.startsWith("SP")) {
    const lastNumber = parseInt(lastProduct.sku.substring(2));
    if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  let paddingLength = 6;
  if (nextNumber > 999999)
    paddingLength = Math.max(6, nextNumber.toString().length);

  return `SP${nextNumber.toString().padStart(paddingLength, "0")}`;
};

// ============= CREATE - Tạo sản phẩm mới =============
const createProduct = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const {
      name,
      description,
      sku,
      price,
      cost_price,
      stock_quantity,
      min_stock,
      max_stock,
      unit,
      status,
      supplier_id,
      group_id,
    } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!name || !price || !cost_price)
      return res
        .status(400)
        .json({ message: "Tên sản phẩm, giá bán và giá vốn là bắt buộc" });
    if (isNaN(price) || price < 0)
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    if (isNaN(cost_price) || cost_price < 0)
      return res.status(400).json({ message: "Giá vốn phải là số dương" });

    if (
      stock_quantity !== undefined &&
      (isNaN(stock_quantity) || stock_quantity < 0)
    )
      return res
        .status(400)
        .json({ message: "Số lượng tồn kho phải là số không âm" });
    if (min_stock !== undefined && (isNaN(min_stock) || min_stock < 0))
      return res
        .status(400)
        .json({ message: "Tồn kho tối thiểu phải là số không âm" });
    if (max_stock !== undefined && (isNaN(max_stock) || max_stock < 0))
      return res
        .status(400)
        .json({ message: "Tồn kho tối đa phải là số không âm" });
    if (
      min_stock !== undefined &&
      max_stock !== undefined &&
      min_stock > max_stock
    )
      return res.status(400).json({
        message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
      });

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    ) {
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    // Chỉ check quyền theo cửa hàng
    if (!store.owner_id.equals(userId)) {
      // Nếu là staff, kiểm tra xem có thuộc store không
      if (user.role === "STAFF") {
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee || employee.store_id.toString() !== storeId) {
          return res.status(403).json({
            message: "Bạn không có quyền tạo sản phẩm cho cửa hàng này",
          });
        }
      } else {
        return res.status(403).json({
          message: "Bạn không có quyền tạo sản phẩm cho cửa hàng này",
        });
      }
    }

    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      });
      if (!productGroup)
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      if (productGroup.storeId.toString() !== storeId)
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
    }

    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      });
      if (!supplier)
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      if (supplier.store_id.toString() !== storeId)
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
    }

    if (sku) {
      const existingProduct = await Product.findOne({
        sku,
        store_id: storeId,
        isDeleted: false,
      });
      if (existingProduct)
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
    }

    const productSKU = sku || (await generateSKU(storeId));

    let imageData = null;
    if (req.file) {
      imageData = {
        url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
      };
    }

    const newProduct = new Product({
      name,
      description,
      sku: productSKU,
      price,
      cost_price,
      stock_quantity: stock_quantity || 0,
      min_stock: min_stock || 0,
      max_stock: max_stock || null,
      unit,
      status: status || "Đang kinh doanh",
      store_id: storeId,
      supplier_id: supplier_id || null,
      group_id: group_id || null,
      image: imageData,
    });

    await newProduct.save();

    const populatedProduct = await Product.findOne({
      _id: newProduct._id,
      isDeleted: false,
    })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    res
      .status(201)
      .json({ message: "Tạo sản phẩm thành công", product: populatedProduct });
  } catch (error) {
    console.error("❌ Lỗi createProduct:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật sản phẩm đầy đủ =============
const updateProduct = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0)
      return res.status(400).json({ message: "Dữ liệu request body trống" });

    const { productId } = req.params;
    const userId = req.user.id || req.user._id;
    const {
      name,
      description,
      sku,
      price,
      cost_price,
      stock_quantity,
      min_stock,
      max_stock,
      unit,
      status,
      supplier_id,
      group_id,
    } = req.body;

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });

    // Check quyền
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    if (!product.store_id.owner_id.equals(userId)) {
      if (user.role === "STAFF") {
        const employee = await Employee.findOne({ user_id: userId });
        if (
          !employee ||
          employee.store_id.toString() !== product.store_id._id.toString()
        ) {
          return res
            .status(403)
            .json({ message: "Bạn không có quyền cập nhật sản phẩm này" });
        }
      } else {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền cập nhật sản phẩm này" });
      }
    }

    // Validate numeric fields
    if (price !== undefined && (isNaN(price) || price < 0))
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    if (cost_price !== undefined && (isNaN(cost_price) || cost_price < 0))
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    if (
      stock_quantity !== undefined &&
      (isNaN(stock_quantity) || stock_quantity < 0)
    )
      return res
        .status(400)
        .json({ message: "Số lượng tồn kho phải là số không âm" });
    if (min_stock !== undefined && (isNaN(min_stock) || min_stock < 0))
      return res
        .status(400)
        .json({ message: "Tồn kho tối thiểu phải là số không âm" });
    if (max_stock !== undefined && (isNaN(max_stock) || max_stock < 0))
      return res
        .status(400)
        .json({ message: "Tồn kho tối đa phải là số không âm" });
    if (
      min_stock !== undefined &&
      max_stock !== undefined &&
      min_stock > max_stock
    )
      return res.status(400).json({
        message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
      });

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    )
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });

    if (sku !== undefined && sku !== product.sku) {
      const existingProduct = await Product.findOne({
        sku,
        store_id: product.store_id._id,
        _id: { $ne: productId },
        isDeleted: false,
      });
      if (existingProduct)
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
    }

    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      });
      if (!productGroup)
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      if (productGroup.storeId.toString() !== product.store_id._id.toString())
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
    }

    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      });
      if (!supplier)
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      if (supplier.store_id.toString() !== product.store_id._id.toString())
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
    }

    const updateData = {
      name,
      description,
      sku,
      price,
      cost_price,
      stock_quantity,
      min_stock,
      max_stock,
      unit,
      status,
      supplier_id,
      group_id,
    };
    Object.keys(updateData).forEach(
      (k) => updateData[k] === undefined && delete updateData[k]
    );

    if (req.file) {
      if (product.image && product.image.public_id)
        await deleteFromCloudinary(product.image.public_id);
      updateData.image = {
        url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
      };
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    )
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    res.status(200).json({
      message: "Cập nhật sản phẩm thành công",
      product: updatedProduct,
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
    const userId = req.user.id || req.user._id;

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Người dùng không tồn tại" });

    if (!product.store_id.owner_id.equals(userId)) {
      if (user.role === "STAFF") {
        const employee = await Employee.findOne({ user_id: userId });
        if (
          !employee ||
          employee.store_id.toString() !== product.store_id._id.toString()
        )
          return res
            .status(403)
            .json({ message: "Bạn không có quyền xóa sản phẩm này" });
      } else
        return res
          .status(403)
          .json({ message: "Bạn không có quyền xóa sản phẩm này" });
    }

    product.isDeleted = true;
    await product.save();

    res.status(200).json({
      message: "Xóa sản phẩm thành công",
      deletedProductId: productId,
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
    const { page = 1, limit = 10 } = req.query;

    // Kiểm tra store có tồn tại không
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Phân trang
    const skip = (Number(page) - 1) * Number(limit);
    const query = { store_id: storeId, isDeleted: false };

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .populate("supplier_id", "name")
        .populate("store_id", "name")
        .populate("group_id", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    const formattedProducts = products.map((p) => ({
      _id: p._id,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: parseFloat(p.price?.toString() || 0),
      cost_price: parseFloat(p.cost_price?.toString() || 0),
      stock_quantity: p.stock_quantity,
      min_stock: p.min_stock,
      max_stock: p.max_stock,
      unit: p.unit,
      status: p.status,
      image: p.image,
      store: p.store_id,
      supplier: p.supplier_id,
      group: p.group_id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total,
      products: formattedProducts,
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
    const userId = req.user.id || req.user._id;

    const product = await Product.findOne({ _id: productId, isDeleted: false })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (
      user.role === "MANAGER" &&
      !product.store_id.owner_id.equals(user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập sản phẩm này" });
    }

    if (user.role === "STAFF") {
      // Tìm thông tin employee để lấy store_id
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== product.store_id._id.toString()) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập sản phẩm này" });
      }
    }

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: product._id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: parseFloat(product.price.toString()),
      cost_price: parseFloat(product.cost_price.toString()),
      stock_quantity: product.stock_quantity,
      min_stock: product.min_stock,
      max_stock: product.max_stock,
      unit: product.unit,
      status: product.status,
      image: product.image,
      store: product.store_id,
      supplier: product.supplier_id,
      group: product.group_id,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    res.status(200).json({
      message: "Lấy thông tin sản phẩm thành công",
      product: formattedProduct,
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
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { productId } = req.params;
    const { price } = req.body;
    const userId = req.user.id || req.user._id;

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
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được cập nhật giá sản phẩm" });
    }

    // Tìm sản phẩm và populate store để kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    // Kiểm tra quyền: chỉ owner của store mới được cập nhật giá
    if (!product.store_id.owner_id.equals(user._id)) {
      return res.status(403).json({
        message: "Bạn chỉ có thể cập nhật giá sản phẩm trong cửa hàng của mình",
      });
    }

    // Cập nhật giá bán sản phẩm
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { price: price },
      { new: true }
    )
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    // Định dạng lại dữ liệu trả về
    const formattedProduct = {
      _id: updatedProduct._id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      sku: updatedProduct.sku,
      price: parseFloat(updatedProduct.price.toString()),
      cost_price: parseFloat(updatedProduct.cost_price.toString()),
      stock_quantity: updatedProduct.stock_quantity,
      min_stock: updatedProduct.min_stock,
      max_stock: updatedProduct.max_stock,
      unit: updatedProduct.unit,
      status: updatedProduct.status,
      image: updatedProduct.image,
      store: updatedProduct.store_id,
      supplier: updatedProduct.supplier_id,
      group: updatedProduct.group_id,
      createdAt: updatedProduct.createdAt,
      updatedAt: updatedProduct.updatedAt,
    };

    res.status(200).json({
      message: "Cập nhật giá bán sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error("❌ Lỗi updateProductPrice:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

//Lấy list sản phẩm tồn kho thấp (stock <= min_stock, status "Đang kinh doanh", min_stock > 0, lowStockAlerted = false)
const getLowStockProducts = async (req, res) => {
  try {
    const { storeId } = req.query; // Filter theo storeId (optional, cho manager multi-store)

    const query = {
      stock_quantity: { $lte: "$min_stock" }, // Tồn kho <= min_stock
      status: "Đang kinh doanh", // Chỉ sản phẩm đang bán
      min_stock: { $gt: 0 }, // Min stock > 0 tránh cảnh báo ảo
      lowStockAlerted: false, // Chưa cảnh báo
      store_id: storeId
        ? new mongoose.Types.ObjectId(storeId)
        : { $exists: true }, // Filter store nếu có
      isDeleted: false, // Chỉ lấy sản phẩm chưa bị xóa
    };

    const lowStockProds = await Product.find(query)
      .select("name sku stock_quantity min_stock unit") // Chỉ lấy field cần thiết
      .sort({ stock_quantity: 1 }) // Sắp xếp tăng dần tồn kho (thấp nhất trước)
      .limit(20) // Limit 20 để tránh query lớn
      .lean(); // Lean cho nhanh

    console.log(
      `Query low stock thành công, số lượng: ${
        lowStockProds.length
      } sản phẩm cho store ${storeId || "tất cả"}`
    );
    res.json({
      message: "Lấy danh sách tồn kho thấp thành công",
      products: lowStockProds,
    });
  } catch (err) {
    console.error("Lỗi query low stock:", err.message); // Log tiếng Việt error
    res.status(500).json({ message: "Lỗi server khi lấy tồn kho thấp" });
  }
};

// GET /api/products/search - Tìm sản phẩm theo tên hoặc SKU (regex case-insensitive)
const searchProducts = async (req, res) => {
  try {
    const { query, storeId, limit = 10 } = req.query; // Params: query (tên/SKU), storeId, limit (default 10)

    if (!query || query.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Query tìm kiếm không được để trống" });
    }

    const searchQuery = {
      $or: [
        { name: { $regex: query.trim(), $options: "i" } }, // Tìm tên (case-insensitive)
        { sku: { $regex: query.trim(), $options: "i" } }, // Tìm SKU (case-insensitive)
      ],
      status: "Đang kinh doanh", // Chỉ sản phẩm đang bán
      store_id: new mongoose.Types.ObjectId(storeId), // Filter store của staff/manager
      isDeleted: false, // Chỉ tìm sản phẩm chưa bị xóa
    };

    const products = await Product.find(searchQuery)
      .select("name sku price stock_quantity unit") // Chỉ lấy field cần thiết
      .sort({ name: 1 }) // Sắp xếp theo tên A-Z
      .limit(parseInt(limit)) // Limit số kết quả
      .lean(); // Lean cho nhanh

    console.log(
      `Tìm kiếm sản phẩm thành công: "${query}" trong store ${storeId}, kết quả: ${products.length} sản phẩm`
    );
    res.json({ message: `Tìm thấy ${products.length} sản phẩm`, products });
  } catch (err) {
    console.error("Lỗi search sản phẩm:", err.message);
    res.status(500).json({ message: "Lỗi server khi tìm kiếm sản phẩm" });
  }
};

// DELETE IMAGE - Xóa ảnh sản phẩm (chỉ manager)
const deleteProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id || req.user._id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được xóa ảnh sản phẩm" });
    }

    // Tìm sản phẩm và kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (!product.store_id.owner_id.equals(user._id)) {
      return res.status(403).json({
        message: "Bạn chỉ có thể xóa ảnh sản phẩm trong cửa hàng của mình",
      });
    }

    // Kiểm tra có ảnh không
    if (!product.image || !product.image.public_id) {
      return res.status(404).json({ message: "Sản phẩm không có ảnh" });
    }

    // Xóa ảnh trên Cloudinary
    try {
      await deleteFromCloudinary(product.image.public_id);
    } catch (error) {
      console.error("Lỗi xóa ảnh trên Cloudinary:", error);
      return res.status(500).json({ message: "Lỗi xóa ảnh trên Cloudinary" });
    }

    // Xóa thông tin ảnh trong database
    product.image = null;
    await product.save();

    res.status(200).json({
      message: "Xóa ảnh sản phẩm thành công",
      productId: productId,
    });
  } catch (error) {
    console.error("❌ Lỗi deleteProductImage:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  // CUD
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  searchProducts,
  // Reads
  getProductsByStore,
  getProductById,
  // Updates
  updateProductPrice,
  // thông báo, cảnh báo
  getLowStockProducts,
};
