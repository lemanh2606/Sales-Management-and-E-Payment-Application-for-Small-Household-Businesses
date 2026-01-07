// services/payOSService.js
const axios = require("axios");
const crypto = require("crypto");
const Order = require("../models/Order");

const PAYOS_HOST = "https://api-merchant.payos.vn"; //theo docs api 2025 - đổi host
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

const VIETQR_ACQ_ID = process.env.VIETQR_ACQ_ID;
const VIETQR_ACCOUNT_NO = process.env.VIETQR_ACCOUNT_NO;
const VIETQR_ACCOUNT_NAME = process.env.VIETQR_ACCOUNT_NAME;
const API_URL = process.env.API_URL;

/**
 * 🧩 Tạo QR thanh toán qua PayOS
 * credentials: { clientId, apiKey, checksumKey } (optional - if null uses env)
 */
async function generateQRWithPayOS(input = {}, credentials = null) {
  // Determine creds
  const clientId = credentials?.clientId || PAYOS_CLIENT_ID;
  const apiKey = credentials?.apiKey || PAYOS_API_KEY;
  const checksumKey = credentials?.checksumKey || PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error("Missing PayOS credentials (Env or Config)");
  }

  const payload = input.body || input; // chấp nhận req Express hoặc object thuần

  const amount = Number(payload.amount ?? input.amount) || 1000;

  const providedOrderCode = payload.orderCode || payload.txnRef || input.orderCode || input.txnRef;

  const txnRef = providedOrderCode ? Number(providedOrderCode) : Math.floor(Date.now() / 1000);

  const rawInfo = payload.orderInfo || payload.description || input.orderInfo || input.description || `HD${txnRef}`;

  const orderInfo = rawInfo.toString();
  const description = orderInfo.slice(0, 25);
  //2 đường dẫn quan trọng của webhook khi thanh toán thành công hoặc huỷ
  const returnUrl = payload.returnUrl || input.returnUrl || process.env.PAYOS_RETURN_URL;
  const cancelUrl = payload.cancelUrl || input.cancelUrl || process.env.PAYOS_CANCEL_URL;

  const webhookUrl = payload.webhookUrl || input.webhookUrl || process.env.PAYOS_WEBHOOK_URL;

  const simulateWebhook = payload.simulateWebhook ?? input.simulateWebhook ?? true;

  const bodyData = {
    orderCode: txnRef,
    amount,
    description,
    returnUrl,
    cancelUrl,
  };

  // Tạo signature chuẩn
  const kvString = Object.keys(bodyData)
    .sort()
    .map((k) => `${k}=${bodyData[k]}`)
    .join("&");

  const signature = crypto.createHmac("sha256", checksumKey).update(kvString, "utf8").digest("hex");

  const finalBody = { ...bodyData, signature };

  // Gửi request tạo link thanh toán PayOS
  const response = await axios.post(`${PAYOS_HOST}/v2/payment-requests`, finalBody, {
    headers: {
      "x-client-id": clientId,
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  console.log("PayOS Response full:", JSON.stringify(response.data, null, 2));

  if (response.data.code !== "00") {
    throw new Error(`PayOS create error: ${response.data.desc || "Unknown error"}`);
  }

  const data = response.data.data;

  // ✅ FIX: Dùng thông tin CHÍNH XÁC từ PayOS trả về (Bin, tk, nội dung) để tạo QR
  // PayOS có thể thêm prefix vào description, phải dùng đúng description này thì mới tracking được.
  const qrDataURL = `https://img.vietqr.io/image/${data.bin}-${data.accountNumber}-compact2.png?amount=${data.amount}&addInfo=${encodeURIComponent(
    data.description
  )}&accountName=${encodeURIComponent(data.accountName || "Thanh Toan")}`;

  console.log("=== PAYOS QR DEBUG ===");
  console.log("txnRef:", txnRef);
  console.log("PayOS Description (Required):", data.description);
  console.log("QR Image URL:", qrDataURL);
  console.log("===============================");

  // Trả về qrDataURL chuẩn
  return { txnRef, amount, paymentLink: data.checkoutUrl, qrDataURL };
}

// verify webhook PayOS và update order status (tự động check thanh toán QR)
async function verifyPaymentWithPayOS(parsedWebhook) {
  try {
    // Note: Verify webhook dùng secret nào? Thường là checksumKey.
    // Nếu multi-tenant, webhook gửi về cần identify store.
    // PayOS webhook logic cần phức tạp hơn để support multi-tenant (truy vấn store by orderCode để lấy secret?).
    // Nhưng hiện tại giữ nguyên logic env global cho webhook để tránh rủi ro break.
    const secret = process.env.PAYOS_CHECKSUM_KEY; 
    if (!secret) throw new Error("Missing PAYOS_CHECKSUM_KEY");

    const receivedSignature = (parsedWebhook.signature || "").toUpperCase();
    const expectedSignature = computePayOSSignatureFromData(parsedWebhook.data, secret);

    console.log("KV preview:", buildKeyValueStringFromData(parsedWebhook.data).slice(0, 200));
    console.log("So sánh 'Signature': nhận được", receivedSignature, "mong đợi", expectedSignature);

    if (receivedSignature !== expectedSignature) {
      console.log("❌ Sai chữ ký webhook PayOS, từ chối cập nhật");
      return false;
    }

    if (parsedWebhook.code !== "00") {
      console.log("PayOS webhook báo lỗi:", parsedWebhook.desc);
      return false;
    }

    const tx = parsedWebhook.data;
    const order = await Order.findOne({ paymentRef: tx.orderCode });
    if (!order) {
      console.log("⚠ Không tìm thấy order", tx.orderCode, "→ Nhưng chữ ký đúng → OK 200 cho PayOS");
      return true; // ✅ KHÔNG trả false nữa
    }
    if (order.status !== "pending") {
      console.log("Order đã xử lý trước đó", order._id);
      return true;
    }

    order.status = "paid";
    await order.save();
    console.log("Update order PAID", order._id);
    return { status: "SUCCESS", orderId: order._id };
  } catch (err) {
    console.error("Lỗi verifyPayOS:", err.message);
    return false;
  }
}

// logic của PAYOS signature yêu cầu để tính chữ ký và so sánh khi verify webhook
/* ----- Helpers for PayOS signature (the doc-specified form key=value&key2=... sorted alphabetically) ----- */
function buildKeyValueStringFromData(data) {
  const keys = Object.keys(data).sort(); // sort alphabetically
  return keys
    .map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return `${k}=`;
      if (typeof v === "object") return `${k}=${JSON.stringify(v)}`;
      return `${k}=${v}`;
    })
    .join("&");
}

