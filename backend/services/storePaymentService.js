// services/storePaymentService.js

// Logic quản lý cấu hình cổng thanh toán của từng cửa hàng (multi-bank support).
// - Hỗ trợ add / update / remove / setDefault bank
// - Lấy config theo store
// - Sinh VietQR URL (img.vietqr.io) theo bank/account của store
// - Validate cơ bản số tài khoản / tên chủ tài khoản

const StorePaymentConfig = require("../models/StorePaymentConfig");
const mongoose = require("mongoose");

/**
 * Kiểm tra format số tài khoản cơ bản (chỉ chữ số, 6-24 ký tự tùy ngân hàng)
 * Có thể mở rộng theo bankCode để validate chiều dài chính xác
 */
function normalizeAccountNumber(accountNumber) {
  if (typeof accountNumber !== "string") accountNumber = String(accountNumber || "");
  // Loại bỏ khoảng trắng và các ký tự không phải số
  return accountNumber.replace(/\s+/g, "").replace(/[^\d]/g, "");
}

function validateBankInfo(bankCode, bankName, accountNumber, accountName) {
  if (!bankCode || typeof bankCode !== "string") {
    throw new Error("bankCode (mã ngân hàng) là bắt buộc");
  }
  if (!bankName || typeof bankName !== "string") {
    throw new Error("bankName (tên ngân hàng) là bắt buộc");
  }
  if (!accountNumber) {
    throw new Error("accountNumber (số tài khoản) là bắt buộc");
  }
  const normalized = normalizeAccountNumber(accountNumber);
  // Kiểm tra tối thiểu: chỉ chứa số, độ dài từ 6 -> 24 (tùy ngân hàng)
  if (!/^\d{6,24}$/.test(normalized)) {
    throw new Error("accountNumber không hợp lệ (chỉ gồm chữ số, 6-24 ký tự)");
  }
  if (!accountName || accountName.trim().length < 2) {
    throw new Error("accountName (tên chủ tài khoản) không hợp lệ");
  }

  return {
    bankCode: bankCode.trim(),
    bankName: bankName.trim(),
    accountNumber: normalized,
    accountName: accountName.trim(),
  };
}

/**
 * Lấy config payment của store (nếu chưa có -> trả null)
 */
async function getStorePaymentConfig(storeId) {
  if (!storeId) throw new Error("storeId is required");
  return await StorePaymentConfig.findOne({ store: storeId }).lean();
}

/**
 * Tạo hoặc cập nhật cấu hình (một document per store).
 * Nếu document chưa tồn tại -> tạo mới.
 *
 * payload:
 *  { banks: [...], webhook: {...}, payos: {...} }
 */
async function upsertStorePaymentConfig(storeId, payload = {}) {
  if (!storeId) throw new Error("storeId is required");

  const allowed = {};
  if (payload.banks !== undefined) allowed.banks = payload.banks;
  if (payload.webhook !== undefined) allowed.webhook = payload.webhook;
  if (payload.payos !== undefined) allowed.payos = payload.payos;

  let doc = await StorePaymentConfig.findOne({ store: storeId });
  if (!doc) {
    doc = new StorePaymentConfig({
      store: storeId,
      banks: allowed.banks || [],
      webhook: allowed.webhook || { isEnabled: false, url: "", secretKey: "" },
      payos: allowed.payos || { isEnabled: false, clientId: "", apiKey: "", checksumKey: "" }, // thêm mặc định
    });
    await doc.save();
    return doc.toObject();
  }

  // Merge/update fields
  if (allowed.banks !== undefined) doc.banks = allowed.banks;
  if (allowed.webhook !== undefined) doc.webhook = allowed.webhook;
  if (allowed.payos !== undefined) doc.payos = allowed.payos;

  await doc.save();
  return doc.toObject();
}

/**
 * Thêm 1 bank config vào danh sách banks của store.
 * Nếu isDefault = true -> tự động set các bank khác isDefault = false
 */
