// src/components/Layout/Sidebar.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Layout, Menu, Button, Avatar, Space, Drawer, Tooltip, Badge, Divider } from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  DashboardOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  SettingOutlined,
  StarOutlined,
  AppstoreOutlined,
  UserOutlined,
  PoweroffOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const { Sider } = Layout;

export default function Sidebar({ onCollapsedChange }) {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id || null;

  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user: authUser, managerSubscriptionExpired } = useAuth();

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

  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(collapsed);
    }
  }, [collapsed, onCollapsedChange]);

  const checkScroll = useCallback(() => {
    if (menuRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = menuRef.current;
      const isScrollable = scrollHeight > clientHeight;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setShowScrollDown(isScrollable && !isAtBottom);
    }
  }, []);

  useEffect(() => {
    const menuEl = menuRef.current;
    if (menuEl) {
      checkScroll();
      menuEl.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);

      const observer = new MutationObserver(checkScroll);
      observer.observe(menuEl, { childList: true, subtree: true });

      return () => {
        menuEl.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
        observer.disconnect();
      };
    }
  }, [checkScroll, collapsed]);

  const handleScrollDown = () => {
    if (menuRef.current) {
      menuRef.current.scrollBy({ top: 200, behavior: "smooth" });
    }
  };

  const baseItems = useMemo(
    () => [
      {
        key: "store",
        label: "Cửa hàng",
        icon: <ShopOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: `/dashboard/${storeId}`,
            label: <span style={{ fontSize: 13.5 }}> Tổng quan</span>,
            permission: null,
          },
          {
            key: "/select-store",
            label: <span style={{ fontSize: 13.5 }}> Chọn cửa hàng</span>,
            permission: "store:view",
          },
          {
            key: "/update/store",
            label: <span style={{ fontSize: 13.5 }}> Thiết lập</span>,
            permission: "store:update",
          },
        ],
      },
      {
        key: "products",
        label: "Quản lý kho",
        icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/products",
            label: <span style={{ fontSize: 13.5 }}> Danh sách hàng hóa</span>,
            permission: "products:view",
          },
          {
            key: "/products/create",
            label: <span style={{ fontSize: 13.5 }}> Thêm hàng hóa</span>,
            permission: "products:create",
          },
          {
            key: "suppliers",
            label: <span style={{ fontSize: 13.5 }}> Nhà cung cấp</span>,
            children: [
              {
                key: "/suppliers",
                label: <span style={{ fontSize: 13.5 }}> DS nhà cung cấp</span>,
                permission: "supplier:view",
              },
            ],
          },
          {
            key: "/inventory",
            label: <span style={{ fontSize: 13.5 }}> Nhập/Xuất/Hủy</span>,
            permission: "purchase-orders:view",
          },
          {
            key: "/product-groups",
            label: <span style={{ fontSize: 13.5 }}> Nhóm hàng</span>,
            permission: "products:view",
          },
        ],
      },
      {
        key: "orders",
        label: "Đơn hàng",
        icon: <ShoppingCartOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/orders/pos",
            label: <span style={{ fontSize: 13.5 }}> POS - Bán hàng</span>,
            permission: "orders:create",
          },
          {
            key: "/orders/list",
            label: <span style={{ fontSize: 13.5 }}> DS đơn hàng</span>,
            permission: "orders:view",
          },
          {
            key: "/orders/list-pending",
            label: <span style={{ fontSize: 13.5 }}> Đơn chưa hoàn tất</span>,
            permission: "orders:view",
          },
        ],
      },
      {
        key: "customers",
        label: "Khách hàng",
        icon: <TeamOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/customers-list",
            label: <span style={{ fontSize: 13.5 }}> DS khách hàng</span>,
            permission: "customers:search",
          },
          {
            key: "/customers/top-customers",
            label: <span style={{ fontSize: 13.5 }}> Khách VIP</span>,
            permission: "customers:top-customers",
          },
        ],
      },
      {
        key: "employees",
        label: "Nhân viên",
        icon: <UserOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: `/stores/${storeId}/employees`,
            label: <span style={{ fontSize: 13.5 }}>DS nhân viên</span>,
            permission: "employees:view",
          },
          {
            key: `/stores/${storeId}/employees/schedule`,
            label: <span style={{ fontSize: 13.5 }}> Lịch làm việc</span>,
            permission: "employees:assign",
          },
        ],
      },
      {
        key: "loyalty",
        label: "Tích điểm",
        icon: <StarOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/loyalty/config",
            label: <span style={{ fontSize: 13.5 }}> Cấu hình</span>,
            permission: "loyalty:manage",
          },
        ],
      },
      {
        key: "reports",
        label: "Báo cáo",
        icon: <DashboardOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/reports/dashboard",
            label: <span style={{ fontSize: 13.5 }}> Tổng quan</span>,
            permission: "reports:financial:view",
          },
          {
            key: "/reports/revenue",
            label: <span style={{ fontSize: 13.5 }}> Doanh thu chi tiết</span>,
            permission: "reports:revenue:view",
          },
          {
            key: "/reports/tax",
            label: <span style={{ fontSize: 13.5 }}> Kê khai thuế</span>,
            permission: "tax:preview",
          },
          {
            key: "/reports/top-products",
            label: <span style={{ fontSize: 13.5 }}> SP bán chạy</span>,
            permission: "reports:top-products",
          },
        ],
      },
      {
        key: "settings",
        label: "Cấu hình",
        icon: <SettingOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/settings/activity-log",
            label: <span style={{ fontSize: 13.5 }}> Nhật ký hoạt động</span>,
            permission: "settings:activity-log",
          },
          {
            key: "/settings/payment-method",
            label: <span style={{ fontSize: 13.5 }}> Thanh toán</span>,
            permission: "settings:payment-method",
          },
          {
            key: "/settings/profile",
            label: <span style={{ fontSize: 13.5 }}> Hồ sơ cá nhân</span>,
            permission: "users:view",
          },
          {
            key: "/settings/notification",
            label: <span style={{ fontSize: 13.5 }}> Thông báo</span>,
            permission: "notifications:view",
          },
          {
            key: "subscription",
            label: <span style={{ fontSize: 13.5 }}>Gói dịch vụ</span>,
            permission: "subscription:view",
            children: [
              {
                key: "/settings/subscription",
                label: <span style={{ fontSize: 13.5 }}> Gói hiện tại</span>,
                permission: "subscription:view",
              },
              {
                key: "/settings/subscription/pricing",
                label: <span style={{ fontSize: 13.5 }}>Nâng cấp Premium</span>,
                permission: "subscription:view",
              },
            ],
          },
          {
            key: "/settings/file",

            label: <span style={{ fontSize: 13.5 }}> Quản lý file</span>,
            permission: "file:view",
          },
        ],
      },
    ],
    [storeId]
  );

  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === "MANAGER") return true;
      const menu = user.menu || [];
      if (!perm) return true;
      if (menu.includes(perm)) return true;
      const [resource] = perm.split(":");
      if (menu.some((m) => m === `${resource}:*`)) return true;
      return false;
    },
    [user]
  );

  const filterMenuItems = useCallback(
    (items) => {
      return items
        .map((item) => {
          if (item.children) {
            const filteredChildren = filterMenuItems(item.children);
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          return hasPermission(item.permission) ? item : null;
        })
        .filter(Boolean);
    },
    [hasPermission]
  );

  const menuItems = useMemo(() => {
    const isStaff = user && user.role === "STAFF";
    const isManagerExpired = user && user.role === "MANAGER" && managerSubscriptionExpired;

    if (isManagerExpired) {
      const settingsItem = baseItems.find((it) => it.key === "settings");
      if (settingsItem) {
        return filterMenuItems([
          {
            ...settingsItem,
            children: settingsItem.children.filter((ch) =>
              ["/settings/activity-log", "/settings/profile", "subscription"].includes(ch.key)
            ),
          },
        ]);
      }
      return [];
    }

    let filtered = baseItems;
    if (isStaff) {
      filtered = filtered.filter((it) => it.key !== "store");
    }

    return filterMenuItems(filtered);
  }, [baseItems, filterMenuItems, user, managerSubscriptionExpired]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (openMobile) {
      setOpenMobile(false);
    }
  };

  const handleToggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const selectedKeys = [location.pathname];
  const openKeys = useMemo(() => {
    const keys = [];
    menuItems.forEach((item) => {
      if (item.children) {
        const hasSelected = item.children.some((ch) => {
          if (ch.children) {
            return ch.children.some((sub) => sub.key === location.pathname);
          }
          return ch.key === location.pathname;
        });
        if (hasSelected) {
          keys.push(item.key);
          item.children.forEach((ch) => {
            if (ch.children && ch.children.some((sub) => sub.key === location.pathname)) {
              keys.push(ch.key);
            }
          });
        }
      }
    });
    return keys;
  }, [menuItems, location.pathname]);

  const siderContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Header */}
      <div
        style={{
          padding: collapsed ? "16px" : "20px 20px 16px",
          background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
          }}
        />

        <Space direction="vertical" size={12} style={{ width: "100%", position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: collapsed ? "center" : "space-between",
            }}
          >
            <Space size={10}>
              <Badge dot status="success" offset={[-4, 32]}>
                {/* Avatar từ user.image hoặc icon default */}
                <Avatar
                  size={collapsed ? 42 : 48}
                  src={user?.image}
                  icon={!user?.image && <UserOutlined />}
                  style={{
                    background: user?.image ? "transparent" : "rgba(255, 255, 255, 0.25)",
                    border: "3px solid rgba(255, 255, 255, 0.5)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                />
              </Badge>

              {!collapsed && (
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>Smallbiz Sales</div>
                  <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 500 }}>Quản lý bán hàng</div>
                </div>
              )}
            </Space>

            {/* Nút thu gọn - màu trắng với icon xanh lá */}
            {!collapsed && (
              <Tooltip title="Thu gọn" placement="bottom">
                <Button
                  type="text"
                  icon={<DoubleLeftOutlined style={{ color: "#52c41a", fontSize: 18 }} />}
                  onClick={handleToggleCollapse}
                  style={{
                    background: "#fff",
                    border: "none",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                  className="header-collapse-btn"
                />
              </Tooltip>
            )}
          </div>

          {!collapsed && user && (
            <div
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <div style={{ color: "#fff", fontSize: 11, marginBottom: 2, opacity: 0.85 }}>👋 Xin chào,</div>
              {/* Hiển thị fullname hoặc username */}
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {user.fullname || user.username || user.name || "User"}
              </div>
            </div>
          )}

          {collapsed && (
            <Tooltip title="Mở rộng" placement="right">
              <Button
                type="text"
                icon={<DoubleRightOutlined style={{ color: "#52c41a", fontSize: 18 }} />}
                onClick={handleToggleCollapse}
                style={{
                  background: "#fff",
                  border: "none",
                  width: "100%",
                  height: 36,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
                className="header-collapse-btn"
              />
            </Tooltip>
          )}
        </Space>
      </div>

      <Divider style={{ margin: 0, borderColor: "#e8e8e8" }} />

      {/* Menu */}
      <div
        ref={menuRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 0",
          position: "relative",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="menu-container"
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: "none", fontSize: 14 }}
          theme="light"
          inlineCollapsed={collapsed}
        />
      </div>

      {/* Scroll Down Arrow */}
      {showScrollDown && (
        <div
          style={{
            position: "absolute",
            bottom: 88,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}
        >
          <Button
            type="primary"
            shape="circle"
            icon={<DownOutlined />}
            onClick={handleScrollDown}
            size="small"
            style={{
              background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
              border: "none",
              boxShadow: "0 4px 12px rgba(82, 196, 26, 0.5)",
              animation: "bounce 2s infinite",
            }}
          />
        </div>
      )}

      {/* Footer - Logout */}
      <div
        style={{
          padding: collapsed ? "12px 8px" : "14px 14px",
          borderTop: "2px solid #e8e8e8",
          background: "linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)",
        }}
      >
        <Tooltip title={collapsed ? "Đăng xuất" : ""} placement="right">
          <Button
            type="primary"
            danger
            block
            icon={<PoweroffOutlined style={{ fontSize: 19 }} />}
            onClick={handleLogout}
            style={{
              height: collapsed ? 48 : 54,
              fontWeight: 700,
              fontSize: 15,
              background: "linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)",
              border: "none",
              boxShadow: "0 6px 16px rgba(255, 77, 79, 0.4)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              position: "relative",
              overflow: "hidden",
            }}
            className="logout-btn"
          >
            {!collapsed && <span>Đăng xuất</span>}
          </Button>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <>
      <Button
        type="primary"
        size="large"
        icon={<MenuUnfoldOutlined />}
        onClick={() => setOpenMobile(true)}
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 999,
          display: "none",
          background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
          border: "none",
          boxShadow: "0 4px 12px rgba(82, 196, 26, 0.4)",
          borderRadius: 12,
          height: 52,
          width: 52,
        }}
        className="mobile-menu-btn"
      />

      <Sider
        collapsed={collapsed}
        width={280}
        collapsedWidth={76}
        style={{
          height: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: "4px 0 24px rgba(0,0,0,0.08)",
          zIndex: 1000,
          background: "#fff",
        }}
        className="desktop-sidebar"
        trigger={null}
      >
        {siderContent}
      </Sider>

      <Drawer
        title={
          <Space>
            <Avatar size={36} src={user?.image} icon={!user?.image && <UserOutlined />} style={{ background: user?.image ? "transparent" : "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Smallbiz Sales</div>
              <div style={{ fontSize: 12, color: "#8c8c8c" }}>Quản lý bán hàng</div>
            </div>
          </Space>
        }
        placement="left"
        onClose={() => setOpenMobile(false)}
        open={openMobile}
        width={300}
        styles={{ body: { padding: 0 } }}
        className="mobile-drawer"
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            defaultOpenKeys={openKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: "none", flex: 1, overflowY: "auto", padding: "12px 0" }}
          />

          <div style={{ padding: 14, borderTop: "2px solid #e8e8e8", background: "#fafafa" }}>
            <Button
              type="primary"
              danger
              block
              icon={<PoweroffOutlined style={{ fontSize: 19 }} />}
              onClick={handleLogout}
              style={{
                height: 54,
                fontWeight: 700,
                fontSize: 15,
                background: "linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)",
                border: "none",
                borderRadius: 12,
              }}
            >
              <span>Đăng xuất</span>
            </Button>
          </div>
        </div>
      </Drawer>

      <style jsx global>{`
  @media (max-width: 768px) {
    .desktop-sidebar {
      display: none !important;
    }
    .mobile-menu-btn {
      display: flex !important;
    }
  }

  @media (min-width: 769px) {
    .mobile-drawer {
      display: none !important;
    }
    .mobile-menu-btn {
      display: none !important;
    }
  }

  .menu-container::-webkit-scrollbar {
    display: none;
  }

  .ant-menu-item,
  .ant-menu-submenu-title {
    border-radius: 10px !important;
    margin: 3px 10px !important;
    padding: 8px 14px !important;
    height: auto !important;
    line-height: 1.4 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  /* Hover state - màu nhẹ nhàng */
  .ant-menu-item:hover,
  .ant-menu-submenu-title:hover {
    background: linear-gradient(90deg, #f6ffed 0%, #fafffe 100%) !important;
    color: #389e0d !important;
    transform: translateX(3px);
    border-left: 3px solid #52c41a;
    padding-left: 11px !important;
  }

  /* Selected state - xanh nhạt tinh tế */
  .ant-menu-item-selected {
    background: linear-gradient(135deg, #f6ffed 0%, #e6ffe6 100%) !important;
    color: #237804 !important;
    font-weight: 600 !important;
    border-left: 4px solid #52c41a !important;
    padding-left: 10px !important;
    box-shadow: 0 2px 8px rgba(82, 196, 26, 0.15) !important;
  }

  .ant-menu-item-selected .ant-menu-item-icon,
  .ant-menu-item-selected span {
    color: #237804 !important;
  }

  /* Submenu items */
  .ant-menu-sub .ant-menu-item {
    padding-left: 40px !important;
  }

  .ant-menu-sub .ant-menu-item:hover {
    padding-left: 37px !important;
  }

  .ant-menu-sub .ant-menu-item-selected {
    padding-left: 36px !important;
  }

  /* Submenu title hover */
  .ant-menu-submenu-title:hover .ant-menu-submenu-arrow {
    color: #52c41a !important;
  }

  /* Active submenu */
  .ant-menu-submenu-open > .ant-menu-submenu-title {
    color: #52c41a !important;
    font-weight: 600;
  }

  .header-collapse-btn:hover {
    background: #f0f0f0 !important;
    transform: scale(1.08);
  }

  .logout-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transition: left 0.6s;
  }

  .logout-btn:hover::before {
    left: 100%;
  }

  .logout-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 77, 79, 0.5) !important;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
`}</style>

    </>
  );
}
