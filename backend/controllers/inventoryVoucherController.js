const mongoose = require("mongoose");
const InventoryVoucher = require("../models/InventoryVoucher");
const Product = require("../models/Product");
const User = require("../models/User");
const Supplier = require("../models/Supplier");
const Warehouse = require("../models/Warehouse");
const { logActivity } = require("../utils/logActivity");

// ================= helpers =================
function toObjectId(v) {
  try {
    if (!v) return null;
    if (v instanceof mongoose.Types.ObjectId) return v;
    if (mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
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
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
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
  const v = productDoc?.cost_price ?? productDoc?.costprice ?? productDoc?.costPrice ?? 0;
  if (typeof v === "object" && v?.toString) return decimal128ToNumber(v);
  return toNumber(v, 0);
}

function detectStockField(productDoc) {
  if (productDoc && productDoc.stock_quantity !== undefined) return "stock_quantity";
  return "stockquantity";
}

function getStockNumber(productDoc) {
  const v = productDoc?.stock_quantity ?? productDoc?.stockquantity ?? productDoc?.stockQuantity ?? 0;
  return toNumber(v, 0);
}

async function loadProductsForItems(storeId, items, session) {
  const productIds = (items || []).map((it) => toObjectId(it.product_id)).filter(Boolean);

  const uniqueIds = [...new Set(productIds.map((x) => x.toString()))].map((x) => new mongoose.Types.ObjectId(x));

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
    "deliverer_phone",
    "receiver_phone",
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
  if (out.attached_docs !== undefined) out.attached_docs = toNumber(out.attached_docs, 0);
  if (out.exchange_rate !== undefined) out.exchange_rate = toNumber(out.exchange_rate, 1);

  // dates
  if (out.voucher_date !== undefined && out.voucher_date) out.voucher_date = new Date(out.voucher_date);
  if (out.ref_date !== undefined) out.ref_date = out.ref_date ? new Date(out.ref_date) : null;

  // objectIds
  if (out.ref_id !== undefined && out.ref_id) out.ref_id = toObjectId(out.ref_id);
  if (out.supplier_id !== undefined) out.supplier_id = out.supplier_id ? toObjectId(out.supplier_id) : null;

  if (out.warehouse_keeper_id !== undefined) out.warehouse_keeper_id = out.warehouse_keeper_id ? toObjectId(out.warehouse_keeper_id) : null;
  if (out.accountant_id !== undefined) out.accountant_id = out.accountant_id ? toObjectId(out.accountant_id) : null;

  // normalize strings
  const strFields = [
    "voucher_code",
    "reason",
    "deliverer_name",
    "receiver_name",
    "deliverer_phone",
    "receiver_phone",
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

    unit_cost: it.unit_cost !== undefined ? toDecimal128(it.unit_cost) : undefined,
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
    const err = new Error("Thiếu kho (warehouse_name). Vui lòng nhập kho trước khi ghi sổ.");
    err.status = 400;
    throw err;
  }

  if (!doc.reason || String(doc.reason).trim() === "") {
    const err = new Error("Thiếu lý do (reason). Vui lòng nhập lý do trước khi ghi sổ.");
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
  const isAdjustment = refType === "ADJUSTMENT" || refType === "INTERNAL" || refType === "PRODUCT_UPDATE_STOCK";

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

    // ===== VALIDATE storeId =====
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      throw new Error("storeId không hợp lệ");
    }
    const storeId = new mongoose.Types.ObjectId(req.params.storeId);

    // ===== VALIDATE BODY =====
    if (!req.body || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      throw new Error("Phiếu kho phải có items");
    }

    const header = req.body;
    const rawItems = req.body.items;

    // ===== RESOLVE WAREHOUSE =====
    let warehouse = null;
    if (header.warehouse_id) {
      if (!mongoose.isValidObjectId(header.warehouse_id)) {
        throw new Error("warehouse_id không hợp lệ");
      }

      warehouse = await Warehouse.findOne({
        _id: new mongoose.Types.ObjectId(header.warehouse_id),
        store_id: storeId,
        isDeleted: false,
      }).lean();

      if (!warehouse) {
        throw new Error("Kho không tồn tại hoặc không thuộc cửa hàng");
      }
    }

    // ===== RESOLVE SUPPLIER (HEADER) =====
    let supplier = null;
    if (header.supplier_id) {
      if (!mongoose.isValidObjectId(header.supplier_id)) {
        throw new Error("supplier_id không hợp lệ");
      }

      supplier = await Supplier.findOne({
        _id: new mongoose.Types.ObjectId(header.supplier_id),
        store_id: storeId,
        isDeleted: false,
      }).lean();

      if (!supplier) {
        throw new Error("Nhà cung cấp không tồn tại");
      }
    }

    // ===== LOAD PRODUCTS =====
    const productIds = rawItems.map((i) => {
      if (!mongoose.isValidObjectId(i.product_id)) {
        throw new Error("product_id không hợp lệ");
      }
      return new mongoose.Types.ObjectId(i.product_id);
    });

    const products = await Product.find({
      _id: { $in: productIds },
      store_id: storeId,
      isDeleted: false,
    }).lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // ===== BUILD ITEMS =====
    const items = rawItems.map((it) => {
      const p = productMap.get(String(it.product_id));
      if (!p) throw new Error(`Sản phẩm ${it.product_id} không tồn tại`);

      // Parse expiry_date properly
      let expiryDate = null;
      if (it.expiry_date && it.expiry_date !== "") {
        const parsed = new Date(it.expiry_date);
        if (!isNaN(parsed.getTime())) {
          expiryDate = parsed;
        }
      }

      return {
        product_id: p._id,

        supplier_id: it.supplier_id ? new mongoose.Types.ObjectId(it.supplier_id) : supplier?._id || null,

        supplier_name_snapshot: it.supplier_name_snapshot || supplier?.name || "",

        sku_snapshot: p.sku || "",
        name_snapshot: p.name || "",
        unit_snapshot: p.unit || "",

        warehouse_id: warehouse?._id || null,
        warehouse_name: warehouse?.name || "",

        qty_document: Number(it.qty_document || it.qty_actual || 0),
        qty_actual: Number(it.qty_actual),

        unit_cost: it.unit_cost,
        selling_price: it.selling_price || 0,
        batch_no: it.batch_no || "",
        expiry_date: expiryDate,
        note: it.note || "",
      };
    });

    // ===== CREATE VOUCHER =====
    const voucher = new InventoryVoucher({
      store_id: storeId,
      type: header.type || "IN",
      status: "DRAFT",

      voucher_code: header.voucher_code || `NK-${Date.now()}`,
      voucher_date: header.voucher_date ? new Date(header.voucher_date) : new Date(),
      reason: header.reason || "",
      document_place: header.document_place || "",

      warehouse_id: warehouse?._id || null,
      warehouse_name: header.warehouse_name || warehouse?.name || "",
      warehouse_location: header.warehouse_location || warehouse?.full_address || warehouse?.address || "",

      supplier_id: supplier?._id || null,
      supplier_name_snapshot: header.supplier_name_snapshot || supplier?.name || "",

      partner_name: header.partner_name || supplier?.name || "",
      partner_phone: header.partner_phone || supplier?.phone || "",
      partner_address: header.partner_address || supplier?.address || "",

      deliverer_name: header.deliverer_name || supplier?.contact_person || "",
      receiver_name: header.receiver_name || req.user?.fullname || req.user?.username || "",
      deliverer_phone: header.deliverer_phone || supplier?.phone || "",
      receiver_phone: header.receiver_phone || "",

      ref_type: header.ref_type || "PRODUCT_IMPORT",
      ref_no: header.ref_no || "",
      ref_date: header.ref_date ? new Date(header.ref_date) : null,

      created_by: userId,
      items,
    });

    await voucher.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Tạo phiếu kho thành công",
      voucher,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({
      message: error.message || "Lỗi tạo phiếu kho",
    });
  }
};

// ============= GET LIST =============
const getInventoryVouchers = async (req, res) => {
  try {
    const storeId = toObjectId(req.params.storeId);
    const { type, status, from, to, q, page = 1, limit = 20, sort = "-voucher_date", supplier_id } = req.query;

    if (!storeId) return res.status(400).json({ message: "storeId không hợp lệ" });

    const filter = { store_id: storeId };
    if (type && ["IN", "OUT", "RETURN"].includes(type)) filter.type = type;
    if (status && ["DRAFT", "APPROVED", "POSTED", "CANCELLED"].includes(status)) filter.status = status;
    if (supplier_id) filter.supplier_id = toObjectId(supplier_id);

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
        .populate("created_by", "fullname username")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      InventoryVoucher.countDocuments(filter),
    ]);

    return res.status(200).json({ data: rows, meta: { page: pageNum, limit: limitNum, total } });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getInventoryVoucherById = async (req, res) => {
  try {
    const storeId = toObjectId(req.params.storeId);
    const voucherId = toObjectId(req.params.voucherId);

    if (!storeId || !voucherId) {
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
      .populate("supplier_id")
      .populate({ path: "items.product_id" })
      .populate({ path: "items.supplier_id", strictPopulate: false });

    if (!doc) return res.status(404).json({ message: "Không tìm thấy phiếu kho" });
    return res.status(200).json({ voucher: doc });
  } catch (error) {
    console.error("Lỗi getInventoryVoucherById:", error);
    return res.status(500).json({ message: "Lỗi server", error: error?.message });
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
      return res.status(400).json({ message: "Chỉ được sửa phiếu ở trạng thái DRAFT" });
    }

    const header = sanitizeHeader(req.body);

    // Không cho đổi type / voucher_code sau khi tạo
    if (header.type && header.type !== doc.type) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Không được đổi type sau khi tạo phiếu" });
    }
    if (header.voucher_code && header.voucher_code !== doc.voucher_code) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Không được đổi voucher_code sau khi tạo phiếu" });
    }
    delete header.type;
    delete header.voucher_code;

    const rawItems = req.body.items !== undefined ? sanitizeItems(req.body.items) : null;

    // warehouse header-level nếu có (đã sanitized ID)
    if (header.warehouse_id !== undefined) {
      if (header.warehouse_id) {
        if (!mongoose.isValidObjectId(header.warehouse_id)) {
           await session.abortTransaction();
           session.endSession();
           return res.status(400).json({ message: "warehouse_id không hợp lệ" });
        }
        const wh = await Warehouse.findOne({
          _id: new mongoose.Types.ObjectId(header.warehouse_id),
          store_id: storeId,
          isDeleted: false,
        }).session(session).lean();
        
        if (!wh) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: "Kho không tồn tại" });
        }
        
        doc.warehouse_id = header.warehouse_id;
        // Priority: Client Override > DB Master > Existing
        doc.warehouse_name = header.warehouse_name || wh.name || "";
        doc.warehouse_location = header.warehouse_location || wh.address || wh.full_address || "";
      } else {
        doc.warehouse_id = null;
        doc.warehouse_name = header.warehouse_name || "";
        doc.warehouse_location = header.warehouse_location || "";
      }
      delete header.warehouse_id;
      delete header.warehouse_name; 
      delete header.warehouse_location; 
    } else {
       // Nếu client chỉ gửi warehouse_location string (sửa tay) mà không đổi ID
       if (header.warehouse_location !== undefined) {
          doc.warehouse_location = header.warehouse_location;
          delete header.warehouse_location;
       }
       if (header.warehouse_name !== undefined) {
          doc.warehouse_name = header.warehouse_name;
          delete header.warehouse_name;
       }
    }

    // supplier header-level nếu có (đã sanitized ID)
    if (header.supplier_id !== undefined) {
      if (header.supplier_id) {
        const sup = await validateSupplierOrThrow(storeId, header.supplier_id, session);
        doc.supplier_id = header.supplier_id;
        // Priority: Client Override > DB Master > Existing
        doc.supplier_name_snapshot = header.supplier_name_snapshot || sup.name || "";
        doc.partner_name = header.partner_name || sup.supplier?.name || "";
        doc.partner_phone = header.partner_phone || sup.supplier?.phone || "";
        doc.partner_address = header.partner_address || sup.supplier?.address || "";
      } else {
        doc.supplier_id = null;
        doc.supplier_name_snapshot = header.supplier_name_snapshot || "";
        doc.partner_name = header.partner_name || "";
        doc.partner_phone = header.partner_phone || "";
        doc.partner_address = header.partner_address || "";
      }
      delete header.supplier_id;
      // remove used fields from header so they don't overwrite again in the final loop (though harmless if logic is correct)
      delete header.supplier_name_snapshot;
      delete header.partner_name;
      delete header.partner_phone;
      delete header.partner_address;
    } else {
      // Allow manual edits to these fields even if supplier_id didn't change (or is null)
      if (header.supplier_name_snapshot !== undefined) doc.supplier_name_snapshot = header.supplier_name_snapshot;
      if (header.partner_name !== undefined) doc.partner_name = header.partner_name;
      if (header.partner_phone !== undefined) doc.partner_phone = header.partner_phone;
      if (header.partner_address !== undefined) doc.partner_address = header.partner_address;

      delete header.supplier_name_snapshot;
      delete header.partner_name;
      delete header.partner_phone;
      delete header.partner_address;
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

        if (it.unit_cost === undefined) it.unit_cost = toDecimal128(pickCostNumber(p));
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
        selling_price: it.selling_price || 0,
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

    return res.status(200).json({ message: "Cập nhật phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Lỗi server", error: error.message });
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
      return res.status(400).json({ message: "Chỉ được xóa phiếu ở trạng thái DRAFT" });
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
    return res.status(status).json({ message: error.message || "Lỗi server", error: error.message });
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
      return res.status(400).json({ message: "Chỉ được duyệt phiếu ở trạng thái DRAFT" });
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

    return res.status(200).json({ message: "Duyệt phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Lỗi server", error: error.message });
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
    }

    // ===== Load voucher =====
    const doc = await InventoryVoucher.findOne({
      _id: voucherId,
      store_id: storeId, // ✅ FIX: dùng đúng field schema
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
      return res.status(400).json({ message: "Phiếu không có items để ghi sổ" });
    }

    // ===== BẮT BUỘC CÓ KHO =====
    if (!doc.warehouse_name || !String(doc.warehouse_name).trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Thiếu kho (warehouse_name). Vui lòng nhập kho trước khi ghi sổ.",
      });
    }

    // ===== Business rules =====
    try {
      enforcePostedBusinessRules(doc);
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(e.status || 400).json({ message: e.message });
    }

    // ===== Normalize product ids =====
    const itemProductIds = doc.items.map((it) => it?.product_id).filter(Boolean);

    if (!itemProductIds.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Items không có product_id hợp lệ" });
    }

    // ===== Load products =====
    const products = await Product.find({
      _id: { $in: itemProductIds },
      store_id: storeId, // ✅ FIX
      isDeleted: false,
    }).session(session);

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // ===== Nếu OUT: check tồn kho khả dụng (không tính hàng hết hạn) =====
    if (String(doc.type || "").toUpperCase() === "OUT") {
      for (const it of doc.items) {
        const pid = it.product_id;
        const p = productMap.get(String(pid));

        if (!p) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({
            message: `Không tìm thấy sản phẩm ${pid} trong cửa hàng`,
          });
        }

        const qtyToExport = Number(it.qty_actual || 0);
        if (!Number.isFinite(qtyToExport) || qtyToExport <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Số lượng xuất không hợp lệ cho sản phẩm ${p.name}`,
          });
        }

        // Tính tồn kho khả dụng (batches không hết hạn)
        const availableQty = (p.batches || []).reduce((sum, b) => {
          const isExpired = b.expiry_date && new Date(b.expiry_date) < new Date();
          return isExpired ? sum : sum + (b.quantity || 0);
        }, 0);

        if (availableQty < qtyToExport) {
          const totalQty = Number(p.stock_quantity || 0);
          const expiredQty = totalQty - availableQty;
          
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Sản phẩm "${p.name}" không đủ tồn kho khả dụng để xuất. ` + 
                     `Tổng tồn: ${totalQty}, Hết hạn: ${expiredQty}, Khả dụng: ${availableQty}. ` +
                     `Cần xuất: ${qtyToExport}.`,
          });
        }
      }
    }

    // ===== Business logic: Update stock and batches =====
    for (const it of doc.items) {
      const qty = Number(it.qty_actual || 0);
      const isIN = String(doc.type).toUpperCase() === "IN";
      const delta = isIN ? qty : -qty;

      const product = productMap.get(String(it.product_id));
      if (!product) continue;

      // Update total stock
      product.stock_quantity = (Number(product.stock_quantity) || 0) + delta;

      if (isIN) {
        // Add new batch or increment if same batch_no and expiry_date already exists in same warehouse
        const existingBatch = product.batches.find(b => 
          b.batch_no === (it.batch_no || "") && 
          (it.expiry_date ? new Date(b.expiry_date).getTime() === new Date(it.expiry_date).getTime() : !b.expiry_date) &&
          String(b.warehouse_id || "") === String(it.warehouse_id || doc.warehouse_id || "")
        );

        if (existingBatch) {
          existingBatch.quantity += qty;
        } else {
          product.batches.push({
            batch_no: it.batch_no || `BATCH-${Date.now()}`,
            expiry_date: it.expiry_date || null,
            cost_price: it.unit_cost ? Number(it.unit_cost.toString()) : 0,
            quantity: qty,
            warehouse_id: it.warehouse_id || doc.warehouse_id,
            created_at: new Date()
          });
        }
      } else {
        // OUT or RETURN: Deduct from batches
        let remainingToDeduct = qty;

        // 1. Nếu có chỉ định lô (batch_no), ưu tiên trừ từ lô đó trước
        if (it.batch_no) {
          const warehouseIdStr = String(it.warehouse_id || doc.warehouse_id || "");
          const targetBatchIndex = product.batches.findIndex(b => 
            b.batch_no === it.batch_no && 
            String(b.warehouse_id || "") === warehouseIdStr &&
            b.quantity > 0
          );

          if (targetBatchIndex !== -1) {
            const b = product.batches[targetBatchIndex];
            const deduct = Math.min(b.quantity, remainingToDeduct);
            b.quantity -= deduct;
            remainingToDeduct -= deduct;
          }
        }

        // 2. Nếu vẫn còn cần trừ (hoặc không chỉ định lô), dùng FIFO
        if (remainingToDeduct > 0) {
          // Sort batches by expiry date (earliest first) then by created_at
          product.batches.sort((a, b) => {
            if (!a.expiry_date && b.expiry_date) return 1;
            if (a.expiry_date && !b.expiry_date) return -1;
            if (a.expiry_date && b.expiry_date) {
              return new Date(a.expiry_date) - new Date(b.expiry_date);
            }
            return new Date(a.created_at) - new Date(b.created_at);
          });

          for (const batch of product.batches) {
            if (remainingToDeduct <= 0) break;
            if (batch.quantity <= 0) continue;

            // Kiểm tra hạn sử dụng: Bỏ qua lô hết hạn khi xuất kho (OUT) thông thường
            if (batch.expiry_date && new Date(batch.expiry_date) < new Date()) {
                continue;
            }
            
            if (batch.quantity >= remainingToDeduct) {
              batch.quantity -= remainingToDeduct;
              remainingToDeduct = 0;
            } else {
              remainingToDeduct -= batch.quantity;
              batch.quantity = 0;
            }
          }
        }
        
        if (remainingToDeduct > 0) {
            // Trường hợp này lẽ ra đã được catch ở check tồn kho tổng phía trên, 
            // nhưng để an toàn double check ở đây.
            // Có thể throw error hoặc log warning.
        }
        
        // Remove empty batches? Some systems keep them for history, but here we can keep them or remove.
        // Let's keep them for now but maybe filter them out in UI.
      }

      await product.save({ session });
    }

    // ===== Update voucher =====
    doc.status = "POSTED";
    doc.posted_by = userId; // ✅ FIX đúng field schema
    doc.posted_at = new Date();
    await doc.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "post",
      entity: "InventoryVoucher",
      entityId: doc._id,
      entityName: `Phiếu kho ${doc.voucher_code || doc._id}`,
      req,
      description: `Ghi sổ phiếu kho ${doc.voucher_code} (${doc.type})`,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "POST phiếu kho thành công",
      voucher: doc,
    });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    return res.status(error.status || 500).json({
      message: error.message || "Lỗi server",
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
        message: "Phiếu đã POSTED, không được CANCEL trực tiếp. Hãy dùng chức năng REVERSE để đảo phiếu.",
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
      description: `Hủy phiếu kho ${doc.voucher_code}. Lý do: ${doc.cancel_reason || "(không)"} `,
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ message: "Hủy phiếu kho thành công", voucher: doc });
  } catch (error) {
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (_) {}

    const status = error.status || 500;
    return res.status(status).json({ message: error.message || "Lỗi server", error: error.message });
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
      return res.status(400).json({ message: "storeId hoặc voucherId không hợp lệ" });
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
      return res.status(400).json({ message: "Chỉ được đảo phiếu ở trạng thái POSTED" });
    }

    if (original.reversal_voucher_id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Phiếu này đã được đảo trước đó" });
    }

    const reversedType = original.type === "IN" ? "OUT" : "IN";
    const voucherCode = buildVoucherCode(reversedType);

    const productMap = await loadProductsForItems(storeId, original.items, session);
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
        supplier_name_snapshot: it.supplier_name_snapshot || original.supplier_name_snapshot || "",
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

    // Update product stock & batches
    for (const it of reversal.items) {
      const product = await Product.findOne({ _id: it.product_id, store_id: storeId, isDeleted: false }).session(session);
      if (!product) continue;

      const qty = Number(it.qty_actual || 0);
      const isIncoming = reversal.type === "IN";
      const warehouseId = original.warehouse_id;

      if (isIncoming) {
        // Increment stock
        product.stock_quantity = (product.stock_quantity || 0) + qty;
        
        // Find existing batch or create new
        const batchNo = it.batch_no || `BATCH-${Date.now()}`;
        const expiryDate = it.expiry_date;
        const exists = (product.batches || []).find(b => 
          b.batch_no === batchNo && 
          String(b.warehouse_id) === String(warehouseId) &&
          (expiryDate ? new Date(b.expiry_date).getTime() === new Date(expiryDate).getTime() : !b.expiry_date)
        );

        if (exists) {
          exists.quantity += qty;
        } else {
          product.batches.push({
            batch_no: batchNo,
            expiry_date: expiryDate,
            cost_price: Number(it.unit_cost?.toString() || 0),
            quantity: qty,
            warehouse_id: warehouseId,
            created_at: new Date()
          });
        }
      } else {
        // Decrement stock
        product.stock_quantity = Math.max(0, (product.stock_quantity || 0) - qty);

        // FIFO-like deduction from batches
        let remaining = qty;
        const sortedBatches = (product.batches || []).sort((a, b) => {
          if (a.expiry_date && b.expiry_date) return new Date(a.expiry_date) - new Date(b.expiry_date);
          if (a.expiry_date) return -1;
          if (b.expiry_date) return 1;
          return new Date(a.created_at) - new Date(b.created_at);
        });

        for (const b of sortedBatches) {
          if (remaining <= 0) break;
          if (String(b.warehouse_id) !== String(warehouseId)) continue;

          if (b.quantity >= remaining) {
            b.quantity -= remaining;
            remaining = 0;
          } else {
            remaining -= b.quantity;
            b.quantity = 0;
          }
        }
      }

      await product.save({ session });
    }

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
    return res.status(status).json({ message: error.message || "Lỗi server", error: error.message });
  }
};

