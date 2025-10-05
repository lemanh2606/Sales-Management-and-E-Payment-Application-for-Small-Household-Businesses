// controllers/storeController.js
const Store = require("../models/Store");
const User = require("../models/User");
const mongoose = require("mongoose");

/**
 * Tạo store mới (MANAGER)
 * Body: { name, address, phone }
 */
const createStore = async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới được tạo cửa hàng" });
    }

    if (!name || !name.trim()) return res.status(400).json({ message: "Tên cửa hàng bắt buộc" });

    const newStore = new Store({
      name: name.trim(),
      address: (address || "").trim(),
      phone: (phone || "").trim(),
      owner_id: userId,
      isDefault: false,
    });

    await newStore.save();

    // Thêm store vào danh sách owner của user
    user.stores = user.stores || [];
    user.stores.push(newStore._id);
    // Option: set current_store tự động sau tạo store mới
    user.current_store = newStore._id;
    // Gán store_roles cho owner
    user.store_roles = user.store_roles || [];
    user.store_roles.push({ store: newStore._id, role: "OWNER" });
    await user.save();

    return res.status(201).json({ message: "Tạo cửa hàng thành công", store: newStore });
  } catch (err) {
    console.error("createStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * Lấy danh sách store của Manager (owner)
 */
const getStoresByManager = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user || user.role !== "MANAGER") {
      return res.status(403).json({ message: "Chỉ Manager mới xem được danh sách store" });
    }

    const stores = await Store.find({ owner_id: userId }).sort({ createdAt: -1 });
    return res.json({ stores });
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
    const userId = req.user.id;

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
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User không tìm thấy" });

    // Lấy tất cả store owner
    const stores = await Store.find({ owner_id: userId }).sort({ createdAt: -1 });

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
    const userId = req.user.id; // caller
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

    return res.json({ message: "Gán staff thành công", staffId: staffUser._id });
  } catch (err) {
    console.error("assignStaffToStore error:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = {
  createStore,
  getStoresByManager,
  selectStore,
  ensureStore,
  getStoreDashboard,
  assignStaffToStore,
};
