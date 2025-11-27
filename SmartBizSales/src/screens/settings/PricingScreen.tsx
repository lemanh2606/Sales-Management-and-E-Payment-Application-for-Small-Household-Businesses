// src/screens/settings/PricingScreen.tsx
import React, { useState, useEffect, useCallback, JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
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
import apiClient from "../../api/apiClient";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ========== TYPES ==========
interface Plan {
  duration: number;
  label: string;
  price: number;
  original_price: number;
  discount: number;
  discount_percent: number;
  price_per_month: number;
  badge: string | null;
}

interface PlanResponse {
  success: boolean;
  plans: Plan[];
}

interface PendingPayment {
  order_code: string;
  amount: number;
  plan_duration: number;
  checkout_url: string;
  qr_data_url: string;
  created_at: string;
}

interface Subscription {
  _id: string;
  userId: string;
  storeId: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED";
  is_premium: boolean;
  days_remaining: number;
  starts_at: string;
  ends_at: string;
  pending_payment?: PendingPayment;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionResponse {
  success: boolean;
  data: Subscription;
}

interface CheckoutPayload {
  plan_duration: number;
}

interface CheckoutResponseData {
  transaction_id?: string;
  order_code?: string;
  amount: number;
  plan?: {
    duration: number;
    label: string;
  };
  plan_duration?: number;
  qr_data_url?: string;
  checkout_url?: string;
  created_at?: string;
  pending?: boolean;
}

interface CheckoutResponse {
  success: boolean;
  data: CheckoutResponseData;
  message?: string;
}

interface CheckoutInfo {
  transactionId: string;
  amount: number;
  planDuration: number;
  planLabel: string;
  qrUrl?: string;
  checkoutUrl?: string;
  createdAt?: string;
}

type IconName =
  | "flash"
  | "rocket"
  | "trophy"
  | "checkmark-circle"
  | "gift"
  | "warning"
  | "qr-code"
  | "close"
  | "copy"
  | "refresh"
  | "link";

// ========== CONSTANTS ==========
const PLAN_COLORS: Record<number, string> = {
  1: "#1890ff",
  3: "#52c41a",
  6: "#faad14",
};

const PLAN_ICONS: Record<number, IconName> = {
  1: "flash",
  3: "rocket",
  6: "trophy",
};

const FEATURES: string[] = [
  "Tất cả tính năng Premium",
  "Không giới hạn sản phẩm",
  "Không giới hạn đơn hàng",
  "Báo cáo & thống kê",
  "Hỗ trợ 24/7",
];

const FALLBACK_PLANS: Plan[] = [
  {
    duration: 1,
    label: "1 tháng",
    price: 199000,
    original_price: 199000,
    discount: 0,
    discount_percent: 0,
    price_per_month: 199000,
    badge: null,
  },
  {
    duration: 3,
    label: "3 tháng",
    price: 499000,
    original_price: 597000,
    discount: 98000,
    discount_percent: 16,
    price_per_month: 166333,
    badge: "Phổ biến",
  },
  {
    duration: 6,
    label: "6 tháng",
    price: 899000,
    original_price: 1194000,
    discount: 295000,
    discount_percent: 25,
    price_per_month: 149833,
    badge: "Tiết kiệm nhất",
  },
];

// ========== MAIN COMPONENT ==========
const PricingScreen: React.FC = () => {
  const { user } = useAuth();

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [processingPlan, setProcessingPlan] = useState<number | null>(null);

  // Modal states
  const [checkoutModalVisible, setCheckoutModalVisible] =
    useState<boolean>(false);
  const [checkoutInfo, setCheckoutInfo] = useState<CheckoutInfo | null>(null);

  // ========== FETCH DATA ==========
  const fetchData = useCallback(
    async (isRefresh: boolean = false): Promise<void> => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [plansRes, subRes]: any = await Promise.all([
          apiClient.get<PlanResponse>("/subscriptions/plans"),
          apiClient
            .get<SubscriptionResponse>("/subscriptions/current")
            .catch(() => null),
        ]);

        setPlans(plansRes.data.plans || FALLBACK_PLANS);
        setCurrentSub(subRes?.data || null);

        console.log("✅ Loaded plans:", plansRes.data.plans?.length || 0);
        console.log("✅ Current subscription:", subRes?.data?.status || "none");
      } catch (err: any) {
        console.error("❌ Lỗi load pricing:", err);
        Alert.alert("Lỗi", "Không thể tải thông tin gói");
        setPlans(FALLBACK_PLANS);
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

  // ========== FORMAT CURRENCY ==========
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("vi-VN");
  };

  // ========== NORMALIZE CHECKOUT DATA ==========
  const normalizeCheckoutData = (data: CheckoutResponseData): CheckoutInfo => {
    return {
      transactionId: data.transaction_id || data.order_code || "",
      amount: Number(data.amount) || 0,
      planDuration: data.plan?.duration || data.plan_duration || 0,
      planLabel: data.plan?.label || `Gói ${data.plan_duration || 0} tháng`,
      qrUrl: data.qr_data_url,
      checkoutUrl: data.checkout_url,
      createdAt: data.created_at,
    };
  };

  // ========== HANDLE SELECT PLAN ==========
  const handleSelectPlan = async (duration: number): Promise<void> => {
    if (!user) {
      Alert.alert(
        "Chưa đăng nhập",
        "Vui lòng đăng nhập để nâng cấp gói Premium"
      );
      return;
    }

    const selectedPlanData = plans.find((p) => p.duration === duration);
    if (!selectedPlanData) {
      Alert.alert("Lỗi", "Không tìm thấy gói đã chọn");
      return;
    }

    const isRenewal = currentSub?.status === "ACTIVE" && currentSub?.is_premium;
    const actionText = isRenewal ? "gia hạn" : "nâng cấp";

    Alert.alert(
      `Xác nhận chọn gói ${duration} tháng`,
      `Bạn có chắc muốn ${actionText} gói ${duration} tháng?\n\n` +
        `Giá: ${formatCurrency(selectedPlanData.price)}đ\n\n` +
        (isRenewal
          ? `✅ Thời gian sẽ được cộng thêm ${duration} tháng\n` +
            `Gói hiện tại còn: ${currentSub.days_remaining} ngày`
          : "Sau khi xác nhận, hệ thống sẽ tạo mã QR PayOS để bạn quét và thanh toán."),
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: async () => {
            try {
              setProcessingPlan(duration);
              console.log("🚀 Creating checkout for plan:", duration);

              const payload: CheckoutPayload = { plan_duration: duration };
              const response = await apiClient.post<CheckoutResponse>(
                "/subscriptions/checkout",
                payload
              );

              console.log("✅ Checkout response:", response.data);

              const normalized = normalizeCheckoutData(
                response.data.data || response.data
              );
              setCheckoutInfo(normalized);
              setCheckoutModalVisible(true);

              Alert.alert(
                "Thành công",
                "Đã tạo yêu cầu thanh toán PayOS. Vui lòng quét QR để hoàn tất."
              );

              await fetchData(false);
            } catch (err: any) {
              console.error("❌ Lỗi tạo checkout:", err);
              const errorMsg =
                err.response?.data?.message ||
                err.message ||
                "Không thể tạo thanh toán";
              Alert.alert("Lỗi", errorMsg);
            } finally {
              setProcessingPlan(null);
            }
          },
        },
      ]
    );
  };

  // ========== HANDLE OPEN PENDING CHECKOUT ==========
  const handleOpenPendingCheckout = (): void => {
    if (!currentSub?.pending_payment) return;

    const pending = currentSub.pending_payment;
    const normalized: CheckoutInfo = {
      transactionId: pending.order_code,
      amount: pending.amount,
      planDuration: pending.plan_duration,
      planLabel: `Gói ${pending.plan_duration} tháng`,
      qrUrl: pending.qr_data_url,
      checkoutUrl: pending.checkout_url,
      createdAt: pending.created_at,
    };

    setCheckoutInfo(normalized);
    setCheckoutModalVisible(true);
  };

  // ========== HANDLE OPEN PAYMENT LINK ==========
  const handleOpenPaymentLink = (): void => {
    if (!checkoutInfo?.checkoutUrl) {
      Alert.alert("Lỗi", "Không tìm thấy link thanh toán");
      return;
    }
    Linking.openURL(checkoutInfo.checkoutUrl);
  };

  // ========== HANDLE COPY TRANSACTION ID ==========
  const handleCopyTransactionId = async (): Promise<void> => {
    if (!checkoutInfo?.transactionId) return;
    await Clipboard.setStringAsync(checkoutInfo.transactionId);
    Alert.alert("Đã sao chép", "Mã giao dịch đã được sao chép");
  };

  // ========== HANDLE PAYMENT COMPLETED ==========
  const handlePaymentCompleted = async (): Promise<void> => {
    Alert.alert("Đang kiểm tra", "Đang kiểm tra trạng thái thanh toán...");
    await fetchData(false);
    setCheckoutModalVisible(false);
  };

  // ========== GET PLAN COLOR ==========
  const getPlanColor = (duration: number): string => {
    return PLAN_COLORS[duration] || "#1890ff";
  };

  // ========== GET PLAN ICON ==========
  const getPlanIcon = (duration: number): IconName => {
    return PLAN_ICONS[duration] || "flash";
  };

  // ========== RENDER PLAN CARD ==========
  const renderPlanCard = (plan: Plan): JSX.Element => {
    const isSelected = selectedPlan === plan.duration;
    const isProcessing = processingPlan === plan.duration;
    const color = getPlanColor(plan.duration);
    const icon = getPlanIcon(plan.duration);

    return (
      <TouchableOpacity
        key={plan.duration}
        style={[
          styles.planCard,
          isSelected && { ...styles.planCardSelected, borderColor: color },
        ]}
        onPress={() => setSelectedPlan(plan.duration)}
        activeOpacity={0.8}
        disabled={isProcessing}
      >
        {/* Badge */}
        {plan.badge && (
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{plan.badge}</Text>
          </View>
        )}

        {/* Icon */}
        <View
          style={[styles.planIconContainer, { backgroundColor: `${color}20` }]}
        >
          <Ionicons name={icon} size={40} color={color} />
        </View>

        {/* Title */}
        <Text style={[styles.planTitle, { color }]}>Gói {plan.label}</Text>

        {/* Price */}
        <View style={styles.priceContainer}>
          {plan.discount > 0 && (
            <Text style={styles.originalPrice}>
              {formatCurrency(plan.original_price)}đ
            </Text>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(plan.price)}đ</Text>
            {plan.discount_percent > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{plan.discount_percent}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.pricePerMonth}>
            {formatCurrency(plan.price_per_month)}đ/tháng
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color="#52c41a" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: color }]}
          onPress={() => handleSelectPlan(plan.duration)}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaButtonText}>Chọn gói này</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ========== RENDER FAQ ITEM ==========
  const renderFaqItem = (question: string, answer: string): JSX.Element => (
    <View style={styles.faqCard} key={question}>
      <Text style={styles.faqQuestion}>{question}</Text>
      <Text style={styles.faqAnswer}>{answer}</Text>
    </View>
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
          <Ionicons name="trophy" size={48} color="#fff" />
          <Text style={styles.headerTitle}>Chọn gói Premium</Text>
          <Text style={styles.headerSubtitle}>
            Mở khóa tất cả tính năng. Mua càng dài, tiết kiệm càng nhiều! 🎉
          </Text>
        </LinearGradient>

        {/* Trial Banner */}
        {currentSub?.status === "TRIAL" && (
          <View style={styles.trialBanner}>
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.trialGradient}
            >
              <Ionicons name="gift" size={24} color="#fff" />
              <View style={styles.trialTextContainer}>
                <Text style={styles.trialTitle}>🎁 Đang dùng thử miễn phí</Text>
                <Text style={styles.trialSubtitle}>
                  Còn {currentSub.days_remaining} ngày. Nâng cấp ngay!
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Pending Payment Alert */}
        {currentSub?.pending_payment && (
          <View style={styles.pendingAlert}>
            <View style={styles.pendingAlertContent}>
              <Ionicons name="warning" size={24} color="#faad14" />
              <View style={styles.pendingTextContainer}>
                <Text style={styles.pendingTitle}>
                  Bạn đang có giao dịch chưa hoàn tất
                </Text>
                <Text style={styles.pendingText}>
                  Mã: {currentSub.pending_payment.order_code}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pendingButton}
              onPress={handleOpenPendingCheckout}
            >
              <Text style={styles.pendingButtonText}>Tiếp tục thanh toán</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pricing Cards */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => renderPlanCard(plan))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Câu hỏi thường gặp</Text>
          {renderFaqItem(
            "💳 Thanh toán như thế nào?",
            "Chuyển khoản ngân hàng qua QR Code PayOS, nhanh chóng và an toàn."
          )}
          {renderFaqItem(
            "🔄 Có tự động gia hạn không?",
            "Không, bạn cần gia hạn thủ công khi hết hạn."
          )}
          {renderFaqItem(
            "🎁 Trial có đầy đủ tính năng không?",
            "Có! Bạn được dùng thử TẤT CẢ tính năng Premium trong 14 ngày."
          )}
          {renderFaqItem(
            "🔐 Dữ liệu có an toàn không?",
            "Hoàn toàn! Dữ liệu được mã hóa và backup tự động hàng ngày."
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Checkout Modal */}
      <Modal
        visible={checkoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="qr-code" size={24} color="#1890ff" />
                <Text style={styles.modalTitle}>Thanh toán qua PayOS</Text>
              </View>
              <TouchableOpacity onPress={() => setCheckoutModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            {checkoutInfo && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    Đang chờ thanh toán
                  </Text>
                </View>

                <View style={styles.modalInfoSection}>
                  <Text style={styles.modalLabel}>Gói</Text>
                  <Text style={styles.modalValue}>
                    {checkoutInfo.planLabel}
                  </Text>
                </View>

                <View style={styles.modalInfoSection}>
                  <Text style={styles.modalLabel}>Số tiền</Text>
                  <Text style={styles.modalAmount}>
                    {formatCurrency(checkoutInfo.amount)}đ
                  </Text>
                </View>

                <View style={styles.modalInfoSection}>
                  <View style={styles.transactionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalLabel}>Mã giao dịch</Text>
                      <Text style={styles.modalValue}>
                        {checkoutInfo.transactionId}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={handleCopyTransactionId}
                    >
                      <Ionicons name="copy" size={18} color="#1890ff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {checkoutInfo.createdAt && (
                  <View style={styles.modalInfoSection}>
                    <Text style={styles.modalLabel}>Tạo lúc</Text>
                    <Text style={styles.modalValue}>
                      {dayjs(checkoutInfo.createdAt).format("DD/MM/YYYY HH:mm")}
                    </Text>
                  </View>
                )}

                {/* QR Code */}
                {checkoutInfo.qrUrl ? (
                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: checkoutInfo.qrUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.noQrContainer}>
                    <Text style={styles.noQrText}>
                      Không tìm thấy ảnh QR. Hãy mở link PayOS để thanh toán.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalFooterBtn}
                onPress={handlePaymentCompleted}
              >
                <Ionicons name="refresh" size={18} color="#1890ff" />
                <Text style={styles.modalFooterBtnText}>Tôi đã thanh toán</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalFooterBtn, styles.modalFooterBtnPrimary]}
                onPress={handleOpenPaymentLink}
              >
                <Ionicons name="link" size={18} color="#fff" />
                <Text style={styles.modalFooterBtnTextPrimary}>
                  Mở link PayOS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PricingScreen;

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginTop: 16,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#fff",
    opacity: 0.9,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  trialBanner: {
    marginHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  trialGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  trialTextContainer: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  trialSubtitle: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
  pendingAlert: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  pendingAlertContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  pendingTextContainer: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 4,
  },
  pendingText: {
    fontSize: 13,
    color: "#b45309",
  },
  pendingButton: {
    backgroundColor: "#faad14",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  pendingButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  plansContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    position: "relative",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  planCardSelected: {
    elevation: 8,
    shadowOpacity: 0.12,
  },
  badge: {
    position: "absolute",
    top: -10,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  planIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  priceContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  originalPrice: {
    fontSize: 16,
    color: "#9ca3af",
    textDecorationLine: "line-through",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  price: {
    fontSize: 40,
    fontWeight: "700",
    color: "#111827",
  },
  discountBadge: {
    backgroundColor: "#52c41a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  pricePerMonth: {
    fontSize: 14,
    color: "#6b7280",
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  ctaButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  faqSection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  faqTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 24,
  },
  faqCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalBody: {
    padding: 20,
    maxHeight: SCREEN_WIDTH * 1.2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
    marginBottom: 20,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#faad14",
  },
  modalInfoSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#52c41a",
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  copyButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#e6f4ff",
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  qrImage: {
    width: Math.min(260, SCREEN_WIDTH - 80),
    height: Math.min(260, SCREEN_WIDTH - 80),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  noQrContainer: {
    padding: 20,
    backgroundColor: "#e6f4ff",
    borderRadius: 12,
    marginTop: 20,
  },
  noQrText: {
    fontSize: 14,
    color: "#1890ff",
    textAlign: "center",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalFooterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#e6f4ff",
    gap: 8,
  },
  modalFooterBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1890ff",
  },
  modalFooterBtnPrimary: {
    backgroundColor: "#1890ff",
  },
  modalFooterBtnTextPrimary: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