async function addBank(storeId, bankInfo) {
  if (!storeId) throw new Error("storeId is required");
  const { bankCode, bankName, accountNumber, accountName, qrTemplate = "compact2", logo = "", isDefault = false } = bankInfo || {};

  // Validate cơ bản
  const normalized = validateBankInfo(bankCode, bankName, accountNumber, accountName);

  // Tìm config store, tạo nếu chưa có
  let config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) {
    config = await StorePaymentConfig.create({
      store: storeId,
      banks: [],
      webhook: { isEnabled: false, url: "", secretKey: "" },
    });
  }

  // Kiểm tra trùng (theo accountNumber hoặc bankCode+accountNumber)
  const exists = config.banks.find(
    (b) => b.accountNumber === normalized.accountNumber || (b.bankCode === normalized.bankCode && b.accountNumber === normalized.accountNumber)
  );
  if (exists) {
    throw new Error("Tài khoản đã tồn tại trong cấu hình của cửa hàng");
  }

  // Nếu isDefault -> set false cho các bank khác
  if (isDefault) {
    config.banks.forEach((b) => {
      b.isDefault = false;
    });
  }

  // Thêm bank
  config.banks.push({
    bankCode: normalized.bankCode,
    bankName: bankName.trim(),
    accountNumber: normalized.accountNumber,
    accountName: accountName.trim(),
    qrTemplate: qrTemplate || "compact2",
    logo: logo || "",
    isDefault: !!isDefault,
    connectedAt: new Date(),
    updatedAt: new Date(),
  });

  await config.save();
  return config.toObject();
}

/**
 * Cập nhật bank (tìm theo bankCode + accountNumber OR chỉ bankCode nếu unique)
 * identifier: { bankCode?, accountNumber? }
 * updates: { bankName?, accountName?, qrTemplate?, logo?, isDefault? }
 */
async function updateBank(storeId, identifier = {}, updates = {}) {
  if (!storeId) throw new Error("storeId is required");
  if (!identifier.bankCode && !identifier.accountNumber) throw new Error("Cần bankCode hoặc accountNumber để xác định bank");

  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) throw new Error("Store chưa có cấu hình thanh toán");

  const accountNumberNormalized = identifier.accountNumber ? normalizeAccountNumber(identifier.accountNumber) : null;

  const idx = config.banks.findIndex((b) => {
    if (identifier.accountNumber) {
      return b.accountNumber === accountNumberNormalized;
    }
    if (identifier.bankCode) {
      return b.bankCode === identifier.bankCode;
    }
    return false;
  });

  if (idx === -1) throw new Error("Không tìm thấy bank để cập nhật");

  // Nếu cập nhật accountNumber -> validate format
  if (updates.accountNumber) {
    updates.accountNumber = normalizeAccountNumber(updates.accountNumber);
    if (!/^\d{6,24}$/.test(updates.accountNumber)) throw new Error("accountNumber cập nhật không hợp lệ");
  }

  // Áp dụng cập nhật
  const target = config.banks[idx];
  if (updates.bankName) target.bankName = updates.bankName;
  if (updates.accountNumber) target.accountNumber = updates.accountNumber;
  if (updates.accountName) target.accountName = updates.accountName;
  if (updates.qrTemplate) target.qrTemplate = updates.qrTemplate;
  if (typeof updates.logo !== "undefined") target.logo = updates.logo;
  if (typeof updates.isDefault !== "undefined") {
    if (updates.isDefault) {
      // reset các bank khác
      config.banks.forEach((b, j) => {
        b.isDefault = j === idx;
      });
    } else {
      target.isDefault = false;
    }
  }
  target.updatedAt = new Date();

  await config.save();
  return config.toObject();
}

/**
 * Remove bank theo identifier (bankCode hoặc accountNumber)
 */
async function removeBank(storeId, identifier = {}) {
  if (!storeId) throw new Error("storeId is required");
  if (!identifier.bankCode && !identifier.accountNumber) throw new Error("Cần bankCode hoặc accountNumber để xác định bank");

  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) throw new Error("Store chưa có cấu hình thanh toán");

  const accountNumberNormalized = identifier.accountNumber ? normalizeAccountNumber(identifier.accountNumber) : null;

  const beforeLen = config.banks.length;
  config.banks = config.banks.filter((b) => {
    if (identifier.accountNumber) return b.accountNumber !== accountNumberNormalized;
    if (identifier.bankCode) return b.bankCode !== identifier.bankCode;
    return true;
  });

  if (config.banks.length === beforeLen) throw new Error("Không tìm thấy bank để xoá");

  await config.save();
  return config.toObject();
}

/**
 * Set bank mặc định (tìm theo bankCode hoặc accountNumber)
 */
