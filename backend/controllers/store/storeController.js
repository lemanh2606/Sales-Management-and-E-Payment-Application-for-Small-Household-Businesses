// controllers/storeController.js
const mongoose = require("mongoose");
const Employee = require("../../models/Employee");
const Store = require("../../models/Store");
const User = require("../../models/User");
const logActivity = require("../../utils/logActivity");
const bcrypt = require("bcryptjs");
const { STAFF_DEFAULT_MENU } = require("../../config/constants/permissions");
const XLSX = require("xlsx");
const dayjs = require("dayjs");
const axios = require("axios");

// Helper function để validate (có thể đặt ở đầu file hoặc utils riêng)
const validateEmployeeData = (data, isCreate = false) => {
  const errors = [];

  // Email: phải hợp lệ (nếu có nhập)
  if (data.email && data.email.trim() !== "") {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(data.email.trim())) {
      errors.push({
        field: "email",
        message:
          "Email không hợp lệ. Vui lòng nhập đúng định dạng (ví dụ: yourname@example.com)",
      });
    }
  }

  // Số điện thoại: phải là số, chỉ cho phép số và dấu + ở đầu (nếu có)
  if (data.phone && data.phone.trim() !== "") {
    const phoneRegex = /^\+?[0-9]{9,15}$/; // Cho phép + ở đầu, 9-15 chữ số
    if (!phoneRegex.test(data.phone.replace(/\s/g, ""))) {
      errors.push({
        field: "phone",
        message:
          "Số điện thoại chỉ được chứa chữ số (có thể có dấu + ở đầu), độ dài 9-15 số",
      });
    }
  }

  // Mật khẩu: chỉ áp dụng khi create (vì edit không có password field)
  if (isCreate) {
    if (!data.password || data.password.trim().length < 6) {
      errors.push({
        field: "password",
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }
  }

  // ✅ Lương cơ bản: nếu có nhập thì phải không âm, không nhập thì OK (default 0)
  if (data.salary !== undefined && data.salary !== null && data.salary !== "") {
    const salary = parseFloat(data.salary);
    if (isNaN(salary) || salary < 0) {
      errors.push({
        field: "salary",
        message: "Lương cơ bản phải là số không âm",
      });
    }
  }

  // ✅ Hoa hồng (%): nếu có nhập thì phải không âm, không nhập thì OK (default 0)
  if (
    data.commission_rate !== undefined &&
    data.commission_rate !== null &&
    data.commission_rate !== ""
  ) {
    const commission = parseFloat(data.commission_rate);
    if (isNaN(commission) || commission < 0) {
      errors.push({
        field: "commission_rate",
        message: "Tỷ lệ hoa hồng phải là số không âm",
      });
    }
  }

  return errors;
};

const buildValidationErrorResponse = (errors) => {
  return {
    message: errors.map((e) => e.message).join("; "),
    errors,
  };
};

// Helper function để validate Store data
const validateStoreData = (data, { isCreate } = { isCreate: false }) => {
  const errors = [];

  const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
  const isStringOrEmpty = (v) =>
    v === undefined || v === null || typeof v === "string";
  const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

  // name
  if (isCreate) {
    if (!isNonEmptyString(data.name)) {
      errors.push({ field: "name", message: "Tên cửa hàng bắt buộc" });
    }
  } else if (data.name !== undefined && !isNonEmptyString(data.name)) {
    errors.push({ field: "name", message: "Tên cửa hàng không được để trống" });
  }

  // address/description/imageUrl (optional strings)
  if (!isStringOrEmpty(data.address)) {
    errors.push({ field: "address", message: "Địa chỉ phải là chuỗi" });
  }
  if (!isStringOrEmpty(data.description)) {
    errors.push({ field: "description", message: "Mô tả phải là chuỗi" });
  }
  if (!isStringOrEmpty(data.imageUrl)) {
    errors.push({ field: "imageUrl", message: "imageUrl phải là chuỗi" });
  }

  // phone (optional) – allow leading +, 9–15 digits
  if (
    data.phone !== undefined &&
    data.phone !== null &&
    String(data.phone).trim() !== ""
  ) {
    const phone = String(data.phone).replace(/\s/g, "");
    const phoneRegex = /^\+?[0-9]{9,15}$/;
    if (!phoneRegex.test(phone)) {
      errors.push({
        field: "phone",
        message:
          "Số điện thoại chỉ được chứa chữ số (có thể có dấu + ở đầu), độ dài 9-15 số",
      });
    }
  }

  // tags (optional array<string>)
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push({ field: "tags", message: "tags phải là mảng" });
    } else {
      const cleaned = data.tags
        .map((t) => String(t).trim())
        .filter((t) => t.length > 0);
      const tooLong = cleaned.find((t) => t.length > 50);
      if (tooLong) {
        errors.push({ field: "tags", message: "Mỗi tag tối đa 50 ký tự" });
      }
      if (cleaned.length > 30) {
        errors.push({ field: "tags", message: "Tối đa 30 tags" });
      }
    }
  }

  // staff_ids (optional array<ObjectId>)
  if (data.staff_ids !== undefined) {
    if (!Array.isArray(data.staff_ids)) {
      errors.push({ field: "staff_ids", message: "staff_ids phải là mảng" });
    } else {
      const invalid = data.staff_ids.find((id) => !isValidObjectId(id));
      if (invalid) {
        errors.push({
          field: "staff_ids",
          message: "staff_ids chứa ObjectId không hợp lệ",
        });
      }
    }
  }

  // location (optional {lat,lng} with number|null)
  if (data.location !== undefined) {
    const loc = data.location;
    if (loc === null || typeof loc !== "object" || Array.isArray(loc)) {
      errors.push({ field: "location", message: "location phải là object" });
    } else {
      if (
        loc.lat !== undefined &&
        loc.lat !== null &&
        typeof loc.lat !== "number"
      ) {
        errors.push({
          field: "location.lat",
          message: "lat phải là số hoặc null",
        });
      }
      if (
        loc.lng !== undefined &&
        loc.lng !== null &&
        typeof loc.lng !== "number"
      ) {
        errors.push({
          field: "location.lng",
          message: "lng phải là số hoặc null",
        });
      }
      if (typeof loc.lat === "number" && (loc.lat < -90 || loc.lat > 90)) {
        errors.push({
          field: "location.lat",
          message: "lat phải nằm trong [-90, 90]",
        });
      }
      if (typeof loc.lng === "number" && (loc.lng < -180 || loc.lng > 180)) {
        errors.push({
          field: "location.lng",
          message: "lng phải nằm trong [-180, 180]",
        });
      }
    }
  }

  // openingHours (optional {open,close} as HH:mm or empty)
  if (data.openingHours !== undefined) {
    const oh = data.openingHours;
    if (oh === null || typeof oh !== "object" || Array.isArray(oh)) {
      errors.push({
        field: "openingHours",
        message: "openingHours phải là object",
      });
    } else {
      const hhmm = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if (
        oh.open !== undefined &&
        oh.open !== null &&
        String(oh.open).trim() !== "" &&
        !hhmm.test(String(oh.open))
      ) {
        errors.push({
          field: "openingHours.open",
          message: "Giờ mở cửa phải theo định dạng HH:mm",
        });
      }
      if (
        oh.close !== undefined &&
        oh.close !== null &&
        String(oh.close).trim() !== "" &&
        !hhmm.test(String(oh.close))
      ) {
        errors.push({
          field: "openingHours.close",
          message: "Giờ đóng cửa phải theo định dạng HH:mm",
        });
      }
    }
  }

  // isDefault (optional boolean)
  if (data.isDefault !== undefined && typeof data.isDefault !== "boolean") {
    errors.push({ field: "isDefault", message: "isDefault phải là boolean" });
  }

  return errors;
};

