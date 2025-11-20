// src/pages/NotificationPanel.tsx
import React, { useState, useEffect } from "react";
import { Drawer, Button, Space, Spin, Empty, Dropdown, Menu, Badge } from "antd";
import { CheckOutlined, MoreOutlined, BellOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";

dayjs.extend(relativeTime);
dayjs.locale("vi");

interface Notification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationPanelProps {
  storeId: string;
  visible: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ storeId, visible, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const fetchNotifications = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        storeId,
        limit: "20",
        sort: "-createdAt",
      });
      if (tab === "unread") params.append("read", "false");

      const res = await axios.get(`http://localhost:9999/api/notifications?${params}`, { headers });
      setNotifications(res.data.data);
      setUnreadCount(res.data.meta.totalUnread || res.data.data.filter((n: Notification) => !n.read).length);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Lỗi tải thông báo",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#d33",
        timer: 2000,
        timerProgressBar: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchNotifications();
  }, [visible, storeId, tab]);

  const markAsRead = async (id: string, read: boolean) => {
    try {
      await axios.patch(`http://localhost:9999/api/notifications/${id}/read`, { read }, { headers });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read } : n)));

      setUnreadCount((prev) => {
        const wasUnread = notifications.find((n) => n._id === id)?.read === false;
        const willBeUnread = !read;

        let newCount = prev;
        if (wasUnread && !willBeUnread) newCount -= 1;
        if (!wasUnread && willBeUnread) newCount += 1;

        window.dispatchEvent(new CustomEvent("notifications:updated", { detail: { unreadCount: newCount } }));
        return newCount;
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Lỗi cập nhật trạng thái",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#d33",
        timer: 5000,
        timerProgressBar: true,
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch(`http://localhost:9999/api/notifications/read-all`, {}, { headers });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

      const newCount = 0;
      setUnreadCount(newCount);
      window.dispatchEvent(new CustomEvent("notifications:updated", { detail: { unreadCount: newCount } }));
      Swal.fire({
        icon: "success",
        title: "Thành công",
        text: "Đã đánh dấu tất cả là đã đọc",
        timer: 1000,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Lỗi",
        text: "Lỗi đánh dấu tất cả",
        confirmButtonText: "Đóng",
        confirmButtonColor: "#d33",
        timer: 3000,
        timerProgressBar: true,
      });
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BellOutlined style={{ fontSize: 18, color: "#1890ff" }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>Thông báo</span>
            {unreadCount > 0 && (
              <Badge
                count={unreadCount}
                style={{
                  backgroundColor: "#ff4d4f",
                  boxShadow: "0 0 0 1px #fff",
                }}
              />
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="text"
              size="small"
              onClick={markAllAsRead}
              style={{
                color: "#1890ff",
                fontSize: 13,
                fontWeight: 500,
              }}
              icon={<CheckOutlined />}
            >
              Đánh dấu tất cả là đã đọc
            </Button>
          )}
        </div>
      }
      placement="right"
      width={450}
      onClose={onClose}
      open={visible}
      headerStyle={{
        borderBottom: "1px solid #f0f0f0",
        padding: "16px 20px",
      }}
      bodyStyle={{ padding: 0, background: "#fafafa" }}
      style={{
        borderRadius: "8px 0 0 8px",
      }}
    >
      {/* Tab: Tất cả / Chưa đọc */}
      <div
        style={{
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Space size={8}>
          <Button
            type={tab === "all" ? "primary" : "default"}
            size="middle"
            onClick={() => setTab("all")}
            style={{
              borderRadius: 20,
              fontWeight: 500,
              height: 32,
              ...(tab === "all"
                ? {}
                : {
                    background: "#f5f5f5",
                    border: "none",
                    color: "#595959",
                  }),
            }}
          >
            Tất cả
          </Button>
          <Button
            type={tab === "unread" ? "primary" : "default"}
            size="middle"
            onClick={() => setTab("unread")}
            style={{
              borderRadius: 20,
              fontWeight: 500,
              height: 32,
              ...(tab === "unread"
                ? {}
                : {
                    background: "#f5f5f5",
                    border: "none",
                    color: "#595959",
                  }),
            }}
          >
            Chưa đọc{" "}
            {unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  padding: "0 6px",
                  background: tab === "unread" ? "rgba(255,255,255,0.3)" : "#1890ff",
                  color: tab === "unread" ? "#fff" : "#fff",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {unreadCount}
              </span>
            )}
          </Button>
        </Space>
      </div>

      {/* Danh sách thông báo */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          maxHeight: "calc(100vh - 180px)",
        }}
      >
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 64,
              background: "#fff",
            }}
          >
            <Spin size="large" />
            <div style={{ marginTop: 16, color: "#8c8c8c" }}>Đang tải...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              background: "#fff",
              margin: "12px 0",
              padding: 48,
            }}
          >
            <Empty
              description={
                <span style={{ color: "#8c8c8c" }}>
                  {tab === "unread" ? "Không có thông báo chưa đọc" : "Không có thông báo"}
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {notifications.map((notif) => (
              <div
                key={notif._id}
                onMouseEnter={() => setHoveredId(notif._id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  padding: "14px 20px",
                  marginBottom: 2,
                  background: notif.read ? "#fff" : "#e6f7ff",
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  borderLeft: notif.read ? "3px solid transparent" : "3px solid #1890ff",
                  ...(hoveredId === notif._id && {
                    background: notif.read ? "#fafafa" : "#d6f0ff",
                    transform: "translateX(2px)",
                  }),
                }}
              >
                {/* Icon hoặc Avatar */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: notif.read ? "#f0f0f0" : "#1890ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s ease",
                  }}
                >
                  <BellOutlined
                    style={{
                      fontSize: 18,
                      color: notif.read ? "#8c8c8c" : "#fff",
                    }}
                  />
                </div>

                {/* Nội dung thông báo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: notif.read ? 500 : 600,
                      fontSize: 14,
                      color: notif.read ? "#262626" : "#000",
                      marginBottom: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {notif.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: notif.read ? "#8c8c8c" : "#595959",
                      marginBottom: 6,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {notif.message}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#1890ff",
                      fontWeight: 500,
                    }}
                  >
                    {dayjs(notif.createdAt).fromNow()} • {dayjs(notif.createdAt).format("HH:mm, DD/MM/YYYY")}
                  </div>
                </div>

                {/* Icon 3 chấm */}
                <Dropdown
                  trigger={["click"]}
                  overlay={
                    <Menu
                      style={{
                        borderRadius: 8,
                        boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
                      }}
                    >
                      <Menu.Item
                        key="toggle"
                        onClick={(e: any) => {
                          e.domEvent.stopPropagation();
                          markAsRead(notif._id, !notif.read);
                        }}
                        icon={<CheckOutlined />}
                        style={{ padding: "8px 16px" }}
                      >
                        {notif.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                      </Menu.Item>
                    </Menu>
                  }
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      color: "#8c8c8c",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      background: hoveredId === notif._id ? "#e6e6e6" : "transparent",
                    }}
                  >
                    <MoreOutlined style={{ fontSize: 16 }} />
                  </div>
                </Dropdown>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #f0f0f0",
          background: "#fff",
          textAlign: "center",
        }}
      >
        <Link
          to="/settings/notification"
          style={{
            color: "#1890ff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            display: "inline-block",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#096dd9";
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#1890ff";
            e.currentTarget.style.textDecoration = "none";
          }}
        >
          Xem tất cả thông báo →
        </Link>
      </div>
    </Drawer>
  );
};

export default NotificationPanel;
