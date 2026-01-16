// routers/storePaymentRouters.js
const express = require("express");
const router = express.Router();

const {
  getPaymentConfig,
  addBank,
  updateBank,
  removeBank,
  setDefaultBank,
  listBanks,
  generateVietQR,
  connectPayOS,
  receivePayOSWebhook,
  disablePayOS,
} = require("../controllers/store/storePaymentController");
const { verifyToken, checkStoreAccess, requirePermission } = require("../middlewares/authMiddleware");
const PERMISSION = "settings:payment-method";

//  1) Lấy full payment config của store GET /api/stores/:storeId/config
router.get("/:storeId/config", verifyToken, checkStoreAccess, requirePermission(PERMISSION), getPaymentConfig);

//  * 2) Lấy danh sách ngân hàng GET /api/stores/:storeId/banks
router.get("/:storeId/banks", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), listBanks);

//3) Thêm 1 ngân hàng POST /api/stores/:storeId/banks - Body: { bankCode, bankName, accountNumber, accountName, ... }
router.post("/:storeId/banks", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), addBank);

// 4) Update ngân hàng PUT /api/stores/:storeId/banks - Body: { identifier, updates }
router.put("/:storeId/banks", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), updateBank);

// 5) Xoá ngân hàng DELETE /api/stores/:storeId/banks - Body: { bankCode?, accountNumber? }
router.delete("/:storeId/banks", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), removeBank);

// 6) Đặt ngân hàng mặc định PUT /api/stores/:storeId/banks/default - Body: { bankCode?, accountNumber? }
router.put("/:storeId/banks/default", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), setDefaultBank);

// 7) Tạo QR POST /api/stores/:storeId/generate-qr - Body: { amount, description, bankCode?, accountNumber? }
router.post("/:storeId/generate-qr", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), generateVietQR);
// 8) Kích hoạt PayOS
router.post("/:storeId/payos/connect", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), connectPayOS);
// 9) Nhận webhook từ PayOS (KHÔNG cần auth)
router.post("/payos/webhook/:storeId", receivePayOSWebhook);
// TẮT PAYOS - PUT /:storeId/webhook
router.put( "/:storeId/webhook", verifyToken,  checkStoreAccess, requirePermission(PERMISSION), disablePayOS);

module.exports = router;
