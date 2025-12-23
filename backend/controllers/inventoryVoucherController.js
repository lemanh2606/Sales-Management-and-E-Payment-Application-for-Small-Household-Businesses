const mongoose = require("mongoose");
const InventoryVoucher = require("../models/InventoryVoucher");
const Product = require("../models/Product");
const User = require("../models/User");
const Supplier = require("../models/Supplier");
const { logActivity } = require("../utils/logActivity");

// ================= helpers =================
function toObjectId(v) {
  try {
    if (!v) return null;
    if (v instanceof mongoose.Types.ObjectId) return v;
    if (mongoose.Types.ObjectId.isValid(v))
      return new mongoose.Types.ObjectId(v);
    return null;
  } catch {
    return null;
  }
}

function toNumber(v, def = 0) {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toDecimal128(v) {
  const n = toNumber(v, 0);
  return mongoose.Types.Decimal128.fromString(String(n));
}

function decimal128ToNumber(v) {
  if (!v) return 0;
  try {
    return Number(v.toString());
  } catch {
    return 0;
  }
}

function parseMaybeJson(v) {
  if (v === undefined || v === null) return v;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return v;
  if (
    (s.startsWith("{") && s.endsWith("}")) ||
    (s.startsWith("[") && s.endsWith("]"))
  ) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

function buildVoucherCode(type) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = type === "IN" ? "NK" : "XK";
  return `${prefix}-${y}${m}${d}-${Date.now()}`;
}

async function ensureUser(userId, session) {
  const user = await User.findById(userId).session(session || null);
  if (!user) {
    const err = new Error("Người dùng không tồn tại");
    err.status = 404;
    throw err;
  }
  return user;
}

function requireManager(req) {
  const role = String(req.user?.role || "").toUpperCase();
  if (role !== "MANAGER") {
    const err = new Error("Chỉ MANAGER được thực hiện thao tác này");
    err.status = 403;
    throw err;
  }
}

// Detect field names
function pickCostNumber(productDoc) {
  const v =
    productDoc?.cost_price ??
    productDoc?.costprice ??
    productDoc?.costPrice ??
    0;
  if (typeof v === "object" && v?.toString) return decimal128ToNumber(v);
  return toNumber(v, 0);
}

function detectStockField(productDoc) {
  if (productDoc && productDoc.stock_quantity !== undefined)
    return "stock_quantity";
  return "stockquantity";
}

function getStockNumber(productDoc) {
  const v =
    productDoc?.stock_quantity ??
    productDoc?.stockquantity ??
    productDoc?.stockQuantity ??
    0;
  return toNumber(v, 0);
}

async function loadProductsForItems(storeId, items, session) {
  const productIds = (items || [])
    .map((it) => toObjectId(it.product_id))
    .filter(Boolean);

  const uniqueIds = [...new Set(productIds.map((x) => x.toString()))].map(
    (x) => new mongoose.Types.ObjectId(x)
  );

  const products = await Product.find({
    _id: { $in: uniqueIds },
    store_id: storeId,
    isDeleted: false,
  }).session(session || null);

  return new Map(products.map((p) => [p._id.toString(), p]));
}

async function validateSupplierOrThrow(storeId, supplierId, session) {
  if (!supplierId) return { supplier: null, name: "" };

  const supplier = await Supplier.findOne({
    _id: supplierId,
    store_id: storeId,
    isDeleted: false,
  }).session(session || null);

  if (!supplier) {
    const err = new Error("Nhà cung cấp không hợp lệ");
    err.status = 400;
    throw err;
  }

  return { supplier, name: supplier.name || "" };
}

function sanitizeHeader(bodyRaw) {
  const body = bodyRaw || {};

  const allowed = [
    "type",
    "voucher_code",
    "voucher_date",
    "reason",
    "deliverer_name",
    "receiver_name",
    "attached_docs",

    // chứng từ gốc
    "ref_type",
    "ref_id",
    "ref_no",
    "ref_date",

    // kho
    "warehouse_name",
    "warehouse_location",

    // in ấn / nghiệp vụ cửa hàng nhỏ lẻ
    "document_place",
    "partner_name",
    "partner_phone",
    "partner_address",

    // kế toán (optional)
    "debit_account",
    "credit_account",
    "currency",
    "exchange_rate",

    // supplier header-level
    "supplier_id",

    // xác nhận vai trò (optional)
    "warehouse_keeper_id",
    "accountant_id",
  ];

  const out = {};
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k];
  }

  // numbers
  if (out.attached_docs !== undefined)
    out.attached_docs = toNumber(out.attached_docs, 0);
  if (out.exchange_rate !== undefined)
    out.exchange_rate = toNumber(out.exchange_rate, 1);

  // dates
  if (out.voucher_date !== undefined && out.voucher_date)
    out.voucher_date = new Date(out.voucher_date);
  if (out.ref_date !== undefined)
    out.ref_date = out.ref_date ? new Date(out.ref_date) : null;

  // objectIds
  if (out.ref_id !== undefined && out.ref_id)
    out.ref_id = toObjectId(out.ref_id);
  if (out.supplier_id !== undefined)
    out.supplier_id = out.supplier_id ? toObjectId(out.supplier_id) : null;

  if (out.warehouse_keeper_id !== undefined)
    out.warehouse_keeper_id = out.warehouse_keeper_id
      ? toObjectId(out.warehouse_keeper_id)
      : null;
  if (out.accountant_id !== undefined)
    out.accountant_id = out.accountant_id
      ? toObjectId(out.accountant_id)
      : null;

  // normalize strings
  const strFields = [
    "voucher_code",
    "reason",
    "deliverer_name",
    "receiver_name",
    "warehouse_name",
    "warehouse_location",
    "ref_type",
    "ref_no",
    "document_place",
    "partner_name",
    "partner_phone",
    "partner_address",
    "debit_account",
    "credit_account",
    "currency",
  ];
  for (const f of strFields) {
    if (out[f] !== undefined && out[f] !== null) out[f] = String(out[f]).trim();
  }

  return out;
}

