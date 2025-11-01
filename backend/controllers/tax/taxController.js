// controllers/taxController.js
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Order = require("../../models/Order");
const TaxDeclaration = require("../../models/TaxDeclaration");
const logActivity = require("../../utils/logActivity");
const { periodToRange } = require("../../utils/period");
const { Parser } = require("json2csv");

const parseDecimal = (v) => mongoose.Types.Decimal128.fromString(Number(v || 0).toFixed(2));
const decimalToString = (d) => (d ? d.toString() : "0.00");

function isManagerUser(user) {
  if (!user) return false;
  if (user.isManager) return true;
  if (typeof user.role === "string" && user.role.toLowerCase() === "manager") return true;
  if (Array.isArray(user.roles) && user.roles.includes("manager")) return true;
  return false;
}

// GET /api/tax/preview - Preview doanh thu hệ thống theo kỳ (aggregate Orders paid/printDate)
const previewSystemRevenue = async (req, res) => {
  try {
    const { periodType, periodKey, shopId, monthFrom, monthTo } = req.query; // Params: periodType, periodKey (month/quarter/year), shopId, monthFrom/monthTo (custom)
    if (!periodType || !shopId) {
      return res.status(400).json({ success: false, message: "Thiếu params: periodType, shopId" });
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

    const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo); // Gọi utils với params tùy type

    // Aggregate: chỉ cộng orders đã in (printDate != null) và status = "paid", filter storeId nếu có
    const agg = await Order.aggregate([
      {
        $match: {
          printDate: { $gte: start, $lte: end }, // Filter kỳ (UTC consistent)
          status: "paid", // Chỉ đơn đã thanh toán
          ...(shopId && { storeId: new mongoose.Types.ObjectId(shopId) }), // Thêm 'new' cho ObjectId(shopId) trong $match
        },
      },
      {
        $group: {
          _id: null, // Group all
          totalRevenue: { $sum: { $toDouble: "$totalAmount" } }, // $toDouble convert Decimal128 sang number trước sum
        },
      },
    ]);

    const systemRevenue = agg[0] ? agg[0].totalRevenue.toFixed(2) : "0.00"; // Convert sang string fixed 2 decimal

    res.json({
      success: true,
      systemRevenue, // Doanh thu hệ thống (tham khảo)
      periodType,
      periodKey,
      shopId,
      monthFrom,
      monthTo,
    });
  } catch (err) {
    console.error("previewSystemRevenue error:", err); // Log debug tiếng Việt error
    res.status(500).json({ success: false, message: "Lỗi server khi preview doanh thu" });
  }
};
/**
 * CREATE tax declaration
 * POST /api/tax
 * Body: { shopId, periodType, periodKey, declaredRevenue, createdBy }
 * - Nếu đã có bản gốc cùng (shopId + periodType + periodKey + isClone:false) => trả 409
 */
