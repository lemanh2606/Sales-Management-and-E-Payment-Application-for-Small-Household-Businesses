// src/components/Sidebar.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import SidebarItem from "./SidebarItem";
import { FiLogOut, FiMenu, FiX, FiChevronDown } from "react-icons/fi";
import { AiOutlineDashboard } from "react-icons/ai";
import { BsBoxSeam, BsPeople } from "react-icons/bs";
import { MdShoppingCart } from "react-icons/md";
import { FiFileText, FiBell } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();
    const [openMobile, setOpenMobile] = useState(false);
    const navRef = useRef(null);
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0); // optional

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
                { name: "Nhóm sản phẩm", path: "/product-groups" },
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

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    // compute whether nav can scroll further down
    const recomputeScroll = useCallback(() => {
        const el = navRef.current;
        if (!el) return;
        const maxScrollTop = el.scrollHeight - el.clientHeight;
        const currentTop = el.scrollTop;
        setCanScrollDown(currentTop < maxScrollTop - 2);
        const progress = maxScrollTop <= 0 ? 100 : Math.round((currentTop / maxScrollTop) * 100);
        setScrollProgress(progress);
    }, []);

    useEffect(() => {
        const el = navRef.current;
        if (!el) return;

        // initial check
        recomputeScroll();

        const onScroll = () => recomputeScroll();
        el.addEventListener("scroll", onScroll);
        window.addEventListener("resize", onScroll);

        // observe changes inside nav (e.g., expand/collapse items)
        const mo = new MutationObserver(() => requestAnimationFrame(recomputeScroll));
        mo.observe(el, { childList: true, subtree: true, characterData: true });

        return () => {
            el.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            mo.disconnect();
        };
    }, [recomputeScroll]);

    // on click: scroll down by ~75% viewport or to bottom
    const handleScrollDownClick = () => {
        const el = navRef.current;
        if (!el) return;
        const viewport = el.clientHeight;
        const remaining = el.scrollHeight - el.scrollTop - viewport;
        if (remaining <= 20) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
            const amount = Math.round(viewport * 0.75);
            el.scrollBy({ top: amount, behavior: "smooth" });
        }
    };

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-green-600 text-white shadow-lg"
                onClick={() => setOpenMobile(true)}
                aria-label="Mở menu"
            >
                <FiMenu size={24} />
            </button>

            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 bg-black bg-opacity-40 z-40 transition-opacity duration-300 ${openMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
                onClick={() => setOpenMobile(false)}
            />

            <aside
                className={`bg-white w-64 h-full shadow-2xl fixed top-0 left-0 z-50 transform transition-transform duration-300 ${openMobile ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
                aria-hidden={openMobile ? "false" : "true"}
            >
                <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-extrabold text-green-700 tracking-wide drop-shadow-lg">
                            Smallbiz-Sales
                        </h2>
                        <button className="md:hidden" onClick={() => setOpenMobile(false)} aria-label="Đóng menu">
                            <FiX size={24} />
                        </button>
                    </div>

                    {/* nav: hidden scrollbar but scrollable */}
                    <nav
                        ref={navRef}
                        className="flex-1 flex flex-col gap-2 overflow-y-auto relative scrollbar-none pr-2"
                        aria-label="Sidebar navigation"
                    >
                        {items.map((item) => (
                            <SidebarItem key={item.name} item={item} />
                        ))}
                    </nav>

                    {/* Round button fixed to sidebar (won't move with nav content) */}
                    {canScrollDown && (
                        <button
                            onClick={handleScrollDownClick}
                            aria-label="Xem thêm"
                            title="Xem thêm"
                            className="absolute left-1/2 transform -translate-x-1/2 bottom-20 z-40   text-[black] flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
                            style={{ touchAction: "manipulation" }}
                        >
                            <div className="flex flex-col items-center">
                                <FiChevronDown size={20} />
                                <span className="text-xs leading-none -mt-1">Xem thêm</span>
                            </div>
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className="mt-6 w-full flex items-center justify-center gap-2 bg-[#ffffffa2] text-[black] py-3 rounded-xl hover:bg-[#ff0000] transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        <FiLogOut size={18} /> Đăng xuất ({user?.username || "Manager"})
                    </button>
                </div>
            </aside>
        </>
    );
}