function sanitizeItems(itemsRaw) {
  const items = parseMaybeJson(itemsRaw);
  if (!Array.isArray(items)) return [];

  return items.map((it) => ({
    product_id: it.product_id ? toObjectId(it.product_id) : null,

    supplier_id: it.supplier_id ? toObjectId(it.supplier_id) : null,
    supplier_name_snapshot: String(it.supplier_name_snapshot || "").trim(),

    sku_snapshot: String(it.sku_snapshot || "").trim(),
    name_snapshot: String(it.name_snapshot || "").trim(),
    unit_snapshot: String(it.unit_snapshot || "").trim(),

    batch_no: String(it.batch_no || "").trim(),
    expiry_date: it.expiry_date ? new Date(it.expiry_date) : null,

    qty_document: toNumber(it.qty_document, 0),
    qty_actual: toNumber(it.qty_actual, 0),

    unit_cost:
      it.unit_cost !== undefined ? toDecimal128(it.unit_cost) : undefined,
    note: String(it.note || "").trim(),
  }));
}

function validateItemsOrThrow(rawItems) {
  if (!rawItems.length) {
    const err = new Error("Phiếu phải có ít nhất 1 dòng hàng");
    err.status = 400;
    throw err;
  }

  for (const it of rawItems) {
    if (!it.product_id) {
      const err = new Error("Thiếu product_id trong items");
      err.status = 400;
      throw err;
    }
    if (!Number.isFinite(it.qty_actual) || it.qty_actual < 1) {
      const err = new Error("qty_actual phải >= 1");
      err.status = 400;
      throw err;
    }
    if (it.qty_document !== undefined && it.qty_document < 0) {
      const err = new Error("qty_document phải >= 0");
      err.status = 400;
      throw err;
    }
    if (it.unit_cost !== undefined) {
      const cost = decimal128ToNumber(it.unit_cost);
      if (!Number.isFinite(cost) || cost < 0) {
        const err = new Error("unit_cost phải >= 0");
        err.status = 400;
        throw err;
      }
    }
  }
}

