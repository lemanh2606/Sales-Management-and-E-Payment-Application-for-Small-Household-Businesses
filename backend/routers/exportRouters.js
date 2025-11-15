const express = require("express");
const { verifyToken, isManager, checkStoreAccess } = require("../middlewares/authMiddleware");
const { getExportOptions, exportResource } = require("../controllers/exportController");

const router = express.Router();

router.get(
  "/options",
  verifyToken,
  isManager,
  checkStoreAccess,
  getExportOptions
);

router.get(
  "/:resource",
  verifyToken,
  isManager,
  checkStoreAccess,
  exportResource
);

module.exports = router;
