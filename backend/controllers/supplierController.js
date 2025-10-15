const Supplier = require("../models/Supplier");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");

// ============= CREATE - Tạo nhà cung cấp mới =============
const createSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { name, phone, email, address, status } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra dữ liệu đầu vào
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: "Tên nhà cung cấp là bắt buộc" });
    }

    // Kiểm tra status hợp lệ nếu có
    if (status && !['đang hoạt động', 'ngừng hoạt động'].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ. Chỉ chấp nhận 'đang hoạt động' hoặc 'ngừng hoạt động'" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo nhà cung cấp" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể tạo nhà cung cấp trong cửa hàng của mình" });
    }

    // Kiểm tra trùng tên nhà cung cấp trong cửa hàng
    const existingSupplier = await Supplier.findOne({
      name: name.trim(),
      store_id: storeId
    });

    if (existingSupplier) {
      return res.status(400).json({ message: "Nhà cung cấp này đã tồn tại trong cửa hàng" });
    }

    // Kiểm tra email hợp lệ nếu có
    if (email && email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }
    }

    // Tạo nhà cung cấp mới
    const newSupplier = new Supplier({
      name: name.trim(),
      phone: phone ? phone.trim() : '',
      email: email ? email.trim() : '',
      address: address ? address.trim() : '',
      status: status || 'đang hoạt động',
      store_id: storeId
    });

    await newSupplier.save();

    // Populate store info
    await newSupplier.populate('store_id', 'name address');

    res.status(201).json({
      message: "Tạo nhà cung cấp thành công",
      supplier: {
        _id: newSupplier._id,
        name: newSupplier.name,
        phone: newSupplier.phone,
        email: newSupplier.email,
        address: newSupplier.address,
        store: newSupplier.store_id,
        createdAt: newSupplier.createdAt,
        updatedAt: newSupplier.updatedAt
      }
    });

  } catch (error) {
    console.error(" Lỗi createSupplier:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả nhà cung cấp của một cửa hàng =============
const getSuppliersByStore = async (req, res) => {
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

    // Lấy tất cả nhà cung cấp của store
    const suppliers = await Supplier.find({ store_id: storeId })
      .populate('store_id', 'name')
      .sort({ name: 1 }); // Sắp xếp theo tên

    // Định dạng dữ liệu trả về
    const formattedSuppliers = suppliers.map(supplier => ({
      _id: supplier._id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      status: supplier.status,
      store: supplier.store_id,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt
    }));

    res.status(200).json({
      message: "Lấy danh sách nhà cung cấp thành công",
      total: formattedSuppliers.length,
      suppliers: formattedSuppliers
    });

  } catch (error) {
    console.error(" Lỗi getSuppliersByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết một nhà cung cấp =============
const getSupplierById = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user.id;

    const supplier = await Supplier.findById(supplierId)
      .populate('store_id', 'name address phone owner_id');

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && supplier.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== supplier.store_id._id.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
      }
    }

    res.status(200).json({
      message: "Lấy thông tin nhà cung cấp thành công",
      supplier: {
        _id: supplier._id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        status: supplier.status,
        store: supplier.store_id,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt
      }
    });

  } catch (error) {
    console.error(" Lỗi getSupplierById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật nhà cung cấp =============
const updateSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { supplierId } = req.params;
    const { name, phone, email, address, status } = req.body;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật nhà cung cấp" });
    }

    // Tìm nhà cung cấp và kiểm tra quyền
    const supplier = await Supplier.findById(supplierId).populate('store_id', 'owner_id');
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    if (supplier.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật nhà cung cấp trong cửa hàng của mình" });
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "Tên nhà cung cấp không được để trống" });
      }
      
      // Kiểm tra trùng tên (trừ chính nó)
      const existingSupplier = await Supplier.findOne({
        name: name.trim(),
        store_id: supplier.store_id._id,
        _id: { $ne: supplierId }
      });

      if (existingSupplier) {
        return res.status(400).json({ message: "Tên nhà cung cấp này đã tồn tại trong cửa hàng" });
      }
      
      updateData.name = name.trim();
    }
    
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : '';
    if (address !== undefined) updateData.address = address ? address.trim() : '';
    
    if (email !== undefined) {
      if (email && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ message: "Email không hợp lệ" });
        }
        updateData.email = email.trim();
      } else {
        updateData.email = '';
      }
    }

    if (status !== undefined) {
      if (!['đang hoạt động', 'ngừng hoạt động'].includes(status)) {
        return res.status(400).json({ 
          message: "Trạng thái không hợp lệ. Chỉ chấp nhận: 'đang hoạt động', 'ngừng hoạt động'" 
        });
      }
      updateData.status = status;
    }

    // Cập nhật nhà cung cấp
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      supplierId,
      updateData,
      { new: true }
    ).populate('store_id', 'name address');

    res.status(200).json({
      message: "Cập nhật nhà cung cấp thành công",
      supplier: {
        _id: updatedSupplier._id,
        name: updatedSupplier.name,
        phone: updatedSupplier.phone,
        email: updatedSupplier.email,
        address: updatedSupplier.address,
        status: updatedSupplier.status,
        store: updatedSupplier.store_id,
        createdAt: updatedSupplier.createdAt,
        updatedAt: updatedSupplier.updatedAt
      }
    });

  } catch (error) {
    console.error("❌ Lỗi updateSupplier:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa nhà cung cấp =============
const deleteSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa nhà cung cấp" });
    }

    // Tìm nhà cung cấp và kiểm tra quyền
    const supplier = await Supplier.findById(supplierId).populate('store_id', 'owner_id');
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    if (supplier.store_id.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa nhà cung cấp trong cửa hàng của mình" });
    }

    // Kiểm tra xem có sản phẩm nào đang sử dụng nhà cung cấp này không
    const Product = require("../models/Product");
    const productsUsingSupplier = await Product.countDocuments({ supplier_id: supplierId });
    
    if (productsUsingSupplier > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa nhà cung cấp này vì có ${productsUsingSupplier} sản phẩm đang sử dụng` 
      });
    }

    // Xóa nhà cung cấp
    await Supplier.findByIdAndDelete(supplierId);

    res.status(200).json({
      message: "Xóa nhà cung cấp thành công",
      deletedSupplierId: supplierId
    });

  } catch (error) {
    console.error(" Lỗi deleteSupplier:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createSupplier,
  getSuppliersByStore,
  getSupplierById,
  updateSupplier,
  deleteSupplier
};
