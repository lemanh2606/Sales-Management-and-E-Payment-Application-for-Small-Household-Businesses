// controllers/tax/taxController.js - BẢN ĐẦY ĐỦ HỖ TRỢ MẪU 01/CNKD
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

// ✅ Lấy thông tin người nộp thuế từ Store - MỞ RỘNG THEO MẪU 01/CNKD
async function getTaxpayerInfo(storeId) {
  try {
    const store = await Store.findOne({ _id: storeId, deleted: false })
      .populate(
        "owner_id",
        "_id name fullName email dateOfBirth nationality idCard passport"
      )
      .populate("staff_ids", "_id name email")
      .lean();

    if (!store) return {};

    const owner = store.owner_id || {};

    return {
      // [04] Người nộp thuế
      name: owner.fullName || owner.name || store.owner_name || "",

      // [05] Tên cửa hàng/thương hiệu
      storeName: store.name || "",

      // [06] Tài khoản ngân hàng
      bankAccount: store.bankAccount || "",

      // [07] Mã số thuế
      taxCode: store.taxCode || "",

      // [08] Ngành nghề kinh doanh
      businessSector: store.businessSector || store.tags?.join(", ") || "",
      businessSectorChanged: store.businessSectorChanged || false, // [08a]

      // [09] Diện tích kinh doanh
      businessArea: store.area || 0,

      // [09a] Đi thuê
      isRented: store.isRented || false,

      // [10] Số lượng lao động
      employeeCount: store.staff_ids?.length || 0,

      // [11] Thời gian hoạt động
      workingHours: {
        from: store.openingHours?.open || "08:00",
        to: store.openingHours?.close || "22:00",
      },

      // [12] Địa chỉ kinh doanh
      businessAddress: {
        full: store.address || "",
        street: store.addressDetails?.street || "", // [12b]
        ward: store.addressDetails?.ward || "", // [12c]
        district: store.addressDetails?.district || "", // [12d]
        province: store.addressDetails?.province || "", // [12đ]
        borderMarket: store.addressDetails?.borderMarket || false, // [12e]
        changed: store.businessAddressChanged || false, // [12a]
      },

      // [13] Địa chỉ cư trú
      residenceAddress: {
        full: store.ownerResidence?.full || "",
        street: store.ownerResidence?.street || "", // [13a]
        ward: store.ownerResidence?.ward || "", // [13b]
        district: store.ownerResidence?.district || "", // [13c]
        province: store.ownerResidence?.province || "", // [13d]
      },

      // [14] Điện thoại
      phone: store.phone || "",

      // [15] Fax
      fax: store.fax || "",

      // [16] Email
      email: store.email || "",

      // [17] Văn bản ủy quyền khai thuế
      taxAuthorizationDoc: store.taxAuthorizationDoc || null,

      // [18] Thông tin cá nhân (cho CNKD chưa đăng ký thuế)
      personalInfo: {
        dateOfBirth: owner.dateOfBirth || null, // [18a]
        nationality: owner.nationality || "Việt Nam", // [18b]
        idCard: {
          number: owner.idCard?.number || "", // [18c]
          issueDate: owner.idCard?.issueDate || null, // [18c.1]
          issuePlace: owner.idCard?.issuePlace || "", // [18c.2]
        },
        passport: {
          number: owner.passport?.number || "", // [18d]
          issueDate: owner.passport?.issueDate || null, // [18d.1]
          issuePlace: owner.passport?.issuePlace || "", // [18d.2]
        },
        borderPass: owner.borderPass || null, // [18đ]
        borderIdCard: owner.borderIdCard || null, // [18e]
        otherIdDoc: owner.otherIdDoc || null, // [18f]
        permanentResidence: owner.permanentResidence || {}, // [18g]
        currentResidence: owner.currentResidence || {}, // [18h]
        businessRegistration: {
          number: store.businessRegistrationNumber || "", // [18i]
          issueDate: store.businessRegistrationDate || null, // [18i.1]
          issueAuthority: store.businessRegistrationAuthority || "", // [18i.2]
        },
        capital: store.registeredCapital || 0, // [18k]
      },

      // [19-21] Đại lý thuế
      taxAgent: {
        name: store.taxAgent?.name || "", // [19]
        taxCode: store.taxAgent?.taxCode || "", // [20]
        contractNumber: store.taxAgent?.contractNumber || "", // [21]
        contractDate: store.taxAgent?.contractDate || null,
      },

      // [22-27] Tổ chức khai thay
      substituteOrg: {
        name: store.substituteOrg?.name || "", // [22]
        taxCode: store.substituteOrg?.taxCode || "", // [23]
        address: store.substituteOrg?.address || "", // [24]
        phone: store.substituteOrg?.phone || "", // [25]
        fax: store.substituteOrg?.fax || "", // [26]
        email: store.substituteOrg?.email || "", // [27]
      },
    };
  } catch (err) {
    console.error("getTaxpayerInfo error:", err);
    return {};
  }
}