/**
 * Tạo store mới (MANAGER)
 * Body: { name, address, phone }
 */
/**
 * Tạo store (Manager)
 * Body có thể chứa: { name, address, phone, description, imageUrl, tags, staff_ids, location, openingHours, isDefault }
 */
const createStore = async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      description,
      imageUrl,
      tags,
      staff_ids,
      location,
      openingHours,
      isDefault,
    } = req.body;
    const userId = req.user.id || req.user._id;

    // ========== 👇 KIỂM TRA ROLE - CHẶN STAFF 👇 ==========
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Chặn STAFF không cho tạo cửa hàng
    if (user.role === "STAFF") {
      return res.status(403).json({
        message: "Nhân viên (STAFF) không có quyền tạo cửa hàng",
        detail: "Chỉ tài khoản Manager mới được phép tạo cửa hàng mới",
      });
    }

    // Chỉ MANAGER mới được tạo cửa hàng
    if (user.role !== "MANAGER") {
      return res.status(403).json({
        message: "Chỉ Manager mới được tạo cửa hàng",
      });
    }
    // ========== 👆 END ROLE CHECK 👆 ==========

    const validationErrors = validateStoreData(
      {
        name,
        address,
        phone,
        description,
        imageUrl,
        tags,
        staff_ids,
        location,
        openingHours,
        isDefault,
      },
      { isCreate: true }
    );
    if (validationErrors.length) {
      return res
        .status(400)
        .json(buildValidationErrorResponse(validationErrors));
    }

    const escapeRegex = (input) =>
      String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const normalizedName = String(name).trim();
    const normalizedAddress = String(address || "")
      .trim()
      .replace(/\s+/g, " ");

    // Check name uniqueness per owner (ignore deleted stores)
    const existingSameName = await Store.findOne({
      owner_id: userId,
      deleted: false,
      name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, "i") },
    })
      .select("_id")
      .lean();

    if (existingSameName) {
      return res.status(400).json(
        buildValidationErrorResponse([
          {
            field: "name",
            message: "Tên cửa hàng đã tồn tại trong các cửa hàng của bạn",
          },
        ])
      );
    }

    const normalizedTags = Array.isArray(tags)
      ? Array.from(
          new Set(tags.map((t) => String(t).trim()).filter((t) => t.length > 0))
        )
      : [];

    const normalizedStaffIds = Array.isArray(staff_ids)
      ? Array.from(new Set(staff_ids.map((id) => String(id))))
      : [];

    const newStore = new Store({
      name: normalizedName,
      address: normalizedAddress,
      phone: (phone || "").trim(),
      description: (description || "").trim(),
      imageUrl: imageUrl || "",
      tags: normalizedTags,
      staff_ids: normalizedStaffIds,
      location: location || { lat: null, lng: null },
      openingHours: openingHours || { open: "", close: "" },
      isDefault: isDefault === true,
      owner_id: userId,
      deleted: false,
    });

    await newStore.save();

    // Cập nhật user: thêm store vào danh sách, gán current_store và role OWNER
    user.stores = user.stores || [];
    if (!user.stores.find((s) => s.toString() === newStore._id.toString())) {
      user.stores.push(newStore._id);
    }

    // Option: set current_store tự động sau tạo store mới
    user.current_store = newStore._id;

    user.store_roles = user.store_roles || [];
    if (
      !user.store_roles.find(
        (r) => r.store.toString() === newStore._id.toString()
      )
    ) {
      user.store_roles.push({ store: newStore._id, role: "OWNER" });
    }

    await user.save();

    // Populate before trả về để front-end có thể dùng ngay
    const populatedStore = await Store.findById(newStore._id)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: newStore._id },
      action: "create",
      entity: "Store",
      entityId: newStore._id,
      entityName: newStore.name,
      req,
      description: `Tạo cửa hàng "${newStore.name}"`,
    });

    return res
      .status(201)
      .json({ message: "Tạo cửa hàng thành công", store: populatedStore });
  } catch (err) {
    console.error("createStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Lấy thông tin store theo id
 */
/**
 * Lấy thông tin store theo id
 * Owner có thể xem cả deleted stores
 */
const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const store = await Store.findById(storeId)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    if (!store)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });

    // Nếu store bị deleted, chỉ owner mới được xem
    if (store.deleted && (!userId || !store.owner_id.equals(userId))) {
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    }

    return res.json({ store });
  } catch (err) {
    console.error("getStoreById error:", err);
    return res.status(500).json({ message: "Lỗi server khi lấy store" });
  }
};

