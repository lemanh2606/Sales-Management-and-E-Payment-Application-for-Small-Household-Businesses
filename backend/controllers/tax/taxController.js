// controllers/tax/taxController.js - ✅ BẢN ĐẦY ĐỦ VỚI ERROR HANDLING & LOGGING
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Order = require("../../models/Order");
const Store = require("../../models/Store");
const TaxDeclaration = require("../../models/TaxDeclaration");
const logActivity = require("../../utils/logActivity");
const { periodToRange } = require("../../utils/period");
const { Parser } = require("json2csv");
const path = require("path");
const fs = require("fs");

// ==================== HELPER FUNCTIONS ====================

const parseDecimal = (v) =>
  mongoose.Types.Decimal128.fromString(Number(v || 0).toFixed(2));

const decimalToString = (d) => (d ? d.toString() : "0.00");

function isManagerUser(user) {
  if (!user) return false;
  if (user.isManager) return true;
  if (typeof user.role === "string" && user.role.toLowerCase() === "manager")
    return true;
  if (Array.isArray(user.roles) && user.roles.includes("manager")) return true;
  return false;
}

// ✅ VALIDATION HELPER
function validateRequiredFields(data, requiredFields) {
  const missing = [];
  const invalid = [];

  requiredFields.forEach(({ field, type, message }) => {
    const value = data[field];

    if (value === undefined || value === null || value === "") {
      missing.push({ field, message: message || `Thiếu trường ${field}` });
      return;
    }

    // Type validation
    if (type === "number" && (isNaN(value) || Number(value) < 0)) {
      invalid.push({ field, message: `${field} phải là số dương` });
    }
    if (type === "string" && typeof value !== "string") {
      invalid.push({ field, message: `${field} phải là chuỗi` });
    }
    if (type === "objectId" && !mongoose.Types.ObjectId.isValid(value)) {
      invalid.push({ field, message: `${field} không phải ObjectId hợp lệ` });
    }
  });

  return {
    missing,
    invalid,
    isValid: missing.length === 0 && invalid.length === 0,
  };
}

