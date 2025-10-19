// routes/orders.js
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const { verifyToken, isManager } = require("../middlewares/authMiddleware");
const {
  createOrder,
  printBill,
  setPaidCash,
  vietqrReturn,
  vietqrCancel,
  getOrderById,
  refundOrder,
  getTopSellingProducts,
  getTopFrequentCustomers,
  exportTopSellingProducts,
} = require("../controllers/order/orderController");

// RULE: cứ là 'get' cái gì 'by ID' thì phải để cuối cùng

router.post("/", createOrder); // POST /api/orders - Tạo hóa đơn (cash/QR)
router.post("/:orderId/set-paid-cash", setPaidCash); // xác nhận 'cash' và set 'paid' (giao dịch tay xong)
router.post("/:orderId/print-bill", printBill); //In bill và trừ stock (cho cả cash/QR sau 'paid')
router.get("/payments/vietqr_return", vietqrReturn); // callback khi QR đã được quét và thanh toán thành công
router.get("/payments/vietqr_cancel", vietqrCancel); // callback khi khách hủy thanh toán QR
router.get("/top-customers", verifyToken, isManager, getTopFrequentCustomers); //Top khách hàng thường xuyên (chỉ manager)
router.post("/:orderId/refund", upload.array("files", 5), refundOrder);
router.get("/top-products", verifyToken, isManager, getTopSellingProducts); // GET /api/orders/top-products - Top sản phẩm bán chạy (chỉ manager)
router.get(
  "/top-products/export",
  verifyToken,
  isManager,
  exportTopSellingProducts
); //Export top sản phẩm bán chạy ra CSV
router.get("/:orderId", getOrderById);

module.exports = router;
