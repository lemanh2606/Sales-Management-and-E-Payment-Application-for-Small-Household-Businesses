// routes/customerRouters.js
const express = require("express");
const router = express.Router();
const {
  createCustomer,
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
  getCustomersByStore,
  importCustomers,
  downloadCustomerTemplate,
} = require("../controllers/customer/customerController");
const { verifyToken, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
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
  checkStoreAccess,
  upload.single("file"),
  requirePermission("customers:create"),
  importCustomers
);

//Route: POST /api/customers
router.post("/", verifyToken, checkStoreAccess, requirePermission("customers:create"), createCustomer);
//Route: GET /api/customers/search
router.get("/search", verifyToken, checkStoreAccess, requirePermission("customers:search"), searchCustomers);
//Route: PUT /api/customers/:id
router.put("/:id", verifyToken, checkStoreAccess, requirePermission("customers:update"), updateCustomer);
//Route: DELETE /api/customers/:id
router.delete("/:id", verifyToken, checkStoreAccess, requirePermission("customers:delete"), softDeleteCustomer);
//Route: GET /api/customers/store/:storeId
router.get(
  "/store/:storeId",
  verifyToken,
  checkStoreAccess,
  requirePermission("customers:search"),
  getCustomersByStore
);

module.exports = router;
