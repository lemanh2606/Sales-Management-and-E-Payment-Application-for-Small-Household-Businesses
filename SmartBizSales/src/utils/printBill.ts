import { printAsync } from "expo-print";
import dayjs from "dayjs";

/**
 * Helper: Chuyển số thành chữ (Tiếng Việt)
 */
const docSoVND = (so: number): string => {
  if (so === 0) return "Không đồng";
  const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const donVi = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  
  const docBlock = (block: number) => {
    let s = "";
    const h = Math.floor(block / 100);
    const ch = Math.floor((block % 100) / 10);
    const dv = block % 10;
    
    if (h > 0 || block >= 100) {
      s += chuSo[h] + " trăm ";
      if (ch === 0 && dv > 0) s += "lẻ ";
    }
    
    if (ch > 1) {
      s += chuSo[ch] + " mươi ";
      if (dv === 1) s += "mốt ";
      else if (dv === 5) s += "lăm ";
      else if (dv > 0) s += chuSo[dv];
    } else if (ch === 1) {
      s += "mười ";
      if (dv === 1) s += "một ";
      else if (dv === 5) s += "lăm ";
      else if (dv > 0) s += chuSo[dv];
    } else if (dv > 0) {
      s += chuSo[dv];
    }
    return s.trim();
  };

  let res = "";
  let i = 0;
  let s = Math.floor(so);
  if (s < 0) return "Âm " + docSoVND(Math.abs(s));

  do {
    const block = s % 1000;
    if (block > 0) {
      const blockStr = docBlock(block);
      res = blockStr + " " + donVi[i] + " " + res;
    }
    s = Math.floor(s / 1000);
    i++;
  } while (s > 0);

  const result = res.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng chẵn.";
};

const formatPrice = (price: number) => {
  return Math.round(price).toLocaleString("vi-VN") + " đ";
};

interface BillData {
  storeName: string;
  storeAddress: string;
  storePhone?: string;
  storeTaxCode?: string;
  
  orderId: string;
  createdAt: string | Date;
  employeeName: string;
  
  customerName: string;
  customerPhone?: string;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  
  paymentMethod: string;
  isVAT: boolean;
  printCount: number;
  
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  
  subtotal: number;
  discount: number;
  vatAmount: number;
  totalAmount: number;
}