const createTaxDeclaration = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const shopId = req.body.shopId || req.query.shopId;
    const periodType = req.body.periodType || req.query.periodType;
    let periodKey = req.body.periodKey || req.query.periodKey; // dùng let vì có thể sửa giá trị bên dưới
    const declaredRevenue = req.body.declaredRevenue || req.query.declaredRevenue;
    // ✅ NẾU là custom → chuyển "YYYY-MM đến YYYY-MM" thành "YYYY-MM_YYYY-MM"
    if (periodType === "custom" && typeof periodKey === "string" && periodKey.includes("đến")) {
      const [from, to] = periodKey.split("đến").map((s) => s.trim());
      periodKey = `${from}_${to}`;
    }

    const createdBy = req.user?._id;

    if (!shopId || !periodType || !periodKey || declaredRevenue == null) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ success: false, message: "Thiếu shopId hoặc periodType hoặc periodKey hoặc declaredRevenue" });
    }

    // Check tồn tại 'bản gốc' cùng kỳ: nếu có -> block (409)
    const existingOriginal = await TaxDeclaration.findOne({
      shopId,
      periodType,
      periodKey,
      isClone: false,
    }).session(session);

    if (existingOriginal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: "Đã tồn tại tờ khai cho kỳ này. Vui lòng cập nhật tờ khai hiện có hoặc tạo bản sao.",
      });
    }

    // Tính systemRevenue bằng aggregate (chỉ orders printed & paid), Nếu là custom thì lấy monthFrom, monthTo từ body hoặc query
    let monthFrom = req.body.monthFrom || req.query.monthFrom;
    let monthTo = req.body.monthTo || req.query.monthTo;
    const { start, end } =
      periodType === "custom"
        ? periodToRange(periodType, periodKey, monthFrom, monthTo)
        : periodToRange(periodType, periodKey);

    const agg = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(shopId),
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

    const systemRevenueDecimal = agg[0]?.total ? agg[0].total : mongoose.Types.Decimal128.fromString("0.00");

    // Thuế suất mặc định (có thể config per-store sau này)
    const gtgtRate = 1.0; // %
    const tncnRate = 0.5; // %

    const declaredNum = Number(declaredRevenue);
    const gtgtAmount = (declaredNum * gtgtRate) / 100;
    const tncnAmount = (declaredNum * tncnRate) / 100;
    const totalTax = gtgtAmount + tncnAmount;

    // Tạo bản gốc (isClone: false, originalId: null, version:1)
    const doc = await TaxDeclaration.create(
      [
        {
          shopId,
          periodType,
          periodKey,
          systemRevenue: systemRevenueDecimal,
          declaredRevenue: parseDecimal(declaredNum),
          taxRates: { gtgt: gtgtRate, tncn: tncnRate },
          taxAmounts: {
            gtgt: parseDecimal(gtgtAmount),
            tncn: parseDecimal(tncnAmount),
            total: parseDecimal(totalTax),
          },
          createdBy,
          originalId: null,
          isClone: false,
          version: 1,
          status: "saved",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // 📘 Ghi log sau khi tạo thành công
    await logActivity({
      user: req.user,
      store: { _id: shopId },
      action: "create",
      entity: "TaxDeclaration",
      entityId: doc[0]._id,
      entityName: `${periodType}-${periodKey}`,
      req,
      description: `Tạo tờ khai thuế kỳ ${periodType} ${periodKey} cho cửa hàng ${shopId}`,
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
    return res.status(500).json({ success: false, message: "Lỗi server khi tạo tờ khai" });
  }
};

/**
 * UPDATE tax declaration
 * PUT /api/tax/:id
 * Body: { declaredRevenue } (chỉ cho edit declaredRevenue khi status = saved)
 */
const updateTaxDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const { declaredRevenue } = req.body;

    if (declaredRevenue == null) {
      return res.status(400).json({ success: false, message: "Thiếu declaredRevenue" });
    }

    const doc = await TaxDeclaration.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy tờ khai" });

    // Chỉ cho phép chỉnh sửa khi status = 'saved'
    if (doc.status !== "saved") {
      return res.status(400).json({
        success: false,
        message: "Chỉ tờ khai trạng thái 'saved' mới được chỉnh sửa",
      });
    }

    // Quyền: chỉ creator hoặc manager mới update (để an toàn)
    const userId = req.user?._id;
    if (!isManagerUser(req.user) && String(doc.createdBy) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ người tạo hoặc manager mới được cập nhật",
      });
    }

    // Recompute tax amounts based on new declaredRevenue
    const declaredNum = Number(declaredRevenue);
    const gtgtAmount = (declaredNum * (doc.taxRates.gtgt || 1.0)) / 100;
    const tncnAmount = (declaredNum * (doc.taxRates.tncn || 0.5)) / 100;
    const totalTax = gtgtAmount + tncnAmount;

    doc.declaredRevenue = parseDecimal(declaredNum);
    doc.taxAmounts.gtgt = parseDecimal(gtgtAmount);
    doc.taxAmounts.tncn = parseDecimal(tncnAmount);
    doc.taxAmounts.total = parseDecimal(totalTax);
    doc.updatedAt = new Date();

    await doc.save();

    // 📘 Ghi log sau khi cập nhật thành công
    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: "update",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `Cập nhật doanh thu kê khai của tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey} cho cửa hàng ${doc.shopId}`,
    });

    return res.json({
      success: true,
      message: "Cập nhật tờ khai thành công",
      declaration: doc,
    });
  } catch (err) {
    console.error("updateTaxDeclaration error:", err);
    return res.status(500).json({ success: false, message: "Lỗi server khi cập nhật tờ khai" });
  }
};

