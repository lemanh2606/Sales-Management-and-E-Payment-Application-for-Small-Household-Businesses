// components/sidebar/TrialBanner.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, Clock, ArrowRight } from "lucide-react";
import subscriptionApi from "../../api/subscriptionApi";

const TrialBanner = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      // Check if user dismissed banner in this session
      const dismissedInSession = sessionStorage.getItem("trialBannerDismissed");
      if (dismissedInSession === "true") {
        setDismissed(true);
        return;
      }

      const response = await subscriptionApi.getCurrentSubscription();
      const sub = response.data;

      // Hiện banner nếu:
      // 1. User đang dùng TRIAL
      // 2. User EXPIRED (để nhắc gia hạn)
      if (sub && (sub.status === "TRIAL" || sub.status === "EXPIRED")) {
        setSubscription(sub);
        setVisible(true);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("trialBannerDismissed", "true");
  };

  const handleUpgrade = () => {
    navigate("/settings/subscription/pricing");
    handleDismiss();
  };

  if (!visible || dismissed || !subscription) {
    return null;
  }

  const isTrial = subscription.status === "TRIAL";
  const isExpired = subscription.status === "EXPIRED";
  const daysRemaining = subscription.days_remaining || 0;

  return (
    <div
      style={{
        background: isTrial
          ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        color: "white",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        position: "relative",
        zIndex: 1000,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
        <Sparkles size={24} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>
            {isTrial ? (
              <>
                🎁 Bạn đang dùng thử miễn phí - Còn <strong>{daysRemaining} ngày</strong>
              </>
            ) : (
              <>
                ⏰ Gói Premium đã hết hạn
              </>
            )}
          </div>
          <div style={{ fontSize: "13px", opacity: 0.95 }}>
            {isTrial
              ? "Nâng cấp ngay để không bị gián đoạn dịch vụ!"
              : "Gia hạn ngay để tiếp tục sử dụng tính năng Premium"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button
          onClick={handleUpgrade}
          style={{
            background: "rgba(255,255,255,0.95)",
            color: isTrial ? "#764ba2" : "#f5576c",
            border: "none",
            padding: "8px 20px",
            borderRadius: "6px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = "translateY(-1px)";
            e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
          }}
        >
          {isTrial ? "Nâng cấp Premium" : "Gia hạn ngay"}
          <ArrowRight size={16} />
        </button>

        <button
          onClick={handleDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            opacity: 0.8,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = 1)}
          onMouseLeave={(e) => (e.target.style.opacity = 0.8)}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default TrialBanner;
