const Supplier = require("../../models/Supplier");
const Store = require("../../models/Store");
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const mongoose = require("mongoose");
const logActivity = require("../../utils/logActivity");
const XLSX = require("xlsx");

// ============= CREATE - Tạo nhà cung cấp =============
const createSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const {
      name,
      phone,
      email,
      address,
      taxcode,
      contact_person,
      bank_name,
      bank_account_no,
      bank_account_name,
      notes,
      status,
    } = req.body;
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    // Validate storeId
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    // Kiểm tra dữ liệu bắt buộc
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Tên nhà cung cấp là bắt buộc" });
    }

    // Kiểm tra status hợp lệ
    if (status && !["đang hoạt động", "ngừng hoạt động"].includes(status)) {
      return res.status(400).json({
        message:
          "Trạng thái không hợp lệ. Chỉ chấp nhận 'đang hoạt động' hoặc 'ngừng hoạt động'",
      });
    }

    // Kiểm tra store tồn tại
    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Chuẩn hóa dữ liệu kiểm tra trùng
    const trimmedName = name.trim();
    const normalizedPhone = phone ? phone.replace(/\D/g, "") : null;
    const trimmedEmail = email ? email.trim().toLowerCase() : null;
    const trimmedTaxcode = taxcode ? taxcode.trim().toUpperCase() : null;

    // Kiểm tra email hợp lệ
    if (trimmedEmail && trimmedEmail !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ message: "Email không hợp lệ" });
      }
    }

    // Kiểm tra MST trùng (nếu có)
    if (trimmedTaxcode) {
      const existingTaxcode = await Supplier.findOne({
        taxcode: trimmedTaxcode,
        store_id: storeId,
        isDeleted: false,
      });
      if (existingTaxcode) {
        return res.status(400).json({
          message: `Mã số thuế ${trimmedTaxcode} đã được sử dụng bởi nhà cung cấp "${existingTaxcode.name}"`,
        });
      }
    }

    // Build điều kiện tìm trùng
    const orConditions = [{ name: trimmedName }];
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
      if (existingSupplier.name.toLowerCase() === trimmedName.toLowerCase()) {
        conflictFields.push("tên");
      }
      if (
        normalizedPhone &&
        existingSupplier.phone?.replace(/\D/g, "") === normalizedPhone
      ) {
        conflictFields.push("số điện thoại");
      }
      if (
        trimmedEmail &&
        existingSupplier.email?.toLowerCase() === trimmedEmail
      ) {
        conflictFields.push("email");
      }

      return res.status(400).json({
        message: `Nhà cung cấp đã tồn tại trong cửa hàng (trùng ${conflictFields.join(
          ", "
        )})`,
      });
    }

    // Tạo supplier mới
    const newSupplier = new Supplier({
      name: trimmedName,
      phone: phone ? phone.trim() : "",
      email: trimmedEmail || "",
      address: address ? address.trim() : "",
      taxcode: trimmedTaxcode || "",
      contact_person: contact_person ? contact_person.trim() : "",
      bank_name: bank_name ? bank_name.trim() : "",
      bank_account_no: bank_account_no ? bank_account_no.trim() : "",
      bank_account_name: bank_account_name ? bank_account_name.trim() : "",
      notes: notes ? notes.trim() : "",
      status: status || "đang hoạt động",
      store_id: storeId,
    });

    await newSupplier.save();

    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "create",
      entity: "Supplier",
      entityId: newSupplier._id,
      entityName: newSupplier.name,
      req,
      description: `Tạo nhà cung cấp "${newSupplier.name}"${
        trimmedTaxcode ? ` (MST: ${trimmedTaxcode})` : ""
      }`,
    });

    await newSupplier.populate("store_id", "name address");

    return res.status(201).json({
      message: "Tạo nhà cung cấp thành công",
      supplier: newSupplier,
    });
  } catch (error) {
    console.error("Lỗi createSupplier:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "Nhà cung cấp đã tồn tại (duplicate key)" });
    }
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= GET LIST - Lấy danh sách NCC theo store =============
const getSuppliersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, deleted, page = 1, limit = 50, q } = req.query;

    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const store = await Store.findById(storeId).select("_id name").lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    const filter = { store_id: new mongoose.Types.ObjectId(storeId) };

    // Filter theo trạng thái
    if (status === "đang hoạt động" || status === "ngừng hoạt động") {
      filter.status = status;
    }

    // Filter deleted
    const deletedTrue = deleted === "true" || deleted === "1";
    const deletedFalse = deleted === "false" || deleted === "0";
    if (deletedTrue) filter.isDeleted = true;
    else if (deletedFalse) filter.isDeleted = false;

    // Search
    if (q && q.trim()) {
      const searchTerm = q.trim();
      filter.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { taxcode: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: searchTerm, $options: "i" } },
        { email: { $regex: searchTerm, $options: "i" } },
        { contact_person: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter)
        .select(
          "name phone email address taxcode contact_person bank_name bank_account_no bank_account_name notes status isDeleted createdAt updatedAt"
        )
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Supplier.countDocuments(filter),
    ]);

    return res.status(200).json({
      message: "Lấy danh sách nhà cung cấp thành công",
      suppliers,
      meta: { page: pageNum, limit: limitNum, total },
    });
  } catch (error) {
    console.error("Lỗi getSuppliersByStore:", error);
    return res.status(500).json({
      message: "Lỗi server khi lấy danh sách nhà cung cấp",
      error: error.message,
    });
  }
};

