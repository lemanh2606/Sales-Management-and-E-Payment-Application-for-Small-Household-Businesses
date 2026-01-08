// backend/controllers/revenueController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const { periodToRange } = require("../utils/period");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
// NOTE: `xlsx` community build ignores most cell styles.
// Use `xlsx-js-style` to generate styled xlsx files.
const XLSX = require("xlsx-js-style");
const dayjs = require("dayjs");
require("dayjs/locale/vi");
dayjs.locale("vi");

// Các trạng thái đơn hàng được tính vào doanh thu.
// Lưu ý: `partially_refunded` vẫn tính doanh thu theo `totalAmount/subtotal` hiện có trong DB.
const PAID_STATUSES = ["paid", "partially_refunded"]; // thống kê doanh thu tính cả hoàn 1 phần

// Ép id về ObjectId an toàn (tránh lỗi khi id là number/undefined).
function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}

// Convert mọi thứ về number (NaN -> 0) để tránh lỗi khi export/xử lý số.
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Parse năm từ query (nếu sai/thiếu thì fallback về năm hiện tại).
function parseYear(value, fallbackYear = dayjs().year()) {
  const y = Number(value);
  if (!Number.isFinite(y) || y < 1970 || y > 3000) return fallbackYear;
  return y;
}

function safeFilePart(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Unknown";
  // Bỏ dấu tiếng Việt + loại ký tự không hợp lệ cho tên file.
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || "Unknown";
}

function getExporterNameDisplay(req) {
  const name =
    req?.user?.fullname ||
    req?.user?.fullName ||
    req?.user?.name ||
    req?.user?.username ||
    req?.user?.email;
  const trimmed = String(name ?? "").trim();
  return trimmed || "Không rõ";
}

function getExporterNameForFile(req) {
  return safeFilePart(getExporterNameDisplay(req));
}

const path = require("path");

function buildExportFileName({ reportName, req, periodKey }) {
  const exportDate = dayjs().format("DD-MM-YYYY");
  const exporterName = getExporterNameForFile(req);
  const reportPart = safeFilePart(reportName);

  // Chỉ report chi tiết (exportRevenue) mới thêm kì xuất.
  if (periodKey) {
    return `${reportPart}_${exportDate}_${exporterName}_${safeFilePart(periodKey)}.xlsx`;
  }
  return `${reportPart}_${exportDate}_${exporterName}.xlsx`;
}

function periodTypeToVietnamese(periodType) {
  const t = String(periodType || "").toLowerCase();
  if (t === "day") return "Ngày";
  if (t === "month") return "Tháng";
  if (t === "quarter") return "Quý";
  if (t === "year") return "Năm";
  // fallback: viết hoa chữ cái đầu
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—";
}

function createWorksheetWithReportHeader({ reportTitle, req, sheetData }) {
  const exporterName = getExporterNameDisplay(req);
  const storeName = req.store?.name || "Cửa hàng";
  
  const headerAOA = [
    [storeName.toUpperCase(), "", "", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
    ["", "", "", "Độc lập - Tự do - Hạnh phúc"],
    ["", "", "", "-----------------"],
    [],
    ["", reportTitle.toUpperCase()],
    ["", `Người xuất: ${exporterName}`],
    ["", `Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`],
    [],
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerAOA);

  // Merge cells for legal header and title
  if (!ws["!merges"]) ws["!merges"] = [];
  ws["!merges"].push({ s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }); // Motto line 1
  ws["!merges"].push({ s: { r: 1, c: 3 }, e: { r: 1, c: 6 } }); // Motto line 2
  ws["!merges"].push({ s: { r: 2, c: 3 }, e: { r: 2, c: 6 } }); // Motto dash
  ws["!merges"].push({ s: { r: 4, c: 1 }, e: { r: 4, c: 4 } }); // Title

  XLSX.utils.sheet_add_json(ws, sheetData, {
    origin: "A9",
    skipHeader: false,
  });

  // ===== Styling (nếu lib xlsx build hiện tại hỗ trợ cell styles) =====
  const styleCell = (addr, style) => {
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = { ...(ws[addr].s || {}), ...style };
  };

  // 2 dòng header trên cùng
  const topLabelStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF1890FF" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const topValueStyle = {
    font: { bold: true, color: { rgb: "FF262626" } },
    alignment: { horizontal: "left", vertical: "center" },
  };

  styleCell("A1", topLabelStyle);
  styleCell("A2", topLabelStyle);
  styleCell("B1", topValueStyle);
  styleCell("B2", topValueStyle);

  // Header của bảng dữ liệu nằm ở dòng 4 (index 3) vì có 2 dòng header + 1 dòng trống.
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: "FF1890FF" } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  if (ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const headerRowIndex = 3;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
      if (!ws[addr]) continue;
      ws[addr].s = { ...(ws[addr].s || {}), ...headerStyle };
    }
  }

  // Chiều cao hàng cho dễ nhìn
  ws["!rows"] = ws["!rows"] || [];
  ws["!rows"][0] = { hpt: 20 };
  ws["!rows"][1] = { hpt: 20 };
  ws["!rows"][2] = { hpt: 8 };
  ws["!rows"][3] = { hpt: 18 };

  return ws;
}

// ========== HÀM TÍNH DOANH THU – CÓ CẢ HOÀN 1 NỬA partially_refunded ==========
async function calcRevenueByPeriod({ storeId, periodType, periodKey, type = "total" }) {
  // Chuyển periodType + periodKey (vd: month + 2025-12) thành khoảng ngày [start, end]
  const { start, end } = periodToRange(periodType, periodKey);

  // Chỉ lấy các đơn ĐÃ THANH TOÁN (toàn bộ hoặc 1 phần)
  const baseMatch = {
    storeId: toObjectId(storeId),
    status: { $in: PAID_STATUSES }, // ← quan trọng: lấy cả 2 loại
    createdAt: { $gte: start, $lte: end },
  };

  if (type === "total") {
    const pipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $toDecimal: "$totalAmount" },
          },
          countOrders: { $sum: 1 },
          //đếm đơn đã hoàn thành
          completedOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, 1, 0],
            },
          },
          //đếm đơn hoàn 1 nữa vì vẫn có doanh thu
          partialRefundOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "partially_refunded"] }, 1, 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: { $toDouble: "$totalRevenue" },
          countOrders: 1,
          completedOrders: 1,
          partialRefundOrders: 1,
          avgOrderValue: {
            $cond: [{ $gt: ["$countOrders", 0] }, { $toDouble: { $divide: ["$totalRevenue", "$countOrders"] } }, 0],
          },
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const row = result[0] || { totalRevenue: 0, countOrders: 0 };
    const dailyPipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
                timezone: "Asia/Ho_Chi_Minh",
              },
            },
          },
          revenue: { $sum: { $toDecimal: "$totalAmount" } },
          countOrders: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
      {
        $project: {
          _id: 0,
          day: "$_id.day",
          revenue: { $toDouble: "$revenue" },
          countOrders: 1,
        },
      },
    ];
    const dailyRevenue = await Order.aggregate(dailyPipeline);

    return [
      {
        periodType,
        periodKey,
        periodStart: start,
        periodEnd: end,
        totalRevenue: row.totalRevenue,
        countOrders: row.countOrders,
        // ✅ THÊM 2 FIELD NÀY
        completedOrders: row.completedOrders || 0,
        partialRefundOrders: row.partialRefundOrders || 0,
        avgOrderValue: row.avgOrderValue || 0,
        // ✅ THÊM MỚI – FE xài chart
        dailyRevenue,
      },
    ];
  }

  // =================== THEO NHÂN VIÊN ===================
  if (type === "employee") {
    const pipeline = [
      {
        $match: {
          ...baseMatch,
          // employeeId: { $ne: null }, // REMOVED to include Owner sales
        },
      },
      {
        $group: {
          _id: "$employeeId",
          totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          countOrders: { $sum: 1 },
        },
      },
      {
        $addFields: {
          totalRevenueDouble: { $toDouble: "$totalRevenue" },
          avgOrderValue: {
            $cond: [{ $gt: ["$countOrders", 0] }, { $toDouble: { $divide: ["$totalRevenue", "$countOrders"] } }, 0],
          },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employeeInfo",
          pipeline: [{ $project: { fullName: 1, phone: 1 } }],
        },
      },
      { $unwind: { path: "$employeeInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // If _id (employeeId) is null, it's the Owner/Admin. IF _id exists but lookup failed, it's deleted staff.
          employeeInfo: {
            fullName: {
              $cond: {
                if: { $eq: ["$_id", null] },
                then: "Chủ cửa hàng (Admin)",
                else: { $ifNull: ["$employeeInfo.fullName", "Nhân viên đã nghỉ"] },
              },
            },
            phone: { $ifNull: ["$employeeInfo.phone", ""] },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ];

    const result = await Order.aggregate(pipeline);
    return (result || []).map((row) => ({
      ...row,
      periodType,
      periodKey,
      periodStart: start,
      periodEnd: end,
      // keep original Decimal128 field for backward compatibility
      totalRevenueNumber: typeof row.totalRevenueDouble === "number" ? row.totalRevenueDouble : undefined,
    }));
  }

  return [];
}

// ========== 1️⃣ GET /api/revenue ==========
const getRevenueByPeriod = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const { periodType, periodKey } = req.query;

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }

    const data = await calcRevenueByPeriod({
      storeId,
      periodType,
      periodKey,
      type: "total",
    });
    const revenue = data[0] || { totalRevenue: 0, countOrders: 0 };
    res.json({ message: "Báo cáo doanh thu thành công", revenue });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu:", err.message);
    res.status(500).json({ message: "Lỗi server khi báo cáo doanh thu" });
  }
};

