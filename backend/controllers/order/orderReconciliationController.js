const mongoose = require("mongoose");
const pdfParseModule = require("pdf-parse");
const Order = require("../../models/Order");
const logActivity = require("../../utils/logActivity");

const PDFParseClass = pdfParseModule?.PDFParse || pdfParseModule?.default?.PDFParse || pdfParseModule?.default || pdfParseModule;
if (typeof PDFParseClass !== "function") {
  throw new Error("Unable to load PDFParse class from pdf-parse module");
}
const parsePdfText = async (buffer) => {
  const parser = new PDFParseClass({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text || "", pages: result.pages || [] };
  } finally {
    try {
      await parser.destroy();
    } catch (err) {
      console.warn("Failed to destroy PDF parser", err?.message || err);
    }
  }
};

const normalizeStoreId = (raw) => {
  if (!raw) return null;
  const value = raw.toString();
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const decimalToNumber = (value) => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/,/g, ""));
  if (value.$numberDecimal) return Number(value.$numberDecimal);
  if (typeof value.toString === "function") return Number(value.toString());
  return 0;
};

const extractLineValue = (lines, labels = []) => {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    for (const label of labels) {
      const normalizedLabel = label.toLowerCase();
      if (line.toLowerCase().startsWith(normalizedLabel)) {
        const value = line.slice(label.length).replace(/^[:\-]/, "").trim();
        if (value) return value;
      }
    }
  }
  return null;
};

const sanitizeAmount = (value) => {
  if (!value) return null;
  const raw = value.toString().trim();
  if (!raw) return null;

  // Remove currency symbols/spaces, keep digits, separators and minus sign
  const numericPortionMatch = raw.replace(/[đ₫]/gi, "").match(/-?[0-9.,\s]+/);
  if (!numericPortionMatch) return null;
  const numericPortion = numericPortionMatch[0].replace(/\s+/g, "");
  if (!numericPortion) return null;

  const sign = numericPortion.startsWith("-") ? -1 : 1;
  const separatorCandidates = [
    { char: ",", index: numericPortion.lastIndexOf(",") },
    { char: ".", index: numericPortion.lastIndexOf(".") },
  ].sort((a, b) => b.index - a.index);

  let decimalDigits = "";
  let integerSliceEnd = numericPortion.length;

  for (const candidate of separatorCandidates) {
    if (candidate.index === -1) continue;
    const fractionalDigits = numericPortion
      .slice(candidate.index + 1)
      .replace(/[^0-9]/g, "");
    if (fractionalDigits.length >= 1 && fractionalDigits.length <= 2) {
      decimalDigits = fractionalDigits;
      integerSliceEnd = candidate.index;
      break;
    }
  }

  const integerDigits = numericPortion
    .slice(0, integerSliceEnd)
    .replace(/[^0-9]/g, "");

  if (!integerDigits && !decimalDigits) return null;

  const integerValue = integerDigits ? Number(integerDigits) : 0;
  const decimalValue = decimalDigits ? Number(`0.${decimalDigits}`) : 0;
  const parsed = sign * (integerValue + decimalValue);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPaidNotPrintedOrders = async (req, res) => {
  try {
    const storeId = normalizeStoreId(req.store?._id || req.query.storeId);
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu hoặc sai storeId để lấy dữ liệu đối soát" });
    }

    const match = {
      storeId,
      status: "paid",
    };

    const orders = await Order.find(match)
      .sort({ updatedAt: -1 })
      .populate("employeeId", "fullName")
      .populate("customer", "name phone")
      .lean();

    const totalAmount = orders.reduce((sum, order) => sum + decimalToNumber(order.totalAmount), 0);

    res.json({
      message: `Tìm thấy ${orders.length} hóa đơn đã thanh toán`,
      summary: {
        totalOrders: orders.length,
        totalAmount,
      },
      orders,
    });
  } catch (err) {
    console.error("getPaidNotPrintedOrders error:", err);
    res.status(500).json({ message: "Lỗi server khi lấy danh sách đối soát" });
  }
};

