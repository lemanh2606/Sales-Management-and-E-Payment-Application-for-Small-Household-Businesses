import React, { useState, useEffect } from "react";
import { Tooltip } from "antd";
import { ShoppingCartOutlined, RollbackOutlined, FileTextOutlined, DropboxOutlined, BarChartOutlined } from "@ant-design/icons";

import OrderPOSHome from "./OrderPOSHome";
import OrderRefund from "./OrderRefund";
import OrderBill from "./OrderBill";
import InventoryLookup from "./InventoryLookup";
import EndOfDayReport from "./EndOfDayReport";

type PageType = "pos" | "refund" | "bill" | "inventory" | "endofdayreport";

const SidebarPOS: React.FC = () => {
  //Láy từ local
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore._id;

  // Lấy trang đang mở từ localStorage (gắn theo storeId)
  const [activePage, setActivePage] = useState<PageType>(() => {
    const saved = localStorage.getItem(`activePOSPage_${storeId}`);
    return (saved as PageType) || "pos";
  });
  
  // Mỗi khi đổi trang thì lưu lại
  useEffect(() => {
    localStorage.setItem(`activePOSPage_${storeId}`, activePage);
  }, [activePage, storeId]);

  const menuItems = [
    { key: "pos", icon: <ShoppingCartOutlined />, label: "Bán hàng" },
    { key: "refund", icon: <RollbackOutlined />, label: "Hoàn hàng" },
    { key: "inventory", icon: <DropboxOutlined />, label: "Tra cứu tồn kho" },
    { key: "bill", icon: <FileTextOutlined />, label: "Tra cứu hóa đơn" },
    { key: "endofdayreport", icon: <BarChartOutlined />, label: "Báo cáo cuối ngày" },
  ];

  const renderPage = () => {
    switch (activePage) {
      case "pos":
        return <OrderPOSHome />;
      case "refund":
        return <OrderRefund />;
      case "bill":
        return <OrderBill />;
      case "inventory":
        return <InventoryLookup />;
      case "endofdayreport":
        return <EndOfDayReport />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Cột sidebar nhỏ như cột điện */}
      <div className="w-[60px] bg-[#001529] flex flex-col items-center py-4 gap-4">
        {menuItems.map((item) => (
          <Tooltip key={item.key} title={item.label} placement="right">
            <div
              onClick={() => setActivePage(item.key as PageType)}
              className={`text-white text-xl cursor-pointer transition-colors ${
                activePage === item.key ? "text-blue-400" : "hover:text-blue-300"
              }`}
            >
              {item.icon}
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Khu vực hiển thị trang */}
      <div className="flex-1 bg-gray-50 overflow-auto">{renderPage()}</div>
    </div>
  );
};

export default SidebarPOS;