// ========== 2️⃣ GET /api/revenue/employee ==========
const getRevenueByEmployee = async (req, res) => {
  try {
    const { periodType, periodKey, storeId } = req.query;

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }

    const data = await calcRevenueByPeriod({
      storeId,
      periodType,
      periodKey,
      type: "employee",
    });
    res.json({ message: "Báo cáo doanh thu theo nhân viên thành công", data });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu theo nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi báo cáo doanh thu theo nhân viên" });
  }
};

// ========== 3️⃣ GET /api/revenue/export ==========
const exportRevenue = async (req, res) => {
  try {
    const { periodType, periodKey, storeId, format = "xlsx" } = req.query;

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }

    // LẤY CẢ 2 DỮ LIỆU
    const [totalData, empData] = await Promise.all([
      calcRevenueByPeriod({ storeId, periodType, periodKey, type: "total" }),
      calcRevenueByPeriod({ storeId, periodType, periodKey, type: "employee" }),
    ]);

    const totalRow = totalData?.[0] || null;

    if (format === "xlsx") {
      const totalRevenueForShare = Number(totalRow?.totalRevenue || 0) || 0;
      const periodStart = totalRow?.periodStart;
      const periodEnd = totalRow?.periodEnd;
      const periodStartText = periodStart ? dayjs(periodStart).format("DD/MM/YYYY") : "—";
      const periodEndText = periodEnd ? dayjs(periodEnd).format("DD/MM/YYYY") : "—";

      const wb = XLSX.utils.book_new();
      const reportTitle = "Báo cáo doanh thu chi tiết";

      // Sheet 1: Tổng hợp
      if (totalData && totalData.length > 0) {
        const totalSheetData = totalData.map((item) => ({
          "Loại kỳ": periodTypeToVietnamese(item.periodType),
          "Mã kỳ": item.periodKey,
          "Từ ngày": item.periodStart ? dayjs(item.periodStart).format("DD/MM/YYYY") : "—",
          "Đến ngày": item.periodEnd ? dayjs(item.periodEnd).format("DD/MM/YYYY") : "—",
          "Tổng doanh thu (VNĐ)": Number(item.totalRevenue),
          "Số hóa đơn": item.countOrders,
          "Số đơn hoàn tất": item.completedOrders || 0,
          "Số đơn hoàn 1 phần": item.partialRefundOrders || 0,
          "TB / hóa đơn (VNĐ)": Number(item.avgOrderValue || 0),
        }));
        const ws1 = createWorksheetWithReportHeader({ reportTitle, req, sheetData: totalSheetData });
        ws1["!cols"] = [
          { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");
      }

      // Sheet 2: Nhân viên
      if (empData && empData.length > 0) {
        const empSheetData = empData.map((item) => ({
          "Loại kỳ": periodTypeToVietnamese(item.periodType || periodType),
          "Mã kỳ": item.periodKey || periodKey,
          "Từ ngày": periodStartText,
          "Đến ngày": periodEndText,
          "Nhân viên": item.employeeInfo?.fullName || "Nhân viên đã nghỉ",
          "Số điện thoại": item.employeeInfo?.phone || "—",
          "Doanh thu (VNĐ)": Number(item.totalRevenueNumber ?? item.totalRevenueDouble ?? item.totalRevenue),
          "Số hóa đơn": item.countOrders,
          "TB / hóa đơn (VNĐ)": Number(item.avgOrderValue || 0),
          "% tổng doanh thu": totalRevenueForShare > 0
              ? Number(((Number(item.totalRevenueNumber ?? item.totalRevenueDouble ?? item.totalRevenue) || 0) / totalRevenueForShare) * 100).toFixed(2)
              : "0.00",
        }));

        const ws2 = createWorksheetWithReportHeader({ reportTitle, req, sheetData: empSheetData });
        ws2["!cols"] = [
          { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 16 }
        ];
        XLSX.utils.book_append_sheet(wb, ws2, "Nhân viên");
      }

      if (!totalData?.length && !empData?.length) {
        return res.status(404).json({ message: "Không có dữ liệu để xuất" });
      }

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu", req, periodKey: periodKey || "hien_tai" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // 1. Legal Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.fontSize(9).font("Roboto-Italic").text("-----------------", { align: "right" });
      doc.moveDown(2);

      // 2. Title
      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO DOANH THU CHI TIẾT", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(`Kỳ báo cáo: ${periodKey || "Hiện tại"} (${periodTypeToVietnamese(periodType)})`, { align: "center" });
      doc.moveDown(2);

      // 3. Info
      doc.font("Roboto-Regular").fontSize(10).text(`Người xuất: ${getExporterNameDisplay(req)}`);
      doc.text(`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // 4. Content - Summary
      doc.font("Roboto-Bold").fontSize(12).text("TỔNG HỢP CHUNG");
      doc.font("Roboto-Regular").fontSize(10);
      if (totalRow) {
        doc.text(`Tổng doanh thu: ${new Intl.NumberFormat("vi-VN").format(totalRow.totalRevenue)} VND`);
        doc.text(`Số hóa đơn: ${totalRow.countOrders}`);
        doc.text(`Giá trị trung bình/đơn: ${new Intl.NumberFormat("vi-VN").format(totalRow.avgOrderValue)} VND`);
      }
      doc.moveDown(2);

      // 5. Content - Employee breakdown
      if (empData && empData.length > 0) {
        doc.font("Roboto-Bold").fontSize(12).text("CHI TIẾT THEO NHÂN VIÊN");
        doc.moveDown(0.5);
        empData.forEach((emp, idx) => {
          doc.font("Roboto-Regular").fontSize(10).text(`${idx + 1}. ${emp.employeeInfo?.fullName || "N/A"}: ${new Intl.NumberFormat("vi-VN").format(emp.totalRevenueNumber ?? emp.totalRevenue)} VND (${emp.countOrders} đơn)`);
        });
      }

      doc.moveDown(3);

      // 6. Signatures
      const startY = doc.y > 650 ? (doc.addPage(), 50) : doc.y;
      doc.font("Roboto-Bold").text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Kế toán trưởng", 220, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, { width: 150, align: "center" });
      
      doc.font("Roboto-Italic").fontSize(9).text("(Ký, họ tên)", 50, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên)", 220, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên, đóng dấu)", 390, doc.y, { width: 150, align: "center" });

      doc.end();
      return;
    }

    res.status(400).json({ message: "Format không hỗ trợ" });
  } catch (err) {
    console.error("Lỗi export báo cáo doanh thu:", err);
    res.status(500).json({ message: "Lỗi server khi xuất báo cáo" });
  }
};

// ===============================
// TEMPLATE 1: TỔNG HỢP (theo năm, breakdown theo tháng)
// Template file: "Báo cáo doanh thu bán hàng tổng hợp.xlsx"
// Columns:
// - Thời gian | Năm | Số mặt hàng bán ra | Doanh thu
// ===============================
const getRevenueSummaryByYear = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const orderMatch = {
      storeId: toObjectId(storeId),
      status: { $in: PAID_STATUSES },
      createdAt: { $gte: start, $lte: end },
    };

    // Lấy doanh thu theo tháng từ Order.totalAmount
    // + Lấy số lượng mặt hàng bán ra theo tháng từ OrderItem.quantity (join sang Order để lọc store/ngày/status)
    const [revenueByMonth, qtyByMonth] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: { month: { $month: "$createdAt" } },
            revenue: { $sum: { $toDecimal: "$totalAmount" } },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id.month",
            revenue: { $toDouble: "$revenue" },
          },
        },
        { $sort: { month: 1 } },
      ]),
      OrderItem.aggregate([
        // Join Order để lọc theo store/status/createdAt (OrderItem chỉ có orderId)
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $match: {
            "order.storeId": toObjectId(storeId),
            "order.status": { $in: PAID_STATUSES },
            "order.createdAt": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { month: { $month: "$order.createdAt" } },
            itemsSold: { $sum: "$quantity" },
          },
        },
        {
          $project: {
            _id: 0,
            month: "$_id.month",
            itemsSold: 1,
          },
        },
        { $sort: { month: 1 } },
      ]),
    ]);

    const revenueMap = new Map((revenueByMonth || []).map((r) => [r.month, safeNumber(r.revenue)]));
    const qtyMap = new Map((qtyByMonth || []).map((r) => [r.month, safeNumber(r.itemsSold)]));

    // Xuất đủ 12 tháng: tháng không có dữ liệu -> 0 (đúng format template tổng hợp)
    const rows = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      return {
        time: `Tháng ${month}`,
        year,
        itemsSold: qtyMap.get(month) || 0,
        revenue: revenueMap.get(month) || 0,
      };
    });

    return res.json({ message: "Báo cáo tổng hợp doanh thu theo năm", data: rows });
  } catch (err) {
    console.error("Lỗi báo cáo tổng hợp doanh thu theo năm:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo tổng hợp" });
  }
};

const exportRevenueSummaryByYear = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    const { format = "xlsx" } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }
    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    // Reuse lại logic JSON để đảm bảo export và API trả cùng dữ liệu
    const fakeReq = { query: { storeId, year } };
    let rows;
    await getRevenueSummaryByYear(fakeReq, {
      json: ({ data }) => {
        rows = data;
      },
      status: () => ({ json: () => {} }),
    });

    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    // Map theo đúng cột của template
    const sheetData = rows.map((r) => ({
      "Thời gian": r.time,
      Năm: r.year,
      "Số mặt hàng bán ra": r.itemsSold,
      "Doanh thu (VNĐ)": r.revenue,
    }));

    const ws = createWorksheetWithReportHeader({
      reportTitle: "Báo cáo doanh thu bán hàng tổng",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo doanh thu bán hàng tổng");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Tong_Hop", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Tong_Hop", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // Legal Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.fontSize(9).font("Roboto-Italic").text("-----------------", { align: "right" });
      doc.moveDown(2);

      // Title
      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO DOANH THU TỔNG HỢP", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(`Năm: ${year}`, { align: "center" });
      doc.moveDown(2);

      // Info
      doc.font("Roboto-Regular").fontSize(10).text(`Người xuất: ${getExporterNameDisplay(req)}`);
      doc.text(`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Data
      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(11).text(`${idx + 1}. Tháng ${r.monthLabel || ""}`);
        doc.font("Roboto-Regular").fontSize(10);
        doc.text(`   Sản phẩm bán ra: ${safeNumber(r.itemsSold)}`, { indent: 20 });
        doc.text(`   Doanh thu: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.totalRevenue))} VND`, { indent: 20 });
        doc.moveDown(0.5);
      });

      doc.moveDown(2);
      // Signatures
      const startY = doc.y > 650 ? (doc.addPage(), 50) : doc.y;
      doc.font("Roboto-Bold").fontSize(10).text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, { width: 150, align: "center" });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo tổng hợp:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE 2: BÁN HÀNG THEO NGÀY (theo sản phẩm)
// Template file: "Báo cáo doanh bán hàng thu hàng ngày.xlsx"
// Columns:
// - Mã hàng | Tên sản phẩm | Mô tả sản phẩm | Đơn giá | Số lượng | Tổng | Giảm giá | Tổng giảm | Thực thu
// Thiếu dữ liệu giảm giá riêng: sẽ suy ra từ chênh lệch (gross - subtotal) nếu có.
// ===============================
const getDailyProductSales = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const date = req.query.date; // YYYY-MM-DD

    if (!storeId || !date) {
      return res.status(400).json({ message: "Thiếu storeId hoặc date (YYYY-MM-DD)" });
    }

    const { start, end } = periodToRange("day", date);

    const rows = await OrderItem.aggregate([
      // Join Order để lọc theo store/status/createdAt
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: start, $lte: end },
        },
      },
      // Join Product để lấy mã hàng / tên / mô tả
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $addFields: {
          // grossLine = đơn giá tại thời điểm bán * số lượng
          // netLine   = subtotal đã lưu (thường là số tiền thực thu của line)
          grossLine: { $multiply: [{ $toDouble: "$priceAtTime" }, "$quantity"] },
          netLine: { $toDouble: "$subtotal" },
          unitPrice: { $toDouble: "$priceAtTime" },
        },
      },
      {
        $group: {
          // Gom theo productId để ra 1 dòng / sản phẩm
          _id: "$productId",
          sku: { $first: "$product.sku" },
          name: { $first: "$product.name" },
          description: { $first: "$product.description" },
          qty: { $sum: "$quantity" },
          grossTotal: { $sum: "$grossLine" },
          netTotal: { $sum: "$netLine" },
          // store the sum of unitPrice*qty for recomputing avg unit price
          unitPriceQtySum: { $sum: "$grossLine" },
        },
      },
      {
        $addFields: {
          // Đơn giá trung bình theo trọng số số lượng
          unitPriceAvg: {
            $cond: [{ $gt: ["$qty", 0] }, { $divide: ["$unitPriceQtySum", "$qty"] }, 0],
          },
          // Tổng giảm = max(0, gross - net)
          discountAmount: { $max: [0, { $subtract: ["$grossTotal", "$netTotal"] }] },
        },
      },
      { $sort: { netTotal: -1 } },
    ]);

    const data = (rows || []).map((r) => {
      const gross = safeNumber(r.grossTotal);
      const net = safeNumber(r.netTotal);

      // Giảm giá (ước tính): phần chênh lệch giữa tổng trước giảm (gross) và subtotal thực thu (net)
      const discount = Math.max(0, gross - net);
      const discountPct = gross > 0 ? (discount / gross) * 100 : 0;
      return {
        sku: r.sku || "",
        productName: r.name || "",
        productDescription: r.description || "",
        unitPrice: safeNumber(r.unitPriceAvg),
        quantity: safeNumber(r.qty),
        grossTotal: gross,
        discountPercent: Number(discountPct.toFixed(2)),
        discountAmount: discount,
        netTotal: net,
      };
    });

    return res.json({ message: "Báo cáo bán hàng theo ngày", date, data });
  } catch (err) {
    console.error("Lỗi báo cáo bán hàng theo ngày:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo bán hàng theo ngày" });
  }
};

