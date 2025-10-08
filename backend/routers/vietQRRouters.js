// routers/vietQRRouters.js
const express = require("express");
const router = express.Router();
const { createPaymentVietQR, vietQRCheck, serveQRImage } = require("../controllers/vietQRController");

// Tạo QR (POST)
router.post("/create", createPaymentVietQR);

// Check status (GET)
router.get("/check", vietQRCheck);
// Thêm route serve image
router.get("/qr/:txnRef", serveQRImage);

module.exports = router;