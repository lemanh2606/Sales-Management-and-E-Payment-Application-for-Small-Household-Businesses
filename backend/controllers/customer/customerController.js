// controllers/customerController.js
const Customer = require("../../models/Customer");
const Order = require("../../models/Order"); // Để check Order ref trước xóa mềm
const User = require("../../models/User");
const Employee = require("../../models/Employee");
const Store = require("../../models/Store");
const logActivity = require("../../utils/logActivity");
const path = require("path");
const { parseExcelToJSON, validateRequiredFields, sanitizeData } = require("../../utils/fileImport");
const excelJS = require("exceljs");
const fs = require("fs");

function resolveStoreId(req) {
  const candidate =
    req.store?._id ||
    req.store?.id ||
    req.params?.storeId ||
    req.query?.storeId ||
    req.query?.shopId ||
    req.body?.storeId ||
    req.body?.shopId ||
    req.user?.current_store ||
    null;

  return candidate ? candidate.toString() : null;
}

// POST /api/customers - Tạo mới khách hàng
// Body: { name, phone, address?, note?, storeId? }
const createCustomer = async (req, res) => {
  try {
    const { name, phone, address = "", note = "" } = req.body;
    const storeFromReq = req.store && (req.store._id || req.store.id) ? req.store._id || req.store.id : null;
    const storeFromBody = req.body.storeId || null;
    const storeFromUser = req.user && (req.user.currentStore || req.user.storeId) ? req.user.currentStore || req.user.storeId : null;

    const storeId = storeFromReq || storeFromBody || storeFromUser || null;

    // Debug log to help trace problems
    console.log("createCustomer - req.user:", req.user ? { id: req.user._id || req.user.id, username: req.user.username } : null);

    // Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Thiếu tên khách hàng" });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: "Thiếu số điện thoại" });
    }
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId (không xác định cửa hàng hiện hành)" });
    }

    const trimmedPhone = phone.trim();

    // Kiểm tra số điện thoại đã tồn tại (không tính bản ghi đã xóa mềm) trong cùng store
    const existing = await Customer.findOne({
      phone: trimmedPhone,
      storeId: storeId,
      isDeleted: { $ne: true },
    });
    if (existing) {
      return res.status(400).json({ message: "Số điện thoại đã tồn tại trong cửa hàng này" });
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
    // Log hoạt động tạo khách hàng
    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "Customer",
      entityId: newCustomer._id,
      entityName: newCustomer.name,
      req,
      description: `Tạo mới khách hàng ${newCustomer.name} (${newCustomer.phone}) tại cửa hàng ${storeId}`,
    });

    const created = await Customer.findById(newCustomer._id).lean();

    console.log(`Tạo mới khách hàng thành công: ${created.name} (${created.phone}), storeId=${storeId}`);
    return res.status(201).json({ message: "Tạo khách hàng thành công", customer: created });
  } catch (err) {
    console.error("Lỗi khi tạo khách hàng:", err);
    return res.status(500).json({ message: "Lỗi server khi tạo khách hàng" });
  }
};

// GET /api/customers/search - Tìm kiếm khách hàng theo phone (exact) hoặc name (fuzzy)
//GET: http://localhost:9999/api/customers/search?query=0987654321&limit=5
const searchCustomers = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query; // Query string (phone/name), limit default 10
    if (!query) {
      return res.status(400).json({ message: "Thiếu query tìm kiếm" });
    }

    const storeId = resolveStoreId(req);
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId để tìm khách hàng" });
    }

    console.log(`Query search: "${query}", limit: ${limit}`); // Log query để debug

    // Search exact phone ($eq) + fuzzy name ($regex 'i'), filter isDeleted: { $ne: true } match missing field
    const searchQuery = {
      storeId,
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
      storeId,
      isDeleted: { $ne: true },
    }); // Ko true (missing ok)
    // Log raw document match phone exact để debug
    const rawPhoneMatch = await Customer.findOne({
      phone: query.trim(),
      storeId,
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
        storeId: customer.storeId,
        isDeleted: { $ne: true },
      });
      if (existing) {
        return res.status(400).json({ message: "Số phone đã tồn tại trong cửa hàng này" });
      }
    }

    // Update fields
    if (name) customer.name = name.trim();
    if (phone) customer.phone = phone.trim();
    if (address !== undefined) customer.address = (address || "").trim();
    if (note !== undefined) customer.note = (note || "").trim();

    await customer.save();
    // Log hoạt động cập nhật khách hàng
    await logActivity({
      user: req.user,
      store: { _id: customer.storeId },
      action: "update",
      entity: "Customer",
      entityId: customer._id,
      entityName: customer.name,
      req,
      description: `Cập nhật thông tin khách hàng ${customer.name} (${customer.phone})`,
    });

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
      return res.status(400).json({ message: "Không thể xóa khách hàng có đơn hàng đang xử lý" });
    }

    customer.isDeleted = true; // Xóa mềm
    await customer.save();
    // log nhật ký hoạt động
    await logActivity({
      user: req.user,
      store: { _id: customer.storeId },
      action: "delete",
      entity: "Customer",
      entityId: customer._id,
      entityName: customer.name,
      req,
      description: `Xóa mềm khách hàng ${customer.name} (${customer.phone})`,
    });

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
    res.status(500).json({ message: "Lỗi server khi lấy danh sách khách hàng" });
  }
};

