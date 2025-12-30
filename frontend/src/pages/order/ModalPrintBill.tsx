// frontend/src/pages/order/ModalPrintBill.tsx
import React, { useRef } from "react";
import { Modal, Button, Divider, Typography, Tag, Table } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { format } from "date-fns";

const { Title, Text } = Typography;

interface CartItem {
  name: string;
  quantity: number;
  unit: string;
  subtotal: string;
  sku?: string;
  priceAtTime?: string;
  price: number;
}

interface ModalPrintBillProps {
  open: boolean;
  onCancel: () => void;
  onPrint: () => void;
  cart: CartItem[];
  totalAmount: number;
  storeName: string;
  address: string;
  employeeName?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  orderId?: string | null;
  createdAt?: string;
  printCount?: number;
  earnedPoints?: number;
}

const ModalPrintBill: React.FC<ModalPrintBillProps> = ({
  open,
  onCancel,
  onPrint,
  cart,
  totalAmount,
  storeName,
  address,
  employeeName = "N/A",
  customerName = "Khách vãng lai",
  customerPhone = "",
  paymentMethod = "cash",
  orderId = "—",
  createdAt,
  printCount = 0,
  earnedPoints = 0,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  // ✅ THÊM REF ĐỂ CHẶN GỌI TRÙNG
  const isPrintingRef = useRef(false);
  const printTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAfterPrint = () => {
    console.log("🖨️ onAfterPrint called");
    console.log("📋 isPrintingRef.current:", isPrintingRef.current);

    // ✅ CHẶN NẾU ĐANG XỬ LÝ
    if (isPrintingRef.current) {
      console.log("⚠️ CHẶN: Đang xử lý print rồi!");
      return;
    }

    isPrintingRef.current = true;
    console.log("✅ Gọi onPrint()");
    onPrint();

    // ✅ RESET SAU 3 GIÂY
    if (printTimeoutRef.current) {
      clearTimeout(printTimeoutRef.current);
    }
    printTimeoutRef.current = setTimeout(() => {
      console.log("🔓 Reset isPrintingRef");
      isPrintingRef.current = false;
    }, 3000);
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: handleAfterPrint, // ✅ Dùng hàm wrapper
  });

  const formatPrice = (price: any) => {
    const num = parseFloat(price) || 0;
    return num.toLocaleString("vi-VN") + "đ";
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
          Hủy
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
        >
          In hóa đơn
        </Button>,
        <div
          key="note"
          style={{
            fontSize: 11,
            color: "black",
            marginRight: "auto",
            marginLeft: 10,
            marginTop: 10,
            textAlign: "center",
          }}
        >
          ⚠️ Bắt buộc phải in hóa đơn mỗi khi thanh toán thành công để cập nhật{" "}
          <span style={{ color: "blue", fontWeight: "bold" }}>
            HÀNG TỒN KHO
          </span>{" "}
          chính xác nhất.
        </div>,
      ]}
      width={560}
    >
      <div
        ref={printRef}
        className="p-4"
        style={{ fontFamily: "monospace", fontSize: "12px" }}
      >
        <Title level={3} className="text-center m-0">
          {storeName}
        </Title>
        <div className="text-center">Địa chỉ: {address}</div>
        <br></br>
        <Text
          style={{
            display: "block",
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          === HÓA ĐƠN BÁN HÀNG ===
        </Text>
        <br></br>
        <div>
          <span className="font-bold">Mã hoá đơn:</span> {orderId}
        </div>
        <div>
          {" "}
          <span className="font-bold">Nhân viên:</span> {employeeName}
        </div>
        <div>
          <span className="font-bold">Khách hàng:</span> {customerName}{" "}
          {customerPhone && `- SĐT: ${customerPhone}`}
        </div>
        <div>
          <span className="font-bold">Ngày:</span>{" "}
          {format(createdDate, "dd/MM/yyyy HH:mm")}
        </div>
        <div>
          <span className="font-bold">Ngày in hoá đơn:</span>{" "}
          {format(now, "dd/MM/yyyy HH:mm")}
        </div>
        {isDuplicate && (
          <Text type="warning">
            (Bản sao hóa đơn - lần in {printCount + 1})
          </Text>
        )}

        <Divider className="my-2" />

        <div className="font-bold mb-2">CHI TIẾT SẢN PHẨM:</div>
        <Table
          dataSource={cart}
          pagination={false}
          size="small"
          bordered
          rowKey={(_, idx) =>
            idx !== undefined ? idx.toString() : Math.random().toString()
          }
          columns={[
            {
              title: "Sản phẩm",
              dataIndex: "name",
              key: "name",
              render: (text, record) => `${record.name}`,
            },
            {
              title: "Số lượng",
              dataIndex: "quantity",
              key: "quantity",
              width: 90,
              align: "center" as const,
            },
            {
              title: "Đơn vị",
              dataIndex: "unit",
              key: "unit",
              width: 80,
              align: "center" as const,
            },
            {
              title: "Đơn giá",
              key: "price",
              width: 80,
              align: "center" as const,
              render: (_, record) =>
                formatPrice(
                  (parseFloat(record.subtotal) || 0) / (record.quantity || 1)
                ),
            },
            {
              title: "Thành tiền",
              dataIndex: "subtotal",
              key: "subtotal",
              align: "right" as const,
              render: (value) => formatPrice(value),
            },
          ]}
        />

        <Divider className="my-2" />

        <div className="flex justify-between font-bold">
          <span>TỔNG TIỀN:</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Phương thức:</span>
          <span>{paymentMethod === "cash" ? "TIỀN MẶT" : "QR CODE"}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-bold">Điểm tích luỹ:</span>
          <span>{earnedPoints > 0 ? earnedPoints : "0"}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span className="font-bold">Trạng thái: </span>
          <Tag color="green" style={{ marginInlineEnd: 0 }}>
            ĐÃ THANH TOÁN
          </Tag>
        </div>

        <Divider className="my-2" />
        <div className="text-center">=== CẢM ƠN QUÝ KHÁCH ===</div>
      </div>
    </Modal>
  );
};

export default ModalPrintBill;
