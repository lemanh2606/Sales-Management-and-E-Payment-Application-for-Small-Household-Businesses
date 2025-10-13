// src/components/Sidebar.jsx
import React, { useState } from "react";
import SidebarItem from "./SidebarItem";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";
import { AiOutlineDashboard } from "react-icons/ai";
import { MdStorefront } from "react-icons/md";
import { BsBoxSeam, BsPeople } from "react-icons/bs";
import { MdShoppingCart } from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [openMobile, setOpenMobile] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const items = [
        { name: "Dashboard", path: "/dashboard", icon: <AiOutlineDashboard size={20} /> },
        {
            name: "Cửa hàng",
            path: "/stores",
            icon: <MdStorefront size={20} />,
            children: [
                { name: "Chọn cửa hàng", path: "/select-store" },
                { name: "Tạo cửa hàng", path: "/create-store" },
            ],
        },
        {
            name: "Sản phẩm",
            path: "/products",
            icon: <BsBoxSeam size={20} />,
            children: [
                { name: "Danh sách", path: "/products" },
                { name: "Nhóm sản phẩm", path: "/product-groups" },
            ],
        },
        { name: "Đơn hàng", path: "/orders", icon: <MdShoppingCart size={20} /> },
        { name: "Người dùng", path: "/users", icon: <BsPeople size={20} /> },
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
