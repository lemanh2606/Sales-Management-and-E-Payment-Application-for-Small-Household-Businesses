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
// import Swal from "sweetalert2";
import "./DashboardPage.css";
import NotificationPanel from "../pages/setting/NotificationPanel";
import { io } from "socket.io-client";
const apiUrl = import.meta.env.VITE_API_URL;

const socket = io(import.meta.env.VITE_API_URL.replace("/api", ""), {
  auth: { token: localStorage.getItem("token") },
}); // Kết nối socket với token

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

  //State của phần 7 cái Stats
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

  // State của phần sản phẩm bán chạy
  const [topProducts, setTopProducts] = useState([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [errorTopProducts, setErrorTopProducts] = useState<string | null>(null);

  //state của phần biểu đồ doanh thu
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(
    null
  );
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [errorRevenue, setErrorRevenue] = useState<string | null>(null);

  const [steps, setSteps] = useState<OnboardingStep[]>(() => {
    // Lấy từ localStorage nếu có, không thì dùng mặc định, lưu theo cả storeId để sang store khác ko bị đánh dấu bừa
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
          "Bạn kinh doanh sản phẩm gì? Hãy thêm sản phẩm đầu tiên để bắt đầu quản lý.",
        completed: false,
        actions: [{ label: "Thêm sản phẩm", link: "/products" }],
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
    // 1. Fetch lần đầu
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
    // 2. Lắng nghe event từ NotificationPanel
    const handleNotificationUpdate = (e: Event) => {
      const event = e as CustomEvent<{ unreadCount: number }>;
      if (event.detail?.unreadCount !== undefined) {
        setUnreadCount(event.detail.unreadCount);
      }
    };
    window.addEventListener("notifications:updated", handleNotificationUpdate);
    // 3. Lắng nghe socket (payment_success)
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
      // Thay vì "thisYear", dùng "thisMonth"
      params.append("range", "thisMonth");
      params.append("limit", "5"); // top 5

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

  const fetchRevenueSummary = async () => {
    if (!storeId) return;
    setLoadingRevenue(true);
    setErrorRevenue(null);
    try {
      const token = localStorage.getItem("token");
      const now = dayjs();
      const periodKey = now.format("YYYY-MM");
      //const periodKey = now.subtract(1, "month").format("YYYY-MM"); // 2025-10 (lùi 1 tháng vì tháng 10 mới có dữ liệu test)

      const params = new URLSearchParams();
      params.append("storeId", storeId);
      params.append("periodType", "month");
      params.append("periodKey", periodKey);

      const url = `${apiUrl}/revenues?${params.toString()}`;
      //console.log(url);
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data.revenue || {};

      // Lấy tổng
      const totalRevenue =
        typeof data.totalRevenue === "object"
          ? Number(data.totalRevenue.$numberDecimal || 0)
          : data.totalRevenue;
      const countOrders = data.countOrders || 0;

      // Lấy ra năm-tháng từ periodKey (VD: "2025-10")
      const [year, month] = periodKey.split("-").map(Number);
      // Số ngày trong tháng
      const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();

      // Fake doanh thu mỗi ngày (ngẫu nhiên nhẹ, tổng ~ gần totalRevenue)
      const fakeDaily = Array.from({ length: daysInMonth }, (_, i) => {
        const base = totalRevenue / daysInMonth;
        const randomFactor = Math.random() * 0.4 + 0.8; // dao động 80–120%
        return {
          day: `${i + 1}`,
          revenue: Math.floor(base * randomFactor),
        };
      });
      setRevenueSummary({
        totalRevenue,
        countOrders,
        dailyRevenue: fakeDaily,
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

  //Effect của biểu đồ doanh thu và sản phẩm bán chạy để chung luôn
  useEffect(() => {
    if (storeId) {
      fetchRevenueSummary();
      fetchTopProductsDashboard();
    }
  }, [storeId]);

  //Effect của Order
  useEffect(() => {
    if (!storeId) return;

    const token = localStorage.getItem("token");
    // Gọi API stats theo năm hiện tại
    const now = dayjs().format("YYYY");
    axios
      .get(`${apiUrl}/orders/stats`, {
        params: {
          storeId,
          periodType: "year",
          periodKey: now,
        },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        // Chỉ lấy 4 số liệu, bỏ qua mảng orders
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
    const periodKey = now.format("YYYY"); // năm hiện tại

    const fetchFinancials = async () => {
      setLoadingFinancials(true);
      setErrorFinancials(null);

      try {
        const params = new URLSearchParams({
          storeId,
          periodType: "year",
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

  // === Đây là vị trí hợp lý để tính giá trị trung bình đơn ===
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
      {/* Header Dashboard */}
      <div
        style={{
          padding: "0px 24px 24px 24px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Ô tìm kiếm */}
        <Input
          placeholder="Tìm kiếm đơn hàng, sản phẩm, khách hàng..."
          style={{ width: 600 }}
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          allowClear
        />

        {/* Nhóm 2 icon: Chuông + Hỏi chấm */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Icon hỏi chấm - có dropdown */}
          <Dropdown
            overlay={
              <Menu style={{ width: 300, padding: "16px" }}>
                {/* 4 lựa chọn */}
                <Menu.Item key="help" icon={<QuestionCircleOutlined />}>
                  <Link
                    to="/help"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Trung tâm trợ giúp
                  </Link>
                </Menu.Item>
                <Menu.Item key="devices" icon={<LaptopOutlined />}>
                  <Link
                    to="/devices"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Thiết bị bán hàng
                  </Link>
                </Menu.Item>
                <Menu.Item key="feedback" icon={<MessageOutlined />}>
                  <Link
                    to="/feedback"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Đóng góp ý kiến
                  </Link>
                </Menu.Item>
                <Menu.Item key="newbie" icon={<BulbOutlined />}>
                  Dành cho khách hàng mới: cùng SmartRetail làm quen phần mềm
                  qua các bước đơn giản
                  <div style={{ marginTop: 8 }}>
                    <Link
                      to="/products"
                      style={{ fontSize: 14, color: "#1890ff" }}
                    >
                      Thêm sản phẩm
                    </Link>
                  </div>
                </Menu.Item>

                {/* Footer: Hotline + Link hỗ trợ */}
                <Menu.Divider />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 16px",
                    background: "#f5f5f5",
                    borderRadius: "4px",
                    margin: "8px 0 0 0",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <PhoneOutlined style={{ color: "#52c41a", fontSize: 16 }} />
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
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.textDecoration = "underline")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.textDecoration = "none")
                    }
                  >
                    <CustomerServiceOutlined style={{ marginRight: 4 }} /> Gửi
                    hỗ trợ
                  </Link>
                </div>
              </Menu>
            }
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
          {/* Phần Panel Chuông  */}
          <NotificationPanel
            storeId={storeId}
            visible={panelVisible}
            onClose={() => setPanelVisible(false)}
          />

          {/* Phần avata và dropdown */}
          <Dropdown
            placement="bottomRight"
            trigger={["click"]}
            overlay={
              <Menu style={{ width: 220 }}>
                <Menu.Item key="profile" icon={<UserOutlined />}>
                  <Link
                    to="/settings/profile"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Tài khoản của bạn
                  </Link>
                </Menu.Item>
                <Menu.Item key="package" icon={<CreditCardOutlined />}>
                  <Link
                    to="/settings/subscription"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Thông tin gói dịch vụ
                  </Link>
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item key="terms" icon={<FileTextOutlined />}>
                  <Link
                    to="/terms"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Điều khoản dịch vụ
                  </Link>
                </Menu.Item>

                <Menu.Item key="privacy" icon={<LockOutlined />}>
                  <Link
                    to="/privacy"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    Chính sách bảo mật
                  </Link>
                </Menu.Item>
              </Menu>
            }
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
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #9a0505ff",
                }}
              />
              <span style={{ fontWeight: 500, color: "#595959" }}>
                {user?.fullname || "Người dùng"}
              </span>
              <DownOutlined style={{ fontSize: 12, color: "#8c8c8c" }} />
            </div>
          </Dropdown>
        </div>
      </div>

      {/* Phần body dashboard */}
      <div className="p-6 space-y-6">
        <div>
          <Title level={3}>Xin chào, {user?.fullname || "Manager"} 👋</Title>
          <Text type="secondary">
            Đang xem Dashboard của cửa hàng:{" "}
            <b>{currentStore?.name || storeId}</b>
          </Text>
        </div>

        {/* Onboarding Card */}
        {showOnboardingCard && (
          <div className="grid gap-6">
            <Card
              style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
              title={
                <Space
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <Text strong>
                    Cùng SmartRetail làm quen các bước xây dựng và vận hành cửa
                    hàng nhé
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
                  <Text strong>
                    Đã hoàn thành {completedSteps} trên {steps.length} bước
                  </Text>
                  <Progress
                    percent={(completedSteps / steps.length) * 100}
                    size="small"
                    style={{ margin: "12px 0 20px" }}
                  />

                  <Collapse>
                    {steps.map((step) => (
                      <Collapse.Panel
                        key={step.key}
                        header={step.title}
                        extra={
                          <Tooltip
                            title={
                              step.completed
                                ? "Nhấn để bỏ đánh dấu"
                                : "Nhấn để đánh dấu đã hoàn thành"
                            }
                          >
                            <div
                              className={`onboarding-tag ${
                                !step.completed
                                  ? "pulse-animation-dashboard"
                                  : ""
                              }`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: step.completed
                                  ? "#f6ffed"
                                  : "#fff7e6",
                                border: `1px solid ${
                                  step.completed ? "#b7eb8f" : "#ffd591"
                                }`,
                                color: step.completed ? "#52c41a" : "#fa8c16",
                                cursor: "pointer",
                                userSelect: "none",
                                transition: "all 0.2s ease",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSteps((prev) =>
                                  prev.map((s) =>
                                    s.key === step.key
                                      ? { ...s, completed: !s.completed }
                                      : s
                                  )
                                );
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  step.completed ? "#d4edda" : "#ffe7ba";
                                e.currentTarget.style.transform =
                                  "translateY(-1px)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  step.completed ? "#f6ffed" : "#fff7e6";
                                e.currentTarget.style.transform =
                                  "translateY(0)";
                              }}
                            >
                              {step.completed ? (
                                <>
                                  <CheckCircleFilled style={{ fontSize: 14 }} />
                                  <span style={{ fontWeight: 500 }}>
                                    Hoàn thành
                                  </span>
                                </>
                              ) : (
                                <>
                                  <EditOutlined
                                    style={{ fontSize: 13, opacity: 0.7 }}
                                  />
                                  <span>Chưa xong</span>
                                </>
                              )}
                            </div>
                          </Tooltip>
                        }
                      >
                        <p>{step.description}</p>
                        {step.actions?.map((act) => (
                          <Button
                            key={act.label}
                            type="primary"
                            style={{
                              backgroundColor: "#1677ff",
                              borderColor: "#1677ff",
                              borderRadius: 6,
                              margin: "20px 0px 10px 5px",
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
        )}

        {/* Kết quả kinh doanh */}
        <div className="grid gap-6">
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <Text strong>
                  Kết quả kinh doanh năm {dayjs().format("YYYY")}
                </Text>
                <Link to="/reports/dashboard">Xem chi tiết</Link>
              </Space>
            }
            style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
          >
            <div className="grid grid-cols-12 gap-4">
              {/* Dòng 1 */}
              <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-4">
                <div>
                  <Text type="secondary">Doanh thu</Text>
                  <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
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
                <Tooltip title="Tổng doanh thu cửa hàng bạn thu được từ bán hàng chưa trừ chi phí gì.">
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-4">
                <div>
                  <Text type="secondary">Giá trị trung bình đơn</Text>
                  <Title level={4} style={{ margin: 0, color: "#52c41a" }}>
                    {avgOrderValue.toLocaleString("vi-VN", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    ₫
                  </Title>
                </div>
                <Tooltip title="Trung bình mỗi đơn khách chi trả, công thức: Doanh thu thuần / Số đơn đã bán">
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-4">
                <div>
                  <Text type="secondary">Tổng đơn</Text>
                  <Title level={4} style={{ margin: 0, color: "#fa8c16" }}>
                    {orderStats.total}
                  </Title>
                </div>
                <Tooltip title="Tổng số đơn hàng đã tạo, bao gồm cả đã thanh toán và chưa thanh toán.">
                  <InfoCircleOutlined
                    style={{
                      color: "#fa8c16",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              {/* Dòng 2 */}
              <div className="p-4 bg-purple-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-3">
                <div>
                  <Text type="secondary">Số lượng hàng thực bán</Text>
                  <Title level={4} style={{ margin: 0, color: "#722ed1" }}>
                    {orderStats.netSoldItems.toLocaleString("vi-VN")}
                  </Title>
                </div>
                <Tooltip
                  title={`Tổng số sản phẩm trên các đơn hàng, sau khi đã trừ đi các đơn bị hoàn trả.
                    • Tổng bán: ${orderStats.totalSoldItems.toLocaleString(
                      "vi-VN"
                    )}
                    • Hoàn: ${orderStats.totalRefundedItems.toLocaleString(
                      "vi-VN"
                    )}
                    • Thực bán: ${orderStats.netSoldItems.toLocaleString(
                      "vi-VN"
                    )}
                  `}
                >
                  <InfoCircleOutlined
                    style={{
                      color: "#1890ff",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              <div className="p-4 bg-green-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-4">
                <div>
                  <Text type="secondary">Tiền lãi thực</Text>
                  <Title
                    level={4}
                    style={{
                      margin: 0,
                      color:
                        (financials?.netProfit ?? 0) >= 0
                          ? "#389e0d"
                          : "#f5222d",
                    }}
                  >
                    {loadingFinancials ? (
                      <Spin size="small" />
                    ) : financials ? (
                      new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        minimumFractionDigits: 0,
                      }).format(financials.netProfit)
                    ) : (
                      "₫0"
                    )}
                  </Title>
                </div>
                <Tooltip title="Số tiền lãi thực tế cửa hàng thu được, sau khi trừ tất cả chi phí vận hành, nguyên vật liệu, nhân công, thuế và các khoản khác.">
                  <InfoCircleOutlined
                    style={{
                      color: "#389e0d",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              <div className="p-4 bg-red-50 rounded-lg flex items-center justify-between col-span-12 md:col-span-3">
                <div>
                  <Text type="secondary">Chưa thanh toán</Text>
                  <Title level={4} style={{ margin: 0, color: "#f5222d" }}>
                    {orderStats.pending}
                  </Title>
                </div>
                <Tooltip title="Số đơn hàng chưa được khách thanh toán.">
                  <InfoCircleOutlined
                    style={{
                      color: "#f5222d",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>

              <div className="p-4 bg-gray-100 rounded-lg flex items-center justify-between col-span-12 md:col-span-2">
                <div>
                  <Text type="secondary">Đơn bị hoàn trả</Text>
                  <Title level={4} style={{ margin: 0, color: "#595959" }}>
                    {orderStats.refunded}
                  </Title>
                </div>
                <Tooltip title="Số đơn hàng khách đã trả lại và hoàn tiền.">
                  <InfoCircleOutlined
                    style={{
                      color: "#595959",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          </Card>
        </div>

        {/* Biểu đồ doanh thu tổng quan */}
        <div className="grid gap-6">
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <Text strong>
                  Biểu đồ doanh thu tháng {dayjs().format("MM/YYYY")}
                </Text>
                <Link to="/reports/revenue">Xem chi tiết</Link>
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
                <Spin tip="Đang tải..." />
              </div>
            ) : errorRevenue ? (
              <Alert type="error" message={errorRevenue} />
            ) : revenueSummary ? ( // <-- chỉ check có summary là render
              <div>
                {revenueSummary.dailyRevenue?.length ? (
                  // Có dữ liệu daily thì vẽ chart
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={revenueSummary.dailyRevenue}
                      margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => {
                          if (v >= 1_000_000_000)
                            return `${(v / 1_000_000_000).toFixed(1)}T`;
                          if (v >= 1_000_000)
                            return `${(v / 1_000_000).toFixed(1)}M`;
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
                  <Text type="secondary">(Không có dữ liệu theo ngày)</Text>
                )}

                <Space
                  direction="vertical"
                  size="small"
                  style={{ marginTop: 16, width: "100%" }}
                >
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Tổng doanh thu tháng {dayjs().format("MM/YYYY")}
                    </Text>
                    <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        minimumFractionDigits: 0,
                      }).format(
                        typeof revenueSummary.totalRevenue === "object"
                          ? Number(
                              revenueSummary.totalRevenue.$numberDecimal || 0
                            )
                          : revenueSummary.totalRevenue
                      )}
                    </Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Số đơn hàng trong tháng {dayjs().format("MM/YYYY")} là:{" "}
                    </Text>
                    <Text strong style={{ color: "#52c41a", fontSize: 16 }}>
                      {revenueSummary.countOrders} đơn
                    </Text>
                  </div>
                </Space>
              </div>
            ) : (
              <Text type="secondary">Chưa có doanh thu trong tháng này</Text>
            )}
          </Card>
        </div>

        {/* Sản phẩm bán chạy tổng quan */}
        <div className="grid gap-6">
          <Card
            title={
              <Space
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <Text strong>
                  Sản phẩm bán chạy tháng {now.format("MM/YYYY")}
                </Text>
                <Link to="/reports/top-products">Xem chi tiết</Link>
              </Space>
            }
            style={{ border: "1px solid #8c8c8c", borderRadius: 12 }}
          >
            {loadingTopProducts ? (
              <Spin tip="Đang tải top sản phẩm..." />
            ) : errorTopProducts ? (
              <Alert type="error" message={errorTopProducts} />
            ) : (
              <Table
                columns={columnsTopProducts}
                dataSource={topProducts}
                rowKey="_id"
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
