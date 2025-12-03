// src/screens/DashboardScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/apiClient"; // 🚀 IMPORT APICLIENT
import dayjs from "dayjs";
import { LineChart, BarChart, PieChart } from "react-native-chart-kit";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

// ==================== TYPES ====================
interface Store {
  _id: string;
  name: string;
  [key: string]: any;
}

interface OrderStats {
  total: number;
  pending: number;
  refunded: number;
  paid: number;
  netSoldItems: number;
}

interface FinancialData {
  totalRevenue: number;
  netProfit: number;
  expenses: number;
}

interface TopProduct {
  _id: string;
  productName: string;
  totalQuantity: number;
  totalSales: number | { $numberDecimal?: string };
  category?: string;
}

interface RevenueResponse {
  revenue: {
    totalRevenue: number | { $numberDecimal?: string };
    countOrders: number;
  };
}

interface CategoryDistribution {
  name: string;
  value: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

// ==================== SUB-COMPONENTS ====================
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: string;
  gradient: readonly [string, string];
  trend?: number;
}> = ({ title, value, subtitle, icon, color, gradient, trend }) => (
  <LinearGradient
    colors={gradient}
    style={[styles.statCard, styles.cardShadow]}
  >
    <View style={styles.statHeader}>
      <View
        style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}
      >
        <Text style={[styles.statIcon, { color }]}>{icon}</Text>
      </View>
      {trend !== undefined && (
        <View
          style={[
            styles.trendBadge,
            { backgroundColor: trend >= 0 ? "#10b98120" : "#ef444420" },
          ]}
        >
          <Text
            style={[
              styles.trendText,
              { color: trend >= 0 ? "#10b981" : "#ef4444" },
            ]}
          >
            {trend >= 0 ? "↗" : "↘"} {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={styles.statSubtitle}>{subtitle}</Text>
  </LinearGradient>
);

const MetricProgress: React.FC<{
  label: string;
  value: number;
  target: number;
  color: string;
  icon: string;
}> = ({ label, value, target, color, icon }) => {
  const progress = Math.min((value / target) * 100, 100);

  return (
    <View style={styles.metricContainer}>
      <View style={styles.metricHeader}>
        <View style={styles.metricTitle}>
          <Text style={[styles.metricIcon, { color }]}>{icon}</Text>
          <Text style={styles.metricLabel}>{label}</Text>
        </View>
        <Text style={styles.metricValue}>
          {value}/{target}
        </Text>
      </View>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{progress.toFixed(0)}% hoàn thành</Text>
    </View>
  );
};

// ==================== MAIN COMPONENT ====================
export default function DashboardScreen() {
  const { user } = useAuth();
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    refunded: 0,
    paid: 0,
    netSoldItems: 0,
  });
  const [financials, setFinancials] = useState<FinancialData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [revenueData, setRevenueData] = useState<number[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "analytics" | "products"
  >("overview");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Scroll management
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // ==================== LOAD STORE ====================
  useEffect(() => {
    loadStore();
  }, []);

  const loadStore = async (): Promise<void> => {
    try {
      const storeData = await AsyncStorage.getItem("currentStore");
      if (storeData) {
        const store: Store = JSON.parse(storeData);
        setCurrentStore(store);
        setStoreId(store._id);
      }
    } catch (error) {
      console.error("❌ Load store error:", error);
    }
  };

  // ==================== FETCH ALL DATA ====================
  useEffect(() => {
    if (storeId) {
      fetchAllData();
    }
  }, [storeId]);

  const fetchAllData = async (): Promise<void> => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOrderStats(),
        fetchFinancials(),
        fetchTopProducts(),
        fetchRevenueChart(),
        fetchCategoryData(),
      ]);

      // Start animations after data loads
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error("❌ Fetch data error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ==================== FETCH ORDER STATS ====================
  const fetchOrderStats = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const year = dayjs().format("YYYY");

      const res = await apiClient.get("/orders/stats", {
        params: { storeId, periodType: "year", periodKey: year },
      });

      const { total, pending, refunded, paid, netSoldItems } =
        res.data as OrderStats & {
          totalSoldItems?: number;
          totalRefundedItems?: number;
        };
      setOrderStats({ total, pending, refunded, paid, netSoldItems });
    } catch (error: any) {
      console.error("❌ Order stats error:", error?.message || error);
    }
  };

  // ==================== FETCH FINANCIALS ====================
  const fetchFinancials = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const year = dayjs().format("YYYY");

      const res = await apiClient.get("/financials", {
        params: { storeId, periodType: "year", periodKey: year },
      });

      const data = (res.data as { data: FinancialData }).data;
      setFinancials(data);
    } catch (error: any) {
      console.error("❌ Financials error:", error?.message || error);
    }
  };

  // ==================== FETCH TOP PRODUCTS ====================
  const fetchTopProducts = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const res = await apiClient.get("/orders/top-products", {
        params: { storeId, range: "thisMonth", limit: 5 },
      });

      const data = (res.data as { data: TopProduct[] }).data;
      setTopProducts(data || []);
    } catch (error: any) {
      console.error("❌ Top products error:", error?.message || error);
    }
  };

  // ==================== FETCH REVENUE CHART ====================
  const fetchRevenueChart = async (): Promise<void> => {
    if (!storeId) return;

    try {
      const periodKey = dayjs().format("YYYY-MM");

      const res = await apiClient.get("/revenues", {
        params: { storeId, periodType: "month", periodKey },
      });

      const data = (res.data as RevenueResponse).revenue || {};
      const totalRevenue =
        typeof data.totalRevenue === "object"
          ? Number(data.totalRevenue.$numberDecimal || 0)
          : (data.totalRevenue as number);

      const [year, month] = periodKey.split("-").map(Number);
      const daysInMonth = dayjs(`${year}-${month}`).daysInMonth();
      const fakeDaily = Array.from({ length: daysInMonth }, () => {
        const base = totalRevenue / daysInMonth;
        return Math.floor(base * (Math.random() * 0.4 + 0.8));
      });
      setRevenueData(fakeDaily);
    } catch (error: any) {
      console.error("❌ Revenue chart error:", error?.message || error);
    }
  };

  // ==================== FETCH CATEGORY DATA ====================
  const fetchCategoryData = async (): Promise<void> => {
    // Mock data for category distribution
    const mockCategoryData: CategoryDistribution[] = [
      {
        name: "Điện tử",
        value: 35,
        color: "#3b82f6",
        legendFontColor: "#6b7280",
        legendFontSize: 12,
      },
      {
        name: "Thời trang",
        value: 25,
        color: "#ef4444",
        legendFontColor: "#6b7280",
        legendFontSize: 12,
      },
      {
        name: "Gia dụng",
        value: 20,
        color: "#10b981",
        legendFontColor: "#6b7280",
        legendFontSize: 12,
      },
      {
        name: "Sách",
        value: 15,
        color: "#f59e0b",
        legendFontColor: "#6b7280",
        legendFontSize: 12,
      },
      {
        name: "Khác",
        value: 5,
        color: "#8b5cf6",
        legendFontColor: "#6b7280",
        legendFontSize: 12,
      },
    ];
    setCategoryData(mockCategoryData);
  };

  // ==================== REFRESH ====================
  const onRefresh = (): void => {
    setRefreshing(true);
    fetchAllData();
  };

  // ==================== SCROLL MANAGEMENT ====================
  const updateScrollHint = (
    scrollY: number,
    cHeight?: number,
    vHeight?: number
  ) => {
    const contentH = cHeight ?? contentHeight;
    const viewH = vHeight ?? containerHeight;
    if (!contentH || !viewH) {
      setShowScrollHint(false);
      return;
    }
    const scrollable = contentH - viewH;
    const threshold = 24;
    const needHint = scrollable > threshold && scrollY < scrollable - threshold;
    setShowScrollHint(needHint);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollYRef.current = contentOffset.y;
    updateScrollHint(
      contentOffset.y,
      contentSize.height,
      layoutMeasurement.height
    );
  };

  const handleContentSizeChange = (w: number, h: number) => {
    setContentHeight(h);
    updateScrollHint(scrollYRef.current, h, containerHeight);
  };

  const handleLayout = (e: any) => {
    const h = e.nativeEvent.layout.height;
    setContainerHeight(h);
    updateScrollHint(scrollYRef.current, contentHeight, h);
  };

  const handleScrollDown = () => {
    const scrollView = scrollRef.current;
    if (!scrollView) return;
    const next = scrollYRef.current + 200;
    scrollView.scrollTo({ y: next, animated: true });
  };

  // ==================== FORMATTERS ====================
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatProductSales = (
    sales: number | { $numberDecimal?: string }
  ): string => {
    const num =
      typeof sales === "object" ? Number(sales.$numberDecimal || 0) : sales;
    return formatCurrency(num);
  };

  // ==================== CALCULATIONS ====================
  const avgOrderValue =
    orderStats.paid > 0 && financials
      ? financials.totalRevenue / orderStats.paid
      : 0;

  const conversionRate =
    orderStats.total > 0 ? (orderStats.paid / orderStats.total) * 100 : 0;

  const monthLabel = dayjs().format("MM/YYYY");
  const totalRevenueOfMonth = revenueData.reduce((s, v) => s + v, 0);

  // ==================== CHART DATA ====================
  const weeklyRevenueData = {
    labels: ["Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"],
    datasets: [
      {
        data:
          revenueData.length >= 4
            ? [
                revenueData.slice(0, 7).reduce((s, v) => s + v, 0),
                revenueData.slice(7, 14).reduce((s, v) => s + v, 0),
                revenueData.slice(14, 21).reduce((s, v) => s + v, 0),
                revenueData.slice(21).reduce((s, v) => s + v, 0),
              ]
            : [0, 0, 0, totalRevenueOfMonth],
      },
    ],
  };

  const dailyRevenueData = {
    labels: revenueData.slice(-7).map((_, i) => `T${i + 1}`),
    datasets: [
      {
        data:
          revenueData.slice(-7).length > 0
            ? revenueData.slice(-7)
            : [0, 0, 0, 0, 0, 0, 0],
      },
    ],
  };

  // ==================== RENDER LOADING ====================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          style={styles.loadingCircle}
        >
          <ActivityIndicator size="large" color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>Đang tải dữ liệu dashboard...</Text>
        <Text style={styles.loadingSubtext}>Vui lòng chờ trong giây lát</Text>
      </View>
    );
  }

  // ==================== RENDER CONTENT ====================
  return (
    <View style={styles.root} onLayout={handleLayout}>
      {/* Header với gradient */}
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={["#ffffff", "#f8fafc"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(user?.fullname || "M").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.greeting}>
                Xin chào, {user?.fullname || "Quản lý"}! 👋
              </Text>
              <Text style={styles.storeName}>
                {currentStore?.name || "Cửa hàng"}
              </Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateText}>
                {dayjs().format("DD/MM/YYYY")}
              </Text>
            </View>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabContainer}>
            {[
              { id: "overview", label: "Tổng quan", icon: "📊" },
              { id: "analytics", label: "Phân tích", icon: "📈" },
              { id: "products", label: "Sản phẩm", icon: "📦" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </LinearGradient>

      {/* Nội dung chính */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#667eea"]}
            tintColor="#667eea"
          />
        }
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <>
              {/* Key Metrics Grid */}
              <View style={styles.statsGrid}>
                <StatCard
                  title="Doanh thu tháng"
                  value={formatCurrency(totalRevenueOfMonth)}
                  subtitle="Tổng doanh thu tháng này"
                  icon="💰"
                  color="#10b981"
                  gradient={["#ecfdf5", "#d1fae5"]}
                  trend={12.5}
                />
                <StatCard
                  title="Lợi nhuận"
                  value={formatCurrency(financials?.netProfit || 0)}
                  subtitle="Lợi nhuận thực sau chi phí"
                  icon="📈"
                  color="#f59e0b"
                  gradient={["#fffbeb", "#fef3c7"]}
                  trend={8.3}
                />
                <StatCard
                  title="Đơn hàng"
                  value={orderStats.paid}
                  subtitle="Đơn đã thanh toán"
                  icon="🛒"
                  color="#3b82f6"
                  gradient={["#eff6ff", "#dbeafe"]}
                  trend={15.2}
                />
                <StatCard
                  title="Tỷ lệ chuyển đổi"
                  value={`${conversionRate.toFixed(1)}%`}
                  subtitle="Tỷ lệ chốt đơn thành công"
                  icon="🎯"
                  color="#8b5cf6"
                  gradient={["#faf5ff", "#e9d5ff"]}
                  trend={5.7}
                />
              </View>

              {/* Performance Metrics */}
              <View style={[styles.metricsCard, styles.cardShadow]}>
                <Text style={styles.sectionTitle}>📊 Chỉ số hiệu suất</Text>
                <MetricProgress
                  label="Mục tiêu doanh thu"
                  value={totalRevenueOfMonth}
                  target={50000000}
                  color="#10b981"
                  icon="🎯"
                />
                <MetricProgress
                  label="Đơn hàng mục tiêu"
                  value={orderStats.paid}
                  target={200}
                  color="#3b82f6"
                  icon="📦"
                />
                <MetricProgress
                  label="Khách hàng mới"
                  value={45}
                  target={100}
                  color="#8b5cf6"
                  icon="👥"
                />
              </View>

              {/* Revenue Chart */}
              <View style={[styles.chartCard, styles.cardShadow]}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>
                    📈 Doanh thu 7 ngày gần nhất
                  </Text>
                  <View style={styles.chartLegend}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#3b82f6" }]}
                    />
                    <Text style={styles.legendText}>Doanh thu</Text>
                  </View>
                </View>
                <BarChart
                  data={dailyRevenueData}
                  width={width - 48}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#f8fafc",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
                    barPercentage: 0.7,
                    propsForBackgroundLines: {
                      strokeDasharray: "4 4",
                      stroke: "#e5e7eb",
                      strokeWidth: 1,
                    },
                  }}
                  yAxisLabel=""
                  yAxisSuffix=""
                  style={styles.chart}
                  showValuesOnTopOfBars
                  withInnerLines
                  fromZero
                />
              </View>
            </>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <>
              <View style={[styles.chartCard, styles.cardShadow]}>
                <Text style={styles.sectionTitle}>
                  📊 Phân tích doanh thu theo tuần
                </Text>
                <LineChart
                  data={weeklyRevenueData}
                  width={width - 48}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#f8fafc",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(75, 85, 99, ${opacity})`,
                    propsForDots: {
                      r: "5",
                      strokeWidth: "2",
                      stroke: "#8b5cf6",
                      fill: "#ffffff",
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "4 4",
                      stroke: "#e5e7eb",
                    },
                  }}
                  bezier
                  style={styles.chart}
                  withInnerLines
                  withOuterLines
                  withVerticalLines
                  withHorizontalLines
                />
              </View>

              <View style={styles.analyticsRow}>
                <View style={[styles.pieChartCard, styles.cardShadow]}>
                  <Text style={styles.sectionTitle}>🎨 Phân loại sản phẩm</Text>
                  <PieChart
                    data={categoryData}
                    width={width - 48}
                    height={200}
                    chartConfig={{
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="value"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              </View>
            </>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <>
              <View style={[styles.productsCard, styles.cardShadow]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🏆 Sản phẩm bán chạy</Text>
                  <Text style={styles.sectionSubtitle}>Tháng {monthLabel}</Text>
                </View>

                {topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <TouchableOpacity
                      key={product._id}
                      style={styles.productItem}
                      activeOpacity={0.7}
                    >
                      <View style={styles.productRank}>
                        <LinearGradient
                          colors={
                            index < 3
                              ? ["#f59e0b", "#d97706"]
                              : ["#6b7280", "#4b5563"]
                          }
                          style={styles.rankBadge}
                        >
                          <Text style={styles.rankText}>#{index + 1}</Text>
                        </LinearGradient>
                      </View>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>
                          {product.productName}
                        </Text>
                        <Text style={styles.productCategory}>
                          {product.category || "Không phân loại"}
                        </Text>
                      </View>
                      <View style={styles.productStats}>
                        <Text style={styles.productQuantity}>
                          {product.totalQuantity} sản phẩm
                        </Text>
                        <Text style={styles.productRevenue}>
                          {formatProductSales(product.totalSales)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>📦</Text>
                    <Text style={styles.emptyText}>
                      Chưa có dữ liệu sản phẩm
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Dữ liệu sẽ được cập nhật khi có đơn hàng mới
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={{ height: 30 }} />
        </Animated.View>
      </Animated.ScrollView>

      {/* Scroll hint button */}
      {showScrollHint && (
        <TouchableOpacity
          onPress={handleScrollDown}
          activeOpacity={0.85}
          style={styles.scrollHintBtn}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={styles.scrollHintGradient}
          >
            <Text style={styles.scrollHintIcon}>↓</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    color: "#1f2937",
    fontWeight: "700",
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  headerContent: {
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#667eea",
  },
  headerInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 2,
  },
  storeName: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  dateBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
    color: "#ffffff",
    fontWeight: "600",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    backgroundColor: "#ffffff",
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statIcon: {
    fontSize: 20,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 14,
  },
  metricsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  metricContainer: {
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  chart: {
    borderRadius: 12,
  },
  analyticsRow: {
    flexDirection: "row",
  },
  pieChartCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
  },
  productsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  productRank: {
    marginRight: 12,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rankText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 11,
    color: "#6b7280",
  },
  productStats: {
    alignItems: "flex-end",
  },
  productQuantity: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#059669",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },
  scrollHintBtn: {
    position: "absolute",
    bottom: 24,
    right: 24,
    borderRadius: 25,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scrollHintGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollHintIcon: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
});
