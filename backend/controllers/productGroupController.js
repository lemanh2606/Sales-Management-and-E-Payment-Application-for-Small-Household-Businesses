const ProductGroup = require("../models/ProductGroup");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Product = require("../models/Product");

// ============= CREATE - Tạo nhóm sản phẩm mới =============
const createProductGroup = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { name, description } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: "Tên nhóm sản phẩm là bắt buộc" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo nhóm sản phẩm" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (store.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể tạo nhóm sản phẩm trong cửa hàng của mình" });
    }

    // Kiểm tra xem nhóm sản phẩm có tên trùng trong cùng cửa hàng không
    const existingGroup = await ProductGroup.findOne({ 
      name: name.trim(), 
      storeId: storeId 
    });
    if (existingGroup) {
      return res.status(409).json({ message: "Nhóm sản phẩm với tên này đã tồn tại trong cửa hàng" });
    }

    // Tạo nhóm sản phẩm mới
    const newProductGroup = new ProductGroup({
      name: name.trim(),
      description: description ? description.trim() : '',
      storeId: storeId
    });

    await newProductGroup.save();

    // Lấy thông tin chi tiết và định dạng dữ liệu trả về
    const populatedGroup = await ProductGroup.findById(newProductGroup._id)
      .populate('storeId', 'name address phone');

    const formattedGroup = {
      _id: populatedGroup._id,
      name: populatedGroup.name,
      description: populatedGroup.description,
      createdAt: populatedGroup.createdAt,
      updatedAt: populatedGroup.updatedAt,
      store: populatedGroup.storeId
    };

    res.status(201).json({
      message: "Tạo nhóm sản phẩm thành công",
      productGroup: formattedGroup
    });

  } catch (error) {
    console.error("❌ Lỗi createProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả nhóm sản phẩm của một cửa hàng =============
const getProductGroupsByStore = async (req, res) => {
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

    // Lấy tất cả nhóm sản phẩm của store
    const productGroups = await ProductGroup.find({ storeId: storeId })
      .populate('storeId', 'name address phone')
      .sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo mới nhất

    // Đếm số sản phẩm trong mỗi nhóm
    const formattedGroups = await Promise.all(
      productGroups.map(async (group) => {
        const productCount = await Product.countDocuments({ group_id: group._id });
        return {
          _id: group._id,
          name: group.name,
          description: group.description,
          productCount: productCount,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
          store: group.storeId
        };
      })
    );

    res.status(200).json({
      message: "Lấy danh sách nhóm sản phẩm thành công",
      total: formattedGroups.length,
      productGroups: formattedGroups
    });

  } catch (error) {
    console.error("❌ Lỗi getProductGroupsByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết một nhóm sản phẩm =============
const getProductGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const productGroup = await ProductGroup.findById(groupId)
      .populate('storeId', 'name address phone owner_id');

    if (!productGroup) {
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && productGroup.storeId.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập nhóm sản phẩm này" });
    }

    if (user.role === "STAFF") {
      // Tìm thông tin employee để lấy store_id
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res.status(404).json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== productGroup.storeId._id.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền truy cập nhóm sản phẩm này" });
      }
    }

    // Đếm số sản phẩm trong nhóm
    const productCount = await Product.countDocuments({ group_id: groupId });

    // Định dạng lại dữ liệu trả về
    const formattedGroup = {
      _id: productGroup._id,
      name: productGroup.name,
      description: productGroup.description,
      productCount: productCount,
      createdAt: productGroup.createdAt,
      updatedAt: productGroup.updatedAt,
      store: productGroup.storeId
    };

    res.status(200).json({
      message: "Lấy thông tin nhóm sản phẩm thành công",
      productGroup: formattedGroup
    });

  } catch (error) {
    console.error("❌ Lỗi getProductGroupById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật nhóm sản phẩm =============
const updateProductGroup = async (req, res) => {
  try {
    // Kiểm tra xem request body có tồn tại không
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json"
      });
    }

    const { groupId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (name !== undefined && (!name || name.trim() === '')) {
      return res.status(400).json({ message: "Tên nhóm sản phẩm không được để trống" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật nhóm sản phẩm" });
    }

    // Tìm nhóm sản phẩm và kiểm tra quyền
    const productGroup = await ProductGroup.findById(groupId).populate('storeId', 'owner_id');
    if (!productGroup) {
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
    }

    if (productGroup.storeId.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể cập nhật nhóm sản phẩm trong cửa hàng của mình" });
    }

    // Kiểm tra tên trùng lặp (nếu thay đổi tên)
    if (name && name.trim() !== productGroup.name) {
      const existingGroup = await ProductGroup.findOne({ 
        name: name.trim(), 
        storeId: productGroup.storeId._id,
        _id: { $ne: groupId } // Loại trừ chính nó
      });
      if (existingGroup) {
        return res.status(409).json({ message: "Nhóm sản phẩm với tên này đã tồn tại trong cửa hàng" });
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : '';

    // Cập nhật nhóm sản phẩm
    const updatedGroup = await ProductGroup.findByIdAndUpdate(
      groupId,
      updateData,
      { new: true }
    ).populate('storeId', 'name address phone');

    // Đếm số sản phẩm trong nhóm
    const productCount = await Product.countDocuments({ group_id: groupId });

    // Định dạng lại dữ liệu trả về
    const formattedGroup = {
      _id: updatedGroup._id,
      name: updatedGroup.name,
      description: updatedGroup.description,
      productCount: productCount,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt,
      store: updatedGroup.storeId
    };

    res.status(200).json({
      message: "Cập nhật nhóm sản phẩm thành công",
      productGroup: formattedGroup
    });

  } catch (error) {
    console.error("❌ Lỗi updateProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa nhóm sản phẩm =============
const deleteProductGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa nhóm sản phẩm" });
    }

    // Tìm nhóm sản phẩm và kiểm tra quyền
    const productGroup = await ProductGroup.findById(groupId).populate('storeId', 'owner_id');
    if (!productGroup) {
      return res.status(404).json({ message: "Nhóm sản phẩm không tồn tại" });
    }

    if (productGroup.storeId.owner_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn chỉ có thể xóa nhóm sản phẩm trong cửa hàng của mình" });
    }

    // Kiểm tra xem có sản phẩm nào đang sử dụng nhóm này không
    const productsInGroup = await Product.countDocuments({ group_id: groupId });
    if (productsInGroup > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa nhóm sản phẩm này vì có ${productsInGroup} sản phẩm đang sử dụng. Vui lòng chuyển các sản phẩm sang nhóm khác hoặc xóa các sản phẩm trước.` 
      });
    }

    // Xóa nhóm sản phẩm
    await ProductGroup.findByIdAndDelete(groupId);

    res.status(200).json({
      message: "Xóa nhóm sản phẩm thành công",
      deletedGroupId: groupId
    });

  } catch (error) {
    console.error("❌ Lỗi deleteProductGroup:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  // CRUD Operations
  createProductGroup,
  getProductGroupsByStore,
  getProductGroupById,
  updateProductGroup,
  deleteProductGroup
};