/**
 * Cập nhật thông tin store (MANAGER / owner)
 * Body: { name, address, phone, description, imageUrl, tags, staff_ids, location, openingHours, isDefault }
 */
const updateStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      name,
      address,
      phone,
      description,
      imageUrl,
      tags,
      staff_ids,
      location,
      openingHours,
      isDefault,
    } = req.body;
    const userId = req.user.id || req.user._id;

    const validationErrors = validateStoreData(
      {
        name,
        address,
        phone,
        description,
        imageUrl,
        tags,
        staff_ids,
        location,
        openingHours,
        isDefault,
      },
      { isCreate: false }
    );
    if (validationErrors.length) {
      return res
        .status(400)
        .json(buildValidationErrorResponse(validationErrors));
    }

    const store = await Store.findById(storeId);
    if (!store || store.deleted)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    if (!store.owner_id.equals(userId))
      return res.status(403).json({ message: "Chỉ owner mới được chỉnh sửa" });

    const escapeRegex = (input) =>
      String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // If changing name, ensure uniqueness per owner (ignore deleted stores)
    if (name !== undefined) {
      const normalizedName = String(name).trim();

      if (normalizedName.length === 0) {
        return res
          .status(400)
          .json(
            buildValidationErrorResponse([
              { field: "name", message: "Tên cửa hàng không được để trống" },
            ])
          );
      }

      const existingSameName = await Store.findOne({
        owner_id: userId,
        deleted: false,
        _id: { $ne: store._id },
        name: { $regex: new RegExp(`^${escapeRegex(normalizedName)}$`, "i") },
      })
        .select("_id")
        .lean();

      if (existingSameName) {
        return res.status(400).json(
          buildValidationErrorResponse([
            {
              field: "name",
              message: "Tên cửa hàng đã tồn tại trong các cửa hàng của bạn",
            },
          ])
        );
      }
    }

    // NOTE: Do not check duplicate addresses here. Name uniqueness per owner is enforced above.

    if (name !== undefined) store.name = String(name).trim();
    if (address !== undefined) {
      store.address = String(address || "")
        .trim()
        .replace(/\s+/g, " ");
    }
    if (phone !== undefined) store.phone = String(phone).trim();
    if (description !== undefined)
      store.description = String(description).trim();
    if (imageUrl !== undefined) store.imageUrl = imageUrl;
    if (tags !== undefined) {
      store.tags = Array.isArray(tags)
        ? Array.from(
            new Set(
              tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
            )
          )
        : [];
    }
    if (staff_ids !== undefined) {
      store.staff_ids = Array.isArray(staff_ids)
        ? Array.from(new Set(staff_ids.map((id) => String(id))))
        : [];
    }
    if (location !== undefined) store.location = location;
    if (openingHours !== undefined) store.openingHours = openingHours;
    if (isDefault !== undefined) store.isDefault = isDefault === true;

    await store.save();

    const populatedStore = await Store.findById(store._id)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    //log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "update",
      entity: "Store",
      entityId: store._id,
      entityName: store.name,
      req,
      description: `Cập nhật cửa hàng "${store.name}"`,
    });

    return res.json({ message: "Cập nhật thành công", store: populatedStore });
  } catch (err) {
    console.error("updateStore error:", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật store" });
  }
};

/**
 * Xóa store (soft delete) - chỉ ẩn (deleted = true)
 */
const deleteStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    const store = await Store.findById(storeId);
    if (!store || store.deleted)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    if (!store.owner_id.equals(userId))
      return res.status(403).json({ message: "Chỉ owner mới được xóa" });

    store.deleted = true;
    await store.save();

    // (Option) Xóa tham chiếu trong User.stores nếu bạn muốn -> comment nếu không cần
    try {
      await User.updateOne(
        { _id: userId },
        { $pull: { stores: store._id, store_roles: { store: store._id } } }
      );
    } catch (e) {
      // không bắt lỗi lớn, chỉ log để không block flow
      console.warn("Failed to pull store ref from user:", e);
    }

    const populatedStore = await Store.findById(store._id)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    //log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "delete",
      entity: "Store",
      entityId: store._id,
      entityName: store.name,
      req,
      description: `Xóa cửa hàng "${store.name}" (soft delete)`,
    });

    return res.json({
      message: "Đã xóa cửa hàng (soft delete)",
      store: populatedStore,
    });
  } catch (err) {
    console.error("deleteStore error:", err);
    return res.status(500).json({ message: "Lỗi server khi xóa store" });
  }
};

/**
 * Lấy danh sách store của Manager (owner)
 * optional query params: ?page=1&limit=20&q=search&deleted=true (để lấy deleted stores)
 */
