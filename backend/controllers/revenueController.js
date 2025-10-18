// controllers/revenueController.js (fix exportRevenue: buffer PDF full trước res.send, catch pdfkit error - paste thay file)
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { periodToRange } = require("../utils/period"); // 👈 Reuse từ period.js
const { Parser } = require("json2csv"); // 👈 Export CSV
const PDFDocument = require("pdfkit"); // 👈 Export PDF

// GET /api/revenue - Tổng doanh thu theo period (sum totalAmount from Order paid/printDate in range)
const getRevenueByPeriod = async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.shopId;
    const { periodType, periodKey } = req.query; // Params: periodType, periodKey, storeId (optional)

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId hoặc shopId để xác định cửa hàng" });
    }
    const { start, end } = periodToRange(periodType, periodKey); // 👈 Lấy range từ period.js

    const pipeline = [
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId), // 👈 Filter storeId
          status: "paid", // 👈 Chỉ order đã thanh toán
          printDate: { $gte: start, $lte: end }, // 👈 Filter printDate in range (đã in bill = xác nhận bán)
        },
      },
      {
        $group: {
          _id: null, // 👈 Group tổng
          totalRevenue: { $sum: "$totalAmount" }, // 👈 Sum totalAmount (Decimal128, Mongo aggregate ok)
          countOrders: { $sum: 1 }, // 👈 Số order
        },
      },
      { $project: { _id: 0 } }, // 👈 Loại bỏ _id null, response sạch { totalRevenue, countOrders }
    ];

    const result = await Order.aggregate(pipeline); // 👈 Aggregate từ Order

    const revenue = result[0] || { totalRevenue: 0, countOrders: 0 }; // 👈 Default 0 nếu ko data
    console.log(
      `Báo cáo doanh thu thành công cho period ${periodType} ${periodKey}, store ${storeId}: ${revenue.totalRevenue} VND, ${revenue.countOrders} hóa đơn`
    );

    res.json({ message: "Báo cáo doanh thu thành công", revenue }); // 👈 Response { totalRevenue Decimal, countOrders }
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu:", err.message);
    res.status(500).json({ message: "Lỗi server khi báo cáo doanh thu" });
  }
};

// GET /api/revenue/employee - Doanh thu theo nhân viên (group by employeeId, sum totalAmount in period)
const getRevenueByEmployee = async (req, res) => {
  try {
    const { periodType, periodKey, storeId } = req.query; // Params: periodType, periodKey, storeId

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }

    const { start, end } = periodToRange(periodType, periodKey); // 👈 Lấy range từ period.js

    const pipeline = [
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId), // 👈 Filter storeId
          status: "paid", // 👈 Chỉ order đã thanh toán
          printDate: { $gte: start, $lte: end }, // 👈 Filter printDate in range
        },
      },
      {
        $group: {
          _id: "$employeeId", // 👈 Group by nhân viên ID
          totalRevenue: { $sum: "$totalAmount" }, // 👈 Sum totalAmount per nhân viên
          countOrders: { $sum: 1 }, // 👈 Số order per nhân viên
        },
      },
      {
        $lookup: {
          // 👈 Populate nhân viên info từ Employee
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employeeInfo",
          pipeline: [{ $project: { fullName: 1, phone: 1 } }], // Chỉ lấy fullName, phone
        },
      },
      { $unwind: "$employeeInfo" }, // 👈 Unwind để object
      { $sort: { totalRevenue: -1 } }, // 👈 Sắp xếp doanh thu cao nhất trước
    ];

    const results = await Order.aggregate(pipeline); // 👈 Aggregate từ Order

    console.log(
      `Báo cáo doanh thu theo nhân viên thành công cho period ${periodType} ${periodKey}, store ${storeId}: ${results.length} nhân viên`
    );

    res.json({ message: "Báo cáo doanh thu theo nhân viên thành công", data: results }); // 👈 Response array { _id employeeId, totalRevenue, countOrders, employeeInfo { fullName, phone } }
  } catch (err) {
    console.error("Lỗi báo cáo doanh thu theo nhân viên:", err.message);
    res.status(500).json({ message: "Lỗi server khi báo cáo doanh thu theo nhân viên" });
  }
};

