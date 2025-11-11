// routes/orders.js
const express = require("express");
const router = express.Router();
const uploadMedia = require("../middlewares/uploadMedia");

const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");

const {
  createOrder,
  printBill,
  setPaidCash,
  vietqrReturn,
  vietqrCancel,
  getTopSellingProducts,
  getTopFrequentCustomers,
  exportTopSellingProducts,
  getOrderById,
  refundOrder,
  getListPaidOrders,
  getListRefundOrders,
  getOrderRefundDetail,
  getOrderListAll,
  getOrderStats,
} = require("../controllers/order/orderController");

//API CHUNG: http://localhost:9999/api/orders

// Lấy toàn bộ danh sách đơn hàng (mọi trạng thái)
router.get("/list-all", verifyToken, checkStoreAccess, requirePermission("orders:view"), getOrderListAll);
// thống kê toàn bộ order đã bán trong năm, số đơn bị hoàn, số đơn chưa 'paid',
router.get("/stats", verifyToken, checkStoreAccess, requirePermission("orders:view"), getOrderStats);
// tạo đơn hàng mới với phương thức 'cash' hoặc 'qr'
router.post("/", verifyToken, checkStoreAccess, requirePermission("orders:create"), createOrder);
// đánh dấu là đã thanh toán cho đơn hàng 'cash' -> status 'pending' -> 'paid'
router.post("/:orderId/set-paid-cash", verifyToken, checkStoreAccess, requirePermission("orders:pay"), setPaidCash);
// in hoá đơn mới trừ stock thực trong kho, tránh việc không in hoá đơn
router.post("/:orderId/print-bill", verifyToken, checkStoreAccess, requirePermission("orders:print"), printBill);
//Callback khi khách thanh toán QR thành công (public)-Không require token vì gateway sẽ redirect/call bên ngoài
router.get("/payments/vietqr_return", vietqrReturn);

/*
  GET /api/orders/payments/vietqr_cancel
  - Callback khi khách huỷ thao tác thanh toán QR (public)
*/
router.get("/payments/vietqr_cancel", vietqrCancel);
// top khách hàng thân thiết
router.get("/top-customers", verifyToken, isManager, getTopFrequentCustomers);
//tạo đơn trả hàng, gửi kèm items
router.post(
  "/:orderId/refund",
  verifyToken,
  checkStoreAccess,
  requirePermission("orders:refund"),
  uploadMedia.array("files", 5),
  refundOrder
);
//top sản phẩm bán chạy, có dùng limit
router.get("/top-products", verifyToken, isManager, checkStoreAccess, getTopSellingProducts);
//xuất file
router.get("/top-products/export", verifyToken, isManager, exportTopSellingProducts);

//lấy danh sách mọi Order đã thanh toán thành công, có status là 'paid'
router.get("/list-paid", verifyToken, checkStoreAccess, requirePermission("orders:view"), getListPaidOrders);
// lấy danh sách các Order đã hoàn trả thành công, 2 status là 'refunded' và 'partially_refunded'
router.get("/list-refund", verifyToken, checkStoreAccess, requirePermission("orders:view"), getListRefundOrders);
//xem chi tiết 1 Order đã hoàn trả thành công
router.get(
  "/order-refund/:orderId",
  verifyToken,
  checkStoreAccess,
  requirePermission("orders:view"),
  getOrderRefundDetail
);
//xem chi tiết 1 order chung
router.get("/:orderId", verifyToken, checkStoreAccess, requirePermission("orders:view"), getOrderById);

module.exports = router;
