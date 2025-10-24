// routes/customerRouters.js
const express = require("express");
const router = express.Router();

const {
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
} = require("../controllers/customer/customerController");

const {
  verifyToken,
  checkStoreAccess,
  requirePermission,
} = require("../middlewares/authMiddleware");

/*
  Quy ước permission strings:
  - customers:search     -> tìm/tra cứu khách hàng
  - customers:update     -> sửa thông tin khách hàng
  - customers:delete     -> xóa (soft delete) khách hàng
  - Hỗ trợ wildcard: customers:*  hoặc store:<storeId>:customers:*
  - Manager mặc định được override (allow) trừ khi gọi requirePermission(..., { allowManager: false })
*/

/*
  Route: GET /api/customers/search
  - Mục đích: tìm kiếm khách theo phone/name/...
  - Middleware:
    1) verifyToken - phải đăng nhập
    2) checkStoreAccess - xác định store (nếu request gửi storeId hoặc dùng current_store)
       -> checkStoreAccess sẽ gán req.store để middleware permission có thể dùng (nếu cần)
    3) requirePermission("customers:search") - kiểm tra user.menu (hỗ trợ cả scoped store:<id>:customers:search)
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
    2) checkStoreAccess - bắt buộc để biết store hiện hành (vì update thường liên quan store)
    3) requirePermission("customers:update") - có thể là global hoặc scoped (store:<id>:customers:update)
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
    2) checkStoreAccess - xác định store context
    3) requirePermission("customers:delete") - kiểm tra quyền xóa
*/
router.delete(
  "/:id",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:delete"),
  softDeleteCustomer
);

module.exports = router;
