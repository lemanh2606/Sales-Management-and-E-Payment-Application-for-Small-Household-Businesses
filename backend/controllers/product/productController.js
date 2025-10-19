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
// Tạo SKU tự động với format SPXXXXXX (X là số) - duy nhất theo từng cửa hàng
// Tự động mở rộng khi vượt quá SP999999
const generateSKU = async (storeId) => {
  const lastProduct = await Product.findOne({ store_id: storeId }).sort({
    createdAt: -1,
  });
  let nextNumber = 1;

  if (lastProduct && lastProduct.sku && lastProduct.sku.startsWith("SP")) {
    const lastNumber = parseInt(lastProduct.sku.substring(2));
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Tự động mở rộng độ dài khi vượt quá 999999
  let paddingLength = 6;
  if (nextNumber > 999999) {
    paddingLength = Math.max(6, nextNumber.toString().length);
  }

  return `SP${nextNumber.toString().padStart(paddingLength, "0")}`;
};

// ============= CREATE - Tạo sản phẩm mới =============
const createProduct = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
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
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!name || !price || !cost_price) {
      return res
        .status(400)
        .json({ message: "Tên sản phẩm, giá bán và giá vốn là bắt buộc" });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    if (isNaN(cost_price) || cost_price < 0) {
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    }

    if (
      stock_quantity !== undefined &&
      (isNaN(stock_quantity) || stock_quantity < 0)
    ) {
      return res
        .status(400)
        .json({ message: "Số lượng tồn kho phải là số không âm" });
    }

    if (min_stock !== undefined && (isNaN(min_stock) || min_stock < 0)) {
      return res
        .status(400)
        .json({ message: "Tồn kho tối thiểu phải là số không âm" });
    }

    if (max_stock !== undefined && (isNaN(max_stock) || max_stock < 0)) {
      return res
        .status(400)
        .json({ message: "Tồn kho tối đa phải là số không âm" });
    }

    if (
      min_stock !== undefined &&
      max_stock !== undefined &&
      min_stock > max_stock
    ) {
      return res.status(400).json({
        message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
      });
    }

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    ) {
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được tạo sản phẩm" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({
        message: "Bạn chỉ có thể tạo sản phẩm trong cửa hàng của mình",
      });
    }

    // Kiểm tra ProductGroup nếu được cung cấp (chỉ kiểm tra nhóm chưa bị xóa)
    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      });
      if (!productGroup) {
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      }
      if (productGroup.storeId.toString() !== storeId) {
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
      }
    }

    // Kiểm tra Supplier nếu được cung cấp (chỉ kiểm tra nhà cung cấp chưa bị xóa)
    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      });
      if (!supplier) {
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      }
      if (supplier.store_id.toString() !== storeId) {
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
      }
    }

    // Kiểm tra SKU tùy chỉnh có trùng trong cửa hàng không (chỉ kiểm tra sản phẩm chưa bị xóa)
    if (sku) {
      const existingProduct = await Product.findOne({
        sku: sku,
        store_id: storeId,
        isDeleted: false,
      });
      if (existingProduct) {
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
      }
    }

    // Tạo SKU tự động nếu không được cung cấp
    const productSKU = sku || (await generateSKU(storeId));

    // Xử lý ảnh upload (nếu có)
    let imageData = null;
    if (req.file) {
      console.log("📸 req.file received:", JSON.stringify(req.file, null, 2)); // Debug log
      try {
        // Multer-storage-cloudinary stores info in req.file
        imageData = {
          url: req.file.path || req.file.secure_url || req.file.url, // Cloudinary URL
          public_id: req.file.filename || req.file.public_id, // Cloudinary public_id
        };
        console.log("📸 imageData created:", imageData); // Debug log
      } catch (imgError) {
        console.error("❌ Error processing image:", imgError);
        throw new Error("Lỗi xử lý ảnh upload: " + imgError.message);
      }
    } else {
      console.log("ℹ️ No file uploaded (req.file is undefined)");
    }

    // Tạo sản phẩm mới
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

    // Lấy thông tin chi tiết và định dạng dữ liệu trả về (chỉ lấy sản phẩm chưa bị xóa)
    const populatedProduct = await Product.findOne({
      _id: newProduct._id,
      isDeleted: false,
    })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name");

    const formattedProduct = {
      _id: populatedProduct._id,
      name: populatedProduct.name,
      description: populatedProduct.description,
      sku: populatedProduct.sku,
      price: parseFloat(populatedProduct.price.toString()),
      cost_price: parseFloat(populatedProduct.cost_price.toString()),
      stock_quantity: populatedProduct.stock_quantity,
      min_stock: populatedProduct.min_stock,
      max_stock: populatedProduct.max_stock,
      unit: populatedProduct.unit,
      status: populatedProduct.status,
      image: populatedProduct.image,
      store: populatedProduct.store_id,
      supplier: populatedProduct.supplier_id,
      group: populatedProduct.group_id,
      createdAt: populatedProduct.createdAt,
      updatedAt: populatedProduct.updatedAt,
    };

    res.status(201).json({
      message: "Tạo sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error("❌ Lỗi createProduct:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ============= UPDATE - Cập nhật sản phẩm đầy đủ =============
const updateProduct = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { productId } = req.params;
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
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ message: "Giá bán phải là số dương" });
    }

    if (cost_price !== undefined && (isNaN(cost_price) || cost_price < 0)) {
      return res.status(400).json({ message: "Giá vốn phải là số dương" });
    }

    if (
      stock_quantity !== undefined &&
      (isNaN(stock_quantity) || stock_quantity < 0)
    ) {
      return res
        .status(400)
        .json({ message: "Số lượng tồn kho phải là số không âm" });
    }

    if (min_stock !== undefined && (isNaN(min_stock) || min_stock < 0)) {
      return res
        .status(400)
        .json({ message: "Tồn kho tối thiểu phải là số không âm" });
    }

    if (max_stock !== undefined && (isNaN(max_stock) || max_stock < 0)) {
      return res
        .status(400)
        .json({ message: "Tồn kho tối đa phải là số không âm" });
    }

    if (
      min_stock !== undefined &&
      max_stock !== undefined &&
      min_stock > max_stock
    ) {
      return res.status(400).json({
        message: "Tồn kho tối thiểu không thể lớn hơn tồn kho tối đa",
      });
    }

    if (
      status &&
      !["Đang kinh doanh", "Ngừng kinh doanh", "Ngừng bán"].includes(status)
    ) {
      return res
        .status(400)
        .json({ message: "Trạng thái sản phẩm không hợp lệ" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được cập nhật sản phẩm" });
    }

    // Tìm sản phẩm và kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({
        message: "Bạn chỉ có thể cập nhật sản phẩm trong cửa hàng của mình",
      });
    }

    // Kiểm tra ProductGroup nếu được cung cấp (chỉ kiểm tra nhóm chưa bị xóa)
    if (group_id) {
      const productGroup = await ProductGroup.findOne({
        _id: group_id,
        isDeleted: false,
      });
      if (!productGroup) {
        return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
      }
      if (productGroup.storeId.toString() !== product.store_id._id.toString()) {
        return res
          .status(400)
          .json({ message: "Nhóm sản phẩm không thuộc cửa hàng này" });
      }
    }

    // Kiểm tra Supplier nếu được cung cấp (chỉ kiểm tra nhà cung cấp chưa bị xóa)
    if (supplier_id) {
      const supplier = await Supplier.findOne({
        _id: supplier_id,
        isDeleted: false,
      });
      if (!supplier) {
        return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
      }
      if (supplier.store_id.toString() !== product.store_id._id.toString()) {
        return res
          .status(400)
          .json({ message: "Nhà cung cấp không thuộc cửa hàng này" });
      }
    }

    // Kiểm tra SKU tùy chỉnh có trùng trong cửa hàng không (nếu thay đổi SKU, chỉ kiểm tra sản phẩm chưa bị xóa)
    if (sku !== undefined && sku !== product.sku) {
      const existingProduct = await Product.findOne({
        sku: sku,
        store_id: product.store_id._id,
        _id: { $ne: productId }, // Loại trừ chính sản phẩm đang cập nhật
        isDeleted: false,
      });
      if (existingProduct) {
        return res
          .status(409)
          .json({ message: "Mã SKU này đã tồn tại trong cửa hàng" });
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (sku !== undefined) updateData.sku = sku;
    if (price !== undefined) updateData.price = price;
    if (cost_price !== undefined) updateData.cost_price = cost_price;
    if (stock_quantity !== undefined)
      updateData.stock_quantity = stock_quantity;
    if (min_stock !== undefined) updateData.min_stock = min_stock;
    if (max_stock !== undefined) updateData.max_stock = max_stock;
    if (unit !== undefined) updateData.unit = unit;
    if (status !== undefined) updateData.status = status;
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
    if (group_id !== undefined) updateData.group_id = group_id;

    // Xử lý cập nhật ảnh (nếu có file mới)
    if (req.file) {
      // Xóa ảnh cũ trên Cloudinary nếu có
      if (product.image && product.image.public_id) {
        try {
          await deleteFromCloudinary(product.image.public_id);
        } catch (error) {
          console.error("Lỗi xóa ảnh cũ:", error);
        }
      }
      // Cập nhật ảnh mới
      updateData.image = {
        url: req.file.path || req.file.secure_url,
        public_id: req.file.filename || req.file.public_id,
      };
    }

    // Thêm logic reset lowStockAlerted (explicit trong controller, double-check với pre-save hook)
    if (stock_quantity !== undefined && min_stock !== undefined) {
      if (stock_quantity <= min_stock) {
        updateData.lowStockAlerted = true; // Bật cảnh báo thiếu hàng và sẽ gửi email
      } else {
        updateData.lowStockAlerted = false; // Tắt cảnh báo vì đã đủ hàng và sẽ reset để gửi cảnh báo sau này
      }
    }

    // Cập nhật sản phẩm
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
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
      message: "Cập nhật sản phẩm thành công",
      product: formattedProduct,
    });
  } catch (error) {
    console.error("Lỗi updateProduct:", error);
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
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được xóa sản phẩm" });
    }

    // Tìm sản phẩm và kiểm tra quyền (chỉ tìm sản phẩm chưa bị xóa)
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    if (product.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({
        message: "Bạn chỉ có thể xóa sản phẩm trong cửa hàng của mình",
      });
    }

    // Soft delete - đánh dấu sản phẩm đã bị xóa
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
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập cửa hàng này" });
    }

    if (user.role === "STAFF") {
      // Tìm thông tin employee để lấy store_id
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== storeId) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập cửa hàng này" });
      }
    }

    // Lấy tất cả sản phẩm của store với thông tin supplier (chỉ lấy sản phẩm chưa bị xóa)
    const products = await Product.find({ store_id: storeId, isDeleted: false })
      .populate("supplier_id", "name")
      .populate("store_id", "name")
      .populate("group_id", "name")
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo mới nhất

    // Chuyển đổi price và cost_price từ Decimal128 sang number
    const formattedProducts = products.map((product) => ({
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
    }));

    res.status(200).json({
      message: "Lấy danh sách sản phẩm thành công",
      total: formattedProducts.length,
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
    const userId = req.user.id;

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
      product.store_id.owner_id.toString() !== userId
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
    if (product.store_id.owner_id.toString() !== userId) {
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
    const userId = req.user.id;

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

    if (product.store_id.owner_id.toString() !== userId) {
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
