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

  // Body cho API VietQR
  const bodyData = {
    accountNo: accountNo, //Số tài khoản người nhận tại ngân hàng thụ hưởng.
    accountName: cleanAccountName,  // Tên chủ tài khoản
    acqId: Number(acqId),  // Mã BIN 6 số định dang ngân hàng
    amount: amount,  // số tiền phải trả
    addInfo: orderInfo,  // Nội dung chuyển tiền, tiếng việt ko dấu
    format: "text",
    reference: txnRef,  // Track (optional docs)
    template: "compact2",  //Bao gồm : Mã QR, các logo , thông tin chuyển khoản
    //template còn có compact, qr_only, print với các định dạng khác nhau khi generate ra Ảnh
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
async function verifyTransactionVietQR(txnRef, maxRetries = 5) {  // 👈 Thêm: Retry max 5 lần cho delay real tx
  const clientId = process.env.VIETQR_CLIENT_ID;
  const apiKey = process.env.VIETQR_API_KEY;
  const acqId = process.env.VIETQR_ACQ_ID;
  const accountNo = process.env.VIETQR_ACCOUNT_NO;
  const lookupEndpoint = "https://api.vietqr.io/v2/lookup";  // Giữ nguyên

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Poll VietQR lần ${attempt}/${maxRetries} cho txnRef: ${txnRef}`)
      const response = await axios.get(lookupEndpoint, {
        params: { 
          acqId: Number(acqId),
          accountNo: accountNo,
          reference: txnRef  // Tra theo reference (ORDER_...)
        },
        headers: {
          "x-client-id": clientId,
          "x-api-key": apiKey,
        },
      });

      console.log(`📊 Lookup response lần ${attempt}:`, JSON.stringify(response.data, null, 2));

      if (response.data.code === "00" && response.data.data && response.data.data.status === "SUCCESS") {
        console.log(`✅ Verify VietQR success cho ${txnRef}, amount: ${response.data.data.amount}`);
        return { status: 'SUCCESS', amount: response.data.data.amount };  // 👈 Return object full cho check amount >= total
      } else if (response.data.code !== "00") {
        console.log(`❌ Lookup error lần ${attempt}: code ${response.data.code}, desc: ${response.data.desc}`);
      } else {
        console.log(`⏳ Chờ tx lần ${attempt}, status: ${response.data.data?.status || 'pending'}`);  // 👈 Log chờ delay
      }

      // Delay 30s trước retry (trừ lần cuối)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 30000));  // 👈 Delay 30s real time
      }
    } catch (err) {
      console.error(`💥 Verify error lần ${attempt}:`, err.response?.data?.desc || err.response?.data?.code || err.message);
      if (attempt === maxRetries) throw err;  // 👈 Throw chỉ lần cuối
      await new Promise(resolve => setTimeout(resolve, 30000));  // 👈 Delay retry nếu error
    }
  }

  console.log(`🚫 Verify VietQR fail sau ${maxRetries} lần cho ${txnRef}`);
  return false;  // 👈 Return false nếu hết retry
}

module.exports = { generateVietQR, verifyTransactionVietQR };