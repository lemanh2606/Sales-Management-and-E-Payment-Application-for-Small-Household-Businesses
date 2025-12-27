// backend/controllers/warehouseController.js
const Warehouse = require("../models/Warehouse");
const Store = require("../models/Store");
const logActivity = require("../utils/logActivity"); // ✅ giống loyaltyController

// ===== GET all warehouses =====
const getWarehouses = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { deleted = false, status, page = 1, limit = 20, q } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    const filter = {
      store_id: storeId,
      isDeleted: deleted === "true" || deleted === true,
    };

    if (status) {
      filter.status = status;
    }

    if (q) {
      filter.$or = [
        { code: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { contact_person: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const warehouses = await Warehouse.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("manager_ids", "name email phone")
      .populate("createdBy", "name email");

    const total = await Warehouse.countDocuments(filter);

    return res.json({
      message: "Tải danh sách kho thành công",
      warehouses,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("❌ Lỗi getWarehouses:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== GET one warehouse =====
const getWarehouseById = async (req, res) => {
  try {
    const { storeId, warehouseId } = req.params;

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      store_id: storeId,
      isDeleted: false,
    })
      .populate("manager_ids", "name email phone")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!warehouse) {
      return res.status(404).json({ message: "Kho không tồn tại" });
    }

    return res.json({
      message: "Lấy chi tiết kho thành công",
      warehouse,
    });
  } catch (error) {
    console.error("❌ Lỗi getWarehouseById:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== CREATE warehouse =====
const createWarehouse = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const {
      code,
      name,
      description,
      address,
      ward,
      district,
      city,
      country,
      postal_code,
      latitude,
      longitude,
      contact_person,
      phone,
      email,
      warehouse_type,
      capacity,
      capacity_unit,
      status,
      is_default,
      manager_ids,
      allow_negative_stock,
      auto_reorder,
      reorder_point,
      barcode_enabled,
      lot_tracking,
      expiry_tracking,
      fifo_enabled,
      opening_hours,
      notes,
    } = req.body;

    if (!storeId || !code || !name) {
      return res.status(400).json({
        message: "Thiếu storeId, code hoặc name",
      });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Check code unique per store
    const existingWarehouse = await Warehouse.findOne({
      store_id: storeId,
      code,
      isDeleted: false,
    });

    if (existingWarehouse) {
      return res.status(409).json({
        message: "Mã kho này đã tồn tại trong cửa hàng",
      });
    }

    const warehouseData = {
      store_id: storeId,
      code,
      name,
      description: description || "",
      address: address || "",
      ward: ward || "",
      district: district || "",
      city: city || "",
      country: country || "Việt Nam",
      postal_code: postal_code || "",
      latitude: latitude || null,
      longitude: longitude || null,
      contact_person: contact_person || "",
      phone: phone || "",
      email: email || "",
      warehouse_type: warehouse_type || "normal",
      capacity: capacity || null,
      capacity_unit: capacity_unit || "m3",
      status: status || "active",
      is_default: is_default || false,
      manager_ids: manager_ids || [],
      allow_negative_stock: allow_negative_stock || false,
      auto_reorder: auto_reorder || false,
      reorder_point: reorder_point || null,
      barcode_enabled: barcode_enabled !== false,
      lot_tracking: lot_tracking || false,
      expiry_tracking: expiry_tracking || false,
      fifo_enabled: fifo_enabled !== false,
      opening_hours: opening_hours || {},
      notes: notes || "",
      createdBy: userId,
    };

    const warehouse = new Warehouse(warehouseData);
    await warehouse.save();

    // Update Store: set default_warehouse_id nếu is_default
    if (is_default) {
      await Store.updateOne({ _id: storeId }, { default_warehouse_id: warehouse._id });
    }

    // ✅ ghi log giống loyaltyController
    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "Warehouse",
      entityId: warehouse._id,
      entityName: warehouse.name,
      req,
      description: `Tạo mới kho ${warehouse.name}. (Mã: ${warehouse.code}) tại cửa hàng ${storeId}`,
    });

    return res.status(201).json({
      message: "Tạo kho thành công",
      warehouse,
    });
  } catch (error) {
    console.error("❌ Lỗi createWarehouse:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== UPDATE warehouse =====
const updateWarehouse = async (req, res) => {
  try {
    const { storeId, warehouseId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      store_id: storeId,
      isDeleted: false,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Kho không tồn tại" });
    }

    const updateData = {
      ...req.body,
      updatedBy: userId,
    };

    // Nếu đổi code, check unique
    if (updateData.code && updateData.code !== warehouse.code) {
      const existing = await Warehouse.findOne({
        store_id: storeId,
        code: updateData.code,
        _id: { $ne: warehouseId },
        isDeleted: false,
      });
      if (existing) {
        return res.status(409).json({
          message: "Mã kho này đã tồn tại trong cửa hàng",
        });
      }
    }

    const updatedWarehouse = await Warehouse.findByIdAndUpdate(warehouseId, updateData, { new: true }).populate("manager_ids", "name email phone");

    // Update Store nếu set default
    if (updateData.is_default) {
      await Store.updateOne({ _id: storeId }, { default_warehouse_id: warehouseId });
    }

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "update",
      entity: "Warehouse",
      entityId: warehouseId,
      entityName: updatedWarehouse.name,
      req,
      description: `Cập nhật kho ${updatedWarehouse.name} (${updatedWarehouse.code})`,
    });

    return res.json({
      message: "Cập nhật kho thành công",
      warehouse: updatedWarehouse,
    });
  } catch (error) {
    console.error("❌ Lỗi updateWarehouse:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== DELETE (soft delete) =====
const deleteWarehouse = async (req, res) => {
  try {
    const { storeId, warehouseId } = req.params;

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      store_id: storeId,
      isDeleted: false,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Kho không tồn tại" });
    }

    if (warehouse.is_default) {
      return res.status(400).json({
        message: "Không thể xóa kho mặc định. Vui lòng chọn kho khác làm mặc định trước.",
      });
    }

    await Warehouse.updateOne({ _id: warehouseId }, { isDeleted: true, is_default: false });

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "delete",
      entity: "Warehouse",
      entityId: warehouseId,
      entityName: warehouse.name,
      req,
      description: `Xóa kho ${warehouse.name}. (Mã: ${warehouse.code})`,
    });

    return res.json({
      message: "Xóa kho thành công",
    });
  } catch (error) {
    console.error("❌ Lỗi deleteWarehouse:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== RESTORE warehouse =====
const restoreWarehouse = async (req, res) => {
  try {
    const { storeId, warehouseId } = req.params;

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      store_id: storeId,
      isDeleted: true,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Kho không tồn tại hoặc không bị xóa" });
    }

    await Warehouse.updateOne({ _id: warehouseId }, { isDeleted: false });

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "restore",
      entity: "Warehouse",
      entityId: warehouseId,
      entityName: warehouse.name,
      req,
      description: `Khôi phục kho ${warehouse.name}. (Mã: ${warehouse.code})`,
    });

    return res.json({
      message: "Khôi phục kho thành công",
    });
  } catch (error) {
    console.error("❌ Lỗi restoreWarehouse:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ===== SET DEFAULT WAREHOUSE =====
const setDefaultWarehouse = async (req, res) => {
  try {
    const { storeId, warehouseId } = req.params;

    const warehouse = await Warehouse.findOne({
      _id: warehouseId,
      store_id: storeId,
      isDeleted: false,
    });

    if (!warehouse) {
      return res.status(404).json({ message: "Kho không tồn tại" });
    }

    await Warehouse.updateMany({ store_id: storeId, _id: { $ne: warehouseId } }, { is_default: false });
    await Warehouse.updateOne({ _id: warehouseId }, { is_default: true });
    await Store.updateOne({ _id: storeId }, { default_warehouse_id: warehouseId });

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "update",
      entity: "Warehouse",
      entityId: warehouseId,
      entityName: warehouse.name,
      req,
      description: `Đặt kho ${warehouse.name}. (Mã: ${warehouse.code}) làm kho mặc định`,
    });

    return res.json({
      message: "Đặt kho mặc định thành công",
      warehouse,
    });
  } catch (error) {
    console.error("❌ Lỗi setDefaultWarehouse:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  restoreWarehouse,
  setDefaultWarehouse,
};