function enforcePostedBusinessRules(doc) {
  if (!doc.warehouse_name || String(doc.warehouse_name).trim() === "") {
    const err = new Error(
      "Thiếu kho (warehouse_name). Vui lòng nhập kho trước khi ghi sổ."
    );
    err.status = 400;
    throw err;
  }

  if (!doc.reason || String(doc.reason).trim() === "") {
    const err = new Error(
      "Thiếu lý do (reason). Vui lòng nhập lý do trước khi ghi sổ."
    );
    err.status = 400;
    throw err;
  }

  if (!doc.deliverer_name || !String(doc.deliverer_name).trim()) {
    const err = new Error("Thiếu người giao (deliverer_name).");
    err.status = 400;
    throw err;
  }

  if (!doc.receiver_name || !String(doc.receiver_name).trim()) {
    const err = new Error("Thiếu người nhận (receiver_name).");
    err.status = 400;
    throw err;
  }

  // Nếu không phải phiếu điều chỉnh nội bộ thì nên có chứng từ gốc
  const refType = String(doc.ref_type || "")
    .trim()
    .toUpperCase();
  const isAdjustment =
    refType === "ADJUSTMENT" ||
    refType === "INTERNAL" ||
    refType === "PRODUCT_UPDATE_STOCK";

  if (!isAdjustment) {
    if (!doc.ref_no || !String(doc.ref_no).trim()) {
      const err = new Error("Thiếu số chứng từ gốc (ref_no).");
      err.status = 400;
      throw err;
    }
    if (!doc.ref_date) {
      const err = new Error("Thiếu ngày chứng từ gốc (ref_date).");
      err.status = 400;
      throw err;
    }
  }
}

// ================= controllers =================

