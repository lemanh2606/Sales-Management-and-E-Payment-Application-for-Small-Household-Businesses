// controllers/store/storePaymentController.js
const axios = require("axios");
const crypto = require("crypto");
const {
  getStorePaymentConfig,
  addBank,
  updateBank,
  removeBank,
  setDefaultBank,
  listBanks,
  generateStoreVietQR,
  upsertStorePaymentConfig,
} = require("../../services/storePaymentService");

// ============ 1) Lấy toàn bộ cấu hình thanh toán của store ============
exports.getPaymentConfig = async (req, res) => {
  try {
    const { storeId } = req.params;

    const config = await getStorePaymentConfig(storeId);

    return res.json({
      success: true,
      message: "Lấy cấu hình thanh toán thành công",
      data: config || { banks: [], webhook: {} },
    });
  } catch (err) {
    console.error("getPaymentConfig error:", err);
    res.status(500).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 2) Thêm 1 ngân hàng vào cấu hình ============
exports.addBank = async (req, res) => {
  try {
    const { storeId } = req.params;
    const payload = req.body; // { bankCode, bankName, accountNumber, accountName, qrTemplate, isDefault }

    const config = await addBank(storeId, payload);

    return res.json({
      success: true,
      message: "Thêm ngân hàng thành công",
      data: config,
    });
  } catch (err) {
    console.error("addBank error:", err);
    res.status(400).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 3) Cập nhật ngân hàng ============
exports.updateBank = async (req, res) => {
  try {
    const { storeId } = req.params;
    const identifier = req.body.identifier; // { bankCode?, accountNumber? }
    const updates = req.body.updates; // các field muốn update

    const updated = await updateBank(storeId, identifier, updates);

    return res.json({
      success: true,
      message: "Cập nhật ngân hàng thành công",
      data: updated,
    });
  } catch (err) {
    console.error("updateBank error:", err);
    res.status(400).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 4) Xoá ngân hàng ============
exports.removeBank = async (req, res) => {
  try {
    const { storeId } = req.params;
    const identifier = req.body; // { bankCode?, accountNumber? }

    const updated = await removeBank(storeId, identifier);

    return res.json({
      success: true,
      message: "Xoá ngân hàng thành công",
      data: updated,
    });
  } catch (err) {
    console.error("removeBank error:", err);
    res.status(400).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 5) Chọn ngân hàng mặc định ============
exports.setDefaultBank = async (req, res) => {
  try {
    const { storeId } = req.params;
    const identifier = req.body; // { bankCode?, accountNumber? }

    const updated = await setDefaultBank(storeId, identifier);

    return res.json({
      success: true,
      message: "Đặt ngân hàng mặc định thành công",
      data: updated,
    });
  } catch (err) {
    console.error("setDefaultBank error:", err);
    res.status(400).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 6) Lấy danh sách ngân hàng ============
exports.listBanks = async (req, res) => {
  try {
    const { storeId } = req.params;

    const banks = await listBanks(storeId);

    return res.json({
      success: true,
      message: "Lấy danh sách ngân hàng thành công",
      data: banks,
    });
  } catch (err) {
    console.error("listBanks error:", err);
    res.status(500).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ============ 7) Tạo VietQR theo cấu hình store ============
exports.generateVietQR = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { amount = 0, description = "", bankCode, accountNumber } = req.body;

    // Nếu truyền identifier -> generate theo bank đó
    const identifier = bankCode || accountNumber ? { bankCode, accountNumber } : null;

    const qr = await generateStoreVietQR(storeId, Number(amount), description, identifier);

    return res.json({
      success: true,
      message: "Tạo VietQR thành công",
      data: qr,
    });
  } catch (err) {
    console.error("generateVietQR error:", err);
    res.status(400).json({ success: false, message: err.message || "Lỗi server" });
  }
};

// ==================================================================
// 8) KÍCH HOẠT PAYOS
// ==================================================================
exports.connectPayOS = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { clientId, apiKey, checksumKey } = req.body;

    if (!clientId || !apiKey || !checksumKey) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đủ Client ID, API Key và Checksum Key",
      });
    }

    // Tự sinh webhook URL (khách sẽ copy cái này dán vào dashboard PayOS)
    const webhookUrl = `${process.env.BASE_URL || req.protocol + "://" + req.get("host")}/api/payos/webhook/${storeId}`;

    // LƯU VÀO DB (không gọi API PayOS nữa!)
    await upsertStorePaymentConfig(storeId, {
      payos: {
        isEnabled: true,
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        checksumKey: checksumKey.trim(),
        webhookRegisteredAt: new Date(),
      },
      webhook: {
        isEnabled: true,
        url: webhookUrl,
        secretKey: checksumKey.trim(), // Dùng Checksum Key để verify signature
        updatedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Kích hoạt PayOS thành công! Copy Webhook URL dưới đây dán vào dashboard PayOS để hoàn tất.",
      data: {
        webhookUrl, // FE sẽ hiện cái này cho khách copy
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
        // Không trả checksumKey để bảo mật
      },
    });
  } catch (err) {
    console.error("connectPayOS error:", err.message);
    res.status(400).json({
      success: false,
      message: err.message || "Kết nối PayOS thất bại",
    });
  }
};

// ==================================================================
// 9) NHẬN WEBHOOK TỪ PAYOS (PayOS gọi trực tiếp)
// ==================================================================
exports.receivePayOSWebhook = async (req, res) => {
  try {
    const { storeId } = req.params;
    const signature = req.headers["x-payos-signature"];
    const payload = req.body;

    if (!signature) {
      return res.status(400).send("Missing signature");
    }

    const config = await getStorePaymentConfig(storeId);
    if (!config?.payos?.isEnabled || !config.payos.checksumKey) {
      return res.status(400).send("PayOS chưa được kích hoạt");
    }

    // Verify chữ ký
    const hash = crypto.createHmac("sha256", config.payos.checksumKey).update(JSON.stringify(payload)).digest("hex");

    if (hash !== signature) {
      return res.status(400).send("Invalid signature");
    }

    // Ở ĐÂY ÔNG XỬ LÝ ĐƠN HÀNG (tìm orderCode → cập nhật trạng thái → gửi thông báo...)
    console.log("PayOS Webhook thành công storeId:", storeId, payload);

    // Trả 200 để PayOS không gửi lại
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("receivePayOSWebhook error:", err);
    res.status(500).send("Lỗi server trang storePaymentController.js");
  }
};

// ==================================================================
// 10) TẮT PAYOS (dùng khi khách muốn tắt tự động xác nhận)
// ==================================================================
exports.disablePayOS = async (req, res) => {
  try {
    const { storeId } = req.params;

    await upsertStorePaymentConfig(storeId, {
      payos: { isEnabled: false },
      webhook: { isEnabled: false, updatedAt: new Date() },
    });

    return res.json({
      success: true,
      message: "Đã tắt tự động xác nhận PayOS thành công!",
    });
  } catch (err) {
    console.error("disablePayOS error:", err);
    res.status(500).json({ success: false, message: err.message || "Lỗi server" });
  }
};