// ============= PROCESS EXPIRED GOODS (Hủy hoặc Trả hàng hết hạn) =============
/**
 * Nghiệp vụ xử lý hàng hết hạn:
 * 1. Hủy hàng (DISPOSE): Xuất kho tiêu hủy, tính vào chi phí.
 * 2. Trả hàng (RETURN): Xuất trả nhà cung cấp.
 */
const processExpiredGoods = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    requireManager(req);
    const userId = req.user?.id || req.user?._id;
    const storeId = toObjectId(req.params.storeId);
    
    const { 
      mode = "DISPOSE", // DISPOSE | RETURN
      items = [], 
      warehouse_id,
      notes = "",
      partner_name = "",
      supplier_id, // Accept supplier_id
      deliverer_name = "",
      receiver_name = ""
    } = req.body;

    if (!items.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Danh sách xử lý trống" });
    }

    // 1. Resolve Warehouse
    let warehouse = null;
    if (warehouse_id) {
      warehouse = await Warehouse.findOne({ _id: toObjectId(warehouse_id), store_id: storeId, isDeleted: false }).session(session);
    }

    // 2. Load and Validate Products/Batches
    const productIds = items.map(it => toObjectId(it.product_id));
    const products = await Product.find({ _id: { $in: productIds }, store_id: storeId, isDeleted: false }).session(session);
    const productMap = new Map(products.map(p => [String(p._id), p]));

    const voucherItems = [];
    const now = new Date();

    for (const it of items) {
      const p = productMap.get(String(it.product_id));
      if (!p) throw new Error(`Sản phẩm ${it.product_id} không tồn tại`);

      const batch = (p.batches || []).find(b => 
        b.batch_no === it.batch_no && 
        (!warehouse_id || String(b.warehouse_id) === String(warehouse_id))
      );

      if (!batch) throw new Error(`Không tìm thấy lô ${it.batch_no} của sản phẩm ${p.name}`);
      
      const qtyToProcess = Number(it.quantity);
      if (batch.quantity < qtyToProcess) {
        throw new Error(`Số lượng tồn trong lô ${it.batch_no} (${batch.quantity}) không đủ để xử lý (${qtyToProcess})`);
      }

      // Update Batch & Total Stock
      batch.quantity -= qtyToProcess;
      p.stock_quantity = (p.stock_quantity || 0) - qtyToProcess;
      await p.save({ session });

      voucherItems.push({
        product_id: p._id,
        sku_snapshot: p.sku || "",
        name_snapshot: p.name || "",
        unit_snapshot: p.unit || "",
        batch_no: it.batch_no,
        expiry_date: batch.expiry_date,
        qty_actual: qtyToProcess,
        unit_cost: toDecimal128(batch.cost_price || 0),
        note: it.note || notes || (mode === "DISPOSE" ? "Hủy hàng hết hạn" : "Trả hàng hết hạn")
      });
    }

    // 3. Create Inventory Voucher (Automatic Posted)
    const reason = mode === "DISPOSE" ? `Tiêu hủy hàng hết hạn theo quy định. ${notes}` : `Xuất trả hàng hết hạn cho nhà cung cấp/đối tác. ${notes}`;
    const voucher_code = `XH-${Date.now()}`;

    const voucher = new InventoryVoucher({
      store_id: storeId,
      type: "OUT",
      status: "POSTED", // Auto-posted because stock is already adjusted above
      voucher_code,
      voucher_date: now,
      reason,
      warehouse_id: warehouse?._id || null,
      warehouse_name: warehouse?.name || "Kho tổng",
      ref_type: mode === "DISPOSE" ? "EXPIRY_DISPOSAL" : "EXPIRY_RETURN",
      items: voucherItems,
      created_by: userId,
      posted_by: userId,
      posted_at: now,
      partner_name: partner_name || (mode === "RETURN" ? "Nhà cung cấp" : ""),
      supplier_id: supplier_id || null, // Create link to Supplier
      deliverer_name: deliverer_name || req.user?.fullname || "",
      receiver_name: receiver_name || "Hội đồng tiêu hủy/Đối tác"
    });

    await voucher.save({ session });

    await logActivity?.({
      user: req.user,
      store: { _id: storeId },
      action: "post",
      entity: "InventoryVoucher",
      entityId: voucher._id,
      entityName: `Phiếu xuất hủy ${voucher_code}`,
      req,
      description: `${reason}. Tổng số mặt hàng: ${voucherItems.length}`
    });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: mode === "DISPOSE" ? "Xử lý tiêu hủy thành công" : "Xử lý trả hàng thành công",
      voucher
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ message: error.message || "Lỗi xử lý hàng hết hạn" });
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
  processExpiredGoods,
};
