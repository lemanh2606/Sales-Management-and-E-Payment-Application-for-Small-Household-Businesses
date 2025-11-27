// src/screens/settings/SubscriptionScreen.tsx
import React, { useState, useEffect, useCallback, useMemo, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Linking,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import { useAuth } from "../../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import apiClient from "../../api/apiClient";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ========== TYPES ==========
interface PendingPayment {
  order_code: string;
  amount: number;
  plan_duration: number;
  checkout_url: string;
  qr_data_url: string;
  created_at: string;
}

interface TrialInfo {
  starts_at: string;
  ends_at: string;
}

interface PremiumInfo {
  plan_duration: number;
  started_at: string;
  expires_at: string;
  amount_paid: number;
}

interface Subscription {
  _id: string;
  userId: string;
  storeId: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  is_premium: boolean;
  days_remaining: number;
  starts_at: string;
  ends_at: string;
  expires_at?: string;
  trial_ends_at?: string;
  trial?: TrialInfo;
  premium?: PremiumInfo;
  pending_payment?: PendingPayment;
  createdAt: string;
  updatedAt: string;
}

interface PaymentHistoryItem {
  _id: string;
  transaction_id: string;
  amount: number;
  plan_duration: number;
  status: "SUCCESS" | "PENDING" | "FAILED";
  paid_at: string;
  created_at: string;
}

interface UsageStats {
  total_orders: number;
  total_revenue: number;
  total_products: number;
  total_customers?: number;
}

interface SubscriptionResponse {
  success: boolean;
  data: Subscription;
}

interface PaymentHistoryResponse {
  success: boolean;
  data: PaymentHistoryItem[];
}

interface UsageStatsResponse {
  success: boolean;
  data: UsageStats;
}

type SettingsStackParamList = {
  Subscription: undefined;
  SubscriptionPricing: undefined;
  FileManager: undefined;
};

type NavigationProp = NativeStackNavigationProp<
  SettingsStackParamList,
  "Subscription"
>;

type StatusType = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";

interface StatusConfig {
  color: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  bgColor: string;
}

// ========== CONSTANTS ==========
const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  TRIAL: {
    color: "#1890ff",
    text: "Dùng thử",
    icon: "gift",
    bgColor: "#e6f4ff",
  },
  ACTIVE: {
    color: "#52c41a",
    text: "Premium",
    icon: "checkmark-circle",
    bgColor: "#f6ffed",
  },
  EXPIRED: {
    color: "#ef4444",
    text: "Hết hạn",
    icon: "warning",
    bgColor: "#fff1f0",
  },
  CANCELLED: {
    color: "#8c8c8c",
    text: "Đã hủy",
    icon: "time",
    bgColor: "#fafafa",
  },
};

const BENEFITS: string[] = [
  "Không giới hạn sản phẩm",
  "Không giới hạn đơn hàng",
  "Báo cáo & thống kê",
  "Quản lý kho nâng cao",
  "Hỗ trợ 24/7",
];

