// routes/orders.js
const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");

const { verifyToken, isManager, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");

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

/*
  GHI CHÚ CHUNG VỀ PHÂN QUYỀN CHO ROUTES ORDER:
  - Các route liên quan thao tác theo cửa hàng (tạo hóa đơn, in bill, set-paid, refund, xem hoá đơn)
    yêu cầu:
      1) verifyToken  -> user phải đăng nhập
      2) checkStoreAccess -> xác định store context (req.store, req.storeRole)
      3) requirePermission(...) -> kiểm tra user.menu hoặc các quyền scoped theo store
  - Các callback payment từ bên thứ 3 (vietqr_return, vietqr_cancel) để public (không require token)
    vì bên thu ngân/QR redirect sẽ gọi từ ngoài; nếu bạn muốn bảo vệ, có thể thêm secret token query.
  - Các endpoint thống kê/top thường là chỉ Manager (ở đây giữ isManager theo cũ).
  - Quy ước permission string gợi ý:
      - orders:create
      - orders:pay
      - orders:print
      - orders:view
      - orders:refund
      - reports:top-products (hoặc giữ isManager)
      - reports:top-customers (hoặc giữ isManager)
  - Lưu ý: rule của bạn "get by ID phải để cuối cùng" được tôn trọng ở cuối file.
*/

/*
  POST /api/orders
  - Tạo hoá đơn (cash/QR)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("orders:create")
  - Nếu bạn muốn cho phép tạo hoá đơn không login, bỏ verifyToken/checkStoreAccess/requirePermission
*/
router.post("/", verifyToken, checkStoreAccess, requirePermission("orders:create"), createOrder);

/*
  POST /api/orders/:orderId/set-paid-cash
  - Xác nhận thanh toán bằng tiền mặt (manual)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("orders:pay")
  - Controller sẽ set paid, cập nhật trạng thái, ghi log giao dịch
*/
router.post("/:orderId/set-paid-cash", verifyToken, checkStoreAccess, requirePermission("orders:pay"), setPaidCash);

/*
  POST /api/orders/:orderId/print-bill
  - In hoá đơn (và có thể trừ tồn kho)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("orders:print")
  - Nếu bạn muốn cho phép in bill cho cả MANAGER và STAFF có quyền, cấp tương ứng trong user.menu
*/
router.post("/:orderId/print-bill", verifyToken, checkStoreAccess, requirePermission("orders:print"), printBill);

/*
  GET /api/orders/payments/vietqr_return
  - Callback khi khách thanh toán QR thành công (public)
  - Không require token vì gateway sẽ redirect/call bên ngoài
  - Nếu gateway gửi signature bạn có thể verify ở controller để đảm bảo tính xác thực
*/
router.get("/payments/vietqr_return", vietqrReturn);

/*
  GET /api/orders/payments/vietqr_cancel
  - Callback khi khách huỷ thao tác thanh toán QR (public)
*/
router.get("/payments/vietqr_cancel", vietqrCancel);

/*
  GET /api/orders/top-customers
  - Top khách hàng thường xuyên (chỉ Manager theo logic cũ)
  - Middleware hiện tại: verifyToken, isManager
  - Nếu muốn granular permission, thay isManager bằng requirePermission("reports:top-customers")
*/
router.get("/top-customers", verifyToken, isManager, getTopFrequentCustomers);

/*
  POST /api/orders/:orderId/refund
  - Hoàn tiền / refund order (có thể upload file chứng từ)
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("orders:refund")
  - upload.array("files",5) dùng cho file chứng từ refund
*/
router.post(
  "/:orderId/refund",
  verifyToken,
  checkStoreAccess,
  requirePermission("orders:refund"),
  upload.array("files", 5),
  refundOrder
);

router.get("/top-products", verifyToken, isManager, checkStoreAccess, getTopSellingProducts);

router.get("/top-products/export", verifyToken, isManager, exportTopSellingProducts);

/*
  GET /api/orders/:orderId
  - Lấy thông tin hoá đơn theo id
  - Middleware: verifyToken -> checkStoreAccess -> requirePermission("orders:view")
  - Đặt cuối cùng theo quy tắc của bạn (routes 'by ID' nên ở cuối)
*/
router.get("/:orderId", verifyToken, checkStoreAccess, requirePermission("orders:view"), getOrderById);

module.exports = router;
