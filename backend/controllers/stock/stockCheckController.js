// controllers/stock/stockCheckController.js
const mongoose = require("mongoose");
const StockCheck = require("../../models/StockCheck");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Product = require("../../models/Product");

// ============= HELPER FUNCTIONS =============
// Tạo mã kiểm kho tự động với format KK-DDMMYYYY-XXXX
const generateStockCheckCode = async () => {
  const today = new Date();
  const dateStr =
    today.getDate().toString().padStart(2, "0") +
    (today.getMonth() + 1).toString().padStart(2, "0") +
    today.getFullYear().toString();

  const prefix = `KK-${dateStr}-`;

  // Tìm phiếu kiểm kho cuối cùng trong ngày
  const lastStockCheck = await StockCheck.findOne({
    check_code: { $regex: `^${prefix}` },
  }).sort({ check_code: -1 });

  let nextNumber = 1;

  if (lastStockCheck && lastStockCheck.check_code) {
    const lastNumber = parseInt(
      lastStockCheck.check_code.substring(prefix.length)
    );
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
};

// ============= CREATE - Tạo phiếu kiểm kho mới =============
const createStockCheck = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { check_date, notes, status, items } = req.body;
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    // Kiểm tra và xác thực dữ liệu đầu vào
    if (!check_date) {
      return res
        .status(400)
        .json({ message: "Thời gian kiểm kho là bắt buộc" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Danh sách hàng hóa kiểm kho là bắt buộc" });
    }

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được tạo phiếu kiểm kho" });
    }

    // Kiểm tra store có tồn tại và thuộc quyền quản lý
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    if (!store.owner_id.equals(userId)) {
      return res
        .status(403)
        .json({
          message: "Bạn chỉ có thể tạo phiếu kiểm kho trong cửa hàng của mình",
        });
    }

    // Kiểm tra và xác thực từng sản phẩm trong danh sách
    for (const item of items) {
      if (
        !item.product_id ||
        item.book_quantity === undefined ||
        item.actual_quantity === undefined
      ) {
        return res
          .status(400)
          .json({
            message:
              "Mỗi sản phẩm phải có đầy đủ product_id, book_quantity và actual_quantity",
          });
      }

      if (item.book_quantity < 0 || item.actual_quantity < 0) {
        return res
          .status(400)
          .json({ message: "Số lượng tồn kho và thực tế phải không âm" });
      }

      // Kiểm tra sản phẩm có tồn tại và thuộc store này không (chỉ kiểm tra sản phẩm chưa bị xóa)
      const product = await Product.findOne({
        _id: item.product_id,
        isDeleted: false,
      });
      if (!product) {
        return res
          .status(404)
          .json({
            message: `Sản phẩm với ID ${item.product_id} không tồn tại`,
          });
      }

      if (product.store_id.toString() !== storeId) {
        return res
          .status(400)
          .json({
            message: `Sản phẩm ${product.name} không thuộc cửa hàng này`,
          });
      }

      // Lấy cost_price và price từ database và thêm product_name
      item.cost_price = product.cost_price;
      item.price = product.price;
      item.product_name = product.name;

      // Kiểm tra cost_price và price có hợp lệ không
      if (!item.cost_price || item.cost_price <= 0) {
        return res
          .status(400)
          .json({
            message: `Sản phẩm ${product.name} chưa có giá vốn hoặc giá vốn không hợp lệ`,
          });
      }

      if (!item.price || item.price <= 0) {
        return res
          .status(400)
          .json({
            message: `Sản phẩm ${product.name} chưa có giá bán hoặc giá bán không hợp lệ`,
          });
      }
    }

    // Tạo mã kiểm kho tự động
    const checkCode = await generateStockCheckCode();

    // Tạo phiếu kiểm kho mới
    const newStockCheck = new StockCheck({
      check_code: checkCode,
      check_date: new Date(check_date),
      notes: notes || "",
      status: status || "phiếu tạm",
      store_id: storeId,
      created_by: userId,
      items: items,
    });

    await newStockCheck.save();

    // Lấy thông tin chi tiết và định dạng dữ liệu trả về (chỉ lấy phiếu chưa bị xóa)
    const populatedStockCheck = await StockCheck.findOne({
      _id: newStockCheck._id,
      isDeleted: false,
    })
      .populate("created_by", "username full_name")
      .populate("store_id", "name address")
      .populate("items.product_id", "name sku unit");

    const formattedStockCheck = {
      _id: populatedStockCheck._id,
      check_code: populatedStockCheck.check_code,
      check_date: populatedStockCheck.check_date,
      balance_date: populatedStockCheck.balance_date,
      created_by: populatedStockCheck.created_by,
      notes: populatedStockCheck.notes,
      status: populatedStockCheck.status,
      store: populatedStockCheck.store_id,
      items: populatedStockCheck.items.map((item) => {
        const variance_quantity = item.actual_quantity - item.book_quantity;
        const cost_price = parseFloat(item.cost_price.toString());
        const price = parseFloat(item.price.toString());
        const variance_value = variance_quantity * cost_price;

        return {
          _id: item._id,
          product_id: item.product_id._id,
          product_sku: item.product_id.sku,
          product_unit: item.product_id.unit,
          book_quantity: item.book_quantity,
          actual_quantity: item.actual_quantity,
          variance_quantity: variance_quantity,
          variance_value: variance_value,
          cost_price: cost_price,
          price: price,
        };
      }),
      createdAt: populatedStockCheck.createdAt,
      updatedAt: populatedStockCheck.updatedAt,
    };

    res.status(201).json({
      message: "Tạo phiếu kiểm kho thành công",
      stockCheck: formattedStockCheck,
    });
  } catch (error) {
    console.error(" Lỗi createStockCheck:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy tất cả phiếu kiểm kho của một cửa hàng =============
const getStockChecksByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

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
    if (user.role === "MANAGER" && 
!store.owner_id.equals(user._id)) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập cửa hàng này" });
    }

    if (user.role === "STAFF") {
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

    // Lấy tất cả phiếu kiểm kho của store (chỉ lấy phiếu chưa bị xóa)
    const stockChecks = await StockCheck.find({
      store_id: storeId,
      isDeleted: false,
    })
      .populate("created_by", "username full_name")
      .populate("store_id", "name")
      .sort({ check_date: -1 });

    // Định dạng dữ liệu trả về
    const formattedStockChecks = stockChecks.map((stockCheck) => {
      let total_variance_value = 0;
      let total_items = stockCheck.items.length;

      // Tính tổng giá trị lệch
      stockCheck.items.forEach((item) => {
        const variance_quantity = item.actual_quantity - item.book_quantity;
        const cost_price = parseFloat(item.cost_price.toString());
        total_variance_value += variance_quantity * cost_price;
      });

      return {
        _id: stockCheck._id,
        check_code: stockCheck.check_code,
        check_date: stockCheck.check_date,
        balance_date: stockCheck.balance_date,
        created_by: stockCheck.created_by,
        notes: stockCheck.notes,
        status: stockCheck.status,
        store: stockCheck.store_id,
        total_items: total_items,
        total_variance_value: total_variance_value,
        createdAt: stockCheck.createdAt,
        updatedAt: stockCheck.updatedAt,
      };
    });

    res.status(200).json({
      message: "Lấy danh sách phiếu kiểm kho thành công",
      total: formattedStockChecks.length,
      stockChecks: formattedStockChecks,
    });
  } catch (error) {
    console.error(" Lỗi getStockChecksByStore:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= READ - Lấy chi tiết một phiếu kiểm kho =============
const getStockCheckById = async (req, res) => {
  try {
    const { checkId } = req.params;
    const userId = req.user.id || req.user._id;

    const stockCheck = await StockCheck.findOne({
      _id: checkId,
      isDeleted: false,
    })
      .populate("created_by", "username full_name")
      .populate("store_id", "name address phone owner_id")
      .populate("items.product_id", "name sku unit");

    if (!stockCheck) {
      return res.status(404).json({ message: "Phiếu kiểm kho không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (
      user.role === "MANAGER" &&
      !stockCheck.store_id.owner_id.equals(user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền truy cập phiếu kiểm kho này" });
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId });
      if (!employee) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (employee.store_id.toString() !== stockCheck.store_id._id.toString()) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập phiếu kiểm kho này" });
      }
    }

    // Định dạng dữ liệu trả về với tính toán variance
    let total_variance_value = 0;

    const formattedItems = stockCheck.items.map((item) => {
      const variance_quantity = item.actual_quantity - item.book_quantity;
      const cost_price = parseFloat(item.cost_price.toString());
      const price = parseFloat(item.price.toString());
      const variance_value = variance_quantity * cost_price;
      total_variance_value += variance_value;

      return {
        _id: item._id,
        product_id: item.product_id._id,
        product_name: item.product_id.name,
        product_sku: item.product_id.sku,
        product_unit: item.product_id.unit,
        book_quantity: item.book_quantity,
        actual_quantity: item.actual_quantity,
        variance_quantity: variance_quantity,
        variance_value: variance_value,
        cost_price: cost_price,
        price: price,
      };
    });

    const formattedStockCheck = {
      _id: stockCheck._id,
      check_code: stockCheck.check_code,
      check_date: stockCheck.check_date,
      balance_date: stockCheck.balance_date,
      created_by: stockCheck.created_by,
      notes: stockCheck.notes,
      status: stockCheck.status,
      store: stockCheck.store_id,
      items: formattedItems,
      total_items: formattedItems.length,
      total_variance_value: total_variance_value,
      createdAt: stockCheck.createdAt,
      updatedAt: stockCheck.updatedAt,
    };

    res.status(200).json({
      message: "Lấy thông tin phiếu kiểm kho thành công",
      stockCheck: formattedStockCheck,
    });
  } catch (error) {
    console.error(" Lỗi getStockCheckById:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật phiếu kiểm kho =============
const updateStockCheck = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { checkId } = req.params;
    const { check_date, notes, status, items } = req.body;
    const userId = req.user.id || req.user._id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được cập nhật phiếu kiểm kho" });
    }

    // Tìm phiếu kiểm kho và kiểm tra quyền (chỉ tìm phiếu chưa bị xóa)
    const stockCheck = await StockCheck.findOne({
      _id: checkId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!stockCheck) {
      return res.status(404).json({ message: "Phiếu kiểm kho không tồn tại" });
    }

    if (!stockCheck.store_id.owner_id.equals(user._id)) {
      return res
        .status(403)
        .json({
          message:
            "Bạn chỉ có thể cập nhật phiếu kiểm kho trong cửa hàng của mình",
        });
    }

    // Không cho phép cập nhật phiếu đã cân bằng
    if (stockCheck.status === "Đã cân bằng" && status !== "Đã cân bằng") {
      return res
        .status(400)
        .json({ message: "Không thể cập nhật phiếu kiểm kho đã cân bằng" });
    }

    // Kiểm tra và xác thực items nếu được cung cấp
    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({
            message: "Danh sách hàng hóa phải là mảng và không được trống",
          });
      }

      for (const item of items) {
        if (
          !item.product_id ||
          item.book_quantity === undefined ||
          item.actual_quantity === undefined
        ) {
          return res
            .status(400)
            .json({
              message:
                "Mỗi sản phẩm phải có đầy đủ product_id, book_quantity và actual_quantity",
            });
        }

        if (item.book_quantity < 0 || item.actual_quantity < 0) {
          return res
            .status(400)
            .json({ message: "Số lượng tồn kho và thực tế phải không âm" });
        }

        // Kiểm tra sản phẩm có tồn tại và thuộc store này không
        const product = await Product.findById(item.product_id);
        if (!product) {
          return res
            .status(404)
            .json({
              message: `Sản phẩm với ID ${item.product_id} không tồn tại`,
            });
        }

        if (
          product.store_id.toString() !== stockCheck.store_id._id.toString()
        ) {
          return res
            .status(400)
            .json({
              message: `Sản phẩm ${product.name} không thuộc cửa hàng này`,
            });
        }

        // Lấy cost_price và price từ database và thêm product_name
        item.cost_price = product.cost_price;
        item.price = product.price;
        item.product_name = product.name;

        // Kiểm tra cost_price và price có hợp lệ không
        if (!item.cost_price || item.cost_price <= 0) {
          return res
            .status(400)
            .json({
              message: `Sản phẩm ${product.name} chưa có giá vốn hoặc giá vốn không hợp lệ`,
            });
        }

        if (!item.price || item.price <= 0) {
          return res
            .status(400)
            .json({
              message: `Sản phẩm ${product.name} chưa có giá bán hoặc giá bán không hợp lệ`,
            });
        }
      }
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (check_date !== undefined) updateData.check_date = new Date(check_date);
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (items !== undefined) updateData.items = items;

    // Cập nhật phiếu kiểm kho
    const updatedStockCheck = await StockCheck.findByIdAndUpdate(
      checkId,
      updateData,
      { new: true }
    )
      .populate("created_by", "username full_name")
      .populate("store_id", "name address")
      .populate("items.product_id", "name sku unit");

    // Định dạng dữ liệu trả về
    const formattedStockCheck = {
      _id: updatedStockCheck._id,
      check_code: updatedStockCheck.check_code,
      check_date: updatedStockCheck.check_date,
      balance_date: updatedStockCheck.balance_date,
      created_by: updatedStockCheck.created_by,
      notes: updatedStockCheck.notes,
      status: updatedStockCheck.status,
      store: updatedStockCheck.store_id,
      items: updatedStockCheck.items.map((item) => {
        const variance_quantity = item.actual_quantity - item.book_quantity;
        const cost_price = parseFloat(item.cost_price.toString());
        const price = parseFloat(item.price.toString());
        const variance_value = variance_quantity * cost_price;

        return {
          _id: item._id,
          product_id: item.product_id._id,
          product_name: item.product_id.name,
          product_sku: item.product_id.sku,
          product_unit: item.product_id.unit,
          book_quantity: item.book_quantity,
          actual_quantity: item.actual_quantity,
          variance_quantity: variance_quantity,
          variance_value: variance_value,
          cost_price: cost_price,
          price: price,
        };
      }),
      createdAt: updatedStockCheck.createdAt,
      updatedAt: updatedStockCheck.updatedAt,
    };

    res.status(200).json({
      message: "Cập nhật phiếu kiểm kho thành công",
      stockCheck: formattedStockCheck,
    });
  } catch (error) {
    console.error(" Lỗi updateStockCheck:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa phiếu kiểm kho =============
const deleteStockCheck = async (req, res) => {
  try {
    const { checkId } = req.params;
    const userId = req.user.id || req.user._id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới được xóa phiếu kiểm kho" });
    }

    // Tìm phiếu kiểm kho và kiểm tra quyền (chỉ tìm phiếu chưa bị xóa)
    const stockCheck = await StockCheck.findOne({
      _id: checkId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!stockCheck) {
      return res.status(404).json({ message: "Phiếu kiểm kho không tồn tại" });
    }

    if (!stockCheck.store_id.owner_id.equals(user._id)) {
      return res
        .status(403)
        .json({
          message: "Bạn chỉ có thể xóa phiếu kiểm kho trong cửa hàng của mình",
        });
    }

    // Không cho phép xóa phiếu đã cân bằng
    if (stockCheck.status === "Đã cân bằng") {
      return res
        .status(400)
        .json({ message: "Không thể xóa phiếu kiểm kho đã cân bằng" });
    }

    // Soft delete - đánh dấu phiếu kiểm kho đã bị xóa
    stockCheck.isDeleted = true;
    await stockCheck.save();

    res.status(200).json({
      message: "Xóa phiếu kiểm kho thành công",
      deletedCheckId: checkId,
    });
  } catch (error) {
    console.error(" Lỗi deleteStockCheck:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createStockCheck,
  getStockChecksByStore,
  getStockCheckById,
  updateStockCheck,
  deleteStockCheck,
};
