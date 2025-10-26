// backend/routers/storeRouters.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const storeController = require("../controllers/store/storeController");

const { verifyToken, isManager, checkStoreAccess, requirePermission } = auth;

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
  requirePermission("store:dashboard:view"),
  storeController.ensureStore
);

// Tạo cửa hàng mới (chỉ Manager)
router.post(
  "/",
  verifyToken,
  requirePermission("store:create"),
  isManager,
  storeController.createStore
);

// Lấy danh sách cửa hàng mà Manager sở hữu
router.get(
  "/",
  verifyToken,
  requirePermission("store:view"),
  isManager,
  storeController.getStoresByManager
);

// Lấy chi tiết cửa hàng cụ thể
router.get(
  "/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("store:view"),
  storeController.getStoreById
);

// Cập nhật thông tin cửa hàng
router.put(
  "/:storeId",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("store:update"),
  storeController.updateStore
);

// Xóa cửa hàng (soft delete)
router.delete(
  "/:storeId",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("store:delete"),
  storeController.deleteStore
);

//
// ===================== DASHBOARD & SELECT STORE =====================
//

// Chọn store hiện hành
router.post(
  "/select/:storeId",
  verifyToken,
  requirePermission("store:view"),
  storeController.selectStore
);

// Dashboard cửa hàng (Manager / Staff trong store)
router.get(
  "/:storeId/dashboard",
  verifyToken,
  checkStoreAccess,
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
  checkStoreAccess,
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
  isManager,
  requirePermission("store:employee:create"),
  storeController.createEmployee
);

// Lấy danh sách nhân viên trong cửa hàng
router.get(
  "/:storeId/employees",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("store:employee:view"),
  storeController.getEmployeesByStore
);

// Lấy chi tiết nhân viên theo ID
router.get(
  "/:storeId/employees/:id",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("store:employee:view"),
  storeController.getEmployeeById
);

// Cập nhật thông tin nhân viên
router.put(
  "/:storeId/employees/:id",
  verifyToken,
  checkStoreAccess,
  isManager,
  requirePermission("store:employee:update"),
  storeController.updateEmployee
);

// router.delete("/:storeId/employees/:id", verifyToken, checkStoreAccess, isManager, requirePermission("store:employee:delete"), storeController.deleteEmployee);

module.exports = router;
