// services/vietQRService.js
const axios = require("axios");

// generateVietQR
async function generateVietQR(req) {
  const clientId = process.env.VIETQR_CLIENT_ID;
  const apiKey = process.env.VIETQR_API_KEY;
  const acqId = process.env.VIETQR_ACQ_ID;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const accountName = process.env.VIETQR_ACCOUNT_NAME;  // 👈 Thêm required
  const endpoint = process.env.VIETQR_ENDPOINT;

  if (!clientId || !apiKey || !acqId || !accountNo || !accountName || !endpoint) {
    throw new Error("Missing VIETQR env variables (check accountName)");
  }

  const amount = Number(req.body?.amount) || 1000;  // Hardcode nhỏ cho test
  const txnRef = `ORDER_${Date.now()}`;  // Unique ref
  let orderInfo = req.body?.orderInfo || "Thanh toan kho hang test SmartRetail";

  // Clean addInfo: Max 25 chars, uppercase no accents/special (theo docs)
  orderInfo = orderInfo.toUpperCase().replace(/[^A-Z0-9\s]/g, '').substring(0, 25).trim();  // HOA, remove special/accents

  // Clean accountName: Uppercase no accents/special (docs yêu cầu)
  const cleanAccountName = accountName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').substring(0, 50).trim();  // 5-50 chars

  // Body cho API VietQR (thêm accountName required)
  const bodyData = {
    accountNo: accountNo,
    accountName: cleanAccountName,  // 👈 Thêm required field
    acqId: Number(acqId),  // 6 digits number
    amount: amount,  // Embed dynamic
    addInfo: orderInfo,  // Nội dung <=25 clean
    reference: txnRef,  // Track (optional docs)
    template: "compact2",  // Theo ảnh/table bạn gửi, hỗ trợ amount + logo bank
  };

  try {
    const response = await axios.post(endpoint, bodyData, {
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    console.log("VietQR Response full:", JSON.stringify(response.data, null, 2));  // Log full để debug

    if (response.data.code !== "00") {
      throw new Error(`VietQR create error: ${response.data.desc || 'Code: ' + response.data.code || 'Unknown error'}`);  // 👈 Dùng 'desc' từ docs
    }

    const qrDataURL = response.data.data.qrDataURL;  // data:image/png;base64,...
    const qrBase64 = qrDataURL ? qrDataURL.split(",")[1] : null;

    // Log debug
    console.log("=== VIETQR CREATE DEBUG ===");
    console.log("txnRef:", txnRef);
    console.log("Body sent:", JSON.stringify(bodyData, null, 2));
    console.log("QR DataURL preview:", qrDataURL ? qrDataURL.substring(0, 50) + "..." : "No QR");
    console.log("=========================");

    return { qrBase64, txnRef, amount, qrDataURL };
  } catch (err) {
    console.error("VietQR API error:", err.response?.data || err.message);
    throw err;
  }
}

// verifyTransactionVietQR (thêm accountNo/acqId theo docs lookup, desc từ response)
async function verifyTransactionVietQR(txnRef) {
  const clientId = process.env.VIETQR_CLIENT_ID;
  const apiKey = process.env.VIETQR_API_KEY;
  const acqId = process.env.VIETQR_ACQ_ID;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const lookupEndpoint = "https://api.vietqr.io/v2/lookup";  // Giữ, params theo docs

  try {
    const response = await axios.get(lookupEndpoint, {
      params: { 
        acqId: Number(acqId),
        accountNo: accountNo,
        reference: txnRef  // Tra theo reference
      },
      headers: {
        "x-client-id": clientId,
        "x-api-key": apiKey,
      },
    });

    console.log("Lookup Response:", JSON.stringify(response.data, null, 2));

    if (response.data.code === "00" && response.data.data && response.data.data.status === "SUCCESS") {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Verify error:", err.response?.data?.desc || err.response?.data?.code || err.message);
    return false;
  }
}

module.exports = { generateVietQR, verifyTransactionVietQR };