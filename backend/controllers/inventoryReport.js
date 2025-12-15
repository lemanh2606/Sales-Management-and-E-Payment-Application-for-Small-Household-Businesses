// backend/controllers/invertoryReport.js
import Product from "../models/Product.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseReturn from "../models/PurchaseReturn.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import mongoose from "mongoose";
import { periodToRange } from "../utils/period.js";

// Báo cáo tồn kho: xem theo kỳ hoặc realtime
export const getInventoryReport = async (req, res) => {
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
