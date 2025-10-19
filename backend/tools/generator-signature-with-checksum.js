// tools/test-payload-generator.js
// 👉 Sinh payload webhook giả giống PayOS để test verify chữ ký / webhook

const crypto = require("crypto");

const secret =
  "cb5fef9752968a4b5da4350bf9c0624a4aa42e9eee9dbfc4938ba30a3bf98b68";

// Dữ liệu mẫu giống PayOS gửi về, có thể tự tạo Order ở trang orderController rồi past vào để tạo chữ ký và payload vì webhook đang ngủ đông
const data = {
  orderCode: 1760177888,
  amount: 5000,
  description: "HD1760177888",
  accountNumber: "3863666898666",
  reference: "TF250101010101",
  transactionDateTime: "2025-10-11 10:30:00",
  paymentLinkId: "48dc259d905d4209a0d0b694b3220c40",
};

// 🔹 Hàm build key=value&... giống PayOS
function buildKeyValueStringFromData(data) {
  const keys = Object.keys(data).sort();
  return keys.map((k) => `${k}=${data[k]}`).join("&");
}

// 🔹 Tạo chữ ký theo secret hiện tại
function computeSignature(data, secret) {
  const kvString = buildKeyValueStringFromData(data);
  return crypto
    .createHmac("sha256", secret)
    .update(kvString, "utf8")
    .digest("hex")
    .toUpperCase();
}

const signature = computeSignature(data, secret);

const payload = {
  code: "00",
  desc: "success",
  data,
  signature,
};

console.log(
  "không cần copy đoạn này vào đâu, chỉ để tham khảo cách tạo chữ ký"
);
console.log("==== Copy JSON này vào Postman body (raw JSON) ====");
console.log("=========================================");
console.log(JSON.stringify(payload, null, 2));
console.log("=========================================");
console.log("==== Signature HMAC-SHA256:", signature, "====");