const exportDailyProductSales = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const date = req.query.date;
    const { format = "xlsx" } = req.query;

    if (!storeId || !date) {
      return res.status(400).json({ message: "Thiếu storeId hoặc date (YYYY-MM-DD)" });
    }
    if (format !== "xlsx" && format !== "pdf") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx) hoặc PDF (.pdf)" });
    }

    // Call logic JSON -> map lại theo đúng header template
    let rows;
    await getDailyProductSales(
      { query: { storeId, date } },
      {
        json: ({ data }) => {
          rows = data;
        },
        status: () => ({ json: () => {} }),
      }
    );

    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r) => ({
      "Mã hàng": r.sku,
      "Tên sản phẩm": r.productName,
      "Mô tả": r.productDescription,
      "Đơn giá (VNĐ)": r.unitPrice,
      "Số lượng": r.quantity,
      "Tổng (VNĐ)": r.grossTotal,
      "Tổng giảm (VNĐ)": r.discountAmount,
      "Thực thu (VNĐ)": r.netTotal,
    }));

    const ws = createWorksheetWithReportHeader({
      reportTitle: "Báo cáo bán hàng hằng ngày",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 34 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

    // Tên sheet Excel bị giới hạn 31 ký tự; dùng tên ngắn để tránh lỗi khi export.
    XLSX.utils.book_append_sheet(wb, ws, "Bán hàng hằng ngày");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Ban_Hang_Hang_Ngay", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Ban_Hang_Hang_Ngay", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // 1. Legal Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.fontSize(9).font("Roboto-Italic").text("-----------------", { align: "right" });
      doc.moveDown(2);

      // 2. Title
      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO BÁN HÀNG HẰNG NGÀY", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(`Ngày: ${dayjs(date).format("DD/MM/YYYY")}`, { align: "center" });
      doc.moveDown(2);

      // 3. Info
      doc.font("Roboto-Regular").fontSize(10).text(`Người xuất: ${getExporterNameDisplay(req)}`);
      doc.text(`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // 4. Content
      doc.font("Roboto-Bold").fontSize(10);
      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").text(`${idx + 1}. ${r.productName} (${r.sku})`);
        doc.font("Roboto-Regular").text(`   SL: ${r.quantity} | Giá: ${new Intl.NumberFormat("vi-VN").format(r.unitPrice)} | Tổng: ${new Intl.NumberFormat("vi-VN").format(r.grossTotal)}`, { indent: 20 });
        doc.text(`   Giảm: ${new Intl.NumberFormat("vi-VN").format(r.discountAmount)} | Thực thu: ${new Intl.NumberFormat("vi-VN").format(r.netTotal)}`, { indent: 20 });
        doc.moveDown(0.5);
      });

      doc.moveDown(2);

      // Signatures
      const startY = doc.y > 650 ? (doc.addPage(), 50) : doc.y;
      doc.font("Roboto-Bold").fontSize(10).text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, { width: 150, align: "center" });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo bán hàng theo ngày:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE 3: SO SÁNH DOANH SỐ HẰNG NĂM (theo danh mục)
// Based on template sheet "So sánh doanh số hằng năm".
// We implement: Category | Last year revenue | This year revenue | Difference | Total two years
// ===============================
const getYearlyCategoryCompare = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const prevYear = year - 1;
    const start = new Date(Date.UTC(prevYear, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const rows = await OrderItem.aggregate([
      // Join Order để lọc theo store/status/createdAt, lấy year của đơn
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: start, $lte: end },
        },
      },
      // Join Product -> lấy group_id
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      // Join ProductGroup -> lấy tên danh mục
      {
        $lookup: {
          from: "product_groups",
          localField: "product.group_id",
          foreignField: "_id",
          as: "group",
        },
      },
      {
        $addFields: {
          groupName: {
            $ifNull: [{ $arrayElemAt: ["$group.name", 0] }, "(Chưa phân nhóm)"],
          },
          orderYear: { $year: "$order.createdAt" },
          netLine: { $toDouble: "$subtotal" },
        },
      },
      {
        $group: {
          // Gom theo (danh mục, năm) để ra doanh thu theo năm cho từng danh mục
          _id: { groupName: "$groupName", year: "$orderYear" },
          revenue: { $sum: "$netLine" },
        },
      },
      {
        $group: {
          // Pivot: gom thành 1 document / danh mục với mảng yearly: [{year, revenue}, ...]
          _id: "$_id.groupName",
          yearly: {
            $push: { year: "$_id.year", revenue: "$revenue" },
          },
        },
      },
      {
        $addFields: {
          // Tách 2 giá trị năm trước và năm hiện tại (nếu không có -> 0)
          prev: {
            $first: {
              $filter: {
                input: "$yearly",
                as: "y",
                cond: { $eq: ["$$y.year", prevYear] },
              },
            },
          },
          curr: {
            $first: {
              $filter: {
                input: "$yearly",
                as: "y",
                cond: { $eq: ["$$y.year", year] },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          prevYear,
          year,
          revenuePrevYear: { $ifNull: ["$prev.revenue", 0] },
          revenueThisYear: { $ifNull: ["$curr.revenue", 0] },
        },
      },
      {
        $addFields: {
          // Chênh lệch và tổng 2 năm
          difference: { $subtract: ["$revenueThisYear", "$revenuePrevYear"] },
          totalTwoYears: { $add: ["$revenueThisYear", "$revenuePrevYear"] },
        },
      },
      { $sort: { revenueThisYear: -1 } },
    ]);

    return res.json({ message: "So sánh doanh số hằng năm", year, prevYear, data: rows || [] });
  } catch (err) {
    console.error("Lỗi so sánh doanh số hằng năm:", err);
    return res.status(500).json({ message: "Lỗi server khi so sánh doanh số" });
  }
};

const exportYearlyCategoryCompare = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    const { format = "xlsx" } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }
    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    let rows;
    await getYearlyCategoryCompare(
      { query: { storeId, year } },
      {
        json: ({ data }) => {
          rows = data;
        },
        status: () => ({ json: () => {} }),
      }
    );

    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const prevYear = year - 1;
    const wb = XLSX.utils.book_new();
    // Dùng computed key để tạo cột động theo năm (vd: "Doanh số năm 2024")
    const sheetData = rows.map((r) => ({
      "Danh mục sản phẩm": r.category,
      [`Doanh số năm ${prevYear}`]: safeNumber(r.revenuePrevYear),
      [`Doanh số năm ${year}`]: safeNumber(r.revenueThisYear),
      "Chênh lệch": safeNumber(r.difference),
      "Tổng 2 năm": safeNumber(r.totalTwoYears),
    }));

    const ws = createWorksheetWithReportHeader({
      reportTitle: "So sánh doanh số hằng năm",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "So sánh doanh số hằng năm");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "So_Sanh_Doanh_So_Hang_Nam", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "So_Sanh_Doanh_So_Hang_Nam", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.moveDown(2);

      // Title
      doc.font("Roboto-Bold").fontSize(18).text("SO SÁNH DOANH THU DANH MỤC", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(`Năm: ${year} và ${prevYear}`, { align: "center" });
      doc.moveDown(2);

      // Data
      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(11).text(`${idx + 1}. ${r.category}`);
        doc.font("Roboto-Regular").fontSize(10);
        doc.text(`   Năm ${prevYear}: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.revenuePrevYear))} VND`, { indent: 20 });
        doc.text(`   Năm ${year}: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.revenueThisYear))} VND`, { indent: 20 });
        doc.text(`   Chênh lệch: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.difference))} VND`, { indent: 20 });
        doc.moveDown(0.5);
      });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export so sánh doanh số:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE 4: BÁO CÁO DOANH THU THEO THÁNG (dạng theo ngày trong tháng)
// Vì template tháng trong file mẫu có nhiều cột kế hoạch/chi phí không có dữ liệu,
// ta xuất một format hợp lý: Ngày | Số đơn | Số mặt hàng bán ra | Doanh thu
// ===============================
const getMonthlyRevenueByDay = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month; // YYYY-MM
    if (!storeId || !month) {
      return res.status(400).json({ message: "Thiếu storeId hoặc month (YYYY-MM)" });
    }

    const { start, end } = periodToRange("month", month);

    const [ordersByDay, itemsByDay] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            storeId: toObjectId(storeId),
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            revenue: { $sum: { $toDecimal: "$totalAmount" } },
            orderCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            y: "$_id.y",
            m: "$_id.m",
            d: "$_id.d",
            revenue: { $toDouble: "$revenue" },
            orderCount: 1,
          },
        },
      ]),
      OrderItem.aggregate([
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $match: {
            "order.storeId": toObjectId(storeId),
            "order.status": { $in: PAID_STATUSES },
            "order.createdAt": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              y: { $year: "$order.createdAt" },
              m: { $month: "$order.createdAt" },
              d: { $dayOfMonth: "$order.createdAt" },
            },
            itemsSold: { $sum: "$quantity" },
          },
        },
        {
          $project: {
            _id: 0,
            y: "$_id.y",
            m: "$_id.m",
            d: "$_id.d",
            itemsSold: 1,
          },
        },
      ]),
    ]);

    const orderMap = new Map(
      (ordersByDay || []).map((r) => [`${r.y}-${r.m}-${r.d}`, { revenue: safeNumber(r.revenue), orderCount: safeNumber(r.orderCount) }])
    );
    const itemsMap = new Map((itemsByDay || []).map((r) => [`${r.y}-${r.m}-${r.d}`, safeNumber(r.itemsSold)]));

    const monthStart = dayjs(month + "-01");
    const daysInMonth = monthStart.daysInMonth();
    const y = monthStart.year();
    const m = monthStart.month() + 1;

    const data = Array.from({ length: daysInMonth }, (_, idx) => {
      const d = idx + 1;
      const key = `${y}-${m}-${d}`;
      const o = orderMap.get(key) || { revenue: 0, orderCount: 0 };
      return {
        date: dayjs(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`).format("YYYY-MM-DD"),
        dayLabel: d, // Add dayLabel for PDF
        orderCount: o.orderCount,
        itemsSold: itemsMap.get(key) || 0,
        revenue: o.revenue,
      };
    });

    return res.json({ message: "Báo cáo doanh thu theo tháng (theo ngày)", month, data });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu theo tháng:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo theo tháng" });
  }
};

