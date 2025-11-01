// backend/controllers/financialController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseReturn = require("../models/PurchaseReturn");
const StockCheck = require("../models/StockCheck");
const StockDisposal = require("../models/StockDisposal");
const Employee = require("../models/Employee");
const { calcRevenueByPeriod } = require("./revenueController");
const { periodToRange } = require("../utils/period");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");

// 🧮 Helper: safe convert
const toNumber = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val);
  if (val._bsontype === "Decimal128") return parseFloat(val.toString());
  return 0;
};

// 📆 Helper: tháng trong kỳ
function getMonthsInPeriod(periodType) {
  switch (periodType) {
    case "month": //tháng
      return 1;
    case "quarter": //quý
      return 3;
    case "year": //năm
      return 12;
    default:
      return 1;
  }
}

// =====================================================================
const calcFinancialSummary = async ({ storeId, periodType, periodKey, extraExpense = 0 }) => {
  const { start, end } = periodToRange(periodType, periodKey);
  const objectStoreId = new mongoose.Types.ObjectId(storeId);

  // 1️⃣ Tổng doanh thu
  const revenueData = await calcRevenueByPeriod({ storeId, periodType, periodKey, type: "total" });
  let totalRevenue = toNumber(revenueData[0]?.totalRevenue);

  // 2️⃣ VAT
  const vat = await Order.aggregate([
    { $match: { storeId: objectStoreId, status: "paid", isVATInvoice: true, printDate: { $gte: start, $lte: end } } },
    { $group: { _id: null, totalVAT: { $sum: "$vatAmount" } } },
  ]);
  let totalVAT = toNumber(vat[0]?.totalVAT);

  // 3️⃣ Chi phí nhập hàng (COGS)
  const purchases = await PurchaseOrder.aggregate([
    { $match: { store_id: objectStoreId, status: "đã nhập hàng", purchase_order_date: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$total_amount" } } },
  ]);
  const returns = await PurchaseReturn.aggregate([
    { $match: { store_id: objectStoreId, status: "đã trả hàng", return_date: { $gte: start, $lte: end } } },
    { $group: { _id: null, total: { $sum: "$total_amount" } } },
  ]);
  let totalCOGS = toNumber(purchases[0]?.total) - toNumber(returns[0]?.total);

  // 4️⃣ Lợi nhuận gộp
  let grossProfit = totalRevenue - totalCOGS;

  // 5️⃣ Chi phí vận hành (Operating Cost)
  const months = getMonthsInPeriod(periodType);
  // cho dù là năm trong tương lai chưa bán hàng, vẫn tính lương cho nhân viên, nếu xoá nhân viên đi thì coi như mọi thứ là 0 vnđ, 
  // còn nếu không thì kể cả là năm 2030 vẫn luôn cộng chi phí lương cho nhân viên, 
  // ví dụ 5 triệu 1 tháng thì 1 year là 60 triệu chi phí vận hành, lợi nhuận ròng là âm 60 triệu
  const employees = await Employee.find({ store_id: objectStoreId, isDeleted: false })
    .populate("user_id", "role")
    .select("salary commission_rate user_id"); //lương và hoa hồng

  const filteredEmployees = employees.filter((e) => ["MANAGER", "STAFF"].includes(e.user_id?.role));

  const totalSalary = filteredEmployees.reduce((sum, e) => sum + toNumber(e.salary) * months, 0);

  const empRevenue = await calcRevenueByPeriod({
    storeId,
    periodType,
    periodKey,
    type: "employee",
  });

  const totalCommission = empRevenue.reduce((sum, r) => {
    const emp = filteredEmployees.find((e) => e._id.toString() === r._id.toString());
    return sum + toNumber(r.totalRevenue) * (toNumber(emp?.commission_rate) / 100);
  }, 0);

  // 👉 FE gửi: ?extraExpense=1000000,2000000 (có thể nhiều hơn hoặc ít hơn)
  if (typeof extraExpense === "string" && extraExpense.includes(",")) {
    extraExpense = extraExpense.split(",").map(Number);
  } else if (Array.isArray(extraExpense)) {
    extraExpense = extraExpense.map(Number);
  } else {
    extraExpense = [Number(extraExpense)];
  }

  const totalExtraExpense = extraExpense.reduce((sum, val) => sum + (val || 0), 0);

  // ✅ Tổng chi phí vận hành trước khi cộng thêm phần điều chỉnh và hủy hàng
  let operatingCost = totalSalary + totalCommission + totalExtraExpense;

  // 9️⃣ Điều chỉnh tồn kho
  const adj = await StockCheck.aggregate([
    { $match: { store_id: objectStoreId, status: "Đã cân bằng", check_date: { $gte: start, $lte: end } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $multiply: [{ $subtract: ["$items.actual_quantity", "$items.book_quantity"] }, "$items.cost_price"],
          },
        },
      },
    },
  ]);
  let stockAdjustmentValue = toNumber(adj[0]?.total);

  // 🔟 Hàng hóa hủy
  const disp = await StockDisposal.aggregate([
    { $match: { store_id: objectStoreId, status: "hoàn thành", disposal_date: { $gte: start, $lte: end } } },
    { $unwind: "$items" },
    { $group: { _id: null, total: { $sum: { $multiply: ["$items.quantity", "$items.unit_cost_price"] } } } },
  ]);
  let stockDisposalCost = toNumber(disp[0]?.total);

  // ✅ Cập nhật operatingCost cuối cùng
  operatingCost += stockDisposalCost;
  if (stockAdjustmentValue < 0) operatingCost += Math.abs(stockAdjustmentValue);
  if (stockAdjustmentValue > 0) grossProfit += stockAdjustmentValue;

  // 6️⃣ Lợi nhuận ròng
  const netProfit = grossProfit - operatingCost - totalVAT;

  // 7️⃣ Giá trị tồn kho hiện tại
  const stock = await Product.aggregate([
    { $match: { store_id: objectStoreId } },
    { $group: { _id: null, total: { $sum: { $multiply: ["$stock_quantity", "$cost_price"] } } } },
  ]);
  let stockValue = toNumber(stock[0]?.total);

  return {
    totalRevenue,
    totalVAT,
    totalCOGS,
    grossProfit,
    operatingCost,
    netProfit,
    stockValue,
    stockAdjustmentValue,
    stockDisposalCost,
  };
};