/**
 * CLONE tax declaration
 * POST /api/tax/:id/clone
 * Tạo bản sao (isClone=true) từ bản gốc hoặc từ 1 bản bất kỳ.
 * - version sẽ được set = max(version of same period/shop) + 1
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
      return res.status(404).json({ success: false, message: "Nguồn để sao chép không tồn tại" });
    }

    // Tính version mới: lấy MAX(version) cùng shop+period + 1
    const maxVerDoc = await TaxDeclaration.findOne({
      shopId: source.shopId,
      periodType: source.periodType,
      periodKey: source.periodKey,
    })
      .sort({ version: -1 })
      .session(session);

    const newVersion = maxVerDoc ? maxVerDoc.version + 1 : source.version + 1;

    // Tạo bản sao (isClone true)
    const cloneDoc = await TaxDeclaration.create(
      [
        {
          shopId: source.shopId,
          periodType: source.periodType,
          periodKey: source.periodKey,
          systemRevenue: source.systemRevenue,
          declaredRevenue: source.declaredRevenue,
          taxRates: source.taxRates,
          taxAmounts: source.taxAmounts,
          createdBy: req.user?._id,
          originalId: source.originalId ? source.originalId : source._id, // giữ link về bản gốc nếu có, nếu không -> source._id
          isClone: true,
          version: newVersion,
          status: "saved",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // 📘 Ghi log sau khi tạo thành công
    await logActivity({
      user: req.user,
      store: { _id: source.shopId },
      action: "create",
      entity: "TaxDeclaration",
      entityId: cloneDoc[0]._id,
      entityName: `${source.periodType}-${source.periodKey}`,
      req,
      description: `Tạo bản sao tờ khai thuế kỳ ${source.periodType} ${source.periodKey} từ bản gốc ${source._id}`,
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
    return res.status(500).json({ success: false, message: "Lỗi server khi clone tờ khai" });
  }
};

/**
 * DELETE tax declaration
 * DELETE /api/tax/:id
 * Chỉ Manager được xóa
 * Nếu xóa bản gốc mà tồn tại bản sao -> nâng 1 bản sao thành bản gốc (originalId null, isClone false)
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
      return res.status(404).json({ success: false, message: "Không tìm thấy tờ khai" });
    }

    // Quyền: chỉ manager được xóa
    if (!isManagerUser(req.user)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: "Chỉ Manager mới được xóa tờ khai" });
    }

    // Nếu xóa bản gốc (isClone == false), tìm 1 bản sao cùng kỳ và nâng lên làm gốc
    if (!doc.isClone) {
      // tìm bản sao cùng shop + period, version lớn nhất
      const clone = await TaxDeclaration.findOne({
        shopId: doc.shopId,
        periodType: doc.periodType,
        periodKey: doc.periodKey,
        isClone: true,
      })
        .sort({ version: -1 })
        .session(session);

      if (clone) {
        // Nâng bản sao lên làm gốc
        clone.originalId = null;
        clone.isClone = false;
        // giữ version như cũ hoặc reset? Chúng ta giữ version value
        await clone.save({ session });
        // ghi log nhật ký hoạt động
        await logActivity({
          user: req.user,
          store: { _id: doc.shopId },
          action: "restore",
          entity: "TaxDeclaration",
          entityId: clone._id,
          entityName: `${clone.periodType}-${clone.periodKey}`,
          req,
          description: `Tự động nâng bản sao tờ khai thuế phiên bản ${clone.version} lên làm bản gốc sau khi xóa bản gốc`,
        });
      }
    }

    await doc.deleteOne({ session }); //Từ Mongoose v7 trở lên, phương thức .remove() đã bị loại bỏ, phải dùng deleteOne()

    await session.commitTransaction();
    session.endSession();

    // 📘 Ghi log sau khi xóa thành công
    await logActivity({
      user: req.user,
      store: { _id: doc.shopId },
      action: "delete",
      entity: "TaxDeclaration",
      entityId: doc._id,
      entityName: `${doc.periodType}-${doc.periodKey}`,
      req,
      description: `Xóa tờ khai thuế kỳ ${doc.periodType} ${doc.periodKey} của cửa hàng ${doc.shopId}`,
    });

    return res.json({ success: true, message: "Xóa tờ khai thành công" });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteTaxDeclaration error:", err);
    return res.status(500).json({ success: false, message: "Lỗi server khi xóa tờ khai" });
  }
};

/**
 * LIST tax declarations
 * GET /api/taxs?shopId=...&page=1&limit=20
 * Có thể filter theo periodType/periodKey nếu muốn
 */
