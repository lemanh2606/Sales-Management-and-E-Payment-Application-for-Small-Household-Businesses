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
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
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
        message:
          "Trạng thái không hợp lệ. Chỉ chấp nhận 'đang hoạt động' hoặc 'ngừng hoạt động'",
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
      if (
        existingSupplier.name &&
        existingSupplier.name.toLowerCase() === trimmedName.toLowerCase()
      ) {
        conflictFields.push("tên");
      }

      // check phone
      if (normalizedPhone) {
        const existingPhoneNormalized = existingSupplier.phone
          ? existingSupplier.phone.replace(/\D/g, "")
          : "";
        if (existingPhoneNormalized === normalizedPhone) {
          conflictFields.push("số điện thoại");
        }
      }

      // check email
      if (
        trimmedEmail &&
        existingSupplier.email &&
        existingSupplier.email.toLowerCase() === trimmedEmail
      ) {
        conflictFields.push("email");
      }

      const conflictMsg =
        conflictFields.length > 0
          ? `Nhà cung cấp đã tồn tại trong cửa hàng (trùng ${conflictFields.join(
              ", "
            )})`
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
        return res
          .status(400)
          .json({ message: "Nhà cung cấp đã tồn tại (duplicate key)" });
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
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// backend/controllers/supplier/supplierController.js
const getSuppliersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { deleted } = req.query;

    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const store = await Store.findById(storeId).select("_id name").lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Parse deleted param (string/boolean/number)
    const deletedTrue =
      deleted === true ||
      deleted === "true" ||
      deleted === 1 ||
      deleted === "1";
    const deletedFalse =
      deleted === false ||
      deleted === "false" ||
      deleted === 0 ||
      deleted === "0";

    const filter = {
      store_id: new mongoose.Types.ObjectId(storeId),
    };

    if (deletedTrue) filter.isDeleted = true;
    else if (deletedFalse) filter.isDeleted = false;
    // không truyền -> lấy tất cả

    const suppliers = await Supplier.find(filter)
      .select(
        "name phone email address status store_id isDeleted createdAt updatedAt"
      )
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      message: "Lấy danh sách nhà cung cấp thành công",
      total: suppliers.length,
      suppliers,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ message: "storeId không hợp lệ (cast error)" });
    }
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
    const userId = req.user?.id || req.user?._id;

    if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ message: "supplierId không hợp lệ" });
    }

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Chưa đăng nhập hoặc thiếu userId" });
    }

    // QUAN TRỌNG:
    // - KHÔNG filter isDeleted:false nữa
    // - Bypass middleware pre(/^find/) (auto add isDeleted:false) bằng setOptions({ withDeleted: true })
    const supplier = await Supplier.findOne({ _id: supplierId })
      .setOptions({ withDeleted: true })
      .populate("store_id", "name address phone owner_id")
      .lean();

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Kiểm tra quyền truy cập
    const user = await User.findById(userId).lean();
    if (!user) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin người dùng" });
    }

    // store_id sau populate: object { _id, owner_id, ... }
    const storeId = supplier?.store_id?._id || supplier?.store_id;

    if (user.role === "MANAGER") {
      // MANAGER chỉ xem được supplier thuộc store mình sở hữu
      if (
        !supplier.store_id?.owner_id ||
        String(supplier.store_id.owner_id) !== String(user._id)
      ) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
      }
    }

    if (user.role === "STAFF") {
      const employee = await Employee.findOne({ user_id: userId }).lean();
      if (!employee) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin nhân viên" });
      }
      if (String(employee.store_id) !== String(storeId)) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền truy cập nhà cung cấp này" });
      }
    }

    // Nếu hệ thống bạn có role khác thì có thể xử lý thêm ở đây
    // else if (...) ...

    return res.status(200).json({
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
        isDeleted: !!supplier.isDeleted, // thêm để FE biết đang bị xóa/khóa
        store: supplier.store_id,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi getSupplierById:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= UPDATE - Cập nhật nhà cung cấp =============
const updateSupplier = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        message:
          "Dữ liệu request body trống. Vui lòng gửi dữ liệu JSON với Content-Type: application/json",
      });
    }

    const { supplierId } = req.params;
    const { name, phone, email, address, status, taxcode, notes } = req.body;
    // const userId = req.user.id || req.user._id; // nếu không dùng nữa thì bỏ luôn

    // Tìm nhà cung cấp (chỉ nhà cung cấp chưa bị xóa)
    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // ❌ BỎ TOÀN BỘ CHECK THEO user ĐI
    // const user = await User.findById(userId);
    // if (!user) { ... }
    // if (!supplier.store_id.owner_id.equals(user._id)) { ... }

    // Chuẩn bị dữ liệu cập nhật
    const updateData = {};

    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return res
          .status(400)
          .json({ message: "Tên nhà cung cấp không được để trống" });
      }

      const existingSupplier = await Supplier.findOne({
        name: name.trim(),
        store_id: supplier.store_id._id,
        _id: { $ne: supplierId },
        isDeleted: false,
      });

      if (existingSupplier) {
        return res.status(400).json({
          message: "Tên nhà cung cấp này đã tồn tại trong cửa hàng",
        });
      }

      updateData.name = name.trim();
    }

    if (phone !== undefined) updateData.phone = phone ? phone.trim() : "";
    if (address !== undefined)
      updateData.address = address ? address.trim() : "";
    if (taxcode !== undefined)
      updateData.taxcode = taxcode ? taxcode.trim() : "";
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
          message:
            "Trạng thái không hợp lệ. Chỉ chấp nhận: 'đang hoạt động', 'ngừng hoạt động'",
        });
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
      description: `Cập nhật thông tin nhà cung cấp "${updatedSupplier.name}"`,
    });

    return res.status(200).json({
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
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

// ============= DELETE - Xóa nhà cung cấp =============
const deleteSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    // const userId = req.user.id || req.user._id; // không dùng nữa thì bỏ

    // Tìm nhà cung cấp chưa bị xóa
    const supplier = await Supplier.findOne({
      _id: supplierId,
      isDeleted: false,
    }).populate("store_id", "owner_id");

    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // ❌ BỎ CHECK THEO user
    // const user = await User.findById(userId);
    // if (!user) ...
    // if (!supplier.store_id.owner_id.equals(user._id)) { ... }

    // Kiểm tra sản phẩm đang dùng nhà cung cấp này (chưa bị xóa)
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

    // Soft delete
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

    return res.status(200).json({
      message: "Xóa nhà cung cấp thành công",
      deletedSupplierId: supplierId,
    });
  } catch (error) {
    console.error("❌ Lỗi deleteSupplier:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="suppliers.xlsx"`
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
const restoreSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    // Validate ObjectId trước
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "supplierId không hợp lệ" });
    }

    if (!req.user || !req.user.role) {
      return res
        .status(401)
        .json({ message: "Chưa đăng nhập hoặc thiếu thông tin người dùng" });
    }

    // QUAN TRỌNG:
    // Supplier schema có pre(/^find/) auto add { isDeleted: false }
    // => muốn tìm record đã xóa phải bypass bằng query option (setOptions)
    // findById() tương đương findOne({ _id: id }) nên cũng dính middleware. [web:115][web:182]
    const supplier = await Supplier.findById(id).setOptions({
      withDeleted: true,
    });
    if (!supplier) {
      return res.status(404).json({ message: "Nhà cung cấp không tồn tại" });
    }

    // Chỉ cho restore khi đang bị soft-delete
    if (!supplier.isDeleted) {
      return res
        .status(400)
        .json({ message: "Nhà cung cấp chưa bị xóa, không thể khôi phục" });
    }

    // Verify store tồn tại
    const store = await Store.findById(supplier.store_id).lean();
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Check permission theo role (giữ giống logic restoreCustomer)
    if (req.user.role === "MANAGER") {
      if (String(store.owner_id) !== String(userId)) {
        return res.status(403).json({
          message: "Bạn không có quyền khôi phục nhà cung cấp ở cửa hàng này",
        });
      }
    } else if (req.user.role === "STAFF") {
      const userData = await User.findById(userId).lean();
      const roleMapping =
        (userData?.store_roles || []).find(
          (r) => String(r.store) === String(store._id)
        ) || null;

      if (!roleMapping) {
        return res.status(403).json({
          message: "Bạn không có quyền khôi phục nhà cung cấp ở cửa hàng này",
        });
      }
    } else {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện thao tác này" });
    }

    // Restore
    supplier.isDeleted = false;
    await supplier.save();

    // Log activity (nếu bạn có util này)
    try {
      await logActivity({
        user: req.user,
        store: { _id: supplier.store_id },
        action: "restore",
        entity: "Supplier",
        entityId: supplier._id,
        entityName: supplier.name,
        req,
        description: `Khôi phục nhà cung cấp ${supplier.name}${
          supplier.phone ? ` (${supplier.phone})` : ""
        }`,
      });
    } catch (logErr) {
      // Không fail request nếu log lỗi
      console.error("logActivity error:", logErr?.message || logErr);
    }

    return res.status(200).json({
      message: "Khôi phục nhà cung cấp thành công",
      supplier,
    });
  } catch (err) {
    console.error("Lỗi khôi phục nhà cung cấp:", err.stack || err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi khôi phục nhà cung cấp" });
  }
};

module.exports = {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSuppliersByStore,
  getSupplierById,
  exportSuppliersByStore,
  restoreSupplier,
};
