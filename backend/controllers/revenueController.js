const mongoose = require("mongoose");
const Order = require("../models/Order");
const { periodToRange } = require("../utils/period");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");

// ========== HÀM DÙNG CHUNG: TÍNH DOANH THU ==========
// type = "total" | "employee"
async function calcRevenueByPeriod({ storeId, periodType, periodKey, type = "total" }) {
  const { start, end } = periodToRange(periodType, periodKey);

  if (type === "total") {
    const pipeline = [
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          status: "paid",
          printDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          countOrders: { $sum: 1 },
        },
      },
      { $project: { _id: 0 } },
    ];
    const result = await Order.aggregate(pipeline);
    return [
      {
        periodType,
        periodKey,
        totalRevenue: result[0]?.totalRevenue || 0,
        countOrders: result[0]?.countOrders || 0,
      },
    ];
  }

  if (type === "employee") {
    const pipeline = [
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          status: "paid",
          printDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$employeeId",
          totalRevenue: { $sum: "$totalAmount" },
          countOrders: { $sum: 1 },
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
      { $unwind: "$employeeInfo" },
      { $sort: { totalRevenue: -1 } },
    ];
    return await Order.aggregate(pipeline);
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

    const data = await calcRevenueByPeriod({ storeId, periodType, periodKey, type: "total" });
    const revenue = data[0] || { totalRevenue: 0, countOrders: 0 };

    console.log(`✅ Báo cáo doanh thu ${periodType} ${periodKey}: ${revenue.totalRevenue} VND`);
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

    const data = await calcRevenueByPeriod({ storeId, periodType, periodKey, type: "employee" });
    res.json({ message: "Báo cáo doanh thu theo nhân viên thành công", data });
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu theo nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi báo cáo doanh thu theo nhân viên" });
  }
};

// ========== 3️⃣ GET /api/revenue/export ==========
const exportRevenue = async (req, res) => {
  try {
    const { type = "total", periodType, periodKey, storeId, format = "csv" } = req.query;
    if (!periodType || !storeId || !format) {
      return res.status(400).json({ message: "Thiếu periodType, storeId hoặc format" });
    }

    const data = await calcRevenueByPeriod({ storeId, periodType, periodKey, type });

    if (format === "csv") {
      const fields = Object.keys(data[0] || {});
      const parser = new Parser({ fields });
      const csv = parser.parse(data);
      res.header("Content-Type", "text/csv");
      res.attachment(`doanh_thu_${type}_${periodKey}_${periodType}.csv`);
      return res.send(csv);
    }

    if (format === "pdf") {
      try {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=doanh_thu_${type}_${periodKey}_${periodType}.pdf`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        doc.fontSize(18).text("BÁO CÁO DOANH THU", { align: "center", underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Kỳ báo cáo: ${periodKey} (${periodType.toUpperCase()})`, { align: "center" });
        doc.moveDown(2);

        if (type === "total") {
          doc.fontSize(12).text(`Tổng doanh thu: ${data[0].totalRevenue.toString()} VND`);
          doc.text(`Số hóa đơn: ${data[0].countOrders}`);
        } else {
          doc.fontSize(14).text("Doanh thu theo nhân viên", { underline: true });
          doc.moveDown();

          const tableTop = doc.y;
          const col1 = 50,
            col2 = 280,
            col3 = 400;

          doc
            .fontSize(12)
            .text("Nhân viên", col1, tableTop)
            .text("Số HĐ", col2, tableTop)
            .text("Doanh thu (VND)", col3, tableTop);
          doc
            .moveTo(50, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

          let y = tableTop + 25;
          let totalAll = 0;
          data.forEach((row) => {
            const revenue = parseFloat(row.totalRevenue.toString());
            totalAll += revenue;
            doc
              .fontSize(11)
              .text(row.employeeInfo.fullName, col1, y)
              .text(row.countOrders.toString(), col2, y)
              .text(revenue.toLocaleString("vi-VN"), col3, y);
            y += 20;
          });

          doc.moveTo(50, y).lineTo(550, y).stroke();
          doc.fontSize(12).text(`TỔNG DOANH THU: ${totalAll.toLocaleString("vi-VN")} VND`, col1, y + 10);
        }

        doc.end();
        return;
      } catch (pdfErr) {
        console.error("Lỗi tạo PDF:", pdfErr.message);
        res.status(500).json({ message: "Lỗi tạo file PDF" });
      }
    }
  } catch (err) {
    console.error("Lỗi export báo cáo doanh thu:", err.message);
    res.status(500).json({ message: "Lỗi server khi export báo cáo" });
  }
};

module.exports = { calcRevenueByPeriod, getRevenueByPeriod, getRevenueByEmployee, exportRevenue };
