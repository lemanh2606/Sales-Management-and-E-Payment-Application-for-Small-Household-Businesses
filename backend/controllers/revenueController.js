// backend/controllers/revenueController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { periodToRange } = require("../utils/period");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const dayjs = require("dayjs");
require("dayjs/locale/vi");
dayjs.locale("vi");

// ========== HÀM TÍNH DOANH THU – CÓ CẢ HOÀN 1 NỬA partially_refunded ==========
async function calcRevenueByPeriod({ storeId, periodType, periodKey, type = "total" }) {
  const { start, end } = periodToRange(periodType, periodKey);

  // Chỉ lấy các đơn ĐÃ THANH TOÁN (toàn bộ hoặc 1 phần)
  const baseMatch = {
    storeId: new mongoose.Types.ObjectId(storeId),
    status: { $in: ["paid", "partially_refunded"] }, // ← quan trọng: lấy cả 2 loại
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
        },
      },
    ];

    const result = await Order.aggregate(pipeline);
    const row = result[0] || { totalRevenue: 0, countOrders: 0 };

    return [
      {
        periodType,
        periodKey,
        totalRevenue: row.totalRevenue,
        countOrders: row.countOrders,
        // ✅ THÊM 2 FIELD NÀY
        completedOrders: row.completedOrders || 0,
        partialRefundOrders: row.partialRefundOrders || 0,
      },
    ];
  }

  // =================== THEO NHÂN VIÊN ===================
  if (type === "employee") {
    const pipeline = [
      {
        $match: {
          ...baseMatch,
          employeeId: { $ne: null }, // ⭐ DÒNG QUAN TRỌNG
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

    const result = await Order.aggregate(pipeline);
    return result;
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
    const { periodType, periodKey, storeId, format = "xlsx" } = req.query;

    if (!periodType || !storeId) {
      return res.status(400).json({ message: "Thiếu periodType hoặc storeId" });
    }

    if (format !== "xlsx") {
      return res.status(400).json({ message: "Chỉ hỗ trợ xuất Excel (.xlsx)" });
    }

    // LẤY CẢ 2 DỮ LIỆU
    const [totalData, empData] = await Promise.all([
      calcRevenueByPeriod({ storeId, periodType, periodKey, type: "total" }),
      calcRevenueByPeriod({ storeId, periodType, periodKey, type: "employee" }),
    ]);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng hợp
    if (totalData && totalData.length > 0) {
      const totalSheetData = totalData.map((item) => ({
        "Kỳ báo cáo": item.periodKey,
        "Tổng doanh thu (₫)": Number(item.totalRevenue),
        "Số hóa đơn": item.countOrders,
      }));
      const ws1 = XLSX.utils.json_to_sheet(totalSheetData);
      ws1["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");
    }

    // Sheet 2: Nhân viên
    if (empData && empData.length > 0) {
      const empSheetData = empData.map((item) => ({
        "Nhân viên": item.employeeInfo?.fullName || "Nhân viên đã nghỉ",
        "Số điện thoại": item.employeeInfo?.phone || "—",
        "Doanh thu (₫)": Number(item.totalRevenue),
        "Số hóa đơn": item.countOrders,
      }));

      const ws2 = XLSX.utils.json_to_sheet(empSheetData);
      ws2["!cols"] = [
        { wch: 28 }, // Nhân viên
        { wch: 16 }, // Số điện thoại
        { wch: 22 }, // Doanh thu
        { wch: 14 }, // Số hóa đơn
      ];

      // Tô đậm header
      const headerRange = XLSX.utils.decode_range(ws2["!ref"]);
      for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws2[cellAddress]) continue;
        ws2[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "1890ff" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }

      XLSX.utils.book_append_sheet(wb, ws2, "Nhân viên");
    }

    if (!totalData?.length && !empData?.length) {
      return res.status(404).json({ message: "Không có dữ liệu để xuất" });
    }

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    const fileName = `Bao_Cao_Doanh_Thu_${periodKey || "hien_tai"}_${dayjs().format("DD-MM-YYYY")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Lỗi export báo cáo doanh thu:", err);
    res.status(500).json({ message: "Lỗi server khi xuất Excel" });
  }
};

module.exports = { calcRevenueByPeriod, getRevenueByPeriod, getRevenueByEmployee, exportRevenue };
