// src/components/sidebar/SidebarItem.jsx
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

export default function SidebarItem({ item, collapsed = false }) {
    const [open, setOpen] = useState(false);
    const hasChildren = item.children && item.children.length > 0;

    const handleClick = (e) => {
        // 👉 FIX: Toggle !open để mở/đóng (không chỉ mở one-way)
        if (hasChildren && !collapsed) {
            e.preventDefault();
            e.stopPropagation(); // 👉 FIX: Ngăn bubble lên parent nếu nested
            setOpen(!open);
        }
    };

    return (
        <div className="relative group text-gray-700">
            <NavLink
                to={item.path || "#"}
                className={({ isActive }) =>
                    `flex items-center justify-between p-3 rounded-lg transition-all duration-300
                    hover:bg-green-100 hover:text-green-700 cursor-pointer
                    ${isActive ? "bg-green-200 text-green-800 font-semibold shadow-inner" : "text-gray-800"}
                    ${collapsed ? "justify-center px-2" : ""}`
                }
                onClick={handleClick}
                title={collapsed ? item.name : undefined}
            >
                <span className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
                    {item.icon && <span className="text-green-600">{item.icon}</span>}
                    {!collapsed && <span className="font-medium text-lg">{item.name}</span>}
                </span>

                {!collapsed && hasChildren && (
                    <span className="ml-2">
                        {/* 👉 FIX: Rotate chevron khi open (FiChevronDown rotate-180) */}
                        {open ? (
                            <FiChevronDown size={18} className="text-green-600 transition-transform duration-300 rotate-180" />
                        ) : (
                            <FiChevronRight size={18} className="text-green-600 transition-transform duration-300" />
                        )}
                    </span>
                )}
            </NavLink>

            {/* submenu chỉ hiện khi open */}
            {!collapsed && hasChildren && open && (
                <div className="pl-6 mt-1 space-y-1"> {/* 👉 FIX: Thêm space-y-1 cho khoảng cách submenu mượt */}
                    {item.children.map((child) => (
                        <NavLink
                            key={child.name}
                            to={child.path}
                            className={({ isActive }) =>
                                `block py-2 px-3 rounded-lg text-gray-600 text-sm hover:bg-green-100 hover:text-green-700 transition 
                                ${isActive ? "bg-green-200 text-green-800 font-semibold shadow-inner" : ""}`
                            }
                        >
                            {child.name}
                        </NavLink>
                    ))}
                </div>
            )}

            {/* flyout cho chế độ collapsed */}
            {collapsed && hasChildren && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                    <div
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transform group-hover:translate-x-0 transition-all duration-150 pointer-events-auto"
                        style={{ minWidth: 220 }}
                    >
                        <div className="rounded-lg bg-white shadow-lg ring-1 ring-black/8 overflow-hidden">
                            <div className="px-3 py-3 flex items-center gap-3 border-b border-gray-100">
                                <span className="flex items-center justify-center" style={{ minWidth: 28 }}>
                                    {item.icon}
                                </span>
                                <div className="flex-1">
                                    <div className="text-lg font-bold text-green-700">{item.name}</div>
                                    {item.subtitle && <div className="text-sm text-gray-500">{item.subtitle}</div>}
                                </div>
                            </div>

                            <div className="flex flex-col py-1">
                                {item.children.map((ch) => (
                                    <NavLink
                                        key={ch.name}
                                        to={ch.path}
                                        className={({ isActive }) =>
                                            `px-3 py-2 text-base hover:bg-gray-50 block text-green-600 transition-colors ${isActive ? "bg-green-200 text-green-800 font-semibold" : ""
                                            }`
                                        }
                                    >
                                        {ch.name}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}