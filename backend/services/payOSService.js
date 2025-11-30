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
 * 🧩 Tạo QR thanh toán qua PayOS (nhưng render ảnh bằng VietQR vì 2 cái này là đối tác)
 */
async function generateQRWithPayOS(input = {}) {
  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
    throw new Error("Missing PayOS env variables");
  }

  const payload = input.body || input; // chấp nhận req Express hoặc object thuần

  const amount = Number(payload.amount ?? input.amount) || 1000;

  const providedOrderCode =
    payload.orderCode || payload.txnRef || input.orderCode || input.txnRef;

  const txnRef = providedOrderCode
    ? Number(providedOrderCode)
    : Math.floor(Date.now() / 1000);

  const rawInfo =
    payload.orderInfo ||
    payload.description ||
    input.orderInfo ||
    input.description ||
    `HD${txnRef}`;

  const orderInfo = rawInfo.toString();
  const description = orderInfo.slice(0, 25);

  const returnUrl =
    payload.returnUrl ||
    input.returnUrl ||
    process.env.PAYOS_RETURN_URL ||
    `${API_URL}/api/orders/payments/vietqr_return`;

  const cancelUrl =
    payload.cancelUrl ||
    input.cancelUrl ||
    process.env.PAYOS_CANCEL_URL ||
    `${API_URL}/api/orders/payments/vietqr_cancel`;

  const webhookUrl =
    payload.webhookUrl || input.webhookUrl || process.env.PAYOS_WEBHOOK_URL;

  const simulateWebhook =
    payload.simulateWebhook ?? input.simulateWebhook ?? true;

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

  const signature = crypto
    .createHmac("sha256", PAYOS_CHECKSUM_KEY)
    .update(kvString, "utf8")
    .digest("hex");

  const finalBody = { ...bodyData, signature };

  // Gửi request tạo link thanh toán PayOS
  const response = await axios.post(
    `${PAYOS_HOST}/v2/payment-requests`,
    finalBody,
    {
      headers: {
        "x-client-id": PAYOS_CLIENT_ID,
        "x-api-key": PAYOS_API_KEY,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  console.log("PayOS Response full:", JSON.stringify(response.data, null, 2));

  if (response.data.code !== "00") {
    throw new Error(
      `PayOS create error: ${response.data.desc || "Unknown error"}`
    );
  }

  const data = response.data.data;

  // ✅ Dùng VietQR API render ảnh QR thật, có amount + addInfo
  const qrDataURL = `https://img.vietqr.io/image/${VIETQR_ACQ_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
    description
  )}&accountName=${encodeURIComponent(VIETQR_ACCOUNT_NAME)}`;

  console.log("=== PAYOS QR DEBUG ===");
  console.log("txnRef:", txnRef);
  console.log("Checkout URL:", data.checkoutUrl);
  console.log("QR Image URL:", qrDataURL);
  console.log("===============================");

  // ✅ Giả lập webhook sau 30s nếu PayOS không gửi thật
  if (simulateWebhook && webhookUrl) {
    setTimeout(async () => {
      try {
        console.log(`⏳ [SIMULATOR] Auto-simulating webhook cho đơn ${txnRef}`);

        const fakeWebhook = {
          code: "00",
          desc: "success",
          data: {
            orderCode: Number(txnRef),
            amount,
            description: orderInfo,
            accountNumber: process.env.VIETQR_ACCOUNT_NO,
            reference: "SIMULATED_" + Date.now(),
            transactionDateTime: new Date()
              .toISOString()
              .replace("T", " ")
              .split(".")[0],
            paymentLinkId: "SIM-" + txnRef,
          },
        };

        // 🧮 Tính chữ ký HMAC giống thật
        const kvString = Object.keys(fakeWebhook.data)
          .sort()
          .map((k) => `${k}=${fakeWebhook.data[k]}`)
          .join("&");

        fakeWebhook.signature = crypto
          .createHmac("sha256", PAYOS_CHECKSUM_KEY)
          .update(kvString, "utf8")
          .digest("hex")
          .toUpperCase();

        await axios.post(webhookUrl, fakeWebhook, {
          headers: { "Content-Type": "application/json" },
        });

        console.log(
          `✅ [SIMULATOR] Webhook giả lập gửi thành công cho đơn ${txnRef}`
        );
      } catch (err) {
        console.error(
          "❌ [SIMULATOR] Gửi webhook giả lập thất bại, hãy bật ngrok:",
          err.message
        );
      }
    }, 10000); // sau 10s
  }

  return { txnRef, amount, paymentLink: data.checkoutUrl, qrDataURL };
}

// verify webhook PayOS và update order status (tự động check thanh toán QR)
async function verifyPaymentWithPayOS(parsedWebhook) {
  try {
    const secret = process.env.PAYOS_CHECKSUM_KEY;
    if (!secret) throw new Error("Missing PAYOS_CHECKSUM_KEY");

    const receivedSignature = (parsedWebhook.signature || "").toUpperCase();
    const expectedSignature = computePayOSSignatureFromData(
      parsedWebhook.data,
      secret
    );

    console.log(
      "KV preview:",
      buildKeyValueStringFromData(parsedWebhook.data).slice(0, 200)
    );
    console.log(
      "So sánh 'Signature': nhận được",
      receivedSignature,
      "mong đợi",
      expectedSignature
    );

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
      console.log(
        "⚠ Không tìm thấy order",
        tx.orderCode,
        "→ Nhưng chữ ký đúng → OK 200 cho PayOS"
      );
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
  return crypto
    .createHmac("sha256", secret)
    .update(kvString, "utf8")
    .digest("hex")
    .toUpperCase();
}

module.exports = {
  generateQRWithPayOS,
  verifyPaymentWithPayOS,
  computePayOSSignatureFromData,
};