// ✅ STANDARDIZED ERROR RESPONSE
function errorResponse(res, status, message, details = {}) {
  console.error(`❌ [${status}] ${message}`, JSON.stringify(details, null, 2));
  return res.status(status).json({
    success: false,
    message,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// ✅ STANDARDIZED SUCCESS RESPONSE
function successResponse(res, message, data = {}, status = 200) {
  console.log(`✅ [${status}] ${message}`);
  return res.status(status).json({
    success: true,
    message,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

// ✅ Lấy thông tin người nộp thuế từ Store
async function getTaxpayerInfo(storeId) {
  try {
    const store = await Store.findOne({ _id: storeId, deleted: false })
      .populate(
        "owner_id",
        "_id name fullName email dateOfBirth nationality idCard passport"
      )
      .populate("staff_ids", "_id name email")
      .lean();

    if (!store) {
      console.warn(`⚠️ Store not found: ${storeId}`);
      return {};
    }

    const owner = store.owner_id || {};

    return {
      name: owner.fullName || owner.name || store.owner_name || "",
      storeName: store.name || "",
      bankAccount: store.bankAccount || "",
      taxCode: store.taxCode || "",
      businessSector: store.businessSector || store.tags?.join(", ") || "",
      businessSectorChanged: store.businessSectorChanged || false,
      businessArea: store.area || 0,
      isRented: store.isRented || false,
      employeeCount: store.staff_ids?.length || 0,
      workingHours: {
        from: store.openingHours?.open || "08:00",
        to: store.openingHours?.close || "22:00",
      },
      businessAddress: {
        full: store.address || "",
        street: store.addressDetails?.street || "",
        ward: store.addressDetails?.ward || "",
        district: store.addressDetails?.district || "",
        province: store.addressDetails?.province || "",
        borderMarket: store.addressDetails?.borderMarket || false,
        changed: store.businessAddressChanged || false,
      },
      residenceAddress: {
        full: store.ownerResidence?.full || "",
        street: store.ownerResidence?.street || "",
        ward: store.ownerResidence?.ward || "",
        district: store.ownerResidence?.district || "",
        province: store.ownerResidence?.province || "",
      },
      phone: store.phone || "",
      fax: store.fax || "",
      email: store.email || "",
      taxAuthorizationDoc: store.taxAuthorizationDoc || null,
      personalInfo: {
        dateOfBirth: owner.dateOfBirth || null,
        nationality: owner.nationality || "Việt Nam",
        idCard: {
          number: owner.idCard?.number || "",
          issueDate: owner.idCard?.issueDate || null,
          issuePlace: owner.idCard?.issuePlace || "",
        },
        passport: {
          number: owner.passport?.number || "",
          issueDate: owner.passport?.issueDate || null,
          issuePlace: owner.passport?.issuePlace || "",
        },
        borderPass: owner.borderPass || null,
        borderIdCard: owner.borderIdCard || null,
        otherIdDoc: owner.otherIdDoc || null,
        permanentResidence: owner.permanentResidence || {},
        currentResidence: owner.currentResidence || {},
        businessRegistration: {
          number: store.businessRegistrationNumber || "",
          issueDate: store.businessRegistrationDate || null,
          issueAuthority: store.businessRegistrationAuthority || "",
        },
        capital: store.registeredCapital || 0,
      },
      taxAgent: {
        name: store.taxAgent?.name || "",
        taxCode: store.taxAgent?.taxCode || "",
        contractNumber: store.taxAgent?.contractNumber || "",
        contractDate: store.taxAgent?.contractDate || null,
      },
      substituteOrg: {
        name: store.substituteOrg?.name || "",
        taxCode: store.substituteOrg?.taxCode || "",
        address: store.substituteOrg?.address || "",
        phone: store.substituteOrg?.phone || "",
        fax: store.substituteOrg?.fax || "",
        email: store.substituteOrg?.email || "",
      },
    };
  } catch (err) {
    console.error("❌ getTaxpayerInfo error:", err);
    return {};
  }
}

function getCategoryName(code) {
  const map = {
    goods_distribution: "Phân phối, cung cấp hàng hóa",
    service_construction: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu",
    manufacturing_transport:
      "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu nguyên vật liệu",
    other_business: "Hoạt động kinh doanh khác",
  };
  return map[code] || code;
}

function getCategoryCode(code) {
  const map = {
    goods_distribution: "[28]",
    service_construction: "[29]",
    manufacturing_transport: "[30]",
    other_business: "[31]",
  };
  return map[code] || "";
}

function formatTaxPeriod(periodType, periodKey) {
  switch (periodType) {
    case "yearly":
    case "year":
      return `[01a] Năm ${periodKey}`;
    case "monthly":
    case "month":
      const [year, month] = periodKey.split("-");
      return `[01b] Tháng ${month} năm ${year}`;
    case "quarterly":
    case "quarter":
      const [qYear, quarter] = periodKey.split("-Q");
      const qMonthStart = (quarter - 1) * 3 + 1;
      const qMonthEnd = quarter * 3;
      return `[01c] Quý ${quarter} năm ${qYear} (Từ tháng ${qMonthStart}/${qYear} Đến tháng ${qMonthEnd}/${qYear})`;
    case "custom":
      if (periodKey.includes("_")) {
        const [from, to] = periodKey.split("_");
        return `[01a] Năm (từ tháng ${from} đến tháng ${to})`;
      }
      return `[01d] Lần phát sinh: ${periodKey}`;
    default:
      return periodKey;
  }
}

// ==================== CONTROLLERS ====================

/**
 * 1. PREVIEW SYSTEM REVENUE
 * GET /api/taxs/preview?periodType=...&periodKey=...&storeId=...
 */
const previewSystemRevenue = async (req, res) => {
  console.log("\n📋 === PREVIEW SYSTEM REVENUE ===");
  console.log("Query params:", req.query);

  try {
    const { periodType, periodKey, storeId, monthFrom, monthTo } = req.query;

    // Validation
    const validation = validateRequiredFields({ periodType, storeId }, [
      { field: "periodType", type: "string", message: "Thiếu loại kỳ kê khai" },
      {
        field: "storeId",
        type: "objectId",
        message: "Thiếu hoặc sai ID cửa hàng",
      },
    ]);

    if (!validation.isValid) {
      return errorResponse(res, 400, "Dữ liệu không hợp lệ", {
        missingFields: validation.missing,
        invalidFields: validation.invalid,
      });
    }

    if (periodType !== "custom" && !periodKey) {
      return errorResponse(
        res,
        400,
        "Thiếu periodKey cho loại kỳ không phải custom",
        {
          hint: "Vui lòng chọn tháng/quý/năm cụ thể",
        }
      );
    }

    if (periodType === "custom" && (!monthFrom || !monthTo)) {
      return errorResponse(
        res,
        400,
        "Thiếu monthFrom hoặc monthTo cho kỳ tùy chỉnh",
        {
          hint: "Vui lòng chọn khoảng thời gian",
        }
      );
    }

    const store = await Store.findOne({ _id: storeId, deleted: false });
    if (!store) {
      return errorResponse(res, 404, "Không tìm thấy cửa hàng", {
        storeId,
        hint: "Cửa hàng không tồn tại hoặc đã bị xóa",
      });
    }

    console.log(`✅ Store found: ${store.name} (${storeId})`);

    const { start, end } = periodToRange(
      periodType,
      periodKey,
      monthFrom,
      monthTo
    );
    console.log(`📅 Period range: ${start} -> ${end}`);

    const agg = await Order.aggregate([
      {
        $match: {
          printDate: { $gte: start, $lte: end },
          status: "paid",
          storeId: new mongoose.Types.ObjectId(storeId),
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $toDouble: "$totalAmount" } },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const systemRevenue = agg[0] ? agg[0].totalRevenue.toFixed(2) : "0.00";
    const orderCount = agg[0] ? agg[0].orderCount : 0;

    console.log(
      `💰 System revenue: ${systemRevenue} VND (${orderCount} orders)`
    );

    return successResponse(res, "Lấy doanh thu hệ thống thành công", {
      systemRevenue,
      orderCount,
      periodType,
      periodKey,
      storeId,
      storeName: store.name,
      monthFrom,
      monthTo,
      dateRange: { start, end },
    });
  } catch (err) {
    console.error("❌ previewSystemRevenue error:", err);
    return errorResponse(res, 500, "Lỗi server khi tính doanh thu", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 2. CREATE TAX DECLARATION
 * POST /api/taxs
 */
const createTaxDeclaration = async (req, res) => {
  console.log("\n📋 === CREATE TAX DECLARATION ===");
  console.log("Request body keys:", Object.keys(req.body));
  console.log("StoreId:", req.body.storeId);
  console.log("PeriodType:", req.body.periodType);
  console.log("PeriodKey:", req.body.periodKey);
  console.log("DeclaredRevenue:", req.body.declaredRevenue);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const storeId = req.body.storeId || req.query.storeId;
    const periodType = req.body.periodType || req.query.periodType;
    let periodKey = req.body.periodKey || req.query.periodKey;
    const declaredRevenue =
      req.body.declaredRevenue || req.query.declaredRevenue;
    const createdBy = req.user?._id;

    console.log("📝 Extracted fields:");
    console.log("  - storeId:", storeId);
    console.log("  - periodType:", periodType);
    console.log("  - periodKey:", periodKey);
    console.log("  - declaredRevenue:", declaredRevenue);
    console.log("  - createdBy:", createdBy);

    // ✅ VALIDATE REQUIRED FIELDS
    const validation = validateRequiredFields(
      { storeId, periodType, periodKey, declaredRevenue },
      [
        {
          field: "storeId",
          type: "objectId",
          message: "Thiếu hoặc sai ID cửa hàng",
        },
        {
          field: "periodType",
          type: "string",
          message: "Thiếu loại kỳ kê khai",
        },
        { field: "periodKey", type: "string", message: "Thiếu mã kỳ kê khai" },
        {
          field: "declaredRevenue",
          type: "number",
          message: "Thiếu hoặc sai doanh thu kê khai",
        },
      ]
    );

    if (!validation.isValid) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 400, "Thiếu hoặc sai các trường bắt buộc", {
        missingFields: validation.missing.map((f) => f.field),
        invalidFields: validation.invalid.map((f) => f.field),
        details: [...validation.missing, ...validation.invalid],
        hint: "Vui lòng kiểm tra: storeId, periodType, periodKey, declaredRevenue",
      });
    }

    if (
      periodType === "custom" &&
      typeof periodKey === "string" &&
      periodKey.includes("đến")
    ) {
      const [from, to] = periodKey.split("đến").map((s) => s.trim());
      periodKey = `${from}_${to}`;
      console.log("  - periodKey (converted):", periodKey);
    }

    const store = await Store.findOne({ _id: storeId, deleted: false }).session(
      session
    );
    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 404, "Không tìm thấy cửa hàng", {
        storeId,
        hint: "Cửa hàng không tồn tại hoặc đã bị xóa",
      });
    }

    console.log(`✅ Store found: ${store.name}`);

    const existingOriginal = await TaxDeclaration.findOne({
      shopId: storeId,
      periodType,
      periodKey,
      isClone: false,
    }).session(session);

    if (existingOriginal) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 409, "Tờ khai cho kỳ này đã tồn tại", {
        existingId: existingOriginal._id,
        periodType,
        periodKey,
        hint: "Vui lòng cập nhật tờ khai hiện có hoặc tạo bản sao",
      });
    }

    let monthFrom = req.body.monthFrom || req.query.monthFrom;
    let monthTo = req.body.monthTo || req.query.monthTo;
    const { start, end } =
      periodType === "custom"
        ? periodToRange(periodType, periodKey, monthFrom, monthTo)
        : periodToRange(periodType, periodKey);

    console.log(`📅 Period range: ${start} -> ${end}`);

    const agg = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          status: "paid",
          printDate: { $ne: null, $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]).session(session);

    const systemRevenueDecimal = agg[0]?.total
      ? agg[0].total
      : mongoose.Types.Decimal128.fromString("0.00");

    console.log(`💰 System revenue: ${systemRevenueDecimal.toString()}`);

    const taxpayerInfo = await getTaxpayerInfo(storeId);

    const gtgtRate =
      req.body.taxRates?.gtgt !== undefined
        ? Number(req.body.taxRates.gtgt)
        : 1.0;
    const tncnRate =
      req.body.taxRates?.tncn !== undefined
        ? Number(req.body.taxRates.tncn)
        : 0.5;
    const declaredNum = Number(declaredRevenue);
    const gtgtAmount = (declaredNum * gtgtRate) / 100;
    const tncnAmount = (declaredNum * tncnRate) / 100;
    const totalTax = gtgtAmount + tncnAmount;

    console.log("💸 Tax calculation:");
    console.log(`  - Declared: ${declaredNum}`);
    console.log(`  - GTGT (${gtgtRate}%): ${gtgtAmount}`);
    console.log(`  - TNCN (${tncnRate}%): ${tncnAmount}`);
    console.log(`  - Total: ${totalTax}`);

    const revenueByCategory = (req.body.revenueByCategory || []).map((cat) => ({
      category: cat.category,
      categoryCode: getCategoryCode(cat.category),
      revenue: parseDecimal(cat.revenue || 0),
      gtgtTax: parseDecimal(cat.gtgtTax || 0),
      tncnTax: parseDecimal(cat.tncnTax || 0),
    }));

    const specialConsumptionTax = (req.body.specialConsumptionTax || []).map(
      (item, idx) => ({
        itemName: item.itemName,
        itemCode: `[33${String.fromCharCode(97 + idx)}]`,
        unit: item.unit,
        revenue: parseDecimal(item.revenue || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      })
    );

    const environmentalTax = (req.body.environmentalTax || []).map(
      (item, idx) => ({
        type: item.type,
        itemName: item.itemName,
        itemCode:
          item.type === "resource"
            ? `[34${String.fromCharCode(97 + idx)}]`
            : item.type === "environmental_tax"
            ? `[35${String.fromCharCode(97 + idx)}]`
            : `[36${String.fromCharCode(97 + idx)}]`,
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        unitPrice: parseDecimal(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      })
    );

    console.log("📦 Creating declaration document...");

    const doc = await TaxDeclaration.create(
      [
        {
          shopId: storeId,
          periodType,
          periodKey,
          isFirstTime: req.body.isFirstTime !== false,
          supplementNumber: req.body.supplementNumber || 0,
          taxpayerInfo,
          systemRevenue: systemRevenueDecimal,
          declaredRevenue: parseDecimal(declaredNum),
          taxRates: { gtgt: gtgtRate, tncn: tncnRate },
          taxAmounts: {
            gtgt: parseDecimal(gtgtAmount),
            tncn: parseDecimal(tncnAmount),
            total: parseDecimal(totalTax),
          },
          revenueByCategory,
          specialConsumptionTax,
          environmentalTax,
          notes: req.body.notes || "",
          internalNotes: req.body.internalNotes || "",
          createdBy,
          originalId: null,
          isClone: false,
          version: 1,
          status: req.body.status || "draft",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Declaration created: ${doc[0]._id}`);

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "TaxDeclaration",
      entityId: doc[0]._id,
      entityName: `${periodType}-${periodKey}`,
      req,
      description: `Tạo tờ khai thuế kỳ ${periodType} ${periodKey} cho cửa hàng ${store.name}`,
    });

    return successResponse(
      res,
      "Tạo tờ khai thành công",
      {
        declaration: doc[0],
        periodFormatted: formatTaxPeriod(periodType, periodKey),
      },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ createTaxDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi tạo tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 3. UPDATE TAX DECLARATION
 * PUT /api/taxs/:id
 */
const updateTaxDeclaration = async (req, res) => {
  console.log("\n📋 === UPDATE TAX DECLARATION ===");
  console.log("ID:", req.params.id);
  console.log("Request body keys:", Object.keys(req.body));

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    const {
      declaredRevenue,
      taxRates,
      revenueByCategory,
      specialConsumptionTax,
      environmentalTax,
      notes,
      internalNotes,
      status,
      isFirstTime,
      supplementNumber,
      taxpayerInfo,
    } = req.body;

    const doc = await TaxDeclaration.findById(id);
    if (!doc) {
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} (status: ${doc.status})`
    );

    if (!["draft", "saved"].includes(doc.status)) {
      return errorResponse(
        res,
        400,
        "Chỉ tờ khai trạng thái 'draft' hoặc 'saved' mới được chỉnh sửa",
        {
          currentStatus: doc.status,
          hint: "Tờ khai đã nộp hoặc đã duyệt không thể sửa",
        }
      );
    }

    const userId = req.user?._id;
    if (!isManagerUser(req.user) && String(doc.createdBy) !== String(userId)) {
      return errorResponse(
        res,
        403,
        "Chỉ người tạo hoặc manager mới được cập nhật",
        {
          createdBy: doc.createdBy,
          currentUser: userId,
        }
      );
    }

    console.log("🔧 Updating fields...");

    if (declaredRevenue != null) {
      const declaredNum = Number(declaredRevenue);
      const gtgtRate =
        taxRates?.gtgt !== undefined
          ? Number(taxRates.gtgt)
          : doc.taxRates.gtgt ?? 1.0;
      const tncnRate =
        taxRates?.tncn !== undefined
          ? Number(taxRates.tncn)
          : doc.taxRates.tncn ?? 0.5;

      const gtgtAmount = (declaredNum * gtgtRate) / 100;
      const tncnAmount = (declaredNum * tncnRate) / 100;
      const totalTax = gtgtAmount + tncnAmount;

      doc.declaredRevenue = parseDecimal(declaredNum);
      doc.taxRates.gtgt = gtgtRate;
      doc.taxRates.tncn = tncnRate;
      doc.taxAmounts.gtgt = parseDecimal(gtgtAmount);
      doc.taxAmounts.tncn = parseDecimal(tncnAmount);
      doc.taxAmounts.total = parseDecimal(totalTax);

      console.log(
        `💸 Tax updated: GTGT=${gtgtAmount}, TNCN=${tncnAmount}, Total=${totalTax}`
      );
    }

    if (revenueByCategory) {
      doc.revenueByCategory = revenueByCategory.map((cat) => ({
        category: cat.category,
        categoryCode: getCategoryCode(cat.category),
        revenue: parseDecimal(cat.revenue || 0),
        gtgtTax: parseDecimal(cat.gtgtTax || 0),
        tncnTax: parseDecimal(cat.tncnTax || 0),
      }));
      console.log(
        `📊 Revenue by category updated: ${revenueByCategory.length} items`
      );
    }

    if (specialConsumptionTax) {
      doc.specialConsumptionTax = specialConsumptionTax.map((item, idx) => ({
        itemName: item.itemName,
        itemCode: `[33${String.fromCharCode(97 + idx)}]`,
        unit: item.unit,
        revenue: parseDecimal(item.revenue || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      }));
      console.log(
        `🍾 Special consumption tax updated: ${specialConsumptionTax.length} items`
      );
    }

    if (environmentalTax) {
      doc.environmentalTax = environmentalTax.map((item, idx) => ({
        type: item.type,
        itemName: item.itemName,
        itemCode:
          item.type === "resource"
            ? `[34${String.fromCharCode(97 + idx)}]`
            : item.type === "environmental_tax"
            ? `[35${String.fromCharCode(97 + idx)}]`
            : `[36${String.fromCharCode(97 + idx)}]`,
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        unitPrice: parseDecimal(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      }));
      console.log(
        `🌿 Environmental tax updated: ${environmentalTax.length} items`
      );
    }

    if (taxpayerInfo) {
      doc.taxpayerInfo = { ...doc.taxpayerInfo, ...taxpayerInfo };
      console.log("👤 Taxpayer info updated");
    }

    if (notes !== undefined) doc.notes = notes;
    if (internalNotes !== undefined && isManagerUser(req.user)) {
      doc.internalNotes = internalNotes;
    }
    if (isFirstTime !== undefined) doc.isFirstTime = isFirstTime;
    if (supplementNumber !== undefined) doc.supplementNumber = supplementNumber;

    if (status && ["draft", "saved", "submitted"].includes(status)) {
      doc.status = status;
      if (status === "submitted" && !doc.submittedAt) {
        doc.submittedAt = new Date();
        console.log("📤 Status changed to submitted");
      }
    }

    doc.updatedAt = new Date();
    await doc.save();

    console.log(`✅ Declaration updated: ${doc._id}`);

    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: "update",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `Cập nhật tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey}`,
    });

    return successResponse(res, "Cập nhật tờ khai thành công", {
      declaration: doc,
    });
  } catch (err) {
    console.error("❌ updateTaxDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi cập nhật tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 4. CLONE TAX DECLARATION
 * POST /api/taxs/:id/clone
 */
const cloneTaxDeclaration = async (req, res) => {
  console.log("\n📋 === CLONE TAX DECLARATION ===");
  console.log("Source ID:", req.params.id);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    const source = await TaxDeclaration.findById(id).session(session);
    if (!source) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 404, "Nguồn để sao chép không tồn tại", { id });
    }

    console.log(
      `✅ Source found: ${source.periodType}-${source.periodKey} v${source.version}`
    );

    const maxVerDoc = await TaxDeclaration.findOne({
      shopId: source.shopId,
      periodType: source.periodType,
      periodKey: source.periodKey,
    })
      .sort({ version: -1 })
      .session(session);

    const newVersion = maxVerDoc ? maxVerDoc.version + 1 : source.version + 1;

    console.log(`📦 Creating clone with version ${newVersion}...`);

    const cloneDoc = await TaxDeclaration.create(
      [
        {
          shopId: source.shopId,
          periodType: source.periodType,
          periodKey: source.periodKey,
          isFirstTime: source.isFirstTime,
          supplementNumber: source.supplementNumber,
          taxpayerInfo: source.taxpayerInfo,
          systemRevenue: source.systemRevenue,
          declaredRevenue: source.declaredRevenue,
          taxRates: source.taxRates,
          taxAmounts: source.taxAmounts,
          revenueByCategory: source.revenueByCategory,
          specialConsumptionTax: source.specialConsumptionTax,
          environmentalTax: source.environmentalTax,
          notes: source.notes,
          internalNotes: source.internalNotes,
          createdBy: req.user?._id,
          originalId: source.originalId ? source.originalId : source._id,
          isClone: true,
          version: newVersion,
          status: "draft",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Clone created: ${cloneDoc[0]._id}`);

    await logActivity({
      user: req.user,
      store: { _id: source.shopId },
      action: "clone",
      entity: "TaxDeclaration",
      entityId: cloneDoc[0]._id,
      entityName: `${source.periodType}-${source.periodKey}`,
      req,
      description: `Tạo bản sao tờ khai thuế kỳ ${source.periodType} ${source.periodKey} từ bản ${source._id}`,
    });

    return successResponse(
      res,
      "Tạo bản sao thành công",
      {
        declaration: cloneDoc[0],
        sourceVersion: source.version,
        newVersion,
      },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ cloneTaxDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi clone tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 5. DELETE TAX DECLARATION
 * DELETE /api/taxs/:id
 */
const deleteTaxDeclaration = async (req, res) => {
  console.log("\n📋 === DELETE TAX DECLARATION ===");
  console.log("ID:", req.params.id);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    const doc = await TaxDeclaration.findById(id).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} v${doc.version}`
    );

    if (!isManagerUser(req.user)) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 403, "Chỉ Manager mới được xóa tờ khai", {
        userRole: req.user?.role,
      });
    }

    if (!doc.isClone) {
      console.log("🔍 Checking for clone to promote...");
      const clone = await TaxDeclaration.findOne({
        shopId: doc.shopId,
        periodType: doc.periodType,
        periodKey: doc.periodKey,
        isClone: true,
      })
        .sort({ version: -1 })
        .session(session);

      if (clone) {
        clone.originalId = null;
        clone.isClone = false;
        await clone.save({ session });

        console.log(`✅ Promoted clone v${clone.version} to original`);

        await logActivity({
          user: req.user,
          store: { _id: doc.shopId },
          action: "restore",
          entity: "TaxDeclaration",
          entityId: clone._id,
          entityName: `${clone.periodType}-${clone.periodKey}`,
          req,
          description: `Tự động nâng bản sao v${clone.version} lên làm bản gốc sau khi xóa bản gốc`,
        });
      }
    }

    await doc.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Declaration deleted: ${id}`);

    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: "delete",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `Xóa tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey}`,
    });

    return successResponse(res, "Xóa tờ khai thành công", {
      deletedId: id,
      periodType: doc.periodType,
      periodKey: doc.periodKey,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ deleteTaxDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi xóa tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 6. LIST TAX DECLARATIONS
 * GET /api/taxs?storeId=...&periodType=...&periodKey=...
 */
const listDeclarations = async (req, res) => {
  console.log("\n📋 === LIST TAX DECLARATIONS ===");
  console.log("Query params:", req.query);

  try {
    const {
      storeId,
      periodType,
      periodKey,
      status,
      isClone,
      page = 1,
      limit = 20,
    } = req.query;

    if (!storeId) {
      return errorResponse(res, 400, "Thiếu storeId trong query", {
        hint: "Vui lòng cung cấp storeId",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return errorResponse(res, 400, "storeId không hợp lệ", {
        storeId,
      });
    }

    const q = { shopId: new mongoose.Types.ObjectId(storeId) };

    if (periodType) q.periodType = periodType;
    if (periodKey) q.periodKey = periodKey;
    if (status) q.status = status;
    if (isClone !== undefined) q.isClone = isClone === "true";

    console.log("🔍 Query:", JSON.stringify(q));

    const docs = await TaxDeclaration.find(q)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await TaxDeclaration.countDocuments(q);

    console.log(`✅ Found ${docs.length} declarations (total: ${total})`);

    const data = docs.map((d) => ({
      ...d,
      systemRevenue: decimalToString(d.systemRevenue),
      declaredRevenue: decimalToString(d.declaredRevenue),
      taxAmounts: {
        gtgt: decimalToString(d.taxAmounts?.gtgt),
        tncn: decimalToString(d.taxAmounts?.tncn),
        total: decimalToString(d.taxAmounts?.total),
      },
      revenueByCategory: (d.revenueByCategory || []).map((cat) => ({
        ...cat,
        revenue: decimalToString(cat.revenue),
        gtgtTax: decimalToString(cat.gtgtTax),
        tncnTax: decimalToString(cat.tncnTax),
      })),
      specialConsumptionTax: (d.specialConsumptionTax || []).map((item) => ({
        ...item,
        revenue: decimalToString(item.revenue),
        taxAmount: decimalToString(item.taxAmount),
      })),
      environmentalTax: (d.environmentalTax || []).map((item) => ({
        ...item,
        unitPrice: decimalToString(item.unitPrice),
        taxAmount: decimalToString(item.taxAmount),
      })),
    }));

    return successResponse(res, "Lấy danh sách tờ khai thành công", {
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error("❌ listDeclarations error:", err);
    return errorResponse(res, 500, "Lỗi server khi lấy danh sách tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 7. GET SINGLE TAX DECLARATION
 * GET /api/taxs/:id
 */
const getDeclaration = async (req, res) => {
  console.log("\n📋 === GET TAX DECLARATION ===");
  console.log("ID:", req.params.id);

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    const doc = await TaxDeclaration.findById(id)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .lean();

    if (!doc) {
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} v${doc.version}`
    );

    const formatted = {
      ...doc,
      systemRevenue: decimalToString(doc.systemRevenue),
      declaredRevenue: decimalToString(doc.declaredRevenue),
      taxAmounts: {
        gtgt: decimalToString(doc.taxAmounts?.gtgt),
        tncn: decimalToString(doc.taxAmounts?.tncn),
        total: decimalToString(doc.taxAmounts?.total),
      },
      revenueByCategory: (doc.revenueByCategory || []).map((cat) => ({
        ...cat,
        revenue: decimalToString(cat.revenue),
        gtgtTax: decimalToString(cat.gtgtTax),
        tncnTax: decimalToString(cat.tncnTax),
      })),
      specialConsumptionTax: (doc.specialConsumptionTax || []).map((item) => ({
        ...item,
        revenue: decimalToString(item.revenue),
        taxAmount: decimalToString(item.taxAmount),
      })),
      environmentalTax: (doc.environmentalTax || []).map((item) => ({
        ...item,
        unitPrice: decimalToString(item.unitPrice),
        taxAmount: decimalToString(item.taxAmount),
      })),
    };

    return successResponse(res, "Lấy chi tiết tờ khai thành công", {
      declaration: formatted,
    });
  } catch (err) {
    console.error("❌ getDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi lấy chi tiết tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 8. APPROVE/REJECT TAX DECLARATION
 * POST /api/taxs/:id/approve
 */
const approveRejectDeclaration = async (req, res) => {
  console.log("\n📋 === APPROVE/REJECT TAX DECLARATION ===");
  console.log("ID:", req.params.id);
  console.log("Action:", req.body.action);

  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    if (!["approve", "reject"].includes(action)) {
      return errorResponse(res, 400, "Action phải là 'approve' hoặc 'reject'", {
        action,
        hint: "Vui lòng gửi action: 'approve' hoặc 'reject'",
      });
    }

    if (!isManagerUser(req.user)) {
      return errorResponse(
        res,
        403,
        "Chỉ Manager mới được duyệt/từ chối tờ khai",
        {
          userRole: req.user?.role,
        }
      );
    }

    const doc = await TaxDeclaration.findById(id);
    if (!doc) {
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} (status: ${doc.status})`
    );

    if (doc.status !== "submitted") {
      return errorResponse(
        res,
        400,
        "Chỉ tờ khai đã nộp (submitted) mới được duyệt/từ chối",
        {
          currentStatus: doc.status,
          hint: "Tờ khai phải có trạng thái 'submitted'",
        }
      );
    }

    if (action === "approve") {
      doc.status = "approved";
      doc.approvedAt = new Date();
      doc.approvedBy = req.user._id;
      doc.rejectionReason = "";
      console.log("✅ Approving declaration...");
    } else {
      doc.status = "rejected";
      doc.rejectionReason = rejectionReason || "Không có lý do";
      doc.approvedAt = null;
      doc.approvedBy = null;
      console.log(
        `❌ Rejecting declaration: ${rejectionReason || "No reason"}`
      );
    }

    await doc.save();

    console.log(`✅ Declaration ${action}d: ${id}`);

    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: action === "approve" ? "approve" : "reject",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `${
        action === "approve" ? "Duyệt" : "Từ chối"
      } tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey}`,
    });

    return successResponse(
      res,
      `${action === "approve" ? "Duyệt" : "Từ chối"} tờ khai thành công`,
      {
        declaration: doc,
        action,
      }
    );
  } catch (err) {
    console.error("❌ approveRejectDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi duyệt/từ chối tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 9. EXPORT TAX DECLARATION -> CSV or PDF
 * GET /api/taxs/:id/export?format=pdf|csv
 */
const exportDeclaration = async (req, res) => {
  console.log("\n📋 === EXPORT TAX DECLARATION ===");
  console.log("ID:", req.params.id);
  console.log("Format:", req.query.format);

  try {
    const { id } = req.params;
    const format = (req.query.format || "pdf").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    if (!["pdf", "csv"].includes(format)) {
      return errorResponse(res, 400, "Format phải là 'pdf' hoặc 'csv'", {
        format,
        hint: "Vui lòng chọn format=pdf hoặc format=csv",
      });
    }

    const doc = await TaxDeclaration.findById(id)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .lean();

    if (!doc) {
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} v${doc.version}`
    );
    console.log(`📄 Exporting as ${format.toUpperCase()}...`);

    const payload = {
      shopId: String(doc.shopId),
      periodType: doc.periodType,
      periodKey: doc.periodKey,
      version: doc.version,
      originalId: doc.originalId ? String(doc.originalId) : null,
      isClone: !!doc.isClone,
      isFirstTime: !!doc.isFirstTime,
      supplementNumber: doc.supplementNumber,
      systemRevenue: decimalToString(doc.systemRevenue),
      declaredRevenue: decimalToString(doc.declaredRevenue),
      gtgtRate: doc.taxRates.gtgt,
      tncnRate: doc.taxRates.tncn,
      gtgtAmount: decimalToString(doc.taxAmounts.gtgt),
      tncnAmount: decimalToString(doc.taxAmounts.tncn),
      totalTax: decimalToString(doc.taxAmounts.total),
      createdAt: doc.createdAt,
      createdBy: doc.createdBy?.fullName || "",
      status: doc.status,
      notes: doc.notes || "",
    };

    // ===== CSV =====
    if (format === "csv") {
      const fields = Object.keys(payload);
      const parser = new Parser({ fields });
      const csv = parser.parse([payload]);
      res.header("Content-Type", "text/csv; charset=utf-8");
      res.attachment(`to-khai-thue-${doc.periodKey}-v${doc.version}.csv`);
      console.log("✅ CSV export successful");
      res.send("\uFEFF" + csv);
      return;
    }

    // ===== PDF =====
    const fontPath = {
      normal: path.resolve(
        __dirname,
        "../../fonts/Roboto/static/Roboto-Regular.ttf"
      ),
      bold: path.resolve(
        __dirname,
        "../../fonts/Roboto/static/Roboto-Bold.ttf"
      ),
    };

    const pdf = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Tờ khai thuế ${doc.periodKey}`,
        Author: "SmartRetail",
      },
    });

    // Đăng ký font
    if (fs.existsSync(fontPath.normal)) {
      try {
        pdf.registerFont("Roboto", fontPath.normal);
        if (fs.existsSync(fontPath.bold)) {
          pdf.registerFont("RobotoBold", fontPath.bold);
        }
        pdf.font("Roboto");
        console.log("✅ Using Roboto font");
      } catch (e) {
        console.warn("⚠️ Roboto font error, using Helvetica:", e.message);
        pdf.font("Helvetica");
      }
    } else {
      console.warn("⚠️ Roboto font not found, using Helvetica");
      pdf.font("Helvetica");
    }

    res.setHeader("Content-Type", "application/pdf; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=to-khai-thue-${doc.periodKey}-v${doc.version}.pdf`
    );

    pdf.pipe(res);

    // ===== HEADER =====
    pdf.fontSize(9).text("Mẫu số: 01/CNKD", 40, 40);
    pdf.text("(Ban hành kèm theo Thông tư số 40/2021/TT-BTC", 40, 52);
    pdf.text("ngày 01 tháng 6 năm 2021 của Bộ trưởng Bộ Tài chính)", 40, 64);
    pdf.moveDown();

    pdf
      .fontSize(11)
      .font("RobotoBold")
      .text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "center" });
    pdf
      .fontSize(10)
      .font("Roboto")
      .text("Độc lập - Tự do - Hạnh phúc", { align: "center" });
    pdf.text("---------------", { align: "center" });
    pdf.moveDown();

    pdf
      .fontSize(13)
      .font("RobotoBold")
      .text("TỜ KHAI THUẾ ĐỐI VỚI HỘ KINH DOANH, CÁ NHÂN KINH DOANH", {
        align: "center",
      });
    pdf.moveDown();

    pdf
      .fontSize(10)
      .font("Roboto")
      .text("☑ HKD, CNKD nộp thuế theo phương pháp kê khai");
    pdf.moveDown();

    // [01] Kỳ tính thuế
    pdf.text(formatTaxPeriod(doc.periodType, doc.periodKey));

    // [02] Lần đầu, [03] Bổ sung lần thứ
    pdf.text(`[02] Lần đầu: ${doc.isFirstTime ? "☑" : "☐"}`);
    pdf.text(`[03] Bổ sung lần thứ: ${doc.supplementNumber || "..."}`);
    pdf.moveDown();

    // ===== THÔNG TIN NGƯỜI NỘP THUẾ =====
    const info = doc.taxpayerInfo || {};

    pdf.text(
      `[04] Người nộp thuế: ${info.name || "................................."}`
    );
    pdf.text(
      `[05] Tên cửa hàng/thương hiệu: ${
        info.storeName || "................................."
      }`
    );
    pdf.text(
      `[06] Tài khoản ngân hàng: ${
        info.bankAccount || "................................."
      }`
    );
    pdf.text(
      `[07] Mã số thuế: ${info.taxCode || "................................."}`
    );
    pdf.text(
      `[08] Ngành nghề kinh doanh: ${
        info.businessSector || "................................."
      } ${info.businessSectorChanged ? "[08a] Thay đổi thông tin ☑" : ""}`
    );
    pdf.text(
      `[09] Diện tích kinh doanh: ${info.businessArea || "..."} m² ${
        info.isRented ? "[09a] Đi thuê ☑" : ""
      }`
    );
    pdf.text(
      `[10] Số lượng lao động sử dụng thường xuyên: ${
        info.employeeCount || "..."
      }`
    );
    pdf.text(
      `[11] Thời gian hoạt động trong ngày từ ${
        info.workingHours?.from || "..."
      } giờ đến ${info.workingHours?.to || "..."} giờ`
    );

    // [12] Địa chỉ kinh doanh
    pdf.text(
      `[12] Địa chỉ kinh doanh: ${
        info.businessAddress?.full || "................................."
      } ${info.businessAddress?.changed ? "[12a] Thay đổi thông tin ☑" : ""}`
    );
    if (info.businessAddress?.street) {
      pdf.text(`     [12b] Số nhà, đường phố: ${info.businessAddress.street}`);
    }
    if (info.businessAddress?.ward) {
      pdf.text(`     [12c] Phường/Xã: ${info.businessAddress.ward}`);
    }
    if (info.businessAddress?.district) {
      pdf.text(`     [12d] Quận/Huyện: ${info.businessAddress.district}`);
    }
    if (info.businessAddress?.province) {
      pdf.text(`     [12đ] Tỉnh/Thành phố: ${info.businessAddress.province}`);
    }
    if (info.businessAddress?.borderMarket) {
      pdf.text("     [12e] Kinh doanh tại chợ biên giới ☑");
    }

    // [13] Địa chỉ cư trú
    pdf.text(
      `[13] Địa chỉ cư trú: ${
        info.residenceAddress?.full || "................................."
      }`
    );
    if (info.residenceAddress?.street) {
      pdf.text(`     [13a] Số nhà, đường phố: ${info.residenceAddress.street}`);
    }
    if (info.residenceAddress?.ward) {
      pdf.text(`     [13b] Phường/Xã: ${info.residenceAddress.ward}`);
    }
    if (info.residenceAddress?.district) {
      pdf.text(`     [13c] Quận/Huyện: ${info.residenceAddress.district}`);
    }
    if (info.residenceAddress?.province) {
      pdf.text(`     [13d] Tỉnh/Thành phố: ${info.residenceAddress.province}`);
    }

    pdf.text(`[14] Điện thoại: ${info.phone || "..."}`);
    pdf.text(`[15] Fax: ${info.fax || "..."}`);
    pdf.text(`[16] Email: ${info.email || "..."}`);
    pdf.moveDown();

    // ===== PHẦN A – GTGT & TNCN =====
    pdf
      .fontSize(11)
      .font("RobotoBold")
      .text(
        "A. KÊ KHAI THUẾ GIÁ TRỊ GIA TĂNG (GTGT), THUẾ THU NHẬP CÁ NHÂN (TNCN)"
      );
    pdf.fontSize(9).font("Roboto").text("Đơn vị tiền: Đồng Việt Nam");
    pdf.moveDown(0.5);

    const tableTop = pdf.y;
    pdf.rect(40, tableTop, 515, 20).stroke();
    pdf.fontSize(8);
    pdf.text("STT", 45, tableTop + 5);
    pdf.text("Nhóm ngành nghề", 80, tableTop + 5);
    pdf.text("Mã chỉ tiêu", 260, tableTop + 5);
    pdf.text("Doanh thu (GTGT)", 340, tableTop + 5);
    pdf.text("Số thuế (TNCN)", 450, tableTop + 5);

    let yPos = tableTop + 25;
    const categories = doc.revenueByCategory || [];

    categories.forEach((cat, idx) => {
      pdf.rect(40, yPos, 515, 20).stroke();
      pdf.text(idx + 1, 45, yPos + 5);
      pdf.text(getCategoryName(cat.category), 80, yPos + 5, { width: 160 });
      pdf.text(
        cat.categoryCode || getCategoryCode(cat.category),
        260,
        yPos + 5
      );
      pdf.text(decimalToString(cat.revenue), 340, yPos + 5);
      pdf.text(decimalToString(cat.tncnTax), 450, yPos + 5);
      yPos += 25;
    });

    pdf.rect(40, yPos, 515, 25).fillAndStroke("#f0f0f0", "#000");
    pdf
      .fillColor("#000")
      .fontSize(10)
      .font("RobotoBold")
      .text("[32] Tổng cộng:", 80, yPos + 7);
    pdf
      .font("Roboto")
      .text(decimalToString(doc.declaredRevenue), 340, yPos + 7);
    pdf.text(decimalToString(doc.taxAmounts.total), 450, yPos + 7);

    pdf.moveDown(2);

    // ===== PHẦN B – THUẾ TTĐB =====
    if (doc.specialConsumptionTax && doc.specialConsumptionTax.length > 0) {
      pdf.addPage();
      pdf
        .fontSize(11)
        .font("RobotoBold")
        .text("B. KÊ KHAI THUẾ TIÊU THỤ ĐẶC BIỆT (TTĐB)");
      pdf.fontSize(9).font("Roboto").text("Đơn vị tiền: Đồng Việt Nam");
      pdf.moveDown(0.5);

      const tableTop2 = pdf.y;
      pdf.rect(40, tableTop2, 515, 20).stroke();
      pdf.fontSize(8);
      pdf.text("STT", 45, tableTop2 + 5);
      pdf.text("Hàng hóa, dịch vụ", 70, tableTop2 + 5);
      pdf.text("Mã CT", 220, tableTop2 + 5);
      pdf.text("ĐVT", 280, tableTop2 + 5);
      pdf.text("Doanh thu", 330, tableTop2 + 5);
      pdf.text("Thuế suất", 420, tableTop2 + 5);
      pdf.text("Số thuế", 480, tableTop2 + 5);

      let yPos2 = tableTop2 + 25;
      doc.specialConsumptionTax.forEach((item, idx) => {
        pdf.rect(40, yPos2, 515, 20).stroke();
        pdf.text(idx + 1, 45, yPos2 + 5);
        pdf.text(item.itemName, 70, yPos2 + 5, { width: 140 });
        pdf.text(
          item.itemCode || `[33${String.fromCharCode(97 + idx)}]`,
          220,
          yPos2 + 5
        );
        pdf.text(item.unit, 280, yPos2 + 5);
        pdf.text(decimalToString(item.revenue), 330, yPos2 + 5);
        pdf.text(`${item.taxRate}%`, 420, yPos2 + 5);
        pdf.text(decimalToString(item.taxAmount), 480, yPos2 + 5);
        yPos2 += 25;
      });

      pdf.moveDown(2);
    }

    // ===== PHẦN C – THUẾ MÔI TRƯỜNG/TÀI NGUYÊN =====
    if (doc.environmentalTax && doc.environmentalTax.length > 0) {
      pdf.addPage();
      pdf
        .fontSize(11)
        .font("RobotoBold")
        .text("C. KÊ KHAI THUẾ/PHÍ BẢO VỆ MÔI TRƯỜNG HOẶC THUẾ TÀI NGUYÊN");
      pdf.fontSize(9).font("Roboto").text("Đơn vị tiền: Đồng Việt Nam");
      pdf.moveDown(0.5);

      const tableTop3 = pdf.y;
      pdf.rect(40, tableTop3, 515, 20).stroke();
      pdf.fontSize(8);
      pdf.text("STT", 45, tableTop3 + 5);
      pdf.text("Tài nguyên/Hàng hóa", 70, tableTop3 + 5);
      pdf.text("Mã CT", 220, tableTop3 + 5);
      pdf.text("ĐVT", 270, tableTop3 + 5);
      pdf.text("SL", 310, tableTop3 + 5);
      pdf.text("Giá", 350, tableTop3 + 5);
      pdf.text("T.suất", 410, tableTop3 + 5);
      pdf.text("Số thuế", 470, tableTop3 + 5);

      let yPos3 = tableTop3 + 25;
      doc.environmentalTax.forEach((item, idx) => {
        pdf.rect(40, yPos3, 515, 20).stroke();
        pdf.text(idx + 1, 45, yPos3 + 5);
        pdf.text(item.itemName, 70, yPos3 + 5, { width: 140 });
        pdf.text(item.itemCode || "", 220, yPos3 + 5);
        pdf.text(item.unit, 270, yPos3 + 5);
        pdf.text(String(item.quantity), 310, yPos3 + 5);
        pdf.text(decimalToString(item.unitPrice), 350, yPos3 + 5);
        pdf.text(`${item.taxRate}%`, 410, yPos3 + 5);
        pdf.text(decimalToString(item.taxAmount), 470, yPos3 + 5);
        yPos3 += 25;
      });

      pdf.moveDown(2);
    }

    // ===== CAM ĐOAN & CHỮ KÝ =====
    pdf
      .fontSize(10)
      .font("Roboto")
      .text(
        "Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu đã khai./.",
        { align: "justify" }
      );
    pdf.moveDown(2);

    const today = new Date();
    pdf.text(
      `Ngày ${today.getDate()} tháng ${
        today.getMonth() + 1
      } năm ${today.getFullYear()}`,
      { align: "right" }
    );
    pdf.moveDown();
    pdf.text("NGƯỜI NỘP THUẾ", { align: "right" });
    pdf.text("(Ký, ghi rõ họ tên)", { align: "right" });
    pdf.moveDown(3);
    pdf.text(info.name || "......................................", {
      align: "right",
    });

    console.log("✅ PDF export successful");
    pdf.end();
  } catch (err) {
    console.error("❌ exportDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi export tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

module.exports = {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  getDeclaration,
  approveRejectDeclaration,
  exportDeclaration,
};