// ✅ Helper: Map category code sang tên tiếng Việt (theo mẫu 01/CNKD)
function getCategoryName(code) {
  const map = {
    goods_distribution: "Phân phối, cung cấp hàng hóa", // [28]
    service_construction: "Dịch vụ, xây dựng không bao thầu nguyên vật liệu", // [29]
    manufacturing_transport:
      "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu nguyên vật liệu", // [30]
    other_business: "Hoạt động kinh doanh khác", // [31]
  };
  return map[code] || code;
}

// ✅ Helper: Map category code sang mã chỉ tiêu
function getCategoryCode(code) {
  const map = {
    goods_distribution: "[28]",
    service_construction: "[29]",
    manufacturing_transport: "[30]",
    other_business: "[31]",
  };
  return map[code] || "";
}

// ✅ Helper: Format kỳ tính thuế theo mẫu 01/CNKD
function formatTaxPeriod(periodType, periodKey) {
  switch (periodType) {
    case "yearly":
      return `[01a] Năm ${periodKey}`;
    case "monthly":
      const [year, month] = periodKey.split("-");
      return `[01b] Tháng ${month} năm ${year}`;
    case "quarterly":
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
 * GET /api/tax/preview?periodType=...&periodKey=...&storeId=...
 */
const previewSystemRevenue = async (req, res) => {
  try {
    const { periodType, periodKey, storeId, monthFrom, monthTo } = req.query;

    if (!periodType || !storeId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu params: periodType, storeId",
      });
    }

    if (periodType !== "custom" && !periodKey) {
      return res.status(400).json({
        success: false,
        message: "Thiếu periodKey cho periodType không phải custom",
      });
    }

    if (periodType === "custom" && (!monthFrom || !monthTo)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu monthFrom/monthTo cho periodType custom",
      });
    }

    const store = await Store.findOne({ _id: storeId, deleted: false });
    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng hoặc cửa hàng đã bị xóa",
      });
    }

    const { start, end } = periodToRange(
      periodType,
      periodKey,
      monthFrom,
      monthTo
    );

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
        },
      },
    ]);

    const systemRevenue = agg[0] ? agg[0].totalRevenue.toFixed(2) : "0.00";

    res.json({
      success: true,
      systemRevenue,
      periodType,
      periodKey,
      storeId,
      monthFrom,
      monthTo,
      start,
      end,
    });
  } catch (err) {
    console.error("previewSystemRevenue error:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi preview doanh thu",
      error: err.message,
    });
  }
};

/**
 * 2. CREATE TAX DECLARATION
 * POST /api/tax
 * Body: { storeId, periodType, periodKey, declaredRevenue, taxRates, ... }
 */