async function setDefaultBank(storeId, identifier = {}) {
  if (!storeId) throw new Error("storeId is required");
  if (!identifier.bankCode && !identifier.accountNumber) throw new Error("Cần bankCode hoặc accountNumber để xác định bank");

  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) throw new Error("Store chưa có cấu hình thanh toán");

  const accountNumberNormalized = identifier.accountNumber ? normalizeAccountNumber(identifier.accountNumber) : null;

  let found = false;
  config.banks.forEach((b) => {
    if (identifier.accountNumber) {
      if (b.accountNumber === accountNumberNormalized) {
        b.isDefault = true;
        found = true;
      } else {
        b.isDefault = false;
      }
    } else if (identifier.bankCode) {
      if (b.bankCode === identifier.bankCode) {
        b.isDefault = true;
        found = true;
      } else {
        b.isDefault = false;
      }
    }
  });

  if (!found) throw new Error("Không tìm thấy bank để set làm mặc định");

  await config.save();
  return config.toObject();
}

/**
 * Lấy bank mặc định nếu có
 */
async function getDefaultBank(storeId) {
  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) return null;
  return config.banks.find((b) => b.isDefault) || null;
}

/**
 * Sinh URL VietQR theo bank entry (bankCode-accountNumber) và totalAmount (đơn vị VND)
 *
 * ví dụ:
 * https://img.vietqr.io/image/MB-3863666898666-compact2.png?amount=1000000&addInfo=Thanh%20toan%20don%20123&accountName=Nguyen%20Van%20A
 */
function buildVietQRUrlFromBankEntry(bankEntry, totalAmount = 0, description = "") {
  if (!bankEntry) throw new Error("bankEntry là bắt buộc");
  const bankCode = bankEntry.bankCode;
  const accountNumber = normalizeAccountNumber(bankEntry.accountNumber);
  const accountName = bankEntry.accountName || "";
  const template = bankEntry.qrTemplate || "compact2";

  const encodedInfo = encodeURIComponent(description || "");
  const encodedName = encodeURIComponent(accountName || "");

  // compact2 / compact / ... tùy template
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-${template}.png?amount=${Number(
    totalAmount || 0
  )}&addInfo=${encodedInfo}&accountName=${encodedName}`;
}

/**
 * Generate QR cho store:
 *  - Nếu bankIdentifier được truyền (bankCode/accountNumber) -> generate cho bank đó
 *  - Nếu không truyền -> generate cho bank mặc định (isDefault)
 *
 * Trả về object { bank, qrUrl, totalAmount, description }
 */
async function generateStoreVietQR(storeId, totalAmount = 0, description = "", bankIdentifier = null) {
  if (!storeId) throw new Error("storeId is required");
  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) throw new Error("Cửa hàng chưa cấu hình ngân hàng");

  let bankEntry = null;

  if (bankIdentifier) {
    const accNormalized = bankIdentifier.accountNumber ? normalizeAccountNumber(bankIdentifier.accountNumber) : null;
    bankEntry = config.banks.find((b) => (accNormalized ? b.accountNumber === accNormalized : b.bankCode === bankIdentifier.bankCode)) || null;
  } else {
    bankEntry = config.banks.find((b) => b.isDefault) || config.banks[0] || null;
  }

  if (!bankEntry) throw new Error("Không tìm thấy bank để tạo QR, hãy thêm bank trước");

  const qrUrl = buildVietQRUrlFromBankEntry(bankEntry, totalAmount, description);

  return {
    bank: {
      bankCode: bankEntry.bankCode,
      bankName: bankEntry.bankName,
      accountNumber: bankEntry.accountNumber,
      accountName: bankEntry.accountName,
    },
    totalAmount,
    description,
    qrUrl,
  };
}

/**
 * Helper: Lấy full danh sách banks (shallow) cho store
 */
async function listBanks(storeId) {
  const config = await StorePaymentConfig.findOne({ store: storeId });
  if (!config) return [];
  return config.banks.map((b) => ({
    bankCode: b.bankCode,
    bankName: b.bankName,
    accountNumber: b.accountNumber,
    accountName: b.accountName,
    qrTemplate: b.qrTemplate,
    logo: b.logo,
    isDefault: b.isDefault,
    connectedAt: b.connectedAt,
    updatedAt: b.updatedAt,
  }));
}

module.exports = {
  validateBankInfo,
  normalizeAccountNumber,
  getStorePaymentConfig,
  upsertStorePaymentConfig,
  addBank,
  updateBank,
  removeBank,
  setDefaultBank,
  getDefaultBank,
  listBanks,
  generateStoreVietQR,
  buildVietQRUrlFromBankEntry,
};
