// routes/orders.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const { createOrder, confirmQRPayment, printBill, setPaidCash } = require("../controllers/orderController");

router.post("/", createOrder); // POST /api/orders - Tạo hóa đơn (cash/QR)
// router.post("/:orderId/confirm-qr", confirmQRPayment);
router.post("/:orderId/set-paid-cash", setPaidCash); // xác nhận 'cash' và set 'paid' (giao dịch tay xong)
router.post("/:orderId/print-bill", printBill); //In bill và trừ stock (cho cả cash/QR sau 'paid')
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId })
      .populate("storeId", "name")
      .populate("employeeId", "fullName")
      .lean();

    if (!order) {
      console.log("Không tìm thấy hóa đơn:", orderId);
      return res.status(404).json({ message: "Hóa đơn không tồn tại" });
    }

    const items = await OrderItem.find({ orderId: order._id }).populate("productId", "name sku price").lean();
    
    const enrichedOrder = {
      ...order,
      items: items.map((item) => ({
        ...item,
        productName: item.productId?.name || "N/A",
        productSku: item.productId?.sku || "N/A",
      })),
    };
    console.log("Lấy chi tiết hóa đơn thành công:", orderId);
    res.json({ message: "Lấy hóa đơn thành công", order: enrichedOrder });
  } catch (err) {
    console.error("Lỗi lấy hóa đơn:", err.message);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
