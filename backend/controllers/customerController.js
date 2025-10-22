// controllers/customerController.js (fix searchCustomers: exact phone + fuzzy name, log query/debug - paste thay file)
const Customer = require("../models/Customer");
const Order = require("../models/Order"); // Để check Order ref trước xóa mềm

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
      isDeleted: { $ne: true }  // Ko true (bao gồm missing field default false)
    };
    if (query.length >= 10) { // Giả sử phone VN 10 số, ưu tiên exact match phone
      searchQuery.phone = query.trim(); // Exact phone = query (ko regex, match full)
    } else {
      searchQuery.$or = [
        { phone: { $regex: query, $options: 'i' } }, // Phone fuzzy nếu query ngắn
        { name: { $regex: query, $options: 'i' } }, // Name fuzzy case-insensitive
      ];
    }

    console.log("Search query object:", JSON.stringify(searchQuery, null, 2)); // Log full query để debug

    const customers = await Customer.find(searchQuery)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 }) // Mới nhất trước
    .lean(); // Plain object nhanh

    // Log DB count để debug (tổng active customers)
    const totalActive = await Customer.countDocuments({ isDeleted: { $ne: true } }); // Ko true (missing ok)
    // Log raw document match phone exact để debug
    const rawPhoneMatch = await Customer.findOne({ phone: query.trim(), isDeleted: { $ne: true } }).lean();
    console.log(`Tổng active customers DB: ${totalActive}, search kết quả: ${customers.length}, raw phone match:`, JSON.stringify(rawPhoneMatch, null, 2)); // Log raw để xem phone/isDeleted

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
    const { name, phone } = req.body; // Input name/phone (optional)

    const customer = await Customer.findById(id);
    if (!customer || customer.isDeleted) {
      return res.status(404).json({ message: "Khách hàng không tồn tại" });
    }

    // Validate unique phone nếu thay đổi
    if (phone && phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({ phone: phone.trim(), _id: { $ne: id } });
      if (existing && !existing.isDeleted) {
        return res.status(400).json({ message: "Số phone đã tồn tại" });
      }
    }

    // Update fields
    if (name) customer.name = name.trim();
    if (phone) customer.phone = phone.trim();

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
      status: { $in: ["pending", "refunded"] } 
    });
    if (activeOrders.length > 0) {
      return res.status(400).json({ message: "Không thể xóa khách hàng có đơn hàng đang xử lý" });
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

module.exports = { searchCustomers, updateCustomer, softDeleteCustomer };