// ============= CREATE (tạo phiếu DRAFT) =============
const createInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    if (!storeId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "storeId không hợp lệ" });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Dữ liệu request body trống" });
    }

    const header = sanitizeHeader(req.body);
    const rawItems = sanitizeItems(req.body.items);

    if (!header.type || !["IN", "OUT"].includes(header.type)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "type phải là IN hoặc OUT" });
    }

    try {
      validateItemsOrThrow(rawItems);
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(e.status || 400).json({ message: e.message });
    }

    // Validate supplier header nếu có
    let supplierNameSnapshot = "";
    try {
      const sup = await validateSupplierOrThrow(
        storeId,
        header.supplier_id,
        session
      );
      supplierNameSnapshot = sup.name || "";
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(e.status || 400).json({ message: e.message });
    }

    const productMap = await loadProductsForItems(storeId, rawItems, session);

    for (const it of rawItems) {
      const p = productMap.get(String(it.product_id));
      if (!p) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          message: `Không tìm thấy sản phẩm ${it.product_id} trong cửa hàng hoặc sản phẩm đã bị xóa`,
        });
      }

      it.sku_snapshot = it.sku_snapshot || p.sku || "";
      it.name_snapshot = it.name_snapshot || p.name || "";
      it.unit_snapshot = it.unit_snapshot || p.unit || "";

      // nếu item chưa có supplier, fallback supplier từ header
      if (!it.supplier_id && header.supplier_id) {
        it.supplier_id = header.supplier_id;
        it.supplier_name_snapshot = supplierNameSnapshot;
      }

      if (it.unit_cost === undefined) {
        it.unit_cost = toDecimal128(pickCostNumber(p));
      }
    }

    const voucherCode = header.voucher_code || buildVoucherCode(header.type);

    const doc = new InventoryVoucher({
      store_id: storeId,

      type: header.type,
      voucher_code: voucherCode,
      voucher_date: header.voucher_date || new Date(),
      status: "DRAFT",

      document_place: header.document_place || "",

      warehouse_name: header.warehouse_name || "",
      warehouse_location: header.warehouse_location || "",

      ref_type: header.ref_type || "",
      ref_id: header.ref_id || null,
      ref_no: header.ref_no || "",
      ref_date: header.ref_date || null,

      reason: header.reason || "",
      deliverer_name: header.deliverer_name || "",
      receiver_name: header.receiver_name || "",
      attached_docs: header.attached_docs || 0,

      partner_name: header.partner_name || "",
      partner_phone: header.partner_phone || "",
      partner_address: header.partner_address || "",

      debit_account: header.debit_account || "",
      credit_account: header.credit_account || "",
      currency: header.currency || "VND",
      exchange_rate: header.exchange_rate || 1,

      created_by: userId,

      supplier_id: header.supplier_id || null,
      supplier_name_snapshot: supplierNameSnapshot,

      warehouse_keeper_id: header.warehouse_keeper_id || null,
      accountant_id: header.accountant_id || null,

      items: rawItems.map((it) => ({
        product_id: it.product_id,

        supplier_id: it.supplier_id || null,
        supplier_name_snapshot: it.supplier_name_snapshot || "",

        sku_snapshot: it.sku_snapshot,
        name_snapshot: it.name_snapshot,
        unit_snapshot: it.unit_snapshot,

        batch_no: it.batch_no || "",
        expiry_date: it.expiry_date || null,

        qty_document: it.qty_document,
        qty_actual: it.qty_actual,
        unit_cost: it.unit_cost,
        note: it.note,
      })),
    });

    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.voucher_code}`,
      req,
      description: `Tạo phiếu kho ${doc.voucher_code} (${doc.type})`,
    });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(201)
      .json({ message: "Tạo phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    // duplicate key voucher_code
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Số phiếu đã tồn tại", error: error.message });
    }

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= GET LIST =============
const getInventoryVouchers = async (req, res) => {
  try {
    const storeId = toObjectId(req.params.storeId);
    const {
      type,
      status,
      from,
      to,
      q,
      page = 1,
      limit = 20,
      sort = "-voucher_date",
    } = req.query;

    if (!storeId)
      return res.status(400).json({ message: "storeId không hợp lệ" });

    const filter = { store_id: storeId };
    if (type && ["IN", "OUT"].includes(type)) filter.type = type;
    if (status && ["DRAFT", "APPROVED", "POSTED", "CANCELLED"].includes(status))
      filter.status = status;

    if (from || to) {
      filter.voucher_date = {};
      if (from) filter.voucher_date.$gte = new Date(from);
      if (to) filter.voucher_date.$lte = new Date(to);
    }

    if (q) {
      const qs = String(q);
      filter.$or = [
        { voucher_code: { $regex: qs, $options: "i" } },
        { reason: { $regex: qs, $options: "i" } },
        { deliverer_name: { $regex: qs, $options: "i" } },
        { receiver_name: { $regex: qs, $options: "i" } },
        { warehouse_name: { $regex: qs, $options: "i" } },
        { ref_no: { $regex: qs, $options: "i" } },
        { partner_name: { $regex: qs, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      InventoryVoucher.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InventoryVoucher.countDocuments(filter),
    ]);

    return res
      .status(200)
      .json({ data: rows, meta: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error.message });
  }
};

const getInventoryVoucherById = async (req, res) => {
  try {
    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);

    if (!storeId || !voucherId) {
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    })
      .populate("created_by", "fullname username")
      .populate("approved_by", "fullname username")
      .populate("posted_by", "fullname username")
      .populate("cancelled_by", "fullname username")
      .populate("warehouse_keeper_id", "fullname username")
      .populate("accountant_id", "fullname username")
      .populate({ path: "items.product_id" })
      .populate({ path: "items.supplier_id", strictPopulate: false });

    if (!doc)
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    return res.status(200).json({ voucher: doc });
  } catch (error) {
    console.error("Lỗi getInventoryVoucherById:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server", error: error?.message });
  }
};

// ============= UPDATE (chỉ DRAFT) =============
const updateInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);
    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }

    if (doc.status !== "DRAFT") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Chỉ được sửa phiếu ở trạng thái DRAFT" });
    }

    const header = sanitizeHeader(req.body);

    // Không cho đổi type / voucher_code sau khi tạo
    if (header.type && header.type !== doc.type) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Không được đổi type sau khi tạo phiếu" });
    }
    if (header.voucher_code && header.voucher_code !== doc.voucher_code) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Không được đổi voucher_code sau khi tạo phiếu" });
    }
    delete header.type;
    delete header.voucher_code;

    const rawItems =
      req.body.items !== undefined ? sanitizeItems(req.body.items) : null;

    // supplier header-level nếu có
    if (header.supplier_id !== undefined) {
      if (header.supplier_id) {
        const sup = await validateSupplierOrThrow(
          storeId,
          header.supplier_id,
          session
        );
        doc.supplier_id = header.supplier_id;
        doc.supplier_name_snapshot = sup.name || "";
      } else {
        doc.supplier_id = null;
        doc.supplier_name_snapshot = "";
      }
      delete header.supplier_id;
    }

    if (rawItems) {
      try {
        validateItemsOrThrow(rawItems);
      } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return res.status(e.status || 400).json({ message: e.message });
      }

      const productMap = await loadProductsForItems(storeId, rawItems, session);

      for (const it of rawItems) {
        const p = productMap.get(String(it.product_id));
        if (!p) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({
            message: `Không tìm thấy sản phẩm ${it.product_id} trong cửa hàng hoặc sản phẩm đã bị xóa`,
          });
        }

        it.sku_snapshot = it.sku_snapshot || p.sku || "";
        it.name_snapshot = it.name_snapshot || p.name || "";
        it.unit_snapshot = it.unit_snapshot || p.unit || "";

        if (!it.supplier_id && doc.supplier_id) {
          it.supplier_id = doc.supplier_id;
          it.supplier_name_snapshot = doc.supplier_name_snapshot || "";
        }

        if (it.unit_cost === undefined)
          it.unit_cost = toDecimal128(pickCostNumber(p));
      }

      doc.items = rawItems.map((it) => ({
        product_id: it.product_id,

        supplier_id: it.supplier_id || null,
        supplier_name_snapshot: it.supplier_name_snapshot || "",

        sku_snapshot: it.sku_snapshot,
        name_snapshot: it.name_snapshot,
        unit_snapshot: it.unit_snapshot,

        batch_no: it.batch_no || "",
        expiry_date: it.expiry_date || null,

        qty_document: it.qty_document,
        qty_actual: it.qty_actual,
        unit_cost: it.unit_cost,
        note: it.note,
      }));
    }

    // apply header fields
    for (const k of Object.keys(header)) doc[k] = header[k];

    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "update",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.voucher_code}`,
      req,
      description: `Cập nhật phiếu kho ${doc.voucher_code} (DRAFT)`,
    });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json({ message: "Cập nhật phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= DELETE (hard delete chỉ cho DRAFT) =============
const deleteInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);
    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }

    if (doc.status !== "DRAFT") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Chỉ được xóa phiếu ở trạng thái DRAFT" });
    }

    await InventoryVoucher.deleteOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "delete",
      entity: "InventoryVoucher",
      entityId: voucherId,
      entityName: `Phiếu kho ${doc.voucher_code}`,
      req,
      description: `Xóa phiếu kho ${doc.voucher_code} (DRAFT)`,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Xóa phiếu kho thành công",
      deletedVoucherId: voucherId,
    });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= APPROVE =============
const approveInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    requireManager(req);

    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);
    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }

    if (doc.status !== "DRAFT") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Chỉ được duyệt phiếu ở trạng thái DRAFT" });
    }

    doc.status = "APPROVED";
    doc.approved_by = userId;
    doc.approved_at = new Date();
    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "approve",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.voucher_code}`,
      req,
      description: `Duyệt phiếu kho ${doc.voucher_code}`,
    });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json({ message: "Duyệt phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= POST (ghi sổ: cập nhật tồn kho) =============
const postInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    requireManager(req);

    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);

    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    // ===== Load voucher (fallback nhiều field store) =====
    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      $or: [{ storeid: storeId }, { storeId: storeId }, { store_id: storeId }],
    }).session(session);

    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Không tìm thấy phiếu kho",
        debug: {
          storeId: String(storeId),
          voucherId: String(voucherId),
        },
      });
    }

    const st = String(doc.status || "")
      .trim()
      .toUpperCase();
    if (st === "POSTED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Phiếu đã POSTED trước đó" });
    }
    if (st === "CANCELLED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Phiếu đã bị hủy" });
    }

    if (!Array.isArray(doc.items) || doc.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Phiếu không có items để ghi sổ" });
    }

    // ===== FIX CHÍNH: BẮT BUỘC KHO KHI POST =====
    if (!doc.warehouse_name || !String(doc.warehouse_name).trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Thiếu kho (warehouse_name). Vui lòng nhập kho trước khi ghi sổ.",
      });
    }

    // ===== Business rules khác =====
    try {
      enforcePostedBusinessRules(doc);
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(e.status || 400).json({ message: e.message });
    }

    // ===== Normalize product id =====
    const itemProductIds = doc.items
      .map((it) => it?.productid || it?.product_id)
      .filter(Boolean);

    if (!itemProductIds.length) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Items không có productid hợp lệ" });
    }

    // ===== Load products =====
    const products = await Product.find({
      _id: { $in: itemProductIds },
      storeid: storeId,
      isDeleted: false,
    }).session(session);

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // ===== Nếu OUT: check tồn kho =====
    if (String(doc.type || "").toUpperCase() === "OUT") {
      for (const it of doc.items) {
        const pid = it?.productid || it?.product_id;
        const p = productMap.get(String(pid));

        if (!p) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({
            message: `Không tìm thấy sản phẩm ${pid} trong cửa hàng hoặc đã bị xóa`,
          });
        }

        const currentQty = Number(p.stockquantity || 0);
        const outQty = Number(it.qtyactual ?? it.qty_actual ?? 0);

        if (!Number.isFinite(outQty) || outQty <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Số lượng xuất không hợp lệ cho sản phẩm ${p.name} (SKU: ${p.sku})`,
          });
        }

        if (currentQty < outQty) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Không đủ tồn kho cho sản phẩm ${p.name} (SKU: ${p.sku}). Tồn: ${currentQty}, xuất: ${outQty}`,
          });
        }
      }
    }

    // ===== bulkWrite cập nhật tồn =====
    const ops = doc.items.map((it) => {
      const pid = it?.productid || it?.product_id;
      const qty = Number(it.qtyactual ?? it.qty_actual ?? 0);
      const delta = String(doc.type || "").toUpperCase() === "IN" ? qty : -qty;

      return {
        updateOne: {
          filter: { _id: pid, storeid: storeId, isDeleted: false },
          update: { $inc: { stockquantity: delta } },
        },
      };
    });

    if (ops.length) {
      await Product.bulkWrite(ops, { session });
    }

    // ===== Update voucher =====
    doc.status = "POSTED";
    doc.postedby = userId;
    doc.postedat = new Date();
    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "post",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.vouchercode || doc.voucher_code || doc._id}`,
      req,
      description: `Ghi sổ phiếu kho ${doc.vouchercode || ""} (${doc.type})`,
    });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json({ message: "POST phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res.status(status).json({
      message: error.message || "Lỗi server",
      error: error.message,
    });
  }
};