// GET /api/revenue/export - Export báo cáo doanh thu CSV/PDF (total or by employee)
const exportRevenue = async (req, res) => {
  try {
    const { type = "total", periodType, periodKey, storeId, format = "csv" } = req.query;
    if (!periodType || !storeId || !format) {
      return res.status(400).json({ message: "Thiếu periodType, storeId hoặc format" });
    }
    const { start, end } = periodToRange(periodType, periodKey); // 👈 Lấy range từ period.js

    let data = [];
    if (type === "total") {
      const pipeline = [
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId), // 👈 Filter storeId
            status: "paid", // 👈 Chỉ order đã thanh toán
            printDate: { $gte: start, $lte: end }, // 👈 Filter printDate in range
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" }, // 👈 Sum totalAmount
            countOrders: { $sum: 1 }, // 👈 Số order
          },
        },
        { $project: { _id: 0 } }, // 👈 Loại bỏ _id null, response sạch
      ];
      const result = await Order.aggregate(pipeline); // 👈 Aggregate từ Order
      data = [
        { periodType, periodKey, totalRevenue: result[0]?.totalRevenue || 0, countOrders: result[0]?.countOrders || 0 },
      ]; // 👈 Data array cho export
    } else if (type === "employee") {
      const pipeline = [
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId), // 👈 Filter storeId
            status: "paid", // 👈 Chỉ order đã thanh toán
            printDate: { $gte: start, $lte: end }, // 👈 Filter printDate in range
          },
        },
        {
          $group: {
            _id: "$employeeId", // 👈 Group by nhân viên ID
            totalRevenue: { $sum: "$totalAmount" }, // 👈 Sum totalAmount per nhân viên
            countOrders: { $sum: 1 }, // 👈 Số order per nhân viên
          },
        },
        {
          $lookup: {
            // 👈 Populate nhân viên info từ Employee
            from: "employees",
            localField: "_id",
            foreignField: "_id",
            as: "employeeInfo",
            pipeline: [{ $project: { fullName: 1, phone: 1 } }], // Chỉ lấy fullName, phone
          },
        },
        { $unwind: "$employeeInfo" }, // 👈 Unwind để object
        { $sort: { totalRevenue: -1 } }, // 👈 Sắp xếp doanh thu cao nhất trước
      ];
      data = await Order.aggregate(pipeline); // 👈 Aggregate từ Order
    }

    if (format === "csv") {
      const fields = Object.keys(data[0] || {}); // 👈 Fields từ data đầu
      const parser = new Parser({ fields });
      const csv = parser.parse(data); // 👈 Parse array thành CSV
      res.header("Content-Type", "text/csv");
      res.attachment(`doanh_thu_${type}_${periodKey}_${periodType}.csv`); // 👈 Tên file CSV
      return res.send(csv);
    } else if (format === "pdf") {
      try {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=doanh_thu_${type}_${periodKey}_${periodType}.pdf`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // ====== HEADER ======
        doc.fontSize(18).text("BÁO CÁO DOANH THU", { align: "center", underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Kỳ báo cáo: ${periodKey} (${periodType.toUpperCase()})`, { align: "center" });
        doc.moveDown(2);

        if (type === "total") {
          // ====== CHẾ ĐỘ: TỔNG DOANH THU ======
          doc.fontSize(12).text(`Tổng doanh thu: ${data[0].totalRevenue.toString()} VND`);
          doc.text(`Số hóa đơn: ${data[0].countOrders}`);
        } else {
          // ====== CHẾ ĐỘ: THEO NHÂN VIÊN ======
          doc.fontSize(14).text("Doanh thu theo nhân viên", { underline: true });
          doc.moveDown();

          // === TABLE HEADER ===
          const tableTop = doc.y;
          const col1 = 50; // Tên nhân viên
          const col2 = 280; // Số hóa đơn
          const col3 = 400; // Doanh thu

          doc
            .fontSize(12)
            .text("Nhân viên", col1, tableTop)
            .text("Số HĐ", col2, tableTop)
            .text("Doanh thu (VND)", col3, tableTop);

          doc
            .moveTo(50, tableTop + 15) // kẻ line dưới header
            .lineTo(550, tableTop + 15)
            .stroke();

          // === TABLE ROWS ===
          let y = tableTop + 25;
          let totalAll = 0;
          data.forEach((row) => {
            const revenue = parseFloat(row.totalRevenue.toString());
            totalAll += revenue;

            doc
              .fontSize(11)
              .text(row.employeeInfo.fullName, col1, y)
              .text(row.countOrders.toString(), col2, y)
              .text(revenue.toLocaleString("vi-VN"), col3, y, { align: "left" });

            y += 20;
          });

          // === TOTAL ===
          doc.moveTo(50, y).lineTo(550, y).stroke();

          doc.fontSize(12).text(`TỔNG DOANH THU: ${totalAll.toLocaleString("vi-VN")} VND`, col1, y + 10);
        }

        doc.end(); // 🚨 QUAN TRỌNG: kết thúc stream
        return; // ❗ Không res.json nữa
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

module.exports = { getRevenueByPeriod, getRevenueByEmployee, exportRevenue };