const createTaxDeclaration = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const storeId = req.body.storeId || req.query.storeId;
    const periodType = req.body.periodType || req.query.periodType;
    let periodKey = req.body.periodKey || req.query.periodKey;
    const declaredRevenue =
      req.body.declaredRevenue || req.query.declaredRevenue;
    const createdBy = req.user?._id;

    if (
      periodType === "custom" &&
      typeof periodKey === "string" &&
      periodKey.includes("đến")
    ) {
      const [from, to] = periodKey.split("đến").map((s) => s.trim());
      periodKey = `${from}_${to}`;
    }

    if (!storeId || !periodType || !periodKey || declaredRevenue == null) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message:
          "Thiếu storeId hoặc periodType hoặc periodKey hoặc declaredRevenue",
      });
    }

    const store = await Store.findOne({ _id: storeId, deleted: false }).session(
      session
    );
    if (!store) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cửa hàng hoặc cửa hàng đã bị xóa",
      });
    }

    const existingOriginal = await TaxDeclaration.findOne({
      shopId: storeId,
      periodType,
      periodKey,
      isClone: false,
    }).session(session);

    if (existingOriginal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message:
          "Đã tồn tại tờ khai cho kỳ này. Vui lòng cập nhật tờ khai hiện có hoặc tạo bản sao.",
      });
    }

    let monthFrom = req.body.monthFrom || req.query.monthFrom;
    let monthTo = req.body.monthTo || req.query.monthTo;
    const { start, end } =
      periodType === "custom"
        ? periodToRange(periodType, periodKey, monthFrom, monthTo)
        : periodToRange(periodType, periodKey);

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

    // [28-31] Doanh thu theo nhóm ngành nghề
    const revenueByCategory = (req.body.revenueByCategory || []).map((cat) => ({
      category: cat.category,
      categoryCode: getCategoryCode(cat.category),
      revenue: parseDecimal(cat.revenue || 0),
      gtgtTax: parseDecimal(cat.gtgtTax || 0),
      tncnTax: parseDecimal(cat.tncnTax || 0),
    }));

    // [33] Thuế tiêu thụ đặc biệt (TTĐB)
    const specialConsumptionTax = (req.body.specialConsumptionTax || []).map(
      (item, idx) => ({
        itemName: item.itemName,
        itemCode: `[33${String.fromCharCode(97 + idx)}]`, // [33a], [33b], ...
        unit: item.unit,
        revenue: parseDecimal(item.revenue || 0),
        taxRate: Number(item.taxRate || 0),
        taxAmount: parseDecimal(item.taxAmount || 0),
      })
    );

    // [34-36] Thuế môi trường/tài nguyên
    const environmentalTax = (req.body.environmentalTax || []).map(
      (item, idx) => ({
        type: item.type, // 'resource' | 'environmental_tax' | 'environmental_fee'
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

    const doc = await TaxDeclaration.create(
      [
        {
          shopId: storeId,
          periodType,
          periodKey,
          isFirstTime: req.body.isFirstTime !== false, // [02]
          supplementNumber: req.body.supplementNumber || 0, // [03]
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

    return res.status(201).json({
      success: true,
      message: "Tạo tờ khai thành công",
      declaration: doc[0],
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("createTaxDeclaration error:", err.message);
    console.error(err.stack);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo tờ khai",
      error: err.message,
    });
  }
};

/**
 * 3. UPDATE TAX DECLARATION
 * PUT /api/tax/:id
 */
const updateTaxDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

    const doc = await TaxDeclaration.findById(id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tờ khai",
      });
    }

    if (!["draft", "saved"].includes(doc.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Chỉ tờ khai trạng thái 'draft' hoặc 'saved' mới được chỉnh sửa",
      });
    }

    const userId = req.user?._id;
    if (!isManagerUser(req.user) && String(doc.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ người tạo hoặc manager mới được cập nhật",
      });
    }

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
    }

    if (revenueByCategory) {
      doc.revenueByCategory = revenueByCategory.map((cat) => ({
        category: cat.category,
        categoryCode: getCategoryCode(cat.category),
        revenue: parseDecimal(cat.revenue || 0),
        gtgtTax: parseDecimal(cat.gtgtTax || 0),
        tncnTax: parseDecimal(cat.tncnTax || 0),
      }));
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
      }
    }

    doc.updatedAt = new Date();
    await doc.save();

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

    return res.json({
      success: true,
      message: "Cập nhật tờ khai thành công",
      declaration: doc,
    });
  } catch (err) {
    console.error("updateTaxDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật tờ khai",
      error: err.message,
    });
  }
};

/**
 * 4. CLONE TAX DECLARATION
 * POST /api/tax/:id/clone
 */
const cloneTaxDeclaration = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const source = await TaxDeclaration.findById(id).session(session);
    if (!source) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Nguồn để sao chép không tồn tại",
      });
    }

    const maxVerDoc = await TaxDeclaration.findOne({
      shopId: source.shopId,
      periodType: source.periodType,
      periodKey: source.periodKey,
    })
      .sort({ version: -1 })
      .session(session);

    const newVersion = maxVerDoc ? maxVerDoc.version + 1 : source.version + 1;

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

    return res.status(201).json({
      success: true,
      message: "Tạo bản sao thành công",
      declaration: cloneDoc[0],
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("cloneTaxDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi clone tờ khai",
      error: err.message,
    });
  }
};

