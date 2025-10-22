// routes/customerRouters.js (mới: routes search/update/soft delete khách hàng, middleware verifyToken - paste full file)
const express = require("express");
const router = express.Router();
const {
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
} = require("../controllers/customer/customerController");
const { verifyToken } = require("../middlewares/authMiddleware"); // Middleware xác thực

// Áp dụng verifyToken cho tất cả routes (chỉ logged in user access)
router.get("/search", verifyToken, searchCustomers); // GET /api/customers/search - Tìm kiếm theo phone/name
router.put("/:id", verifyToken, updateCustomer); // PUT /api/customers/:id - Chỉnh sửa thông tin
router.delete("/:id", verifyToken, softDeleteCustomer); // DELETE /api/customers/:id - Xóa mềm

module.exports = router;
