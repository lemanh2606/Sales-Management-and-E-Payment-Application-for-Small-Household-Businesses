// services/vnpayService.js
const qs = require("qs");
const crypto = require("crypto");
const moment = require("moment");

// Sắp xếp object theo key alphabet (VNPay yêu cầu)
function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => (sorted[k] = obj[k]));
  return sorted;
}

// Tạo payment URL (trả về paymentUrl, txnRef, amount)
function createPaymentUrl(req) {
  const ipAddr = "127.0.0.1";  // 👈 Hardcode IPv4 để tránh ::1 gây lỗi sandbox

  const tmnCode = process.env.VNP_TMN_CODE;
  const secretKey = process.env.VNP_HASH_SECRET;
  const vnpUrl = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURN_URL;

  if (!tmnCode || !secretKey || !vnpUrl || !returnUrl) {
    throw new Error("Missing VNPAY env variables");
  }

  const date = new Date();
  const createDate = moment(date).format("YYYYMMDDHHmmss");
  const txnRef = `ORDER_${Date.now()}`;

  const amount = Number(req.body?.amount) || 0; // VND
  const bankCode = req.body?.bankCode; // optional

  let vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: req.body?.orderInfo || "Thanh toan don hang test",
    vnp_OrderType: req.body?.orderType || "other",
    vnp_Amount: String(Math.round(amount * 100)), // nhân 100 theo spec
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  if (bankCode) vnp_Params.vnp_BankCode = bankCode;

  vnp_Params = sortObject(vnp_Params);

  const signData = qs.stringify(vnp_Params, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  const vnp_SecureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // 👈 LOG ĐỂ DEBUG: In ra terminal khi POST (check signData + hash khớp không)
  console.log("=== VNPAY CREATE DEBUG ===");
  console.log("ipAddr used:", ipAddr);
  console.log("SignData (raw):", signData);
  console.log("Generated Hash:", vnp_SecureHash);
  console.log("========================");

  vnp_Params.vnp_SecureHash = vnp_SecureHash;

  // Build URL với encode: true
  const queryString = qs.stringify(vnp_Params, { encode: true, skipNulls: true });
  const paymentUrl = vnpUrl + "?" + queryString;

  return { paymentUrl, txnRef, amount };
}

// Verify signature VNPay trả về (giữ nguyên, đã có log)
function verifySignature(query) {
  const secretKey = process.env.VNP_HASH_SECRET;
  if (!secretKey) {
    console.warn("VNP_HASH_SECRET chưa được set trong .env");
    return false;
  }

  const secureHash = query.vnp_SecureHash;
  if (!secureHash) return false;

  const data = { ...query };
  delete data.vnp_SecureHash;
  delete data.vnp_SecureHashType;

  // decode toàn bộ param để VNPay encode trả về không lệch
  Object.keys(data).forEach((k) => {
    data[k] = decodeURIComponent(data[k]);
  });

  const sorted = sortObject(data);
  const signData = qs.stringify(sorted, { encode: false });
  const expected = crypto.createHmac("sha512", secretKey).update(Buffer.from(signData, "utf-8")).digest("hex");

  //logging
  console.log("SIGNDATA:", signData);
  console.log("EXPECTED:", expected);
  console.log("RETURNED:", secureHash);

  return expected.toLowerCase() === (secureHash || "").toLowerCase();
}

module.exports = { createPaymentUrl, verifySignature };