const getStoresByManager = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // fallback
    const user = await User.findById(userId);

    if (!user || user.role !== "MANAGER") {
      return res
        .status(403)
        .json({ message: "Chỉ Manager mới xem được danh sách store" });
    }

    // Basic paging & search support
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "50", 10))
    );
    const q = (req.query.q || "").trim();
    const includeDeleted = req.query.deleted === "true"; // ?deleted=true để lấy deleted stores

    // Filter: mặc định lấy active stores, nếu ?deleted=true thì lấy deleted stores
    const filter = { owner_id: userId, deleted: includeDeleted };
    if (q) {
      // tìm theo name / address / tags
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }

    const total = await Store.countDocuments(filter);
    const stores = await Store.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    return res.json({
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      stores,
    });
  } catch (err) {
    console.error("getStoresByManager error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Chọn store hiện tại cho user (cả manager hoặc staff)
 * POST /api/stores/select/:storeId
 */
const selectStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id; //đừng nhầm .id và ._id nhé ko check toàn sai thôi

    if (!mongoose.Types.ObjectId.isValid(storeId))
      return res.status(400).json({ message: "storeId không hợp lệ" });

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    // Kiểm tra user có quyền trên store: owner hoặc mapping store_roles
    const user = await User.findById(userId);
    const isOwner =
      user.role === "MANAGER" && String(store.owner_id) === String(userId);
    const mapping = (user.store_roles || []).find(
      (r) => String(r.store) === String(store._id)
    );
    const isStaffAssigned = !!mapping;

    if (!isOwner && !isStaffAssigned) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền chọn cửa hàng này" });
    }

    user.current_store = store._id;
    await user.save();

    // ===== GHI LOG: NHÂN VIÊN VÀO CA LÀM TẠI CỬA HÀNG =====
    await logActivity({
      user, // user object
      store: { _id: store._id }, // store object
      action: "auth",
      entity: "Store",
      entityId: store._id,
      entityName: store.name || store.store_name || "Cửa hàng",
      description: `Đăng nhập vào cửa hàng: ${
        store.name || store.store_name || "Cửa hàng"
      }`,
      req,
    });
    // =================================================

    return res.json({ message: "Đã chọn cửa hàng", store });
  } catch (err) {
    console.error("selectStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Ensure store: nếu manager chưa có store -> tạo default; nếu có store và user.current_store null -> gán mặc định.
 * Trả về stores list + currentStore
 */
const ensureStore = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User không tìm thấy" });

    let stores = [];

    if (user.role === "MANAGER") {
      stores = await Store.find({ owner_id: userId, deleted: false }).sort({
        createdAt: -1,
      });

      if (!stores || stores.length === 0) {
        const defaultStore = new Store({
          name: `My Store - ${user.username}`,
          address: "",
          phone: user.phone || "",
          owner_id: user._id,
          isDefault: true,
        });
        await defaultStore.save();

        user.stores = user.stores || [];
        user.stores.push(defaultStore._id);
        user.current_store = defaultStore._id;
        user.store_roles = user.store_roles || [];
        user.store_roles.push({ store: defaultStore._id, role: "OWNER" });
        await user.save();

        return res.status(201).json({ created: true, store: defaultStore });
      }
    } else {
      const assignedStoreIds = (user.store_roles || [])
        .filter((entry) => entry?.store)
        .map((entry) => entry.store);

      if (!assignedStoreIds.length) {
        return res
          .status(403)
          .json({ message: "Bạn chưa được phân vào cửa hàng nào" });
      }

      stores = await Store.find({
        _id: { $in: assignedStoreIds },
        deleted: false,
      }).sort({ createdAt: -1 });

      if (!stores.length) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy cửa hàng được phân công" });
      }
    }

    let currentStore = null;
    if (user.current_store) {
      currentStore = stores.find(
        (store) => String(store._id) === String(user.current_store)
      );
    }

    if (!currentStore && stores.length > 0) {
      currentStore = stores[0];
      user.current_store = currentStore._id;
      await user.save();
    }

    return res.json({ created: false, stores, currentStore });
  } catch (err) {
    console.error("ensureStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * GET /api/stores/:storeId/dashboard (protected bằng checkStoreAccess)
 * Trả dữ liệu demo cho dashboard store (doanh số, orders, ...). Bạn thay bằng logic thật.
 */
const getStoreDashboard = async (req, res) => {
  try {
    // req.store được gắn bởi checkStoreAccess middleware
    const store = req.store;
    // demo data — replace bằng query thật tới order collection
    const data = {
      storeId: store._id,
      name: store.name,
      totalSales: 12345,
      ordersToday: 12,
      topProducts: [
        { name: "Product A", sold: 50 },
        { name: "Product B", sold: 30 },
      ],
    };
    return res.json({ data });
  } catch (err) {
    console.error("getStoreDashboard error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Gán staff cho 1 store (owner thực hiện)
 * POST /api/stores/:storeId/assign-staff  body: { staffUserId, role = "STAFF" }
 */
const assignStaffToStore = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // caller
    const { storeId } = req.params;
    const { staffUserId, role = "STAFF" } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(storeId) ||
      !mongoose.Types.ObjectId.isValid(staffUserId)
    ) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Store không tồn tại" });

    // chỉ owner mới gán staff
    if (String(store.owner_id) !== String(userId)) {
      return res
        .status(403)
        .json({ message: "Chỉ owner mới có quyền gán staff" });
    }

    const staffUser = await User.findById(staffUserId);
    if (!staffUser)
      return res.status(404).json({ message: "User không tồn tại" });

    // thêm mapping vào staffUser.store_roles (nếu chưa có)
    staffUser.store_roles = staffUser.store_roles || [];
    const existing = staffUser.store_roles.find(
      (r) => String(r.store) === String(store._id)
    );
    if (existing) {
      existing.role = role; // update role nếu cần
    } else {
      staffUser.store_roles.push({ store: store._id, role });
    }
    await staffUser.save();

    return res.json({
      message: "Gán staff thành công",
      staffId: staffUser._id,
    });
  } catch (err) {
    console.error("assignStaffToStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// POST /api/stores/:storeId/employees - Tạo nhân viên mới cho store (tạo User STAFF + Employee bind user_id + gán store_roles)
const createEmployee = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params để bind cố định
    const {
      fullName,
      username,
      password,
      email,
      phone,
      shift,
      salary,
      commission_rate,
    } = req.body;

    // Validate dữ liệu đầu vào
    const validationErrors = validateEmployeeData(
      {
        fullName,
        username,
        password,
        email,
        phone,
        shift,
        salary,
        commission_rate,
      },
      true // isCreate = true
    );

    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json(buildValidationErrorResponse(validationErrors));
    }

    // Validate input cơ bản (tạo user + employee)
    if (
      !username ||
      !fullName ||
      !password ||
      shift == null ||
      salary == null
    ) {
      return res.status(400).json({
        message: "Thiếu username, fullName, salary, password hoặc shift",
      });
    }

    if (password.length < 6) {
      // Pass tạm min 6 chars để an toàn
      console.log("Lỗi: Password phải ít nhất 6 ký tự");
      return res.status(400).json({ message: "Password phải ít nhất 6 ký tự" });
    }

    // Validate store tồn tại và quyền (đã check qua middleware checkStoreAccess)
    const store = req.store; // Dùng req.store từ middleware
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    if (req.storeRole !== "OWNER") {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền tạo nhân viên cho cửa hàng này" });
    }

    const emailNormalized = email?.trim().toLowerCase() || null;
    const usernameTrim = username?.trim();

    // 3. Check email tồn tại chưa
    let user = null;
    if (emailNormalized) {
      user = await User.findOne({ email: emailNormalized });
    }

    // ===============================
    // CASE A: EMAIL ĐÃ TỒN TẠI
    // ===============================
    if (user) {
      // Check nhân viên đã làm ở store này chưa
      const existedEmployee = await Employee.findOne({
        user_id: user._id,
        store_id: storeId,
        isDeleted: false,
      });

      if (existedEmployee) {
        return res.status(400).json({
          message: "Nhân viên này đã tồn tại trong cửa hàng",
        });
      }

      // Gán store_role nếu chưa có
      const hasRole = user.store_roles.some(
        (r) => String(r.store) === String(storeId)
      );
      if (!hasRole) {
        user.store_roles.push({ store: storeId, role: "STAFF" });
        await user.save();
      }

      // Tạo Employee mới cho store này
      const newEmployee = new Employee({
        fullName,
        phone: phone?.trim() || "",
        salary: salary.toString(),
        shift,
        commission_rate: commission_rate ? commission_rate.toString() : null,
        user_id: user._id,
        store_id: storeId,
      });
      await newEmployee.save();

      await logActivity({
        user: req.user,
        store: { _id: store._id },
        action: "create",
        entity: "Employee",
        entityId: newEmployee._id,
        entityName: fullName,
        req,
        description: `Thêm nhân viên "${fullName}" vào cửa hàng "${store.name}"`,
      });

      return res.status(201).json({
        message: "Đã thêm nhân viên vào cửa hàng",
        employee: newEmployee,
      });
    }

    // ===============================
    // CASE B: EMAIL CHƯA TỒN TẠI
    // ===============================

    if (!username || !password) {
      return res.status(400).json({
        message: "Thiếu username hoặc password cho nhân viên mới",
      });
    }

    const existedUsername = await User.findOne({ username: usernameTrim });
    if (existedUsername) {
      return res.status(400).json({ message: "Username đã được sử dụng" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: usernameTrim,
      password_hash,
      fullname: fullName,
      role: "STAFF",
      email: emailNormalized,
      phone: phone?.trim() || "",
      current_store: store._id,
      store_roles: [{ store: store._id, role: "STAFF" }],
      menu: STAFF_DEFAULT_MENU.slice(),
      isVerified: true,
    });
    await newUser.save();

    const newEmployee = new Employee({
      fullName,
      phone: phone?.trim() || "",
      salary: salary.toString(),
      shift,
      commission_rate: commission_rate ? commission_rate.toString() : null,
      user_id: newUser._id,
      store_id: storeId,
    });
    await newEmployee.save();

    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "create",
      entity: "Employee",
      entityId: newEmployee._id,
      entityName: fullName,
      req,
      description: `Tạo nhân viên mới "${fullName}" cho cửa hàng "${store.name}"`,
    });

    res.status(201).json({
      message: "Tạo nhân viên và tài khoản thành công",
      employee: newEmployee,
    });
  } catch (err) {
    console.error("Lỗi tạo nhân viên:", err);
    res.status(500).json({ message: "Lỗi server khi tạo nhân viên" });
  }
};

// GET /api/stores/:storeId/employees - Lấy danh sách nhân viên theo store (chỉ manager store xem)
// Chỉ sửa hàm getEmployeesByStore để hỗ trợ query ?deleted=1 (lấy deleted) hoặc default false (lấy active)
const getEmployeesByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { deleted } = req.query;

    console.log(`🔍 Lấy nhân viên cho store: ${storeId}, deleted: ${deleted}`);
    console.log(`👤 req.user role:`, req.user?.role);
    console.log(`🏪 req.storeRole:`, req.storeRole);

    // Filter với isDeleted dựa trên query (default false)
    const isDeleted = deleted === "true";

    // ✅ ĐƠN GIẢN HÓA: BỎ TẤT CẢ CHECK QUYỀN
    // Chỉ kiểm tra store tồn tại
    const store = await Store.findById(storeId).lean();
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng",
      });
    }

    console.log(
      `🔍 Query nhân viên: store_id=${storeId}, isDeleted=${isDeleted}`
    );

    const employees = (
      await Employee.find({ store_id: storeId, isDeleted })
        .populate("user_id", "username email phone role menu")
        .populate("store_id", "name")
        .lean()
    ).map((emp) => ({
      ...emp,
      salary: emp.salary ? Number(emp.salary.toString()) : 0,
      commission_rate: emp.commission_rate
        ? Number(emp.commission_rate.toString())
        : 0,
    }));

    console.log(
      `✅ Lấy ${employees.length} nhân viên ${
        isDeleted ? "đã xóa" : "đang làm"
      } cho cửa hàng ${store.name}`
    );

    res.json({
      success: true,
      message: "Lấy danh sách nhân viên thành công",
      employees: employees,
      meta: {
        storeName: store.name,
        total: employees.length,
        isDeleted,
        storeRole: req.storeRole,
        userRole: req.user?.role,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi lấy danh sách nhân viên:", err.message);
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy nhân viên",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// controllers/storeController.js (tweak nhỏ: add check employee.store_id == req.params.storeId ở get/update - paste vào functions tương ứng)
const getEmployeeById = async (req, res) => {
  try {
    const { id, storeId } = req.params; // 👈 Add storeId từ params

    const employee = await Employee.findById(id)
      .populate("user_id", "name username email phone role menu") // Populate user info
      .populate("store_id", "name") // Store name
      .lean();

    if (!employee) {
      console.log("Lỗi: Không tìm thấy nhân viên:", id);
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    // 👈 Tweak: Check employee thuộc storeId này (an toàn hơn middleware)
    if (String(employee.store_id) !== String(storeId)) {
      console.log("Lỗi: Nhân viên không thuộc cửa hàng này:", id);
      return res.status(403).json({
        message: `Nhân viên ${employee.fullName} không thuộc cửa hàng này`,
      });
    }

    // Validate quyền: Dùng req.storeRole (chỉ manager owner xem)
    if (req.storeRole !== "OWNER") {
      console.log("Lỗi: Bạn không có quyền xem nhân viên này:", id);
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xem nhân viên này" });
    }

    console.log(`Lấy chi tiết nhân viên thành công: ${employee.fullName}`);
    res.json({ message: "Lấy nhân viên thành công", employee });
  } catch (err) {
    console.error("Lỗi lấy nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy nhân viên" });
  }
};

// PUT /api/stores/:storeId/employees/:id - Update nhân viên (ko đổi store_id/user_id, validate quyền)

const updateEmployee = async (req, res) => {
  try {
    const { id, storeId } = req.params;
    const { fullName, email, phone, shift, salary, commission_rate } = req.body;

    // Validate (không có password khi update)
    const validationErrors = validateEmployeeData(
      { email, phone, shift, salary, commission_rate },
      false
    );

    if (validationErrors.length > 0) {
      return res
        .status(400)
        .json(buildValidationErrorResponse(validationErrors));
    }

    const employee = await Employee.findById(id);
    if (!employee)
      return res.status(404).json({ message: "Nhân viên không tồn tại" });

    if (String(employee.store_id) !== String(storeId)) {
      return res
        .status(403)
        .json({ message: "Nhân viên không thuộc cửa hàng này" });
    }

    if (req.storeRole !== "OWNER") {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền update nhân viên này" });
    }

    // Update Employee fields
    if (fullName) employee.fullName = fullName;
    // ✅ Cho phép update salary = 0
    if (salary !== undefined && salary !== null) {
      employee.salary = salary.toString();
    }
    if (shift !== undefined) employee.shift = shift;
    // ✅ Tương tự commission_rate
    if (commission_rate !== undefined && commission_rate !== null) {
      employee.commission_rate = commission_rate.toString();
    }
    if (phone !== undefined) employee.phone = phone.trim();

    //gọi để lưu vào MongoDB
    await employee.save();

    // Update User fields (email, phone)
    const user = await User.findById(employee.user_id);
    if (user) {
      if (email !== undefined) user.email = email.trim().toLowerCase();
      if (phone !== undefined) user.phone = phone.trim();
      await user.save();
    }

    // log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: employee.store_id },
      action: "update",
      entity: "Employee",
      entityId: employee._id,
      entityName: employee.fullName,
      req,
      description: `Cập nhật thông tin nhân viên "${employee.fullName}"`,
    });

    res.json({ message: "Cập nhật nhân viên thành công", employee });
  } catch (err) {
    console.error("Lỗi update nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi update nhân viên" });
  }
};

