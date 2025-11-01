// routes/taxRouters.js
const express = require("express");
const router = express.Router();

const {
  previewSystemRevenue,
  createTaxDeclaration,
  updateTaxDeclaration,
  cloneTaxDeclaration,
  deleteTaxDeclaration,
  listDeclarations,
  exportDeclaration,
} = require("../controllers/tax/taxController");

const { verifyToken, checkStoreAccess, requirePermission, isManager } = require("../middlewares/authMiddleware");

router.get("/preview", verifyToken, checkStoreAccess, requirePermission("tax:preview"), previewSystemRevenue);

router.post("/", verifyToken, checkStoreAccess, requirePermission("tax:create"), createTaxDeclaration);

router.put("/:id", verifyToken, checkStoreAccess, requirePermission("tax:update"), updateTaxDeclaration);

router.post("/:id/clone", verifyToken, checkStoreAccess, requirePermission("tax:clone"), cloneTaxDeclaration);

router.delete("/:id", verifyToken, checkStoreAccess, isManager, requirePermission("tax:delete"), deleteTaxDeclaration);

router.get("/", verifyToken, checkStoreAccess, requirePermission("tax:list"), listDeclarations);

router.get("/:id/export", verifyToken, checkStoreAccess, requirePermission("tax:export"), exportDeclaration);

module.exports = router;
