// src/components/Sidebar.jsx
import React, { useState } from "react";
import SidebarItem from "./SidebarItem";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { AiOutlineDashboard } from "react-icons/ai";
import { BsBoxSeam, BsPeople } from "react-icons/bs";
import { MdShoppingCart } from "react-icons/md";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiFileText, FiBell } from "react-icons/fi";


export default function Sidebar() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [openMobile, setOpenMobile] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const items = [
        {
            name: "Auth & Config",
            path: "/auth",
            icon: <AiOutlineDashboard size={20} />,
            children: [
                { name: "Đăng nhập / Đăng ký", path: "/login" },
                { name: "Chọn cửa hàng (Manager)", path: "/select-store" },
            ],
        },
        {
            name: "Người dùng",
            path: "/users",
            icon: <BsPeople size={20} />,
            children: [
                { name: "Danh sách người dùng", path: "/users" },
                { name: "Hồ sơ cá nhân", path: "/profile" },
            ],
        },
        {
            name: "Hàng hóa",
            path: "/products",
            icon: <BsBoxSeam size={20} />,
            children: [
                { name: "Danh sách hàng hóa", path: "/products" },
                { name: "Form thêm/sửa hàng hóa", path: "/products/create" },
                {
                    name: "Nhà cung cấp",
                    path: "/suppliers",
                    children: [{ name: "Danh sách nhà cung cấp", path: "/suppliers" }],
                },
                { name: "Quản lý nhập/xuất/hủy hàng", path: "/inventory" },
                { name: "Nhóm sản phẩm", path: "/product-groups" }, // nếu nhóm là global
            ],
        },
        {
            name: "Đơn hàng",
            path: "/orders",
            icon: <MdShoppingCart size={20} />,
            children: [
                { name: "Giao diện đặt hàng (POS)", path: "/orders/pos" },
                { name: "Hóa đơn bán + in hóa đơn", path: "/orders/invoice" },
                { name: "Thanh toán (tiền mặt / QR / ngân hàng)", path: "/orders/payment" },
            ],
        },
        {
            name: "Khách hàng",
            path: "/customers",
            icon: <BsPeople size={20} />,
            children: [
                { name: "Danh sách khách hàng", path: "/customers" },
                { name: "Lịch sử mua hàng", path: "/customers/history" },
            ],
        },
        {
            name: "Nhân viên",
            path: "/staff",
            icon: <BsPeople size={20} />,
            children: [
                { name: "Danh sách nhân viên", path: "/staff" },
                { name: "Lịch làm việc / bảng chấm công", path: "/staff/schedule" },
                { name: "Lương + hoa hồng", path: "/staff/salary" },
            ],
        },
        {
            name: "Sổ quỹ",
            path: "/finance",
            icon: <FiFileText size={20} />,
            children: [
                { name: "Phiếu thu chi", path: "/finance/receipt" },
                { name: "Công nợ khách hàng / NCC", path: "/finance/debt" },
            ],
        },
        {
            name: "Báo cáo",
            path: "/reports",
            icon: <AiOutlineDashboard size={20} />,
            children: [
                { name: "Dashboard tổng quan", path: "/reports/dashboard" },
                { name: "Báo cáo tài chính", path: "/reports/financial" },
            ],
        },
        {
            name: "Notification",
            path: "/notifications",
            icon: <FiBell size={20} />,
            children: [
                { name: "Thông báo thanh toán", path: "/notifications/payment" },
                { name: "Cảnh báo tồn kho thấp", path: "/notifications/stock" },
            ],
        },
    ];


    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-green-600 text-white shadow-lg"
                onClick={() => setOpenMobile(true)}
            >
                <FiMenu size={24} />
            </button>

            {/* Overlay */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-40 z-40 transition-opacity duration-300 ${openMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                onClick={() => setOpenMobile(false)}
            ></div>

            <aside
                className={`bg-white w-64 h-full shadow-2xl fixed top-0 left-0 z-50 transform transition-transform duration-300
          ${openMobile ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
            >
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-lg">
                            Smallbiz-Sales
                        </h2>
                        {/* Close mobile */}
                        <button className="md:hidden" onClick={() => setOpenMobile(false)}>
                            <FiX size={24} />
                        </button>
                    </div>

                    <nav className="flex-1 flex flex-col gap-2 overflow-y-auto">
                        {items.map((item) => (
                            <SidebarItem key={item.name} item={item} />
                        ))}
                    </nav>

                    <button
                        onClick={handleLogout}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-red-500 text-white py-3 rounded-xl hover:bg-red-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        <FiLogOut size={18} /> Đăng xuất ({user?.username || "Manager"})
                    </button>
                </div>
            </aside>
        </>
    );
}
