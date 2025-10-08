// routers/paymentRouters.js
const express = require("express");
const router = express.Router();
const { createPayment, vnpayReturn, vnpayIpn } = require("../controllers/paymentController");

// Tạo url thanh toán (POST)
router.post("/create_payment_url", createPayment);

// VNPay chuyển hướng người dùng tại đây sau khi thanh toán (GET)
router.get("/vnpay_return", vnpayReturn);

// IPN notify (VNPay -> merchant) - support GET & POST
router.get("/vnpay_ipn", vnpayIpn);
router.post("/vnpay_ipn", vnpayIpn);

module.exports = router;