// DELETE /api/stores/:storeId/employees/:id - Xóa mềm nhân viên
const softDeleteEmployee = async (req, res) => {
  try {
    const { id, storeId } = req.params;

    // Tìm employee
    const employee = await Employee.findById(id).populate("store_id", "name");
    if (!employee) {
      console.log("Lỗi: Không tìm thấy nhân viên cần xóa:", id);
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    // Check employee thuộc cửa hàng này
    if (String(employee.store_id._id) !== String(storeId)) {
      console.log("Lỗi: Nhân viên không thuộc cửa hàng này:", id);
      return res
        .status(403)
        .json({ message: "Nhân viên không thuộc cửa hàng này" });
    }

    // Check quyền
    if (req.storeRole !== "OWNER") {
      console.log("Lỗi: Không có quyền xóa nhân viên:", id);
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa nhân viên này" });
    }

    // Nếu đã xóa trước đó
    if (employee.isDeleted) {
      return res
        .status(400)
        .json({ message: "Nhân viên này đã bị xóa mềm trước đó" });
    }

    // Đánh dấu xóa mềm
    employee.isDeleted = true;
    await employee.save();

    // Ghi log
    await logActivity({
      user: req.user,
      store: { _id: employee.store_id._id },
      action: "delete",
      entity: "Employee",
      entityId: employee._id,
      entityName: employee.fullName,
      req,
      description: `Đã xóa mềm nhân viên "${employee.fullName}" khỏi cửa hàng "${employee.store_id.name}"`,
    });

    res.json({
      message: `Đã xóa mềm nhân viên "${employee.fullName}" thành công`,
      employee,
    });
  } catch (err) {
    console.error("Lỗi xóa mềm nhân viên:", err.message);
    res
      .status(500)
      .json({ message: "Lỗi server khi xóa mềm nhân viên: " + err.message });
  }
};

// PUT /api/stores/:storeId/employees/:id/restore - Khôi phục nhân viên bị xóa mềm
const { 
  sendEmptyNotificationWorkbook, 
  createWorkbook, 
  sendWorkbook, 
  styleDataRow, 
  toDateString, 
  formatCurrency, 
  formatNumber 
} = require("../../utils/excelExport");

const restoreEmployee = async (req, res) => {
  try {
    const { id, storeId } = req.params;

    // Tìm employee
    const employee = await Employee.findById(id).populate("store_id", "name");
    if (!employee) {
      return res.status(404).json({ message: "Nhân viên không tồn tại" });
    }

    // Check employee thuộc cửa hàng này
    if (String(employee.store_id._id) !== String(storeId)) {
      return res
        .status(403)
        .json({ message: "Nhân viên không thuộc cửa hàng này" });
    }

    // Check quyền
    if (req.storeRole !== "OWNER") {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền khôi phục nhân viên này" });
    }

    // Nếu chưa bị xóa
    if (!employee.isDeleted) {
      return res.status(400).json({ message: "Nhân viên này chưa bị xóa mềm" });
    }

    // Khôi phục
    employee.isDeleted = false;
    await employee.save();

    // Ghi log
    await logActivity({
      user: req.user,
      store: { _id: employee.store_id._id },
      action: "restore",
      entity: "Employee",
      entityId: employee._id,
      entityName: employee.fullName,
      req,
      description: `Khôi phục nhân viên "${employee.fullName}" cho cửa hàng "${employee.store_id.name}"`,
    });

    res.json({
      message: `Đã khôi phục nhân viên "${employee.fullName}" thành công`,
      employee,
    });
  } catch (err) {
    console.error("Lỗi khôi phục nhân viên:", err.message);
    res
      .status(500)
      .json({ message: "Lỗi server khi khôi phục nhân viên: " + err.message });
  }
};

const exportEmployeesToExcel = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    const employees = await Employee.find({
      store_id: storeId,
      isDeleted: false,
    })
      .populate("user_id", "name email phone role")
      .lean();

    if (!employees || employees.length === 0) {
      return await sendEmptyNotificationWorkbook(res, "nhân viên", store, "Danh_Sach_Nhan_Vien");
    }

    const columns = [
      { header: "STT", key: "index", width: 6 },
      { header: "Họ và tên", key: "name", width: 25 },
      { header: "Số điện thoại", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 25 },
      { header: "Vai trò", key: "role", width: 15 },
      { header: "Lương cơ bản", key: "salary", width: 18 },
      { header: "Tỷ lệ hoa hồng (%)", key: "commission", width: 18 },
      { header: "Ca làm việc", key: "shift", width: 12 },
      { header: "Ngày tuyển dụng", key: "hiredDate", width: 18 },
      { header: "Trạng thái", key: "status", width: 15 },
    ];

    const { workbook, worksheet } = createWorkbook("Danh sách nhân viên", columns);

    const toNumber = (val) => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (val?.$numberDecimal) return parseFloat(val.$numberDecimal);
      const n = parseFloat(val.toString());
      return Number.isFinite(n) ? n : 0;
    };

    employees.forEach((emp, idx) => {
      const row = worksheet.addRow({
        index: idx + 1,
        name: emp.fullName || "",
        phone: emp.user_id?.phone || emp.phone || "",
        email: emp.user_id?.email || "",
        role: emp.user_id?.role === "OWNER" ? "Chủ cửa hàng" : (emp.user_id?.role === "MANAGER" ? "Quản lý" : "Nhân viên"),
        salary: formatCurrency(toNumber(emp.salary)),
        commission: emp.commission_rate ? `${toNumber(emp.commission_rate)}%` : "-",
        shift: emp.shift || "",
        hiredDate: toDateString(emp.hired_date),
        status: "Đang làm việc",
      });
      styleDataRow(row);
    });

    const datePart = new Date().toISOString().split("T")[0];
    const filename = `Danh_Sach_Nhan_Vien_${store.name}_${datePart}`;

    await sendWorkbook(res, workbook, filename);
  } catch (error) {
    console.error("Lỗi export nhân viên:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Lỗi server khi xuất Excel" });
    }
  }
};

