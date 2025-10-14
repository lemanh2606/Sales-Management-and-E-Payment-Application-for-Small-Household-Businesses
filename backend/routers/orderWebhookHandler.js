// routers/orderWebhookHandler.js
const { verifyPaymentWithPayOS } = require("../services/payOSService");

module.exports = async (req, res) => {
  try {
    console.log("🛰️  Webhook HIT:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body raw:", req.body.toString("utf8"));
    // Nếu middleware express.raw() được gắn cho route thì req.body là Buffer
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);

    // Parse JSON để truyền cho service/log
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch (e) {
      console.error("Webhook payload không phải JSON raw:", e.message);
      return res.status(400).send("Bad payload");
    }

    console.log("Nhận webhook PayOS (raw):", rawBody);
    console.log("Nhận webhook PayOS (parsed):", JSON.stringify(parsed, null, 2));

    // Gọi service verify, truyền cả parsed object và raw string
    const ok = await verifyPaymentWithPayOS(parsed, rawBody);

    if (ok) {
      console.log(`✅ Đã nhận tiền, đặt trạng thái 'paid' cho orderRef=${parsed.data?.orderCode}`);
      // 🔔 Emit socket thông báo thanh toán thành công (cho QR)
      const io = req.app.get("io");
      if (io) {
        io.emit("payment_success", {
          ref: parsed.data?.orderCode,
          amount: parsed.data?.amount,
          method: "qr",
          message: `Đơn hàng ${parsed.data?.orderCode} (QR) đã thanh toán thành công!`,
        });
        console.log(`🔔 [SOCKET] Gửi thông báo: Chuyển khoản QR thành công, số tiền (${parsed.data?.amount}đ) - Mã đơn hàng: ${parsed.data?.orderCode}`);
      }

      return res.status(200).json({ message: "Webhook received" });
    } else {
      console.log("❌ Webhook không hợp lệ hoặc sai chữ ký");
      return res.status(400).json({ message: "Invalid webhook" });
    }
  } catch (err) {
    console.error("💥Lỗi webhook handler:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
