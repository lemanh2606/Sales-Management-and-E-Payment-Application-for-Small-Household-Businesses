// src/components/SidebarItem.jsx
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";

export default function SidebarItem({ item }) {
    const [open, setOpen] = useState(false);
    const hasChildren = item.children && item.children.length > 0;

    return (
        <div className="text-gray-700">
            <NavLink
                to={item.path}
                className={({ isActive }) =>
                    `flex items-center justify-between p-3 rounded-lg transition-all duration-300 
          hover:bg-green-100 hover:text-green-700 cursor-pointer ${isActive ? "bg-green-200 text-green-800 font-semibold shadow-inner" : ""
                    }`
                }
                onClick={(e) => {
                    if (hasChildren) {
                        e.preventDefault();
                        setOpen(!open);
                    }
                }}
            >
                <span className="flex items-center gap-3">
                    {item.icon && <span className="text-green-600">{item.icon}</span>}
                    <span className="font-medium">{item.name}</span>
                </span>
                {hasChildren &&
                    (open ? (
                        <FiChevronDown size={18} className="text-green-600 transition-transform duration-300" />
                    ) : (
                        <FiChevronRight size={18} className="text-green-600 transition-transform duration-300" />
                    ))}
            </NavLink>

            {hasChildren && (
                <div
                    className={`pl-6 mt-1 overflow-hidden transition-all duration-300 ${open ? "max-h-96" : "max-h-0"
                        }`}
                >
                    {item.children.map((child) => (
                        <NavLink
                            key={child.name}
                            to={child.path}
                            className={({ isActive }) =>
                                `block py-2 px-3 rounded-lg text-gray-600 text-sm hover:bg-green-100 hover:text-green-700 transition ${isActive ? "bg-green-200 text-green-800 font-semibold shadow-inner" : ""
                                }`
                            }
                        >
                            {child.name}
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
}