/**
 * Khôi phục store bị xóa mềm (deleted = false)
 * PUT /api/stores/:storeId/restore
 */
const restoreStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    const store = await Store.findById(storeId);
    if (!store)
      return res.status(404).json({ message: "Không tìm thấy cửa hàng" });

    // Chỉ owner mới được khôi phục
    if (!store.owner_id.equals(userId)) {
      return res
        .status(403)
        .json({ message: "Chỉ owner mới được khôi phục cửa hàng" });
    }

    // Nếu chưa bị xóa
    if (!store.deleted) {
      return res.status(400).json({ message: "Cửa hàng này chưa bị xóa" });
    }

    // Khôi phục: đổi deleted = false
    store.deleted = false;
    await store.save();

    // Thêm lại store vào user.stores nếu cần
    const user = await User.findById(userId);
    if (user) {
      user.stores = user.stores || [];
      if (!user.stores.find((s) => s.toString() === storeId)) {
        user.stores.push(storeId);
      }

      // Thêm lại vào store_roles nếu cần
      user.store_roles = user.store_roles || [];
      if (!user.store_roles.find((r) => r.store.toString() === storeId)) {
        user.store_roles.push({ store: storeId, role: "OWNER" });
      }

      await user.save();
    }

    const populatedStore = await Store.findById(store._id)
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    // Log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "restore",
      entity: "Store",
      entityId: store._id,
      entityName: store.name,
      req,
      description: `Khôi phục cửa hàng "${store.name}"`,
    });

    return res.json({
      message: "Đã khôi phục cửa hàng thành công",
      store: populatedStore,
    });
  } catch (err) {
    console.error("restoreStore error:", err);
    return res.status(500).json({ message: "Lỗi server khi khôi phục store" });
  }
};

module.exports = {
  createStore,
  updateStore,
  deleteStore,
  restoreStore,
  selectStore,
  ensureStore,
  getStoreById,
  getStoresByManager,
  getStoreDashboard,
  assignStaffToStore,
  //tạo nhân viên cho store
  getEmployeesByStore,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  softDeleteEmployee,
  restoreEmployee,
  exportEmployeesToExcel,
  proxyGeocode: async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: "Thiếu tham số truy vấn q" });
      }

      console.log(`🌐 Proxy Geocode: ${q}`);
      
      const response = await axios.get("https://nominatim.openstreetmap.org/search", {
        params: {
          q,
          format: "json",
          limit: 1,
          addressdetails: 1,
        },
        headers: {
          "Accept-Language": "vi",
          "User-Agent": "SmallBizSales-App/1.0" // Nominatim requires a User-Agent
        },
      });

      res.json(response.data);
    } catch (error) {
      console.error("❌ Geocode Proxy Error:", error.message);
      res.status(500).json({ 
        message: "Lỗi khi lấy tọa độ từ OpenStreetMap", 
        error: error.message 
      });
    }
  },
};
