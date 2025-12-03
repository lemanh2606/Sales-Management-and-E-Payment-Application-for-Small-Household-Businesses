// backend/controllers/financialController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = mongoose.model("OrderItem");
const OrderRefund = mongoose.model("OrderRefund");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseReturn = require("../models/PurchaseReturn");
const StockCheck = require("../models/StockCheck");
const StockDisposal = require("../models/StockDisposal");
const Customer = mongoose.model("Customer");
const Employee = require("../models/Employee");
const Store = require("../models/Store");
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
    {
      $match: { storeId: objectStoreId, status: { $in: ["paid", "partially_refunded"] }, isVATInvoice: true, printDate: { $gte: start, $lte: end } },
    },
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
  //Tổng chi phí vận hành trước khi cộng thêm phần điều chỉnh và hủy hàng
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

  //Cập nhật operatingCost cuối cùng
  operatingCost += stockDisposalCost;
  if (stockAdjustmentValue < 0) operatingCost += Math.abs(stockAdjustmentValue);
  if (stockAdjustmentValue > 0) grossProfit += stockAdjustmentValue;

  // 6️⃣ Lợi nhuận ròng
  const netProfit = grossProfit - operatingCost - totalVAT;

  // 7️⃣ Giá trị tồn kho hiện tại (theo giá vốn + giá bán)
  const stockAgg = await Product.aggregate([
    { $match: { store_id: objectStoreId, isDeleted: { $ne: true } } }, // thêm isDeleted để chắc chắn
    {
      $group: {
        _id: null,
        stockValueAtCost: { $sum: { $multiply: ["$stock_quantity", "$cost_price"] } },
        stockValueAtSale: { $sum: { $multiply: ["$stock_quantity", { $toDecimal: "$price" }] } }, // ← TỒN KHO THEO GIÁ BÁN
      },
    },
  ]);
  const stockResult = stockAgg[0] || { stockValueAtCost: 0, stockValueAtSale: 0 };
  let stockValue = toNumber(stockResult.stockValueAtCost); // giữ nguyên tên cũ (giá vốn)
  let stockValueAtSalePrice = toNumber(stockResult.stockValueAtSale); // ← MỚI!!!

  //8️⃣ TOP NHÓM HÀNG HÓA – SIÊU CHUẨN, DỰA TRÊN ORDERITEM + PRODUCT + PRODUCTGROUP
  const groupStats = await mongoose.model("ProductGroup").aggregate([
    {
      $match: { storeId: objectStoreId, isDeleted: false },
    },

    // JOIN SẢN PHẨM
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "group_id",
        as: "products",
      },
    },

    // JOIN ORDERITEM theo từng sản phẩm
    {
      $lookup: {
        from: "order_items",
        let: { productIds: "$products._id" },
        pipeline: [
          { $match: { $expr: { $in: ["$productId", "$$productIds"] } } },
          {
            $lookup: {
              from: "orders",
              localField: "orderId",
              foreignField: "_id",
              as: "order",
            },
          },
          { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },

          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$order.storeId", objectStoreId] },
                  { $in: ["$order.status", ["paid", "partially_refunded"]] },
                  { $gte: ["$order.printDate", start] },
                  { $lte: ["$order.printDate", end] },
                ],
              },
            },
          },
        ],
        as: "sales",
      },
    },

    // TÍNH TOÁN
    {
      $project: {
        groupName: "$name",

        productCount: { $size: "$products" },

        // TỒN KHO theo giá vốn
        stockValueCost: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: { $multiply: ["$$p.stock_quantity", "$$p.cost_price"] },
            },
          },
        },

        // TỒN KHO theo giá bán
        stockValueSale: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: { $multiply: ["$$p.stock_quantity", { $toDecimal: "$$p.price" }] },
            },
          },
        },
        stockQuantity: { $sum: "$products.stock_quantity" },

        // SỐ LƯỢNG BÁN
        quantitySold: {
          $sum: "$sales.quantity",
        },

        // DOANH THU
        revenue: {
          $sum: {
            $map: {
              input: "$sales",
              as: "s",
              in: { $toDecimal: "$$s.subtotal" },
            },
          },
        },
      },
    },

    // TỈNH TOÁN PHỤ
    {
      $addFields: {
        potentialProfit: { $subtract: ["$stockValueSale", "$stockValueCost"] },
        stockToRevenueRatio: {
          $cond: [{ $gt: ["$revenue", 0] }, { $divide: ["$stockValueSale", "$revenue"] }, 999],
        },
      },
    },

    // SẮP XẾP
    { $sort: { revenue: -1 } },
  ]);
  // Convert Decimal128 → number
  const formattedGroupStats = groupStats.map((g) => ({
    _id: g._id,
    groupName: g.groupName,
    revenue: toNumber(g.revenue),
    quantitySold: g.quantitySold,
    stockQuantity: g.stockQuantity,
    stockValueCost: toNumber(g.stockValueCost),
    stockValueSale: toNumber(g.stockValueSale),
    potentialProfit: toNumber(g.potentialProfit),
    stockToRevenueRatio: g.stockToRevenueRatio,
    productCount: g.productCount || 0,
  }));

  return {
    totalRevenue, //doanh thu
    totalVAT, //thuế GTGT
    totalCOGS, //Chi phí nhập hàng
    grossProfit, //lợi nhuận gộp
    operatingCost, //chi phí vận hành
    netProfit, //lợi nhuận ròng
    stockValue, //giá trị tồn kho
    stockValueAtSalePrice, //giá trị tồn kho theo giá bán
    stockAdjustmentValue, //điều chỉnh tồn kho
    stockDisposalCost, //hàng hóa hủy
    groupStats: formattedGroupStats, //thống kê nhóm hàng hóa
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

// Tính toán báo cáo cuối ngày (end-of-day)
const generateEndOfDayReport = async (req, res) => {
  try {
    const { format } = require("date-fns");
    const { storeId } = req.params;
    const { periodType = "day", periodKey = new Date().toISOString().split("T")[0] } = req.query; // Default today

    // Lấy khoảng thời gian từ period.js
    const { start, end } = periodToRange(periodType, periodKey);

    // 1. Tổng doanh thu, đơn hàng, VAT, giảm giá, điểm tích lũy & tiền mặt
    const ordersAgg = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["paid", "partially_refunded"] },
        },
      },
      {
        $lookup: {
          from: "loyalty_settings",
          localField: "storeId",
          foreignField: "storeId",
          as: "loyalty",
        },
      },
      {
        $project: {
          totalAmount: 1,
          vatAmount: 1,
          paymentMethod: 1,
          usedPoints: 1,
          earnedPoints: 1,
          loyalty: { $arrayElemAt: ["$loyalty", 0] },
        },
      },
      {
        $addFields: {
          // Giảm giá từ điểm = usedPoints * vndPerPoint (mặc định nếu loyalty null thì 0)
          discountFromPoints: {
            $cond: [{ $and: ["$usedPoints", "$loyalty.vndPerPoint"] }, { $multiply: ["$usedPoints", "$loyalty.vndPerPoint"] }, 0],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalVAT: { $sum: "$vatAmount" },
          totalDiscount: { $sum: "$discountFromPoints" }, // tổng giảm giá tích điểm
          totalLoyaltyUsed: { $sum: "$usedPoints" }, // tổng điểm đã dùng
          totalLoyaltyEarned: { $sum: "$earnedPoints" }, // tổng điểm cộng thêm
          cashInDrawer: {
            $sum: {
              $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$totalAmount", 0],
            },
          },
        },
      },
    ]);

    const orderSummary = ordersAgg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalVAT: 0,
      totalDiscount: 0,
      totalLoyaltyUsed: 0,
      totalLoyaltyEarned: 0,
      cashInDrawer: 0,
    };

    // 2. Phân loại theo phương thức thanh toán
    const byPayment = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["paid", "partially_refunded"] },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          revenue: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // 3. Phân loại theo nhân viên
    const byEmployee = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["paid", "partially_refunded"] },
        },
      },
      {
        $group: {
          _id: "$employeeId",
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "employee",
        },
      },
      {
        $project: {
          _id: "$_id",
          name: { $arrayElemAt: ["$employee.fullName", 0] },
          revenue: 1,
          orders: 1,
          avgOrderValue: { $divide: ["$revenue", "$orders"] },
        },
      },
    ]);

    // 4. Theo sản phẩm (bán chạy, hoàn trả)
    const byProduct = await OrderItem.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $match: { "order.storeId": new mongoose.Types.ObjectId(storeId), "order.status": "paid" } },
      {
        $group: {
          _id: "$productId",
          quantitySold: { $sum: "$quantity" },
          revenue: { $sum: "$subtotal" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $project: {
          _id: "$_id",
          name: { $arrayElemAt: ["$product.name", 0] },
          sku: { $arrayElemAt: ["$product.sku", 0] },
          quantitySold: 1,
          revenue: 1,
          refundQuantity: { $literal: 0 }, // Thêm logic refund nếu có
          netSold: { $arrayElemAt: ["$product.stock_quantity", 0] },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // 5. Hoàn trả tổng quan
    const refunds = await OrderRefund.aggregate([
      { $match: { refundedAt: { $gte: start, $lte: end } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $match: { "order.storeId": new mongoose.Types.ObjectId(storeId) } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          refundAmount: { $sum: "$refundAmount" },
        },
      },
    ]);
    const refundSummary = refunds[0] || { totalRefunds: 0, refundAmount: 0 };

    //phân loại hoàn hàng theo nhân viên, ai tiếp khách để hoàn hàng
    const refundsByEmployee = await OrderRefund.aggregate([
      { $match: { refundedAt: { $gte: start, $lte: end } } },
      {
        $lookup: {
          from: "employees",
          localField: "refundedBy",
          foreignField: "_id",
          as: "employee",
        },
      },
      {
        $project: {
          _id: 0,
          refundedBy: "$refundedBy",
          name: { $arrayElemAt: ["$employee.fullName", 0] },
          refundAmount: 1,
          refundedAt: 1,
        },
      },
    ]);

    // 6. Tồn kho cuối ngày
    const stockSnapshot = await Product.aggregate([
      { $match: { store_id: new mongoose.Types.ObjectId(storeId) } },
      {
        $project: {
          productId: "$_id",
          name: "$name",
          sku: "$sku",
          stock: "$stock_quantity",
        },
      },
    ]);

    const storeInfo = await Store.findById(storeId).select("name");
    // Tổng hợp báo cáo
    const report = {
      date: format(end, "dd/MM/yyyy"),
      store: {
        _id: storeId,
        name: storeInfo?.name || "Không xác định",
      },
      summary: {
        totalOrders: toNumber(orderSummary.totalOrders),
        totalRevenue: toNumber(orderSummary.totalRevenue),
        vatTotal: toNumber(orderSummary.totalVAT),
        totalRefunds: toNumber(refundSummary.totalRefunds),
        refundAmount: toNumber(refundSummary.refundAmount),
        cashInDrawer: toNumber(orderSummary.cashInDrawer),
        totalDiscount: toNumber(orderSummary.totalDiscount),
        totalLoyaltyUsed: toNumber(orderSummary.totalLoyaltyUsed),
        totalLoyaltyEarned: toNumber(orderSummary.totalLoyaltyEarned),
      },
      byPayment,
      byEmployee,
      byProduct,
      stockSnapshot,
      refundsByEmployee,
    };

    res.json({ message: "Báo cáo cuối ngày thành công", report });
  } catch (err) {
    console.error("Lỗi báo cáo cuối ngày:", err.message);
    res.status(500).json({ message: "Lỗi server khi tạo báo cáo cuối ngày" });
  }
};

module.exports = { getFinancialSummary, exportFinancial, generateEndOfDayReport };

/*
Mẫu JSON trả về từ API của báo cáo tổng quan "getFinancialSummary" như sau: period theo YEAR (năm 2025)
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
