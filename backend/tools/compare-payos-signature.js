// tools/check-payos-sign.js
// 👉 Dùng để debug chữ ký webhook PayOS thủ công (copy raw JSON + secret vào và chạy `node check-payos-sign.js`)

const crypto = require("crypto");

// ==== PASTE EXACT RAW BODY string từ log webhook vào đây (copy nguyên JSON như console in) ====
const rawBody = `
{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 1765204399783,
    "amount": 5000,
    "description": "HD1765204399783",
    "accountNumber": "3863666898666",
    "reference": "TF250101010101",
    "transactionDateTime": "2025-10-11 10:30:00",
    "paymentLinkId": "48dc259d905d4209a0d0b694b3220c40"
  },
  "signature": "651E65C315449A66F25AE122F1AE5318D769A90059FD653B1BAA0140C5A21021"
}
  `;

// ==== PASTE PAYOS_CHECKSUM_KEY (secret) từ .env ====
const secret =
  "cb5fef9752968a4b5da4350bf9c0624a4aa42e9eee9dbfc4938ba30a3bf98b68";

const parsed = JSON.parse(rawBody);
const dataObj = parsed.data;
const received = (parsed.signature || "").toUpperCase();

// --- Hàm build key=value&key2=value2... theo PayOS docs ---
function buildKeyValueStringFromData(data) {
  const keys = Object.keys(data).sort();
  return keys
    .map((k) => {
      const v = data[k];
      if (v === null || v === undefined) return `${k}=`;
      if (typeof v === "object") return `${k}=${JSON.stringify(v)}`;
      return `${k}=${v}`;
    })
    .join("&");
}

// --- Tính chữ ký theo chuẩn PayOS ---
function computePayOSSignatureFromData(data, secret) {
  const kvString = buildKeyValueStringFromData(data);
  return crypto
    .createHmac("sha256", secret)
    .update(kvString, "utf8")
    .digest("hex")
    .toUpperCase();
}

// --- Debug ---
const expectedSignature = computePayOSSignatureFromData(dataObj, secret);

console.log("--- Debug PayOS signature comparison ---");
console.log("Raw body:", rawBody.slice(0, 100) + "...");
console.log("KV preview:", buildKeyValueStringFromData(dataObj));
console.log("Received signature:", received);
console.log("Expected signature:", expectedSignature);
console.log(" Hợp nhất không?", received === expectedSignature);
console.log("----------------------------------------");
