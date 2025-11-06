// pages/SubscriptionPage.jsx
import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  message,
  Row,
  Col,
  Statistic,
  Progress,
  Timeline,
  Tag,
  Modal,
  Badge,
} from "antd";
import {
  CrownOutlined,
  RocketOutlined,
  CalendarOutlined,
  ShoppingOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  GiftOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import subscriptionApi from "../../api/subscriptionApi";
import dayjs from "dayjs";
import Layout from "../../components/Layout";

const { Title, Text, Paragraph } = Typography;

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [usageStats, setUsageStats] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, historyRes, usageRes] = await Promise.all([
        subscriptionApi.getCurrentSubscription().catch(err => {
          console.warn("No subscription found:", err);
          return { data: null };
        }),
        subscriptionApi.getPaymentHistory().catch(() => ({ data: [] })),
        subscriptionApi.getUsageStats().catch(() => ({ data: null })),
      ]);

      console.log("Subscription data:", subRes?.data);
      console.log("Payment history raw:", historyRes);
      const historyArray = historyRes?.data?.data || historyRes?.data || [];
      console.log("Setting paymentHistory to array:", historyArray);
      setSubscription(subRes?.data || null);
      setPaymentHistory(historyArray);
      setUsageStats(usageRes?.data || null);
    } catch (error) {
      console.error("Lỗi load subscription:", error);
      message.error("Không thể tải thông tin subscription");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigate("/settings/subscription/pricing");
  };

  const handleCancelAutoRenew = () => {
    Modal.confirm({
      title: "Hủy tự động gia hạn",
      content: "Bạn có chắc muốn hủy tự động gia hạn? Gói sẽ hết hạn sau khi kết thúc chu kỳ.",
      okText: "Hủy gia hạn",
      cancelText: "Giữ nguyên",
      onOk: async () => {
        try {
          await subscriptionApi.cancelAutoRenew();
          message.success("Đã hủy tự động gia hạn");
          fetchData();
        } catch (error) {
          message.error("Không thể hủy gia hạn");
        }
      },
    });
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      TRIAL: { color: "blue", text: "Đang dùng thử", icon: <GiftOutlined /> },
      ACTIVE: { color: "green", text: "Premium Active", icon: <CheckCircleOutlined /> },
      EXPIRED: { color: "red", text: "Đã hết hạn", icon: <WarningOutlined /> },
      CANCELLED: { color: "default", text: "Đã hủy", icon: <ClockCircleOutlined /> },
    };

    const config = statusConfig[status] || statusConfig.EXPIRED;
    return (
      <Tag color={config.color} icon={config.icon} style={{ fontSize: 14, padding: "4px 12px" }}>
        {config.text}
      </Tag>
    );
  };

  const getProgressColor = (days) => {
    if (days > 7) return "#52c41a";
    if (days > 3) return "#faad14";
    return "#ff4d4f";
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: "center", padding: "100px 0" }}>
          <Spin size="large" />
          <p style={{ marginTop: 20 }}>Đang tải...</p>
        </div>
      </Layout>
    );
  }

  // Nếu không có subscription hoặc expired
  if (!subscription || subscription.status === "EXPIRED" || !subscription.status) {
    return (
      <Layout>
        <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
          <Card style={{ textAlign: "center" }}>
            <WarningOutlined style={{ fontSize: 64, color: "#faad14", marginBottom: 20 }} />
            <Title level={2}>Chưa có gói dịch vụ</Title>
            <Paragraph style={{ fontSize: 16, color: "#666" }}>
              Nâng cấp lên Premium để sử dụng đầy đủ tính năng
            </Paragraph>
            <Button type="primary" size="large" icon={<CrownOutlined />} onClick={handleUpgrade}>
              Xem các gói Premium
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  const isTrial = subscription?.status === "TRIAL";
  const isPremium = subscription?.status === "ACTIVE";
  const daysRemaining = subscription?.days_remaining || 0;
  const totalDays = isTrial ? 14 : (subscription?.premium?.plan_duration || 1) * 30;
  const progressPercent = totalDays > 0 ? Math.round((daysRemaining / totalDays) * 100) : 0;

  return (
    <Layout>
      <div style={{ padding: "40px 20px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 30 }}>
        <Space size="large" align="center">
          <CrownOutlined style={{ fontSize: 48, color: "#faad14" }} />
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Subscription của bạn
            </Title>
            <Text type="secondary">Quản lý gói và thanh toán</Text>
          </div>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Current Subscription Card */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <RocketOutlined />
                <span>Gói hiện tại</span>
                {subscription?.status && getStatusTag(subscription.status)}
              </Space>
            }
            extra={
              <Space>
                {isTrial && (
                  <Button 
                    type="primary" 
                    icon={<CrownOutlined />} 
                    onClick={handleUpgrade}
                    style={{ background: "#22c55e", borderColor: "#22c55e" }}
                  >
                    Nâng cấp Premium
                  </Button>
                )}
                {(isPremium || subscription?.status === "EXPIRED") && (
                  <Button 
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleUpgrade}
                    style={{ background: "#22c55e", borderColor: "#22c55e" }}
                    danger={subscription?.status === "EXPIRED"}
                  >
                    {subscription?.status === "EXPIRED" ? "Gia hạn ngay" : "Gia hạn gói"}
                  </Button>
                )}
              </Space>
            }
          >
            {/* Trial Info */}
            {isTrial && subscription.trial && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text strong style={{ fontSize: 16 }}>
                        🎁 Gói dùng thử miễn phí
                      </Text>
                      <Text type="secondary">
                        Hết hạn: {dayjs(subscription.trial.ends_at).format("DD/MM/YYYY")}
                      </Text>
                    </div>
                    <Progress
                      percent={progressPercent}
                      strokeColor={getProgressColor(daysRemaining)}
                      format={() => `${daysRemaining} ngày còn lại`}
                      style={{ marginTop: 12 }}
                    />
                  </Space>
                </div>

                <Card
                  style={{
                    background: daysRemaining <= 3 ? "#fff1f0" : "#e6f7ff",
                    border: `1px solid ${daysRemaining <= 3 ? "#ffccc7" : "#91d5ff"}`,
                  }}
                >
                  <Space direction="vertical" size={8}>
                    <Text strong>
                      {daysRemaining <= 3 ? "⚠️ Gói dùng thử sắp hết hạn!" : "ℹ️ Thông tin dùng thử"}
                    </Text>
                    <Text>
                      Bạn có thể sử dụng <strong>TẤT CẢ</strong> tính năng Premium trong thời gian dùng
                      thử.
                    </Text>
                    {daysRemaining <= 3 && (
                      <Text type="danger">
                        Nâng cấp ngay để không bị gián đoạn dịch vụ!
                      </Text>
                    )}
                  </Space>
                </Card>
              </div>
            )}

            {/* Premium Info */}
            {isPremium && subscription.premium && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Card style={{ background: "#f6ffed", border: "1px solid #b7eb8f" }}>
                        <Statistic
                          title="Gói Premium"
                          value={subscription.premium.plan_duration}
                          suffix="tháng"
                          prefix={<CrownOutlined style={{ color: "#faad14" }} />}
                        />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card style={{ background: "#fff7e6", border: "1px solid #ffd591" }}>
                        <Statistic
                          title="Còn lại"
                          value={daysRemaining}
                          suffix="ngày"
                          prefix={<CalendarOutlined />}
                          valueStyle={{ color: getProgressColor(daysRemaining) }}
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>

                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>Bắt đầu:</Text>
                    <Text strong>{dayjs(subscription.premium.started_at).format("DD/MM/YYYY")}</Text>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Text>Hết hạn:</Text>
                    <Text strong style={{ color: "#ff4d4f" }}>
                      {dayjs(subscription.premium.expires_at).format("DD/MM/YYYY")}
                    </Text>
                  </div>
                  <Progress
                    percent={progressPercent}
                    strokeColor={getProgressColor(daysRemaining)}
                    style={{ marginTop: 12 }}
                  />
                </Space>

                {daysRemaining <= 7 && (
                  <Card
                    style={{
                      marginTop: 16,
                      background: "#fff1f0",
                      border: "1px solid #ffccc7",
                    }}
                  >
                    <Space>
                      <WarningOutlined style={{ color: "#ff4d4f" }} />
                      <Text>
                        Gói Premium sắp hết hạn. <Button type="link" onClick={handleUpgrade}>Gia hạn ngay</Button>
                      </Text>
                    </Space>
                  </Card>
                )}
              </div>
            )}
          </Card>

          {/* Payment History */}
          <Card
            title={
              <Space>
                <DollarOutlined />
                <span>Lịch sử thanh toán</span>
              </Space>
            }
            style={{ marginTop: 24 }}
          >
            {console.log("Rendering payment history, length:", paymentHistory?.length, "data:", paymentHistory)}
            {paymentHistory.length > 0 ? (
              <Timeline>
                {paymentHistory.map((payment, index) => (
                  <Timeline.Item
                    key={index}
                    color={index === 0 ? "green" : "gray"}
                    dot={index === 0 ? <CheckCircleOutlined /> : undefined}
                  >
                    <Space direction="vertical" size={4}>
                      <Text strong>
                        Gói {payment.plan_duration} tháng -{" "}
                        {payment.amount.toLocaleString("vi-VN")}đ
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {dayjs(payment.paid_at).format("DD/MM/YYYY HH:mm")}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Mã GD: {payment.transaction_id}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                <DollarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>Chưa có lịch sử thanh toán</p>
              </div>
            )}
          </Card>
        </Col>

        {/* Usage Stats */}
        <Col xs={24} lg={8}>
          {usageStats && (
            <Card title={<Space><ShoppingOutlined /><span>Thống kê sử dụng</span></Space>}>
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Card style={{ background: "#f0f5ff" }}>
                  <Statistic
                    title="Tổng đơn hàng"
                    value={usageStats.total_orders}
                    prefix={<ShoppingOutlined />}
                  />
                </Card>
                <Card style={{ background: "#fff7e6" }}>
                  <Statistic
                    title="Doanh thu"
                    value={usageStats.total_revenue}
                    prefix={<DollarOutlined />}
                    suffix="đ"
                  />
                </Card>
                <Card style={{ background: "#f6ffed" }}>
                  <Statistic
                    title="Sản phẩm"
                    value={usageStats.total_products}
                    prefix={<CrownOutlined />}
                  />
                </Card>
              </Space>
            </Card>
          )}

          {/* Benefits */}
          <Card title="Quyền lợi Premium" style={{ marginTop: 24 }}>
            <Space direction="vertical" size={12}>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>Không giới hạn sản phẩm</Text>
              </Space>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>Không giới hạn đơn hàng</Text>
              </Space>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>Báo cáo & thống kê</Text>
              </Space>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>Quản lý kho nâng cao</Text>
              </Space>
              <Space>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text>Hỗ trợ 24/7</Text>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
    </Layout>
  );
};

export default SubscriptionPage;