// ========== MAIN COMPONENT ==========
const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>(
    []
  );
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  // ========== FETCH DATA ==========
  const fetchData = useCallback(
    async (isRefresh: boolean = false): Promise<void> => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [subRes, historyRes, usageRes]: any = await Promise.all([
          apiClient
            .get<SubscriptionResponse>("/subscriptions/current")
            .catch(() => null),
          apiClient
            .get<PaymentHistoryResponse>("/subscriptions/payment-history")
            .catch(() => ({ data: { data: [] } })),
          apiClient
            .get<UsageStatsResponse>("/subscriptions/usage-stats")
            .catch(() => ({ data: { data: null } })),
        ]);

        console.log(
          "📊 Raw subscription response:",
          JSON.stringify(subRes?.data, null, 2)
        );
        console.log(
          "📊 Raw usage stats response:",
          JSON.stringify(usageRes?.data, null, 2)
        );

        const subscriptionData = subRes?.data?.data || subRes?.data || null;
        const historyArray = historyRes?.data?.data || historyRes?.data || [];
        const usageData = usageRes?.data?.data || usageRes?.data || null;

        console.log(
          "📊 Parsed subscription:",
          JSON.stringify(subscriptionData, null, 2)
        );
        console.log(
          "📊 Parsed usage stats:",
          JSON.stringify(usageData, null, 2)
        );

        setSubscription(subscriptionData);
        setPaymentHistory(Array.isArray(historyArray) ? historyArray : []);
        setUsageStats(usageData);

        console.log("✅ Loaded subscription:", subscriptionData?.status);
        console.log(
          "✅ Payment history items:",
          Array.isArray(historyArray) ? historyArray.length : 0
        );
      } catch (err: any) {
        console.error("❌ Lỗi load subscription:", err);
        Alert.alert("Lỗi", "Không thể tải thông tin gói đăng ký");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // ========== COMPUTED VALUES ==========
  const computedValues = useMemo(() => {
    if (!subscription) {
      return {
        isTrial: false,
        isPremium: false,
        isExpired: false,
        daysRemaining: 0,
        totalDays: 0,
        progressPercent: 0,
        pendingPayment: null,
      };
    }

    const isTrial = subscription.status === "TRIAL";
    const isPremium = subscription.status === "ACTIVE";
    const isExpired = subscription.status === "EXPIRED";

    // ✅ Safe number handling with fallback
    const daysRemaining = Number(subscription.days_remaining) || 0;
    const planDuration = Number(subscription.premium?.plan_duration) || 1;
    const totalDays = isTrial ? 14 : planDuration * 30;
    const progressPercent =
      totalDays > 0 ? Math.round((daysRemaining / totalDays) * 100) : 0;
    const pendingPayment = subscription.pending_payment || null;

    return {
      isTrial,
      isPremium,
      isExpired,
      daysRemaining,
      totalDays,
      progressPercent,
      pendingPayment,
    };
  }, [subscription]);

  const {
    isTrial,
    isPremium,
    isExpired,
    daysRemaining,
    totalDays,
    progressPercent,
    pendingPayment,
  } = computedValues;

  // ========== FORMAT CURRENCY (SAFE) ==========
  const formatCurrency = useCallback(
    (value: number | undefined | null): string => {
      // ✅ Handle undefined/null/NaN values
      if (value === undefined || value === null || isNaN(Number(value))) {
        return "0";
      }
      try {
        return Number(value).toLocaleString("vi-VN");
      } catch (error) {
        console.error("Format currency error:", error, "value:", value);
        return String(value || 0);
      }
    },
    []
  );

  // ========== GET PROGRESS COLOR (SAFE) ==========
  const getProgressColor = useCallback(
    (days: number | undefined | null): string => {
      const safeDays = Number(days) || 0;
      if (safeDays > 7) return "#52c41a";
      if (safeDays > 3) return "#faad14";
      return "#ef4444";
    },
    []
  );

  // ========== HANDLE COPY ==========
  const handleCopy = useCallback(
    async (value: string, label: string = "thông tin"): Promise<void> => {
      try {
        await Clipboard.setStringAsync(value);
        Alert.alert("Đã sao chép", `Đã sao chép ${label}`);
      } catch (error) {
        console.error("Copy error:", error);
        Alert.alert("Lỗi", "Không thể sao chép");
      }
    },
    []
  );

  // ========== HANDLE OPEN LINK ==========
  const handleOpenLink = useCallback((url: string): void => {
    if (!url) {
      Alert.alert("Lỗi", "Không tìm thấy link thanh toán");
      return;
    }
    Linking.openURL(url).catch((err) => {
      console.error("Link opening error:", err);
      Alert.alert("Lỗi", "Không thể mở link");
    });
  }, []);

  // ========== HANDLE PAYMENT DONE ==========
  const handlePaymentDone = useCallback(async (): Promise<void> => {
    Alert.alert("Đang kiểm tra", "Đang kiểm tra trạng thái thanh toán...");
    await fetchData(false);
    Alert.alert("Thành công", "Đã cập nhật trạng thái subscription");
  }, [fetchData]);

  // ========== HANDLE UPGRADE ==========
  const handleUpgrade = useCallback((): void => {
    try {
      navigation.navigate("SubscriptionPricing");
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("Lỗi", "Không thể chuyển trang. Vui lòng thử lại.");
    }
  }, [navigation]);

  // ========== RENDER STATUS TAG ==========
  const renderStatusTag = useCallback((status: StatusType): JSX.Element => {
    const config = STATUS_CONFIG[status];
    return (
      <View style={[styles.statusTag, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={[styles.statusTagText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    );
  }, []);

  // ========== RENDER STAT CARD (SAFE) ==========
  const renderStatCard = useCallback(
    (
      icon: keyof typeof Ionicons.glyphMap,
      title: string,
      value: string | number | undefined | null,
      bgColor: string,
      valueColor?: string
    ): JSX.Element => {
      // ✅ Safe display value handling
      let displayValue: string;

      if (value === undefined || value === null) {
        displayValue = "N/A";
      } else if (typeof value === "number") {
        displayValue = isNaN(value) ? "N/A" : String(value);
      } else {
        displayValue = String(value);
      }

      return (
        <View style={[styles.statCard, { backgroundColor: bgColor }]}>
          <Ionicons
            name={icon}
            size={24}
            color="#1890ff"
            style={styles.statIcon}
          />
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={[styles.statValue, valueColor && { color: valueColor }]}>
            {displayValue}
          </Text>
        </View>
      );
    },
    []
  );

  // ========== RENDER PAYMENT ITEM ==========
  const renderPaymentItem = useCallback(
    (payment: PaymentHistoryItem, index: number): JSX.Element => {
      const isLast = index === paymentHistory.length - 1;
      const statusColor =
        payment.status === "SUCCESS"
          ? "#52c41a"
          : payment.status === "PENDING"
            ? "#faad14"
            : "#ef4444";
      const statusBg =
        payment.status === "SUCCESS"
          ? "#f6ffed"
          : payment.status === "PENDING"
            ? "#fff7e6"
            : "#fff1f0";

      return (
        <View key={payment._id} style={styles.historyItem}>
          <View style={styles.historyItemLeft}>
            <View
              style={[styles.historyDot, { backgroundColor: statusColor }]}
            />
            {!isLast && <View style={styles.historyLine} />}
          </View>

          <View style={styles.historyItemRight}>
            <Text style={styles.historyItemTitle}>
              Gói {payment.plan_duration || 0} tháng -{" "}
              {formatCurrency(payment.amount)}đ
            </Text>
            <Text style={styles.historyItemDate}>
              {payment.paid_at
                ? dayjs(payment.paid_at).format("DD/MM/YYYY HH:mm")
                : "Đang xử lý"}
            </Text>
            <Text style={styles.historyItemCode}>
              Mã GD: {payment.transaction_id || "N/A"}
            </Text>
            {payment.status && (
              <View
                style={[styles.historyStatus, { backgroundColor: statusBg }]}
              >
                <Text
                  style={[styles.historyStatusText, { color: statusColor }]}
                >
                  {payment.status}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    },
    [paymentHistory.length, formatCurrency]
  );

  // ========== RENDER ==========
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1890ff" />
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  // No subscription
  if (!subscription || !subscription.status) {
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.emptyContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyCard}>
            <Ionicons name="warning" size={64} color="#faad14" />
            <Text style={styles.emptyTitle}>Chưa có gói dịch vụ</Text>
            <Text style={styles.emptySubtitle}>
              Nâng cấp lên Premium để sử dụng đầy đủ tính năng
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgrade}
            >
              <LinearGradient
                colors={["#1890ff", "#096dd9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeButtonGradient}
              >
                <Ionicons name="trophy" size={20} color="#fff" />
                <Text style={styles.upgradeButtonText}>
                  Xem các gói Premium
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            colors={["#1890ff"]}
            tintColor="#1890ff"
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={["#1890ff", "#096dd9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Ionicons name="trophy" size={40} color="#fff" />
          <Text style={styles.headerTitle}>Gói đăng ký của bạn</Text>
          <Text style={styles.headerSubtitle}>Quản lý gói và thanh toán</Text>
        </LinearGradient>

        {/* Pending Payment Alert */}
        {pendingPayment && (
          <View style={styles.pendingCard}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingBadge}>
                <Ionicons name="time" size={14} color="#faad14" />
                <Text style={styles.pendingBadgeText}>Đang chờ thanh toán</Text>
              </View>
              <Text style={styles.pendingCode}>
                Mã: {pendingPayment.order_code}
              </Text>
            </View>

            <View style={styles.pendingInfo}>
              <Text style={styles.pendingAmount}>
                Số tiền:{" "}
                <Text style={styles.pendingAmountValue}>
                  {formatCurrency(pendingPayment.amount)}đ
                </Text>
              </Text>
              <Text style={styles.pendingPlan}>
                Gói {pendingPayment.plan_duration || 0} tháng
              </Text>
              {pendingPayment.created_at && (
                <Text style={styles.pendingDate}>
                  Tạo lúc{" "}
                  {dayjs(pendingPayment.created_at).format("DD/MM/YYYY HH:mm")}
                </Text>
              )}
            </View>

            {pendingPayment.qr_data_url && (
              <View style={styles.qrContainer}>
                <Image
                  source={{ uri: pendingPayment.qr_data_url }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.pendingActions}>
              <TouchableOpacity
                style={styles.pendingActionBtn}
                onPress={() => handleOpenLink(pendingPayment.checkout_url)}
              >
                <Ionicons name="link" size={18} color="#1890ff" />
                <Text style={styles.pendingActionBtnText}>Mở link PayOS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pendingActionBtn}
                onPress={() =>
                  handleCopy(pendingPayment.order_code, "mã giao dịch")
                }
              >
                <Ionicons name="copy" size={18} color="#1890ff" />
                <Text style={styles.pendingActionBtnText}>Sao chép mã</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.pendingDoneBtn}
              onPress={handlePaymentDone}
            >
              <Ionicons name="reload" size={18} color="#fff" />
              <Text style={styles.pendingDoneBtnText}>Tôi đã thanh toán</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Subscription Card */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionHeaderLeft}>
              <Ionicons name="rocket" size={20} color="#1890ff" />
              <Text style={styles.subscriptionHeaderTitle}>Gói hiện tại</Text>
            </View>
            {renderStatusTag(subscription.status)}
          </View>

          {/* Trial Info */}
          {isTrial && subscription.trial && (
            <View style={styles.planContent}>
              <Text style={styles.planTitle}>🎁 Gói dùng thử miễn phí</Text>
              <Text style={styles.planExpiry}>
                Hết hạn:{" "}
                {subscription.trial.ends_at
                  ? dayjs(subscription.trial.ends_at).format("DD/MM/YYYY")
                  : "N/A"}
              </Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: getProgressColor(daysRemaining),
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressText,
                    { color: getProgressColor(daysRemaining) },
                  ]}
                >
                  {daysRemaining} ngày còn lại
                </Text>
              </View>

              <View
                style={[
                  styles.planAlert,
                  {
                    backgroundColor: daysRemaining <= 3 ? "#fff1f0" : "#e6f4ff",
                  },
                ]}
              >
                <Text style={styles.planAlertTitle}>
                  {daysRemaining <= 3
                    ? "⚠️ Gói dùng thử sắp hết hạn!"
                    : "ℹ️ Thông tin dùng thử"}
                </Text>
                <Text style={styles.planAlertText}>
                  Bạn có thể sử dụng TẤT CẢ tính năng Premium trong thời gian
                  dùng thử.
                </Text>
                {daysRemaining <= 3 && (
                  <Text style={styles.planAlertWarning}>
                    Nâng cấp ngay để không bị gián đoạn dịch vụ!
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.upgradeButtonInline}
                onPress={handleUpgrade}
              >
                <Ionicons name="trophy" size={18} color="#fff" />
                <Text style={styles.upgradeButtonInlineText}>
                  Nâng cấp Premium
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Premium Info */}
          {isPremium && subscription.premium && (
            <View style={styles.planContent}>
              <View style={styles.statsGrid}>
                {renderStatCard(
                  "trophy",
                  "Gói Premium",
                  `${subscription.premium.plan_duration || 0} tháng`,
                  "#f6ffed"
                )}
                {renderStatCard(
                  "calendar",
                  "Còn lại",
                  `${daysRemaining} ngày`,
                  "#fff7e6",
                  getProgressColor(daysRemaining)
                )}
              </View>

              <View style={styles.planDetails}>
                <View style={styles.planDetailRow}>
                  <Text style={styles.planDetailLabel}>Bắt đầu:</Text>
                  <Text style={styles.planDetailValue}>
                    {subscription.premium.started_at
                      ? dayjs(subscription.premium.started_at).format(
                          "DD/MM/YYYY"
                        )
                      : "N/A"}
                  </Text>
                </View>
                <View style={styles.planDetailRow}>
                  <Text style={styles.planDetailLabel}>Hết hạn:</Text>
                  <Text style={[styles.planDetailValue, { color: "#ef4444" }]}>
                    {subscription.premium.expires_at
                      ? dayjs(subscription.premium.expires_at).format(
                          "DD/MM/YYYY"
                        )
                      : "N/A"}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: getProgressColor(daysRemaining),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{progressPercent}%</Text>
              </View>

              {daysRemaining <= 7 && (
                <View
                  style={[styles.planAlert, { backgroundColor: "#fff1f0" }]}
                >
                  <Text style={styles.planAlertTitle}>
                    ⚠️ Gói Premium sắp hết hạn!
                  </Text>
                  <TouchableOpacity onPress={handleUpgrade}>
                    <Text
                      style={[
                        styles.planAlertText,
                        { color: "#1890ff", fontWeight: "700" },
                      ]}
                    >
                      Gia hạn ngay →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.upgradeButtonInline}
                onPress={handleUpgrade}
              >
                <Ionicons name="reload" size={18} color="#fff" />
                <Text style={styles.upgradeButtonInlineText}>Gia hạn gói</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Expired Info */}
          {isExpired && (
            <View style={styles.planContent}>
              <View style={styles.statsGrid}>
                {renderStatCard(
                  "time",
                  "Đã hết hạn",
                  subscription.expires_at
                    ? `${dayjs().diff(dayjs(subscription.expires_at), "day")} ngày trước`
                    : "N/A",
                  "#fff1f0",
                  "#ef4444"
                )}
                {renderStatCard(
                  "trophy",
                  "Gói trước đây",
                  subscription.premium?.plan_duration
                    ? `${subscription.premium.plan_duration} tháng`
                    : subscription.trial_ends_at
                      ? "Trial"
                      : "N/A",
                  "#fff7e6"
                )}
              </View>

              <View style={styles.planDetails}>
                {subscription.premium?.started_at && (
                  <View style={styles.planDetailRow}>
                    <Text style={styles.planDetailLabel}>Bắt đầu:</Text>
                    <Text style={styles.planDetailValue}>
                      {dayjs(subscription.premium.started_at).format(
                        "DD/MM/YYYY"
                      )}
                    </Text>
                  </View>
                )}
                <View style={styles.planDetailRow}>
                  <Text style={styles.planDetailLabel}>Đã hết hạn:</Text>
                  <Text style={[styles.planDetailValue, { color: "#ef4444" }]}>
                    {subscription.expires_at
                      ? dayjs(subscription.expires_at).format("DD/MM/YYYY")
                      : subscription.trial_ends_at
                        ? dayjs(subscription.trial_ends_at).format("DD/MM/YYYY")
                        : "N/A"}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: "0%", backgroundColor: "#ef4444" },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, { color: "#ef4444" }]}>
                  0%
                </Text>
              </View>

              <View style={[styles.planAlert, { backgroundColor: "#fff1f0" }]}>
                <Text style={[styles.planAlertTitle, { color: "#ef4444" }]}>
                  ⚠️ Gói đăng ký đã hết hạn
                </Text>
                <Text style={styles.planAlertText}>
                  Gia hạn ngay để tiếp tục sử dụng đầy đủ tính năng Premium.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.upgradeButtonInline,
                  { backgroundColor: "#ef4444" },
                ]}
                onPress={handleUpgrade}
              >
                <Ionicons name="reload" size={18} color="#fff" />
                <Text style={styles.upgradeButtonInlineText}>Gia hạn ngay</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Payment History */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Ionicons name="cash" size={20} color="#1890ff" />
            <Text style={styles.historyHeaderTitle}>Lịch sử thanh toán</Text>
          </View>

          {paymentHistory.length > 0 ? (
            <View style={styles.historyList}>
              {paymentHistory.map(renderPaymentItem)}
            </View>
          ) : (
            <View style={styles.historyEmpty}>
              <Ionicons name="cash" size={48} color="#d1d5db" />
              <Text style={styles.historyEmptyText}>
                Chưa có lịch sử thanh toán
              </Text>
            </View>
          )}
        </View>

        {/* Usage Stats & Benefits */}
        <View style={styles.bottomSection}>
          {usageStats && (
            <View style={styles.usageCard}>
              <View style={styles.usageHeader}>
                <Ionicons name="cart" size={20} color="#1890ff" />
                <Text style={styles.usageHeaderTitle}>Thống kê sử dụng</Text>
              </View>

              <View style={styles.usageGrid}>
                {renderStatCard(
                  "cart",
                  "Tổng đơn hàng",
                  usageStats.total_orders ?? 0,
                  "#f0f5ff"
                )}
                {renderStatCard(
                  "cash",
                  "Doanh thu",
                  `${formatCurrency(usageStats.total_revenue)}đ`,
                  "#fff7e6"
                )}
                {renderStatCard(
                  "cube",
                  "Sản phẩm",
                  usageStats.total_products ?? 0,
                  "#f6ffed"
                )}
              </View>
            </View>
          )}

          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Quyền lợi Premium</Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#52c41a" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

export default SubscriptionScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  emptyContentContainer: { flexGrow: 1, justifyContent: "center", padding: 24 },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#1890ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  upgradeButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 10,
  },
  upgradeButtonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginTop: 12,
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: 14, color: "#fff", opacity: 0.9 },
  pendingCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#fed7aa",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: "700", color: "#faad14" },
  pendingCode: { fontSize: 13, color: "#6b7280" },
  pendingInfo: { marginBottom: 16 },
  pendingAmount: { fontSize: 14, color: "#374151", marginBottom: 4 },
  pendingAmountValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  pendingPlan: { fontSize: 14, color: "#6b7280", marginBottom: 4 },
  pendingDate: { fontSize: 13, color: "#9ca3af" },
  qrContainer: { alignItems: "center", marginVertical: 16 },
  qrImage: {
    width: Math.min(220, SCREEN_WIDTH - 112),
    height: Math.min(220, SCREEN_WIDTH - 112),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pendingActions: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pendingActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#e6f4ff",
    gap: 6,
  },
  pendingActionBtnText: { fontSize: 13, fontWeight: "600", color: "#1890ff" },
  pendingDoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1890ff",
    gap: 8,
  },
  pendingDoneBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  subscriptionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  subscriptionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subscriptionHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: { fontSize: 13, fontWeight: "700" },
  planContent: { gap: 16 },
  planTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  planExpiry: { fontSize: 14, color: "#6b7280" },
  progressContainer: { gap: 8 },
  progressBar: {
    height: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 5 },
  progressText: { fontSize: 13, fontWeight: "700", textAlign: "right" },
  planAlert: { padding: 16, borderRadius: 12, gap: 8 },
  planAlertTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  planAlertText: { fontSize: 13, color: "#6b7280", lineHeight: 18 },
  planAlertWarning: { fontSize: 13, fontWeight: "700", color: "#ef4444" },
  upgradeButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#52c41a",
    gap: 8,
  },
  upgradeButtonInlineText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  statIcon: { marginBottom: 4 },
  statTitle: { fontSize: 12, color: "#6b7280", textAlign: "center" },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  planDetails: { gap: 12 },
  planDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planDetailLabel: { fontSize: 14, color: "#6b7280" },
  planDetailValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  historyCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  historyHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  historyList: { gap: 16 },
  historyItem: { flexDirection: "row", gap: 12 },
  historyItemLeft: { alignItems: "center", paddingTop: 4 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyLine: { flex: 1, width: 2, backgroundColor: "#e5e7eb", marginTop: 4 },
  historyItemRight: { flex: 1, gap: 4 },
  historyItemTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  historyItemDate: { fontSize: 13, color: "#6b7280" },
  historyItemCode: { fontSize: 12, color: "#9ca3af" },
  historyStatus: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  historyStatusText: { fontSize: 12, fontWeight: "700" },
  historyEmpty: { alignItems: "center", paddingVertical: 40 },
  historyEmptyText: { fontSize: 14, color: "#9ca3af", marginTop: 12 },
  bottomSection: { gap: 16, marginHorizontal: 16 },
  usageCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  usageHeaderTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  usageGrid: { gap: 12 },
  benefitsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  benefitsList: { gap: 12 },
  benefitItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitText: { fontSize: 14, color: "#374151" },
  bottomSpacer: { height: 40 },
});
