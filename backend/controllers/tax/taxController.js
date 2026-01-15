// controllers/tax/taxController.js - ✅ BẢN ĐÃ SỬA LỖI LƯU DỮ LIỆU
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

// ✅ VALIDATION HELPER - IMPROVED
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
    if (type === "number") {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 0) {
        invalid.push({ field, message: `${field} phải là số dương` });
      }
    }
    if (type === "string" && typeof value !== "string") {
      invalid.push({ field, message: `${field} phải là chuỗi` });
    }
    if (type === "objectId" && !mongoose.Types.ObjectId.isValid(value)) {
      invalid.push({ field, message: `${field} không phải ObjectId hợp lệ` });
    }
    if (type === "email" && typeof value === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        invalid.push({ field, message: `${field} không phải email hợp lệ` });
      }
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
  console.error(` [${status}] ${message}`, JSON.stringify(details, null, 2));
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

// ✅ Lấy thông tin người nộp thuế từ Store - IMPROVED
async function getTaxpayerInfo(storeId) {
  try {
    const store = await Store.findOne({ _id: storeId, deleted: false })
      .populate(
        "owner_id",
        "_id name fullName email dateOfBirth nationality idCard passport phone"
      )
      .populate("staff_ids", "_id name email")
      .lean();

    if (!store) {
      console.warn(`⚠️ Store not found: ${storeId}`);
      return {};
    }

    const owner = store.owner_id || {};

    // Đảm bảo email được lấy đầy đủ từ cả store và owner
    const storeEmail = store.email || "";
    const ownerEmail = owner.email || "";
    const finalEmail = storeEmail || ownerEmail;

    console.log(
      `📧 Email info: store=${storeEmail}, owner=${ownerEmail}, final=${finalEmail}`
    );

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
      phone: store.phone || owner.phone || "",
      fax: store.fax || "",
      email: finalEmail, // ✅ Sử dụng email đã được xác định
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
    console.error(" getTaxpayerInfo error:", err);
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
        const [fromYear, fromMonth] = from.split("-");
        const [toYear, toMonth] = to.split("-");
        return `[01a] Năm (từ tháng ${fromMonth}/${fromYear} đến tháng ${toMonth}/${toYear})`;
      }
      return `[01d] Lần phát sinh: ${periodKey}`;
    default:
      return periodKey;
  }
}

// ✅ Format date for Vietnamese
function formatDate(date) {
  if (!date) return "...";
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
}

// ✅ Format currency for Vietnamese
function formatCurrency(amount) {
  if (!amount) return "0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("vi-VN").format(num);
}

// ==================== CONTROLLERS ====================

/**
 * 1. PREVIEW SYSTEM REVENUE - FIXED
 * GET /api/taxs/preview?periodType=...&periodKey=...&storeId=...
 */
