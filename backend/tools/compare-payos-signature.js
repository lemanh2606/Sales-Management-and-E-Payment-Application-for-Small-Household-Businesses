// tools/check-payos-sign.js
// 👉 Dùng để debug chữ ký webhook PayOS thủ công (copy raw JSON + secret vào và chạy `node check-payos-sign.js`)

const crypto = require("crypto");

// ==== PASTE EXACT RAW BODY string từ log webhook vào đây (copy nguyên JSON như console in) ====
const rawBody = `{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 1760177888,
    "amount": 5000,
    "description": "HD1760177888",
    "accountNumber": "3863666898666",
    "reference": "TF250101010101",
    "transactionDateTime": "2025-10-11 10:30:00",
    "paymentLinkId": "48dc259d905d4209a0d0b694b3220c40"
  },
  "signature": "A8B7A519AEEC47256ACEF1F30460ADA94A71B47E1D0B2086B7C2AE3E9D79E26F"
}`;

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
console.log("✅ Hợp nhất không?", received === expectedSignature);
console.log("----------------------------------------");
