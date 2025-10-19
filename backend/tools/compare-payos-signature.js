// tools/check-payos-sign.js
// 👉 Dùng để debug chữ ký webhook PayOS thủ công (copy raw JSON + secret vào và chạy `node check-payos-sign.js`)

const crypto = require("crypto");

// ==== PASTE EXACT RAW BODY string từ log webhook vào đây (copy nguyên JSON như console in) ====
const rawBody = `{
  "code": "00",
  "desc": "success",
  "data": {
    "orderCode": 123,
    "amount": 3000,
    "description": "VQRIO123",
    "accountNumber": "12345678",
    "reference": "TF230204212323",
    "transactionDateTime": "2023-02-04 18:25:00",
    "paymentLinkId": "124c33293c43417ab7879e14c8d9eb18"
  },
  "signature": "1FF909E84DEC9140BD08C03949604E63F0F344FA42AA2EC0C85838AFA912D4EE"
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