const previewSystemRevenue = async (req, res) => {
  console.log("\n === PREVIEW SYSTEM REVENUE ===");
  console.log("Query params:", req.query);

  try {
    const { periodType, storeId, monthFrom, monthTo } = req.query;

    // FIX: Xử lý periodKey khi nó là array
    let periodKey = req.query.periodKey;

    // Nếu periodKey là array, lấy phần tử đầu tiên
    if (Array.isArray(periodKey)) {
      console.log(`⚠️ periodKey is array: ${periodKey}, taking first element`);
      periodKey = periodKey[0];
    }

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

    // FIX: Kiểm tra periodKey có hợp lệ không trước khi gọi periodToRange
    if (periodType !== "custom" && periodKey) {
      // Validate periodKey format
      if (periodType === "month") {
        if (!/^\d{4}-\d{2}$/.test(periodKey)) {
          return errorResponse(
            res,
            400,
            "Định dạng periodKey không hợp lệ cho tháng",
            {
              periodKey,
              expectedFormat: "YYYY-MM",
              example: "2025-11",
            }
          );
        }
      } else if (periodType === "quarter") {
        if (!/^\d{4}-Q[1-4]$/.test(periodKey)) {
          return errorResponse(
            res,
            400,
            "Định dạng periodKey không hợp lệ cho quý",
            {
              periodKey,
              expectedFormat: "YYYY-Q[1-4]",
              example: "2025-Q4",
            }
          );
        }
      } else if (periodType === "year") {
        if (!/^\d{4}$/.test(periodKey)) {
          return errorResponse(
            res,
            400,
            "Định dạng periodKey không hợp lệ cho năm",
            {
              periodKey,
              expectedFormat: "YYYY",
              example: "2025",
            }
          );
        }
      }
    }

    console.log(`📅 Period: ${periodType} - ${periodKey}`);
    console.log(`📅 Custom range: ${monthFrom} -> ${monthTo}`);

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
    console.error(" previewSystemRevenue error:", err);
    return errorResponse(res, 500, "Lỗi server khi tính doanh thu", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 2. CREATE TAX DECLARATION - FIXED (ĐÃ BỎ CHECK TỒN TẠI)
 * POST /api/taxs
 */
const createTaxDeclaration = async (req, res) => {
  console.log("\n === CREATE TAX DECLARATION (NO DUPLICATE CHECK) ===");
  console.log("Request body keys:", Object.keys(req.body));
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ Lấy dữ liệu từ request body với fallback hợp lý
    const {
      storeId,
      periodType,
      periodKey,
      declaredRevenue,
      monthFrom,
      monthTo,
      taxRates = {},
      revenueByCategory = [],
      specialConsumptionTax = [],
      environmentalTax = [],
      notes = "",
      internalNotes = "",
      status = "draft",
      isFirstTime = true,
      supplementNumber = 0,
      taxpayerInfo: customTaxpayerInfo = {}, // Cho phép ghi đè thông tin từ client
    } = req.body;

    const createdBy = req.user?._id;

    console.log("📝 Extracted fields:");
    console.log("  - storeId:", storeId);
    console.log("  - periodType:", periodType);
    console.log("  - periodKey:", periodKey);
    console.log("  - declaredRevenue:", declaredRevenue);
    console.log("  - createdBy:", createdBy);
    console.log(
      "  - customTaxpayerInfo keys:",
      Object.keys(customTaxpayerInfo)
    );

    // ✅ VALIDATE REQUIRED FIELDS - IMPROVED
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

    // Xử lý periodKey cho kỳ custom
    let processedPeriodKey = periodKey;
    if (
      periodType === "custom" &&
      typeof periodKey === "string" &&
      periodKey.includes("đến")
    ) {
      const [from, to] = periodKey.split("đến").map((s) => s.trim());
      processedPeriodKey = `${from}_${to}`;
      console.log("  - periodKey (converted):", processedPeriodKey);
    }

    // Kiểm tra store
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

    //  BỎ CHECK TỒN TẠI - CHO PHÉP TẠO NHIỀU TỜ KHAI CÙNG KỲ
    // Comment/Remove the existing duplicate check
    /*
    const existingOriginal = await TaxDeclaration.findOne({
      shopId: storeId,
      periodType,
      periodKey: processedPeriodKey,
      isClone: false,
    }).session(session);

    if (existingOriginal) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 409, "Tờ khai cho kỳ này đã tồn tại", {
        existingId: existingOriginal._id,
        periodType,
        periodKey: processedPeriodKey,
        hint: "Vui lòng cập nhật tờ khai hiện có hoặc tạo bản sao",
      });
    }
    */

    // Tính toán period range
    const { start, end } =
      periodType === "custom"
        ? periodToRange(periodType, processedPeriodKey, monthFrom, monthTo)
        : periodToRange(periodType, processedPeriodKey);

    console.log(`📅 Period range: ${start} -> ${end}`);

    // Tính doanh thu hệ thống
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

    // Lấy thông tin người nộp thuế từ database
    const dbTaxpayerInfo = await getTaxpayerInfo(storeId);

    // ✅ MERGE thông tin: database info + custom info từ client
    const taxpayerInfo = {
      ...dbTaxpayerInfo,
      ...customTaxpayerInfo,
      // Merge nested objects
      businessAddress: {
        ...(dbTaxpayerInfo.businessAddress || {}),
        ...(customTaxpayerInfo.businessAddress || {}),
      },
      residenceAddress: {
        ...(dbTaxpayerInfo.residenceAddress || {}),
        ...(customTaxpayerInfo.residenceAddress || {}),
      },
      workingHours: {
        ...(dbTaxpayerInfo.workingHours || {}),
        ...(customTaxpayerInfo.workingHours || {}),
      },
      personalInfo: {
        ...(dbTaxpayerInfo.personalInfo || {}),
        ...(customTaxpayerInfo.personalInfo || {}),
      },
    };

    console.log("👤 Final taxpayer info keys:", Object.keys(taxpayerInfo));
    console.log("📧 Final email:", taxpayerInfo.email);

    // Tính toán thuế
    const gtgtRate = Number(taxRates.gtgt || 1.0);
    const tncnRate = Number(taxRates.tncn || 0.5);
    const declaredNum = Number(declaredRevenue);
    const gtgtAmount = (declaredNum * gtgtRate) / 100;
    const tncnAmount = (declaredNum * tncnRate) / 100;
    const totalTax = gtgtAmount + tncnAmount;

    console.log("💸 Tax calculation:");
    console.log(`  - Declared: ${declaredNum}`);
    console.log(`  - GTGT (${gtgtRate}%): ${gtgtAmount}`);
    console.log(`  - TNCN (${tncnRate}%): ${tncnAmount}`);
    console.log(`  - Total: ${totalTax}`);

    // Xử lý danh mục doanh thu
    const processedRevenueByCategory = revenueByCategory.map((cat) => ({
      category: cat.category || "",
      categoryCode: getCategoryCode(cat.category || ""),
      revenue: parseDecimal(cat.revenue || 0),
      gtgtTax: parseDecimal(cat.gtgtTax || 0),
      tncnTax: parseDecimal(cat.tncnTax || 0),
    }));

    // Xử lý thuế tiêu thụ đặc biệt
    const processedSpecialConsumptionTax = specialConsumptionTax.map(
      (item, idx) => ({
        itemName: item.itemName || "",
        itemCode: `[33${String.fromCharCode(97 + idx)}]`,
        unit: item.unit || "",
        revenue: parseDecimal(item.revenue || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      })
    );

    // Xử lý thuế môi trường
    const processedEnvironmentalTax = environmentalTax.map((item, idx) => ({
      type: item.type || "environmental_tax",
      itemName: item.itemName || "",
      itemCode:
        item.type === "resource"
          ? `[34${String.fromCharCode(97 + idx)}]`
          : item.type === "environmental_tax"
          ? `[35${String.fromCharCode(97 + idx)}]`
          : `[36${String.fromCharCode(97 + idx)}]`,
      unit: item.unit || "",
      quantity: Number(item.quantity || 0),
      unitPrice: parseDecimal(item.unitPrice || 0),
      taxRate: Number(item.taxRate || 0),
      taxAmount: parseDecimal(item.taxAmount || 0),
    }));

    console.log(" Creating declaration document...");

    // ✅ Tạo document với tất cả các trường
    const docData = {
      shopId: storeId,
      periodType,
      periodKey: processedPeriodKey,
      isFirstTime,
      supplementNumber: Number(supplementNumber) || 0,
      taxpayerInfo, // ✅ Đảm bảo taxpayerInfo có đầy đủ thông tin
      systemRevenue: systemRevenueDecimal,
      declaredRevenue: parseDecimal(declaredNum),
      taxRates: {
        gtgt: gtgtRate,
        tncn: tncnRate,
      },
      taxAmounts: {
        gtgt: parseDecimal(gtgtAmount),
        tncn: parseDecimal(tncnAmount),
        total: parseDecimal(totalTax),
      },
      revenueByCategory: processedRevenueByCategory,
      specialConsumptionTax: processedSpecialConsumptionTax,
      environmentalTax: processedEnvironmentalTax,
      notes: notes || "",
      internalNotes: internalNotes || "",
      createdBy,
      originalId: null,
      isClone: false,
      version: 1,
      status,
    };

    console.log("📄 Document data keys:", Object.keys(docData));
    console.log(
      "📄 Document taxpayerInfo:",
      JSON.stringify(docData.taxpayerInfo, null, 2)
    );

    const doc = await TaxDeclaration.create([docData], { session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Declaration created: ${doc[0]._id}`);
    console.log(`ℹ️  Period: ${periodType} ${processedPeriodKey}`);
    console.log(`ℹ️  Status: ${status}`);

    await logActivity({
      user: req.user,
      store: { _id: storeId },
      action: "create",
      entity: "TaxDeclaration",
      entityId: doc[0]._id,
      entityName: `${periodType}-${processedPeriodKey}`,
      req,
      description: `Tạo tờ khai thuế kỳ ${periodType} ${processedPeriodKey} cho cửa hàng ${store.name}`,
    });

    return successResponse(
      res,
      "Tạo tờ khai thành công",
      {
        declaration: doc[0],
        periodFormatted: formatTaxPeriod(periodType, processedPeriodKey),
        note: "Đã tạo tờ khai mới (không kiểm tra trùng kỳ)",
      },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(" createTaxDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi tạo tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};
/**
 * 3. UPDATE TAX DECLARATION - IMPROVED
 * PUT /api/taxs/:id
 */
const updateTaxDeclaration = async (req, res) => {
  console.log("\n === UPDATE TAX DECLARATION ===");
  console.log("ID:", req.params.id);
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 400, "ID tờ khai không hợp lệ", { id });
    }

    // Lấy tất cả các trường từ request body
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
      taxpayerInfo: updatedTaxpayerInfo,
      ...otherFields
    } = req.body;

    console.log("📝 Fields to update:", Object.keys(req.body));

    // Tìm document
    const doc = await TaxDeclaration.findById(id).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 404, "Không tìm thấy tờ khai", { id });
    }

    console.log(
      `✅ Declaration found: ${doc.periodType}-${doc.periodKey} (status: ${doc.status})`
    );

    // Kiểm tra quyền chỉnh sửa
    if (!["draft", "saved"].includes(doc.status)) {
      await session.abortTransaction();
      session.endSession();
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
      await session.abortTransaction();
      session.endSession();
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

    // ✅ Cập nhật thông tin người nộp thuế nếu có
    if (updatedTaxpayerInfo) {
      console.log("👤 Updating taxpayer info...");

      // Merge thông tin mới với thông tin cũ
      doc.taxpayerInfo = {
        ...doc.taxpayerInfo,
        ...updatedTaxpayerInfo,
        // Merge nested objects
        businessAddress: {
          ...(doc.taxpayerInfo?.businessAddress || {}),
          ...(updatedTaxpayerInfo.businessAddress || {}),
        },
        residenceAddress: {
          ...(doc.taxpayerInfo?.residenceAddress || {}),
          ...(updatedTaxpayerInfo.residenceAddress || {}),
        },
        workingHours: {
          ...(doc.taxpayerInfo?.workingHours || {}),
          ...(updatedTaxpayerInfo.workingHours || {}),
        },
        personalInfo: {
          ...(doc.taxpayerInfo?.personalInfo || {}),
          ...(updatedTaxpayerInfo.personalInfo || {}),
        },
      };

      console.log("📧 Updated email:", doc.taxpayerInfo.email);
    }

    // Cập nhật doanh thu và thuế nếu có
    if (declaredRevenue != null) {
      const declaredNum = Number(declaredRevenue);
      if (isNaN(declaredNum) || declaredNum < 0) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(res, 400, "Doanh thu kê khai không hợp lệ", {
          declaredRevenue,
          hint: "Doanh thu phải là số >= 0",
        });
      }

      const gtgtRate =
        taxRates?.gtgt !== undefined
          ? Number(taxRates.gtgt)
          : doc.taxRates.gtgt ?? 1.0;
      const tncnRate =
        taxRates?.tncn !== undefined
          ? Number(taxRates.tncn)
          : doc.taxRates.tncn ?? 0.5;

      // Validate tax rates
      if (isNaN(gtgtRate) || gtgtRate < 0 || gtgtRate > 10) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(res, 400, "Thuế suất GTGT không hợp lệ", {
          gtgtRate,
          hint: "Thuế suất GTGT phải từ 0-10%",
        });
      }

      if (isNaN(tncnRate) || tncnRate < 0 || tncnRate > 5) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(res, 400, "Thuế suất TNCN không hợp lệ", {
          tncnRate,
          hint: "Thuế suất TNCN phải từ 0-5%",
        });
      }

      // Tính toán thuế mới
      const gtgtAmount = (declaredNum * gtgtRate) / 100;
      const tncnAmount = (declaredNum * tncnRate) / 100;
      const totalTax = gtgtAmount + tncnAmount;

      console.log("💸 Tax calculation:");
      console.log(`  - Declared: ${declaredNum}`);
      console.log(`  - GTGT (${gtgtRate}%): ${gtgtAmount}`);
      console.log(`  - TNCN (${tncnRate}%): ${tncnAmount}`);
      console.log(`  - Total: ${totalTax}`);

      doc.declaredRevenue = parseDecimal(declaredNum);
      doc.taxRates.gtgt = gtgtRate;
      doc.taxRates.tncn = tncnRate;
      doc.taxAmounts.gtgt = parseDecimal(gtgtAmount);
      doc.taxAmounts.tncn = parseDecimal(tncnAmount);
      doc.taxAmounts.total = parseDecimal(totalTax);
    }

    // Cập nhật các trường khác
    if (revenueByCategory !== undefined) {
      doc.revenueByCategory = revenueByCategory.map((cat) => ({
        category: cat.category || "",
        categoryCode: getCategoryCode(cat.category || ""),
        revenue: parseDecimal(cat.revenue || 0),
        gtgtTax: parseDecimal(cat.gtgtTax || 0),
        tncnTax: parseDecimal(cat.tncnTax || 0),
      }));
    }

    if (specialConsumptionTax !== undefined) {
      doc.specialConsumptionTax = specialConsumptionTax.map((item, idx) => ({
        itemName: item.itemName || "",
        itemCode: `[33${String.fromCharCode(97 + idx)}]`,
        unit: item.unit || "",
        revenue: parseDecimal(item.revenue || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      }));
    }

    if (environmentalTax !== undefined) {
      doc.environmentalTax = environmentalTax.map((item, idx) => ({
        type: item.type || "environmental_tax",
        itemName: item.itemName || "",
        itemCode:
          item.type === "resource"
            ? `[34${String.fromCharCode(97 + idx)}]`
            : item.type === "environmental_tax"
            ? `[35${String.fromCharCode(97 + idx)}]`
            : `[36${String.fromCharCode(97 + idx)}]`,
        unit: item.unit || "",
        quantity: Number(item.quantity || 0),
        unitPrice: parseDecimal(item.unitPrice || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      }));
    }

    // Cập nhật các trường cơ bản
    if (notes !== undefined) doc.notes = notes;
    if (internalNotes !== undefined && isManagerUser(req.user)) {
      doc.internalNotes = internalNotes;
    }
    if (isFirstTime !== undefined) doc.isFirstTime = isFirstTime;
    if (supplementNumber !== undefined) {
      doc.supplementNumber = Number(supplementNumber) || 0;
    }

    // Cập nhật trạng thái
    if (status && ["draft", "saved", "submitted"].includes(status)) {
      if (status === "submitted") {
        // Validate before submitting
        const validationErrors = [];
        if (!doc.taxpayerInfo?.name) {
          validationErrors.push("Thiếu tên người nộp thuế");
        }
        if (!doc.taxpayerInfo?.taxCode) {
          validationErrors.push("Thiếu mã số thuế");
        }
        if (parseFloat(doc.declaredRevenue.toString()) <= 0) {
          validationErrors.push("Doanh thu kê khai phải lớn hơn 0");
        }
        // ✅ Kiểm tra email khi submit
        if (!doc.taxpayerInfo?.email) {
          validationErrors.push("Thiếu email người nộp thuế");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.taxpayerInfo.email)) {
          validationErrors.push("Email không hợp lệ");
        }

        if (validationErrors.length > 0) {
          await session.abortTransaction();
          session.endSession();
          return errorResponse(res, 400, "Không thể nộp tờ khai", {
            validationErrors,
            hint: "Vui lòng kiểm tra lại thông tin trước khi nộp",
          });
        }

        if (!doc.submittedAt) {
          doc.submittedAt = new Date();
          console.log("📤 Status changed to submitted");
        }
      }
      doc.status = status;
    }

    // Cập nhật thời gian và người cập nhật
    doc.updatedAt = new Date();
    doc.updatedBy = req.user?._id;

    // Lưu trong transaction
    await doc.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log(`✅ Declaration updated: ${doc._id}`);

    // Log activity
    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: "update",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `Cập nhật tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey} - Trạng thái: ${doc.status}`,
      changes: Object.keys(req.body),
    });

    return successResponse(res, "Cập nhật tờ khai thành công", {
      declaration: doc,
      changes: Object.keys(req.body),
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(" updateTaxDeclaration error:", err);
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
  console.log("\n === CLONE TAX DECLARATION ===");
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

    console.log(` Creating clone with version ${newVersion}...`);

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
    console.error(" cloneTaxDeclaration error:", err);
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
  console.log("\n === DELETE TAX DECLARATION ===");
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
    console.error(" deleteTaxDeclaration error:", err);
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
  console.log("\n === LIST TAX DECLARATIONS ===");
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
    console.error(" listDeclarations error:", err);
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
  console.log("\n === GET TAX DECLARATION ===");
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
    console.error(" getDeclaration error:", err);
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
  console.log("\n === APPROVE/REJECT TAX DECLARATION ===");
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
        ` Rejecting declaration: ${rejectionReason || "No reason"}`
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
    console.error(" approveRejectDeclaration error:", err);
    return errorResponse(res, 500, "Lỗi server khi duyệt/từ chối tờ khai", {
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

/**
 * 9. EXPORT TAX DECLARATION -> CSV or PDF (BẢN HOÀN CHỈNH THEO MẪU 01/CNKD)
 * GET /api/taxs/:id/export?format=pdf|csv
 */
const exportDeclaration = async (req, res) => {
  console.log("\n === EXPORT TAX DECLARATION ===");
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

    // ===== CSV =====
    if (format === "csv") {
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

    const info = doc.taxpayerInfo || {};
    const personalInfo = info.personalInfo || {};

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

    // Loại hình kê khai
    pdf
      .fontSize(10)
      .font("Roboto")
      .text("☑ HKD, CNKD nộp thuế theo phương pháp kê khai");
    pdf.moveDown();

    // [01] Kỳ tính thuế
    pdf.text(formatTaxPeriod(doc.periodType, doc.periodKey));
    pdf.moveDown(0.5);

    // [02] Lần đầu, [03] Bổ sung lần thứ
    pdf.text(`[02] Lần đầu: ${doc.isFirstTime ? "☑" : "☐"}`);
    pdf.text(`[03] Bổ sung lần thứ: ${doc.supplementNumber || "0"}`);
    pdf.moveDown();

    // ===== THÔNG TIN NGƯỜI NỘP THUẾ =====
    pdf.fontSize(10).font("RobotoBold").text("THÔNG TIN NGƯỜI NỘP THUẾ");
    pdf.font("Roboto");

    pdf.text(`[04] Người nộp thuế: ${info.name || "..."}`);
    pdf.text(`[05] Tên cửa hàng/thương hiệu: ${info.storeName || "..."}`);
    pdf.text(`[06] Tài khoản ngân hàng: ${info.bankAccount || "..."}`);
    pdf.text(`[07] Mã số thuế: ${info.taxCode || "..."}`);

    pdf.text(
      `[08] Ngành nghề kinh doanh: ${info.businessSector || "..."} ${
        info.businessSectorChanged ? "[08a] Thay đổi thông tin ☑" : ""
      }`
    );

    pdf.text(
      `[09] Diện tích kinh doanh: ${info.businessArea || "0"} m² ${
        info.isRented ? "[09a] Đi thuê ☑" : ""
      }`
    );

    pdf.text(
      `[10] Số lượng lao động sử dụng thường xuyên: ${
        info.employeeCount || "0"
      }`
    );

    pdf.text(
      `[11] Thời gian hoạt động trong ngày từ ${
        info.workingHours?.from || "..."
      } giờ đến ${info.workingHours?.to || "..."} giờ`
    );

    // [12] Địa chỉ kinh doanh
    const businessAddr = info.businessAddress || {};
    pdf.text(
      `[12] Địa chỉ kinh doanh: ${businessAddr.full || "..."} ${
        businessAddr.changed ? "[12a] Thay đổi thông tin ☑" : ""
      }`
    );

    if (businessAddr.street) {
      pdf.text(
        `     [12b] Số nhà, đường phố/xóm/ấp/thôn: ${businessAddr.street}`
      );
    }
    if (businessAddr.ward) {
      pdf.text(`     [12c] Phường/Xã/Thị trấn: ${businessAddr.ward}`);
    }
    if (businessAddr.district) {
      pdf.text(
        `     [12d] Quận/Huyện/Thị xã/Thành phố thuộc tỉnh: ${businessAddr.district}`
      );
    }
    if (businessAddr.province) {
      pdf.text(`     [12đ] Tỉnh/Thành phố: ${businessAddr.province}`);
    }
    if (businessAddr.borderMarket) {
      pdf.text("     [12e] Kinh doanh tại chợ biên giới ☑");
    }

    // [13] Địa chỉ cư trú
    const residenceAddr = info.residenceAddress || {};
    pdf.text(`[13] Địa chỉ cư trú: ${residenceAddr.full || "..."}`);

    if (residenceAddr.street) {
      pdf.text(
        `     [13a] Số nhà, đường phố/xóm/ấp/thôn: ${residenceAddr.street}`
      );
    }
    if (residenceAddr.ward) {
      pdf.text(`     [13b] Phường/Xã/Thị trấn: ${residenceAddr.ward}`);
    }
    if (residenceAddr.district) {
      pdf.text(
        `     [13c] Quận/Huyện/Thị xã/Thành phố thuộc tỉnh: ${residenceAddr.district}`
      );
    }
    if (residenceAddr.province) {
      pdf.text(`     [13d] Tỉnh/Thành phố: ${residenceAddr.province}`);
    }

    pdf.text(`[14] Điện thoại: ${info.phone || "..."}`);
    pdf.text(`[15] Fax: ${info.fax || "..."}`);
    pdf.text(`[16] Email: ${info.email || "..."}`);

    // [17] Văn bản ủy quyền
    if (info.taxAuthorizationDoc) {
      pdf.text(
        `[17] Văn bản ủy quyền khai thuế: ${
          info.taxAuthorizationDoc.number || ""
        } ngày ${formatDate(info.taxAuthorizationDoc.date)}`
      );
    }

    // Thông tin cá nhân (nếu có)
    if (personalInfo.dateOfBirth || personalInfo.idCard?.number) {
      pdf.moveDown();
      pdf.text(
        "[18] Trường hợp cá nhân kinh doanh chưa đăng ký thuế thì khai thêm các thông tin sau:"
      );

      if (personalInfo.dateOfBirth) {
        pdf.text(
          `     [18a] Ngày sinh: ${formatDate(personalInfo.dateOfBirth)}`
        );
      }
      if (personalInfo.nationality) {
        pdf.text(`     [18b] Quốc tịch: ${personalInfo.nationality}`);
      }
      if (personalInfo.idCard?.number) {
        pdf.text(`     [18c] Số CMND/CCCD: ${personalInfo.idCard.number}`);
        pdf.text(
          `     [18c.1] Ngày cấp: ${formatDate(personalInfo.idCard.issueDate)}`
        );
        pdf.text(
          `     [18c.2] Nơi cấp: ${personalInfo.idCard.issuePlace || ""}`
        );
      }
      // Các loại giấy tờ khác...
    }

    pdf.moveDown();

    // ===== PHẦN A – GTGT & TNCN =====
    pdf.addPage();
    pdf
      .fontSize(11)
      .font("RobotoBold")
      .text(
        "A. KÊ KHAI THUẾ GIÁ TRỊ GIA TĂNG (GTGT), THUẾ THU NHẬP CÁ NHÂN (TNCN)"
      );
    pdf.fontSize(9).font("Roboto").text("Đơn vị tiền: Đồng Việt Nam");
    pdf.moveDown(0.5);

    // Vẽ bảng phần A
    const tableTopA = pdf.y;
    const tableWidthA = 515;
    const rowHeightA = 20;

    // Header
    pdf
      .rect(40, tableTopA, tableWidthA, rowHeightA)
      .fillAndStroke("#e0e0e0", "#000");
    pdf.fillColor("#000").fontSize(8).font("RobotoBold");

    const colWidthsA = [30, 180, 50, 85, 85, 85];
    let xPos = 40;

    ["STT", "Nhóm ngành nghề", "Mã chỉ tiêu", "Thuế GTGT", "Thuế TNCN"].forEach(
      (header, index) => {
        const width = index === 1 ? 180 : index === 0 ? 30 : 85;
        pdf.text(header, xPos + 2, tableTopA + 6, {
          width: width - 4,
          align: "center",
        });
        xPos += width;
      }
    );

    // Sub-header cho doanh thu và số thuế
    pdf.text("Doanh thu", 40 + 30 + 180 + 50 + 2, tableTopA + 12, {
      width: 85 - 4,
      align: "center",
    });
    pdf.text("Số thuế", 40 + 30 + 180 + 50 + 85 + 2, tableTopA + 12, {
      width: 85 - 4,
      align: "center",
    });
    pdf.text("Doanh thu", 40 + 30 + 180 + 50 + 85 * 2 + 2, tableTopA + 12, {
      width: 85 - 4,
      align: "center",
    });
    pdf.text("Số thuế", 40 + 30 + 180 + 50 + 85 * 3 + 2, tableTopA + 12, {
      width: 85 - 4,
      align: "center",
    });

    let yPosA = tableTopA + rowHeightA;
    const categories = doc.revenueByCategory || [];

    // Dữ liệu các dòng
    pdf.fontSize(8).font("Roboto");
    categories.forEach((cat, idx) => {
      pdf.rect(40, yPosA, tableWidthA, rowHeightA).stroke();

      pdf.text((idx + 1).toString(), 42, yPosA + 6, {
        width: 26,
        align: "center",
      });
      pdf.text(getCategoryName(cat.category), 72, yPosA + 6, { width: 176 });
      pdf.text(getCategoryCode(cat.category), 252, yPosA + 6, {
        width: 46,
        align: "center",
      });
      pdf.text(formatCurrency(decimalToString(cat.revenue)), 300, yPosA + 6, {
        width: 81,
        align: "right",
      });
      pdf.text(formatCurrency(decimalToString(cat.gtgtTax)), 383, yPosA + 6, {
        width: 81,
        align: "right",
      });
      pdf.text(formatCurrency(decimalToString(cat.revenue)), 466, yPosA + 6, {
        width: 81,
        align: "right",
      });
      pdf.text(formatCurrency(decimalToString(cat.tncnTax)), 549, yPosA + 6, {
        width: 81,
        align: "right",
      });

      yPosA += rowHeightA;
    });

    // Dòng tổng cộng
    pdf
      .rect(40, yPosA, tableWidthA, rowHeightA)
      .fillAndStroke("#f0f0f0", "#000");
    pdf.fillColor("#000").fontSize(9).font("RobotoBold");
    pdf.text("Tổng cộng:", 72, yPosA + 6, { width: 176 });
    pdf.text("[32]", 252, yPosA + 6, { width: 46, align: "center" });
    pdf.text(
      formatCurrency(decimalToString(doc.declaredRevenue)),
      300,
      yPosA + 6,
      { width: 81, align: "right" }
    );
    pdf.text(
      formatCurrency(decimalToString(doc.taxAmounts.gtgt)),
      383,
      yPosA + 6,
      { width: 81, align: "right" }
    );
    pdf.text(
      formatCurrency(decimalToString(doc.declaredRevenue)),
      466,
      yPosA + 6,
      { width: 81, align: "right" }
    );
    pdf.text(
      formatCurrency(decimalToString(doc.taxAmounts.tncn)),
      549,
      yPosA + 6,
      { width: 81, align: "right" }
    );

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

      const tableTopB = pdf.y;
      const tableWidthB = 515;
      const rowHeightB = 20;

      // Header
      pdf
        .rect(40, tableTopB, tableWidthB, rowHeightB)
        .fillAndStroke("#e0e0e0", "#000");
      pdf.fillColor("#000").fontSize(8).font("RobotoBold");

      const colWidthsB = [30, 150, 50, 60, 100, 60, 65];
      let xPosB = 40;

      [
        "STT",
        "Hàng hóa, dịch vụ chịu thuế TTĐB",
        "Mã chỉ tiêu",
        "Đơn vị tính",
        "Doanh thu tính thuế TTĐB",
        "Thuế suất",
        "Số thuế",
      ].forEach((header, index) => {
        const width = colWidthsB[index];
        pdf.text(header, xPosB + 2, tableTopB + 6, {
          width: width - 4,
          align: "center",
        });
        xPosB += width;
      });

      let yPosB = tableTopB + rowHeightB;
      pdf.fontSize(8).font("Roboto");

      doc.specialConsumptionTax.forEach((item, idx) => {
        pdf.rect(40, yPosB, tableWidthB, rowHeightB).stroke();

        pdf.text((idx + 1).toString(), 42, yPosB + 6, {
          width: 26,
          align: "center",
        });
        pdf.text(item.itemName, 72, yPosB + 6, { width: 146 });
        pdf.text(
          item.itemCode || `[33${String.fromCharCode(97 + idx)}]`,
          222,
          yPosB + 6,
          { width: 46, align: "center" }
        );
        pdf.text(item.unit, 270, yPosB + 6, { width: 56, align: "center" });
        pdf.text(
          formatCurrency(decimalToString(item.revenue)),
          332,
          yPosB + 6,
          { width: 96, align: "right" }
        );
        pdf.text(`${item.taxRate}%`, 430, yPosB + 6, {
          width: 56,
          align: "center",
        });
        pdf.text(
          formatCurrency(decimalToString(item.taxAmount)),
          490,
          yPosB + 6,
          { width: 61, align: "right" }
        );

        yPosB += rowHeightB;
      });

      // Tổng cộng phần B
      pdf
        .rect(40, yPosB, tableWidthB, rowHeightB)
        .fillAndStroke("#f0f0f0", "#000");
      pdf.fillColor("#000").fontSize(9).font("RobotoBold");
      pdf.text("Tổng cộng:", 72, yPosB + 6, { width: 146 });
      pdf.text("[33]", 222, yPosB + 6, { width: 46, align: "center" });

      const totalRevenueB = doc.specialConsumptionTax.reduce(
        (sum, item) => sum + parseFloat(decimalToString(item.revenue)),
        0
      );
      const totalTaxB = doc.specialConsumptionTax.reduce(
        (sum, item) => sum + parseFloat(decimalToString(item.taxAmount)),
        0
      );

      pdf.text(formatCurrency(totalRevenueB), 332, yPosB + 6, {
        width: 96,
        align: "right",
      });
      pdf.text("", 430, yPosB + 6, { width: 56, align: "center" });
      pdf.text(formatCurrency(totalTaxB), 490, yPosB + 6, {
        width: 61,
        align: "right",
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

      const tableTopC = pdf.y;
      const tableWidthC = 515;
      const rowHeightC = 20;

      // Header
      pdf
        .rect(40, tableTopC, tableWidthC, rowHeightC)
        .fillAndStroke("#e0e0e0", "#000");
      pdf.fillColor("#000").fontSize(8).font("RobotoBold");

      const colWidthsC = [30, 130, 40, 40, 50, 60, 50, 65];
      let xPosC = 40;

      [
        "STT",
        "Tài nguyên, hàng hóa, sản phẩm",
        "Mã CT",
        "ĐVT",
        "Sản lượng",
        "Giá tính thuế",
        "Thuế suất",
        "Số thuế",
      ].forEach((header, index) => {
        const width = colWidthsC[index];
        pdf.text(header, xPosC + 2, tableTopC + 6, {
          width: width - 4,
          align: "center",
        });
        xPosC += width;
      });

      let yPosC = tableTopC + rowHeightC;
      pdf.fontSize(8).font("Roboto");

      // Phân loại theo type
      const resourceTax = doc.environmentalTax.filter(
        (item) => item.type === "resource"
      );
      const envTax = doc.environmentalTax.filter(
        (item) => item.type === "environmental_tax"
      );
      const envFee = doc.environmentalTax.filter(
        (item) => item.type === "environmental_fee"
      );

      let rowIndex = 0;

      // 1. Thuế tài nguyên
      if (resourceTax.length > 0) {
        pdf.text("1. Khai thuế tài nguyên", 42, yPosC + 6, { width: 200 });
        yPosC += rowHeightC;

        resourceTax.forEach((item, idx) => {
          pdf.rect(40, yPosC, tableWidthC, rowHeightC).stroke();

          pdf.text((rowIndex + 1).toString(), 42, yPosC + 6, {
            width: 26,
            align: "center",
          });
          pdf.text(item.itemName, 72, yPosC + 6, { width: 126 });
          pdf.text(
            item.itemCode || `[34${String.fromCharCode(97 + idx)}]`,
            202,
            yPosC + 6,
            { width: 36, align: "center" }
          );
          pdf.text(item.unit, 242, yPosC + 6, { width: 36, align: "center" });
          pdf.text(formatCurrency(item.quantity), 282, yPosC + 6, {
            width: 46,
            align: "right",
          });
          pdf.text(
            formatCurrency(decimalToString(item.unitPrice)),
            332,
            yPosC + 6,
            { width: 56, align: "right" }
          );
          pdf.text(`${item.taxRate}%`, 392, yPosC + 6, {
            width: 46,
            align: "center",
          });
          pdf.text(
            formatCurrency(decimalToString(item.taxAmount)),
            442,
            yPosC + 6,
            { width: 61, align: "right" }
          );

          yPosC += rowHeightC;
          rowIndex++;
        });
      }

      // 2. Thuế bảo vệ môi trường
      if (envTax.length > 0) {
        pdf.text("2. Khai thuế bảo vệ môi trường", 42, yPosC + 6, {
          width: 200,
        });
        yPosC += rowHeightC;

        envTax.forEach((item, idx) => {
          pdf.rect(40, yPosC, tableWidthC, rowHeightC).stroke();

          pdf.text((rowIndex + 1).toString(), 42, yPosC + 6, {
            width: 26,
            align: "center",
          });
          pdf.text(item.itemName, 72, yPosC + 6, { width: 126 });
          pdf.text(
            item.itemCode || `[35${String.fromCharCode(97 + idx)}]`,
            202,
            yPosC + 6,
            { width: 36, align: "center" }
          );
          pdf.text(item.unit, 242, yPosC + 6, { width: 36, align: "center" });
          pdf.text(formatCurrency(item.quantity), 282, yPosC + 6, {
            width: 46,
            align: "right",
          });
          pdf.text(
            formatCurrency(decimalToString(item.unitPrice)),
            332,
            yPosC + 6,
            { width: 56, align: "right" }
          );
          pdf.text(`${item.taxRate}%`, 392, yPosC + 6, {
            width: 46,
            align: "center",
          });
          pdf.text(
            formatCurrency(decimalToString(item.taxAmount)),
            442,
            yPosC + 6,
            { width: 61, align: "right" }
          );

          yPosC += rowHeightC;
          rowIndex++;
        });
      }

      // 3. Phí bảo vệ môi trường
      if (envFee.length > 0) {
        pdf.text("3. Khai phí bảo vệ môi trường", 42, yPosC + 6, {
          width: 200,
        });
        yPosC += rowHeightC;

        envFee.forEach((item, idx) => {
          pdf.rect(40, yPosC, tableWidthC, rowHeightC).stroke();

          pdf.text((rowIndex + 1).toString(), 42, yPosC + 6, {
            width: 26,
            align: "center",
          });
          pdf.text(item.itemName, 72, yPosC + 6, { width: 126 });
          pdf.text(
            item.itemCode || `[36${String.fromCharCode(97 + idx)}]`,
            202,
            yPosC + 6,
            { width: 36, align: "center" }
          );
          pdf.text(item.unit, 242, yPosC + 6, { width: 36, align: "center" });
          pdf.text(formatCurrency(item.quantity), 282, yPosC + 6, {
            width: 46,
            align: "right",
          });
          pdf.text(
            formatCurrency(decimalToString(item.unitPrice)),
            332,
            yPosC + 6,
            { width: 56, align: "right" }
          );
          pdf.text(`${item.taxRate}%`, 392, yPosC + 6, {
            width: 46,
            align: "center",
          });
          pdf.text(
            formatCurrency(decimalToString(item.taxAmount)),
            442,
            yPosC + 6,
            { width: 61, align: "right" }
          );

          yPosC += rowHeightC;
          rowIndex++;
        });
      }

      pdf.moveDown(2);
    }

    // ===== CAM ĐOAN & CHỮ KÝ =====
    pdf.addPage();
    pdf
      .fontSize(10)
      .font("Roboto")
      .text(
        "Tôi cam đoan số liệu khai trên là đúng và chịu trách nhiệm trước pháp luật về những số liệu đã khai./.",
        { align: "justify" }
      );
    pdf.moveDown(3);

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
    console.error(" exportDeclaration error:", err);
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
