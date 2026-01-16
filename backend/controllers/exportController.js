const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Customer = require("../models/Customer");
const Supplier = require("../models/Supplier");
const Employee = require("../models/Employee");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseReturn = require("../models/PurchaseReturn");
const StockCheck = require("../models/StockCheck");
const StockDisposal = require("../models/StockDisposal");
const ActivityLog = require("../models/ActivityLog");
const logActivity = require("../utils/logActivity");
const {
  toNumber,
  toDateString,
  createWorkbook,
  sendWorkbook,
  styleDataRow,
  withExportErrorHandler,
  formatCurrency,
  formatNumber,
} = require("../utils/excelExport");

const sanitizeFilename = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "") || "store";

const buildFilename = (store, key) => {
  const storeSlug = sanitizeFilename(store?.name || store?._id?.toString() || "store");
  const datePart = new Date().toISOString().split("T")[0];
  return `${storeSlug}_${key}_${datePart}`;
};

// Thay vì trả lỗi, tạo file Excel với thông báo khi không có dữ liệu
const createEmptyDataNotification = async (res, store, entityLabel) => {
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Thông báo");
  
  // Thông báo lớn
  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = "THÔNG BÁO";
  worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFF0000" } };
  worksheet.getCell("A1").alignment = { horizontal: "center" };
  
  worksheet.mergeCells("A3:E3");
  worksheet.getCell("A3").value = `Hiện tại chưa có dữ liệu ${entityLabel.toLowerCase()} nào.`;
  worksheet.getCell("A3").font = { size: 12 };
  worksheet.getCell("A3").alignment = { horizontal: "center" };
  
  worksheet.mergeCells("A5:E5");
  worksheet.getCell("A5").value = "Vui lòng thêm dữ liệu trước khi xuất.";
  worksheet.getCell("A5").font = { size: 12, italic: true };
  worksheet.getCell("A5").alignment = { horizontal: "center" };

  worksheet.mergeCells("A7:E7");
  worksheet.getCell("A7").value = `Cửa hàng: ${store?.name || "Chưa đặt tên"}`;
  worksheet.getCell("A7").font = { size: 11 };
  
  worksheet.mergeCells("A8:E8");
  worksheet.getCell("A8").value = `Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`;
  worksheet.getCell("A8").font = { size: 11 };

  // Set column widths
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 15;
  
  const storeSlug = sanitizeFilename(store?.name || "store");
  const datePart = new Date().toISOString().split("T")[0];
  const filename = `${storeSlug}_khong_co_du_lieu_${datePart}.xlsx`;
  
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  
  await workbook.xlsx.write(res);
  res.end();
};

const ensureHasRows = async (res, rows, store, entityLabel = "dữ liệu") => {
  if (!Array.isArray(rows) || rows.length === 0) {
    await createEmptyDataNotification(res, store, entityLabel);
    return false;
  }
  return true;
};

const parseDateRange = ({ from, to }) => {
  const range = {};

  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      fromDate.setHours(0, 0, 0, 0);
      range.$gte = fromDate;
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      range.$lte = toDate;
    }
  }

  return Object.keys(range).length ? range : null;
};

const aggregateOrderItems = async (orderIds) => {
  if (!orderIds.length) return {};

  const stats = await OrderItem.aggregate([
    { $match: { orderId: { $in: orderIds } } },
    {
      $group: {
        _id: "$orderId",
        totalQuantity: { $sum: "$quantity" },
        lineItems: { $sum: 1 },
        subtotal: { $sum: "$subtotal" },
      },
    },
  ]);

  return stats.reduce((acc, item) => {
    acc[item._id.toString()] = {
      totalQuantity: item.totalQuantity || 0,
      lineItems: item.lineItems || 0,
      subtotal: item.subtotal || 0,
    };
    return acc;
  }, {});
};

const logExport = async (req, definition, total) => {
  await logActivity({
    user: req.user,
    store: req.store,
    action: "export",
    entity: definition.entity || definition.label,
    entityId: req.store?._id,
    entityName: definition.label,
    req,
    description: `Xuất ${definition.label} (${total} dòng)`,
  });
};