const listDeclarations = async (req, res) => {
  try {
    const { shopId, periodType, periodKey, page = 1, limit = 20 } = req.query;
    // Kiểm tra bắt buộc
    if (!shopId) {
      console.warn("⚠️ Thiếu shopId trong query");
      return res.status(400).json({ success: false, message: "Thiếu shopId" });
    }
    // Kiểm tra ObjectId hợp lệ
    const isValidId = mongoose.Types.ObjectId.isValid(shopId);

    if (!isValidId) {
      return res.status(400).json({
        success: false,
        message: `shopId không hợp lệ: ${shopId}`,
      });
    }
    // Tạo query object
    const q = { shopId: new mongoose.Types.ObjectId(shopId) };

    if (periodType) q.periodType = periodType;
    if (periodKey) q.periodKey = periodKey;

    // Thực thi query
    const docs = await TaxDeclaration.find(q)
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    // Format trả về: chuyển Decimal128 sang string
    const data = docs.map((d) => ({
      ...d,
      systemRevenue: decimalToString(d.systemRevenue),
      declaredRevenue: decimalToString(d.declaredRevenue),
      taxAmounts: {
        gtgt: decimalToString(d.taxAmounts?.gtgt),
        tncn: decimalToString(d.taxAmounts?.tncn),
        total: decimalToString(d.taxAmounts?.total),
      },
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ listDeclarations error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách tờ khai",
      error: err.message, // thêm log lỗi chi tiết ra response nếu cần debug
    });
  }
};

/**
 * EXPORT tax declaration -> CSV or PDF
 * GET /api/tax/:id/export?format=csv
 */
const exportDeclaration = async (req, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format || "pdf").toLowerCase();

    const doc = await TaxDeclaration.findById(id).populate("createdBy", "fullName email");
    if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy tờ khai" });

    const payload = {
      shopId: String(doc.shopId),
      periodType: doc.periodType,
      periodKey: doc.periodKey,
      version: doc.version,
      originalId: doc.originalId ? String(doc.originalId) : null,
      isClone: !!doc.isClone,
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
    };

    if (format === "csv") {
      const fields = Object.keys(payload);
      const parser = new Parser({ fields });
      const csv = parser.parse([payload]);
      res.header("Content-Type", "text/csv");
      res.attachment(`tax-declaration-${doc.periodKey}-v${doc.version}.csv`);
      res.send(csv);
    } else {
      const pdf = new PDFDocument({ margin: 40 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=tax-declaration-${doc.periodKey}-v${doc.version}.pdf`);

      pdf.pipe(res);

      pdf.fontSize(18).text("TỜ KHAI THUẾ - SmartRetail", { align: "center" });
      pdf.moveDown();
      pdf.fontSize(12).text(`Kỳ khai: ${doc.periodKey} (${doc.periodType})`);
      pdf.text(`Version: v${doc.version}`);
      pdf.text(`Bản sao: ${doc.isClone ? "Có" : "Không"}`);
      pdf.text(`Trạng thái: ${doc.status}`);
      pdf.text(`Người lập: ${payload.createdBy}`);
      pdf.text(`Ngày lập: ${new Date(payload.createdAt).toLocaleString("vi-VN")}`);
      pdf.moveDown();

      pdf.text(`Doanh thu hệ thống: ${payload.systemRevenue} VND`);
      pdf.text(`Doanh thu khai báo: ${payload.declaredRevenue} VND`);
      pdf.text(`Thuế GTGT (${payload.gtgtRate}%): ${payload.gtgtAmount} VND`);
      pdf.text(`Thuế TNCN (${payload.tncnRate}%): ${payload.tncnAmount} VND`);
      pdf.moveDown();
      pdf.fontSize(14).text(`TỔNG THUẾ PHẢI NỘP: ${payload.totalTax} VND`, { align: "left" });

      pdf.end();
    }
  } catch (err) {
    console.error("exportDeclaration error:", err);
    return res.status(500).json({ success: false, message: "Lỗi server khi export tờ khai" });
  }
};

module.exports = {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  exportDeclaration,
};
