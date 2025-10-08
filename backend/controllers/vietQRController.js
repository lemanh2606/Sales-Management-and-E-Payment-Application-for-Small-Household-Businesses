// controllers/vietQRController.js
const { generateVietQR, verifyTransactionVietQR } = require("../services/vietQRService");

// Store tạm (dùng chung với VNPay nếu cần, hoặc riêng - tạm dùng global cho đơn giản)
const inMemoryOrders = {}; // { txnRef: { amount, status, createdAt } }

/**
 * Tạo VietQR (POST body: { amount, orderInfo }) - Trả JSON + HTML test
 */
const createPaymentVietQR = async (req, res) => {
  try {
    const { qrBase64, txnRef, amount, qrDataURL } = await generateVietQR(req);  // Gọi tên mới

    // Lưu order tạm
    inMemoryOrders[txnRef] = { amount, status: "PENDING", createdAt: Date.now(), qrBase64 };  // 👈 Thêm qrBase64

    // HTML test đơn giản (dán vào browser để xem QR, vì BE)
    const html = `
      <h3>Tạo QR Thanh Toán VietQR - SmartRetail</h3>
      <p>Amount: ${amount} VND</p>
      <p>txnRef: ${txnRef}</p>
      <p>Mô tả: Thanh toán kho hàng test</p>
      <img src="${qrDataURL}" alt="VietQR" style="width:200px;height:200px;border:1px solid #ccc;">
      <p>Quét QR bằng app ngân hàng (VCB/MBB) để test chuyển ${amount} VND. Sau pay, check status bằng GET /api/vietqr/check?txnRef=${txnRef}</p>
    `;

    return res.status(200).json({
      code: "00",
      message: "success",
      data: { qrBase64, txnRef, amount, qrDataURL, html },  // FE dùng qrBase64, BE test dùng html
    });
  } catch (err) {
    console.error("Có lỗi khi createPaymentVietQR:", err);
    return res.status(500).json({ code: "99", message: "Internal Server Error" });
  }
};

/**
 * Check status txn (GET ?txnRef=ORDER_xxx) - Poll verify, dùng 1 call lookup
 */
const vietQRCheck = async (req, res) => {
  try {
    const txnRef = req.query.txnRef;
    if (!txnRef) return res.status(400).json({ code: "01", message: "Bị mất tích txnRef" });

    const order = inMemoryOrders[txnRef];
    if (!order) return res.status(404).json({ code: "02", message: "Không có Order nào phù hợp" });

    const paid = await verifyTransactionVietQR(txnRef);  // Giữ nguyên
    if (paid) order.status = "PAID";

    return res.json({
      code: "00",
      message: "success",
      txnRef,
      status: order.status,
      paid,
      remainingCalls: "24/25"  // Hardcode, sau dynamic từ header response nếu cần
    });
  } catch (err) {
    console.error("Error vietQRCheck:", err);
    return res.status(500).json({ code: "99", message: "Server Error" });
  }
};

/**
 * Serve QR image (GET /api/vietqr/qr/:txnRef) - Trả PNG binary để <img src="/api/vietqr/qr/ORDER_xxx">
 */
const serveQRImage = (req, res) => {
  const txnRef = req.params.txnRef;
  const order = inMemoryOrders[txnRef];
  if (!order || !order.qrBase64) {
    return res.status(404).send('QR not found');
  }

  // Lưu qrBase64 vào order khi create (thêm vào createPaymentVietQR sau return)
  res.type('image/png');
  res.send(Buffer.from(order.qrBase64, 'base64'));  // Convert base64 to binary PNG
};

module.exports = { createPaymentVietQR, vietQRCheck, serveQRImage, inMemoryOrders };