// frontend/src/pages/SubscriptionSuccess.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Result, Button, Space, Typography, Spin, Progress } from "antd";
import {
  CheckCircleOutlined,
  LoadingOutlined,
  HomeOutlined,
  CreditCardOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import subscriptionApi from "../api/subscriptionApi";

const { Text, Title } = Typography;

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Đang xác nhận thanh toán…");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "success" | "pending">(
    "loading"
  );

  const params = new URLSearchParams(window.location.search);
  const orderCode = params.get("orderCode");
  const payosStatus = params.get("status");

  // ✅ Gửi message về RN app hoặc navigate web
  const sendToRN = (data: any): boolean => {
    if ((window as any).ReactNativeWebView?.postMessage) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(data));
      return true;
    }
    return false;
  };

  const goBackToSubscription = () => {
    if (sendToRN({ type: "NAVIGATE", screen: "Subscription" })) {
      return; // RN app sẽ xử lý
    }
    // Fallback cho web browser
    navigate("/settings/subscription");
  };

  const goToHome = () => {
    if (sendToRN({ type: "NAVIGATE", screen: "Home" })) {
      return;
    }
    navigate("/dashboard"); // Cần lấy storeId nếu có
  };

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await subscriptionApi.getCurrentSubscription();
        const sub = res?.data?.data;

        if (sub && sub.status === "ACTIVE") {
          setMessage("Thanh toán thành công! Đang chuyển hướng...");
          setStatus("success");
          setTimeout(() => goBackToSubscription(), 2000); // ✅ Dùng hàm mới
          return;
        }

        // Webhook chưa chạy → retry
        if (attempt < 4) {
          setAttempt((prev) => prev + 1);
          setMessage(`Đang xác nhận thanh toán... (${attempt + 1}/5)`);
        } else {
          setMessage(
            "Thanh toán thành công. Hệ thống đang cập nhật, vui lòng F5 sau 30 giây."
          );
          setStatus("pending");
        }
      } catch (err) {
        if (attempt < 5) {
          setAttempt((prev) => prev + 1);
          setMessage(`Đang xác nhận thanh toán... (${attempt + 1}/5)`);
        } else {
          setMessage("Không thể xác nhận giao dịch. Vui lòng thử lại sau.");
          setStatus("pending");
        }
      }
    };

    const t = setTimeout(verify, 1500);
    return () => clearTimeout(t);
  }, [attempt, orderCode, goBackToSubscription]); // ✅ Thêm dependency mới

  const getResultIcon = () => {
    if (status === "loading") {
      return (
        <Spin
          indicator={
            <LoadingOutlined style={{ fontSize: 72, color: "#1890ff" }} spin />
          }
        />
      );
    }
    if (status === "success") {
      return <CheckCircleOutlined style={{ fontSize: 72, color: "#52c41a" }} />;
    }
    return <ClockCircleOutlined style={{ fontSize: 72, color: "#faad14" }} />;
  };

  const getResultStatus = () => {
    if (status === "loading") return "info";
    if (status === "success") return "success";
    return "warning";
  };

  const getResultTitle = () => {
    if (status === "loading") return "Đang xác nhận thanh toán";
    if (status === "success") return "Thanh toán thành công!";
    return "Đang xử lý giao dịch";
  };

  // hàm format trạng thái sang tiếng việt
  const formatPayOSStatus = (status: string | null) => {
    if (!status) return "";

    switch (status.toUpperCase()) {
      case "PAID":
        return "Đã thanh toán thành công";
      case "PENDING":
        return "Đang chờ thanh toán";
      case "PROCESSING":
        return "Đang xử lý thanh toán";
      case "CANCELLED":
        return "Giao dịch bị hủy";
      default:
        return status;
    }
  };

  //hàm đổi màu trạng thái tương ứng cho đẹp
  const getStatusColor = (status: string | null) => {
    if (!status) return "#595959"; // mặc định màu xám

    switch (status.toUpperCase()) {
      case "PAID":
        return "#52c41a"; // xanh lá
      case "PENDING":
        return "#faad14"; // vàng
      case "PROCESSING":
        return "#1890ff"; // xanh dương
      case "CANCELLED":
        return "#ff4d4f"; // đỏ
      default:
        return "#595959";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
          icon={getResultIcon()}
          status={getResultStatus()}
          title={
            <Title level={2} style={{ marginTop: 24, marginBottom: 8 }}>
              {getResultTitle()}
            </Title>
          }
          subTitle={
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Text style={{ fontSize: 16, color: "#595959" }}>{message}</Text>

              {/* Progress bar khi đang loading */}
              {status === "loading" && (
                <Progress
                  percent={(attempt / 5) * 100}
                  strokeColor={{
                    "0%": "#108ee9",
                    "100%": "#87d068",
                  }}
                  showInfo={false}
                  style={{ marginTop: 16 }}
                />
              )}

              {/* Order Info Card */}
              <Card
                style={{
                  marginTop: 24,
                  background: "#f5f5f5",
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
                      style={{ fontSize: 18, color: "#1890ff" }}
                    />
                    <Text strong style={{ fontSize: 14 }}>
                      Mã đơn hàng:
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
                    }}
                  >
                    {orderCode}
                  </Text>

                  {payosStatus && (
                    <>
                      <Space style={{ marginTop: 16 }}>
                        <CheckCircleOutlined
                          style={{ fontSize: 18, color: "#52c41a" }}
                        />
                        <Text strong style={{ fontSize: 14 }}>
                          Trạng thái Thanh toán:
                        </Text>
                      </Space>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: 600,
                          color: getStatusColor(payosStatus),
                          display: "block",
                          marginTop: 8,
                        }}
                      >
                        {formatPayOSStatus(payosStatus)}
                      </Text>
                    </>
                  )}
                </Space>
              </Card>

              {/* Tips */}
              {status === "pending" && (
                <Card
                  style={{
                    marginTop: 16,
                    background: "#fffbe6",
                    borderColor: "#ffe58f",
                    borderRadius: 12,
                  }}
                  bodyStyle={{ padding: 16 }}
                >
                  <Space>
                    <ClockCircleOutlined
                      style={{ fontSize: 16, color: "#faad14" }}
                    />
                    <Text style={{ fontSize: 13, color: "#ad8b00" }}>
                      <strong>Lưu ý:</strong> Hệ thống đang xử lý, vui lòng đợi
                      5 giây và làm mới trang (F5).
                    </Text>
                  </Space>
                </Card>
              )}
            </Space>
          }
          extra={
            <Space size="middle" style={{ marginTop: 32 }}>
              <Button
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={goBackToSubscription} // ✅ Dùng hàm mới
                style={{
                  borderRadius: 8,
                  height: 48,
                  paddingLeft: 32,
                  paddingRight: 32,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Quay về trang gói dịch vụ
              </Button>
              {status === "pending" && (
                <Button
                  size="large"
                  onClick={() => window.location.reload()}
                  style={{
                    borderRadius: 8,
                    height: 48,
                    paddingLeft: 32,
                    paddingRight: 32,
                    fontSize: 16,
                  }}
                >
                  Làm mới (F5)
                </Button>
              )}
            </Space>
          }
        />

        {/* Footer Note */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #f0f0f0",
            textAlign: "center",
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Nếu có bất kỳ vấn đề gì, vui lòng liên hệ{" "}
            <a
              href="mailto:huyndhe176876@fpt.edu.vn"
              style={{ color: "#1890ff" }}
            >
              support@smartretail.vn
            </a>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;