export const generateBillHTML = (data: BillData) => {
  const {
    storeName,
    storeAddress,
    storePhone,
    storeTaxCode,
    orderId,
    createdAt,
    employeeName,
    customerName,
    customerPhone,
    companyName,
    taxCode,
    companyAddress,
    paymentMethod,
    isVAT,
    printCount,
    items,
    subtotal,
    discount,
    vatAmount,
    totalAmount,
  } = data;

  const dateDate = dayjs(createdAt);
  const isDuplicate = printCount > 0;

  const headerSection = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
      <div style="flex: 2;">
        <div style="font-weight: bold; font-size: 16px; text-transform: uppercase;">${storeName}</div>
        <div>Địa chỉ: ${storeAddress}</div>
        ${storePhone ? `<div>Điện thoại: ${storePhone}</div>` : ""}
        ${storeTaxCode ? `<div>Mã số thuế: ${storeTaxCode}</div>` : ""}
      </div>
      <div style="flex: 1; text-align: right;">
        <div style="font-size: 12px;">Số: ${orderId}</div>
        <div style="font-size: 12px;">Ngày: ${dateDate.format("DD/MM/YYYY")}</div>
      </div>
    </div>
    <div style="border-bottom: 1px solid #000; margin: 10px 0;"></div>
  `;

  const titleSection = `
    <div style="text-align: center; margin: 15px 0;">
      <div style="font-weight: bold; font-size: 20px;">
        ${isVAT ? "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" : "HÓA ĐƠN BÁN LẺ"}
      </div>
      <div style="font-style: italic; font-size: 12px;">
        Ngày ${dateDate.format("DD")} tháng ${dateDate.format("MM")} năm ${dateDate.format("YYYY")}
      </div>
    </div>
  `;

  let customerSection = "";
  if (isVAT) {
    customerSection = `
      <div style="margin-bottom: 15px;">
        ${customerName !== "Khách vãng lai" ? `
        <div style="display: flex; margin-bottom: 4px;">
           <span style="min-width: 150px;">Họ tên người mua hàng:</span>
           <span style="font-weight: bold;">${customerName}</span>
        </div>` : `
        <div style="display: flex; margin-bottom: 4px;">
           <span style="min-width: 150px;">Họ tên người mua hàng:</span>
           <span style="font-weight: bold;">${companyName || ""}</span>
        </div>`}
        
        <div style="display: flex; margin-bottom: 4px;">
           <span style="min-width: 150px;">Tên đơn vị:</span>
           <span style="font-weight: bold;">${companyName || "---"}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px;">
           <span style="min-width: 150px;">Mã số thuế:</span>
           <span>${taxCode || "---"}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px;">
           <span style="min-width: 150px;">Địa chỉ:</span>
           <span>${companyAddress || "---"}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px;">
          <span style="min-width: 150px;">Hình thức thanh toán:</span>
          <span style="text-transform: uppercase;">${paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản / QR"}</span>
        </div>
      </div>
    `;
  } else {
    customerSection = `
      <div style="margin-bottom: 15px;">
        <div style="display: flex; margin-bottom: 4px;">
          <span style="min-width: 150px;">Họ tên người mua hàng:</span>
          <span style="font-weight: bold;">${customerName}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px;">
          <span style="min-width: 150px;">Điện thoại:</span>
          <span>${customerPhone || "---"}</span>
        </div>
        <div style="display: flex; margin-bottom: 4px;">
          <span style="min-width: 150px;">Hình thức thanh toán:</span>
          <span style="text-transform: uppercase;">${paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản / QR"}</span>
        </div>
      </div>
    `;
  }

  const itemsRows = items.map((item, index) => `
    <tr>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${index + 1}</td>
      <td style="border: 1px solid #000; padding: 5px;">${item.name}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.unit}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.quantity}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatPrice(item.price)}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: right;">${formatPrice(item.subtotal)}</td>
    </tr>
  `).join("");

  const tableSection = `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="border: 1px solid #000; padding: 5px; width: 40px;">STT</th>
          <th style="border: 1px solid #000; padding: 5px;">Tên hàng hóa, dịch vụ</th>
          <th style="border: 1px solid #000; padding: 5px; width: 70px;">Đơn vị</th>
          <th style="border: 1px solid #000; padding: 5px; width: 60px;">SL</th>
          <th style="border: 1px solid #000; padding: 5px; width: 100px;">Đơn giá</th>
          <th style="border: 1px solid #000; padding: 5px; width: 120px;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  `;

  const totalSection = `
    <div style="width: 100%; margin-left: auto;">
      <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
        <span style="min-width: 200px;">Cộng tiền hàng:</span>
        <span style="min-width: 120px; text-align: right; font-weight: bold;">${formatPrice(subtotal)}</span>
      </div>
      ${discount > 0 ? `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
        <span style="min-width: 200px;">Chiết khấu (giảm giá):</span>
        <span style="min-width: 120px; text-align: right; font-weight: bold;">-${formatPrice(discount)}</span>
      </div>` : ""}
      <div style="display: flex; justify-content: flex-end; margin-bottom: 4px;">
        <span style="min-width: 200px;">Tiền thuế GTGT:</span>
        <span style="min-width: 120px; text-align: right; font-weight: bold;">${formatPrice(vatAmount)}</span>
      </div>
      <div style="display: flex; justify-content: flex-end; margin-bottom: 4px; font-size: 16px;">
        <span style="min-width: 200px; font-weight: bold;">Tổng cộng tiền thanh toán:</span>
        <span style="min-width: 120px; text-align: right; font-weight: bold; border-top: 1px solid #000;">
          ${formatPrice(totalAmount)}
        </span>
      </div>
    </div>
    <div style="margin-top: 10px; font-style: italic;">
      Số tiền viết bằng chữ: <span style="font-weight: bold;">${docSoVND(totalAmount)}</span>
    </div>
  `;

  const signatureSection = `
    <div style="display: flex; margin-top: 40px; text-align: center;">
      <div style="flex: 1;">
        <div style="font-weight: bold;">NGƯỜI MUA HÀNG</div>
        <div style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</div>
        <div style="margin-top: 50px; font-weight: bold;">
          ${customerName !== "Khách vãng lai" ? customerName : (companyName || "")}
        </div>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: bold;">NGƯỜI BÁN HÀNG</div>
        <div style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</div>
        <div style="margin-top: 50px; font-weight: bold;">${employeeName}</div>
      </div>
    </div>
  `;

  const footerSection = `
    <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #666;">
      ${isDuplicate ? `<div>(Bản sao hóa đơn - lần in thứ ${printCount + 1})</div>` : ""}
      <div>Cảm ơn quý khách đã mua hàng!</div>
      <div style="font-size: 10px;">Hệ thống quản lý SmartBiz v1.0</div>
    </div>
  `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; background-color: #fff; line-height: 1.4; }
        </style>
      </head>
      <body>
        ${headerSection}
        ${titleSection}
        ${customerSection}
        ${tableSection}
        ${totalSection}
        ${signatureSection}
        ${footerSection}
      </body>
    </html>
  `;
};

export const printBill = async (data: BillData) => {
  const html = generateBillHTML(data);
  await printAsync({ html });
};
