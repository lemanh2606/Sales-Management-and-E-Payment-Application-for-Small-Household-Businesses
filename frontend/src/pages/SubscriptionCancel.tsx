// frontend/src/pages/SubscriptionCancel.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Result, Button, Space, Typography, Progress } from "antd";
import {
  CloseCircleOutlined,
  HomeOutlined,
  CreditCardOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import subscriptionApi from "../api/subscriptionApi";

const { Text, Title } = Typography;

const SubscriptionCancel = () => {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const orderCode = params.get("orderCode") || "";

  // Thời gian đếm ngược
  const TOTAL_COUNTDOWN = 30;
  const [countdown, setCountdown] = useState(TOTAL_COUNTDOWN);

  // Dùng Ref để kiểm soát việc gọi API chỉ 1 lần (tránh React StrictMode gọi 2 lần)
  const hasCalledApiRef = useRef(false);

  //  HÀM QUAN TRỌNG: Gửi tín hiệu Deep Link để App React Native bắt được
  const signalAppToClose = () => {
    console.log("🚀 Gửi tín hiệu đóng cho App: posapp://cancel-done");

    // App sẽ bắt URL này trong onShouldStartLoadWithRequest và đóng WebView
    window.location.href = `posapp://cancel-done?orderCode=${orderCode}`;
  };

  //  Xử lý hủy thanh toán (Gọi Backend)
  const handleCancelPayment = async () => {
    try {
      console.log("⏳ Đang gọi API clearPendingPayment...");
      await subscriptionApi.clearPendingPayment();
      console.log(" Đã hủy pending payment thành công.");
    } catch (error) {
      console.error(" Lỗi khi hủy thanh toán:", error);
    }
  };

  //  Hàm điều hướng chung (Xử lý cả Web và App)
  const handleNavigateAway = async (destination: "subscription" | "home") => {
    // 1. Đảm bảo API đã được gọi (phòng trường hợp người dùng bấm nhanh quá)
    if (!hasCalledApiRef.current) {
      hasCalledApiRef.current = true;
      await handleCancelPayment();
    }

    // 2. Ưu tiên: Bắn tín hiệu cho App React Native
    signalAppToClose();

    // 3. Fallback: Nếu sau 300ms mà App không chặn URL trên (tức là đang chạy trên Web Browser)
    // thì thực hiện điều hướng Router bình thường.
    setTimeout(() => {
      if (destination === "subscription") {
        navigate("/settings/subscription");
      } else {
        // Logic lấy storeId cũ của bạn
        const currentStore = localStorage.getItem("currentStore");
        let storeId: string | undefined;
        if (currentStore) {
          try {
            storeId = JSON.parse(currentStore)?._id;
          } catch (e) {
            console.error(e);
          }
        }
        navigate(storeId ? `/dashboard/${storeId}` : "/dashboard");
      }
    }, 300);
  };

  //  Lifecycle 1: Gọi API ngay khi trang vừa load
  useEffect(() => {
    if (!hasCalledApiRef.current) {
      hasCalledApiRef.current = true;
      handleCancelPayment();
    }
  }, []);

  //  Lifecycle 2: Xử lý đếm ngược
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Hết giờ -> Tự động quay về Subscription
          handleNavigateAway("subscription");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Card
        style={{
          maxWidth: 600,
          width: "100%",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
        bodyStyle={{ padding: 48 }}
      >
        <Result
          icon={
            <CloseCircleOutlined
              style={{
                fontSize: 72,
                color: "#ff4d4f",
              }}
            />
          }
          status="error"
          title={
            <Title
              level={2}
              style={{ marginTop: 24, marginBottom: 8, color: "#ff4d4f" }}
            >
              Thanh toán đã bị huỷ
            </Title>
          }
          subTitle={
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Text style={{ fontSize: 16, color: "#595959" }}>
                Giao dịch của bạn đã bị huỷ. Không có khoản phí nào được thu.
              </Text>

              {orderCode && (
                <Card
                  style={{
                    marginTop: 24,
                    background: "#fff1f0",
                    borderColor: "#ffccc7",
                    borderRadius: 12,
                  }}
                  bodyStyle={{ padding: 20 }}
                >
                  <Space
                    direction="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <Space>
                      <CreditCardOutlined
                        style={{ fontSize: 18, color: "#ff4d4f" }}
                      />
                      <Text strong style={{ fontSize: 14 }}>
                        Mã đơn hàng đã huỷ:
                      </Text>
                    </Space>
                    <Text
                      code
                      copyable
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        display: "block",
                        marginTop: 8,
                        color: "#cf1322",
                      }}
                    >
                      {orderCode}
                    </Text>
                  </Space>
                </Card>
              )}

              <Card
                style={{
                  marginTop: 16,
                  background: "#e6f7ff",
                  borderColor: "#91d5ff",
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Space>
                  <InfoCircleOutlined
                    style={{ fontSize: 16, color: "#1890ff" }}
                  />
                  <Text style={{ fontSize: 13, color: "#096dd9" }}>
                    <strong>Bạn có thể:</strong> Quay lại và chọn gói dịch vụ
                    khác hoặc thử thanh toán lại.
                  </Text>
                </Space>
              </Card>

              {/* 🔥 Countdown 30 giây */}
              <Card
                style={{
                  marginTop: 16,
                  background: "#f5f5f5",
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 16 }}
              >
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  <Text style={{ fontSize: 14, color: "#595959" }}>
                    Tự động chuyển hướng trong{" "}
                    <span
                      style={{
                        color: "#1890ff",
                        fontWeight: 600,
                        fontSize: 16,
                      }}
                    >
                      {countdown}
                    </span>{" "}
                    giây...
                  </Text>

                  <Progress
                    percent={
                      ((TOTAL_COUNTDOWN - countdown) / TOTAL_COUNTDOWN) * 100
                    }
                    strokeColor={{
                      "0%": "#ff4d4f",
                      "100%": "#ffa940",
                    }}
                    showInfo={false}
                    style={{ marginTop: 8 }}
                  />
                </Space>
              </Card>

              {/* Thông báo môi trường (debug) */}
              {import.meta.env.DEV && (
                <Text
                  type="secondary"
                  style={{
                    fontSize: 12,
                    textAlign: "center",
                    display: "block",
                    marginTop: 10,
                  }}
                >
                  Môi trường:{" "}
                  {window.navigator.userAgent.includes("wv")
                    ? "WebView (Likely)"
                    : "Web Browser"}
                </Text>
              )}
            </Space>
          }
          extra={
            <Space size="middle" style={{ marginTop: 32 }}>
              <Button
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={() => handleNavigateAway("subscription")}
                style={{
                  borderRadius: 8,
                  height: 48,
                  paddingLeft: 32,
                  paddingRight: 32,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Quay về
              </Button>
              <Button
                size="large"
                onClick={() => handleNavigateAway("home")}
                style={{
                  borderRadius: 8,
                  height: 48,
                  paddingLeft: 32,
                  paddingRight: 32,
                  fontSize: 16,
                }}
              >
                Về trang chủ
              </Button>
            </Space>
          }
        />

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #f0f0f0",
            textAlign: "center",
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Gặp vấn đề khi thanh toán? Liên hệ hỗ trợ:{" "}
            <a
              href="mailto:huyndhe176876@fpt.edu.vn"
              style={{ color: "#1890ff" }}
            >
              huyndhe176876@fpt.edu.vn
            </a>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default SubscriptionCancel;
