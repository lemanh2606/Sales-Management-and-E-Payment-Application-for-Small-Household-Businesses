//  // backend/controllers/financialController.js
const mongoose = require("mongoose");
const path = require("path");
const Order = require("../models/Order");
const OrderItem = mongoose.model("OrderItem");
const OrderRefund = mongoose.model("OrderRefund");
const Product = require("../models/Product");
const InventoryVoucher = require("../models/InventoryVoucher");
//  DEPRECATED - Không còn sử dụng trong tính toán tài chính:
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseReturn = require("../models/PurchaseReturn");
const StockCheck = require("../models/StockCheck");
const StockDisposal = require("../models/StockDisposal");
const Customer = mongoose.model("Customer");
const Employee = require("../models/Employee");
const Store = require("../models/Store");
const OperatingExpense = require("../models/OperatingExpense");
const { calcRevenueByPeriod } = require("./revenueController");
const { periodToRange } = require("../utils/period");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// 📆 Helper: lấy kỳ trước đó để so sánh
const getPreviousPeriodKey = (periodType, periodKey) => {
  if (periodType === "month") {
    const [year, month] = periodKey.split("-").map(Number);
    const date = new Date(year, month - 2, 1); // Trừ 1 tháng
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  }
  if (periodType === "quarter") {
    const [yearStr, qStr] = periodKey.split("-Q");
    let year = Number(yearStr);
    let q = Number(qStr);
    if (q === 1) {
      q = 4;
      year -= 1;
    } else {
      q -= 1;
    }
    return `${year}-Q${q}`;
  }
  if (periodType === "year") {
    return String(Number(periodKey) - 1);
  }
  return null;
};

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

