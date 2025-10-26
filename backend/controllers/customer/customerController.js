// controllers/customerController.js
const Customer = require("../../models/Customer");
const Order = require("../../models/Order"); // Để check Order ref trước xóa mềm

// POST /api/customers - Tạo mới khách hàng
// Body: { name, phone, address?, note?, storeId? }
const createCustomer = async (req, res) => {
  try {
    const { name, phone, address = "", note = "" } = req.body;

    // Try to get storeId in this order:
    // 1) req.store (set by checkStoreAccess middleware)
    // 2) req.body.storeId (frontend provided)
    // 3) req.user.currentStore (if you store it on user)
    const storeFromReq =
      req.store && (req.store._id || req.store.id)
        ? req.store._id || req.store.id
        : null;
    const storeFromBody = req.body.storeId || null;
    const storeFromUser =
      req.user && (req.user.currentStore || req.user.storeId)
        ? req.user.currentStore || req.user.storeId
        : null;

    const storeId = storeFromReq || storeFromBody || storeFromUser || null;

    // Debug log to help trace problems
    console.log(
      "createCustomer - req.user:",
      req.user
        ? { id: req.user._id || req.user.id, username: req.user.username }
        : null
    );

    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Thiếu tên khách hàng" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: "Thiếu số điện thoại" });
    }
    if (!storeId) {
      return res
        .status(400)
        .json({ message: "Thiếu storeId (không xác định cửa hàng hiện hành)" });
    }

    const trimmedPhone = phone.trim();

    // Kiểm tra số điện thoại đã tồn tại (không tính bản ghi đã xóa mềm) trong cùng store
    const existing = await Customer.findOne({
      phone: trimmedPhone,
      storeId: storeId,
      isDeleted: { $ne: true },
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Số điện thoại đã tồn tại trong cửa hàng này" });
    }

    // Tạo object mới, gắn storeId và creator nếu cần
    const newCustomer = new Customer({
      name: name.trim(),
      phone: trimmedPhone,
      address: address.trim(),
      note: note.trim(),
      storeId: storeId,
      isDeleted: false,
      createdBy: req.user ? req.user._id || req.user.id : undefined,
    });

    await newCustomer.save();

    const created = await Customer.findById(newCustomer._id).lean();

    console.log(
      `Tạo mới khách hàng thành công: ${created.name} (${created.phone}), storeId=${storeId}`
    );
    return res
      .status(201)
      .json({ message: "Tạo khách hàng thành công", customer: created });
  } catch (err) {
    console.error("Lỗi khi tạo khách hàng:", err);
    return res.status(500).json({ message: "Lỗi server khi tạo khách hàng" });
  }
};

// GET /api/customers/search - Tìm kiếm khách hàng theo phone (exact) hoặc name (fuzzy)
// http://localhost:9999/api/customers/search?query=0987654321&limit=5
const searchCustomers = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query; // Query string (phone/name), limit default 10
    if (!query) {
      return res.status(400).json({ message: "Thiếu query tìm kiếm" });
    }

    console.log(`Query search: "${query}", limit: ${limit}`); // Log query để debug

    // Search exact phone ($eq) + fuzzy name ($regex 'i'), filter isDeleted: { $ne: true } match missing field
    const searchQuery = {
      isDeleted: { $ne: true }, // Ko true (bao gồm missing field default false)
    };
    if (query.length >= 10) {
      // Giả sử phone VN 10 số, ưu tiên exact match phone
      searchQuery.phone = query.trim(); // Exact phone = query (ko regex, match full)
    } else {
      searchQuery.$or = [
        { phone: { $regex: query, $options: "i" } }, // Phone fuzzy nếu query ngắn
        { name: { $regex: query, $options: "i" } }, // Name fuzzy case-insensitive
      ];
    }

    console.log("Search query object:", JSON.stringify(searchQuery, null, 2)); // Log full query để debug

    const customers = await Customer.find(searchQuery)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }) // Mới nhất trước
      .lean(); // Plain object nhanh

    // Log DB count để debug (tổng active customers)
    const totalActive = await Customer.countDocuments({
      isDeleted: { $ne: true },
    }); // Ko true (missing ok)
    // Log raw document match phone exact để debug
    const rawPhoneMatch = await Customer.findOne({
      phone: query.trim(),
      isDeleted: { $ne: true },
    }).lean();
    console.log(
      `Tổng active customers DB: ${totalActive}, search kết quả: ${customers.length}, raw phone match:`,
      JSON.stringify(rawPhoneMatch, null, 2)
    ); // Log raw để xem phone/isDeleted

    res.json({ message: "Tìm kiếm thành công", customers });
  } catch (err) {
    console.error("Lỗi tìm kiếm khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi tìm kiếm khách hàng" });
  }
};