const exportMonthlyRevenueByDay = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month;
    const { format = "xlsx" } = req.query;

    if (!storeId || !month) {
      return res.status(400).json({ message: "Thiếu storeId hoặc month (YYYY-MM)" });
    }
    if (format !== "xlsx" && format !== "pdf") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx) hoặc PDF (.pdf)" });
    }

    let rows;
    await getMonthlyRevenueByDay(
      { query: { storeId, month } },
      {
        json: ({ data }) => {
          rows = data;
        },
        status: () => ({ json: () => {} }),
      }
    );

    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r) => ({
      Ngày: r.date,
      "Số đơn": r.orderCount,
      "Số mặt hàng bán ra": r.itemsSold,
      "Doanh thu (VNĐ)": r.revenue,
    }));
    const ws = createWorksheetWithReportHeader({
      reportTitle: "Doanh thu theo tháng",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Doanh thu theo tháng");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Thang", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Thang", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));

      // Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.moveDown(2);

      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO DOANH THU THEO THÁNG", { align: "center" });
      doc.font("Roboto-Regular").fontSize(11).text(`Tháng: ${month}`, { align: "center" });
      doc.moveDown(2);

      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(10).text(`${idx + 1}. Ngày ${r.dayLabel}:`);
        doc.font("Roboto-Regular").text(`   Số đơn: ${r.orderCount} | Số SP: ${r.itemsSold} | Doanh thu: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.revenue))} VND`, { indent: 20 });
        doc.moveDown(0.3);
      });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo theo tháng:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE NEW: BÁO CÁO TỔNG HỢP THEO THÁNG
