// backend/routers/storeRouters.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const {
  checkSubscriptionExpiry,
} = require("../middlewares/subscriptionMiddleware");
const storeController = require("../controllers/store/storeController");

const { verifyToken, checkStoreAccess, requirePermission } = auth;

/*
  ROUTES QUẢN LÝ CỬA HÀNG (Store Management)
  --------------------------------------------------
  Mục tiêu:
  - Áp dụng phân quyền dựa trên user.menu và vai trò (Manager / Staff).
  - Manager có thể tạo và quản lý cửa hàng mình sở hữu.
  - Staff chỉ được truy cập cửa hàng được phân quyền thông qua store_roles.
  - Các permission gợi ý cho user.menu:
      * store:create                -> tạo cửa hàng mới
      * store:view                  -> xem danh sách / chi tiết cửa hàng
      * store:update                -> chỉnh sửa thông tin cửa hàng
      * store:delete                -> xóa cửa hàng
      * store:dashboard:view        -> xem dashboard cửa hàng
      * store:staff:assign          -> gán nhân viên vào cửa hàng
      * store:employee:create       -> tạo nhân viên mới
      * store:employee:view         -> xem danh sách nhân viên
      * store:employee:update       -> cập nhật thông tin nhân viên
*/

//
// ===================== STORE ROUTES =====================
//

// Đảm bảo người dùng có store hiện hành (manager tự động vào store đầu tiên nếu có)
router.post(
  "/ensure-store",
  verifyToken,
  checkSubscriptionExpiry,
  requirePermission("store:dashboard:view"),
  storeController.ensureStore
);

// Tạo cửa hàng mới (chỉ Manager)
router.post(
  "/",
  verifyToken,
  checkSubscriptionExpiry,
  requirePermission("store:create"),
  storeController.createStore
);

// Lấy danh sách cửa hàng mà Manager sở hữu, Cho phép Manager xem danh sách cửa hàng ngay cả khi gói hết hạn
router.get(
  "/",
  verifyToken,
  requirePermission("store:view"),
  storeController.getStoresByManager
);

// Lấy chi tiết cửa hàng cụ thể
router.get(
  "/:storeId",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("store:view"),
  storeController.getStoreById
);

// Cập nhật thông tin cửa hàng
router.put(
  "/:storeId",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,

  requirePermission("store:update"),
  storeController.updateStore
);

// Xóa cửa hàng (soft delete)
router.delete(
  "/:storeId",
  verifyToken,
  checkSubscriptionExpiry,

  requirePermission("store:delete"),
  storeController.deleteStore
);

// Khôi phục cửa hàng (restore soft delete)
router.put(
  "/:storeId/restore",
  verifyToken,
  checkSubscriptionExpiry,

  requirePermission("store:update"),
  storeController.restoreStore
);

//
// ===================== DASHBOARD & SELECT STORE =====================
//

// Chọn store hiện hành
router.post(
  "/select/:storeId",
  verifyToken,
  // Cho phép chọn cửa hàng kể cả khi Manager hết hạn
  requirePermission("store:view"),
  storeController.selectStore
);

// Dashboard cửa hàng (Manager / Staff trong store)
router.get(
  "/:storeId/dashboard",
  verifyToken,
  checkSubscriptionExpiry,

  requirePermission("store:dashboard:view"),
  storeController.getStoreDashboard
);

//
// ===================== STAFF ASSIGNMENT =====================
//

// Gán nhân viên vào cửa hàng (Manager / Owner)
router.post(
  "/:storeId/assign-staff",
  verifyToken,
  checkSubscriptionExpiry,

  requirePermission("store:staff:assign"),
  storeController.assignStaffToStore
);

//
// ===================== EMPLOYEE MANAGEMENT =====================
//

// Tạo nhân viên mới trong cửa hàng
router.post(
  "/:storeId/employees",
  verifyToken,
  checkStoreAccess,
  checkSubscriptionExpiry,
  requirePermission("store:employee:create"),
  storeController.createEmployee
);

// Lấy danh sách nhân viên trong cửa hàng
router.get(
  "/:storeId/employees",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("store:employee:view"),
  storeController.getEmployeesByStore
);

// routers/storeRouters.js
router.get(
  "/:storeId/employees/export",
  verifyToken,
  checkSubscriptionExpiry,

  requirePermission("store:employee:view"),
  storeController.exportEmployeesToExcel
);

// Lấy chi tiết nhân viên theo ID
router.get(
  "/:storeId/employees/:id",
  verifyToken,
  checkSubscriptionExpiry,
  requirePermission("store:employee:view"),
  storeController.getEmployeeById
);

// Cập nhật thông tin nhân viên
router.put(
  "/:storeId/employees/:id",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("store:employee:update"),
  storeController.updateEmployee
);

// Xóa mềm nhân viên
router.delete(
  "/:storeId/employees/:id/soft",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("store:employee:softDelete"),
  storeController.softDeleteEmployee
);

// Khôi phục nhân viên bị xóa mềm
router.put(
  "/:storeId/employees/:id/restore",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  requirePermission("store:employee:restore"),
  storeController.restoreEmployee
);

module.exports = router;
