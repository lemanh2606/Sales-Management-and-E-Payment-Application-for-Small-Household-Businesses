// frontend/src/pages/order/ModalPrintBill.tsx
import React, { useRef } from "react";
import { Modal, Button, Divider, Typography, Tag, Table } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { format } from "date-fns";

const { Title, Text } = Typography;

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  subtotal: string;
  sku: string;
  price: number;
  tax_rate?: number;
}

interface ModalPrintBillProps {
  open: boolean;
  onCancel: () => void;
  onPrint: () => void;
  cart: CartItem[];
  totalAmount: number;
  storeName: string;
  address: string;
  storePhone?: string;
  storeTaxCode?: string;
  employeeName?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  orderId?: string | null;
  createdAt?: string;
  printCount?: number;
  earnedPoints?: number;
  isVAT?: boolean;
  companyName?: string;
  taxCode?: string;
  companyAddress?: string;
  vatAmount?: number;
  subtotal?: number;
  discount?: number;
}

// Helper: Chuyển số thành chữ (Tiếng Việt) - Rất quan trọng cho hóa đơn mẫu nhà nước
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

const ModalPrintBill: React.FC<ModalPrintBillProps> = ({
  open,
  onCancel,
  onPrint,
  cart,
  totalAmount,
  storeName,
  address,
  storePhone = "",
  storeTaxCode = "",
  employeeName = "N/A",
  customerName = "Khách vãng lai",
  customerPhone = "",
  paymentMethod = "cash",
  orderId = "—",
  createdAt,
  printCount = 0,
  earnedPoints = 0,
  isVAT = false,
  companyName = "",
  taxCode = "",
  companyAddress = "",
  vatAmount = 0,
  subtotal = 0,
  discount = 0,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const isPrintingRef = useRef(false);
  const printTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAfterPrint = () => {
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;
    onPrint();
    if (printTimeoutRef.current) clearTimeout(printTimeoutRef.current);
    printTimeoutRef.current = setTimeout(() => {
      isPrintingRef.current = false;
    }, 3000);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: handleAfterPrint,
  });

  const formatPrice = (price: any) => {
    const num = Math.round(parseFloat(price) || 0);
    return num.toLocaleString("vi-VN") + " đ";
  };

  const now = new Date();
  const createdDate = createdAt ? new Date(createdAt) : now;
  const isDuplicate = printCount > 0;

  return (
    <Modal
      open={open}
      title="Xem trước hóa đơn"
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Đóng
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
        >
          In hóa đơn
        </Button>,
      ]}
      width={700}
    >
      <div
        ref={printRef}
        style={{
          padding: "20px",
          color: "#000",
          backgroundColor: "#fff",
          fontFamily: "'Times New Roman', serif",
          lineHeight: "1.4",
        }}
      >
        {/* HEADER - THÔNG TIN ĐƠN VỊ BÁN */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontWeight: "bold", fontSize: "16px", textTransform: "uppercase" }}>
              {storeName}
            </div>
            <div>Địa chỉ: {address}</div>
            {storePhone && <div>Điện thoại: {storePhone}</div>}
            {storeTaxCode && <div>Mã số thuế: {storeTaxCode}</div>}
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: "12px" }}>Số: {orderId}</div>
            <div style={{ fontSize: "12px" }}>Ngày: {format(createdDate, "dd/MM/yyyy")}</div>
          </div>
        </div>

        <Divider style={{ margin: "10px 0", borderColor: "#000" }} />

        {/* TIÊU ĐỀ HÓA ĐƠN */}
        <div style={{ textAlign: "center", margin: "15px 0" }}>
          <div style={{ fontWeight: "bold", fontSize: "20px" }}>
            {isVAT ? "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" : "HÓA ĐƠN BÁN LẺ"}
          </div>
          <div style={{ fontStyle: "italic", fontSize: "12px" }}>
            Ngày {format(createdDate, "dd")} tháng {format(createdDate, "MM")} năm {format(createdDate, "yyyy")}
          </div>
        </div>

        {/* THÔNG TIN KHÁCH HÀNG */}
        <div style={{ marginBottom: 15 }}>
          {isVAT ? (
            <>
              {customerName !== "Khách vãng lai" ? <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Họ tên người mua hàng:</span>
                <span style={{ fontWeight: "bold" }}>{customerName}</span>
              </div> : <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Họ tên người mua hàng:</span>
                <span style={{ fontWeight: "bold" }}>{companyName}</span>
              </div>}
              <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Tên đơn vị:</span>
                <span style={{ fontWeight: "bold" }}>{companyName || "---"}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Mã số thuế:</span>
                <span>{taxCode || "---"}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Địa chỉ:</span>
                <span>{companyAddress || "---"}</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Họ tên người mua hàng:</span>
                <span style={{ fontWeight: "bold" }}>{customerName}</span>
              </div>
              <div style={{ display: "flex", marginBottom: 4 }}>
                <span style={{ minWidth: 150 }}>Điện thoại:</span>
                <span>{customerPhone || "---"}</span>
              </div>
            </>
          )}
          <div style={{ display: "flex", marginBottom: 4 }}>
            <span style={{ minWidth: 150 }}>Hình thức thanh toán:</span>
            <span style={{ textTransform: "uppercase" }}>{paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản / QR"}</span>
          </div>
        </div>

        {/* BẢNG CHI TIẾT SẢN PHẨM */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 15 }}>
          <thead>
            <tr style={{ backgroundColor: "#f2f2f2" }}>
              <th style={{ border: "1px solid #000", padding: "5px", width: "40px" }}>STT</th>
              <th style={{ border: "1px solid #000", padding: "5px" }}>Tên hàng hóa, dịch vụ</th>
              <th style={{ border: "1px solid #000", padding: "5px", width: "70px" }}>Đơn vị</th>
              <th style={{ border: "1px solid #000", padding: "5px", width: "60px" }}>SL</th>
              <th style={{ border: "1px solid #000", padding: "5px", width: "100px" }}>Đơn giá</th>
              <th style={{ border: "1px solid #000", padding: "5px", width: "120px" }}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, index) => {
              const unitPrice = (parseFloat(item.subtotal) || 0) / (item.quantity || 1);
              return (
                <tr key={index}>
                  <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>{index + 1}</td>
                  <td style={{ border: "1px solid #000", padding: "5px" }}>{item.name}</td>
                  <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>{item.unit}</td>
                  <td style={{ border: "1px solid #000", padding: "5px", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ border: "1px solid #000", padding: "5px", textAlign: "right" }}>{formatPrice(unitPrice)}</td>
                  <td style={{ border: "1px solid #000", padding: "5px", textAlign: "right" }}>{formatPrice(item.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* TỔNG CỘNG */}
        <div style={{ width: "100%", marginLeft: "auto" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <span style={{ minWidth: 200 }}>Cộng tiền hàng:</span>
            <span style={{ minWidth: 120, textAlign: "right", fontWeight: "bold" }}>{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <span style={{ minWidth: 200 }}>Chiết khấu (giảm giá):</span>
              <span style={{ minWidth: 120, textAlign: "right", fontWeight: "bold" }}>-{formatPrice(discount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <span style={{ minWidth: 200 }}>Tiền thuế GTGT:</span>
            <span style={{ minWidth: 120, textAlign: "right", fontWeight: "bold" }}>{formatPrice(vatAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4, fontSize: "16px" }}>
            <span style={{ minWidth: 200, fontWeight: "bold" }}>Tổng cộng tiền thanh toán:</span>
            <span style={{ minWidth: 120, textAlign: "right", fontWeight: "bold", borderTop: "1px solid #000" }}>
              {formatPrice(totalAmount)}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 10, fontStyle: "italic" }}>
          Số tiền viết bằng chữ: <span style={{ fontWeight: "bold" }}>{docSoVND(totalAmount)}</span>
        </div>

        {/* CHỮ KÝ */}
        <div style={{ display: "flex", marginTop: 40, textAlign: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold" }}>NGƯỜI MUA HÀNG</div>
            <div style={{ fontSize: "11px", fontStyle: "italic" }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ marginTop: 50, fontWeight: "bold" }}>{customerName !== "Khách vãng lai" ? customerName : companyName}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "bold" }}>NGƯỜI BÁN HÀNG</div>
            <div style={{ fontSize: "11px", fontStyle: "italic" }}>(Ký, ghi rõ họ tên)</div>
            <div style={{ marginTop: 50, fontWeight: "bold" }}>{employeeName}</div>
          </div>
        </div>

        <div style={{ marginTop: 40, textAlign: "center", fontSize: "11px", color: "#666" }}>
          {isDuplicate && <div>(Bản sao hóa đơn - lần in thứ {printCount + 1})</div>}
          <div>Cảm ơn quý khách đã mua hàng!</div>
          <div style={{ fontSize: "10px" }}>Hệ thống quản lý SmartBiz v1.0</div>
        </div>
      </div>
    </Modal>
  );
};

export default ModalPrintBill;
