// src/components/Sidebar.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import SidebarItem from "./SidebarItem";
import { FiLogOut, FiMenu, FiX, FiChevronDown, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { AiOutlineDashboard } from "react-icons/ai";
import { BsBoxSeam, BsPeople } from "react-icons/bs";
import { MdShoppingCart } from "react-icons/md";
import { FiFileText, FiBell, FiStar } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Sidebar() {
  const navigate = useNavigate();
  const { logout, user: authUser } = useAuth();

  // fallback to localStorage if authUser missing (reload)
  const localUser = useMemo(() => {
    if (authUser) return authUser;
    try {
      const u = localStorage.getItem("user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }, [authUser]);

  const user = localUser;

  // collapse state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const s = localStorage.getItem("sidebar_collapsed");
      return s === "1";
    } catch {
      return false;
    }
  });

  const [openMobile, setOpenMobile] = useState(false);
  const navRef = useRef(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // base items with permissions (same as before)
  const baseItems = [
    {
      key: "store",
      name: "Cửa hàng",
      path: "/auth",
      icon: <AiOutlineDashboard size={20} />,
      children: [{ name: "Chọn cửa hàng (Manager)", path: "/select-store", permission: "store:view" }],
    },
    {
      key: "users",
      name: "Người dùng",
      path: "/users",
      icon: <BsPeople size={20} />,
      children: [
        { name: "Danh sách người dùng", path: "/users", permission: "users:view" },
        { name: "Hồ sơ cá nhân", path: "/profile", permission: "users:view" },
      ],
    },
    {
      key: "products",
      name: "Hàng hóa",
      path: "/products",
      icon: <BsBoxSeam size={20} />,
      children: [
        { name: "Danh sách hàng hóa", path: "/products", permission: "products:view" },
        { name: "Form thêm/sửa hàng hóa", path: "/products/create", permission: "products:create" },
        {
          name: "Nhà cung cấp",
          path: "/suppliers",
          children: [{ name: "Danh sách nhà cung cấp", path: "/suppliers", permission: "supplier:view" }],
        },
        { name: "Quản lý nhập/xuất/hủy hàng", path: "/inventory", permission: "purchase-orders:view" },
        { name: "Nhóm sản phẩm", path: "/product-groups", permission: "product-groups:view" },
      ],
    },
    {
      key: "orders",
      name: "Đơn hàng",
      path: "/orders",
      icon: <MdShoppingCart size={20} />,
      children: [
        { name: "Giao diện đặt hàng (POS)", path: "/orders/pos", permission: "orders:create" },
        { name: "Hóa đơn bán + in hóa đơn", path: "/orders/invoice", permission: "orders:view" },
        { name: "Thanh toán (tiền mặt / QR / ngân hàng)", path: "/orders/payment", permission: "orders:pay" },
      ],
    },
    {
      key: "customers",
      name: "Khách hàng",
      path: "/customers",
      icon: <BsPeople size={20} />,
      children: [
        { name: "Danh sách khách hàng", path: "/customers", permission: "customers:search" },
        { name: "Lịch sử mua hàng", path: "/customers/history", permission: "customers:view" },
      ],
    },
    {
      key: "staff",
      name: "Nhân viên",
      path: "/staff",
      icon: <BsPeople size={20} />,
      children: [
        { name: "Danh sách nhân viên", path: "/staff", permission: "store:employee:view" },
        { name: "Lịch làm việc / bảng chấm công", path: "/staff/schedule", permission: "store:staff:assign" },
        { name: "Lương + hoa hồng", path: "/staff/salary", permission: "users:assign-role" },
      ],
    },
    {
      key: "finance",
      name: "Sổ quỹ",
      path: "/finance",
      icon: <FiFileText size={20} />,
      children: [
        { name: "Phiếu thu chi", path: "/finance/receipt", permission: "finance:view" },
        { name: "Công nợ khách hàng / NCC", path: "/finance/debt", permission: "finance:debt" },
      ],
    },
    {
      key: "loyalty",
      name: "Tích điểm",
      path: "/loyalty",
      icon: <FiStar size={20} />,
      children: [{ name: "Cấu hình hệ thống", path: "/loyalty/config", permission: "loyalty:manage" }],
    },
    {
      key: "reports",
      name: "Báo cáo",
      path: "/reports",
      icon: <AiOutlineDashboard size={20} />,
      children: [
        { name: "Dashboard tổng quan", path: "/reports/dashboard", permission: "reports:revenue:view" },
        { name: "Báo cáo tài chính", path: "/reports/financial", permission: "reports:revenue:export" },
      ],
    },
    {
      key: "notifications",
      name: "Thông báo",
      path: "/notifications",
      icon: <FiBell size={20} />,
      children: [
        { name: "Thông báo thanh toán", path: "/notifications/payment", permission: "notifications:payment" },
        { name: "Cảnh báo tồn kho thấp", path: "/notifications/stock", permission: "notifications:stock" },
      ],
    },
  ];

  // permission checker
  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === "MANAGER") return true;
      const menu = user.menu || [];
      if (!perm) return true;
      if (menu.includes(perm)) return true;
      // wildcard like "customers:*"
      const [res] = perm.split(":");
      if (menu.some((m) => m === `${res}:*`)) return true;
      // store scoped patterns or ends-with
      if (menu.some((m) => m.endsWith(`:${perm}`))) return true;
      return false;
    },
    [user]
  );

  // Build filtered items (hide store for STAFF)
  const items = useMemo(() => {
    const isStaff = user && user.role === "STAFF";

    return baseItems
      .filter((it) => {
        if (isStaff && it.key === "store") return false;
        if (it.children && it.children.length > 0) {
          return it.children.some((ch) => {
            if (ch.children && ch.children.length > 0) {
              return ch.children.some((sub) => hasPermission(sub.permission));
            }
            return hasPermission(ch.permission);
          });
        }
        return hasPermission(it.permission);
      })
      .map((it) => {
        const copy = { ...it };
        if (copy.children && copy.children.length > 0) {
          copy.children = copy.children
            .map((ch) => {
              if (ch.children && ch.children.length > 0) {
                const nested = { ...ch, children: ch.children.filter((sub) => hasPermission(sub.permission)) };
                return nested.children.length > 0 ? nested : null;
              }
              return hasPermission(ch.permission) ? ch : null;
            })
            .filter(Boolean);
        }
        return copy;
      })
      .filter(Boolean);
  }, [baseItems, hasPermission, user]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sidebar_collapsed", next ? "1" : "0");
      } catch { }
      return next;
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // scroll recompute (same as before)
  const recomputeScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const maxScrollTop = el.scrollHeight - el.clientHeight;
    const currentTop = el.scrollTop;
    setCanScrollDown(currentTop < maxScrollTop - 2);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    recomputeScroll();
    const onScroll = () => recomputeScroll();
    el.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onScroll);
    const mo = new MutationObserver(() => requestAnimationFrame(recomputeScroll));
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mo.disconnect();
    };
  }, [recomputeScroll]);

  // helper: render compact icon-only list (desktop). Use title for tooltip.
  const CompactList = () => (
    <nav className="flex-1 flex flex-col gap-2 overflow-y-auto items-center py-4" aria-label="Sidebar compact">
      {items.map((it) => (
        <div key={it.key} className="w-full flex justify-center">
          <a
            href={it.path}
            title={it.name}
            onClick={(e) => {
              e.preventDefault();
              navigate(it.path);
              setOpenMobile(false);
            }}
            className="w-12 h-12 rounded-lg flex items-center justify-center hover:bg-gray-100 transition"
          >
            <span className="text-gray-700">{it.icon}</span>
          </a>
        </div>
      ))}
    </nav>
  );

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

      {/* Sidebar */}
      <aside
        className={`bg-white h-full shadow-2xl fixed top-0 left-0 z-50 transform transition-all duration-300 ${openMobile ? "translate-x-0 w-72" : collapsed ? "w-20" : "w-64"
          }`}
        aria-hidden={openMobile ? "false" : "true"}
      >
        <div className="flex flex-col h-full">
          {/* header */}
          <div className={`flex items-center justify-between p-4 ${collapsed ? "px-3" : "px-6"}`}>
            {!collapsed ? (
              <>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-extrabold text-green-700 tracking-wide">Smallbiz-Sales</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleCollapse}
                    title={collapsed ? "Mở rộng" : "Thu gọn"}
                    className="p-2 rounded-md hover:bg-gray-100 transition"
                    aria-label="thu gọn"
                  >
                    <FiChevronLeft size={18} />
                  </button>
                  <button className="md:hidden p-2 rounded-md" onClick={() => setOpenMobile(false)}>
                    <FiX size={20} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={toggleCollapse} title="Mở rộng" className="p-2 rounded-md hover:bg-gray-100 transition">
                    <FiChevronRight size={18} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* content */}
          <div className="flex-1 flex relative">
            {/* full mode */}
            {!collapsed && (
              <nav
                ref={navRef}
                className="flex-1 flex flex-col gap-2 overflow-y-auto relative pr-2 px-6 pb-6"
                aria-label="Sidebar navigation"
              >
                {items.map((item) => (
                  <SidebarItem key={item.key} item={item} collapsed={false} />
                ))}
              </nav>
            )}

            {/* compact mode */}
            {collapsed && (
              <div className="flex-1 flex flex-col">
                <CompactList />
              </div>
            )}
          </div>

          {/* footer area */}
          <div className={`p-4 ${collapsed ? "px-2" : "px-6"}`}>
            <div className={`flex ${collapsed ? "justify-center" : "justify-between"} items-center gap-2`}>
              {!collapsed ? (
                <div className="flex-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 bg-[#ffffffa2] text-[black] py-3 rounded-xl hover:bg-[#000000cc] hover:text-white transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <FiLogOut size={18} /> Đăng xuất ({user?.username || "Manager"})
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogout}
                  title={`Đăng xuất (${user?.username || "Manager"})`}
                  className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#ffffffa2] hover:bg-[#000000cc] transition"
                >
                  <FiLogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
