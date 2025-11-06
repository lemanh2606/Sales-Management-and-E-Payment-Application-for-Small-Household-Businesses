// pages/settings/PricingPage.jsx
import React, { useState, useEffect } from "react";
import { Card, Button, Row, Col, Typography, Badge, Space, Spin, message, Modal } from "antd";
import { CheckOutlined, CrownOutlined, RocketOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import subscriptionApi from "../../api/subscriptionApi";
import Layout from "../../components/Layout";
import Swal from "sweetalert2";

const { Title, Text, Paragraph } = Typography;

const PricingPage = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null); // Track which plan is selected

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getCurrentSubscription().catch(() => null),
      ]);

      setPlans(plansRes.data.plans || []);
      setCurrentSub(subRes?.data || null);
    } catch (error) {
      console.error("Lỗi load pricing:", error);
      message.error("Không thể tải thông tin gói");
      // Nếu lỗi, vẫn set plans mặc định để UI hiển thị
      setPlans([
        { duration: 1, label: "1 tháng", price: 199000, original_price: 199000, discount: 0, discount_percent: 0, price_per_month: 199000, badge: null },
        { duration: 3, label: "3 tháng", price: 499000, original_price: 597000, discount: 98000, discount_percent: 16, price_per_month: 166333, badge: "Phổ biến" },
        { duration: 6, label: "6 tháng", price: 899000, original_price: 1194000, discount: 295000, discount_percent: 25, price_per_month: 149833, badge: "Tiết kiệm nhất" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (duration) => {
    console.log("🎯 User clicked plan:", duration);
    console.log("📦 Current subscription:", currentSub);
    console.log("📋 Available plans:", plans);

    // ✅ CHO PHÉP GIA HẠN KHI ĐÃ CÓ PREMIUM ACTIVE
    // Không chặn nữa, cho phép mua thêm để gia hạn

    const selectedPlan = plans.find(p => p.duration === duration);
    console.log("✅ Selected plan:", selectedPlan);
    
    if (!selectedPlan) {
      console.error("❌ Plan not found!");
      message.error("Không tìm thấy gói đã chọn");
      return;
    }

    console.log("📢 Showing modal confirm...");
    
    // Check if user is logged in
    const token = localStorage.getItem("token");
    console.log("🔑 Token exists:", !!token);
    
    if (!token) {
      Swal.fire({
        title: 'Chưa đăng nhập',
        text: 'Vui lòng đăng nhập để nâng cấp gói Premium',
        icon: 'warning',
        confirmButtonText: 'Đến trang đăng nhập',
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login');
        }
      });
      return;
    }
    
    // Check if user đang có Premium ACTIVE
    const isRenewal = currentSub?.status === "ACTIVE" && currentSub?.is_premium;
    const actionText = isRenewal ? "gia hạn" : "nâng cấp";
    
    // Use SweetAlert2 instead of Ant Design Modal (better React 19 compatibility)
    Swal.fire({
      title: `Xác nhận chọn gói ${duration} tháng`,
      html: `
        <div style="text-align: left; padding: 10px;">
          <p>Bạn có chắc muốn chọn gói <strong>${duration} tháng</strong>?</p>
          ${isRenewal ? `
            <p style="margin-top: 8px; color: #22c55e; font-weight: 600;">
              ✅ Thời gian sẽ được cộng thêm ${duration} tháng vào tài khoản của bạn
            </p>
            <p style="margin-top: 4px; font-size: 13px; color: #666;">
              Gói hiện tại còn: <strong>${currentSub.days_remaining} ngày</strong>
            </p>
          ` : ''}
          <p style="margin-top: 12px;">
            Giá: <strong style="color: #22c55e; font-size: 18px;">${selectedPlan.price.toLocaleString("vi-VN")}đ</strong>
          </p>
          <p style="margin-top: 8px; font-size: 13px; color: #999;">
            (Do chưa tích hợp PayOS, gói sẽ được kích hoạt ngay lập tức)
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận',
      cancelButtonText: 'Hủy',
      confirmButtonColor: getPlanColor(duration),
      cancelButtonColor: '#d33',
      width: 500,
    }).then(async (result) => {
      if (result.isConfirmed) {
        console.log("✅ User confirmed, activating premium...");
        try {
          setProcessingPlan(duration);
          
          // Direct activate premium (skip PayOS)
          const planInfo = plans.find(p => p.duration === duration);
          
          if (!planInfo) {
            Swal.fire('Lỗi', 'Không tìm thấy thông tin gói', 'error');
            setProcessingPlan(null);
            return;
          }

          const response = await subscriptionApi.activatePremium({
            plan_duration: duration,
            amount: planInfo.price,
            transaction_id: `MANUAL_${Date.now()}`,
          });

          console.log("Activate response:", response);
          
          await Swal.fire({
            title: 'Thành công!',
            text: 'Đã kích hoạt gói Premium thành công!',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
          
          // Navigate sang subscription page
          navigate("/settings/subscription");
        } catch (error) {
          console.error("Lỗi kích hoạt premium:", error);
          const errorMsg = error.response?.data?.message || error.message || "Không thể kích hoạt Premium";
          Swal.fire('Lỗi', errorMsg, 'error');
        } finally {
          setProcessingPlan(null);
        }
      }
    });
  };

  const getPlanIcon = (duration) => {
    if (duration === 1) return <ThunderboltOutlined style={{ fontSize: 32 }} />;
    if (duration === 3) return <RocketOutlined style={{ fontSize: 32 }} />;
    return <CrownOutlined style={{ fontSize: 32 }} />;
  };

  const getPlanColor = (duration) => {
    if (duration === 1) return "#1890ff";
    if (duration === 3) return "#52c41a";
    return "#faad14";
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

  return (
    <Layout>
      <div style={{ padding: "40px 20px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 50 }}>
        <Title level={1}>
          <CrownOutlined style={{ color: "#faad14", marginRight: 10 }} />
          Chọn gói Premium phù hợp với bạn
        </Title>
        <Paragraph style={{ fontSize: 18, color: "#666" }}>
          Mở khóa tất cả tính năng với gói Premium. Mua càng dài, tiết kiệm càng nhiều! 🎉
        </Paragraph>

        {/* Trial Banner */}
        {currentSub?.status === "TRIAL" && (
          <Card
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              marginTop: 20,
              maxWidth: 600,
              margin: "20px auto 0",
            }}
          >
            <Space direction="vertical" size={0}>
              <Text strong style={{ color: "white", fontSize: 16 }}>
                🎁 Bạn đang dùng thử miễn phí
              </Text>
              <Text style={{ color: "white", fontSize: 14 }}>
                Còn <strong>{currentSub.days_remaining} ngày</strong> dùng thử. Nâng cấp ngay để không bị gián đoạn!
              </Text>
            </Space>
          </Card>
        )}
      </div>

      {/* Pricing Cards */}
      <Row gutter={[24, 24]} justify="center">
        {plans.map((plan) => {
          const isPopular = plan.badge === "Phổ biến";
          const isBestValue = plan.badge === "Tiết kiệm nhất";
          const isSelected = selectedPlan === plan.duration; // Check if this plan is selected
          const color = getPlanColor(plan.duration);

          return (
            <Col xs={24} sm={24} md={8} key={plan.duration}>
              <Card
                hoverable
                style={{
                  borderRadius: 12,
                  border: isSelected ? `3px solid ${color}` : `2px solid #e0e0e0`,
                  boxShadow: isSelected ? "0 8px 24px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.08)",
                  position: "relative",
                  height: "100%",
                  transition: "all 0.3s ease-in-out",
                  cursor: "pointer",
                }}
                onClick={(e) => {
                  // Only select if not clicking button
                  if (!e.target.closest('button')) {
                    setSelectedPlan(plan.duration);
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = `3px solid ${color}`;
                  e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.15)";
                  e.currentTarget.style.transform = "translateY(-8px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = isSelected ? `3px solid ${color}` : "2px solid #e0e0e0";
                  e.currentTarget.style.boxShadow = isSelected ? "0 8px 24px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.08)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      right: 20,
                      background: color,
                      color: "white",
                      padding: "4px 16px",
                      borderRadius: 20,
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Icon */}
                <div style={{ textAlign: "center", marginBottom: 16, color }}>
                  {getPlanIcon(plan.duration)}
                </div>

                {/* Title */}
                <Title level={3} style={{ textAlign: "center", marginBottom: 8, color }}>
                  Gói {plan.label}
                </Title>

                {/* Price */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  {plan.discount > 0 && (
                    <Text
                      delete
                      style={{ fontSize: 16, color: "#999", display: "block", marginBottom: 4 }}
                    >
                      {plan.original_price.toLocaleString("vi-VN")}đ
                    </Text>
                  )}
                  <div>
                    <Text
                      strong
                      style={{ fontSize: 40, color: "#000", fontWeight: 700 }}
                    >
                      {plan.price.toLocaleString("vi-VN")}đ
                    </Text>
                  </div>
                  <Text style={{ fontSize: 14, color: "#666" }}>
                    {plan.price_per_month.toLocaleString("vi-VN")}đ/tháng
                  </Text>
                  {plan.discount_percent > 0 && (
                    <Badge
                      count={`-${plan.discount_percent}%`}
                      style={{
                        backgroundColor: "#52c41a",
                        marginLeft: 8,
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    />
                  )}
                </div>

                {/* Features */}
                <Space direction="vertical" size={12} style={{ width: "100%", marginBottom: 24 }}>
                  <Space>
                    <CheckOutlined style={{ color: "#52c41a" }} />
                    <Text>Tất cả tính năng Premium</Text>
                  </Space>
                  <Space>
                    <CheckOutlined style={{ color: "#52c41a" }} />
                    <Text>Không giới hạn sản phẩm</Text>
                  </Space>
                  <Space>
                    <CheckOutlined style={{ color: "#52c41a" }} />
                    <Text>Không giới hạn đơn hàng</Text>
                  </Space>
                  <Space>
                    <CheckOutlined style={{ color: "#52c41a" }} />
                    <Text>Báo cáo & thống kê</Text>
                  </Space>
                  <Space>
                    <CheckOutlined style={{ color: "#52c41a" }} />
                    <Text>Hỗ trợ 24/7</Text>
                  </Space>
                </Space>

                {/* CTA Button */}
                <Button
                  type="primary"
                  size="large"
                  block
                  style={{
                    height: 50,
                    fontSize: 16,
                    fontWeight: 600,
                    background: isSelected ? "#16a34a" : "#22c55e", // Green theme
                    borderColor: isSelected ? "#16a34a" : "#22c55e",
                    color: "white",
                  }}
                  loading={processingPlan === plan.duration}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    console.log("🔘 Button clicked for plan:", plan.duration);
                    setSelectedPlan(plan.duration); // Set selection when button clicked
                    handleSelectPlan(plan.duration);
                  }}
                  onMouseEnter={(e) => {
                    if (!processingPlan) {
                      e.target.style.background = "#15803d";
                      e.target.style.borderColor = "#15803d";
                      e.target.style.transform = "translateY(-2px)";
                      e.target.style.boxShadow = "0 4px 12px rgba(34, 197, 94, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = isSelected ? "#16a34a" : "#22c55e";
                    e.target.style.borderColor = isSelected ? "#16a34a" : "#22c55e";
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "none";
                  }}
                >
                  Chọn gói này
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* FAQ Section */}
      <div style={{ marginTop: 60, textAlign: "center" }}>
        <Title level={3}>Câu hỏi thường gặp</Title>
        <Row gutter={[24, 24]} style={{ marginTop: 30 }}>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5}>💳 Thanh toán như thế nào?</Title>
              <Text>Chuyển khoản ngân hàng qua QR Code PayOS, nhanh chóng và an toàn.</Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5}>🔄 Có tự động gia hạn không?</Title>
              <Text>Không, bạn cần gia hạn thủ công khi hết hạn.</Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5}>🎁 Trial có đầy đủ tính năng không?</Title>
              <Text>Có! Bạn được dùng thử TẤT CẢ tính năng Premium trong 14 ngày.</Text>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5}>🔐 Dữ liệu có an toàn không?</Title>
              <Text>Hoàn toàn! Dữ liệu được mã hóa và backup tự động hàng ngày.</Text>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
    </Layout>
  );
};

export default PricingPage;