// Import Customers from Excel/CSV
const importCustomers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id || req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng tải lên file" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ message: "Cửa hàng không tồn tại" });
    }

    // ĐÃ LOẠI BỎ CHECK ROLE - Chỉ kiểm tra quyền truy cập cơ bản
    // Mọi user đã xác thực đều có thể import nếu có file

    const data = await parseExcelToJSON(req.file.buffer);

    if (data.length === 0) {
      return res.status(400).json({ message: "File không chứa dữ liệu hợp lệ" });
    }

    const results = { success: [], failed: [], total: data.length };

    for (let i = 0; i < data.length; i++) {
      const row = sanitizeData(data[i]);
      const rowNumber = i + 2;

      try {
        const validation = validateRequiredFields(row, ["Tên khách hàng", "Số điện thoại"]);
        if (!validation.isValid) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Thiếu: ${validation.missingFields.join(", ")}`,
          });
          continue;
        }

        const phone = row["Số điện thoại"].trim();

        if (!/^\d{10,11}$/.test(phone)) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: "Số điện thoại không hợp lệ (10-11 chữ số)",
          });
          continue;
        }

        const existingCustomer = await Customer.findOne({
          phone: phone,
          storeId: storeId,
          isDeleted: false,
        });

        if (existingCustomer) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: `Số điện thoại đã tồn tại: ${phone}`,
          });
          continue;
        }

        const newCustomer = new Customer({
          name: row["Tên khách hàng"],
          phone: phone,
          address: row["Địa chỉ"] || "",
          note: row["Ghi chú"] || "",
          storeId: storeId,
          createdBy: userId,
        });

        await newCustomer.save();

        // Log hoạt động import
        await logActivity({
          user: req.user,
          store: { _id: storeId },
          action: "import",
          entity: "Customer",
          entityId: newCustomer._id,
          entityName: newCustomer.name,
          req,
          description: `Import khách hàng ${newCustomer.name} (${newCustomer.phone}) từ file Excel`,
        });

        results.success.push({
          row: rowNumber,
          customer: {
            _id: newCustomer._id,
            name: newCustomer.name,
            phone: newCustomer.phone,
          },
        });
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
      }
    }

    res.status(200).json({ message: "Import hoàn tất", results });
  } catch (error) {
    console.error("Lỗi importCustomers:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Download Customer Template
const downloadCustomerTemplate = (req, res) => {
  const filePath = path.resolve(__dirname, "../../templates/customer_template.xlsx");

  return res.sendFile(
    filePath,
    {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=customer_template.xlsx",
      },
    },
    (err) => {
      if (err) {
        console.error("Lỗi downloadCustomerTemplate:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Lỗi server", error: err.message });
        }
      }
    }
  );
};

// GET /api/customers/:id - Lấy thông tin chi tiết khách hàng
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).lean();

    if (!customer) {
      return res.status(404).json({ message: "Khách hàng không tồn tại" });
    }

    res.json({ message: "Lấy thông tin khách hàng thành công", customer });
  } catch (err) {
    console.error("Lỗi lấy thông tin khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy thông tin khách hàng" });
  }
};

// GET /api/customers - Lấy tất cả khách hàng (có phân trang và tìm kiếm)
const getAllCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, query = "", storeId } = req.query;

    // Chuẩn bị bộ lọc
    const filter = {
      isDeleted: { $ne: true },
    };

    // Lọc theo storeId nếu có
    if (storeId) {
      filter.storeId = storeId;
    }

    // Tìm kiếm theo query
    if (query && query.trim() !== "") {
      const q = query.trim();
      filter.$or = [{ name: { $regex: q, $options: "i" } }, { phone: { $regex: q, $options: "i" } }, { address: { $regex: q, $options: "i" } }];
    }

    // Tổng số kết quả
    const total = await Customer.countDocuments(filter);

    // Lấy danh sách khách hàng
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
    console.error("Lỗi lấy danh sách khách hàng:", err.message);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách khách hàng" });
  }
};

const exportCustomers = async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId để xuất dữ liệu" });
    }

    // Lấy toàn bộ khách hàng của store, isDeleted=false
    const customers = await Customer.find({ storeId, isDeleted: false }).sort({ createdAt: -1 }).lean();

    if (!customers || customers.length === 0) {
      return res.status(404).json({ message: "Không có dữ liệu khách hàng để xuất" });
    }

    // Tạo workbook
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");

    // Cột header
    worksheet.columns = [
      { header: "Tên khách hàng", key: "name", width: 30 },
      { header: "Số điện thoại", key: "phone", width: 20 },
      { header: "Địa chỉ", key: "address", width: 40 },
      { header: "Ghi chú", key: "note", width: 40 },
      { header: "Điểm tích lũy", key: "loyaltyPoints", width: 15 },
      { header: "Tổng chi tiêu", key: "totalSpent", width: 20 },
      { header: "Tổng số đơn", key: "totalOrders", width: 15 },
      { header: "Ngày tạo", key: "createdAt", width: 20 },
    ];

    // Add rows
    customers.forEach((customer) => {
      worksheet.addRow({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || "",
        note: customer.note || "",
        loyaltyPoints: customer.loyaltyPoints || 0,
        totalSpent: customer.totalSpent ? parseFloat(customer.totalSpent.toString()) : 0,
        totalOrders: customer.totalOrders || 0,
        createdAt: customer.createdAt ? customer.createdAt.toISOString().split("T")[0] : "",
      });
    });

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=customers_${storeId}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (error) {
    console.error("Lỗi exportCustomers:", error);
    res.status(500).json({ message: "Lỗi server khi xuất Excel", error: error.message });
  }
};

module.exports = {
  searchCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  getCustomersByStore,
  importCustomers,
  downloadCustomerTemplate,
  getCustomerById,
  getAllCustomers,
  exportCustomers,
};