// PUT /api/customers/:id - Chỉnh sửa thông tin khách hàng (name/phone, unique phone)
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params; // ID khách hàng từ params
    const { name, phone, address, note } = req.body; // Input fields (optional)

    const customer = await Customer.findById(id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ message: "Khách hàng không tồn tại" });
    }

    // Validate unique phone nếu thay đổi
    if (phone && phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({
        phone: phone.trim(),
        _id: { $ne: id },
      });
      if (existing && !existing.isDeleted) {
        return res.status(400).json({ message: "Số phone đã tồn tại" });
      }
    }

    // Update fields
    if (name) customer.name = name.trim();
    if (phone) customer.phone = phone.trim();
    if (address !== undefined) customer.address = (address || "").trim();
    if (note !== undefined) customer.note = (note || "").trim();

    await customer.save();

    // Populate để return full
    const updatedCustomer = await Customer.findById(id).lean();
    console.log(`Cập nhật khách hàng thành công: ${customer.name}`);
    res.json({ message: "Cập nhật thành công", customer: updatedCustomer });
  } catch (err) {
    console.error("Lỗi cập nhật khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi cập nhật khách hàng" });
  }
};

// DELETE /api/customers/:id - Xóa mềm khách hàng (set isDeleted true, check ko có Order pending)
const softDeleteCustomer = async (req, res) => {
  try {
    const { id } = req.params; // ID khách hàng từ params

    const customer = await Customer.findById(id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ message: "Khách hàng không tồn tại" });
    }

    // Check ko có Order pending/refunded (an toàn, ko xóa nếu có Order active)
    const activeOrders = await Order.find({
      customer: id,
      status: { $in: ["pending", "refunded"] },
    });
    if (activeOrders.length > 0) {
      return res
        .status(400)
        .json({ message: "Không thể xóa khách hàng có đơn hàng đang xử lý" });
    }

    customer.isDeleted = true; // Xóa mềm
    await customer.save();

    console.log(`Xóa mềm khách hàng thành công: ${customer.name}`);
    res.json({ message: "Xóa khách hàng thành công" });
  } catch (err) {
    console.error("Lỗi xóa khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi xóa khách hàng" });
  }
};

// GET /api/customers/store/:storeId - Lấy toàn bộ khách hàng của 1 cửa hàng
// GET /api/customers/store/:storeId?page=1&limit=10&query=abc
const getCustomersByStore = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { page = 1, limit = 10, query = "" } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId trong URL" });
    }

    // Chuẩn bị bộ lọc
    const filter = {
      storeId,
      isDeleted: { $ne: true },
    };

    // Nếu có từ khóa tìm kiếm
    if (query && query.trim() !== "") {
      const q = query.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { address: { $regex: q, $options: "i" } },
        { note: { $regex: q, $options: "i" } },
      ];
    }

    // Tổng số kết quả
    const total = await Customer.countDocuments(filter);

    // Lấy danh sách khách hàng có phân trang
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    res.json({
      message: "Lấy danh sách khách hàng thành công",
      page: Number(page),
      limit: Number(limit),
      total,
      count: customers.length,
      customers,
    });
  } catch (err) {
    console.error("❌ Lỗi khi lấy danh sách khách hàng theo store:", err);
    res
      .status(500)
      .json({ message: "Lỗi server khi lấy danh sách khách hàng" });
  }
};

module.exports = {
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
  createCustomer,
  getCustomersByStore, // 👈 thêm dòng này
};