// Tháng (MM/YYYY) | Tổng doanh thu | Tổng số đơn / tổng số sản phẩm bán
// | Doanh thu trung bình / ngày | So với tháng trước (+/-)
// ===============================
const getMonthlyRevenueSummary = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month; // YYYY-MM (legacy)
    const year = req.query.year ? parseYear(req.query.year) : null; // new: YYYY
    if (!storeId || (!month && !year)) {
      return res.status(400).json({ message: "Thiếu storeId hoặc (month YYYY-MM) hoặc (year YYYY)" });
    }

    // ===== NEW: tổng hợp theo năm (trả về đủ 12 tháng) =====
    if (year) {
      const startPrevDec = new Date(Date.UTC(year - 1, 11, 1, 0, 0, 0));
      const endYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

      const [ordersByMonth, itemsByMonth] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              storeId: toObjectId(storeId),
              status: { $in: PAID_STATUSES },
              createdAt: { $gte: startPrevDec, $lte: endYear },
            },
          },
          {
            $group: {
              _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
              totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
              orderCount: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              y: "$_id.y",
              m: "$_id.m",
              totalRevenue: { $toDouble: "$totalRevenue" },
              orderCount: 1,
            },
          },
        ]),
        OrderItem.aggregate([
          {
            $lookup: {
              from: "orders",
              localField: "orderId",
              foreignField: "_id",
              as: "order",
            },
          },
          { $unwind: "$order" },
          {
            $match: {
              "order.storeId": toObjectId(storeId),
              "order.status": { $in: PAID_STATUSES },
              "order.createdAt": { $gte: startPrevDec, $lte: endYear },
            },
          },
          {
            $group: {
              _id: { y: { $year: "$order.createdAt" }, m: { $month: "$order.createdAt" } },
              itemsSold: { $sum: "$quantity" },
            },
          },
          {
            $project: {
              _id: 0,
              y: "$_id.y",
              m: "$_id.m",
              itemsSold: 1,
            },
          },
        ]),
      ]);

      const revenueMap = new Map(
        (ordersByMonth || []).map((r) => [`${r.y}-${r.m}`, { revenue: safeNumber(r.totalRevenue), orderCount: safeNumber(r.orderCount) }])
      );
      const itemsMap = new Map((itemsByMonth || []).map((r) => [`${r.y}-${r.m}`, safeNumber(r.itemsSold)]));

      const data = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const key = `${year}-${m}`;
        const prevKey = m === 1 ? `${year - 1}-12` : `${year}-${m - 1}`;

        const cur = revenueMap.get(key) || { revenue: 0, orderCount: 0 };
        const prev = revenueMap.get(prevKey) || { revenue: 0, orderCount: 0 };

        const monthStart = dayjs(`${year}-${String(m).padStart(2, "0")}-01`);
        const daysInMonth = monthStart.daysInMonth();

        const totalRevenue = safeNumber(cur.revenue);
        const orderCount = safeNumber(cur.orderCount);
        const itemsSold = safeNumber(itemsMap.get(key) || 0);
        const avgRevenuePerDay = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;
        const diffVsPrevMonth = totalRevenue - safeNumber(prev.revenue);

        return {
          year,
          month: m,
          monthLabel: `${String(m).padStart(2, "0")}/${year}`,
          totalRevenue,
          orderCount,
          itemsSold,
          avgRevenuePerDay,
          diffVsPrevMonth,
        };
      });

      return res.json({
        message: "Báo cáo tổng hợp doanh thu theo tháng (theo năm)",
        year,
        data,
      });
    }

    const { start, end } = periodToRange("month", month);
    const monthStart = dayjs(month + "-01");
    const daysInMonth = monthStart.daysInMonth();

    const prevMonthKey = monthStart.subtract(1, "month").format("YYYY-MM");
    const { start: prevStart, end: prevEnd } = periodToRange("month", prevMonthKey);

    const [thisMonthOrders, thisMonthItems, prevMonthOrders] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            storeId: toObjectId(storeId),
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
            orderCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            totalRevenue: { $toDouble: "$totalRevenue" },
            orderCount: 1,
          },
        },
      ]),
      OrderItem.aggregate([
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        { $unwind: "$order" },
        {
          $match: {
            "order.storeId": toObjectId(storeId),
            "order.status": { $in: PAID_STATUSES },
            "order.createdAt": { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            itemsSold: { $sum: "$quantity" },
          },
        },
        { $project: { _id: 0, itemsSold: 1 } },
      ]),
      Order.aggregate([
        {
          $match: {
            storeId: toObjectId(storeId),
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: prevStart, $lte: prevEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          },
        },
        { $project: { _id: 0, totalRevenue: { $toDouble: "$totalRevenue" } } },
      ]),
    ]);

    const totalRevenue = safeNumber(thisMonthOrders?.[0]?.totalRevenue);
    const orderCount = safeNumber(thisMonthOrders?.[0]?.orderCount);
    const itemsSold = safeNumber(thisMonthItems?.[0]?.itemsSold);
    const prevRevenue = safeNumber(prevMonthOrders?.[0]?.totalRevenue);

    const avgRevenuePerDay = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;
    const diffVsPrevMonth = totalRevenue - prevRevenue;

    return res.json({
      message: "Báo cáo tổng hợp doanh thu theo tháng",
      data: {
        month,
        monthLabel: monthStart.format("MM/YYYY"),
        totalRevenue,
        orderCount,
        itemsSold,
        avgRevenuePerDay,
        prevMonth: prevMonthKey,
        prevMonthRevenue: prevRevenue,
        diffVsPrevMonth,
      },
    });
  } catch (err) {
    console.error("Lỗi báo cáo tổng hợp theo tháng:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo tổng hợp theo tháng" });
  }
};

