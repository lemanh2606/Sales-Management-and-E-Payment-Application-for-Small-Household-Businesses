// routers/orderWebhookHandler.js
const { verifyPaymentWithPayOS } = require("../services/payOSService");
const Notification = require("../models/Notification");
const Order = require("../models/Order");

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
      // Tìm order thật bằng paymentRef
      const order = await Order.findOne({ paymentRef: parsed.data?.orderCode.toString() });
      if (!order) {
        console.error("Không tìm thấy order tương ứng với paymentRef", parsed.data?.orderCode);
        return res.status(404).send("Order not found");
      }

      console.log(`✅ Đã nhận tiền, đặt trạng thái 'paid' cho orderRef=${parsed.data?.orderCode}`);
      // 🔔 Emit socket thông báo thanh toán thành công (cho QR)
      const io = req.app.get("io");
      if (io) {
        io.emit("payment_success", {
          orderId: order._id.toString(), // ✅ chính xác FE dùng để print
          ref: order.paymentRef, 
          amount: parsed.data?.amount,
          method: "qr",
          message: `Đơn hàng ${order._id} đã thanh toán thành công! Phương thức QR CODE`,
        });

        // // 🧠 Lưu thông báo vào DB
        // await Notification.create({
        //   storeId: parsed.data?.storeId, // nếu có trong payload, không thì thêm field này từ order lookup sau cũng được
        //   userId: null, // webhook thì ko có user trực tiếp, để null
        //   type: "payment",
        //   title: "Thanh toán QR thành công",
        //   message: `Đơn hàng #${parsed.data?.orderCode} đã thanh toán thành công, số tiền: ${parsed.data?.amount}đ, phương thức: QRCode`,
        // });

        console.log(`🔔 [SOCKET + DB] Thanh toán QR: ${parsed.data?.amount}đ - ĐH: ${parsed.data?.orderCode}`);
      }

      return res.status(200).json({ message: "Webhook received" });
    } else {
      console.log(" Webhook không hợp lệ hoặc sai chữ ký");
      return res.status(400).json({ message: "Invalid webhook" });
    }
  } catch (err) {
    console.error("💥Lỗi webhook handler:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