const exportProducts = async (req, res, definition) => {
  const storeId = req.store._id;
  const products = await Product.find({ store_id: storeId })
    .populate("supplier_id", "name")
    .populate("group_id", "name")
    .sort({ name: 1 })
    .lean();

  if (!(await ensureHasRows(res, products, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "SKU", key: "sku", width: 16 },
    { header: "Tên sản phẩm", key: "name", width: 32 },
    { header: "Nhóm hàng", key: "group", width: 24 },
    { header: "Nhà cung cấp", key: "supplier", width: 24 },
    { header: "Đơn vị", key: "unit", width: 12 },
    { header: "Giá bán", key: "price", width: 16 },
    { header: "Giá vốn", key: "costPrice", width: 16 },
    { header: "Tồn kho", key: "stock", width: 12 },
    { header: "Điểm cảnh báo", key: "minStock", width: 16 },
    { header: "Trạng thái", key: "status", width: 20 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Danh sách sản phẩm", columns);

  products.forEach((product, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      sku: product.sku || "",
      name: product.name,
      group: product.group_id?.name || "Chưa phân loại",
      supplier: product.supplier_id?.name || "-",
      unit: product.unit || "",
      price: formatCurrency(toNumber(product.price)),
      costPrice: formatCurrency(toNumber(product.cost_price)),
      stock: formatNumber(product.stock_quantity || 0),
      minStock: formatNumber(product.min_stock || 0),
      status: product.status || "",
      createdAt: toDateString(product.createdAt),
    });
    styleDataRow(row);
  });

  await logExport(req, definition, products.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportCustomers = async (req, res, definition) => {
  const storeId = req.store._id;
  const customers = await Customer.find({ storeId })
    .sort({ createdAt: -1 })
    .lean();

  if (!(await ensureHasRows(res, customers, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Tên khách", key: "name", width: 24 },
    { header: "Số điện thoại", key: "phone", width: 18 },
    { header: "Địa chỉ", key: "address", width: 32 },
    { header: "Điểm", key: "points", width: 10 },
    { header: "Tổng chi tiêu", key: "totalSpend", width: 18 },
    { header: "Số đơn", key: "orderCount", width: 10 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Khách hàng", columns);

  customers.forEach((customer, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      name: customer.name,
      phone: customer.phone,
      address: customer.address || "",
      points: formatNumber(customer.loyaltyPoints || 0),
      totalSpend: formatCurrency(toNumber(customer.totalSpent)),
      orderCount: formatNumber(customer.totalOrders || 0),
      createdAt: toDateString(customer.createdAt),
    });
    styleDataRow(row);
  });

  await logExport(req, definition, customers.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportSuppliers = async (req, res, definition) => {
  const storeId = req.store._id;
  const suppliers = await Supplier.find({ store_id: storeId })
    .sort({ name: 1 })
    .lean();

  if (!(await ensureHasRows(res, suppliers, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Tên nhà cung cấp", key: "name", width: 28 },
    { header: "Điện thoại", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 24 },
    { header: "Địa chỉ", key: "address", width: 30 },
    { header: "Mã số thuế", key: "tax", width: 16 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Nhà cung cấp", columns);

  suppliers.forEach((supplier, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      tax: supplier.taxcode || "",
      status: supplier.status,
      createdAt: toDateString(supplier.createdAt),
    });
    styleDataRow(row);
  });

  await logExport(req, definition, suppliers.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportEmployees = async (req, res, definition) => {
  const storeId = req.store._id;
  const employees = await Employee.find({ store_id: storeId })
    .populate("user_id", "email username role")
    .sort({ createdAt: -1 })
    .lean();

  if (!(await ensureHasRows(res, employees, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Họ tên", key: "name", width: 26 },
    { header: "Điện thoại", key: "phone", width: 16 },
    { header: "Email đăng nhập", key: "email", width: 26 },
    { header: "Vai trò", key: "role", width: 14 },
    { header: "Lương cơ bản", key: "salary", width: 18 },
    { header: "Hoa hồng (%)", key: "commission", width: 16 },
    { header: "Ca làm", key: "shift", width: 14 },
    { header: "Ngày nhận việc", key: "hiredDate", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Nhân viên", columns);

  employees.forEach((employee, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      name: employee.fullName,
      phone: employee.phone || "",
      email: employee.user_id?.email || employee.user_id?.username || "",
      role: employee.user_id?.role || "",
      salary: formatCurrency(toNumber(employee.salary)),
      commission: employee.commission_rate ? `${toNumber(employee.commission_rate)}%` : "-",
      shift: employee.shift || "",
      hiredDate: toDateString(employee.hired_date),
    });
    styleDataRow(row);
  });

  await logExport(req, definition, employees.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportOrders = async (req, res, definition) => {
  const storeId = req.store._id;
  const { status, paymentMethod } = req.query;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });

  const query = { storeId };
  if (status) {
    query.status = status;
  }
  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }
  if (dateRange) {
    query.createdAt = dateRange;
  }

  const orders = await Order.find(query)
    .populate("employeeId", "fullName")
    .populate("customer", "name phone")
    .sort({ createdAt: -1 })
    .lean();

  if (!(await ensureHasRows(res, orders, req.store, definition.label))) return;

  const orderIds = orders.map((o) => o._id);
  const orderItemStats = await aggregateOrderItems(orderIds);

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Mã đơn", key: "orderCode", width: 25 },
    { header: "Ngày tạo", key: "createdAt", width: 18 },
    { header: "Khách hàng", key: "customer", width: 24 },
    { header: "Nhân viên", key: "employee", width: 24 },
    { header: "Hình thức", key: "payment", width: 16 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Số dòng hàng", key: "lineItems", width: 14 },
    { header: "Tổng SL", key: "quantity", width: 12 },
    { header: "Trước thuế", key: "beforeTax", width: 18 },
    { header: "VAT", key: "vat", width: 14 },
    { header: "Thành tiền", key: "total", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Đơn hàng", columns);

  orders.forEach((order, idx) => {
    const stats = orderItemStats[order._id.toString()] || {};
    const row = worksheet.addRow({
      index: idx + 1,
      orderCode: order.paymentRef || order._id.toString(),
      createdAt: toDateString(order.createdAt),
      customer: order.customer?.name || "Khách lẻ",
      employee: order.employeeId?.fullName || "",
      payment: order.paymentMethod === "qr" ? "QR" : "Tiền mặt",
      status: order.status,
      lineItems: formatNumber(stats.lineItems || 0),
      quantity: formatNumber(stats.totalQuantity || 0),
      beforeTax: formatCurrency(toNumber(order.beforeTaxAmount)),
      vat: formatCurrency(toNumber(order.vatAmount)),
      total: formatCurrency(toNumber(order.totalAmount)),
    });
    styleDataRow(row);
  });

  await logExport(req, definition, orders.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportPurchaseOrders = async (req, res, definition) => {
  const storeId = req.store._id;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });
  const query = { store_id: storeId };
  if (dateRange) {
    query.purchase_order_date = dateRange;
  }

  const purchaseOrders = await PurchaseOrder.find(query)
    .populate("supplier_id", "name")
    .populate("created_by", "fullname email username")
    .sort({ purchase_order_date: -1 })
    .lean();

  if (!(await ensureHasRows(res, purchaseOrders, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Mã phiếu", key: "code", width: 20 },
    { header: "Ngày nhập", key: "date", width: 18 },
    { header: "Nhà cung cấp", key: "supplier", width: 28 },
    { header: "Người tạo", key: "creator", width: 22 },
    { header: "Số dòng hàng", key: "itemLines", width: 14 },
    { header: "Tổng tiền", key: "total", width: 18 },
    { header: "Đã trả", key: "paid", width: 18 },
    { header: "Còn nợ", key: "remaining", width: 18 },
    { header: "Trạng thái", key: "status", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Phiếu nhập", columns);

  purchaseOrders.forEach((po, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      code: po.purchase_order_code,
      date: toDateString(po.purchase_order_date),
      supplier: po.supplier_id?.name || "",
      creator: po.created_by?.fullname || po.created_by?.email || po.created_by?.username || "",
      itemLines: formatNumber(po.items?.length || 0),
      total: formatCurrency(po.total_amount || 0),
      paid: formatCurrency(po.paid_amount || 0),
      remaining: formatCurrency(Math.max(0, (po.total_amount || 0) - (po.paid_amount || 0))),
      status: po.status,
    });
    styleDataRow(row);
  });

  await logExport(req, definition, purchaseOrders.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportPurchaseReturns = async (req, res, definition) => {
  const storeId = req.store._id;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });
  const query = { store_id: storeId };
  if (dateRange) {
    query.return_date = dateRange;
  }

  const purchaseReturns = await PurchaseReturn.find(query)
    .populate("supplier_id", "name")
    .populate("purchase_order_id", "purchase_order_code")
    .populate("created_by", "fullname email username")
    .sort({ return_date: -1 })
    .lean();

  if (!(await ensureHasRows(res, purchaseReturns, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Mã phiếu", key: "code", width: 20 },
    { header: "Đơn nhập", key: "poCode", width: 20 },
    { header: "Ngày trả", key: "date", width: 18 },
    { header: "Nhà cung cấp", key: "supplier", width: 28 },
    { header: "Người tạo", key: "creator", width: 22 },
    { header: "Số sản phẩm", key: "itemLines", width: 14 },
    { header: "Tổng trả", key: "total", width: 18 },
    { header: "Đã nhận", key: "refunded", width: 18 },
    { header: "Còn lại", key: "remaining", width: 18 },
    { header: "Trạng thái", key: "status", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Phiếu trả hàng", columns);

  purchaseReturns.forEach((pr, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      code: pr.purchase_return_code || pr._id.toString(),
      poCode: pr.purchase_order_id?.purchase_order_code || "-",
      date: toDateString(pr.return_date),
      supplier: pr.supplier_id?.name || "",
      creator: pr.created_by?.fullname || pr.created_by?.email || pr.created_by?.username || "",
      itemLines: formatNumber(pr.items?.length || 0),
      total: formatCurrency(pr.total_amount || 0),
      refunded: formatCurrency(pr.supplier_refund || 0),
      remaining: formatCurrency(Math.max(0, (pr.total_amount || 0) - (pr.supplier_refund || 0))),
      status: pr.status,
    });
    styleDataRow(row);
  });

  await logExport(req, definition, purchaseReturns.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportStockChecks = async (req, res, definition) => {
  const storeId = req.store._id;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });
  const query = { store_id: storeId };
  if (dateRange) {
    query.check_date = dateRange;
  }

  const stockChecks = await StockCheck.find(query)
    .populate("created_by", "fullname email username")
    .sort({ check_date: -1 })
    .lean();

  if (!(await ensureHasRows(res, stockChecks, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Mã kiểm kho", key: "code", width: 22 },
    { header: "Ngày kiểm", key: "checkDate", width: 18 },
    { header: "Người tạo", key: "creator", width: 24 },
    { header: "Số dòng hàng", key: "items", width: 14 },
    { header: "Chênh lệch SL", key: "quantityDiff", width: 16 },
    { header: "Giá trị chênh lệch", key: "valueDiff", width: 20 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Ngày cân bằng", key: "balanceDate", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Kiểm kho", columns);

  stockChecks.forEach((stockCheck, idx) => {
    const quantityDiff = (stockCheck.items || []).reduce(
      (sum, item) => sum + (item.actual_quantity - item.book_quantity),
      0
    );
    const valueDiff = (stockCheck.items || []).reduce((sum, item) => {
      const diff = item.actual_quantity - item.book_quantity;
      return sum + diff * toNumber(item.cost_price);
    }, 0);

    const row = worksheet.addRow({
      index: idx + 1,
      code: stockCheck.check_code,
      checkDate: toDateString(stockCheck.check_date),
      creator: stockCheck.created_by?.fullname || stockCheck.created_by?.email || stockCheck.created_by?.username || "",
      items: formatNumber(stockCheck.items?.length || 0),
      quantityDiff: formatNumber(quantityDiff),
      valueDiff: formatCurrency(valueDiff),
      status: stockCheck.status,
      balanceDate: stockCheck.balance_date ? toDateString(stockCheck.balance_date) : "",
    });
    styleDataRow(row);
  });

  await logExport(req, definition, stockChecks.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportStockDisposals = async (req, res, definition) => {
  const storeId = req.store._id;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });
  const query = { store_id: storeId };
  if (dateRange) {
    query.disposal_date = dateRange;
  }

  const disposals = await StockDisposal.find(query)
    .populate("created_by", "fullname email username")
    .sort({ disposal_date: -1 })
    .lean();

  if (!(await ensureHasRows(res, disposals, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Mã xuất hủy", key: "code", width: 22 },
    { header: "Ngày xuất", key: "date", width: 18 },
    { header: "Người lập", key: "creator", width: 24 },
    { header: "Số dòng hàng", key: "items", width: 14 },
    { header: "Tổng SL", key: "quantity", width: 14 },
    { header: "Giá trị hủy", key: "value", width: 20 },
    { header: "Trạng thái", key: "status", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Xuất hủy", columns);

  disposals.forEach((disposal, idx) => {
    const quantity = (disposal.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
    const value = (disposal.items || []).reduce((sum, item) => sum + (item.quantity || 0) * toNumber(item.unit_cost_price), 0);

    const row = worksheet.addRow({
      index: idx + 1,
      code: disposal.disposal_code,
      date: toDateString(disposal.disposal_date),
      creator: disposal.created_by?.fullname || disposal.created_by?.email || disposal.created_by?.username || "",
      items: formatNumber(disposal.items?.length || 0),
      quantity: formatNumber(quantity),
      value: formatCurrency(value),
      status: disposal.status,
    });
    styleDataRow(row);
  });

  await logExport(req, definition, disposals.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const exportActivityLogs = async (req, res, definition) => {
  const storeId = req.store._id;
  const dateRange = parseDateRange({ from: req.query.from, to: req.query.to });
  const query = { store: storeId };
  if (dateRange) {
    query.createdAt = dateRange;
  }

  const logs = await ActivityLog.find(query)
    .populate("user", "fullname email username role")
    .sort({ createdAt: -1 })
    .lean();

  if (!(await ensureHasRows(res, logs, req.store, definition.label))) return;

  const columns = [
    { header: "STT", key: "index", width: 6 },
    { header: "Thời gian", key: "date", width: 20 },
    { header: "Người dùng", key: "user", width: 24 },
    { header: "Role", key: "role", width: 12 },
    { header: "Hành động", key: "action", width: 14 },
    { header: "Đối tượng", key: "entity", width: 18 },
    { header: "Tên đối tượng", key: "entityName", width: 24 },
    { header: "Mô tả", key: "description", width: 40 },
    { header: "IP", key: "ip", width: 18 },
  ];

  const { workbook, worksheet } = createWorkbook("Nhật ký hoạt động", columns);

  logs.forEach((log, idx) => {
    const row = worksheet.addRow({
      index: idx + 1,
      date: toDateString(log.createdAt),
      user: log.user?.fullname || log.userName,
      role: log.user?.role || log.userRole,
      action: log.action,
      entity: log.entity,
      entityName: log.entityName,
      description: log.description || "",
      ip: log.ip || "",
    });
    styleDataRow(row);
  });

  await logExport(req, definition, logs.length);
  await sendWorkbook(res, workbook, buildFilename(req.store, definition.key));
};

const EXPORT_DEFINITIONS = {
  products: {
    key: "products",
    label: "Danh sách hàng hóa",
    description: "Danh sách toàn bộ sản phẩm trong cửa hàng",
    entity: "Product",
    filters: [],
    handler: exportProducts,
  },
  customers: {
    key: "customers",
    label: "Khách hàng",
    description: "Thông tin khách hàng và điểm tích lũy",
    entity: "Customer",
    filters: [],
    handler: exportCustomers,
  },
  suppliers: {
    key: "suppliers",
    label: "Nhà cung cấp",
    description: "Danh sách nhà cung cấp",
    entity: "Supplier",
    filters: [],
    handler: exportSuppliers,
  },
  employees: {
    key: "employees",
    label: "Nhân viên",
    description: "Thông tin nhân sự cửa hàng",
    entity: "Employee",
    filters: [],
    handler: exportEmployees,
  },
  orders: {
    key: "orders",
    label: "Đơn hàng",
    description: "Danh sách hóa đơn bán hàng",
    entity: "Order",
    filters: ["date", "status", "paymentMethod"],
    handler: exportOrders,
  },
  purchaseOrders: {
    key: "purchaseOrders",
    label: "Phiếu nhập hàng",
    description: "Các phiếu nhập hàng từ nhà cung cấp",
    entity: "PurchaseOrder",
    filters: ["date"],
    handler: exportPurchaseOrders,
  },
  purchaseReturns: {
    key: "purchaseReturns",
    label: "Phiếu trả hàng",
    description: "Các phiếu trả hàng cho nhà cung cấp",
    entity: "PurchaseReturn",
    filters: ["date"],
    handler: exportPurchaseReturns,
  },
  stockChecks: {
    key: "stockChecks",
    label: "Phiếu kiểm kho",
    description: "Lịch sử kiểm kho",
    entity: "StockCheck",
    filters: ["date"],
    handler: exportStockChecks,
  },
  stockDisposals: {
    key: "stockDisposals",
    label: "Phiếu xuất hủy",
    description: "Các phiếu xuất hủy hàng hóa",
    entity: "StockDisposal",
    filters: ["date"],
    handler: exportStockDisposals,
  },
  activityLogs: {
    key: "activityLogs",
    label: "Nhật ký hoạt động",
    description: "Lịch sử thao tác của người dùng",
    entity: "ActivityLog",
    filters: ["date"],
    handler: exportActivityLogs,
  },
};

const getExportOptions = (req, res) => {
  const options = Object.values(EXPORT_DEFINITIONS).map((definition) => ({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    filters: definition.filters,
  }));

  res.json({
    storeId: req.store?._id,
    options,
  });
};

const exportResource = withExportErrorHandler(async (req, res) => {
  const { resource } = req.params;
  const definition = EXPORT_DEFINITIONS[resource];

  if (!definition) {
    return res.status(400).json({ message: `Resource "${resource}" không được hỗ trợ` });
  }

  await definition.handler(req, res, definition);
});

module.exports = {
  getExportOptions,
  exportResource,
  SUPPORTED_EXPORTS: Object.values(EXPORT_DEFINITIONS).map((definition) => ({
    key: definition.key,
    label: definition.label,
    filters: definition.filters,
  })),
};
