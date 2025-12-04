// backend/controllers/supplier/supplierController.js
const Supplier = require("../../models/Supplier");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const mongoose = require("mongoose");
const logActivity = require("../../utils/logActivity");
const XLSX = require("xlsx");

// ============= CREATE - Tạo nhà cung cấp (kiểm tra quyền đã có ở tầng menu) =============
const createSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { name, phone, email, address, status, taxcode, notes } = req.body;
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id; // giữ để audit nếu bạn cần

    // Validate storeId
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // Kiểm tra dữ liệu đầu vào
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Tên nhà cung cấp là bắt buộc" });
    }

    // Kiểm tra status hợp lệ nếu có
    if (status && !["đang hoạt động", "ngừng hoạt động"].includes(status)) {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ. Chỉ chấp nhận 'đang hoạt động' hoặc 'ngừng hoạt động'",
      });
    }

    // Kiểm tra store tồn tại
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // --- Chuẩn hóa dữ liệu để kiểm tra trùng ---
    const trimmedName = name.trim();
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null; // chỉ giữ chữ số
    const trimmedEmail = email ? email.trim().toLowerCase() : null;

    // Kiểm tra email hợp lệ nếu có
    if (trimmedEmail && trimmedEmail !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }
    }

    // Build điều kiện tìm nhà cung cấp trùng trong cùng store (isDeleted: false)
    const orConditions = [{ name: trimmedName }]; // luôn check tên

    if (normalizedPhone) {
      orConditions.push({ phone: { $regex: `^${normalizedPhone}$` } });
    }
    if (trimmedEmail) {
      orConditions.push({ email: trimmedEmail });
    }

    const existingSupplier = await Supplier.findOne({
      store_id: storeId,
      isDeleted: false,
      $or: orConditions,
    }).collation({ locale: "vi", strength: 2 });

    if (existingSupplier) {
      const conflictFields = [];

      // check tên (case-insensitive)
      if (existingSupplier.name && existingSupplier.name.toLowerCase() === trimmedName.toLowerCase()) {
        conflictFields.push("tên");
      }

      // check phone
      if (normalizedPhone) {
        const existingPhoneNormalized = existingSupplier.phone ? existingSupplier.phone.replace(/\D/g, "") : "";
        if (existingPhoneNormalized === normalizedPhone) {
          conflictFields.push("số điện thoại");
        }
      }

      // check email
      if (trimmedEmail && existingSupplier.email && existingSupplier.email.toLowerCase() === trimmedEmail) {
        conflictFields.push("email");
      }

      const conflictMsg =
        conflictFields.length > 0
          ? `Nhà cung cấp đã tồn tại trong cửa hàng (trùng ${conflictFields.join(", ")})`
          : "Nhà cung cấp đã tồn tại trong cửa hàng";

      return res.status(400).json({ message: conflictMsg });
    }

    // Tạo nhà cung cấp mới
    const newSupplier = new Supplier({
      name: trimmedName,
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      address: address ? address.trim() : "",
      taxcode: taxcode ? taxcode.trim() : "",
      notes: notes ? notes.trim() : "",
      status: status || "đang hoạt động",
      store_id: storeId,
      created_by: userId, // nếu schema có trường này; nếu không thì bỏ
    });

    try {
      await newSupplier.save();
    } catch (saveErr) {
      // Nếu có duplicate key race condition (E11000), trả lỗi thân thiện
      if (saveErr.code === 11000) {
        return res.status(400).json({ message: "Nhà cung cấp đã tồn tại (duplicate key)" });
      }
      throw saveErr;
    }
    //log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "create",
      entity: "Supplier",
      entityId: newSupplier._id,
      entityName: newSupplier.name,
      req,
      description: `Tạo nhà cung cấp "${newSupplier.name}" cho cửa hàng "${store.name}"`,
    });

    // Populate store info
    await newSupplier.populate("store_id", "name address");

    return res.status(201).json({
      message: "Tạo nhà cung cấp thành công",
      supplier: {
        _id: newSupplier._id,
        name: newSupplier.name,
        phone: newSupplier.phone,
        email: newSupplier.email,
        address: newSupplier.address,
        taxcode: newSupplier.taxcode,
        notes: newSupplier.notes,
        status: newSupplier.status,
        store: newSupplier.store_id,
        createdAt: newSupplier.createdAt,
        updatedAt: newSupplier.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi createSupplier:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getSuppliersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Validate storeId ngay lập tức
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // Kiểm tra store tồn tại (tránh query thừa)
    const store = await Store.findById(storeId).select("_id name").lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Query suppliers: chỉ lấy chưa xóa, sắp xếp theo tên
    const suppliers = await Supplier.find({
      store_id: new mongoose.Types.ObjectId(storeId),
      isDeleted: false,
    })
      .select("name phone email address taxcode notes status createdAt updatedAt store_id")
      .populate("store_id", "name") // có thể comment nếu lỗi populate
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      message: "Lấy danh sách nhà cung cấp thành công",
      total: suppliers.length,
      suppliers,
    });
  } catch (error) {
    // Nếu là CastError của mongoose, trả 400
    if (error.name === "CastError") {
      console.error("CastError getSuppliersByStore:", error.stack);
      return res.status(400).json({ message: "storeId không hợp lệ (cast error)" });
    }

    // Log đầy đủ để dev xem stacktrace
    console.error("Lỗi getSuppliersByStore:", error.stack || error);
    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách nhà cung cấp",
      error: error.message,
    });
  }
};
// ============= READ - Lấy chi tiết một nhà cung cấp =============
const getSupplierById = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user.id || req.user._id;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "name address phone owner_id");

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId);
    if (user.role === "MANAGER" && !supplier.store_id.owner_id.equals(user._id)) {
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
        taxcode: supplier.taxcode,
        notes: supplier.notes,
        status: supplier.status,
        store: supplier.store_id,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      },
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
        message: "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { supplierId } = req.params;
    const { name, phone, email, address, status, taxcode, notes } = req.body;
    const userId = req.user.id || req.user._id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được cập nhật nhà cung cấp" });
    }

    // Tìm nhà cung cấp và kiểm tra quyền (chỉ tìm nhà cung cấp chưa bị xóa)
    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    if (!supplier.store_id.owner_id.equals(user._id)) {
      return res.status(403).json({
        message: "Bạn chỉ có thể cập nhật nhà cung cấp trong cửa hàng của mình",
      });
    }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};
    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Tên nhà cung cấp không được để trống" });
      }

      // Kiểm tra trùng tên (trừ chính nó, chỉ kiểm tra nhà cung cấp chưa bị xóa)
      const existingSupplier = await Supplier.findOne({
        name: name.trim(),
        store_id: supplier.store_id._id,
        _id: { $ne: supplierId },
        isDeleted: false,
      });

      if (existingSupplier) {
        return res.status(400).json({ message: "Tên nhà cung cấp này đã tồn tại trong cửa hàng" });
      }

      updateData.name = name.trim();
    }

    if (phone !== undefined) updateData.phone = phone ? phone.trim() : "";
    if (address !== undefined) updateData.address = address ? address.trim() : "";
    if (taxcode !== undefined) updateData.taxcode = taxcode ? taxcode.trim() : "";
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : "";

    if (email !== undefined) {
      if (email && email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ message: "Email không hợp lệ" });
        }
        updateData.email = email.trim();
      } else {
        updateData.email = "";
      }
    }

    if (status !== undefined) {
      if (!["đang hoạt động", "ngừng hoạt động"].includes(status)) {
        return res.status(400).json({
          message: "Trạng thái không hợp lệ. Chỉ chấp nhận: 'đang hoạt động', 'ngừng hoạt động'",
        });
      }
      updateData.status = status;
    }

    // Cập nhật nhà cung cấp
    const updatedSupplier = await Supplier.findByIdAndUpdate(supplierId, updateData, { new: true }).populate("store_id", "name address");

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: updatedSupplier.store_id._id },
      action: "update",
      entity: "Supplier",
      entityId: updatedSupplier._id,
      entityName: updatedSupplier.name,
      req,
      description: `Cập nhật thông tin nhà cung cấp "${updatedSupplier.name}"`,
    });

    res.status(200).json({
      message: "Cập nhật nhà cung cấp thành công",
      supplier: {
        _id: updatedSupplier._id,
        name: updatedSupplier.name,
        phone: updatedSupplier.phone,
        email: updatedSupplier.email,
        address: updatedSupplier.address,
        taxcode: updatedSupplier.taxcode,
        notes: updatedSupplier.notes,
        status: updatedSupplier.status,
        store: updatedSupplier.store_id,
        createdAt: updatedSupplier.createdAt,
        updatedAt: updatedSupplier.updatedAt,
      },
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
    const userId = req.user.id || req.user._id;

    // Kiểm tra user là manager
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được xóa nhà cung cấp" });
    }

    // Tìm nhà cung cấp và kiểm tra quyền (chỉ tìm nhà cung cấp chưa bị xóa)
    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    if (!supplier.store_id.owner_id.equals(user._id)) {
      return res.status(403).json({
        message: "Bạn chỉ có thể xóa nhà cung cấp trong cửa hàng của mình",
      });
    }

    // Kiểm tra xem có sản phẩm nào đang sử dụng nhà cung cấp này không (chỉ kiểm tra sản phẩm chưa bị xóa)
    const Product = require("../../models/Product");
    const productsUsingSupplier = await Product.countDocuments({
      supplier_id: supplierId,
      isDeleted: false,
    });

    if (productsUsingSupplier > 0) {
      return res.status(400).json({
        message: `Không thể xóa nhà cung cấp này vì có ${productsUsingSupplier} sản phẩm đang sử dụng`,
      });
    }

    // Soft delete - đánh dấu nhà cung cấp đã bị xóa
    supplier.isDeleted = true;
    await supplier.save();
    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: supplier.store_id._id },
      action: "delete",
      entity: "Supplier",
      entityId: supplier._id,
      entityName: supplier.name,
      req,
      description: `Xóa nhà cung cấp "${supplier.name}"`,
    });

    res.status(200).json({
      message: "Xóa nhà cung cấp thành công",
      deletedSupplierId: supplierId,
    });
  } catch (error) {
    console.error(" Lỗi deleteSupplier:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// ==================== EXPORT EXCEL ====================
const exportSuppliersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // Lấy danh sách supplier theo store
    const suppliers = await Supplier.find({ store_id: storeId }).lean();

    if (!suppliers || suppliers.length === 0) {
      return res.status(404).json({ message: "Không có nhà cung cấp để xuất" });
    }

    // Chuẩn bị dữ liệu cho Excel
    const data = suppliers.map((s) => ({
      Tên: s.name,
      SĐT: s.phone || "",
      Email: s.email || "",
      Địa_chỉ: s.address || "",
      Mã_số_thuế: s.taxcode || "",
      Ghi_chú: s.notes || "",
      Trạng_thái: s.status,
      Ngày_tạo: s.createdAt ? s.createdAt.toISOString().split("T")[0] : "",
      Ngày_cập_nhật: s.updatedAt ? s.updatedAt.toISOString().split("T")[0] : "",
    }));

    // Tạo workbook & worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");

    // Viết file Excel vào buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Trả về file để download
    res.setHeader("Content-Disposition", `attachment; filename="suppliers.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return res.send(buf);
  } catch (error) {
    console.error("Lỗi exportSuppliersByStore:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersByStore,
  getSupplierById,
  exportSuppliersByStore,
};