// ============= CANCEL (chỉ hủy DRAFT/APPROVED) =============
const cancelInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);
    const { cancel_reason = "" } = req.body || {};

    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }

    if (doc.status === "POSTED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Phiếu đã POSTED, không được CANCEL trực tiếp. Hãy dùng chức năng REVERSE để đảo phiếu.",
      });
    }
    if (doc.status === "CANCELLED") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Phiếu đã bị hủy trước đó" });
    }

    doc.status = "CANCELLED";
    doc.cancelled_by = userId;
    doc.cancelled_at = new Date();
    doc.cancel_reason = String(cancel_reason || "");
    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "cancel",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.voucher_code}`,
      req,
      description: `Hủy phiếu kho ${doc.voucher_code}. Lý do: ${
        doc.cancel_reason || "(không)"
      } `,
    });

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json({ message: "Hủy phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= REVERSE (đảo phiếu POSTED) =============
const reverseInventoryVoucher = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    requireManager(req);

    const userId = req.user?.id || req.user?._id;
    await ensureUser(userId, session);

    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);
    if (!storeId || !voucherId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    const original = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId,
    }).session(session);
    if (!original) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    }

    if (original.status !== "POSTED") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Chỉ được đảo phiếu ở trạng thái POSTED" });
    }

    if (original.reversal_voucher_id) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Phiếu này đã được đảo trước đó" });
    }

    const reversedType = original.type === "IN" ? "OUT" : "IN";
    const voucherCode = buildVoucherCode(reversedType);

    const productMap = await loadProductsForItems(
      storeId,
      original.items,
      session
    );
    const firstProduct = productMap.values().next().value;
    const stockField = detectStockField(firstProduct);

    if (reversedType === "OUT") {
      for (const it of original.items) {
        const p = productMap.get(String(it.product_id));
        if (!p) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({
            message: `Không tìm thấy sản phẩm ${it.product_id} trong cửa hàng hoặc sản phẩm đã bị xóa`,
          });
        }

        const currentQty = getStockNumber(p);
        const outQty = Number(it.qty_actual || 0);

        if (currentQty < outQty) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Không đủ tồn để đảo phiếu cho sản phẩm ${p.name} (SKU: ${p.sku}). Tồn: ${currentQty}, cần xuất: ${outQty}`,
          });
        }
      }
    }

    const reversal = new InventoryVoucher({
      store_id: storeId,

      type: reversedType,
      voucher_code: voucherCode,
      voucher_date: new Date(),
      status: "POSTED",

      document_place: original.document_place || "",

      warehouse_name: original.warehouse_name || "",
      warehouse_location: original.warehouse_location || "",

      ref_type: "REVERSAL",
      ref_id: original._id,
      ref_no: original.ref_no || "",
      ref_date: original.ref_date || null,

      reason: `Đảo phiếu ${original.voucher_code}`,

      deliverer_name: original.deliverer_name || "",
      receiver_name: original.receiver_name || "",

      partner_name: original.partner_name || "",
      partner_phone: original.partner_phone || "",
      partner_address: original.partner_address || "",

      debit_account: original.debit_account || "",
      credit_account: original.credit_account || "",
      currency: original.currency || "VND",
      exchange_rate: Number(original.exchange_rate || 1),

      created_by: userId,
      posted_by: userId,
      posted_at: new Date(),
      reversal_of: original._id,

      supplier_id: original.supplier_id || null,
      supplier_name_snapshot: original.supplier_name_snapshot || "",

      items: (original.items || []).map((it) => ({
        product_id: it.product_id,
        supplier_id: it.supplier_id || original.supplier_id || null,
        supplier_name_snapshot:
          it.supplier_name_snapshot || original.supplier_name_snapshot || "",
        sku_snapshot: it.sku_snapshot,
        name_snapshot: it.name_snapshot,
        unit_snapshot: it.unit_snapshot,
        batch_no: it.batch_no || "",
        expiry_date: it.expiry_date || null,
        qty_document: it.qty_document,
        qty_actual: it.qty_actual,
        unit_cost: it.unit_cost,
        note: `Đảo phiếu ${original.voucher_code}`,
      })),
    });

    await reversal.save({ session });

    const ops = reversal.items.map((it) => {
      const qty = Number(it.qty_actual || 0);
      const delta = reversal.type === "IN" ? qty : -qty;
      return {
        updateOne: {
          filter: { _id: it.product_id, store_id: storeId, isDeleted: false },
          update: { $inc: { [stockField]: delta } },
        },
      };
    });

    if (ops.length) await Product.bulkWrite(ops, { session });

    original.reversal_voucher_id = reversal._id;
    await original.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "reverse",
      entity: "InventoryVoucher",
      entityId: reversal._id,
      entityName: `Phiếu đảo ${reversal.voucher_code}`,
      req,
      description: `Đảo phiếu ${original.voucher_code} -> ${reversal.voucher_code}`,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Đảo phiếu kho thành công",
      originalVoucher: original,
      reversalVoucher: reversal,
    });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res
      .status(status)
      .json({ message: error.message || "Lỗi server", error: error.message });
  }
};

module.exports = {
  createInventoryVoucher,
  getInventoryVouchers,
  getInventoryVoucherById,
  updateInventoryVoucher,
  deleteInventoryVoucher,
  approveInventoryVoucher,
  postInventoryVoucher,
  cancelInventoryVoucher,
  reverseInventoryVoucher,
};
