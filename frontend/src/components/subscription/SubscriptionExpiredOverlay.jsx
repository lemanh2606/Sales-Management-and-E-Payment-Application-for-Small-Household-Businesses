// components/subscription/SubscriptionExpiredOverlay.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Result } from "antd";
import { WarningOutlined, CrownOutlined } from "@ant-design/icons";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * Component hiển thị overlay mờ màn hình khi STAFF login
 * mà Manager đã hết hạn gói đăng ký
 */
const SubscriptionExpiredOverlay = () => {
  const [visible, setVisible] = useState(false);
  const [subscriptionExpired, setSubscriptionExpired] = useState(false);
  const [checking, setChecking] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen to manager-subscription-expired event from API interceptor
    const handleManagerExpired = (event) => {
      if (user?.role === "STAFF") {
        setSubscriptionExpired(true);
        setVisible(true);
      }
    };

    window.addEventListener("manager-subscription-expired", handleManagerExpired);

    // Also check on mount for STAFF
    if (user?.role === "STAFF" && !checking) {
      checkSubscriptionStatus();
    } else if (user?.role !== "STAFF") {
      // Reset state nếu không phải STAFF
      setSubscriptionExpired(false);
      setVisible(false);
    }

    return () => {
      window.removeEventListener("manager-subscription-expired", handleManagerExpired);
    };
  }, [user]); // Chỉ depend vào user

  const checkSubscriptionStatus = async () => {
    // Chỉ check nếu là STAFF
    if (user?.role !== "STAFF" || checking) {
      return;
    }

    setChecking(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setChecking(false);
        return;
      }

      const response = await fetch("/api/stores/ensure-store", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 403) {
        const data = await response.json();
        
        // Check nếu là lỗi Manager expired
        if (data.manager_expired || data.subscription_status === "EXPIRED" || 
            (data.is_staff && data.upgrade_required)) {
          setSubscriptionExpired(true);
          setVisible(true);
        }
      } else if (response.status === 200) {
        setSubscriptionExpired(false);
        setVisible(false);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Không render gì nếu không phải STAFF hoặc subscription không expired
  if (user?.role !== "STAFF" || !subscriptionExpired) {
    return null;
  }

  return (
    <Modal
      open={visible}
      closable={false}
      footer={null}
      centered
      width={500}
      maskStyle={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
      }}
      style={{ zIndex: 9999 }}
    >
      <Result
        icon={<WarningOutlined style={{ color: "#ff4d4f", fontSize: 72 }} />}
        title={
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 16 }}>
            Gói đăng ký đã hết hạn
          </div>
        }
        subTitle={
          <div style={{ fontSize: 15, color: "#595959", lineHeight: 1.6 }}>
            Chủ cửa hàng của bạn đã hết hạn gói đăng ký.
            <br />
            Vui lòng liên hệ quản lý để gia hạn gói Premium.
          </div>
        }
        extra={[
          <div
            key="info"
            style={{
              marginTop: 20,
              padding: "16px 20px",
              background: "#fff7e6",
              border: "1px solid #ffd591",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CrownOutlined style={{ fontSize: 24, color: "#faad14" }} />
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Hướng dẫn gia hạn
                </div>
                <div style={{ fontSize: 13, color: "#8c8c8c" }}>
                  1. Liên hệ chủ cửa hàng
                  <br />
                  2. Yêu cầu gia hạn gói Premium
                  <br />
                  3. Đăng nhập lại sau khi gia hạn
                </div>
              </div>
            </div>
          </div>,
          <Button
            key="logout"
            danger
            size="large"
            block
            onClick={handleLogout}
            style={{
              height: 48,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Đăng xuất
          </Button>,
        ]}
      />
    </Modal>
  );
};

export default SubscriptionExpiredOverlay;