const verifyInvoicePdf = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "orderId không hợp lệ" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Thiếu file PDF hóa đơn" });
    }

    const storeId = normalizeStoreId(req.store?._id || req.query.storeId || req.body.storeId);
    if (!storeId) {
      return res.status(400).json({ message: "Thiếu hoặc sai storeId để đối soát" });
    }

    const order = await Order.findOne({ _id: orderId, storeId })
      .populate("customer", "name phone")
      .populate("employeeId", "fullName")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn trong hệ thống" });
    }

    const pdfData = await parsePdfText(req.file.buffer);
    const rawText = pdfData.text || "";
    const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const normalizedText = rawText.replace(/\s+/g, " ").toLowerCase();

    const pdfOrderId =
      extractLineValue(lines, ["ID Hóa đơn", "ID Hoa don", "Mã hóa đơn", "Ma hoa don"]) ||
      (normalizedText.includes(order._id.toString().toLowerCase()) ? order._id.toString() : null) ||
      (normalizedText.includes(order._id.toString().slice(-8).toLowerCase()) ? order._id.toString() : null);

    const pdfTotalLine = extractLineValue(lines, ["TỔNG TIỀN", "TONG TIEN"]);
    const pdfTotal = sanitizeAmount(pdfTotalLine);
    const expectedTotal = decimalToNumber(order.totalAmount);

    const pdfPaymentLine = extractLineValue(lines, ["Phương thức", "Phuong thuc", "Thanh toán", "Thanh toan"]);
    const expectedPaymentLabel = order.paymentMethod === "cash" ? "tiền mặt" : "qr";
    const pdfPayment = pdfPaymentLine ? pdfPaymentLine.toLowerCase() : null;

    const pdfCustomerLine = extractLineValue(lines, ["Khách hàng", "Khach hang"]);
    const orderCustomerName = order.customer?.name || "Khách vãng lai";
    const orderCustomerPhone = order.customer?.phone || "";

    const pdfCustomerName = pdfCustomerLine ? pdfCustomerLine.split("-")[0].trim() : null;
    const pdfCustomerPhone =
      pdfCustomerLine && pdfCustomerLine.includes("-")
        ? pdfCustomerLine.split("-").slice(1).join("-").replace(/[^0-9+]/g, "").trim()
        : null;

    const pdfVatLine = extractLineValue(lines, ["VAT", "Thuế", "Thue"]);

    const checks = [
      {
        field: "orderId",
        label: "Mã hóa đơn",
        expected: order._id.toString(),
        actual: pdfOrderId,
        match: Boolean(pdfOrderId && pdfOrderId.includes(order._id.toString())),
      },
      {
        field: "totalAmount",
        label: "Tổng tiền",
        expected: expectedTotal,
        actual: pdfTotal,
        match: pdfTotal !== null && Math.abs(pdfTotal - expectedTotal) < 1,
      },
      {
        field: "paymentMethod",
        label: "Phương thức thanh toán",
        expected: order.paymentMethod,
        actual: pdfPaymentLine || null,
        match: pdfPayment ? pdfPayment.includes(expectedPaymentLabel) : false,
      },
      {
        field: "customerName",
        label: "Tên khách hàng",
        expected: orderCustomerName,
        actual: pdfCustomerName,
        match: pdfCustomerName
          ? pdfCustomerName.toLowerCase().includes(orderCustomerName.toLowerCase())
          : orderCustomerName === "Khách vãng lai",
      },
      {
        field: "customerPhone",
        label: "Số điện thoại khách hàng",
        expected: orderCustomerPhone,
        actual: pdfCustomerPhone,
        match: orderCustomerPhone ? pdfCustomerPhone === orderCustomerPhone : true,
      },
      {
        field: "vat",
        label: "Thông tin VAT",
        expected: order.isVATInvoice ? "Có VAT" : "Không VAT",
        actual: pdfVatLine || (order.isVATInvoice ? null : ""),
        match: order.isVATInvoice ? Boolean(pdfVatLine?.toLowerCase().includes("vat")) : !pdfVatLine,
      },
    ];

    const mismatched = checks.filter((c) => !c.match);

    await logActivity({
      user: req.user,
      store: { _id: order.storeId },
      action: "validate",
      entity: "OrderInvoice",
      entityId: order._id,
      entityName: `Đối soát hóa đơn #${order._id}`,
      req,
      description: `Đối soát file PDF - ${mismatched.length === 0 ? "khớp" : `${mismatched.length} lệch`}`,
    });

    res.json({
      message: mismatched.length === 0 ? "Hóa đơn khớp với hệ thống" : "Phát hiện chênh lệch trong hóa đơn",
      summary: {
        totalChecks: checks.length,
        mismatched: mismatched.length,
        status: mismatched.length === 0 ? "aligned" : "diverged",
        textPreview: lines.slice(0, 30).join("\n"),
      },
      checks,
    });
  } catch (err) {
    console.error("verifyInvoicePdf error:", err);
    res.status(500).json({ message: "Lỗi server khi đối soát hóa đơn", error: err.message });
  }
};

module.exports = {
  getPaidNotPrintedOrders,
  verifyInvoicePdf,
};
