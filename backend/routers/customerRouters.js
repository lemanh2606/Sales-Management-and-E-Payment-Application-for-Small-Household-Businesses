// routes/customerRouters.js
const express = require("express");
const router = express.Router();

const {
  createCustomer,
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
  getCustomersByStore,
} = require("../controllers/customer/customerController");

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  Quy ước permission strings:
  - customers:create     -> tạo khách hàng
  - customers:search     -> tìm/tra cứu khách hàng
  - customers:update     -> sửa thông tin khách hàng
  - customers:delete     -> xóa (soft delete) khách hàng
  - Hỗ trợ wildcard: customers:*  hoặc store:<storeId>:customers:*
  - Manager mặc định được override (allow) trừ khi gọi requirePermission(..., { allowManager: false })
*/

/*
  Route: POST /api/customers
  - Mục đích: tạo khách hàng mới
  - Middleware:
    1) verifyToken - yêu cầu đăng nhập
    2) checkStoreAccess - xác định cửa hàng hiện tại (nếu cần)
    3) requirePermission("customers:create") - quyền tạo khách hàng
*/
router.post(
  "/",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:create"),
  createCustomer
);

/*
  Route: GET /api/customers/search
  - Mục đích: tìm kiếm khách hàng theo phone/name
  - Middleware:
    1) verifyToken
    2) checkStoreAccess
    3) requirePermission("customers:search")
*/
router.get(
  "/search",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:search"),
  searchCustomers
);

/*
  Route: PUT /api/customers/:id
  - Mục đích: cập nhật thông tin khách hàng
  - Middleware:
    1) verifyToken
    2) checkStoreAccess
    3) requirePermission("customers:update")
*/
router.put(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:update"),
  updateCustomer
);

/*
  Route: DELETE /api/customers/:id
  - Mục đích: xóa mềm khách hàng
  - Middleware:
    1) verifyToken
    2) checkStoreAccess
    3) requirePermission("customers:delete")
*/
router.delete(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:delete"),
  softDeleteCustomer
);

/*
  Route: GET /api/customers/store/:storeId
  - Mục đích: Lấy toàn bộ khách hàng của 1 cửa hàng
  - Middleware:
    1) verifyToken - yêu cầu đăng nhập
    2) checkStoreAccess - kiểm tra quyền truy cập store
    3) requirePermission("customers:search") - quyền xem danh sách khách hàng
*/
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:search"),
  getCustomersByStore
);

module.exports = router;
