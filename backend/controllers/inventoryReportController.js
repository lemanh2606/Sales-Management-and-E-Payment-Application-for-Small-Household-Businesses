// backend/controllers/inventoryReportController.js
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseReturn = require("../models/PurchaseReturn");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const InventoryVoucher = require("../models/InventoryVoucher");
const mongoose = require("mongoose");
const { periodToRange } = require("../utils/period");

// Helper: Convert Decimal128 to number
const toNumber = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v.toString) {
    try {
      return Number(v.toString());
    } catch {
      return 0;
    }
  }
  return Number(v) || 0;
};

// Báo cáo tồn kho: xem theo kỳ hoặc realtime
const getInventoryReport = async (req, res) => {
  try {
    const {
      storeId,
      periodType, // mới: day | month | quarter | year | custom
      periodKey, // mới: 2025-10 | 2025-Q3 | 2025 | ...
      monthFrom, // chỉ dùng khi periodType=custom
      monthTo, // chỉ dùng khi periodType=custom
    } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId!" });
    }

    // VALIDATE + PARSE KỲ DÙNG UTILS SIÊU XỊN
    let from = null;
    let to = null;

    if (periodType && periodKey) {
      try {
        const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo);
        from = start;
        to = end;
      } catch (err) {
        return res.status(400).json({
          message: "Kỳ không hợp lệ! Kiểm tra periodType và periodKey.",
          error: err.message,
        });
      }
    }
    // Nếu không có kỳ → realtime (chỉ lấy tồn hiện tại)

    // Lấy danh sách sản phẩm thuộc cửa hàng
    const products = await Product.find({ store_id: storeId, isDeleted: false })
      .select("name sku stock_quantity cost_price min_stock createdAt")
      .lean();

    let report = [];

    for (const [index, product] of products.entries()) {
      const productId = new mongoose.Types.ObjectId(product._id);

      let importedQty = 0;
      let exportedQty = 0;
      let returnedQty = 0;

      // CHỈ TÍNH TRONG KỲ NẾU CÓ FROM/TO
      if (from && to) {
        // ====== Lấy...
        const importData = await PurchaseOrder.aggregate([
          {
            $match: {
              store_id: new mongoose.Types.ObjectId(storeId),
              status: "completed",
              createdAt: { $gte: from, $lte: to },
              "products.product": productId,
            },
          },
          { $unwind: "$products" },
          { $match: { "products.product": productId } },
          {
            $group: {
              _id: null,
              totalImport: { $sum: "$products.quantity" },
            },
          },
        ]).allowDiskUse(true);
        importedQty = importData[0]?.totalImport || 0;

        // ====== Trả hàng NCC
        const returnData = await PurchaseReturn.aggregate([
          {
            $match: {
              store_id: new mongoose.Types.ObjectId(storeId),
              status: "completed",
              createdAt: { $gte: from, $lte: to },
              "products.product": productId,
            },
          },
          { $unwind: "$products" },
          { $match: { "products.product": productId } },
          {
            $group: {
              _id: null,
              totalReturn: { $sum: "$products.quantity" },
            },
          },
        ]);
        returnedQty = returnData[0]?.totalReturn || 0;

        // ====== Đã bán
        const soldData = await OrderItem.aggregate([
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
              "order.storeId": new mongoose.Types.ObjectId(storeId),
              "order.status": { $in: ["paid", "partially_refunded"] },
              "order.createdAt": { $gte: from, $lte: to },
              productId: productId,
            },
          },
          {
            $group: {
              _id: null,
              totalSold: { $sum: "$quantity" },
            },
          },
        ]);
        exportedQty = soldData[0]?.totalSold || 0;
      }

      // Tính tồn
      const closingStock = product.stock_quantity;
      const closingValue = closingStock * (product.cost_price || 0);

      // Tồn đầu kỳ (chỉ có khi chọn kỳ)
      // Tồn đầu kỳ = tồn cuối kỳ + xuất - nhập + trả (tạm tính, chưa có phiếu nhập kho lịch sử)
      // const openingStock = from ? closingStock + exportedQty + returnedQty - importedQty : null;
      const openingStock = from && to ? closingStock - importedQty + exportedQty - returnedQty : null;

      report.push({
        index: index + 1,
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        openingStock,
        importedQty,
        exportedQty,
        returnedQty,
        closingStock,
        costPrice: product.cost_price || 0,
        closingValue,
        lowStock: product.stock_quantity < (product.min_stock || 0),
        minStock: product.min_stock || 0,
      });
    }

    // Tổng hợp
    const totalValue = report.reduce((sum, item) => sum + item.closingValue, 0);
    const totalQty = report.reduce((sum, item) => sum + item.closingStock, 0);

    // Tính tổng giá vốn (chỉ cộng giá vốn của từng sản phẩm)
    const totalCostPrice = report.reduce((sum, item) => {
      const cost =
        typeof item.costPrice === "object" && item.costPrice.$numberDecimal ? parseFloat(item.costPrice.$numberDecimal) : Number(item.costPrice || 0);
      return sum + cost;
    }, 0);

    return res.status(200).json({
      success: true,
      message: "Lấy báo cáo tồn kho thành công!",
      data: {
        period: periodType && periodKey ? { periodType, periodKey, from, to } : null,
        summary: {
          totalProducts: report.length,
          totalStock: totalQty,
          totalValue,
          totalCostPrice,
        },
        details: report,
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy báo cáo tồn kho:", error);
    return res.status(500).json({
      success: false,
      message: "Có lỗi khi lấy báo cáo tồn kho!",
      error: error.message,
    });
  }
};

/**
 * Báo cáo tồn kho với biến thiên theo kỳ
 * Tồn đầu kỳ = tổng SL tồn trước ngày bắt đầu kỳ báo cáo
 * Nhập trong kỳ = tổng SL nhập (IN) trong kỳ (từ InventoryVoucher type="IN" status="POSTED")
 * Xuất trong kỳ = tổng SL xuất (OUT) trong kỳ (từ InventoryVoucher type="OUT" status="POSTED")
 * Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ – Xuất trong kỳ
 */
const getInventoryVarianceReport = async (req, res) => {
  try {
    const { storeId, periodType, periodKey, monthFrom, monthTo } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "Thiếu storeId" });
    }

    const storeObjectId = new mongoose.Types.ObjectId(storeId);

    // Parse period using periodToRange utility
    let from = new Date(new Date().getFullYear(), 0, 1); // Default: start of year
    let to = new Date(); // Default: today

    if (periodType && periodKey) {
      try {
        const { start, end } = periodToRange(periodType, periodKey, monthFrom, monthTo);
        from = start;
        to = end;
      } catch (err) {
        return res.status(400).json({
          message: "Kỳ không hợp lệ! Kiểm tra periodType và periodKey.",
          error: err.message,
        });
      }
    }

    // Lấy danh sách sản phẩm thuộc cửa hàng
    const products = await Product.find({
      store_id: storeObjectId,
      isDeleted: false,
    })
      .select("_id name sku unit stock_quantity cost_price min_stock")
      .lean();

    if (!products.length) {
      return res.status(200).json({
        success: true,
        message: "Không có sản phẩm",
        data: {
          reportPeriod: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
          summary: {
            totalProducts: 0,
            totalBeginningStock: 0,
            totalImportQty: 0,
            totalExportQty: 0,
            totalEndingStock: 0,
            totalCOGS: 0,
          },
          details: [],
        },
      });
    }

    // Tính toán cho mỗi sản phẩm
    const reportDetails = [];
    let totalBeginningStock = 0;
    let totalImportQty = 0;
    let totalExportQty = 0;
    let totalEndingStock = 0;
    let totalCOGS = 0;

    for (const product of products) {
      const productId = product._id;
      const costPrice = toNumber(product.cost_price);

      // 1. Tồn đầu kỳ = tổng SL tồn trước ngày bắt đầu kỳ báo cáo
      // Lấy tất cả phiếu IN (nhập) POSTED trước fromDate
      const beginningImportAgg = await InventoryVoucher.aggregate([
        {
          $match: {
            store_id: storeObjectId,
            type: "IN",
            status: "POSTED",
            voucher_date: { $lt: from },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.product_id": productId,
          },
        },
        {
          $group: {
            _id: null,
            totalImport: { $sum: "$items.qty_actual" },
          },
        },
      ]);

      const beginningImportQty = beginningImportAgg[0]?.totalImport || 0;

      // Lấy tất cả phiếu OUT (xuất) POSTED trước fromDate
      const beginningExportAgg = await InventoryVoucher.aggregate([
        {
          $match: {
            store_id: storeObjectId,
            type: "OUT",
            status: "POSTED",
            voucher_date: { $lt: from },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.product_id": productId,
          },
        },
        {
          $group: {
            _id: null,
            totalExport: { $sum: "$items.qty_actual" },
          },
        },
      ]);

      const beginningExportQty = beginningExportAgg[0]?.totalExport || 0;
      const beginningStock = beginningImportQty - beginningExportQty;

      // 2. Nhập trong kỳ = tổng SL nhập (IN) trong kỳ
      const periodImportAgg = await InventoryVoucher.aggregate([
        {
          $match: {
            store_id: storeObjectId,
            type: "IN",
            status: "POSTED",
            voucher_date: { $gte: from, $lte: to },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.product_id": productId,
          },
        },
        {
          $group: {
            _id: null,
            totalImport: { $sum: "$items.qty_actual" },
          },
        },
      ]);

      const importQty = periodImportAgg[0]?.totalImport || 0;

      // 3. Xuất trong kỳ = tổng SL xuất (OUT) trong kỳ
      const periodExportAgg = await InventoryVoucher.aggregate([
        {
          $match: {
            store_id: storeObjectId,
            type: "OUT",
            status: "POSTED",
            voucher_date: { $gte: from, $lte: to },
          },
        },
        { $unwind: "$items" },
        {
          $match: {
            "items.product_id": productId,
          },
        },
        {
          $group: {
            _id: null,
            totalExport: { $sum: "$items.qty_actual" },
          },
        },
      ]);

      const exportQty = periodExportAgg[0]?.totalExport || 0;

      // 4. Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ – Xuất trong kỳ
      const endingStock = beginningStock + importQty - exportQty;

      // Tính COGS (Cost of Good Sold) = Xuất trong kỳ * Cost Price
      const periodCOGS = exportQty * costPrice;

      reportDetails.push({
        productId: productId.toString(),
        productName: product.name || "N/A",
        sku: product.sku || "N/A",
        unit: product.unit || "Cái",
        minStock: product.min_stock || 0,
        costPrice,
        beginningStock,
        importQty,
        exportQty,
        endingStock,
        periodCOGS,
        // Giá trị tồn
        beginningValue: beginningStock * costPrice,
        endingValue: endingStock * costPrice,
      });

      totalBeginningStock += beginningStock;
      totalImportQty += importQty;
      totalExportQty += exportQty;
      totalEndingStock += endingStock;
      totalCOGS += periodCOGS;
    }

    // Sắp xếp theo tên sản phẩm
    reportDetails.sort((a, b) => a.productName.localeCompare(b.productName));

    return res.status(200).json({
      success: true,
      message: "Báo cáo tồn kho với biến thiên",
      data: {
        reportPeriod: {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        },
        summary: {
          totalProducts: products.length,
          totalBeginningStock,
          totalImportQty,
          totalExportQty,
          totalEndingStock,
          totalCOGS, // Tổng COGS trong kỳ
        },
        details: reportDetails,
      },
    });
  } catch (error) {
    console.error("Error getInventoryVarianceReport:", error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

module.exports = {
  getInventoryReport, //báo cáo tồn kho thường
  getInventoryVarianceReport, //cáo cáo tồn kho biến thiên
};