const exportMonthlyRevenueSummary = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month; // YYYY-MM (legacy)
    const year = req.query.year ? parseYear(req.query.year) : null;
    const { format = "xlsx" } = req.query;

    if (!storeId || (!month && !year)) {
      return res.status(400).json({ message: "Thiếu storeId hoặc (month YYYY-MM) hoặc (year YYYY)" });
    }
    if (format !== "xlsx" && format !== "pdf") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx) hoặc PDF (.pdf)" });
    }

    let payload;
    await getMonthlyRevenueSummary(
      { query: year ? { storeId, year: String(year) } : { storeId, month } },
      {
        json: (obj) => {
          payload = obj;
        },
        status: () => ({ json: () => {} }),
      }
    );

    const wb = XLSX.utils.book_new();

    if (year) {
      const rows = payload?.data;
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(404).json({ message: "Không có dữ liệu để xuất" });
      }
      const sheetData = rows.map((r) => ({
        Tháng: r.monthLabel,
        "Tổng doanh thu (VNĐ)": safeNumber(r.totalRevenue),
        "Tổng số đơn": safeNumber(r.orderCount),
        "Tổng số sản phẩm bán": safeNumber(r.itemsSold),
        "Doanh thu TB / ngày (VNĐ)": safeNumber(r.avgRevenuePerDay),
        "So với tháng trước (VNĐ)": safeNumber(r.diffVsPrevMonth),
      }));

      const totalRevenue = sheetData.reduce((sum, r) => sum + safeNumber(r["Tổng doanh thu (VNĐ)"]), 0);

      sheetData.push({
        Tháng: "Tổng cộng",
        "Tổng doanh thu (VNĐ)": totalRevenue,
        "Tổng số đơn": "",
        "Tổng số sản phẩm bán": "",
        "Doanh thu TB / ngày (VNĐ)": "",
        "So với tháng trước (VNĐ)": "",
      });
      const ws = createWorksheetWithReportHeader({
        reportTitle: "Tổng hợp doanh thu theo tháng",
        req,
        sheetData,
      });
      ws["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Tổng hợp theo tháng");
    } else {
      const row = payload?.data;
      if (!row) {
        return res.status(404).json({ message: "Không có dữ liệu để xuất" });
      }
      const sheetData = [
        {
          Tháng: row.monthLabel,
          "Tổng doanh thu (VNĐ)": safeNumber(row.totalRevenue),
          "Tổng số đơn": safeNumber(row.orderCount),
          "Tổng số sản phẩm bán": safeNumber(row.itemsSold),
          "Doanh thu TB / ngày (VNĐ)": safeNumber(row.avgRevenuePerDay),
          "So với tháng trước (VNĐ)": safeNumber(row.diffVsPrevMonth),
        },
      ];
      const ws = createWorksheetWithReportHeader({
        reportTitle: "Tổng hợp doanh thu theo tháng",
        req,
        sheetData,
      });
      ws["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Tổng hợp theo tháng");
    }

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Tong_Hop_Theo_Thang", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Tong_Hop_Theo_Thang", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // 1. Legal Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.fontSize(9).font("Roboto-Italic").text("-----------------", { align: "right" });
      doc.moveDown(2);

      // 2. Title
      doc.font("Roboto-Bold").fontSize(18).text("TỔNG HỢP DOANH THU THEO THÁNG", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(year ? `Năm: ${year}` : `Tháng: ${month}`, { align: "center" });
      doc.moveDown(2);

      // 3. Info
      doc.font("Roboto-Regular").fontSize(10).text(`Người xuất: ${getExporterNameDisplay(req)}`);
      doc.text(`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // 4. Data
      const rows = year ? payload?.data : [payload?.data];
      if (rows && rows.length > 0) {
        rows.forEach((r, idx) => {
          if (!r) return;
          doc.font("Roboto-Bold").fontSize(11).text(`${idx + 1}. ${r.monthLabel || ""}`);
          doc.font("Roboto-Regular").fontSize(10);
          doc.text(`   Doanh thu: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.totalRevenue))} VND`, { indent: 20 });
          doc.text(`   Đơn hàng: ${safeNumber(r.orderCount)} | Sản phẩm: ${safeNumber(r.itemsSold)}`, { indent: 20 });
          doc.text(`   TB / ngày: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.avgRevenuePerDay))} VND`, { indent: 20 });
          doc.moveDown(0.5);
        });
      }

      doc.moveDown(2);

      // Signatures
      const startY = doc.y > 650 ? (doc.addPage(), 50) : doc.y;
      doc.font("Roboto-Bold").fontSize(10).text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Kế toán trưởng", 220, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, { width: 150, align: "center" });
      
      doc.font("Roboto-Italic").fontSize(9).text("(Ký, họ tên)", 50, doc.y + 5, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên)", 220, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên, đóng dấu)", 390, doc.y, { width: 150, align: "center" });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export tổng hợp theo tháng:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE NEW: BÁO CÁO BÁN CHẠY THEO SẢN PHẨM (theo tháng)
// Tên sản phẩm | Tổng số lượng đã bán | Tổng doanh thu | Tỷ lệ đóng góp (%)
// ===============================
const getMonthlyTopProducts = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month; // YYYY-MM
    if (!storeId || !month) {
      return res.status(400).json({ message: "Thiếu storeId hoặc month (YYYY-MM)" });
    }

    const { start, end } = periodToRange("month", month);

    const rows = await OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $addFields: {
          netLine: { $toDouble: "$subtotal" },
        },
      },
      {
        $group: {
          _id: "$productId",
          productName: { $first: "$product.name" },
          quantity: { $sum: "$quantity" },
          revenue: { $sum: "$netLine" },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          _id: 0,
          productName: 1,
          quantity: 1,
          revenue: 1,
        },
      },
    ]);

    const totalRevenueAll = (rows || []).reduce((sum, r) => sum + safeNumber(r.revenue), 0);
    const data = (rows || []).map((r) => {
      const revenue = safeNumber(r.revenue);
      return {
        productName: r.productName,
        totalQuantity: safeNumber(r.quantity),
        totalRevenue: revenue,
        contributionPercent: totalRevenueAll > 0 ? (revenue / totalRevenueAll) * 100 : 0,
      };
    });

    return res.json({
      message: "Báo cáo bán chạy theo sản phẩm (theo tháng)",
      month,
      totalRevenueAll,
      data,
    });
  } catch (err) {
    console.error("Lỗi báo cáo bán chạy theo sản phẩm:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo bán chạy theo sản phẩm" });
  }
};

const exportMonthlyTopProducts = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const month = req.query.month;
    const { format = "xlsx" } = req.query;

    if (!storeId || !month) {
      return res.status(400).json({ message: "Thiếu storeId hoặc month (YYYY-MM)" });
    }
    if (format !== "xlsx" && format !== "pdf") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx) hoặc PDF (.pdf)" });
    }

    let payload;
    await getMonthlyTopProducts(
      { query: { storeId, month } },
      {
        json: (obj) => {
          payload = obj;
        },
        status: () => ({ json: () => {} }),
      }
    );

    const rows = payload?.data;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r) => ({
      "Tên sản phẩm": r.productName,
      "Tổng số lượng đã bán": safeNumber(r.totalQuantity),
      "Tổng doanh thu (VNĐ)": safeNumber(r.totalRevenue),
      "Tỷ lệ đóng góp (%)": safeNumber(r.contributionPercent),
    }));
    const ws = createWorksheetWithReportHeader({
      reportTitle: "Bán chạy theo sản phẩm",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Bán chạy theo sản phẩm");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Ban_Chay_Theo_San_Pham", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Ban_Chay_Theo_San_Pham", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));

      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO SẢN PHẨM BÁN CHẠY", { align: "center" });
      doc.font("Roboto-Regular").fontSize(11).text(`Tháng: ${month}`, { align: "center" });
      doc.moveDown(2);

      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(10).text(`${idx + 1}. ${r.productName}`);
        doc.font("Roboto-Regular").text(`   Số lượng: ${safeNumber(r.totalQuantity)} | Doanh thu: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.totalRevenue))} VND | Tỷ lệ: ${safeNumber(r.contributionPercent).toFixed(2)}%`, { indent: 20 });
        doc.moveDown(0.4);
      });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export bán chạy theo sản phẩm:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE NEW: BÁO CÁO DOANH THU HẰNG NĂM (productGroup -> sản phẩm)
// Nhóm theo productGroup; mỗi dòng là 1 sản phẩm trong group.
// Cột: Doanh số năm trước | Doanh số năm nay | Chênh lệch | Tổng 2 năm
// ===============================
const getYearlyProductGroupProductCompare = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const prevYear = year - 1;
    const startPrev = new Date(Date.UTC(prevYear, 0, 1, 0, 0, 0));
    const endThis = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const raw = await OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: startPrev, $lte: endThis },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "product_groups",
          localField: "product.group_id",
          foreignField: "_id",
          as: "group",
        },
      },
      {
        $addFields: {
          groupId: { $ifNull: [{ $arrayElemAt: ["$group._id", 0] }, null] },
          groupName: { $ifNull: [{ $arrayElemAt: ["$group.name", 0] }, "(Chưa phân nhóm)"] },
          orderYear: { $year: "$order.createdAt" },
          netLine: { $toDouble: "$subtotal" },
        },
      },
      {
        $match: {
          orderYear: { $in: [prevYear, year] },
        },
      },
      {
        $group: {
          _id: {
            groupId: "$groupId",
            groupName: "$groupName",
            productId: "$productId",
            productName: "$product.name",
            orderYear: "$orderYear",
          },
          revenue: { $sum: "$netLine" },
        },
      },
      {
        $project: {
          _id: 0,
          groupId: "$_id.groupId",
          groupName: "$_id.groupName",
          productId: "$_id.productId",
          productName: "$_id.productName",
          orderYear: "$_id.orderYear",
          revenue: 1,
        },
      },
    ]);

    const groupMap = new Map();
    for (const r of raw || []) {
      const gKey = String(r.groupId || r.groupName);
      if (!groupMap.has(gKey)) {
        groupMap.set(gKey, {
          productGroup: { _id: r.groupId, name: r.groupName },
          items: new Map(),
        });
      }
      const g = groupMap.get(gKey);
      const pKey = String(r.productId);
      if (!g.items.has(pKey)) {
        g.items.set(pKey, {
          productId: r.productId,
          productName: r.productName,
          revenuePrevYear: 0,
          revenueThisYear: 0,
        });
      }
      const item = g.items.get(pKey);
      if (r.orderYear === prevYear) item.revenuePrevYear += safeNumber(r.revenue);
      if (r.orderYear === year) item.revenueThisYear += safeNumber(r.revenue);
    }

    const data = Array.from(groupMap.values()).map((g) => {
      const items = Array.from(g.items.values()).map((it) => {
        const prev = safeNumber(it.revenuePrevYear);
        const cur = safeNumber(it.revenueThisYear);
        return {
          productId: it.productId,
          productName: it.productName,
          revenuePrevYear: prev,
          revenueThisYear: cur,
          difference: cur - prev,
          totalTwoYears: prev + cur,
        };
      });

      items.sort((a, b) => b.revenueThisYear - a.revenueThisYear);
      return {
        productGroup: g.productGroup,
        items,
      };
    });

    // sort group theo tổng doanh thu năm nay desc
    data.sort((a, b) => {
      const sumA = (a.items || []).reduce((s, it) => s + safeNumber(it.revenueThisYear), 0);
      const sumB = (b.items || []).reduce((s, it) => s + safeNumber(it.revenueThisYear), 0);
      return sumB - sumA;
    });

    return res.json({
      message: "Báo cáo doanh thu hằng năm theo danh mục (productGroup) và sản phẩm",
      year,
      prevYear,
      data,
    });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu năm theo productGroup->sản phẩm:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo theo năm" });
  }
};

const exportYearlyProductGroupProductCompare = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    const { format = "xlsx" } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }
    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    let payload;
    await getYearlyProductGroupProductCompare(
      { query: { storeId, year } },
      {
        json: (obj) => {
          payload = obj;
        },
        status: () => ({ json: () => {} }),
      }
    );

    const groups = payload?.data;
    const prevYear = payload?.prevYear;
    if (!Array.isArray(groups) || !groups.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    const rows = [];

    for (const g of groups) {
      rows.push({
        "Danh mục / Sản phẩm": g.productGroup?.name || "(Chưa phân nhóm)",
        [`Doanh số ${prevYear} (VNĐ)`]: "",
        [`Doanh số ${year} (VNĐ)`]: "",
        "Chênh lệch (VNĐ)": "",
        "Tổng 2 năm (VNĐ)": "",
      });
      for (const it of g.items || []) {
        rows.push({
          "Danh mục / Sản phẩm": it.productName,
          [`Doanh số ${prevYear} (VNĐ)`]: safeNumber(it.revenuePrevYear),
          [`Doanh số ${year} (VNĐ)`]: safeNumber(it.revenueThisYear),
          "Chênh lệch (VNĐ)": safeNumber(it.difference),
          "Tổng 2 năm (VNĐ)": safeNumber(it.totalTwoYears),
        });
      }
    }

    const ws = createWorksheetWithReportHeader({
      reportTitle: "Doanh thu hằng năm",
      req,
      sheetData: rows,
    });
    ws["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Doanh thu hằng năm");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Hang_Nam", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Hang_Nam", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont("Roboto-Italic", path.join(fontPath, "Roboto-Italic.ttf"));

      // 1. Legal Header
      doc.font("Roboto-Bold").fontSize(10).text((req.store?.name || "Cửa hàng").toUpperCase(), { align: "left" });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc.text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc.fontSize(9).font("Roboto-Italic").text("-----------------", { align: "right" });
      doc.moveDown(2);

      // 2. Title
      doc.font("Roboto-Bold").fontSize(18).text("SO SÁNH DOANH THU HẰNG NĂM", { align: "center" });
      doc.font("Roboto-Italic").fontSize(11).text(`Năm đối chiếu: ${prevYear} và ${year}`, { align: "center" });
      doc.moveDown(2);

      // 3. Info
      doc.font("Roboto-Regular").fontSize(10).text(`Người xuất: ${getExporterNameDisplay(req)}`);
      doc.text(`Ngày xuất: ${dayjs().format("DD/MM/YYYY HH:mm")}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // 4. Data
      groups.forEach((g) => {
        doc.font("Roboto-Bold").fontSize(12).text(g.productGroup?.name || "(Chưa phân nhóm)");
        doc.moveDown(0.2);
        (g.items || []).forEach((it) => {
          doc.font("Roboto-Regular").fontSize(10).text(`${it.productName}:`);
          doc.text(`   ${prevYear}: ${new Intl.NumberFormat("vi-VN").format(safeNumber(it.revenuePrevYear))} | ${year}: ${new Intl.NumberFormat("vi-VN").format(safeNumber(it.revenueThisYear))}`, { indent: 20 });
          doc.text(`   Chênh lệch: ${new Intl.NumberFormat("vi-VN").format(safeNumber(it.difference))} | Tổng: ${new Intl.NumberFormat("vi-VN").format(safeNumber(it.totalTwoYears))}`, { indent: 20 });
          doc.moveDown(0.3);
        });
        doc.moveDown(0.5);
      });

      doc.moveDown(2);

      // Signatures
      const startY = doc.y > 650 ? (doc.addPage(), 50) : doc.y;
      doc.font("Roboto-Bold").fontSize(10).text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, { width: 150, align: "center" });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo doanh thu hằng năm:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE 5: BÁO CÁO DOANH THU THEO QUÝ (theo danh mục, breakdown theo 3 tháng)
