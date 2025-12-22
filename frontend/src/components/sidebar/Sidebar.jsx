// src/components/Layout/Sidebar.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Layout, Menu, Button, Avatar, Space, Drawer, Tooltip, Badge, Divider } from "antd";
import {
  MenuUnfoldOutlined,
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
            label: <span style={{ fontSize: 13.5 }}>Tổng quan</span>,
            permission: null,
          },
          {
            key: "/select-store",
            label: <span style={{ fontSize: 13.5 }}> Chọn cửa hàng khác</span>,
            permission: "store:view",
          },
          {
            key: "/update/store",
            label: <span style={{ fontSize: 13.5 }}> Thiết lập cửa hàng</span>,
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
            key: "/inventory-vouchers",
            label: <span style={{ fontSize: 13.5 }}>Phiếu nhập/xuất kho</span>,
            permission: "inventory:voucher:view",
          },
          {
            key: "/products",
            label: <span style={{ fontSize: 13.5 }}>Danh sách hàng hóa</span>,
            permission: "products:view",
          },
          {
            key: "/suppliers",
            label: <span style={{ fontSize: 13.5 }}>Nhà cung cấp</span>,
            permission: "supplier:view",
          },
          {
            key: "/product-groups",
            label: <span style={{ fontSize: 13.5 }}>Nhóm hàng hoá</span>,
            permission: "products:view",
          },
        ],
      },
      {
        key: "orders",
        label: "Đơn hàng/Bán hàng",
        icon: <ShoppingCartOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/orders/pos",
            label: <span style={{ fontSize: 13.5 }}>POS - Bán hàng</span>,
            permission: "orders:create",
          },
          {
            key: "/orders/list",
            label: <span style={{ fontSize: 13.5 }}> Danh sách đơn hàng</span>,
            permission: "orders:view",
          },
          // {
          //   key: "/orders/reconciliation",
          //   label: <span style={{ fontSize: 13.5 }}>Đối soát hóa đơn</span>,
          //   permission: "orders:view",
          // },
        ],
      },
      {
        key: "customers",
        label: "Khách hàng",
        icon: <TeamOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/customers-list",
            label: <span style={{ fontSize: 13.5 }}>Danh sách khách hàng</span>,
            permission: "customers:search",
          },
          {
            key: "/customers/top-customers",
            label: <span style={{ fontSize: 13.5 }}>Khách VIP</span>,
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
            label: <span style={{ fontSize: 13.5 }}>Danh sách nhân viên</span>,
            permission: "employees:view",
          },
          // {
          //   key: `/stores/${storeId}/employees/schedule`,
          //   label: <span style={{ fontSize: 13.5 }}>Lịch làm việc</span>,
          //   permission: "employees:assign",
          // },
        ],
      },
      {
        key: "loyalty",
        label: "Tích điểm",
        icon: <StarOutlined style={{ fontSize: 18 }} />,
        children: [
          {
            key: "/loyalty/config",
            label: <span style={{ fontSize: 13.5 }}>Cấu hình tích điểm</span>,
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
            label: <span style={{ fontSize: 13.5 }}>Báo cáo tổng quan</span>,
            permission: "reports:financial:view",
          },
          {
            key: "/reports/revenue",
            label: <span style={{ fontSize: 13.5 }}>Báo cáo doanh thu chi tiết</span>,
            permission: "reports:revenue:view",
          },
          {
            key: "/reports/inventory-reports",
            label: <span style={{ fontSize: 13.5 }}>Báo cáo tồn kho</span>,
            permission: "inventory:stock-check:view",
          },
          // {
          //   key: "/reports/tax",
          //   label: <span style={{ fontSize: 13.5 }}>Kê khai thuế</span>,
          //   permission: "tax:preview",
          // },
          {
            key: "/reports/top-products",
            label: <span style={{ fontSize: 13.5 }}>Top sản phẩm bán chạy</span>,
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
            key: "subscription",
            label: <span style={{ fontSize: 13.5 }}>Gói dịch vụ</span>,
            permission: "subscription:view",
            children: [
              {
                key: "/settings/subscription",
                label: <span style={{ fontSize: 13.5 }}>Gói hiện tại</span>,
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
            key: "/settings/activity-log",
            label: <span style={{ fontSize: 13.5 }}>Nhật ký hoạt động</span>,
            permission: "settings:activity-log",
          },
          {
            key: "/settings/payment-method",
            label: <span style={{ fontSize: 13.5 }}>Thiết lập cổng thanh toán</span>,
            permission: "settings:payment-method",
          },
          {
            key: "/settings/profile",
            label: <span style={{ fontSize: 13.5 }}>Hồ sơ cá nhân</span>,
            permission: "users:view",
          },
          {
            key: "/settings/notification",
            label: <span style={{ fontSize: 13.5 }}>Thông báo</span>,
            permission: "notifications:view",
          },
          {
            key: "/settings/export-data",
            label: <span style={{ fontSize: 13.5 }}>Xuất dữ liệu</span>,
            permission: "data:export",
          },
          {
            key: "/settings/file",
            label: <span style={{ fontSize: 13.5 }}>Quản lý file</span>,
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
          if (user?.role === "STAFF" && item.key === "/orders/reconciliation") {
            return null;
          }
          if (item.children) {
            const filteredChildren = filterMenuItems(item.children);
            if (filteredChildren.length === 0) return null;
            return { ...item, children: filteredChildren };
          }
          return hasPermission(item.permission) ? item : null;
        })
        .filter(Boolean);
    },
    [hasPermission, user?.role]
  );

  const menuItems = useMemo(() => {
    const isStaff = user && user.role === "STAFF";
    const isManagerExpired = user && user.role === "MANAGER" && managerSubscriptionExpired;

    if (isManagerExpired) {
      const allowedItems = [];
      const storeItem = baseItems.find((it) => it.key === "store");
      const settingsItem = baseItems.find((it) => it.key === "settings");

      if (storeItem) {
        allowedItems.push(storeItem);
      }

      if (settingsItem) {
        allowedItems.push({
          ...settingsItem,
          children: settingsItem.children.filter((ch) =>
            ["/settings/activity-log", "/settings/profile", "subscription", "/settings/export-data"].includes(ch.key)
          ),
        });
      }

      return filterMenuItems(allowedItems);
    }

    return filterMenuItems(baseItems);
  }, [baseItems, filterMenuItems, user, managerSubscriptionExpired]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleMenuClick = ({ key }) => {
    if (key === "/orders/pos") {
      // Mở POS trong tab mới, mấy cái khác render bình thường ko ảnh hưởng
      window.open(key, "_blank", "noopener,noreferrer");
    } else {
      navigate(key);
    }

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
      {/* Header - Glassmorphism */}
      <div
        style={{
          padding: collapsed ? "16px" : "20px 18px 16px",
          background: "linear-gradient(135deg, rgba(82, 196, 26, 0.95) 0%, rgba(115, 209, 61, 0.95) 100%)",
          backdropFilter: "blur(12px)",
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -20,
            left: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
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
              <Badge dot status="success" offset={[-4, 36]}>
                <Avatar
                  size={collapsed ? 44 : 52}
                  src={currentStore?.imageUrl} // dùng avatar store
                  icon={!currentStore?.imageUrl && <ShopOutlined />} // fallback icon cho store
                  style={{
                    background: user?.image ? "transparent" : "rgba(255, 255, 255, 0.28)",
                    border: "3px solid rgba(255, 255, 255, 0.6)",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
                  }}
                />
              </Badge>

              {!collapsed && (
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.3, letterSpacing: 0.3 }}>
                    Smallbiz Sales
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.92)", fontSize: 12.5, fontWeight: 500, marginTop: 2 }}>
                    Quản lý bán hàng
                  </div>
                </div>
              )}
            </Space>

            {!collapsed && (
              <Tooltip title="Thu gọn" placement="bottom">
                <Button
                  type="text"
                  icon={<DoubleLeftOutlined style={{ color: "#52c41a", fontSize: 18 }} />}
                  onClick={handleToggleCollapse}
                  style={{
                    background: "#fff",
                    border: "none",
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                  }}
                  className="header-collapse-btn"
                />
              </Tooltip>
            )}
          </div>

          {!collapsed && user && (
            <div
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                padding: "11px 13px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.28)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ color: "#fff", fontSize: 11, marginBottom: 3, opacity: 0.88 }}>👋 Xin chào,</div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }}>
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
                  height: 38,
                  borderRadius: 10,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
                }}
                className="header-collapse-btn"
              />
            </Tooltip>
          )}
        </Space>
      </div>

      <Divider style={{ margin: 0, borderColor: "#f0f0f0" }} />

      {/* Menu */}
      <div
        ref={menuRef}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "14px 0",
          position: "relative",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          background: "#fafafa",
        }}
        className="menu-container"
      >
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ border: "none", fontSize: 14, background: "transparent" }}
          theme="light"
          inlineCollapsed={collapsed}
        />
      </div>

      {/* Scroll Down Arrow */}
      {showScrollDown && (
        <div
          style={{
            position: "absolute",
            bottom: 92,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            pointerEvents: "none",
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
              boxShadow: "0 6px 16px rgba(82, 196, 26, 0.45)",
              animation: "bounce 2s infinite",
              pointerEvents: "auto",
            }}
          />
        </div>
      )}

      {/* Footer - Logout */}
      <div
        style={{
          padding: collapsed ? "14px 10px" : "16px 16px",
          borderTop: "2px solid #f0f0f0",
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
              height: collapsed ? 50 : 56,
              fontWeight: 700,
              fontSize: 15.5,
              background: "linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)",
              border: "none",
              boxShadow: "0 6px 18px rgba(255, 77, 79, 0.38)",
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
          boxShadow: "0 6px 16px rgba(82, 196, 26, 0.4)",
          borderRadius: 12,
          height: 54,
          width: 54,
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
          boxShadow: "6px 0 28px rgba(0,0,0,0.08)",
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
            <Avatar
              size={38}
              src={currentStore?.image}
              icon={!currentStore?.image && <ShopOutlined />}
              style={{
                background: user?.image ? "transparent" : "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                border: "2px solid #f0f0f0",
              }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16.5 }}>Smallbiz Sales</div>
              <div style={{ fontSize: 12.5, color: "#8c8c8c" }}>Quản lý bán hàng</div>
            </div>
          </Space>
        }
        placement="left"
        onClose={() => setOpenMobile(false)}
        open={openMobile}
        width={300}
        styles={{ body: { padding: 0, background: "#fafafa" } }}
        className="mobile-drawer"
      >
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            defaultOpenKeys={openKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: "none", flex: 1, overflowY: "auto", padding: "14px 0", background: "transparent" }}
          />

          <div style={{ padding: 16, borderTop: "2px solid #f0f0f0", background: "#fff" }}>
            <Button
              type="primary"
              danger
              block
              icon={<PoweroffOutlined style={{ fontSize: 19 }} />}
              onClick={handleLogout}
              style={{
                height: 56,
                fontWeight: 700,
                fontSize: 15.5,
                background: "linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)",
                border: "none",
                borderRadius: 12,
                boxShadow: "0 6px 18px rgba(255, 77, 79, 0.38)",
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

        /* Menu item styling - mềm mại hơn */
        .ant-menu-item,
        .ant-menu-submenu-title {
          border-radius: 11px !important;
          margin: 4px 12px !important;
          padding: 10px 16px !important;
          height: auto !important;
          line-height: 1.5 !important;
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
          font-weight: 500 !important;
        }

        /* Hover - gradient xanh nhạt tinh tế */
        .ant-menu-item:hover,
        .ant-menu-submenu-title:hover {
          background: linear-gradient(90deg, #f6ffed 0%, #fcfffe 100%) !important;
          color: #389e0d !important;
          transform: translateX(4px);
          border-left: 3px solid #73d13d;
          padding-left: 13px !important;
          box-shadow: 0 2px 8px rgba(82, 196, 26, 0.08) !important;
        }

        /* Selected - xanh pastel mềm mại */
        .ant-menu-item-selected {
          background: linear-gradient(135deg, #f0ffe6 0%, #e8f9e0 100%) !important;
          color: #237804 !important;
          font-weight: 700 !important;
          border-left: 4px solid #52c41a !important;
          padding-left: 12px !important;
          box-shadow: 0 3px 12px rgba(82, 196, 26, 0.18) !important;
        }

        .ant-menu-item-selected .ant-menu-item-icon,
        .ant-menu-item-selected span {
          color: #237804 !important;
        }

        /* Submenu items - tree line mềm */
        .ant-menu-sub .ant-menu-item {
          padding-left: 42px !important;
        }

        .ant-menu-sub .ant-menu-item:hover {
          padding-left: 39px !important;
        }

        .ant-menu-sub .ant-menu-item-selected {
          padding-left: 38px !important;
        }

        .ant-menu-submenu-title:hover .ant-menu-submenu-arrow {
          color: #52c41a !important;
        }

        .ant-menu-submenu-open > .ant-menu-submenu-title {
          color: #52c41a !important;
          font-weight: 700;
          background: rgba(82, 196, 26, 0.04) !important;
        }

        .header-collapse-btn:hover {
          background: rgba(0, 0, 0, 0.05) !important;
          transform: scale(1.08);
        }

        .logout-btn::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
          transition: left 0.65s;
        }

        .logout-btn:hover::before {
          left: 100%;
        }

        .logout-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(255, 77, 79, 0.48) !important;
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

        /* Tree-line effect - thanh lịch hơn */
        .menu-container .ant-menu-submenu .ant-menu {
          position: relative;
          margin-left: 16px;
          border-left: 2px solid #e8f9e0;
          padding-left: 10px;
        }

        .menu-container .ant-menu-item::before {
          content: "";
          position: absolute;
          left: -16px;
          top: 50%;
          width: 16px;
          border-bottom: 2px solid #e8f9e0;
          border-radius: 0 0 0 4px;
        }

        .menu-container .ant-menu-item {
          position: relative;
          padding-left: 32px !important;
        }

        .menu-container .ant-menu-item:hover::before {
          border-color: #b7eb8f;
        }

        .menu-container .ant-menu-item-selected::before {
          border-color: #73d13d;
          border-width: 2px;
        }

        .menu-container .ant-menu-submenu .ant-menu-submenu .ant-menu {
          margin-left: 18px;
          border-left: 2px dashed #d9f7be;
        }

        .ant-menu-inline-collapsed .ant-menu-submenu .ant-menu,
        .ant-menu-inline-collapsed .ant-menu-item::before {
          border: none !important;
          content: none !important;
        }

        /* Smooth transitions for all interactive elements */
        .ant-menu-item,
        .ant-menu-submenu-title,
        .ant-btn {
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `}</style>
    </>
  );
}