function computePayOSSignatureFromData(data, secret) {
  const kvString = buildKeyValueStringFromData(data);
  return crypto.createHmac("sha256", secret).update(kvString, "utf8").digest("hex").toUpperCase();
}

/**
 * Lấy thông tin thanh toán chủ động từ PayOS
 * Dùng để polling từ client
 */
async function getPaymentInfo(orderCode, credentials = null) {
  const clientId = credentials?.clientId || PAYOS_CLIENT_ID;
  const apiKey = credentials?.apiKey || PAYOS_API_KEY;

  if (!clientId || !apiKey) {
    console.error("Missing PayOS credentials (Env or Config)");
    return null;
  }

  try {
    const url = `${PAYOS_HOST}/v2/payment-requests/${orderCode}`;
    const response = await axios.get(url, {
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
      timeout: 10000,
    });

    if (response.data && response.data.code == "00") {
      return response.data.data; 
      // data fields: id, orderCode, amount, amountPaid, amountRemaining, status, transactions[], createdAt, ...
      // status: PENDING, PAID, CANCELLED, EXPIRED
    }
    return null;
  } catch (error) {
    console.error("PayOS getPaymentInfo error:", error.message);
    return null;
  }
}

module.exports = {
  generateQRWithPayOS,
  verifyPaymentWithPayOS,
  computePayOSSignatureFromData,
  getPaymentInfo,
};
