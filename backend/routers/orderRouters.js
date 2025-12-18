// routes/orders.js
const express = require("express");
const router = express.Router();
const uploadMedia = require("../middlewares/uploadMedia");
const uploadInvoice = require("../middlewares/uploadInvoice");

const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const { checkSubscriptionExpiry } = require("../middlewares/subscriptionMiddleware");

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
  exportTopFrequentCustomers,
  exportAllOrdersToExcel,
  deletePendingOrder,
} = require("../controllers/order/orderController");
const { getPaidNotPrintedOrders, verifyInvoicePdf, verifyInvoicePdfAuto } = require("../controllers/order/orderReconciliationController");

//API CHUNG: http://localhost:9999/api/orders

// Lấy toàn bộ danh sách đơn hàng (mọi trạng thái)
router.get("/list-all", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getOrderListAll);
router.get("/export-all", verifyToken, checkStoreAccess, requirePermission("orders:view"), exportAllOrdersToExcel);
// thống kê toàn bộ order đã bán trong năm, số đơn bị hoàn, số đơn chưa 'paid',
router.get("/stats", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getOrderStats);
// tạo đơn hàng mới với phương thức 'cash' hoặc 'qr'
router.post("/", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:create"), createOrder);
// đánh dấu là đã thanh toán cho đơn hàng 'cash' -> status 'pending' -> 'paid'
router.post("/:orderId/set-paid-cash", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:pay"), setPaidCash);
// in hoá đơn mới trừ stock thực trong kho, tránh việc không in hoá đơn
router.post("/:orderId/print-bill", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:print"), printBill);
//Callback khi khách thanh toán QR thành công (public)-Không require token vì gateway sẽ redirect/call bên ngoài
router.get("/payments/vietqr_return", vietqrReturn);

/*
  GET /api/orders/payments/vietqr_cancel
  - Callback khi khách huỷ thao tác thanh toán QR (public)
*/
router.get("/payments/vietqr_cancel", vietqrCancel);
// top khách hàng thân thiết
router.get("/top-customers", verifyToken, getTopFrequentCustomers);
//tạo đơn trả hàng, gửi kèm items
router.post(
  "/:orderId/refund",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("orders:refund"),
  uploadMedia.array("files", 5),
  refundOrder
);
router.get(
  "/reconciliation/paid-not-printed",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("orders:view"),
  getPaidNotPrintedOrders
);
router.post(
  "/:orderId/reconciliation/verify-invoice",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("orders:view"),
  uploadInvoice.single("invoice"),
  verifyInvoicePdf
);
router.post(
  "/reconciliation/verify-invoice/auto",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("orders:view"),
  uploadInvoice.single("invoice"),
  verifyInvoicePdfAuto
);
//top sản phẩm bán chạy, có dùng limit
router.get("/top-products", verifyToken, checkSubscriptionExpiry,  checkStoreAccess, getTopSellingProducts);
//xuất file
router.get("/top-products/export", verifyToken, checkSubscriptionExpiry, exportTopSellingProducts);
//xuất file top khách hàng thân thiết
router.get("/top-customers/export", verifyToken, checkStoreAccess, exportTopFrequentCustomers);
//lấy danh sách mọi Order đã thanh toán thành công, có status là 'paid'
router.get("/list-paid", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getListPaidOrders);
// lấy danh sách các Order đã hoàn trả thành công, 2 status là 'refunded' và 'partially_refunded'
router.get("/list-refund", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getListRefundOrders);
//xem chi tiết 1 Order đã hoàn trả thành công
router.get("/order-refund/:orderId", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getOrderRefundDetail);
// xoá đơn hàng đang ở trạng thái 'pending'
router.delete("/delete-pending/:id", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), deletePendingOrder);
//xem chi tiết 1 order chung
router.get("/:orderId", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("orders:view"), getOrderById);

module.exports = router;
