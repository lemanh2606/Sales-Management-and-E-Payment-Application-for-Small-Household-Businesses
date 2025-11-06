// src/pages/order/ModalPrintBill.tsx
import React, { useRef } from "react";
import { Modal, Button, Divider, Typography } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import { format } from "date-fns";

const { Title, Text } = Typography;

interface CartItem {
  name: string;
  quantity: number;
  unit: string;
  subtotal: string;
}

interface ModalPrintBillProps {
  open: boolean;
  onCancel: () => void;
  onPrint: () => void;
  cart: CartItem[];
  totalAmount: number;
  storeName: string;
}

const ModalPrintBill: React.FC<ModalPrintBillProps> = ({
  open,
  onCancel,
  onPrint,
  cart,
  totalAmount,
  storeName,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef, // ← SỬA TẠI ĐÂY
    onAfterPrint: () => {
      onPrint();// Đóng modal + xóa tab
    },
  });

  const formatPrice = (price: any) => {
    const num = parseFloat(price) || 0;
    return num.toLocaleString("vi-VN") + "đ";
  };

  return (
    <Modal
      open={open}
      title="Hóa Đơn Bán Lẻ"
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint} // ← GỌI TRỰC TIẾP
        >
          In Hóa Đơn
        </Button>,
      ]}
      width={400}
    >
      <div ref={printRef} className="p-4" style={{ fontFamily: "monospace", fontSize: "12px" }}>
        <Title level={5} className="text-center m-0">
          {storeName}
        </Title>
        <Text className="block text-center">Hóa đơn bán lẻ</Text>
        <Text className="block text-center">
          {format(new Date(), "dd/MM/yyyy HH:mm")}
        </Text>
        <Divider className="my-2" />
        {cart.map((item, idx) => (
          <div key={idx} className="flex justify-between text-xs">
            <span>
              {item.name} x{item.quantity} ({item.unit})
            </span>
            <span>{formatPrice(item.subtotal)}</span>
          </div>
        ))}
        <Divider className="my-2" />
        <div className="flex justify-between font-bold">
          <span>Tổng:</span>
          <span>{formatPrice(totalAmount)}</span>
        </div>
      </div>
    </Modal>
  );
};

export default ModalPrintBill;