// =====================================================================
const getFinancialSummary = async (req, res) => {
  try {
    const data = await calcFinancialSummary(req.query);
    res.json({ message: "Báo cáo tài chính thành công", data });
  } catch (err) {
    console.error("Lỗi báo cáo tài chính:", err);
    res.status(500).json({ message: "Lỗi server khi báo cáo tài chính" });
  }
};

// =====================================================================
const exportFinancial = async (req, res) => {
  try {
    const { format = "csv" } = req.query;
    const data = await calcFinancialSummary(req.query);

    const rows = Object.entries(data).map(([metric, value]) => ({ metric, value }));

    if (format === "csv") {
      const parser = new Parser({ fields: ["metric", "value"] });
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv");
      res.attachment("financial_report.csv");
      return res.send(csv);
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      doc.fontSize(18).text("BÁO CÁO TÀI CHÍNH", { align: "center", underline: true }).moveDown();
      rows.forEach((r) => doc.text(`${r.metric}: ${r.value.toLocaleString("vi-VN")} VND`));
      doc.end();
      return;
    }

    res.status(400).json({ message: "Format không hỗ trợ" });
  } catch (err) {
    console.error("Lỗi export:", err);
    res.status(500).json({ message: "Lỗi server khi export báo cáo" });
  }
};

module.exports = { getFinancialSummary, exportFinancial };

/*
Mẫu JSON trả về từ API như sau: period theo YEAR
{
    "message": "Báo cáo tài chính thành công",
    "data": {
        "totalRevenue": 69935800,  -> tổng doanh thu
        "totalVAT": 2450000,       -> thuế giá trị gia tăng phải nộp
        "totalCOGS": 0,            -> Giá vốn hàng bán (Chi phí nhập hàng)
        "grossProfit": 69935800,   -> Lợi nhuận gộp
        "operatingCost": 60034967.9,  -> Chi phí vận hành
        "netProfit": 7450832.1000000015,  -> lợi nhuận ròng (lãi sau thuế)
        "stockValue": 55495000,    -> Giá trị hàng tồn kho
        "stockAdjustmentValue": 0, -> Giá trị điều chỉnh tồn kho
        "stockDisposalCost": 0     -> Chi phí hàng hóa hủy
    }
}
*/
