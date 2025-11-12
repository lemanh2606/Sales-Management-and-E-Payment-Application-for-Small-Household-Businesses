import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tooltip } from "antd";
import {
  ShoppingCartOutlined,
  RollbackOutlined,
  FileTextOutlined,
  DropboxOutlined,
  BarChartOutlined,
} from "@ant-design/icons";

import OrderPOSHome from "./OrderPOSHome";
import OrderRefund from "./OrderRefund";
import OrderTrackingPage from "./OrderTrackingPage";
import InventoryLookup from "./InventoryLookup";
import EndOfDayReport from "./EndOfDayReport";

type PageType = "pos" | "refund" | "trackingpage" | "inventory" | "endofdayreport";

const SidebarPOS: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ✅ Lấy thông tin cửa hàng từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;

  // ✅ Lấy tab từ URL query (nếu có)
  const initialTab = (searchParams.get("tab") as PageType) || "pos";
  const [activePage, setActivePage] = useState<PageType>(initialTab);

  // ✅ Lưu lại tab hiện tại vào localStorage (để nhớ khi reload)
  useEffect(() => {
    if (storeId) localStorage.setItem(`activePOSPage_${storeId}`, activePage);
  }, [activePage, storeId]);

  // ✅ Khi đổi tab
  const handleTabChange = (key: PageType) => {
    setActivePage(key);
    setSearchParams({ tab: key }); // cập nhật URL
    if (storeId) localStorage.setItem(`activePOSPage_${storeId}`, key);
  };

  const menuItems = [
    { key: "pos", icon: <ShoppingCartOutlined />, label: "Bán hàng" },
    { key: "refund", icon: <RollbackOutlined />, label: "Hoàn hàng" },
    { key: "inventory", icon: <DropboxOutlined />, label: "Tra cứu tồn kho" },
    { key: "trackingpage", icon: <FileTextOutlined />, label: "Tra cứu đơn hàng" },
    { key: "endofdayreport", icon: <BarChartOutlined />, label: "Báo cáo cuối ngày" },
  ];

  // ✅ Render từng trang theo activePage
  const renderPage = () => {
    switch (activePage) {
      case "pos":
        return <OrderPOSHome />;
      case "refund":
        return <OrderRefund />;
      case "trackingpage":
        return <OrderTrackingPage />;
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
      {/* Sidebar dọc bên trái */}
      <div className="w-[60px] bg-gray-300 flex flex-col items-center py-4 gap-4">
        {menuItems.map((item) => (
          <Tooltip key={item.key} title={item.label} placement="right">
            <div
              onClick={() => handleTabChange(item.key as PageType)}
              className={`flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all duration-200 transform
                ${
                  activePage === item.key
                    ? "bg-blue-500 text-white border-2 border-blue-300 shadow-md scale-110"
                    : "text-gray-600 hover:text-blue-400 hover:bg-gray-200 hover:scale-105"
                }`}
            >
              <span
                className={`transition-transform duration-200 ${
                  activePage === item.key ? "scale-125" : "text-2xl"
                }`}
              >
                {item.icon}
              </span>
            </div>
          </Tooltip>
        ))}
      </div>

      {/* Khu vực nội dung */}
      <div className="flex-1 bg-gray-50 overflow-auto">{renderPage()}</div>
    </div>
  );
};

export default SidebarPOS;
