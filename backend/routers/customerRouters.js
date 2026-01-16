// routes/customerRouters.js
const express = require("express");
const router = express.Router();
const {
  createCustomer,
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
  getCustomersByStore,
  importCustomers,
  downloadCustomerTemplate,
  exportCustomers,
} = require("../controllers/customer/customerController");
const { verifyToken, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const { checkSubscriptionExpiry } = require("../middlewares/subscriptionMiddleware");
const upload = require("../middlewares/upload");

/*
  Route: GET /api/customers/template/download
  - Tải template import Excel/CSV
*/
router.get("/template/download", verifyToken, downloadCustomerTemplate);
/*
  Route: POST /api/customers/store/:storeId/import
  - Import khách hàng từ Excel/CSV
*/
router.post(
  "/store/:storeId/import",
  verifyToken,
  checkSubscriptionExpiry,
  checkStoreAccess,
  upload.single("file"),
  requirePermission("customers:create"),
  importCustomers
);

//Route: POST /api/customers
router.post("/", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("customers:create"), createCustomer);
//Route: GET /api/customers/search
router.get("/search", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("customers:search"), searchCustomers);
//Route: PUT /api/customers/:id
router.put("/:id", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("customers:update"), updateCustomer);
//Route: DELETE /api/customers/:id (checkStoreAccess removed vì storeId sẽ được verify từ customer document)
router.delete("/:id", verifyToken, checkSubscriptionExpiry, requirePermission("customers:delete"), softDeleteCustomer);
//Route: PUT /api/customers/:id/restore (khôi phục khách hàng đã bị xóa)
router.put("/:id/restore", verifyToken, checkSubscriptionExpiry, requirePermission("customers:update"), restoreCustomer);
//Route: GET /api/customers/store/:storeId
router.get("/store/:storeId", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("customers:search"), getCustomersByStore);
// Export danh sách khách hàng theo cửa hàng
router.get("/store/:storeId/export", verifyToken, checkSubscriptionExpiry, checkStoreAccess, requirePermission("customers:export"), exportCustomers);

module.exports = router;
