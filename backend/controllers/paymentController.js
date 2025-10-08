// controllers/paymentController.js
const { createPaymentUrl, verifySignature } = require("../services/vnpayService");

// Store tạm (thay bằng DB khi cần)
const inMemoryOrders = {}; // { txnRef: { amount, status, createdAt } }

/**
 * Tạo payment URL và lưu order tạm
 * Request body: { amount, bankCode, orderInfo }
 */
const createPayment = (req, res) => {
  try {
    const { paymentUrl, txnRef, amount } = createPaymentUrl(req);
    // lưu thông tin đơn hàng tạm thời (sẽ replace bằng DB)
    inMemoryOrders[txnRef] = { amount, status: "PENDING", createdAt: Date.now() };
    return res.status(200).json({
      code: "00",
      message: "success",
      data: paymentUrl,
      txnRef,
    });
  } catch (err) {
    console.error("Error createPayment:", err);
    return res.status(500).json({ code: "99", message: "Internal Server Error" });
  }
};

/**
 * Xử lý khi VNPay redirect user về (frontend redirect)
 * VNPay sẽ gửi query params, cần verify signature, check vnp_ResponseCode
 */
const vnpayReturn = (req, res) => {
  try {
    const query = req.query || {};
    const ok = verifySignature(query);
    if (!ok) {
      console.warn("Invalid VNPay SecureHash", query);
      return res.status(400).send("Invalid signature");
    }

    const responseCode = query.vnp_ResponseCode; // '00' = success
    const txnRef = query.vnp_TxnRef;
    const vnpAmount = Number(query.vnp_Amount || 0);
    const amount = Math.round(vnpAmount / 100);

    const order = inMemoryOrders[txnRef];
    if (!order) {
      console.warn("Order not found for txnRef", txnRef);
      return res.status(404).send("Order not found");
    }

    if (order.amount !== amount) {
      console.warn("Amount mismatch", { expected: order.amount, got: amount });
      // Không abort, nhưng log để điều tra
    }

    order.status = responseCode === "00" ? "PAID" : "FAILED";

    // Trả về trang kết quả đơn giản (sửa theo UI sau)
    return res.send(`<h3>Thanh toán ${responseCode === "00" ? "thành công" : "thất bại"}</h3>
      <p>txnRef: ${txnRef}</p>
      <p>responseCode: ${responseCode}</p>
      <p>amount: ${amount}</p>
      <p>Status stored: ${order.status}</p>`);
  } catch (err) {
    console.error("Error vnpayReturn:", err);
    return res.status(500).send("Server error");
  }
};

/**
 * IPN: VNPay gọi server-to-server để notify
 * VNPay có thể dùng GET hoặc POST, nên ta hỗ trợ cả 2
 */
const vnpayIpn = (req, res) => {
  try {
    const data = Object.keys(req.query || {}).length ? req.query : req.body || {};
    const ok = verifySignature(data);
    if (!ok) {
      console.warn("Invalid IPN signature", data);
      return res.status(400).json({ RspCode: "97", Message: "Invalid signature" });
    }

    const txnRef = data.vnp_TxnRef;
    const vnpAmount = Number(data.vnp_Amount || 0);
    const amount = Math.round(vnpAmount / 100);

    const order = inMemoryOrders[txnRef];
    if (!order) {
      // Nếu không tìm thấy order, trả về code khác tuỳ chính sách
      return res.status(404).json({ RspCode: "01", Message: "Order not found" });
    }

    order.status = data.vnp_ResponseCode === "00" ? "PAID" : "FAILED";

    // Trả về theo spec VNPay (00 = success)
    return res.json({ RspCode: "00", Message: "Success" });
  } catch (err) {
    console.error("Error vnpayIpn:", err);
    return res.status(500).json({ RspCode: "99", Message: "Server Error" });
  }
};

module.exports = { createPayment, vnpayReturn, vnpayIpn, inMemoryOrders };
