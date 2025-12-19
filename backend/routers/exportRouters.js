const express = require("express");
const {
  verifyToken,
  checkStoreAccess,
} = require("../middlewares/authMiddleware");
const {
  getExportOptions,
  exportResource,
} = require("../controllers/exportController");

const router = express.Router();

router.get(
  "/options",
  verifyToken,

  checkStoreAccess,
  getExportOptions
);

router.get(
  "/:resource",
  verifyToken,

  checkStoreAccess,
  exportResource
);

module.exports = router;
