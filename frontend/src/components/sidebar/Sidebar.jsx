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

  // mobile overlay/open state
  const [openMobile, setOpenMobile] = useState(false);

  // NEW: collapsed state for desktop only
  const [collapsed, setCollapsed] = useState(false);

  const navRef = useRef(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

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
        { name: "Nhóm sản phẩm", path: "/product-groups", permission: "products:view" },
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

  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === "MANAGER") return true;
      const menu = user.menu || [];
      if (!perm) return true;
      if (menu.includes(perm)) return true;
      const [resource] = perm.split(":");
      if (menu.some((m) => m === `${resource}:*`)) return true;
      if (menu.some((m) => m.endsWith(`:${perm}`) || m.includes(`:${perm}:`))) return true;
      return false;
    },
    [user]
  );

  const items = useMemo(() => {
    const isStaff = user && user.role === "STAFF";

    return baseItems
      .filter((it) => {
        if (isStaff && it.key === "store") return false;
        if (it.children && it.children.length > 0) {
          const anyChildVisible = it.children.some((ch) => {
            if (ch.children && ch.children.length > 0) {
              return ch.children.some((sub) => hasPermission(sub.permission));
            }
            return hasPermission(ch.permission);
          });
          return anyChildVisible;
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
      .filter((it) => {
        if (it.children && it.children.length === 0 && it.key !== "users" && it.permission === undefined) {
          return false;
        }
        return true;
      });
  }, [baseItems, hasPermission, user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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

  // Recompute when collapsed changes (layout width changed)
  useEffect(() => {
    // give browser a tick to apply layout then recompute
    requestAnimationFrame(recomputeScroll);
  }, [collapsed, recomputeScroll]);

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
        className={`fixed inset-0 bg-black bg-opacity-40 z-40 transition-opacity duration-300 ${
          openMobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpenMobile(false)}
      />

      {/* Sidebar */}
      <aside
        // width changes when collapsed (desktop). On mobile it's full behavior via translate-x
        className={`bg-white h-full shadow-2xl fixed top-0 left-0 z-50 transform transition-all duration-300 ${
          openMobile ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${collapsed ? "w-20" : "w-64"}`}
        aria-hidden={openMobile ? "false" : "true"}
      >
        <div className="p-4 flex flex-col h-full relative">
          <div className="flex items-center justify-between mb-4">
            {/* Brand: if collapsed show small (initials), else full title */}
            <div className="flex items-center gap-2">
              {!collapsed && (
                <h2 className="text-2xl font-extrabold text-green-700 tracking-wide drop-shadow-lg">Smallbiz-Sales</h2>
              )}
            </div>

            {/* Mobile close button */}
            <button className="md:hidden" onClick={() => setOpenMobile(false)} aria-label="Đóng menu">
              <FiX size={24} />
            </button>

            {/* NEW: collapse toggle (desktop only) */}
            {/* NEW: collapse toggle (desktop only) */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={`hidden md:flex items-center justify-center w-10 h-10 p-2 rounded-md 
              transition-all duration-200
              ${collapsed ? "bg-green-100 hover:bg-green-200" : "bg-gray-100 hover:bg-gray-200"} 
              shadow-sm`}
              title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            >
              {collapsed ? (
                <FiChevronRight size={20} className="text-green-700 transition-transform duration-200" />
              ) : (
                <FiChevronLeft size={20} className="text-gray-700 transition-transform duration-200" />
              )}
            </button>
          </div>

          {/* nav */}
          <nav
            ref={navRef}
            className="flex-1 flex flex-col gap-1 overflow-y-auto relative scrollbar-none pr-2"
            aria-label="Sidebar navigation"
          >
            {items.map((item) => (
              <SidebarItem key={item.key} item={item} collapsed={collapsed} />
            ))}
          </nav>

          {/* Nút này cố định với sidebar (nó ko di chuyển với nội dung) - thêm border và BG để đỡ overlap text với text */}
          {canScrollDown && (
            <button
              onClick={handleScrollDownClick}
              aria-label="Xem thêm"
              title="Xem thêm"
              className="absolute left-1/2 transform -translate-x-1/2 bottom-20 z-50 text-black flex items-center justify-center bg-white rounded-full p-3 shadow-xl border border-gray-300 hover:shadow-2xl hover:bg-gray-50 hover:scale-105 transition-all duration-300"
              style={{ touchAction: "manipulation" }}
            >
              <div className="flex flex-col items-center">
                <FiChevronDown size={20} />
                {!collapsed && <span className="text-xs font-medium leading-none -mt-1">Xem thêm</span>}
              </div>
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`mt-4 w-full flex items-center justify-center gap-2 bg-[#ffffffa2] text-[black] py-3 rounded-xl hover:bg-[#000000cc] hover:text-[white] transition-all duration-300 transform hover:scale-105 shadow-lg ${
              collapsed ? "px-1 py-2" : ""
            }`}
          >
            <FiLogOut size={18} /> {!collapsed && `Đăng xuất (${user?.username || "Manager"})`}
          </button>
        </div>
      </aside>
    </>
  );
}