/**
 * 5. DELETE TAX DECLARATION
 * DELETE /api/tax/:id
 */
const deleteTaxDeclaration = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const doc = await TaxDeclaration.findById(id).session(session);
    if (!doc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tờ khai",
      });
    }

    if (!isManagerUser(req.user)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "Chỉ Manager mới được xóa tờ khai",
      });
    }

    if (!doc.isClone) {
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

    return res.json({
      success: true,
      message: "Xóa tờ khai thành công",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteTaxDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa tờ khai",
      error: err.message,
    });
  }
};

/**
 * 6. LIST TAX DECLARATIONS
 * GET /api/tax?storeId=...&periodType=...&periodKey=...
 */
const listDeclarations = async (req, res) => {
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
      console.warn("⚠️ Thiếu storeId trong query");
      return res.status(400).json({
        success: false,
        message: "Thiếu storeId",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({
        success: false,
        message: `storeId không hợp lệ: ${storeId}`,
      });
    }

    const q = { shopId: new mongoose.Types.ObjectId(storeId) };

    if (periodType) q.periodType = periodType;
    if (periodKey) q.periodKey = periodKey;
    if (status) q.status = status;
    if (isClone !== undefined) q.isClone = isClone === "true";

    const docs = await TaxDeclaration.find(q)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const total = await TaxDeclaration.countDocuments(q);

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

    return res.json({
      success: true,
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
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tờ khai",
      error: err.message,
    });
  }
};

/**
 * 7. GET SINGLE TAX DECLARATION
 * GET /api/tax/:id
 */
const getDeclaration = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await TaxDeclaration.findById(id)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tờ khai",
      });
    }

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

    return res.json({
      success: true,
      declaration: formatted,
    });
  } catch (err) {
    console.error("getDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết tờ khai",
      error: err.message,
    });
  }
};

/**
 * 8. APPROVE/REJECT TAX DECLARATION
 * POST /api/tax/:id/approve
 */
const approveRejectDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action phải là 'approve' hoặc 'reject'",
      });
    }

    if (!isManagerUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ Manager mới được duyệt/từ chối tờ khai",
      });
    }

    const doc = await TaxDeclaration.findById(id);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tờ khai",
      });
    }

    if (doc.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Chỉ tờ khai đã nộp (submitted) mới được duyệt/từ chối",
      });
    }

    if (action === "approve") {
      doc.status = "approved";
      doc.approvedAt = new Date();
      doc.approvedBy = req.user._id;
      doc.rejectionReason = "";
    } else {
      doc.status = "rejected";
      doc.rejectionReason = rejectionReason || "Không có lý do";
      doc.approvedAt = null;
      doc.approvedBy = null;
    }

    await doc.save();

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

    return res.json({
      success: true,
      message: `${
        action === "approve" ? "Duyệt" : "Từ chối"
      } tờ khai thành công`,
      declaration: doc,
    });
  } catch (err) {
    console.error("approveRejectDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi duyệt/từ chối tờ khai",
      error: err.message,
    });
  }
};

/**
 * 9. EXPORT TAX DECLARATION -> CSV or PDF (THEO MẪU 01/CNKD ĐẦY ĐỦ)
 * GET /api/tax/:id/export?format=pdf|csv
 */
const exportDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format || "pdf").toLowerCase();

    const doc = await TaxDeclaration.findById(id)
      .populate("createdBy", "fullName email")
      .populate("approvedBy", "fullName email")
      .lean();

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tờ khai",
      });
    }

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
      res.send("\uFEFF" + csv);
      return;
    }

    // ===== PDF THEO MẪU 01/CNKD ĐẦY ĐỦ =====
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
      } catch (e) {
        console.error("❌ Lỗi registerFont Roboto:", e);
        pdf.font("Helvetica");
      }
    } else {
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

    pdf.end();
  } catch (err) {
    console.error("exportDeclaration error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi export tờ khai",
      error: err.message,
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
