// controllers/storeController.js
const mongoose = require("mongoose");
const Employee = require("../../models/Employee");
const Store = require("../../models/Store");
const User = require("../../models/User");
const logActivity = require("../../utils/logActivity");
const bcrypt = require("bcryptjs");

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
    const { name, address, phone, description, imageUrl, tags, staff_ids, location, openingHours, isDefault } =
      req.body;
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo cửa hàng" });
    }

    if (!name || !name.trim()) return res.status(400).json({ message: "Tên cửa hàng bắt buộc" });

    const newStore = new Store({
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      description: (description || "").trim(),
      imageUrl: imageUrl || "",
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()) : [],
      staff_ids: Array.isArray(staff_ids) ? staff_ids : [],
      location: location || {},
      openingHours: openingHours || {},
      isDefault: !!isDefault,
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
    if (!user.store_roles.find((r) => r.store.toString() === newStore._id.toString())) {
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

    return res.status(201).json({ message: "Tạo cửa hàng thành công", store: populatedStore });
  } catch (err) {
    console.error("createStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Lấy thông tin store theo id
 */
const getStoreById = async (req, res) => {
  try {
    const { storeId } = req.params;
    // trả về cả khi owner xem store bị deleted? Ở đây ta chỉ lấy khi deleted: false
    const store = await Store.findOne({ _id: storeId, deleted: false })
      .populate("owner_id", "_id name email")
      .populate("staff_ids", "_id name email");

    if (!store) return res.status(404).json({ message: "Không tìm thấy cửa hàng" });

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
    const { name, address, phone, description, imageUrl, tags, staff_ids, location, openingHours, isDefault } =
      req.body;
    const userId = req.user.id || req.user._id;

    const store = await Store.findById(storeId);
    if (!store || store.deleted) return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    if (!store.owner_id.equals(userId)) return res.status(403).json({ message: "Chỉ owner mới được chỉnh sửa" });

    if (name !== undefined) store.name = String(name).trim();
    if (address !== undefined) store.address = String(address).trim();
    if (phone !== undefined) store.phone = String(phone).trim();
    if (description !== undefined) store.description = String(description).trim();
    if (imageUrl !== undefined) store.imageUrl = imageUrl;
    if (tags !== undefined) store.tags = Array.isArray(tags) ? tags.map((t) => String(t).trim()) : [];
    if (staff_ids !== undefined) store.staff_ids = Array.isArray(staff_ids) ? staff_ids : [];
    if (location !== undefined) store.location = location;
    if (openingHours !== undefined) store.openingHours = openingHours;
    if (isDefault !== undefined) store.isDefault = !!isDefault;

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
    if (!store || store.deleted) return res.status(404).json({ message: "Không tìm thấy cửa hàng" });
    if (!store.owner_id.equals(userId)) return res.status(403).json({ message: "Chỉ owner mới được xóa" });

    store.deleted = true;
    await store.save();

    // (Option) Xóa tham chiếu trong User.stores nếu bạn muốn -> comment nếu không cần
    try {
      await User.updateOne({ _id: userId }, { $pull: { stores: store._id, store_roles: { store: store._id } } });
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
 * optional query params: ?page=1&limit=20&q=search
 */
const getStoresByManager = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id; // fallback
    const user = await User.findById(userId);

    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới xem được danh sách store" });
    }

    // Basic paging & search support
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const q = (req.query.q || "").trim();

    const filter = { owner_id: userId, deleted: false };
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

    if (!mongoose.Types.ObjectId.isValid(storeId)) return res.status(400).json({ message: "storeId không hợp lệ" });

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Cửa hàng không tồn tại" });

    // Kiểm tra user có quyền trên store: owner hoặc mapping store_roles
    const user = await User.findById(userId);
    const isOwner = user.role === "MANAGER" && String(store.owner_id) === String(userId);
    const mapping = (user.store_roles || []).find((r) => String(r.store) === String(store._id));
    const isStaffAssigned = !!mapping;

    if (!isOwner && !isStaffAssigned) {
      return res.status(403).json({ message: "Bạn không có quyền chọn cửa hàng này" });
    }

    user.current_store = store._id;
    await user.save();

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

    // Lấy tất cả store owner
    const stores = await Store.find({ owner_id: userId }).sort({
      createdAt: -1,
    });

    // Nếu manager chưa có store -> tạo default
    if (user.role === "MANAGER" && (!stores || stores.length === 0)) {
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

    // Nếu user đã có store nhưng chưa chọn current_store -> gán store đầu tiên
    let currentStore = null;
    if (!user.current_store && stores.length > 0) {
      currentStore = stores[0];
      user.current_store = currentStore._id;
      await user.save();
      return res.json({ created: false, stores, currentStore });
    }

    // Nếu đã có current_store -> trả về nó
    if (user.current_store) {
      currentStore = await Store.findById(user.current_store);
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

    if (!mongoose.Types.ObjectId.isValid(storeId) || !mongoose.Types.ObjectId.isValid(staffUserId)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Store không tồn tại" });

    // chỉ owner mới gán staff
    if (String(store.owner_id) !== String(userId)) {
      return res.status(403).json({ message: "Chỉ owner mới có quyền gán staff" });
    }

    const staffUser = await User.findById(staffUserId);
    if (!staffUser) return res.status(404).json({ message: "User không tồn tại" });

    // thêm mapping vào staffUser.store_roles (nếu chưa có)
    staffUser.store_roles = staffUser.store_roles || [];
    const existing = staffUser.store_roles.find((r) => String(r.store) === String(store._id));
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
    const { username, email, password, fullName, salary, shift, commission_rate, phone } = req.body;

    // Validate input cơ bản (tạo user + employee)
    if (!username || !fullName || !salary || !password || !shift) {
      console.log("Lỗi: Thiếu thông tin bắt buộc khi tạo nhân viên (username, fullName, salary, password, shift)");
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
    if (!store) {
      console.log("Lỗi: Cửa hàng không tồn tại:", storeId);
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // Validate unique username/email (dùng $or để catch OR duplicate, email optional → null)
    const usernameTrim = username.trim();
    let emailForQuery = null; // 👈 Tweak: Mặc định null cho query nếu trống
    if (email && email.trim()) {
      emailForQuery = email.toLowerCase().trim();
    }
    const existingUser = await User.findOne({
      $or: [
        { username: usernameTrim },
        { email: emailForQuery }, // 👈 Fix: Chỉ query nếu email có giá trị, null ko check unique
      ].filter(Boolean),
    });
    if (existingUser) {
      console.log("Lỗi: Username hoặc email đã tồn tại:", usernameTrim);
      return res.status(400).json({ message: "Username hoặc email đã được sử dụng" });
    }

    // Validate quyền: Dùng req.storeRole từ middleware (OWNER cho manager store)
    if (req.storeRole !== "OWNER") {
      console.log("Lỗi: Bạn không có quyền tạo nhân viên cho cửa hàng này");
      return res.status(403).json({ message: "Bạn không có quyền tạo nhân viên cho cửa hàng này" });
    }

    // Tạo User STAFF mới + hash password (bcrypt salt 10)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    let userEmail = null; // 👈 Tweak: Default null nếu empty (model conditional required skip cho STAFF)
    if (email && email.trim()) {
      userEmail = email.toLowerCase().trim();
    }
    const userPhone = phone ? phone.trim() : ""; // Phone optional, default ''
    const newUser = new User({
      username: usernameTrim,
      password_hash,
      role: "STAFF", // Role STAFF cho nhân viên bán hàng
      email: userEmail, // 👈 Tweak: Null nếu empty, conditional required cho phép STAFF
      phone: userPhone,
      stores: [], // Staff ko own store
      current_store: store._id, // Gán store hiện tại = store này
      store_roles: [
        {
          // Gán mapping role STAFF cho store
          store: store._id,
          role: "STAFF",
        },
      ],
      isVerified: true, // Default verified, staff đổi pass sau
    });
    await newUser.save();

    console.log(`Tạo User STAFF thành công: ${usernameTrim} cho cửa hàng ${store.name}`);

    // Tạo Employee ref user_id mới
    const newEmployee = new Employee({
      fullName,
      salary: salary.toString(), // Convert sang string cho Decimal128
      shift,
      commission_rate: commission_rate ? commission_rate.toString() : null, // Null safe nếu ko input
      user_id: newUser._id, // Ref user_id mới tạo
      store_id: storeId, // Bind cố định với store này
    });
    await newEmployee.save();
    console.log(`Tạo Employee thành công: ${fullName} bind với User ${usernameTrim}`);

    // Return enriched response (user + employee)
    const enrichedEmployee = await Employee.findById(newEmployee._id)
      .populate("user_id", "username email role") // Populate user info cơ bản
      .populate("store_id", "name"); // Tên store
      
    //log hoạt động
    await logActivity({
      user: req.user,
      store: { _id: store._id },
      action: "create",
      entity: "Employee",
      entityId: newEmployee._id,
      entityName: fullName,
      req,
      description: `Tạo nhân viên thành công với username "${usernameTrim}" cho cửa hàng "${store.name}"`,
    });

    res.status(201).json({
      message: "Tạo nhân viên và tài khoản cho nhân viên thành công",
      user: newUser,
      employee: enrichedEmployee,
    });
  } catch (err) {
    console.error("Lỗi tạo nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi tạo nhân viên: " + err.message });
  }
};

// GET /api/stores/:storeId/employees - Lấy danh sách nhân viên theo store (chỉ manager store xem)
const getEmployeesByStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    // Validate store và quyền (đã check qua middleware)
    const store = req.store; // 👈 Dùng req.store từ middleware
    if (!store || req.storeRole !== "OWNER") {
      // Chỉ owner (manager) xem
      console.log("Lỗi: Không có quyền xem nhân viên cửa hàng:", storeId);
      return res.status(403).json({ message: "Bạn không có quyền xem nhân viên cửa hàng này" });
    }

    // Lấy list employee của store, populate user_id nếu cần (name từ User)
    const employees = (await Employee.find({ store_id: storeId })
  .populate("user_id", "username email phone role")
  .populate("store_id", "name")
  .lean())
  .map(emp => ({
    ...emp,
    salary: emp.salary ? Number(emp.salary.toString()) : 0,
    commission_rate: emp.commission_rate ? Number(emp.commission_rate.toString()) : 0,
  }));

    console.log(`Lấy danh sách nhân viên thành công cho cửa hàng ${store.name}`);
    res.json({ message: "Lấy danh sách nhân viên thành công", employees });
  } catch (err) {
    console.error("Lỗi lấy danh sách nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy nhân viên" });
  }
};

// controllers/storeController.js (tweak nhỏ: add check employee.store_id == req.params.storeId ở get/update - paste vào functions tương ứng)
const getEmployeeById = async (req, res) => {
  try {
    const { id, storeId } = req.params; // 👈 Add storeId từ params

    const employee = await Employee.findById(id)
      .populate("user_id", "name username email phone role") // Populate user info
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
      return res.status(403).json({ message: "Bạn không có quyền xem nhân viên này" });
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
    const { fullName, salary, shift, commission_rate, email, phone } = req.body; // thêm email + phone

    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: "Nhân viên không tồn tại" });

    if (String(employee.store_id) !== String(storeId)) {
      return res.status(403).json({ message: "Nhân viên không thuộc cửa hàng này" });
    }

    if (req.storeRole !== "OWNER") {
      return res.status(403).json({ message: "Bạn không có quyền update nhân viên này" });
    }

    // Update Employee fields
    if (fullName) employee.fullName = fullName;
    if (salary) employee.salary = salary.toString();
    if (shift !== undefined) employee.shift = shift;
    if (commission_rate !== undefined) employee.commission_rate = commission_rate ? commission_rate.toString() : null;

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

module.exports = {
  createStore,
  updateStore,
  deleteStore,
  selectStore,
  ensureStore,
  getStoreById,
  getStoresByManager,
  getStoreDashboard,
  assignStaffToStore,
  //tạo nhân viên cho store
  createEmployee,
  updateEmployee,
  getEmployeesByStore,
  getEmployeeById,
};