// Template yêu cầu Thực tế/Dự kiến/Chênh lệch cho từng tháng.
// Do không có dữ liệu kế hoạch, xuất Dự kiến = 0 và Chênh lệch = Thực tế.
// ===============================
const getQuarterlyRevenueByCategory = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const quarter = req.query.quarter; // YYYY-Qn
    if (!storeId || !quarter) {
      return res.status(400).json({ message: "Thiếu storeId hoặc quarter (YYYY-Qn)" });
    }

    const { start, end } = periodToRange("quarter", quarter);
    const startMonth = dayjs(start).utc().month() + 1; // 1-12
    const months = [startMonth, startMonth + 1, startMonth + 2];

    const raw = await OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "product_groups",
          localField: "product.group_id",
          foreignField: "_id",
          as: "group",
        },
      },
      {
        $addFields: {
          groupName: {
            $ifNull: [{ $arrayElemAt: ["$group.name", 0] }, "(Chưa phân nhóm)"],
          },
          month: { $month: "$order.createdAt" },
          netLine: { $toDouble: "$subtotal" },
        },
      },
      {
        $group: {
          _id: { groupName: "$groupName", month: "$month" },
          revenue: { $sum: "$netLine" },
        },
      },
      {
        $project: {
          _id: 0,
          groupName: "$_id.groupName",
          month: "$_id.month",
          revenue: 1,
        },
      },
    ]);

    const grouped = new Map();
    for (const r of raw || []) {
      if (!grouped.has(r.groupName)) grouped.set(r.groupName, new Map());
      grouped.get(r.groupName).set(r.month, safeNumber(r.revenue));
    }

    const data = Array.from(grouped.entries()).map(([groupName, monthMap]) => {
      const m1 = months[0];
      const m2 = months[1];
      const m3 = months[2];
      const a1 = monthMap.get(m1) || 0;
      const a2 = monthMap.get(m2) || 0;
      const a3 = monthMap.get(m3) || 0;
      return {
        category: groupName,
        month1: { actual: a1, planned: 0, diff: a1 },
        month2: { actual: a2, planned: 0, diff: a2 },
        month3: { actual: a3, planned: 0, diff: a3 },
      };
    });

    // sort theo tổng actual desc
    data.sort((a, b) => b.month1.actual + b.month2.actual + b.month3.actual - (a.month1.actual + a.month2.actual + a.month3.actual));

    return res.json({ message: "Báo cáo doanh thu theo quý (theo danh mục)", quarter, months, data });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu theo quý:", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo theo quý" });
  }
};

