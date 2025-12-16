// src/utils/receiptPdf.ts
import * as Print from "expo-print";

/**
 * Types
 */
export interface ReceiptCartItem {
    name: string;
    quantity: number;
    unit: string;
    subtotal: string; // string số (vd "12000")
    sku?: string;
    priceAtTime?: string;
    price: number; // số (đang có trong PrintPreviewData)
}

export interface ReceiptPayload {
    storeName: string;
    address: string;

    employeeName?: string;
    customerName?: string;
    customerPhone?: string;

    paymentMethod?: "cash" | "qr" | string;
    orderId?: string | null;

    createdAt?: string; // ISO or any parseable
    printCount?: number;
    earnedPoints?: number;

    cart: ReceiptCartItem[];
    totalAmount: number; // number
}

/**
 * Helpers
 */
const esc = (s: any) =>
    String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const toNumber = (v: any) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
};

const formatMoney = (value: any) => {
    const n = toNumber(value);
    return n.toLocaleString("vi-VN") + "đ";
};

// dd/MM/yyyy HH:mm (giống date-fns format trên web)
const formatDateTimeVN = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const parseDateSafe = (value?: string) => {
    if (!value) return new Date();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
};

const getPaymentLabel = (method?: string) => {
    if (method === "cash") return "TIỀN MẶT";
    if (method === "qr") return "QR CODE";
    // fallback
    return (method || "cash").toString().toUpperCase();
};

/**
 * Build HTML receipt like ModalPrintBill.tsx (web)
 */
export function buildReceiptHtml(payload: ReceiptPayload) {
    const now = new Date();
    const createdDate = parseDateSafe(payload.createdAt);
    const isDuplicate = (payload.printCount ?? 0) > 0;

    const employeeName = payload.employeeName || "N/A";
    const customerName = payload.customerName || "Khách vãng lai";
    const customerPhone = payload.customerPhone || "";
    const orderId = payload.orderId || "—";
    const paymentMethod = payload.paymentMethod || "cash";
    const earnedPoints = payload.earnedPoints ?? 0;

    const rowsHtml = (payload.cart || [])
        .map((item) => {
            const qty = item.quantity || 0;
            const subtotal = toNumber(item.subtotal);
            const unitPrice = qty > 0 ? subtotal / qty : 0;

            return `
        <tr>
          <td class="col-name">
            <div class="name">${esc(item.name || "Sản phẩm")}</div>
            ${item.sku ? `<div class="sku">SKU: ${esc(item.sku)}</div>` : ""}
          </td>
          <td class="col-center">${esc(qty)}</td>
          <td class="col-center">${esc(item.unit || "cái")}</td>
          <td class="col-center">${esc(formatMoney(unitPrice))}</td>
          <td class="col-right">${esc(formatMoney(subtotal))}</td>
        </tr>
      `;
        })
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    /* Expo Print: có thể bị margin mặc định từ WebView, nên override bằng @page */
    @page { margin: 14px; }

    :root {
      --text: #0f172a;
      --muted: #334155;
      --line: #0f172a;
      --soft: #e2e8f0;
      --ok-bg: #dcfce7;
      --ok-fg: #166534;
      --warn-fg: #b45309;
    }

    body {
      font-family: monospace;
      color: var(--text);
      font-size: 12px;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }

    .wrap { padding: 16px; }

    .center { text-align: center; }
    .bold { font-weight: 700; }

    .storeName {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
    }

    .title {
      margin: 10px 0 8px;
      font-weight: 900;
      font-size: 18px;
    }

    .divider {
      border-top: 1px solid var(--line);
      margin: 10px 0;
    }

    .meta { margin: 4px 0; }

    .note-dup {
      color: var(--warn-fg);
      font-weight: 700;
      margin-top: 6px;
    }

    .sectionTitle {
      font-weight: 800;
      margin: 8px 0 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--line);
      font-size: 12px;
    }

    th, td {
      border: 1px solid var(--line);
      padding: 6px 6px;
      vertical-align: top;
    }

    th {
      font-weight: 800;
      text-align: center;
      background: #f8fafc;
    }

    .col-name { width: 40%; }
    .col-center { text-align: center; }
    .col-right { text-align: right; }

    .name { font-weight: 800; }
    .sku { margin-top: 3px; color: var(--muted); font-size: 11px; }

    .row-between {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0;
    }

    .tag-paid {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 10px;
      background: var(--ok-bg);
      color: var(--ok-fg);
      border: 1px solid rgba(22, 101, 52, 0.25);
      font-weight: 800;
      font-size: 11px;
    }

    .footer { margin-top: 10px; }
  </style>
</head>

<body>
  <div class="wrap">
    <div class="center">
      <h2 class="storeName">${esc(payload.storeName || "")}</h2>
      <div>Địa chỉ: ${esc(payload.address || "")}</div>
    </div>

    <div class="center title">=== HÓA ĐƠN BÁN HÀNG ===</div>

    <div class="meta"><span class="bold">Mã hoá đơn:</span> ${esc(orderId)}</div>
    <div class="meta"><span class="bold">Nhân viên:</span> ${esc(employeeName)}</div>
    <div class="meta">
      <span class="bold">Khách hàng:</span> ${esc(customerName)}
      ${customerPhone ? `- SĐT: ${esc(customerPhone)}` : ""}
    </div>
    <div class="meta"><span class="bold">Ngày:</span> ${esc(formatDateTimeVN(createdDate))}</div>
    <div class="meta"><span class="bold">Ngày in hoá đơn:</span> ${esc(formatDateTimeVN(now))}</div>

    ${isDuplicate
            ? `<div class="note-dup">(Bản sao hóa đơn - lần in ${(payload.printCount ?? 0) + 1})</div>`
            : ""
        }

    <div class="divider"></div>

    <div class="sectionTitle">CHI TIẾT SẢN PHẨM:</div>
    <table>
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th style="width:64px">Số lượng</th>
          <th style="width:54px">Đơn vị</th>
          <th style="width:78px">Đơn giá</th>
          <th style="width:92px">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || ""}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="row-between bold">
      <span>TỔNG TIỀN:</span>
      <span>${esc(formatMoney(payload.totalAmount))}</span>
    </div>

    <div class="row-between">
      <span class="bold">Phương thức:</span>
      <span>${esc(getPaymentLabel(paymentMethod))}</span>
    </div>

    <div class="row-between">
      <span class="bold">Điểm tích luỹ:</span>
      <span>${esc(String(earnedPoints > 0 ? earnedPoints : 0))}</span>
    </div>

    <div class="row-between">
      <span class="bold">Trạng thái:</span>
      <span class="tag-paid">ĐÃ THANH TOÁN</span>
    </div>

    <div class="divider"></div>
    <div class="center footer">=== CẢM ƠN QUÝ KHÁCH ===</div>
  </div>
</body>
</html>`;
}

/**
 * Tạo PDF từ payload (HTML -> PDF)
 */
export async function createReceiptPdfAsync(payload: ReceiptPayload) {
    const html = buildReceiptHtml(payload);

    // Expo Print: printToFileAsync xuất PDF từ HTML và trả về uri [web:1106]
    return Print.printToFileAsync({
        html,
        base64: false,
        // iOS hỗ trợ margins option; Android vẫn sẽ tôn trọng @page trong HTML (tùy WebView)
        margins: { left: 14, top: 14, right: 14, bottom: 14 },
    } as any);
}