// ============= GET ONE =============
const getSupplierById = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ message: "supplierId không hợp lệ" });
    }

    const supplier = await Supplier.findOne({ _id: supplierId })
      .setOptions({ withDeleted: true })
      .populate("store_id", "name address phone owner_id")
      .lean();

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Kiểm tra quyền truy cập store
    const storeId = supplier.store_id?._id || supplier.store_id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin người dùng" });
    }

    if (user.role === "MANAGER") {
      if (String(supplier.store_id?.owner_id) !== String(user._id)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
      }
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId }).lean();
      if (!employee || String(employee.store_id) !== String(storeId)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
      }
    }

    return res.status(200).json({
      message: "Lấy thông tin nhà cung cấp thành công",
      supplier,
    });
  } catch (error) {
    console.error("Lỗi getSupplierById:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE =============
const updateSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "Dữ liệu request body trống" });
    }

    const { supplierId } = req.params;
    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");

    if (!supplier) {
      return res
        .status(404)
        .json({ message: "Nhà cung cấp không tồn tại hoặc đã bị xóa" });
    }

    const {
      name,
      phone,
      email,
      address,
      taxcode,
      contact_person,
      bank_name,
      bank_account_no,
      bank_account_name,
      notes,
      status,
    } = req.body;

    const updateData = {};

    // Name
    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return res
          .status(400)
          .json({ message: "Tên nhà cung cấp không được để trống" });
      }
      const existing = await Supplier.findOne({
        name: { $regex: `^${name.trim()}$`, $options: "i" },
        store_id: supplier.store_id._id,
        _id: { $ne: supplierId },
        isDeleted: false,
      });
      if (existing) {
        return res.status(400).json({ message: "Tên nhà cung cấp đã tồn tại" });
      }
      updateData.name = name.trim();
    }

    // Các field khác
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : "";
    if (email !== undefined) {
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ message: "Email không hợp lệ" });
        }
        updateData.email = email.trim().toLowerCase();
      } else {
        updateData.email = "";
      }
    }
    if (address !== undefined)
      updateData.address = address ? address.trim() : "";
    if (taxcode !== undefined) {
      const trimmedTaxcode = taxcode ? taxcode.trim().toUpperCase() : "";
      if (trimmedTaxcode) {
        const existingTaxcode = await Supplier.findOne({
          taxcode: trimmedTaxcode,
          store_id: supplier.store_id._id,
          _id: { $ne: supplierId },
          isDeleted: false,
        });
        if (existingTaxcode) {
          return res.status(400).json({
            message: `Mã số thuế ${trimmedTaxcode} đã được sử dụng`,
          });
        }
      }
      updateData.taxcode = trimmedTaxcode;
    }
    if (contact_person !== undefined)
      updateData.contact_person = contact_person ? contact_person.trim() : "";
    if (bank_name !== undefined)
      updateData.bank_name = bank_name ? bank_name.trim() : "";
    if (bank_account_no !== undefined)
      updateData.bank_account_no = bank_account_no
        ? bank_account_no.trim()
        : "";
    if (bank_account_name !== undefined)
      updateData.bank_account_name = bank_account_name
        ? bank_account_name.trim()
        : "";
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : "";
    if (status !== undefined) {
      if (!["đang hoạt động", "ngừng hoạt động"].includes(status)) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ" });
      }
      updateData.status = status;
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      supplierId,
      updateData,
      { new: true }
    ).populate("store_id", "name address");

    await logActivity({
      user: req.user,
      store: { _id: updatedSupplier.store_id._id },
      action: "update",
      entity: "Supplier",
      entityId: updatedSupplier._id,
      entityName: updatedSupplier.name,
      req,
      description: `Cập nhật NCC "${updatedSupplier.name}"`,
    });

    return res.status(200).json({
      message: "Cập nhật nhà cung cấp thành công",
      supplier: updatedSupplier,
    });
  } catch (error) {
    console.error("Lỗi updateSupplier:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE (soft delete) =============
const deleteSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;

    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Kiểm tra đang dùng trong sản phẩm
    const Product = require("../../models/Product");
    const productsUsingSupplier = await Product.countDocuments({
      supplier_id: supplierId,
      isDeleted: false,
    });

    if (productsUsingSupplier > 0) {
      return res.status(400).json({
        message: `Không thể xóa vì có ${productsUsingSupplier} sản phẩm đang sử dụng NCC này`,
      });
    }

    // Kiểm tra đang dùng trong phiếu kho
    const InventoryVoucher = require("../../models/InventoryVoucher");
    const vouchersUsingSupplier = await InventoryVoucher.countDocuments({
      supplier_id: supplierId,
      status: { $in: ["DRAFT", "APPROVED", "POSTED"] },
    });

    if (vouchersUsingSupplier > 0) {
      return res.status(400).json({
        message: `Không thể xóa vì có ${vouchersUsingSupplier} phiếu kho đang sử dụng NCC này`,
      });
    }

    // Soft delete
    supplier.isDeleted = true;
    await supplier.save();

    await logActivity({
      user: req.user,
      store: { _id: supplier.store_id._id },
      action: "delete",
      entity: "Supplier",
      entityId: supplier._id,
      entityName: supplier.name,
      req,
      description: `Xóa NCC "${supplier.name}"`,
    });

    return res.status(200).json({
      message: "Xóa nhà cung cấp thành công",
      deletedSupplierId: supplierId,
    });
  } catch (error) {
    console.error("Lỗi deleteSupplier:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= EXPORT EXCEL =============
const exportSuppliersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const suppliers = await Supplier.find({
      store_id: storeId,
      isDeleted: false,
    }).lean();

    if (!suppliers || suppliers.length === 0) {
      return res.status(404).json({ message: "Không có nhà cung cấp để xuất" });
    }

    const data = suppliers.map((s) => ({
      "Tên NCC": s.name,
      "Người liên hệ": s.contact_person || "",
      SĐT: s.phone || "",
      Email: s.email || "",
      "Địa chỉ": s.address || "",
      "Mã số thuế": s.taxcode || "",
      "Ngân hàng": s.bank_name || "",
      "Số TK": s.bank_account_no || "",
      "Chủ TK": s.bank_account_name || "",
      "Ghi chú": s.notes || "",
      "Trạng thái": s.status,
      "Ngày tạo": s.createdAt
        ? new Date(s.createdAt).toLocaleDateString("vi-VN")
        : "",
      "Ngày cập nhật": s.updatedAt
        ? new Date(s.updatedAt).toLocaleDateString("vi-VN")
        : "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "NhaCungCap");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nha-cung-cap-${storeId}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buf);
  } catch (error) {
    console.error("Lỗi exportSuppliersByStore:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= RESTORE =============
const restoreSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user?.id || req.user?._id;

    if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ message: "supplierId không hợp lệ" });
    }

    const supplier = await Supplier.findById(supplierId).setOptions({
      withDeleted: true,
    });
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    if (!supplier.isDeleted) {
      return res.status(400).json({ message: "Nhà cung cấp chưa bị xóa" });
    }

    const store = await Store.findById(supplier.store_id).lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Check permission
    if (req.user.role === "MANAGER") {
      if (String(store.owner_id) !== String(userId)) {
        return res.status(403).json({ message: "Không có quyền khôi phục" });
      }
    }

    supplier.isDeleted = false;
    await supplier.save();

    await logActivity({
      user: req.user,
      store: { _id: supplier.store_id },
      action: "restore",
      entity: "Supplier",
      entityId: supplier._id,
      entityName: supplier.name,
      req,
      description: `Khôi phục NCC "${supplier.name}"`,
    });

    return res.status(200).json({
      message: "Khôi phục nhà cung cấp thành công",
      supplier,
    });
  } catch (error) {
    console.error("Lỗi restoreSupplier:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createSupplier,
  getSuppliersByStore,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  exportSuppliersByStore,
  restoreSupplier,
};