const exportQuarterlyRevenueByCategory = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const quarter = req.query.quarter;
    const { format = "xlsx" } = req.query;

    if (!storeId || !quarter) {
      return res.status(400).json({ message: "Thiếu storeId hoặc quarter (YYYY-Qn)" });
    }
    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    let payload;
    await getQuarterlyRevenueByCategory(
      { query: { storeId, quarter } },
      {
        json: (obj) => {
          payload = obj;
        },
        status: () => ({ json: () => {} }),
      }
    );

    const rows = payload?.data;
    const months = payload?.months;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const [m1, m2, m3] = Array.isArray(months) && months.length === 3 ? months : [1, 2, 3];
    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r) => ({
      "Danh mục": r.category,
      [`Tháng ${m1} - Thực tế`]: safeNumber(r.month1?.actual),
      [`Tháng ${m1} - Dự kiến`]: 0,
      [`Tháng ${m1} - Chênh lệch`]: safeNumber(r.month1?.diff),
      [`Tháng ${m2} - Thực tế`]: safeNumber(r.month2?.actual),
      [`Tháng ${m2} - Dự kiến`]: 0,
      [`Tháng ${m2} - Chênh lệch`]: safeNumber(r.month2?.diff),
      [`Tháng ${m3} - Thực tế`]: safeNumber(r.month3?.actual),
      [`Tháng ${m3} - Dự kiến`]: 0,
      [`Tháng ${m3} - Chênh lệch`]: safeNumber(r.month3?.diff),
    }));

    const ws = createWorksheetWithReportHeader({
      reportTitle: "Báo cáo theo quý",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo theo quý");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Quy", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Quy", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));

      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO DOANH THU THEO QUÝ", { align: "center" });
      doc.font("Roboto-Regular").fontSize(11).text(`Quý: ${quarter}`, { align: "center" });
      doc.moveDown(2);

      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(10).text(`${idx + 1}. ${r.category}`);
        doc.font("Roboto-Regular").text(`   T1: ${new Intl.NumberFormat("vi-VN").format(r.month1?.actual)} | T2: ${new Intl.NumberFormat("vi-VN").format(r.month2?.actual)} | T3: ${new Intl.NumberFormat("vi-VN").format(r.month3?.actual)}`, { indent: 20 });
        doc.moveDown(0.4);
      });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo theo quý:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

// ===============================
// TEMPLATE 6: BÁO CÁO DOANH THU THEO NĂM (top sản phẩm)
// Mẫu năm có phần Ước tính/Thực tế; không có dữ liệu ước tính nên xuất Ước tính = 0.
// ===============================
const getYearlyTopProducts = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 50);

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const rows = await OrderItem.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: "$order" },
      {
        $match: {
          "order.storeId": toObjectId(storeId),
          "order.status": { $in: PAID_STATUSES },
          "order.createdAt": { $gte: start, $lte: end },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $addFields: {
          netLine: { $toDouble: "$subtotal" },
        },
      },
      {
        $group: {
          _id: "$productId",
          sku: { $first: "$product.sku" },
          name: { $first: "$product.name" },
          qty: { $sum: "$quantity" },
          revenue: { $sum: "$netLine" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          sku: 1,
          name: 1,
          itemsSold: "$qty",
          estimateRevenue: { $literal: 0 },
          actualRevenue: "$revenue",
        },
      },
    ]);

    return res.json({ message: "Báo cáo doanh thu theo năm (top sản phẩm)", year, data: rows || [] });
  } catch (err) {
    console.error("Lỗi báo cáo theo năm (top sản phẩm):", err);
    return res.status(500).json({ message: "Lỗi server khi báo cáo theo năm" });
  }
};

const exportYearlyTopProducts = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const year = parseYear(req.query.year);
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 50);
    const { format = "xlsx" } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }
    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    let rows;
    await getYearlyTopProducts(
      { query: { storeId, year, limit } },
      {
        json: ({ data }) => {
          rows = data;
        },
        status: () => ({ json: () => {} }),
      }
    );

    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const wb = XLSX.utils.book_new();
    const sheetData = rows.map((r, idx) => ({
      STT: idx + 1,
      "Mã hàng": r.sku,
      "Tên sản phẩm": r.name,
      "Số lượng bán": safeNumber(r.itemsSold),
      "Ước tính (VNĐ)": safeNumber(r.estimateRevenue),
      "Thực tế (VNĐ)": safeNumber(r.actualRevenue),
    }));
    const ws = createWorksheetWithReportHeader({
      reportTitle: "Báo cáo theo năm",
      req,
      sheetData,
    });
    ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo theo năm");

    if (format === "xlsx") {
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer", cellStyles: true });
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Nam", req });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      return res.send(buffer);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const fileName = buildExportFileName({ reportName: "Bao_Cao_Doanh_Thu_Theo_Nam", req });
      res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(".xlsx", ".pdf")}"`);

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont("Roboto-Regular", path.join(fontPath, "Roboto-Regular.ttf"));
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));

      doc.font("Roboto-Bold").fontSize(18).text("BÁO CÁO DOANH THU THEO NĂM", { align: "center" });
      doc.font("Roboto-Regular").fontSize(11).text(`Năm: ${year}`, { align: "center" });
      doc.moveDown(2);

      rows.forEach((r, idx) => {
        doc.font("Roboto-Bold").fontSize(10).text(`${idx + 1}. ${r.name || r.sku}`);
        doc.font("Roboto-Regular").text(`   Số lượng: ${safeNumber(r.itemsSold)} | Thực tế: ${new Intl.NumberFormat("vi-VN").format(safeNumber(r.actualRevenue))} VND`, { indent: 20 });
        doc.moveDown(0.4);
      });

      doc.end();
      return;
    }
  } catch (err) {
    console.error("Lỗi export báo cáo theo năm:", err);
    return res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

module.exports = {
  calcRevenueByPeriod,
  getRevenueByPeriod,
  getRevenueByEmployee,
  exportRevenue,
  getRevenueSummaryByYear,
  exportRevenueSummaryByYear,
  getDailyProductSales,
  exportDailyProductSales,
  getYearlyCategoryCompare,
  exportYearlyCategoryCompare,
  getMonthlyRevenueByDay,
  exportMonthlyRevenueByDay,
  getMonthlyRevenueSummary,
  exportMonthlyRevenueSummary,
  getMonthlyTopProducts,
  exportMonthlyTopProducts,
  getQuarterlyRevenueByCategory,
  exportQuarterlyRevenueByCategory,
  getYearlyTopProducts,
  exportYearlyTopProducts,
  getYearlyProductGroupProductCompare,
  exportYearlyProductGroupProductCompare,
};