const calcFinancialSummary = async ({
  storeId,
  periodType,
  periodKey,
  extraExpense = 0,
}) => {
  const { start, end } = periodToRange(periodType, periodKey);
  const objectStoreId = new mongoose.Types.ObjectId(storeId);

  // ================================================================
  // 1️⃣ DOANH THU: CHỈ TÍNH ĐƠN PAID & PARTIALLY_REFUNDED
  // ================================================================
  // KHÔNG bao gồm đơn "refunded" vào grossRevenue vì đơn đó đã hoàn toàn bộ tiền
  //  Chỉ tính đơn "paid" và "partially_refunded" vào doanh thu
  const revenueAgg = await Order.aggregate([
    {
      $match: {
        storeId: objectStoreId,
        status: { $in: ["paid", "partially_refunded", "refunded"] }, //  Bao gồm cả refunded để bù trừ
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: { $toDecimal: "$totalAmount" } },
        totalOrders: { $sum: 1 },
        totalUsedPoints: { $sum: "$usedPoints" }, //  Tính tổng điểm đã dùng
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
    totalUsedPoints: 0,
    paidOrders: 0,
    partiallyRefundedOrders: 0,
  };

  // Lấy cấu hình tích điểm để tính tiền giảm giá
  const loyaltySetting = await mongoose
    .model("LoyaltySetting")
    .findOne({ storeId: objectStoreId });
  const vndPerPoint = loyaltySetting?.vndPerPoint || 0;
  const totalPointDiscount =
    toNumber(revenueData.totalUsedPoints) * vndPerPoint;

  const fullyRefundedCount = await Order.countDocuments({
    storeId: objectStoreId,
    status: "refunded",
    createdAt: { $gte: start, $lte: end },
  });

  // ================================================================
  // 2️⃣ TỔNG TIỀN HOÀN TRẢ (Tính theo ngày hoàn hàng - RefundedAt)
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
        as: "orderInfo",
      },
    },
    { $unwind: "$orderInfo" },
    { $match: { "orderInfo.storeId": objectStoreId } },
    {
      $group: {
        _id: null,
        totalRefundAmount: { $sum: { $toDecimal: "$refundAmount" } },
        totalRefundVAT: { $sum: { $toDecimal: "$refundVATAmount" } }, //  Thuế VAT của hàng hoàn
        totalRefundCount: { $sum: 1 },
      },
    },
  ]);

  const refundData = refundAgg[0] || {
    totalRefundAmount: 0,
    totalRefundVAT: 0,
    totalRefundCount: 0,
  };

  //  DOANH THU THỰC = Tổng đã thanh toán - Hoàn trả
  // totalAmount đã trừ chiết khấu tích điểm tại POS nên KHÔNG trừ lại totalPointDiscount ở đây
  let grossRevenue = toNumber(revenueData.grossRevenue);
  let totalRefundAmount = toNumber(refundData.totalRefundAmount);
  let totalRevenue = Math.max(0, grossRevenue - totalRefundAmount);

  // ================================================================
  // 3️⃣ VAT (Chỉ tính đơn paid và partially_refunded)
  // ================================================================
  const vat = await Order.aggregate([
    {
      $match: {
        storeId: objectStoreId,
        status: { $in: ["paid", "partially_refunded", "refunded"] }, //  Bao gồm cả refunded
        createdAt: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: null, totalVAT: { $sum: { $toDecimal: "$vatAmount" } } } },
  ]);

  // VAT thực tế = VAT từ đơn hàng - VAT từ đơn hoàn trả
  let orderVAT = toNumber(vat[0]?.totalVAT);
  let totalRefundVAT = toNumber(refundData.totalRefundVAT);
  let totalVAT = Math.max(0, orderVAT - totalRefundVAT);

  // ================================================================
  // 4️⃣ COGS (Chi phí hàng bán) - CHỈ TỪ ĐƠN PAID & PARTIALLY_REFUNDED
  // ================================================================
  //  Bao gồm cả đơn refunded vì COGS sẽ được trừ đi bởi phiếu nhập hoàn (ORDER_REFUND)
  const cogsAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "OUT",
        status: "POSTED",
        ref_type: "ORDER",
        voucher_date: { $gte: start, $lte: end }, //  Theo ngày xuất kho thực tế
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalCOGS: {
          $sum: {
            $multiply: [
              "$items.qty_actual",
              { $toDecimal: "$items.unit_cost" },
            ],
          },
        },
      },
    },
  ]);
  let totalCOGS = toNumber(cogsAgg[0]?.totalCOGS);

  const refundCogsAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "IN",
        status: "POSTED",
        ref_type: "ORDER_REFUND",
        voucher_date: { $gte: start, $lte: end }, //  Theo ngày nhập hoàn thực tế
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalRefundCOGS: {
          $sum: {
            $multiply: [
              "$items.qty_actual",
              { $toDecimal: "$items.unit_cost" },
            ],
          },
        },
      },
    },
  ]);
  let totalRefundCOGS = toNumber(refundCogsAgg[0]?.totalRefundCOGS);

  // COGS thực = COGS bán - COGS hoàn
  totalCOGS = Math.max(0, totalCOGS - totalRefundCOGS);

  // ================================================================
  // 5️⃣ LỢI NHUẬN GỘP
  // ================================================================
  // Doanh thu thực không thể âm
  totalRevenue = Math.max(0, totalRevenue);

  let grossProfit = Math.max(0, totalRevenue - totalCOGS);

  // 5️⃣ Chi phí vận hành (Operating Cost)
  // Tính lương nhân viên và hoa hồng (Dành cho hộ kinh doanh có thuê staff)
  const months = getMonthsInPeriod(periodType);
  const employees = await Employee.find({
    store_id: objectStoreId,
    isDeleted: false,
  })
    .populate("user_id", "role")
    .select("salary commission_rate user_id");

  // Chỉ tính chi phí cho MANAGER và STAFF (không tính owner/admin)
  const filteredEmployees = employees.filter((e) =>
    ["MANAGER", "STAFF"].includes(e.user_id?.role)
  );

  const totalSalary = filteredEmployees.reduce(
    (sum, e) => sum + toNumber(e.salary) * months,
    0
  );

  const empRevenue = await calcRevenueByPeriod({
    storeId,
    periodType,
    periodKey,
    type: "employee",
  });

  const totalCommission = empRevenue.reduce((sum, r) => {
    if (!r._id) return sum;
    const emp = filteredEmployees.find(
      (e) => e._id && e._id.toString() === r._id.toString()
    );
    return (
      sum + toNumber(r.totalRevenue) * (toNumber(emp?.commission_rate) / 100)
    );
  }, 0);

  // Fetch manual extra expenses from DB (Aggregate from sub-periods)
  let opExpFilter = { storeId: objectStoreId, isDeleted: false };
  if (periodType === "month") {
    opExpFilter.periodType = "month";
    opExpFilter.periodKey = periodKey;
  } else if (periodType === "quarter") {
    const [year, qStr] = periodKey.split("-Q");
    const q = parseInt(qStr, 10);
    const months = [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ];
    const quarterMonths = months
      .slice((q - 1) * 3, q * 3)
      .map((m) => `${year}-${m}`);
    opExpFilter.$or = [
      { periodType: "quarter", periodKey: periodKey },
      { periodType: "month", periodKey: { $in: quarterMonths } },
    ];
  } else if (periodType === "year") {
    const year = periodKey;
    const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q) => `${year}-${q}`);
    const months = Array.from(
      { length: 12 },
      (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
    );
    opExpFilter.$or = [
      { periodType: "year", periodKey: periodKey },
      { periodType: "quarter", periodKey: { $in: quarters } },
      { periodType: "month", periodKey: { $in: months } },
    ];
  }

  const opExpDocs = await OperatingExpense.find(opExpFilter);
  const totalExtraExpense = opExpDocs.reduce((sum, doc) => {
    return (
      sum + (doc.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0)
    );
  }, 0);

  // Tổng chi phí vận hành = Chi phí ngoài (điện, nước...) + Lương + Hoa hồng
  let operatingCost = totalExtraExpense + totalSalary + totalCommission;

  // ================================================================
  // 7️⃣ HAO HỤT KHO (Chỉ tính phiếu xuất không phải bán hàng)
  // ================================================================
  //  Hao hụt kho = Tổng giá trị hàng xuất kho KHÔNG phải do bán hàng
  // Bao gồm: Kiểm kê (ADJUSTMENT), Tiêu hủy (DISPOSAL), Hết hạn (EXPIRED), Hư hỏng (DAMAGED), Chuyển kho (TRANSFER)
  const inventoryLossAgg = await InventoryVoucher.aggregate([
    {
      $match: {
        store_id: objectStoreId,
        type: "OUT",
        status: "POSTED",
        voucher_date: { $gte: start, $lte: end },
        //  Chỉ tính các loại không phải bán hàng
        ref_type: { $nin: ["ORDER", "ORDER_REFUND"] },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: null,
        totalOutValue: {
          $sum: {
            $multiply: [
              "$items.qty_actual",
              { $toDecimal: "$items.unit_cost" },
            ],
          },
        },
      },
    },
  ]);

  let totalOutValue = toNumber(inventoryLossAgg[0]?.totalOutValue);
  let inventoryLoss = totalOutValue; //  Hao hụt = Tổng giá trị xuất kho không phải bán hàng

  // ================================================================
  // 8️⃣ LỢI NHUẬN GỘP & LỢI NHUẬN RÒNG (Chuẩn nghiệp vụ)
  // ================================================================
  // Doanh thu thuần (Net Sales) = Tổng doanh thu thu về - Thuế VAT (thu hộ)
  const netSales = totalRevenue - totalVAT;

  // Lợi nhuận gộp (Gross Profit) = Doanh thu thuần - Giá vốn hàng bán
  const grossProfitStandard = netSales - totalCOGS;

  // Lợi nhuận ròng (Net Profit) = Lợi nhuận gộp - Chi phí vận hành
  // (Bỏ khấu trừ hao hụt kho theo yêu cầu người dùng)
  const netProfit = grossProfitStandard - operatingCost;

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
                  {
                    $in: [
                      "$order.status",
                      ["paid", "partially_refunded", "refunded"],
                    ],
                  }, //  Bao gồm cả refunded để bù trừ hoàn trả
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
        // ========== Danh sách sản phẩm chi tiết cho drill-down ==========
        productDetails: {
          $map: {
            input: "$products",
            as: "p",
            in: {
              _id: "$$p._id",
              name: "$$p.name",
              code: "$$p.code",
              cost_price: { $toDecimal: "$$p.cost_price" },
              stock_quantity: "$$p.stock_quantity",
              stockValueCost: {
                $multiply: [
                  "$$p.stock_quantity",
                  { $toDecimal: "$$p.cost_price" },
                ],
              },
            },
          },
        },
        stockValueCost: {
          $sum: {
            $map: {
              input: "$products",
              as: "p",
              in: {
                $multiply: [
                  "$$p.stock_quantity",
                  { $toDecimal: "$$p.cost_price" },
                ],
              },
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
          $sum: {
            $map: {
              input: "$sales",
              as: "s",
              in: {
                $subtract: [
                  "$$s.quantity",
                  { $ifNull: ["$$s.refundedQuantity", 0] },
                ],
              },
            },
          },
        },
        revenue: {
          $sum: {
            $map: {
              input: "$sales",
              as: "s",
              in: {
                $multiply: [
                  {
                    $subtract: [
                      "$$s.quantity",
                      { $ifNull: ["$$s.refundedQuantity", 0] },
                    ],
                  }, //  Thực bán
                  {
                    $add: [
                      { $toDecimal: "$$s.priceAtTime" },
                      {
                        $divide: [
                          { $toDecimal: { $ifNull: ["$$s.vat_amount", 0] } },
                          {
                            $cond: [
                              { $gt: ["$$s.quantity", 0] },
                              "$$s.quantity",
                              1,
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    {
      $addFields: {
        potentialProfit: { $subtract: ["$stockValueSale", "$stockValueCost"] },
        stockToRevenueRatio: {
          $cond: [
            { $gt: ["$revenue", 0] },
            { $divide: ["$stockValueSale", "$revenue"] },
            999,
          ],
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
    // ========== Danh sách sản phẩm chi tiết ==========
    productDetails: (g.productDetails || []).map((p) => ({
      _id: p._id,
      name: p.name,
      code: p.code,
      cost_price: toNumber(p.cost_price),
      stock_quantity: p.stock_quantity || 0,
      stockValueCost: toNumber(p.stockValueCost),
    })),
  }));

  // ================================================================
  //  RETURN DATA
  // ================================================================
  return {
    //  Doanh thu (KHÔNG tính đơn refunded)
    totalRevenue, // Doanh thu thực (đã trừ hoàn & points discount)
    grossRevenue, // Tổng đã thanh toán (không bao gồm đơn refunded)
    totalRefundAmount, // Tiền hoàn từ đơn partially_refunded
    totalPointDiscount, //  Giảm giá từ tích điểm

    //  Thống kê đơn hàng
    totalOrders: toNumber(revenueData.totalOrders), // Chỉ paid + partially_refunded
    paidOrders: toNumber(revenueData.paidOrders),
    partiallyRefundedOrders: toNumber(revenueData.partiallyRefundedOrders),
    fullyRefundedOrders: fullyRefundedCount, //  Đơn hoàn toàn bộ (không tính vào doanh thu)
    totalRefundCount: toNumber(refundData.totalRefundCount),

    //  Chi phí & Lợi nhuận
    totalVAT, // VAT thu hộ (10% nếu có)
    netSales,
    totalCOGS,
    totalRefundCOGS,
    grossProfit: grossProfitStandard,
    operatingCost,
    netProfit,

    //  Tồn kho & Hao hụt
    stockValue,
    stockValueAtSalePrice,
    inventoryLoss,
    totalOutValue,

    //  Thống kê nhóm
    groupStats: formattedGroupStats,

    //  DEPRECATED
    stockAdjustmentValue: 0,
    stockDisposalCost: 0,
  };
};
// =====================================================================
const getFinancialSummary = async (req, res) => {
  try {
    const currentData = await calcFinancialSummary(req.query);

    // Tính thêm dữ liệu kỳ trước để so sánh nếu có
    const { periodType, periodKey, storeId } = req.query;
    const prevKey = getPreviousPeriodKey(periodType, periodKey);
    let comparison = null;

    if (prevKey) {
      try {
        const prevData = await calcFinancialSummary({
          storeId,
          periodType,
          periodKey: prevKey,
        });

        // Tính % thay đổi cho các chỉ số chính
        const calculateChange = (cur, prev) => {
          if (!prev || prev === 0) return cur > 0 ? 100 : 0;
          return Number((((cur - prev) / prev) * 100).toFixed(1));
        };

        comparison = {
          prevPeriodKey: prevKey,
          revenueChange: calculateChange(
            currentData.totalRevenue,
            prevData.totalRevenue
          ),
          grossProfitChange: calculateChange(
            currentData.grossProfit,
            prevData.grossProfit
          ),
          netProfitChange: calculateChange(
            currentData.netProfit,
            prevData.netProfit
          ),
          operatingCostChange: calculateChange(
            currentData.operatingCost,
            prevData.operatingCost
          ),
        };
      } catch (e) {
        console.warn("Lỗi tính so sánh kỳ trước:", e.message);
      }
    }

    res.json({
      message: "Báo cáo tài chính thành công",
      data: { ...currentData, comparison },
    });
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

    const rows = [
      { metric: "Tổng doanh thu thực", value: data.totalRevenue, unit: "VND" },
      { metric: "Tổng doanh thu cơ sở", value: data.grossRevenue, unit: "VND" },
      { metric: "Tiền hoàn trả", value: data.totalRefundAmount, unit: "VND" },
      {
        metric: "Giảm giá tích điểm",
        value: data.totalPointDiscount,
        unit: "VND",
      }, //  Thêm field mới
      { metric: "Lợi nhuận gộp", value: data.grossProfit, unit: "VND" },
      { metric: "Chi phí vận hành", value: data.operatingCost, unit: "VND" },
      { metric: "Lợi nhuận ròng", value: data.netProfit, unit: "VND" },
      { metric: "Giá trị tồn kho (vốn)", value: data.stockValue, unit: "VND" },
      { metric: "Số đơn hàng", value: data.totalOrders, unit: "Đơn" },
      {
        metric: "Đơn hoàn hoàn toàn",
        value: data.fullyRefundedOrders,
        unit: "Đơn",
      },
      {
        metric: "Thuế VAT thu hộ (đã trừ hoàn)",
        value: data.totalVAT,
        unit: "VND",
      },
    ];

    if (format === "csv") {
      const parser = new Parser({ fields: ["metric", "value", "unit"] });
      const csv = parser.parse(rows);
      res.header("Content-Type", "text/csv; charset=utf-8");
      res.attachment(`financial_report_${req.query.periodKey}.csv`);
      return res.send("\uFEFF" + csv); // Add BOM for Excel UTF-8
    }

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Báo cáo tài chính");

      // 1. Thông tin cửa hàng & Tiêu ngữ (Circular compliant header)
      worksheet.mergeCells("A1:C1");
      worksheet.getCell("A1").value = (
        req.store?.name || "Cửa hàng phụ tùng"
      ).toUpperCase();
      worksheet.getCell("A1").font = { bold: true, size: 11 };

      worksheet.mergeCells("E1:G1");
      worksheet.getCell("E1").value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
      worksheet.getCell("E1").alignment = { horizontal: "center" };
      worksheet.getCell("E1").font = { bold: true, size: 11 };

      worksheet.mergeCells("E2:G2");
      worksheet.getCell("E2").value = "Độc lập - Tự do - Hạnh phúc";
      worksheet.getCell("E2").alignment = { horizontal: "center" };
      worksheet.getCell("E2").font = { bold: true, size: 11, italic: true };

      // 2. Tên báo cáo
      worksheet.mergeCells("A4:G4");
      worksheet.getCell("A4").value = "BÁO CÁO TỔNG HỢP TÌNH HÌNH TÀI CHÍNH";
      worksheet.getCell("A4").alignment = { horizontal: "center" };
      worksheet.getCell("A4").font = { bold: true, size: 16 };

      worksheet.mergeCells("A5:G5");
      worksheet.getCell("A5").value = `Kỳ báo cáo: ${req.query.periodKey}`;
      worksheet.getCell("A5").alignment = { horizontal: "center" };
      worksheet.getCell("A5").font = { italic: true };

      // 3. Metadata (Người xuất, Ngày xuất)
      worksheet.getCell("A7").value = "Người xuất:";
      worksheet.getCell("B7").value = req.user?.fullname || "Hệ thống";
      worksheet.getCell("A8").value = "Ngày xuất:";
      worksheet.getCell("B8").value = new Date().toLocaleDateString("vi-VN");

      // 4. Data Table Header
      const headerRow = 10;
      worksheet.getRow(headerRow).values = [
        "STT",
        "Chỉ số tài chính",
        "Giá trị",
        "Đơn vị",
        "Ghi chú",
      ];
      worksheet.getRow(headerRow).font = { bold: true };
      worksheet.getRow(headerRow).alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      ["A", "B", "C", "D", "E"].forEach((col) => {
        worksheet.getCell(`${col}${headerRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
        worksheet.getCell(`${col}${headerRow}`).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // 5. Populate Data
      rows.forEach((row, idx) => {
        const r = worksheet.addRow([
          idx + 1,
          row.metric,
          row.value,
          row.unit,
          "",
        ]);
        r.getCell(1).alignment = { horizontal: "center" };
        r.getCell(3).numFmt = "#,##0";
        r.getCell(4).alignment = { horizontal: "center" };

        // Add borders to each cell in the row
        for (let i = 1; i <= 5; i++) {
          r.getCell(i).border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });

      // 6. Signatures (Bottom)
      const lastRow = headerRow + rows.length + 3;
      worksheet.getCell(`A${lastRow}`).value = "Người lập biểu";
      worksheet.getCell(`A${lastRow}`).font = { italic: true };
      worksheet.getCell(`A${lastRow}`).alignment = { horizontal: "center" };

      worksheet.getCell(`C${lastRow}`).value = "Kế toán trưởng";
      worksheet.getCell(`C${lastRow}`).font = { italic: true };
      worksheet.getCell(`C${lastRow}`).alignment = { horizontal: "center" };

      worksheet.getCell(`F${lastRow}`).value = "Chủ hộ kinh doanh";
      worksheet.getCell(`F${lastRow}`).font = { italic: true };
      worksheet.getCell(`F${lastRow}`).alignment = { horizontal: "center" };

      worksheet.getCell(`F${lastRow + 1}`).value = "(Ký, họ tên, đóng dấu)";
      worksheet.getCell(`F${lastRow + 1}`).font = { size: 9, italic: true };
      worksheet.getCell(`F${lastRow + 1}`).alignment = { horizontal: "center" };

      // 7. Column Widths
      worksheet.getColumn(1).width = 5;
      worksheet.getColumn(2).width = 35;
      worksheet.getColumn(3).width = 20;
      worksheet.getColumn(4).width = 10;
      worksheet.getColumn(5).width = 15;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=financial_report_${req.query.periodKey}.xlsx`
      );

      await workbook.xlsx.write(res);
      return res.end();
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=financial_report_${req.query.periodKey}.pdf`
      );

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      // Register fonts for Vietnamese support
      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      const regularFont = path.join(fontPath, "Roboto-Regular.ttf");
      const boldFont = path.join(fontPath, "Roboto-Bold.ttf");
      const italicFont = path.join(fontPath, "Roboto-Italic.ttf");

      doc.registerFont("Roboto-Regular", regularFont);
      doc.registerFont("Roboto-Bold", boldFont);
      doc.registerFont("Roboto-Italic", italicFont);

      // 1. Legal Header
      doc
        .font("Roboto-Bold")
        .fontSize(10)
        .text((req.store?.name || "Cửa hàng phụ tùng").toUpperCase(), {
          align: "left",
        });
      doc.moveUp();
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc
        .font("Roboto-Bold")
        .text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc
        .fontSize(9)
        .font("Roboto-Italic")
        .text("-----------------", { align: "right" });

      doc.moveDown(2);

      // 2. Title
      doc
        .font("Roboto-Bold")
        .fontSize(18)
        .text("BÁO CÁO TỔNG HỢP TÌNH HÌNH TÀI CHÍNH", { align: "center" });
      doc
        .font("Roboto-Italic")
        .fontSize(11)
        .text(`Kỳ báo cáo: ${req.query.periodKey}`, { align: "center" });

      doc.moveDown(2);

      // 3. User Info
      doc
        .font("Roboto-Regular")
        .fontSize(10)
        .text(`Người xuất báo cáo: ${req.user?.fullname || "Hệ thống"}`);
      doc.text(
        `Ngày xuất: ${new Date().toLocaleDateString(
          "vi-VN"
        )} ${new Date().toLocaleTimeString("vi-VN")}`
      );

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // 4. Data Rows
      rows.forEach((r, idx) => {
        const y = doc.y;
        doc.font("Roboto-Regular").text(`${idx + 1}. ${r.metric}:`, 50, y);
        doc
          .font("Roboto-Bold")
          .text(`${r.value.toLocaleString("vi-VN")} ${r.unit}`, 350, y, {
            align: "right",
          });
        doc.moveDown(0.5);
      });

      doc.moveDown(2);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(2);

      // 5. Signatures
      const startY = doc.y;
      doc
        .font("Roboto-Bold")
        .text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc
        .font("Roboto-Bold")
        .text("Kế toán trưởng", 220, startY, { width: 150, align: "center" });
      doc.font("Roboto-Bold").text("Chủ hộ kinh doanh", 390, startY, {
        width: 150,
        align: "center",
      });

      doc
        .font("Roboto-Italic")
        .fontSize(9)
        .text("(Ký, họ tên)", 50, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên)", 220, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên, đóng dấu)", 390, doc.y, {
        width: 150,
        align: "center",
      });

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
    const {
      periodType = "day",
      periodKey = new Date().toISOString().split("T")[0],
    } = req.query; // Default today

    // Lấy khoảng thời gian từ period.js
    const { start, end } = periodToRange(periodType, periodKey);

    // 1. Tổng doanh thu, đơn hàng, VAT, giảm giá, điểm tích lũy & tiền mặt
    const ordersAgg = await Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          status: { $in: ["paid", "partially_refunded", "refunded"] }, //  Bao gồm cả refunded để bù trừ hoàn trả
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
            $cond: [
              { $and: ["$usedPoints", "$loyalty.vndPerPoint"] },
              { $multiply: ["$usedPoints", "$loyalty.vndPerPoint"] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          totalVAT: { $sum: { $toDecimal: "$vatAmount" } },
          totalDiscount: { $sum: "$discountFromPoints" }, // tổng giảm giá tích điểm
          totalLoyaltyUsed: { $sum: "$usedPoints" }, // tổng điểm đã dùng
          totalLoyaltyEarned: { $sum: "$earnedPoints" }, // tổng điểm cộng thêm
          cashInDrawer: {
            $sum: {
              $cond: [
                { $eq: ["$paymentMethod", "cash"] },
                { $toDecimal: "$totalAmount" },
                0,
              ],
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
          status: { $in: ["paid", "partially_refunded", "refunded"] },
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
    // Doanh thu thực = totalAmount - refundedAmount
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
          // Tổng tiền thanh toán (đã trừ giảm giá)
          grossRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          // Tổng tiền đã hoàn
          refundAmount: {
            $sum: { $toDecimal: { $ifNull: ["$refundedAmount", "0"] } },
          },
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
              else: {
                $ifNull: [
                  { $arrayElemAt: ["$employee.fullName", 0] },
                  "Nhân viên đã xóa",
                ],
              },
            },
          },
          grossRevenue: 1,
          refundAmount: 1,
          // Doanh thu thực = Tổng thanh toán - Tổng hoàn trả
          revenue: { $subtract: ["$grossRevenue", "$refundAmount"] },
          orders: 1,
        },
      },
      {
        $addFields: {
          avgOrderValue: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$revenue", "$orders"] },
              0,
            ],
          },
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
          "order.status": { $in: ["paid", "partially_refunded", "refunded"] }, //  Bao gồm cả refunded
        },
      },
      {
        $group: {
          _id: "$productId",
          quantitySold: {
            $sum: {
              $subtract: ["$quantity", { $ifNull: ["$refundedQuantity", 0] }],
            },
          }, //  Trừ hoàn
          revenue: {
            $sum: {
              $multiply: [
                {
                  $subtract: [
                    "$quantity",
                    { $ifNull: ["$refundedQuantity", 0] },
                  ],
                },
                {
                  $add: [
                    { $toDecimal: "$priceAtTime" },
                    {
                      $divide: [
                        { $toDecimal: { $ifNull: ["$vat_amount", 0] } },
                        { $cond: [{ $gt: ["$quantity", 0] }, "$quantity", 1] },
                      ],
                    },
                  ],
                },
              ],
            },
          },
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
      { $unwind: "$order" },
      { $match: { "order.storeId": new mongoose.Types.ObjectId(storeId) } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          refundAmount: { $sum: { $toDecimal: "$refundAmount" } },
          totalRefundVAT: { $sum: { $toDecimal: "$refundVATAmount" } }, //  Thuế VAT hoàn
          // Tính riêng tiền hoàn tiền mặt
          cashRefundAmount: {
            $sum: {
              $cond: [
                { $eq: ["$order.paymentMethod", "cash"] },
                { $toDecimal: "$refundAmount" },
                0,
              ],
            },
          },
        },
      },
    ]);
    const refundSummary = refunds[0] || {
      totalRefunds: 0,
      refundAmount: 0,
      totalRefundVAT: 0,
      cashRefundAmount: 0,
    };

    //phân loại hoàn hàng theo nhân viên, ai tiếp khách để hoàn hàng
    const refundsByEmployee = await OrderRefund.aggregate([
      { $match: { refundedAt: { $gte: start, $lte: end } } },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
      { $match: { "order.storeId": new mongoose.Types.ObjectId(storeId) } },
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
          _id: 1,
          refundedBy: "$refundedBy",
          name: {
            $ifNull: [
              { $arrayElemAt: ["$employee.fullName", 0] },
              "$refundedByName",
              "Chủ cửa hàng (Admin)",
            ],
          },
          refundAmount: 1,
          refundedAt: 1,
          refundReason: 1,
        },
      },
    ]);

    // 6. Tồn kho cuối ngày
    const stockSnapshot = await Product.aggregate([
      {
        $match: {
          store_id: new mongoose.Types.ObjectId(storeId),
          isDeleted: { $ne: true },
        },
      },
      {
        $project: {
          productId: "$_id",
          name: "$name",
          sku: "$sku",
          stock: "$stock_quantity",
        },
      },
      { $sort: { stock: 1 } }, // Sắp xếp theo tồn kho thấp -> cao
      { $limit: 50 }, // Giới hạn 50 sản phẩm
    ]);

    const storeInfo = await Store.findById(storeId).select(
      "name address phone"
    );
    const objectStoreId = new mongoose.Types.ObjectId(storeId);

    const cogsAgg = await InventoryVoucher.aggregate([
      {
        $match: {
          store_id: objectStoreId,
          status: "POSTED",
          voucher_date: { $gte: start, $lte: end },
          $or: [
            { type: "OUT", ref_type: "ORDER" },
            { type: "IN", ref_type: "ORDER_REFUND" },
          ],
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalCOGS: {
            $sum: {
              $cond: [
                { $eq: ["$type", "OUT"] },
                {
                  $multiply: [
                    "$items.qty_actual",
                    { $toDecimal: "$items.unit_cost" },
                  ],
                },
                {
                  $multiply: [
                    "$items.qty_actual",
                    { $toDecimal: "$items.unit_cost" },
                    -1,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const totalCOGS = toNumber(cogsAgg[0]?.totalCOGS) || 0;

    //  TÍNH TOÁN ĐÚNG: Trừ giá trị hoàn
    const grossRevenue = toNumber(orderSummary.totalRevenue);
    const totalRefundAmount = toNumber(refundSummary.refundAmount);
    const cashRefundAmount = toNumber(refundSummary.cashRefundAmount);
    const grossCashInDrawer = toNumber(orderSummary.cashInDrawer);
    const orderVAT = toNumber(orderSummary.totalVAT);
    const totalRefundVAT = toNumber(refundSummary.totalRefundVAT);
    const totalDiscount = toNumber(orderSummary.totalDiscount);

    // Doanh thu thực = Doanh thu gộp - Tiền hoàn
    // totalAmount đã trừ discountLoyalty tại POS
    const netRevenue = Math.max(0, grossRevenue - totalRefundAmount);
    const netCashInDrawer = Math.max(0, grossCashInDrawer - cashRefundAmount);

    // ================================================================
    // DOANH THU THUẦN & LỢI NHUẬN GỘP (Chuẩn nghiệp vụ)
    // ================================================================
    // Thuế VAT thực tế = Thuế thu hộ - Thuế hoàn trả
    const adjustedVAT = Math.max(0, orderVAT - totalRefundVAT);
    // Doanh thu thuần (Net Sales) = Doanh thu thực - Thuế VAT thực tế
    const netSales = netRevenue - adjustedVAT;
    // Lợi nhuận gộp (Gross Profit) = Doanh thu thuần - Giá vốn hàng bán
    const grossProfit = netSales - totalCOGS;

    // Tổng hợp báo cáo
    const report = {
      date: format(end, "dd/MM/yyyy"),
      periodType,
      periodKey,
      periodStart: format(start, "dd/MM/yyyy HH:mm"),
      periodEnd: format(end, "dd/MM/yyyy HH:mm"),
      store: {
        _id: storeId,
        name: storeInfo?.name || "Không xác định",
        address: storeInfo?.address || "",
        phone: storeInfo?.phone || "",
      },
      summary: {
        //  Doanh thu
        grossRevenue: grossRevenue, // Tổng doanh thu trước hoàn
        totalRefundAmount: totalRefundAmount, // Tiền hoàn
        totalRevenue: netRevenue, // Doanh thu thực (đã trừ hoàn & discount)
        vatTotal: adjustedVAT, // Thuế VAT thực tế
        netSales: netSales, // Doanh thu thuần = Doanh thu thực - VAT
        totalDiscount: totalDiscount, // Giảm giá tích điểm

        //  Chi phí & Lợi nhuận
        totalCOGS: totalCOGS, // Giá vốn hàng bán
        grossProfit: grossProfit, // Lợi nhuận gộp = Doanh thu thuần - COGS

        //  Tiền mặt
        grossCashInDrawer: grossCashInDrawer, // Tiền mặt trước hoàn
        cashRefundAmount: cashRefundAmount, // Tiền mặt hoàn
        cashInDrawer: netCashInDrawer, // Tiền mặt thực (đã trừ hoàn)

        //  Thống kê khác
        totalOrders: toNumber(orderSummary.totalOrders),
        totalRefunds: toNumber(refundSummary.totalRefunds),
        totalDiscount: toNumber(orderSummary.totalDiscount),
        totalLoyaltyUsed: toNumber(orderSummary.totalLoyaltyUsed),
        totalLoyaltyEarned: toNumber(orderSummary.totalLoyaltyEarned),
      },
      byPayment: byPayment.map((p) => ({
        ...p,
        revenue: toNumber(p.revenue),
      })),
      byEmployee: byEmployee.map((e) => ({
        ...e,
        grossRevenue: toNumber(e.grossRevenue), // Tổng thanh toán
        refundAmount: toNumber(e.refundAmount), // Tổng hoàn trả
        revenue: toNumber(e.revenue), // Doanh thu thực = grossRevenue - refundAmount
        avgOrderValue: toNumber(e.avgOrderValue),
      })),
      byProduct: byProduct.map((p) => ({
        ...p,
        revenue: toNumber(p.revenue),
      })),
      stockSnapshot,
      refundsByEmployee: refundsByEmployee.map((r) => ({
        ...r,
        refundAmount: toNumber(r.refundAmount),
      })),
    };

    res.json({ message: "Báo cáo cuối ngày thành công", report });
  } catch (err) {
    console.error("Lỗi báo cáo cuối ngày:", err.message);
    res.status(500).json({ message: "Lỗi server khi tạo báo cáo cuối ngày" });
  }
};

// =====================================================================
// Export báo cáo cuối ngày ra Excel/PDF
// =====================================================================
const exportEndOfDayReport = async (req, res) => {
  try {
    const dayjs = require("dayjs");
    const { storeId } = req.params;
    const {
      periodType = "day",
      periodKey = new Date().toISOString().split("T")[0],
      format: exportFormat = "xlsx",
    } = req.query;

    // Lấy khoảng thời gian
    const { start, end } = periodToRange(periodType, periodKey);
    const objectStoreId = new mongoose.Types.ObjectId(storeId);

    // ===== Lấy dữ liệu (tái sử dụng logic từ generateEndOfDayReport) =====
    // 1. Tổng doanh thu
    const ordersAgg = await Order.aggregate([
      {
        $match: {
          storeId: objectStoreId,
          status: { $in: ["paid", "partially_refunded", "refunded"] },
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
          discountFromPoints: {
            $cond: [
              { $and: ["$usedPoints", "$loyalty.vndPerPoint"] },
              { $multiply: ["$usedPoints", "$loyalty.vndPerPoint"] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          totalVAT: { $sum: { $toDecimal: "$vatAmount" } },
          totalDiscount: { $sum: "$discountFromPoints" },
          totalLoyaltyUsed: { $sum: "$usedPoints" },
          totalLoyaltyEarned: { $sum: "$earnedPoints" },
          cashInDrawer: {
            $sum: {
              $cond: [
                { $eq: ["$paymentMethod", "cash"] },
                { $toDecimal: "$totalAmount" },
                0,
              ],
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
          storeId: objectStoreId,
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["paid", "partially_refunded", "refunded"] },
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
    // Doanh thu thực = totalAmount - refundedAmount
    const byEmployee = await Order.aggregate([
      {
        $match: {
          storeId: objectStoreId,
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["paid", "partially_refunded"] },
        },
      },
      {
        $group: {
          _id: "$employeeId",
          grossRevenue: { $sum: { $toDecimal: "$totalAmount" } },
          refundAmount: {
            $sum: { $toDecimal: { $ifNull: ["$refundedAmount", "0"] } },
          },
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
              else: {
                $ifNull: [
                  { $arrayElemAt: ["$employee.fullName", 0] },
                  "Nhân viên đã xóa",
                ],
              },
            },
          },
          grossRevenue: 1,
          refundAmount: 1,
          revenue: { $subtract: ["$grossRevenue", "$refundAmount"] },
          orders: 1,
        },
      },
      {
        $addFields: {
          avgOrderValue: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$revenue", "$orders"] },
              0,
            ],
          },
        },
      },
    ]);

    // 4. Hoàn trả
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
      { $unwind: "$order" },
      { $match: { "order.storeId": objectStoreId } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          refundAmount: { $sum: { $toDecimal: "$refundAmount" } },
          totalRefundVAT: { $sum: { $toDecimal: "$refundVATAmount" } }, //  Thuế VAT hoàn
          cashRefundAmount: {
            $sum: {
              $cond: [
                { $eq: ["$order.paymentMethod", "cash"] },
                { $toDecimal: "$refundAmount" },
                0,
              ],
            },
          },
        },
      },
    ]);
    const refundSummary = refunds[0] || {
      totalRefunds: 0,
      refundAmount: 0,
      totalRefundVAT: 0,
      cashRefundAmount: 0,
    };

    const cogsAgg = await InventoryVoucher.aggregate([
      {
        $match: {
          store_id: objectStoreId,
          status: "POSTED",
          voucher_date: { $gte: start, $lte: end },
          $or: [
            { type: "OUT", ref_type: "ORDER" },
            { type: "IN", ref_type: "ORDER_REFUND" },
          ],
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalCOGS: {
            $sum: {
              $cond: [
                { $eq: ["$type", "OUT"] },
                {
                  $multiply: [
                    "$items.qty_actual",
                    { $toDecimal: "$items.unit_cost" },
                  ],
                },
                {
                  $multiply: [
                    "$items.qty_actual",
                    { $toDecimal: "$items.unit_cost" },
                    -1,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);
    const totalCOGS = toNumber(cogsAgg[0]?.totalCOGS) || 0;

    // Tính toán
    const grossRevenue = toNumber(orderSummary.totalRevenue);
    const totalRefundAmount = toNumber(refundSummary.refundAmount);
    const cashRefundAmount = toNumber(refundSummary.cashRefundAmount);
    const grossCashInDrawer = toNumber(orderSummary.cashInDrawer);
    const orderVAT = toNumber(orderSummary.totalVAT);
    const totalRefundVAT = toNumber(refundSummary.totalRefundVAT);
    const totalDiscount = toNumber(orderSummary.totalDiscount);

    // Tính toán thực tế (totalAmount đã trừ discountLoyalty tại POS)
    const netRevenue = Math.max(0, grossRevenue - totalRefundAmount);
    const netCashInDrawer = Math.max(0, grossCashInDrawer - cashRefundAmount);
    const adjustedVAT = Math.max(0, orderVAT - totalRefundVAT);

    // ================================================================
    // DOANH THU THUẦN & LỢI NHUẬN GỘP (Chuẩn nghiệp vụ)
    // ================================================================
    const netSales = netRevenue - adjustedVAT;
    const grossProfit = netSales - totalCOGS;

    const storeInfo = await Store.findById(storeId).select(
      "name address phone"
    );
    const storeName = storeInfo?.name || "Cửa hàng";
    const storeAddress = storeInfo?.address || "";
    const exporterName = req.user?.fullname || req.user?.email || "Người dùng";

    // Các dòng dữ liệu chính - CHUẨN NGHIỆP VỤ TÀI CHÍNH
    const summaryRows = [
      {
        metric: "Tổng số đơn hàng",
        value: orderSummary.totalOrders,
        unit: "Đơn",
      },
      {
        metric: "Doanh thu gộp (trước hoàn & KM)",
        value: grossRevenue,
        unit: "VND",
      },
      { metric: "Tiền hoàn trả khách", value: totalRefundAmount, unit: "VND" },
      { metric: "Giảm giá tích điểm", value: totalDiscount, unit: "VND" },
      {
        metric: "Doanh thu thực (Net Revenue)",
        value: netRevenue,
        unit: "VND",
        highlight: true,
      },
      {
        metric: "Thuế VAT thu hộ (đã trừ hoàn)",
        value: adjustedVAT,
        unit: "VND",
      },
      {
        metric: "DOANH THU THUẦN (Net Sales)",
        value: netSales,
        unit: "VND",
        highlight: true,
      },
      { metric: "Giá vốn hàng bán (COGS)", value: totalCOGS, unit: "VND" },
      {
        metric: "LỢI NHUẬN GỘP (Gross Profit)",
        value: grossProfit,
        unit: "VND",
        highlight: true,
      },
      {
        metric: "Tiền mặt thu (trước hoàn)",
        value: grossCashInDrawer,
        unit: "VND",
      },
      { metric: "Tiền mặt hoàn trả", value: cashRefundAmount, unit: "VND" },
      {
        metric: "TIỀN MẶT THỰC (Đã trừ hoàn)",
        value: netCashInDrawer,
        unit: "VND",
        highlight: true,
      },
      {
        metric: "Số lần hoàn trả",
        value: toNumber(refundSummary.totalRefunds),
        unit: "Lượt",
      },
      {
        metric: "Điểm tích lũy sử dụng",
        value: toNumber(orderSummary.totalLoyaltyUsed),
        unit: "Điểm",
      },
      {
        metric: "Điểm tích lũy cộng thêm",
        value: toNumber(orderSummary.totalLoyaltyEarned),
        unit: "Điểm",
      },
    ];

    const periodLabel =
      periodType === "day"
        ? "Ngày"
        : periodType === "month"
        ? "Tháng"
        : periodType === "quarter"
        ? "Quý"
        : "Năm";
    const reportTitle = `BÁO CÁO KẾT QUẢ BÁN HÀNG ${periodLabel.toUpperCase()}: ${periodKey}`;
    const dateExport = dayjs().format("DD/MM/YYYY HH:mm");

    // ===== EXPORT EXCEL =====
    if (exportFormat === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Báo cáo cuối ngày");

      // Header legal
      ws.mergeCells("A1:C1");
      ws.getCell("A1").value = storeName.toUpperCase();
      ws.getCell("A1").font = { bold: true, size: 12 };
      if (storeAddress) {
        ws.mergeCells("A2:C2");
        ws.getCell("A2").value = storeAddress;
        ws.getCell("A2").font = { size: 10, italic: true };
      }

      ws.mergeCells("E1:G1");
      ws.getCell("E1").value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
      ws.getCell("E1").alignment = { horizontal: "center" };
      ws.getCell("E1").font = { bold: true, size: 11 };

      ws.mergeCells("E2:G2");
      ws.getCell("E2").value = "Độc lập - Tự do - Hạnh phúc";
      ws.getCell("E2").alignment = { horizontal: "center" };
      ws.getCell("E2").font = { bold: true, size: 10, italic: true };

      ws.mergeCells("E3:G3");
      ws.getCell("E3").value = "-----------------";
      ws.getCell("E3").alignment = { horizontal: "center" };

      // Title
      ws.mergeCells("A5:G5");
      ws.getCell("A5").value = reportTitle;
      ws.getCell("A5").alignment = { horizontal: "center" };
      ws.getCell("A5").font = {
        bold: true,
        size: 16,
        color: { argb: "FF1890FF" },
      };

      ws.getCell("A7").value = "Người xuất:";
      ws.getCell("B7").value = exporterName;
      ws.getCell("A8").value = "Ngày xuất:";
      ws.getCell("B8").value = dateExport;

      // Data table header
      const headerRow = 10;
      ws.getRow(headerRow).values = ["STT", "Chỉ số", "Giá trị", "Đơn vị"];
      ws.getRow(headerRow).font = { bold: true };
      ws.getRow(headerRow).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      ["A", "B", "C", "D"].forEach((col) => {
        ws.getCell(`${col}${headerRow}`).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1890FF" },
        };
        ws.getCell(`${col}${headerRow}`).font = {
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        ws.getCell(`${col}${headerRow}`).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Data rows
      summaryRows.forEach((row, idx) => {
        const r = ws.addRow([idx + 1, row.metric, row.value, row.unit]);
        r.getCell(1).alignment = { horizontal: "center" };
        r.getCell(3).numFmt = "#,##0";
        r.getCell(4).alignment = { horizontal: "center" };
        if (row.highlight) {
          r.font = { bold: true };
          r.getCell(2).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE6F7FF" },
          };
          r.getCell(3).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE6F7FF" },
          };
        }
        for (let i = 1; i <= 4; i++) {
          r.getCell(i).border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });

      // Sheet 2: Phân loại theo phương thức thanh toán
      const ws2 = workbook.addWorksheet("Theo phương thức TT");
      ws2.addRow(["Phương thức", "Doanh thu (VND)", "Số đơn"]);
      ws2.getRow(1).font = { bold: true };
      const paymentNames = { cash: "Tiền mặt", qr: "QR Code / Chuyển khoản" };
      byPayment.forEach((p) => {
        ws2.addRow([
          paymentNames[p._id] || p._id,
          toNumber(p.revenue),
          p.count,
        ]);
      });

      // Sheet 3: Phân loại theo nhân viên
      const ws3 = workbook.addWorksheet("Theo nhân viên");
      ws3.addRow(["Nhân viên", "Doanh thu (VND)", "Số đơn", "TB/đơn (VND)"]);
      ws3.getRow(1).font = { bold: true };
      byEmployee.forEach((e) => {
        ws3.addRow([
          e.name,
          toNumber(e.revenue),
          e.orders,
          Math.round(toNumber(e.avgOrderValue)),
        ]);
      });

      // Column widths
      ws.getColumn(1).width = 6;
      ws.getColumn(2).width = 40;
      ws.getColumn(3).width = 22;
      ws.getColumn(4).width = 12;

      // Signatures
      const lastRow = headerRow + summaryRows.length + 3;
      ws.getCell(`A${lastRow}`).value = "Người lập biểu";
      ws.getCell(`A${lastRow}`).font = { italic: true };
      ws.getCell(`A${lastRow}`).alignment = { horizontal: "center" };
      ws.getCell(`C${lastRow}`).value = "Kế toán trưởng";
      ws.getCell(`C${lastRow}`).font = { italic: true };
      ws.getCell(`C${lastRow}`).alignment = { horizontal: "center" };
      ws.getCell(`F${lastRow}`).value = "Chủ hộ kinh doanh";
      ws.getCell(`F${lastRow}`).font = { italic: true };
      ws.getCell(`F${lastRow}`).alignment = { horizontal: "center" };
      ws.getCell(`F${lastRow + 1}`).value = "(Ký, họ tên, đóng dấu)";
      ws.getCell(`F${lastRow + 1}`).font = { size: 9, italic: true };
      ws.getCell(`F${lastRow + 1}`).alignment = { horizontal: "center" };

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Bao_Cao_Cuoi_Ngay_${periodKey.replace(
          /[/:]/g,
          "-"
        )}.xlsx`
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // ===== EXPORT PDF =====
    if (exportFormat === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Bao_Cao_Cuoi_Ngay_${periodKey.replace(
          /[/:]/g,
          "-"
        )}.pdf`
      );

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.pipe(res);

      // Register fonts
      const fontPath = path.join(__dirname, "..", "fonts", "Roboto", "static");
      doc.registerFont(
        "Roboto-Regular",
        path.join(fontPath, "Roboto-Regular.ttf")
      );
      doc.registerFont("Roboto-Bold", path.join(fontPath, "Roboto-Bold.ttf"));
      doc.registerFont(
        "Roboto-Italic",
        path.join(fontPath, "Roboto-Italic.ttf")
      );

      // Header
      doc
        .font("Roboto-Bold")
        .fontSize(11)
        .text(storeName.toUpperCase(), { align: "left" });
      if (storeAddress)
        doc
          .font("Roboto-Italic")
          .fontSize(9)
          .text(storeAddress, { align: "left" });
      doc.moveUp(storeAddress ? 2 : 1);
      doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { align: "right" });
      doc
        .font("Roboto-Bold")
        .fontSize(10)
        .text("Độc lập - Tự do - Hạnh phúc", { align: "right" });
      doc
        .font("Roboto-Italic")
        .fontSize(9)
        .text("-----------------", { align: "right" });
      doc.moveDown(2);

      // Title
      doc
        .font("Roboto-Bold")
        .fontSize(16)
        .fillColor("#1890ff")
        .text(reportTitle, { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(1);

      // Info
      doc
        .font("Roboto-Regular")
        .fontSize(10)
        .text(`Người xuất: ${exporterName}`);
      doc.text(`Ngày xuất: ${dateExport}`);
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Summary
      doc.font("Roboto-Bold").fontSize(12).text("TỔNG HỢP KẾT QUẢ");
      doc.moveDown(0.5);
      summaryRows.forEach((r, idx) => {
        const isHighlight = r.highlight;
        doc.font(isHighlight ? "Roboto-Bold" : "Roboto-Regular").fontSize(10);
        doc.text(
          `${idx + 1}. ${r.metric}: ${r.value.toLocaleString("vi-VN")} ${
            r.unit
          }`
        );
      });

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      // Theo phương thức thanh toán
      if (byPayment.length > 0) {
        doc
          .font("Roboto-Bold")
          .fontSize(12)
          .text("THEO PHƯƠNG THỨC THANH TOÁN");
        doc.moveDown(0.5);
        const paymentNames = { cash: "Tiền mặt", qr: "QR Code / Chuyển khoản" };
        byPayment.forEach((p) => {
          doc
            .font("Roboto-Regular")
            .fontSize(10)
            .text(
              `• ${paymentNames[p._id] || p._id}: ${toNumber(
                p.revenue
              ).toLocaleString("vi-VN")} VND (${p.count} đơn)`
            );
        });
        doc.moveDown(1);
      }

      // Theo nhân viên
      if (byEmployee.length > 0) {
        doc.font("Roboto-Bold").fontSize(12).text("THEO NHÂN VIÊN");
        doc.moveDown(0.5);
        byEmployee.forEach((e) => {
          doc
            .font("Roboto-Regular")
            .fontSize(10)
            .text(
              `• ${e.name}: ${toNumber(e.revenue).toLocaleString(
                "vi-VN"
              )} VND (${e.orders} đơn)`
            );
        });
        doc.moveDown(1);
      }

      doc.moveDown(2);

      // Signatures
      const startY = doc.y > 680 ? (doc.addPage(), 50) : doc.y;
      doc
        .font("Roboto-Bold")
        .fontSize(10)
        .text("Người lập biểu", 50, startY, { width: 150, align: "center" });
      doc.text("Kế toán trưởng", 220, startY, { width: 150, align: "center" });
      doc.text("Chủ hộ kinh doanh", 390, startY, {
        width: 150,
        align: "center",
      });
      doc
        .font("Roboto-Italic")
        .fontSize(9)
        .text("(Ký, họ tên)", 50, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên)", 220, doc.y, { width: 150, align: "center" });
      doc.moveUp();
      doc.text("(Ký, họ tên, đóng dấu)", 390, doc.y, {
        width: 150,
        align: "center",
      });

      doc.end();
      return;
    }

    res
      .status(400)
      .json({ message: "Format không hỗ trợ. Vui lòng chọn xlsx hoặc pdf." });
  } catch (err) {
    console.error("Lỗi export báo cáo cuối ngày:", err.message);
    res.status(500).json({ message: "Lỗi server khi xuất báo cáo cuối ngày" });
  }
};

module.exports = {
  getFinancialSummary,
  exportFinancial,
  generateEndOfDayReport,
  exportEndOfDayReport,
};
