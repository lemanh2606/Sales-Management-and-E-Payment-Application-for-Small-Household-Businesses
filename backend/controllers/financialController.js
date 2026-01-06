// backend/controllers/financialController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderItem = mongoose.model("OrderItem");
const OrderRefund = mongoose.model("OrderRefund");
const Product = require("../models/Product");
const InventoryVoucher = require("../models/InventoryVoucher");
// ❌ DEPRECATED - Không còn sử dụng trong tính toán tài chính:
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

const calcFinancialSummary = async ({ storeId, periodType, periodKey, extraExpense = 0 }) => {
  const { start, end } = periodToRange(periodType, periodKey);
  const objectStoreId = new mongoose.Types.ObjectId(storeId);

  // ================================================================
  // 1️⃣ DOANH THU: CHỈ TÍNH ĐƠN PAID & PARTIALLY_REFUNDED
  // ================================================================
  const revenueAgg = await Order.aggregate([
    {
      $match: {
        storeId: objectStoreId,
        status: { $in: ["paid", "partially_refunded"] }, // ✅ KHÔNG tính "refunded"
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
        paidOrders: {
          $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] },
        },
        partiallyRefundedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "partially_refunded"] }, 1, 0] },
        },
      },
    },
  ]);

  const revenueData = revenueAgg[0] || {
    grossRevenue: 0,
    totalOrders: 0,
    paidOrders: 0,
    partiallyRefundedOrders: 0,
  };

  // ✅ ĐẾM SỐ ĐƠN HOÀN TOÀN BỘ (KHÔNG TÍNH VÀO DOANH THU)
  const fullyRefundedCount = await Order.countDocuments({
    storeId: objectStoreId,
    status: "refunded",
    createdAt: { $gte: start, $lte: end },
  });

  // ================================================================
  // 2️⃣ TỔNG TIỀN HOÀN TRẢ (Chỉ từ đơn partially_refunded)
  // ================================================================
  const refundAgg = await OrderRefund.aggregate([
    {
      $match: {
        refundedAt: { $gte: start, $lte: end },
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
      },
    },
    {
      $match: {
        "order.storeId": objectStoreId,
        "order.status": { $in: ["partially_refunded"] }, // ✅ CHỈ tính hoàn một phần
      },
    },
    {
      $group: {
        _id: null,
        totalRefundAmount: { $sum: "$refundAmount" },
        totalRefundCount: { $sum: 1 },
      },
    },
  ]);

  const refundData = refundAgg[0] || {
    totalRefundAmount: 0,
    totalRefundCount: 0,
  };

  // ✅ DOANH THU THỰC = Tổng đã thanh toán - Hoàn một phần
  let grossRevenue = toNumber(revenueData.grossRevenue);
  let totalRefundAmount = toNumber(refundData.totalRefundAmount);
  let totalRevenue = grossRevenue - totalRefundAmount;

  // ================================================================
  // 3️⃣ VAT (Không tính đơn refunded)
  // ================================================================
  const vat = await Order.aggregate([
    {
      $match: {
        storeId: objectStoreId,
        status: { $in: ["paid", "partially_refunded"] },
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, totalVAT: { $sum: "$vatAmount" } } },
  ]);
  let totalVAT = toNumber(vat[0]?.totalVAT);

  // ================================================================
  // 4️⃣ COGS (Chi phí hàng bán) - CHỈ TỪ ĐƠN PAID & PARTIALLY_REFUNDED
  // ================================================================
  // Lấy danh sách orderId của đơn paid & partially_refunded
  const validOrders = await Order.find({
    storeId: objectStoreId,
    status: { $in: ["paid", "partially_refunded"] },
    createdAt: { $gte: start, $lte: end },
  }).select("_id");

  const validOrderIds = validOrders.map((o) => o._id);

  const cogsAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "OUT",
        status: "POSTED",
        ref_type: "ORDER",
        ref_id: { $in: validOrderIds }, // ✅ CHỈ lấy COGS của đơn hợp lệ
        voucher_date: { $gte: start, $lte: end },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalCOGS: {
          $sum: {
            $multiply: ["$items.qty_actual", { $toDecimal: "$items.unit_cost" }],
          },
        },
      },
    },
  ]);
  let totalCOGS = toNumber(cogsAgg[0]?.totalCOGS);

  // ✅ TRỪ ĐI COGS CỦA HÀNG HOÀN (Chỉ từ đơn partially_refunded)
  const partiallyRefundedOrders = await Order.find({
    storeId: objectStoreId,
    status: "partially_refunded",
    createdAt: { $gte: start, $lte: end },
  }).select("_id");

  const partiallyRefundedOrderIds = partiallyRefundedOrders.map((o) => o._id);

  const refundCogsAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "IN",
        status: "POSTED",
        ref_type: "ORDER_REFUND",
        ref_id: { $in: partiallyRefundedOrderIds }, // ✅ CHỈ hoàn một phần
        voucher_date: { $gte: start, $lte: end },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalRefundCOGS: {
          $sum: {
            $multiply: ["$items.qty_actual", { $toDecimal: "$items.unit_cost" }],
          },
        },
      },
    },
  ]);
  let totalRefundCOGS = toNumber(refundCogsAgg[0]?.totalRefundCOGS);

  // COGS thực = COGS bán - COGS hoàn
  totalCOGS = totalCOGS - totalRefundCOGS;

  // ================================================================
  // 5️⃣ LỢI NHUẬN GỘP
  // ================================================================
  let grossProfit = totalRevenue - totalCOGS;

  // 5️⃣ Chi phí vận hành (Operating Cost) - DEPRECATED: Lương + Hoa hồng
  // ❌ DEPRECATED (Từ Dec 2025): Không còn tính lương nhân viên và hoa hồng vì là hộ kinh doanh nhỏ lẻ
  // Tự trao đổi trực tiếp. Giữ lại code dưới để làm kỉ niệm học tập.
  const months = getMonthsInPeriod(periodType);
  const employees = await Employee.find({
    store_id: objectStoreId,
    isDeleted: false,
  })
    .populate("user_id", "role")
    .select("salary commission_rate user_id");

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

  if (typeof extraExpense === "string" && extraExpense.includes(",")) {
    extraExpense = extraExpense.split(",").map(Number);
  } else if (Array.isArray(extraExpense)) {
    extraExpense = extraExpense.map(Number);
  } else {
    extraExpense = [Number(extraExpense)];
  }
  const totalExtraExpense = extraExpense.reduce((sum, val) => sum + (val || 0), 0);

  //Tổng chi phí vận hành = Chỉ tính Chi phí ngoài lệ (nhập tay) - Không còn lương + hoa hồng
  let operatingCost = totalExtraExpense;

  // ================================================================
  // 7️⃣ HAO HỤT KHO
  // ================================================================
  const inventoryLossAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "OUT",
        status: "POSTED",
        voucher_date: { $gte: start, $lte: end },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalOutValue: {
          $sum: {
            $multiply: ["$items.qty_actual", { $toDecimal: "$items.unit_cost" }],
          },
        },
      },
    },
  ]);

  let totalOutValue = toNumber(inventoryLossAgg[0]?.totalOutValue);
  let inventoryLoss = totalOutValue - (totalCOGS + totalRefundCOGS);

  if (inventoryLoss > 0) {
    operatingCost += inventoryLoss;
  }

  // ================================================================
  // 8️⃣ LỢI NHUẬN RÒNG
  // ================================================================
  const netProfit = grossProfit - operatingCost - totalVAT;

  // ================================================================
  // 9️⃣ GIÁ TRỊ TỒN KHO
  // ================================================================
  const stockAgg = await Product.aggregate([
    { $match: { store_id: objectStoreId, isDeleted: { $ne: true } } },
    {
      $group: {
        _id: null,
        stockValueAtCost: {
          $sum: { $multiply: ["$stock_quantity", "$cost_price"] },
        },
        stockValueAtSale: {
          $sum: { $multiply: ["$stock_quantity", { $toDecimal: "$price" }] },
        },
      },
    },
  ]);
  const stockResult = stockAgg[0] || {
    stockValueAtCost: 0,
    stockValueAtSale: 0,
  };
  let stockValue = toNumber(stockResult.stockValueAtCost);
  let stockValueAtSalePrice = toNumber(stockResult.stockValueAtSale);

  // ================================================================
  // 🔟 THỐNG KÊ NHÓM HÀNG
  // ================================================================
  const groupStats = await mongoose.model("ProductGroup").aggregate([
    {
      $match: { storeId: objectStoreId, isDeleted: false },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "group_id",
        as: "products",
      },
    },
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
                  { $in: ["$order.status", ["paid", "partially_refunded"]] }, // ✅ Không tính refunded
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
    {
      $project: {
        groupName: "$name",
        productCount: { $size: "$products" },
        stockValueCost: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: { $multiply: ["$$p.stock_quantity", "$$p.cost_price"] },
            },
          },
        },
        stockValueSale: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: {
                $multiply: ["$$p.stock_quantity", { $toDecimal: "$$p.price" }],
              },
            },
          },
        },
        stockQuantity: { $sum: "$products.stock_quantity" },
        quantitySold: {
          $sum: "$sales.quantity",
        },
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
    {
      $addFields: {
        potentialProfit: { $subtract: ["$stockValueSale", "$stockValueCost"] },
        stockToRevenueRatio: {
          $cond: [{ $gt: ["$revenue", 0] }, { $divide: ["$stockValueSale", "$revenue"] }, 999],
        },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

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

  // ================================================================
  // ✅ RETURN DATA
  // ================================================================
  return {
    // ✅ Doanh thu (KHÔNG tính đơn refunded)
    totalRevenue, // Doanh thu thực
    grossRevenue, // Tổng đã thanh toán (không bao gồm đơn refunded)
    totalRefundAmount, // Tiền hoàn từ đơn partially_refunded

    // ✅ Thống kê đơn hàng
    totalOrders: toNumber(revenueData.totalOrders), // Chỉ paid + partially_refunded
    paidOrders: toNumber(revenueData.paidOrders),
    partiallyRefundedOrders: toNumber(revenueData.partiallyRefundedOrders),
    fullyRefundedOrders: fullyRefundedCount, // ✅ Đơn hoàn toàn bộ (không tính vào doanh thu)
    totalRefundCount: toNumber(refundData.totalRefundCount),

    // ✅ Chi phí & Lợi nhuận
    totalVAT,
    totalCOGS,
    totalRefundCOGS,
    grossProfit,
    operatingCost,
    netProfit,

    // ✅ Tồn kho & Hao hụt
    stockValue,
    stockValueAtSalePrice,
    inventoryLoss,
    totalOutValue,

    // ✅ Thống kê nhóm
    groupStats: formattedGroupStats,

    // ❌ DEPRECATED
    stockAdjustmentValue: 0,
    stockDisposalCost: 0,
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

    const rows = Object.entries(data).map(([metric, value]) => ({
      metric,
      value,
    }));

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
          status: { $in: ["paid", "partially_refunded"] },
          createdAt: { $gte: start, $lte: end },
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
          // employeeId: { $ne: null }, // Đã mở để tính cho cả Owner
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
          name: {
            $cond: {
              if: { $eq: ["$_id", null] },
              then: "Chủ cửa hàng (Admin)",
              else: { $ifNull: [{ $arrayElemAt: ["$employee.fullName", 0] }, "Nhân viên đã xóa"] },
            },
          },
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
      {
        $match: {
          "order.storeId": new mongoose.Types.ObjectId(storeId),
          "order.status": { $in: ["paid", "partially_refunded"] },
        },
      },
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

module.exports = {
  getFinancialSummary,
  exportFinancial,
  generateEndOfDayReport,
};
