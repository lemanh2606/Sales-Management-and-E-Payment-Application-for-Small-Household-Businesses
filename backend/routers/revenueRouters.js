// routes/revenueRouters.js
const express = require("express");
const router = express.Router();

const {
  getRevenueByPeriod,
  getRevenueByEmployee,
  exportRevenue,
} = require("../controllers/revenueController");

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
  isManager,
} = require("../middlewares/authMiddleware");

/*
  routes/revenueRouters.js

  Mục đích:
  - Cung cấp các endpoint báo cáo doanh thu theo cửa hàng.
  - Tất cả routes yêu cầu user đã đăng nhập và nằm trong context cửa hàng (checkStoreAccess).
  - Quy ước permission đề xuất (để lưu trong user.menu):
      * reports:revenue:view            -> xem báo cáo doanh thu (period)
      * reports:revenue:employee        -> xem báo cáo theo nhân viên
      * reports:revenue:export          -> xuất báo cáo (CSV/PDF)
    Ngoài ra bạn có thể dùng scoped permission theo store: "store:<storeId>:reports:revenue:export",...
  - Quyết định quyền: mặc định dùng requirePermission(...) để granular; nếu bạn muốn giới hạn
    nghiệm ngặt cho Manager thì có thể thêm isManager vào chuỗi middleware.
*/

/*
  GET /api/revenue
  - Lấy tổng doanh thu theo period (query params ví dụ from, to, period=day|week|month)
  - Middleware:
      1) verifyToken - xác thực người dùng
      2) checkStoreAccess - xác định cửa hàng hiện hành (gán req.store, req.storeRole)
      3) requirePermission("reports:revenue:view") - kiểm tra permission granular
  - Nếu bạn muốn cho phép tất cả nhân viên đã được gán store xem báo cáo cơ bản, có thể thay bằng
    middleware custom cho phép req.storeRole === "STAFF" || "OWNER" mà không cần permission.
*/
router.get(
  "/",
  verifyToken,
  checkStoreAccess,
  requirePermission("reports:revenue:view"),
  getRevenueByPeriod
);

/*
  GET /api/revenue/employee
  - Lấy doanh thu phân theo nhân viên (ví dụ top sales, hoặc doanh số theo từng nhân viên trong period)
  - Middleware:
      verifyToken -> checkStoreAccess -> requirePermission("reports:revenue:employee")
  - Nếu bạn muốn chỉ Manager mới xem được báo cáo theo nhân viên, thay requirePermission bằng isManager.
*/
router.get(
  "/employee",
  verifyToken,
  checkStoreAccess,
  requirePermission("reports:revenue:employee"),
  getRevenueByEmployee
);

/*
  GET /api/revenue/export
  - Export báo cáo ra CSV/PDF (có thể dùng query để chọn format, from/to,...)
  - Vì export là thao tác nhạy cảm (dữ liệu rời khỏi hệ thống), khuyến nghị:
      * Sử dụng requirePermission("reports:revenue:export")
      * Hoặc kết hợp thêm isManager nếu bạn chỉ muốn Manager/Owner xuất báo cáo
  - Middleware hiện tại dùng requirePermission; đổi nếu cần giới hạn mạnh hơn.
*/
router.get(
  "/export",
  verifyToken,
  checkStoreAccess,
  requirePermission("reports:revenue:export"),
  exportRevenue
);

module.exports = router;
