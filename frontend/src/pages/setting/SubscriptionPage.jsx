// pages/SubscriptionPage.jsx
import React, { useState, useEffect } from "react";
import { Card, Button, Typography, Space, Spin, message, Row, Col, Statistic, Progress, Timeline, Tag, Modal, Badge, Pagination } from "antd";
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
  LinkOutlined,
  CopyOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import subscriptionApi from "../../api/subscriptionApi";
import dayjs from "dayjs";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const { Title, Text, Paragraph } = Typography;

const formatCurrency = (value) => Number(value || 0).toLocaleString("vi-VN");

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [usageStats, setUsageStats] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5); // mỗi trang 5 bản ghi

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subRes, historyRes, usageRes] = await Promise.all([
        subscriptionApi.getCurrentSubscription().catch((err) => {
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
      Swal.fire({
        title: "❌ Lỗi!",
        text: "Không thể tải thông tin gói đăng ký",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#ff4d4f",
        timer: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyValue = async (value, label = "thông tin") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      message.success(`Đã sao chép ${label}`);
    } catch (error) {
      console.error("Không thể sao chép:", error);
      message.error("Sao chép thất bại");
    }
  };

  const handleOpenPendingLink = (url) => {
    if (!url) {
      message.warning("Không tìm thấy link thanh toán");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const handlePendingPaymentDone = async () => {
    message.loading({ content: "Đang kiểm tra trạng thái...", key: "pending-payment" });
    await fetchData();
    message.success({ content: "Đã cập nhật trạng thái subscription", key: "pending-payment" });
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
          Swal.fire({
            title: "🎉 Thành công!",
            text: `Đã huỷ tự động gia hạn`,
            icon: "success",
            timer: 2000,
            confirmButtonText: "OK",
            confirmButtonColor: "#52c41a",
          });
          fetchData();
        } catch (error) {
          Swal.fire({
            title: "❌ Lỗi!",
            text: "Không thể huỷ gia hạn gói!",
            icon: "error",
            confirmButtonText: "OK",
            confirmButtonColor: "#ff4d4f",
            timer: 2000,
          });
        }
      },
    });
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      TRIAL: { color: "blue", text: "Dùng thử", icon: <GiftOutlined /> },
      ACTIVE: { color: "green", text: "Premium", icon: <CheckCircleOutlined /> },
      EXPIRED: { color: "red", text: "Hết hạn", icon: <WarningOutlined /> },
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

  // Nếu không có subscription (chưa từng có)
  if (!subscription || !subscription.status) {
    return (
      <Layout>
        <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
          <Card style={{ textAlign: "center" }}>
            <WarningOutlined style={{ fontSize: 64, color: "#faad14", marginBottom: 20 }} />
            <Title level={2}>Chưa có gói dịch vụ</Title>
            <Paragraph style={{ fontSize: 16, color: "#666" }}>Nâng cấp lên Premium để sử dụng đầy đủ tính năng</Paragraph>
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
  const isExpired = subscription?.status === "EXPIRED";
  const daysRemaining = subscription?.days_remaining || 0;
  const totalDays = isTrial ? 14 : (subscription?.premium?.plan_duration || 1) * 30;
  const progressPercent = totalDays > 0 ? Math.round((daysRemaining / totalDays) * 100) : 0;
  const pendingPayment = subscription?.pending_payment;

  // Logic phân trang cho lịch sử thanh toán để đỡ dài
  const total = paymentHistory.length;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const paginatedHistory = paymentHistory.slice(startIndex, endIndex);

  return (
    <Layout>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 30 }}>
          <Space size="large" align="center">
            <CrownOutlined style={{ fontSize: 48, color: "#faad14" }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>
                Gói đăng ký của bạn
              </Title>
              <Text type="secondary">Quản lý gói và thanh toán</Text>
            </div>
          </Space>
        </div>

        {pendingPayment && (
          <Card style={{ borderColor: "#faad14", marginBottom: 24 }}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Space>
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  Đang chờ thanh toán
                </Tag>
                <Text>Mã giao dịch: {pendingPayment.order_code}</Text>
              </Space>
              <Text>
                Số tiền: <strong>{formatCurrency(pendingPayment.amount)}đ</strong> — Gói {pendingPayment.plan_duration} tháng
              </Text>
              {pendingPayment.created_at && (
                <Text type="secondary">
                  <FieldTimeOutlined /> Tạo lúc {dayjs(pendingPayment.created_at).format("DD/MM/YYYY HH:mm")}
                </Text>
              )}
              {pendingPayment.qr_data_url && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <img
                    src={pendingPayment.qr_data_url}
                    alt="QR PayOS"
                    style={{ maxWidth: "100%", width: 260, borderRadius: 12, border: "1px solid #f0f0f0" }}
                  />
                </div>
              )}
              <Space wrap style={{ marginTop: 12 }}>
                <Button type="primary" icon={<LinkOutlined />} onClick={() => handleOpenPendingLink(pendingPayment.checkout_url)}>
                  Mở link PayOS
                </Button>
                <Button icon={<CopyOutlined />} onClick={() => handleCopyValue(pendingPayment.order_code, "mã giao dịch")}>
                  Sao chép mã giao dịch
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handlePendingPaymentDone}>
                  Tôi đã thanh toán
                </Button>
              </Space>
            </Space>
          </Card>
        )}

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
                    <Button type="primary" icon={<CrownOutlined />} onClick={handleUpgrade} style={{ background: "#22c55e", borderColor: "#22c55e" }}>
                      Nâng cấp Premium
                    </Button>
                  )}
                  {isPremium && (
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={handleUpgrade}
                      style={{ background: "#22c55e", borderColor: "#22c55e" }}
                    >
                      Gia hạn gói
                    </Button>
                  )}
                  {isExpired && (
                    <Button danger type="primary" icon={<ReloadOutlined />} onClick={handleUpgrade}>
                      Gia hạn ngay
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
                        <Text type="secondary">Hết hạn: {dayjs(subscription.trial.ends_at).format("DD/MM/YYYY")}</Text>
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
                      <Text strong>{daysRemaining <= 3 ? "⚠️ Gói dùng thử sắp hết hạn!" : "ℹ️ Thông tin dùng thử"}</Text>
                      <Text>
                        Bạn có thể sử dụng <strong>TẤT CẢ</strong> tính năng Premium trong thời gian dùng thử.
                      </Text>
                      {daysRemaining <= 3 && <Text type="danger">Nâng cấp ngay để không bị gián đoạn dịch vụ!</Text>}
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
                    <Progress percent={progressPercent} strokeColor={getProgressColor(daysRemaining)} style={{ marginTop: 12 }} />
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
                          Gói Premium sắp hết hạn.{" "}
                          <Button type="link" onClick={handleUpgrade}>
                            Gia hạn ngay
                          </Button>
                        </Text>
                      </Space>
                    </Card>
                  )}
                </div>
              )}

              {/* EXPIRED Info */}
              {isExpired && (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Card style={{ background: "#fff1f0", border: "1px solid #ffccc7" }}>
                          <Statistic
                            title="Gói đã hết hạn"
                            value={subscription?.expires_at ? dayjs().diff(dayjs(subscription.expires_at), "day") : 0}
                            suffix="ngày trước"
                            prefix={<ClockCircleOutlined style={{ color: "#ff4d4f" }} />}
                            valueStyle={{ color: "#ff4d4f" }}
                          />
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card style={{ background: "#fff7e6", border: "1px solid #ffd591" }}>
                          <Statistic
                            title="Gói trước đây"
                            value={subscription?.premium?.plan_duration || subscription?.trial_ends_at ? "Trial" : "N/A"}
                            suffix={subscription?.premium?.plan_duration ? "tháng" : ""}
                            prefix={<CrownOutlined style={{ color: "#faad14" }} />}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </div>

                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {subscription?.premium?.started_at && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Text>Bắt đầu:</Text>
                        <Text strong>{dayjs(subscription.premium.started_at).format("DD/MM/YYYY")}</Text>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text>Đã hết hạn:</Text>
                      <Text strong style={{ color: "#ff4d4f" }}>
                        {subscription?.expires_at
                          ? dayjs(subscription.expires_at).format("DD/MM/YYYY")
                          : subscription?.trial_ends_at
                            ? dayjs(subscription.trial_ends_at).format("DD/MM/YYYY")
                            : "N/A"}
                      </Text>
                    </div>
                    <Progress percent={0} strokeColor="#ff4d4f" status="exception" style={{ marginTop: 12 }} />
                  </Space>

                  <Card
                    style={{
                      marginTop: 16,
                      background: "#fff1f0",
                      border: "1px solid #ffccc7",
                    }}
                  >
                    <Space direction="vertical">
                      <Space>
                        <WarningOutlined style={{ color: "#ff4d4f" }} />
                        <Text strong style={{ color: "#ff4d4f" }}>
                          Gói đăng ký đã hết hạn
                        </Text>
                      </Space>
                      <Text>Gia hạn ngay để tiếp tục sử dụng đầy đủ tính năng Premium.</Text>
                      <Button danger type="primary" icon={<ReloadOutlined />} onClick={handleUpgrade}>
                        Gia hạn ngay
                      </Button>
                    </Space>
                  </Card>
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
              {paymentHistory.length > 0 ? (
                <>
                  {/* Timeline */}
                  <Timeline>
                    {paginatedHistory.map((payment, index) => (
                      <Timeline.Item key={index} color="gray" dot={<CheckCircleOutlined />}>
                        <Space direction="vertical" size={4}>
                          <Text strong>
                            Gói {payment.plan_duration} tháng - {formatCurrency(payment.amount)}đ
                          </Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {payment.paid_at ? dayjs(payment.paid_at).format("DD/MM/YYYY HH:mm") : "Đang xử lý"}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Mã GD: {payment.transaction_id}
                          </Text>
                          {payment.status && (
                            <Tag
                              color={payment.status === "SUCCESS" ? "green" : payment.status === "PENDING" ? "orange" : "red"}
                              style={{ width: "fit-content" }}
                            >
                              {payment.status}
                            </Tag>
                          )}
                        </Space>
                      </Timeline.Item>
                    ))}
                  </Timeline>

                  {/* Pagination */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={total}
                      showSizeChanger={true}
                      onChange={(page, size) => {
                        setCurrentPage(page);
                        setPageSize(size);
                      }}
                      showTotal={(total) => (
                        <div style={{ textAlign: "end", fontSize: 14, color: "#595959" }}>
                          Đang xem{" "}
                          <span style={{ color: "#1890ff", fontWeight: 600 }}>
                            {total === 0 ? 0 : startIndex + 1} – {endIndex}
                          </span>{" "}
                          trên tổng số <span style={{ color: "#d4380d", fontWeight: 600 }}>{total}</span> giao dịch
                        </div>
                      )}
                    />
                  </div>
                </>
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
              <Card
                title={
                  <Space>
                    <ShoppingOutlined />
                    <span>Thống kê sử dụng</span>
                  </Space>
                }
              >
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Card style={{ background: "#f0f5ff" }}>
                    <Statistic title="Tổng đơn hàng" value={usageStats.total_orders} prefix={<ShoppingOutlined />} />
                  </Card>
                  <Card style={{ background: "#fff7e6" }}>
                    <Statistic title="Doanh thu" value={usageStats.total_revenue} prefix={<DollarOutlined />} suffix="đ" />
                  </Card>
                  <Card style={{ background: "#f6ffed" }}>
                    <Statistic title="Sản phẩm" value={usageStats.total_products} prefix={<CrownOutlined />} />
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
