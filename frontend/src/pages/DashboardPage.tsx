// src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Layout from "../components/Layout";
import {
  Table,
  Space,
  Card,
  Typography,
  Progress,
  Collapse,
  Dropdown,
  Tooltip,
  Button,
  Spin,
  Alert,
  Input,
  Menu,
  Badge,
  Popover,
  Tag,
} from "antd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Tooltip as RechartsTooltip } from "recharts";
import {
  EllipsisOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  EditOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  BellOutlined,
  MessageOutlined,
  LaptopOutlined,
  SearchOutlined,
  CustomerServiceOutlined,
  UserOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  LockOutlined,
  DownOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import axios from "axios";
import "./DashboardPage.css";
import NotificationPanel from "../pages/setting/NotificationPanel";
import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL;

const socket = io(import.meta.env.VITE_API_URL.replace("/api", ""), {
  auth: { token: localStorage.getItem("token") },
});

const { Title, Text } = Typography;

interface OrderStats {
  total: number;
  pending: number;
  refunded: number;
  paid: number;
  totalSoldItems: number;
  totalRefundedItems: number;
  netSoldItems: number;
}

interface FinancialData {
  totalRevenue: number;
  totalVAT: number;
  netSales: number; // Doanh thu thuần = Doanh thu - VAT
  totalCOGS: number;
  grossProfit: number;
  operatingCost: number;
  netProfit: number;
  stockValue: number;
  stockAdjustmentValue: number;
  stockDisposalCost: number;
}

interface OnboardingStep {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  actions?: { label: string; link: string; target?: string }[];
}

interface TopProduct {
  _id: string;
  productName: string;
  productSku: string;
  totalQuantity: number;
  totalSales: { $numberDecimal?: string } | number;
}

interface RevenueSummary {
  totalRevenue: number | { $numberDecimal?: string };
  countOrders: number;
  completedOrders?: number;
  partialRefundOrders?: number;
  dailyRevenue?: Array<{
    day: string;
    revenue: number;
  }>;
}

export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = currentStore?._id;
  const now = dayjs();

  const [unreadCount, setUnreadCount] = useState(0);
  const [panelVisible, setPanelVisible] = useState(false);

  const [showOnboardingCard, setShowOnboardingCard] = useState(true);
  const [cardVisible, setCardVisible] = useState(true);

  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [errorFinancials, setErrorFinancials] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    refunded: 0,
    paid: 0,
    totalSoldItems: 0,
    totalRefundedItems: 0,
    netSoldItems: 0,
  });

  const [topProducts, setTopProducts] = useState([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [errorTopProducts, setErrorTopProducts] = useState<string | null>(null);

  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(
    null
  );
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [errorRevenue, setErrorRevenue] = useState<string | null>(null);

  const [expiringProducts, setExpiringProducts] = useState([]);
  const [loadingExpiring, setLoadingExpiring] = useState(false);

  const [steps, setSteps] = useState<OnboardingStep[]>(() => {
    const saved = localStorage.getItem(`onboardingSteps_${storeId}`);
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      {
        key: "setup-store",
        title: "Thiết lập cửa hàng",
        description:
          "Cập nhật thông tin cửa hàng để giúp khách hàng và hệ thống SmartRetail liên hệ nhanh chóng hơn.",
        completed: false,
        actions: [{ label: "Thiết lập cửa hàng", link: "/update/store" }],
      },
      {
        key: "add-product",
        title: "Thêm sản phẩm đầu tiên",
        description:
          "Bạn kinh doanh sản phẩm gì? Hãy tạo nhóm sản phẩm, sau đó thêm sản phẩm đầu tiên để bắt đầu quản lý.",
        completed: false,
        actions: [{ label: "Tạo nhóm hàng hoá", link: "/product-groups" }],
      },
      {
        key: "connect-channel",
        title: "Kết nối kênh bán hàng",
        description:
          "Kênh POS - Bán tại cửa hàng. Bán và vận hành cửa hàng chuyên nghiệp.",
        completed: false,
        actions: [
          {
            label: "Truy cập kênh bán POS",
            link: "/orders/pos",
            target: "_blank",
          },
        ],
      },
      {
        key: "manage-orders",
        title: "Quản lý đơn hàng tập trung",
        description:
          "Các đơn hàng trên nhiều kênh bán khác nhau sẽ được quản lý tại một nơi duy nhất.",
        completed: false,
        actions: [{ label: "Danh sách đơn hàng", link: "/orders/list" }],
      },
    ];
  });

  useEffect(() => {
    const fetchInitialUnreadCount = async () => {
      if (!storeId) return;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${apiUrl}/notifications?storeId=${storeId}&read=false&limit=1`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setUnreadCount(res.data.meta.total || 0);
      } catch (err) {
        console.error("Lỗi tải số thông báo chưa đọc:", err);
      }
    };
    fetchInitialUnreadCount();

    const handleNotificationUpdate = (e: Event) => {
      const event = e as CustomEvent<{ unreadCount: number }>;
      if (event.detail?.unreadCount !== undefined) {
        setUnreadCount(event.detail.unreadCount);
      }
    };
    window.addEventListener("notifications:updated", handleNotificationUpdate);

    socket.on("payment_success", () => {
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      window.removeEventListener(
        "notifications:updated",
        handleNotificationUpdate
      );
      socket.off("payment_success");
    };
  }, [storeId]);

  const fetchTopProductsDashboard = async () => {
    if (!storeId) return;
    setLoadingTopProducts(true);
    setErrorTopProducts(null);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      const now = dayjs();

      params.append("storeId", storeId);
      params.append("periodType", "month"); // tương đương range cũ thisMonth
      params.append("periodKey", now.format("YYYY-MM")); // Ví dụ 2025-12
      params.append("limit", "5");

      const url = `${apiUrl}/orders/top-products?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTopProducts(res.data.data || []);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorTopProducts(
          err.response?.data?.message || "Lỗi tải top sản phẩm"
        );
      } else {
        setErrorTopProducts("Lỗi tải top sản phẩm");
      }
    } finally {
      setLoadingTopProducts(false);
    }
  };

  // Fetch revenue summary, thêm dailyRevenue sau chứ chia đều theo ngày trong tháng thì sai về mặt ý nghĩa dữ liệu
  // Không nên chia doanh thu của tháng đó theo ngày trong tháng vì có ngày 0đồng, có ngày 1 đơn to bằng cả tuần
  const fetchRevenueSummary = async () => {
    if (!storeId) return;
    setLoadingRevenue(true);
    setErrorRevenue(null);
    try {
      const token = localStorage.getItem("token");
      const now = dayjs();
      const periodKey = now.format("YYYY-MM");

      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("periodType", "month");
      params.append("periodKey", periodKey);

      const url = `${apiUrl}/revenues?${params.toString()}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data.revenue || {};

      const totalRevenue =
        typeof data.totalRevenue === "object"
          ? Number(data.totalRevenue.$numberDecimal || 0)
          : data.totalRevenue;
      const countOrders = data.countOrders || 0;
      const completedOrders = data.completedOrders || 0; //  THÊM KHAI BÁO
      const partialRefundOrders = data.partialRefundOrders || 0; //  THÊM KHAI BÁO
      const dailyRevenue = Array.isArray(data.dailyRevenue)
        ? data.dailyRevenue
        : []; //  THÊM KHAI BÁO

      setRevenueSummary({
        totalRevenue,
        countOrders,
        completedOrders, //  THÊM VÀO ĐỂ HIỆN
        partialRefundOrders, //  THÊM VÀO ĐỂ HIỆN
        dailyRevenue,
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setErrorRevenue(err.response?.data?.message || "Lỗi tải doanh thu");
      } else {
        setErrorRevenue("Lỗi tải doanh thu");
      }
    } finally {
      setLoadingRevenue(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      localStorage.setItem(`onboardingSteps_${storeId}`, JSON.stringify(steps));
    }
  }, [steps, storeId]);

  useEffect(() => {
    if (storeId) {
      fetchRevenueSummary();
      fetchTopProductsDashboard();
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    const token = localStorage.getItem("token");
    const now = dayjs().format("YYYY-MM");
    axios
      .get(`${apiUrl}/orders/stats`, {
        params: {
          storeId,
          periodType: "month",
          periodKey: now,
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const {
          total,
          pending,
          refunded,
          paid,
          totalSoldItems,
          totalRefundedItems,
          netSoldItems,
        } = res.data;
        setOrderStats({
          total,
          pending,
          refunded,
          paid,
          totalSoldItems,
          totalRefundedItems,
          netSoldItems,
        });
      })
      .catch((err) => {
        console.error("Lỗi API stats:", err.response?.data || err.message);
      });
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    const token = localStorage.getItem("token");
    const now = dayjs();
    const periodKey = now.format("YYYY-MM");

    const fetchFinancials = async () => {
      setLoadingFinancials(true);
      setErrorFinancials(null);

      try {
        const params = new URLSearchParams({
          storeId,
          periodType: "month",
          periodKey,
        });

        const url = `${apiUrl}/financials?${params.toString()}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setFinancials(res.data.data);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setErrorFinancials(
            err.response?.data?.message || "Lỗi tải báo cáo tài chính"
          );
        } else {
          setErrorFinancials("Lỗi tải báo cáo tài chính");
        }
      } finally {
        setLoadingFinancials(false);
      }
    };

    fetchFinancials();
  }, [storeId]);

  useEffect(() => {
    const fetchExpiring = async () => {
      if (!storeId) return;
      setLoadingExpiring(true);
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `${apiUrl}/products/expiring?storeId=${storeId}&days=30`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setExpiringProducts(res.data.data || []);
      } catch (err) {
        console.error("Lỗi tải sản phẩm sắp hết hạn:", err);
      } finally {
        setLoadingExpiring(false);
      }
    };
    fetchExpiring();
  }, [storeId]);

  const avgOrderValue =
    orderStats.paid > 0 && financials
      ? financials.totalRevenue / orderStats.paid
      : 0;

  const items = [
    {
      key: "toggleCard",
      label: cardVisible ? "Ẩn thông báo này" : "Hiện lại thông báo",
      onClick: () => setCardVisible(!cardVisible),
    },
  ];

  const columnsTopProducts: ColumnsType<TopProduct> = [
    {
      title: "STT",
      key: "index",
      width: 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "productName",
      key: "productName",
      render: (text: string) => (
        <Text strong ellipsis={{ tooltip: text }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Số lượng bán",
      dataIndex: "totalQuantity",
      key: "totalQuantity",
      align: "center",
    },
    {
      title: "Doanh thu",
      dataIndex: "totalSales",
      key: "totalSales",
      align: "right",
      render: (v: TopProduct["totalSales"]) => {
        if (!v) return "₫0";
        const num =
          typeof v === "object" ? v.$numberDecimal || v.toString() : v;
        return new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          minimumFractionDigits: 0,
        }).format(Number(num));
      },
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;

  return (
    <Layout>
      {/* Header Dashboard - MODERN & COMPACT */}
      <div
        className="dashboard-header"
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Nhóm icon: Chuông + Hỏi chấm + User */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Icon hỏi chấm - có dropdown */}
          <Dropdown
            menu={{
              items: [
                {
                  key: "help",
                  icon: <QuestionCircleOutlined />,
                  label: (
                    <Link
                      to="/help"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Trung tâm trợ giúp
                    </Link>
                  ),
                },
                {
                  key: "devices",
                  icon: <LaptopOutlined />,
                  label: (
                    <Link
                      to="/devices"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Thiết bị bán hàng
                    </Link>
                  ),
                },
                {
                  key: "feedback",
                  icon: <MessageOutlined />,
                  label: (
                    <Link
                      to="/feedback"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Đóng góp ý kiến
                    </Link>
                  ),
                },
                {
                  key: "newbie",
                  icon: <BulbOutlined />,
                  label: (
                    <>
                      Dành cho khách hàng mới: cùng SmartRetail làm quen phần
                      mềm qua các bước đơn giản
                      <div style={{ marginTop: 8 }}>
                        <Link
                          to="/product-groups"
                          style={{ fontSize: 14, color: "#1890ff" }}
                        >
                          Tạo nhóm hàng hoá
                        </Link>
                      </div>
                    </>
                  ),
                },
                {
                  type: "divider",
                },
                {
                  key: "support-info",
                  label: (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 16px",
                        background: "#f5f5f5",
                        borderRadius: "4px",
                        margin: "0",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <PhoneOutlined
                          style={{ color: "#52c41a", fontSize: 16 }}
                        />
                        <span style={{ fontWeight: 500 }}>1900 8386</span>
                      </div>
                      <Link
                        to="/support"
                        style={{
                          color: "#1890ff",
                          fontSize: 14,
                          textDecoration: "none",
                          transition: "all 0.2s",
                        }}
                      >
                        <CustomerServiceOutlined style={{ marginRight: 4 }} />{" "}
                        Gửi hỗ trợ
                      </Link>
                    </div>
                  ),
                },
              ],
              style: { width: "100%", maxWidth: 320, padding: "8px" },
            }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <QuestionCircleOutlined
              style={{ fontSize: 20, color: "#8c8c8c", cursor: "pointer" }}
            />
          </Dropdown>

          {/* Icon chuông - Dropdown riêng */}
          <Badge count={unreadCount} overflowCount={99}>
            <BellOutlined
              style={{ fontSize: 20, color: "#474646", cursor: "pointer" }}
              onClick={() => setPanelVisible(true)}
            />
          </Badge>
          <NotificationPanel
            storeId={storeId}
            visible={panelVisible}
            onClose={() => setPanelVisible(false)}
          />

          {/* Phần avata và dropdown - RESPONSIVE */}
          <Dropdown
            placement="bottomRight"
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "profile",
                  icon: <UserOutlined />,
                  label: (
                    <Link
                      to="/settings/profile"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Tài khoản của bạn
                    </Link>
                  ),
                },
                {
                  key: "package",
                  icon: <CreditCardOutlined />,
                  label: (
                    <Link
                      to="/settings/subscription"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Thông tin gói dịch vụ
                    </Link>
                  ),
                },
                {
                  type: "divider",
                },
                {
                  key: "terms",
                  icon: <FileTextOutlined />,
                  label: (
                    <Link
                      to="/terms"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Điều khoản dịch vụ
                    </Link>
                  ),
                },
                {
                  key: "privacy",
                  icon: <LockOutlined />,
                  label: (
                    <Link
                      to="/privacy"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Chính sách bảo mật
                    </Link>
                  ),
                },
              ],
              style: { width: 220 },
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                gap: 8,
                padding: "4px 8px",
                borderRadius: 6,
                transition: "background 0.2s",
                backgroundColor: "#f5f5f5",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#ecebebff")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <img
                src={
                  user?.image ||
                  "https://cdn-icons-png.flaticon.com/512/9131/9131529.png"
                }
                alt="avatar"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.onerror = null; // tránh loop
                  target.src =
                    "https://cdn-icons-png.flaticon.com/512/9131/9131529.png";
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #9a0505ff",
                }}
              />

              <span
                style={{
                  fontWeight: 500,
                  color: "#595959",
                  display: window.innerWidth < 768 ? "none" : "inline",
                }}
              >
                {user?.fullname || user?.fullName || "Người dùng"}
              </span>
              <DownOutlined style={{ fontSize: 12, color: "#8c8c8c" }} />
            </div>
          </Dropdown>
        </div>
      </div>

      {/* Phần body dashboard - RESPONSIVE PADDING */}
      <div className="dashboard-body" style={{ padding: "16px" }}>
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ fontSize: "clamp(18px, 5vw, 24px)" }}>
            Xin chào, {user?.fullname || user?.fullName || "Manager"} 👋
          </Title>
          <Text type="secondary" style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
            Đang xem Dashboard của cửa hàng:{" "}
            <b>{currentStore?.name || storeId}</b>
          </Text>
        </div>

        {/* Onboarding Card */}
        {/* {showOnboardingCard && (
          <div style={{ marginBottom: 24 }}>
            <Card
              style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
              title={
                <Space
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <Text strong style={{ fontSize: "clamp(13px, 3vw, 15px)" }}>
                    Cùng SmartRetail làm quen các bước xây dựng và vận hành cửa hàng nhé
                  </Text>
                  <Tooltip title="Thao tác với thông báo">
                    <Dropdown menu={{ items }} trigger={["click"]}>
                      <Button type="text" icon={<EllipsisOutlined />} />
                    </Dropdown>
                  </Tooltip>
                </Space>
              }
            >
              {cardVisible && (
                <>
                  <Text strong style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                    Đã hoàn thành {completedSteps} trên {steps.length} bước
                  </Text>
                  <Progress percent={(completedSteps / steps.length) * 100} size="small" style={{ margin: "12px 0 20px" }} />

                  <Collapse>
                    {steps.map((step) => (
                      <Collapse.Panel
                        key={step.key}
                        header={<span style={{ fontSize: "clamp(13px, 3vw, 14px)" }}>{step.title}</span>}
                        extra={
                          <Tooltip title={step.completed ? "Nhấn để bỏ đánh dấu" : "Nhấn để đánh dấu đã hoàn thành"}>
                            <div
                              className={`onboarding-tag ${!step.completed ? "pulse-animation-dashboard" : ""}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: step.completed ? "#f6ffed" : "#fff7e6",
                                border: `1px solid ${step.completed ? "#b7eb8f" : "#ffd591"}`,
                                color: step.completed ? "#52c41a" : "#fa8c16",
                                cursor: "pointer",
                                userSelect: "none",
                                transition: "all 0.2s ease",
                                fontSize: "clamp(11px, 2.5vw, 13px)",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSteps((prev) => prev.map((s) => (s.key === step.key ? { ...s, completed: !s.completed } : s)));
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = step.completed ? "#d4edda" : "#ffe7ba";
                                e.currentTarget.style.transform = "translateY(-1px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = step.completed ? "#f6ffed" : "#fff7e6";
                                e.currentTarget.style.transform = "translateY(0)";
                              }}
                            >
                              {step.completed ? (
                                <>
                                  <CheckCircleFilled style={{ fontSize: 14 }} />
                                  <span style={{ fontWeight: 500 }}>Hoàn thành</span>
                                </>
                              ) : (
                                <>
                                  <EditOutlined style={{ fontSize: 13, opacity: 0.7 }} />
                                  <span>Chưa xong</span>
                                </>
                              )}
                            </div>
                          </Tooltip>
                        }
                      >
                        <p style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>{step.description}</p>
                        {step.actions?.map((act) => (
                          <Button
                            key={act.label}
                            type="primary"
                            style={{
                              backgroundColor: "#1677ff",
                              borderColor: "#1677ff",
                              borderRadius: 6,
                              margin: "20px 0px 10px 5px",
                              fontSize: "clamp(12px, 3vw, 14px)",
                            }}
                            onClick={() => navigate(act.link)}
                          >
                            {act.label}
                          </Button>
                        ))}
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                </>
              )}
            </Card>
          </div>
        )} */}


        {/* Expiry Alerts - Ẩn với role STAFF */}
        {expiringProducts.length > 0 && user?.role?.toUpperCase() !== "STAFF" && (
          <div style={{ marginBottom: 24 }}>
            <Alert
              message={
                <Text strong style={{ fontSize: 16 }}>
                  🔔 Cảnh báo kho hàng:{" "}
                  {expiringProducts.some((p: any) => p.status === "expired")
                    ? "Phát hiện lô hàng ĐÃ HẾT HẠN"
                    : "Lô hàng sắp hết hạn"}
                </Text>
              }
              description={
                <div style={{ marginTop: 8 }}>
                  <div style={{ marginBottom: 12 }}>
                    {expiringProducts.slice(0, 5).map((p: any, i: number) => {
                      const isExp = p.status === "expired";
                      return (
                        <div
                          key={i}
                          style={{
                            marginBottom: 6,
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: isExp ? "#fff1f0" : "transparent",
                            borderLeft: `4px solid ${
                              isExp ? "#ff4d4f" : "#faad14"
                            }`,
                          }}
                        >
                          <Badge status={isExp ? "error" : "warning"} />
                          <Text strong={isExp} delete={isExp}>
                            {" "}
                            {p.name}{" "}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            (SKU: {p.sku})
                          </Text>
                          {" - Lô: "}
                          <b>{p.batch_no}</b>
                          {" - HSD: "}
                          <Text
                            style={{
                              color: isExp ? "#f5222d" : "#d46b08",
                              fontWeight: 600,
                            }}
                          >
                            {dayjs(p.expiry_date).format("DD/MM/YYYY")}
                          </Text>
                          {isExp && (
                            <Tag color="error" style={{ marginLeft: 8 }}>
                              Đã hết hạn
                            </Tag>
                          )}
                          {!isExp && (
                            <Tag color="warning" style={{ marginLeft: 8 }}>
                              Sắp hết hạn
                            </Tag>
                          )}
                          <Text style={{ marginLeft: 8 }}>
                            | SL: <b>{p.quantity}</b>
                          </Text>
                        </div>
                      );
                    })}
                    {expiringProducts.length > 5 && (
                      <div
                        style={{
                          fontStyle: "italic",
                          marginLeft: 12,
                          marginTop: 4,
                        }}
                      >
                        ... và {expiringProducts.length - 5} lô hàng khác.
                      </div>
                    )}
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => navigate("/inventory/process-expired")}
                      danger={expiringProducts.some(
                        (p: any) => p.status === "expired"
                      )}
                    >
                      Xử lý ngay
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setExpiringProducts([])}
                      type="text"
                    >
                      Để sau
                    </Button>
                  </Space>
                </div>
              }
              type={
                expiringProducts.some((p: any) => p.status === "expired")
                  ? "error"
                  : "warning"
              }
              showIcon
              style={{
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                border: "1px solid #ffccc7",
              }}
            />
          </div>
        )}

        {/* Kết quả kinh doanh - RESPONSIVE GRID */}
        <div style={{ marginBottom: 24 }}>
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Text strong style={{ fontSize: "clamp(13px, 3vw, 15px)" }}>
                  Kết quả kinh doanh tháng {dayjs().format("MM/YYYY")}
                </Text>
                <Link
                  to="/reports/dashboard"
                  style={{ fontSize: "clamp(12px, 3vw, 14px)" }}
                >
                  Xem chi tiết
                </Link>
              </Space>
            }
            style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
              {/* Dòng 1 - ô 1 */}
              <Tooltip title="Tổng doanh thu cửa hàng bạn thu được từ bán hàng chưa trừ chi phí gì.">
                <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Doanh thu
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#1890ff",
                        fontSize: "clamp(16px, 4vw, 20px)",
                        wordBreak: "break-word",
                      }}
                    >
                      {loadingFinancials ? (
                        <Spin size="small" />
                      ) : financials ? (
                        new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                          minimumFractionDigits: 0,
                        }).format(financials.totalRevenue)
                      ) : (
                        "₫0"
                      )}
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>

              {/* Doanh thu thuần */}
              <Tooltip title="Doanh thu thuần = Doanh thu thực - VAT thu hộ. Đây là doanh thu thực tế sau khi trừ thuế.">
                <div className="p-4 bg-indigo-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Doanh thu thuần
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#6366f1",
                        fontSize: "clamp(16px, 4vw, 20px)",
                        wordBreak: "break-word",
                      }}
                    >
                      {loadingFinancials ? (
                        <Spin size="small" />
                      ) : financials ? (
                        new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                          minimumFractionDigits: 0,
                        }).format(financials.netSales || 0)
                      ) : (
                        "₫0"
                      )}
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#6366f1",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>

              {/* Dòng 1 - ô 2 */}
              {/* <Tooltip title="Trung bình mỗi đơn khách chi trả, công thức: Doanh thu thuần / Số đơn đã bán">
                <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                      Giá trị trung bình / đơn
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#52c41a",
                        fontSize: "clamp(16px, 4vw, 20px)",
                        wordBreak: "break-word",
                      }}
                    >
                      {avgOrderValue.toLocaleString("vi-VN", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      ₫
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip> */}

              {/* Dòng 2 - ô 2 */}
              <Tooltip title="Doanh thu thuần − Giá vốn hàng bán (COGS). Đây là số tiền còn lại sau khi trừ chi phí nguyên vật liệu, chưa bao gồm chi phí vận hành khác.">
                <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Lợi nhuận gộp
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color:
                          (financials?.grossProfit ?? 0) >= 0
                            ? "#389e0d"
                            : "#f5222d",
                        fontSize: "clamp(16px, 4vw, 20px)",
                        wordBreak: "break-word",
                      }}
                    >
                      {loadingFinancials ? (
                        <Spin size="small" />
                      ) : financials ? (
                        new Intl.NumberFormat("vi-VN", {
                          style: "currency",
                          currency: "VND",
                          minimumFractionDigits: 0,
                        }).format(financials.grossProfit)
                      ) : (
                        "₫0"
                      )}
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#389e0d",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>

              {/* Dòng 1 - ô 3 */}
              <Tooltip title="Tổng số đơn hàng đã tạo, bao gồm cả đã thanh toán và chưa thanh toán.">
                <div className="p-4 bg-orange-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Tổng tất cả các đơn hàng
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#fa8c16",
                        fontSize: "clamp(16px, 4vw, 20px)",
                      }}
                    >
                      {orderStats.total}
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#fa8c16",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>

              {/* Dòng 2 - ô 1 */}
              <Tooltip
                title={
                  <>
                    Tổng số sản phẩm trên các đơn hàng, sau khi đã trừ đi các
                    đơn bị hoàn trả.
                    <br />• Tổng đã bán:{" "}
                    {orderStats.totalSoldItems.toLocaleString("vi-VN")}
                    <br />• Hoàn lại:{" "}
                    {orderStats.totalRefundedItems.toLocaleString("vi-VN")}
                    <br />• Thực đã bán:{" "}
                    {orderStats.netSoldItems.toLocaleString("vi-VN")}
                  </>
                }
              >
                {/*  span bọc ngoài nhưng ép block để không phá grid */}
                <span className="block col-span-1 sm:col-span-1 lg:col-span-4">
                  <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between cursor-pointer">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                      >
                        Số lượng hàng hóa thực bán
                      </Text>
                      <Title
                        level={4}
                        style={{
                          margin: 0,
                          color: "#722ed1",
                          fontSize: "clamp(16px, 4vw, 20px)",
                        }}
                      >
                        {orderStats.netSoldItems.toLocaleString("vi-VN")}
                      </Title>
                    </div>

                    <InfoCircleOutlined
                      style={{
                        color: "#1890ff",
                        fontSize: 16,
                        marginLeft: 8,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </span>
              </Tooltip>

              {/* Dòng 2 - ô 3 */}
              <Tooltip title="Số đơn hàng chưa được khách thanh toán.">
                <div className="p-4 bg-red-50 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Đơn hàng chưa thanh toán
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#f5222d",
                        fontSize: "clamp(16px, 4vw, 20px)",
                      }}
                    >
                      {orderStats.pending}
                    </Title>
                  </div>
                  <InfoCircleOutlined
                    style={{
                      color: "#f5222d",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>

              {/* Dòng 2 - ô 4 */}
              <Tooltip title="Số đơn hàng khách đã trả lại và hoàn tiền.">
                <div className="p-4 bg-gray-100 rounded-lg flex items-center justify-between col-span-1 sm:col-span-1 lg:col-span-4 cursor-pointer">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      type="secondary"
                      style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}
                    >
                      Đơn hàng bị hoàn trả
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#595959",
                        fontSize: "clamp(16px, 4vw, 20px)",
                      }}
                    >
                      {orderStats.refunded}
                    </Title>
                  </div>

                  <InfoCircleOutlined
                    style={{
                      color: "#595959",
                      fontSize: 16,
                      cursor: "pointer",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                  />
                </div>
              </Tooltip>
            </div>
          </Card>
        </div>

        {/* Biểu đồ doanh thu tổng quan - RESPONSIVE*/}
        {/* <div style={{ marginBottom: 24 }}>
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Text strong style={{ fontSize: "clamp(13px, 3vw, 15px)" }}>
                  Biểu đồ doanh thu tháng {dayjs().format("MM/YYYY")}
                </Text>
                <Link to="/reports/revenue" style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                  Xem chi tiết
                </Link>
              </Space>
            }
            style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
          >
            {loadingRevenue ? (
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spin tip="Đang tải...">
                  <div style={{ minHeight: 60 }} />
                </Spin>
              </div>
            ) : errorRevenue ? (
              <Alert type="error" message={errorRevenue} />
            ) : revenueSummary ? (
              <div>
                {revenueSummary.dailyRevenue?.length ? (
                  <ResponsiveContainer width="100%" height={220} minWidth={280}>
                    <LineChart data={revenueSummary.dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => {
                          if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}T`;
                          if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                          if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                          return v;
                        }}
                      />
                      <RechartsTooltip
                        formatter={(value: number) =>
                          new Intl.NumberFormat("vi-VN", {
                            style: "currency",
                            currency: "VND",
                            minimumFractionDigits: 0,
                          }).format(value)
                        }
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "none",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#1890ff"
                        strokeWidth={2.5}
                        dot={{ fill: "#1890ff", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Text type="secondary" style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                    (Không có dữ liệu theo ngày)
                  </Text>
                )}

                <Space direction="vertical" size="small" style={{ marginTop: 16, width: "100%" }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                      Tổng doanh thu tháng {dayjs().format("MM/YYYY")}
                    </Text>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        color: "#1890ff",
                        fontSize: "clamp(16px, 4vw, 20px)",
                        wordBreak: "break-word",
                      }}
                    >
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        minimumFractionDigits: 0,
                      }).format(
                        typeof revenueSummary.totalRevenue === "object"
                          ? Number(revenueSummary.totalRevenue.$numberDecimal || 0)
                          : revenueSummary.totalRevenue
                      )}
                    </Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: "clamp(11px, 2.5vw, 13px)" }}>
                      Số đơn hàng: <b>{revenueSummary.countOrders}</b>
                      <Popover
                        title="Chi tiết đơn hàng"
                        content={
                          <div style={{ fontSize: 12 }}>
                            <div>
                               Đã hoàn thành: <b>{revenueSummary.completedOrders ?? "—"}</b>
                            </div>
                            <div>
                              ↩️ Hoàn 1 phần: <b>{revenueSummary.partialRefundOrders ?? "—"}</b>
                            </div>
                          </div>
                        }
                      >
                        <InfoCircleOutlined style={{ marginLeft: 6, color: "#1677ff", cursor: "pointer" }} />
                      </Popover>
                    </Text>
                  </div>
                </Space>
              </div>
            ) : (
              <Text type="secondary" style={{ fontSize: "clamp(12px, 3vw, 14px)" }}>
                Không có dữ liệu
              </Text>
            )}
          </Card>
        </div>  */}

        {/* Top sản phẩm bán chạy - RESPONSIVE TABLE */}
        <div style={{ marginBottom: 24 }}>
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Text strong style={{ fontSize: "clamp(13px, 3vw, 15px)" }}>
                  Top 5 sản phẩm bán chạy tháng {dayjs().format("MM/YYYY")}
                </Text>
                <Link
                  to="/reports/top-products"
                  style={{ fontSize: "clamp(12px, 3vw, 14px)" }}
                >
                  Xem chi tiết
                </Link>
              </Space>
            }
            style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
          >
            {loadingTopProducts ? (
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spin tip="Đang tải...">
                  <div style={{ minHeight: 60 }} />
                </Spin>
              </div>
            ) : errorTopProducts ? (
              <Alert type="error" message={errorTopProducts} />
            ) : topProducts.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <Table
                  columns={columnsTopProducts}
                  dataSource={topProducts}
                  rowKey="_id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </div>
            ) : (
              <Text
                type="secondary"
                style={{ fontSize: "clamp(12px, 3vw, 14px)" }}
              >
                Chưa có dữ liệu sản phẩm bán chạy
              </Text>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
