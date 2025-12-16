import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import subscriptionApi, {
  CurrentSubscription,
  PlanDuration,
} from "../../api/subscriptionApi";
import type { RootStackParamList } from "../../navigation/RootNavigation";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type PricingPlan = {
  duration: PlanDuration;
  label: string;

  price: number;
  original_price?: number;
  discount?: number;
  discount_percent?: number;
  price_per_month?: number;

  badge?: "Phổ biến" | "Tiết kiệm nhất" | string | null;
};

const COLORS = {
  primary: "#10b981",
  primaryDark: "#0f766e",
  bg: "#f1f5f9",
  card: "#ffffff",
  text: "#0f172a",
  sub: "#64748b",
  border: "#e2e8f0",
  danger: "#ef4444",
  warn: "#f59e0b",
  ok: "#16a34a",
  info: "#2563eb",
  blue: "#1890ff",
};

const formatCurrency = (value: unknown) =>
  Number(value || 0).toLocaleString("vi-VN");

const getPlanColor = (duration: PlanDuration) => {
  if (duration === 1) return COLORS.blue;
  if (duration === 3) return COLORS.ok;
  return COLORS.warn;
};

const getPlanIcon = (duration: PlanDuration) => {
  if (duration === 1)
    return (
      <Ionicons name="flash-outline" size={28} color={getPlanColor(duration)} />
    );
  if (duration === 3)
    return (
      <Ionicons
        name="rocket-outline"
        size={28}
        color={getPlanColor(duration)}
      />
    );
  return <Ionicons name="star" size={28} color={getPlanColor(duration)} />;
};

const DEFAULT_PLANS: PricingPlan[] = [
  {
    duration: 1,
    label: "1 tháng",
    price: 5000,
    original_price: 10000,
    discount: 0,
    discount_percent: 0,
    price_per_month: 5000,
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

const Pill: React.FC<{
  text: string;
  tone?: "info" | "success" | "warning" | "danger";
}> = ({ text, tone = "info" }) => {
  const map = {
    info: { bg: "#dbeafe", fg: "#1d4ed8" },
    success: { bg: "#dcfce7", fg: "#166534" },
    warning: { bg: "#ffedd5", fg: "#9a3412" },
    danger: { bg: "#fee2e2", fg: "#b91c1c" },
  } as const;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: map[tone].bg, borderColor: map[tone].fg + "33" },
      ]}
    >
      <Text style={[styles.pillText, { color: map[tone].fg }]}>{text}</Text>
    </View>
  );
};

const PricingScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSubscription | null>(
    null
  );

  const [processingPlan, setProcessingPlan] = useState<PlanDuration | null>(
    null
  );
  const [selectedPlan, setSelectedPlan] = useState<PlanDuration | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<PricingPlan | null>(null);

  const isTrial = currentSub?.status === "TRIAL";

  const numColumns = useMemo(() => {
    if (width >= 900) return 3;
    if (width >= 560) return 2;
    return 1;
  }, [width]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [plansRes, subRes] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getCurrentSubscription().catch(() => ({ data: null })),
      ]);

      const serverPlans = (plansRes?.data as any)?.plans as
        | PricingPlan[]
        | undefined;
      setPlans(
        Array.isArray(serverPlans) && serverPlans.length
          ? serverPlans
          : DEFAULT_PLANS
      );

      setCurrentSub((subRes?.data as unknown as CurrentSubscription) || null);
    } catch (e) {
      setPlans(DEFAULT_PLANS);
      Alert.alert(
        "Lỗi",
        "Không thể tải thông tin gói. Đang dùng dữ liệu mặc định."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTapPlan = (duration: PlanDuration) => {
    const p = plans.find((x) => x.duration === duration);
    if (!p) {
      Alert.alert("Lỗi", "Không tìm thấy gói đã chọn");
      return;
    }
    setSelectedPlan(duration);
    setConfirmPlan(p);
    setConfirmOpen(true);
  };

  const handleConfirm = useCallback(async () => {
    if (!confirmPlan) return;

    const token = await AsyncStorage.getItem("token");
    if (!token) {
      setConfirmOpen(false);
      Alert.alert(
        "Chưa đăng nhập",
        "Vui lòng đăng nhập để nâng cấp gói Premium."
      );
      return;
    }

    try {
      setProcessingPlan(confirmPlan.duration);
      setConfirmOpen(false);

      const checkoutRes = await subscriptionApi.createCheckout({
        plan_duration: confirmPlan.duration,
      });

      const data: any = checkoutRes?.data || {};
      const checkoutUrl: string | undefined =
        data.checkout_url ||
        data.checkoutUrl ||
        data.paymentLink ||
        data.payment_link;

      if (!checkoutUrl) throw new Error("Không tìm thấy link thanh toán");

      // ✅ MỞ TRONG APP (WebView screen)
      navigation.navigate("PaymentWebView", { checkoutUrl });
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tạo thanh toán"
      );
    } finally {
      setProcessingPlan(null);
    }
  }, [confirmPlan, navigation]);

  const renderPlan = ({ item }: { item: PricingPlan }) => {
    const isSelected = selectedPlan === item.duration;
    const color = getPlanColor(item.duration);
    const isLoading = processingPlan === item.duration;

    return (
      <View style={[styles.planWrap, { width: `${100 / numColumns}%` }]}>
        <Pressable
          onPress={() => handleTapPlan(item.duration)}
          style={({ pressed }) => [
            styles.planCard,
            {
              borderColor: isSelected ? color : COLORS.border,
              borderWidth: isSelected ? 2 : 1,
            },
            pressed && { opacity: 0.94 },
          ]}
        >
          {item.badge ? (
            <View style={[styles.planBadge, { backgroundColor: color }]}>
              <Text style={styles.planBadgeText}>{item.badge}</Text>
            </View>
          ) : null}

          <View style={styles.planIcon}>{getPlanIcon(item.duration)}</View>

          <Text style={[styles.planTitle, { color }]}>Gói {item.label}</Text>

          <View style={{ alignItems: "center", marginTop: 8 }}>
            {item.discount && item.discount > 0 && item.original_price ? (
              <Text style={styles.planOldPrice}>
                {formatCurrency(item.original_price)}đ
              </Text>
            ) : null}

            <Text style={styles.planPrice}>{formatCurrency(item.price)}đ</Text>

            <Text style={styles.planPerMonth}>
              {formatCurrency(
                item.price_per_month ?? Math.round(item.price / item.duration)
              )}
              đ/tháng
            </Text>

            {item.discount_percent && item.discount_percent > 0 ? (
              <View style={styles.discountPill}>
                <Text style={styles.discountPillText}>
                  -{item.discount_percent}%
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.featureBox}>
            {[
              "Tất cả tính năng Premium",
              "Không giới hạn sản phẩm",
              "Không giới hạn đơn hàng",
              "Báo cáo & thống kê",
              "Hỗ trợ 24/7",
            ].map((t, idx) => (
              <View key={idx} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.ok}
                />
                <Text style={styles.featureText}>{t}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => handleTapPlan(item.duration)}
            disabled={!!processingPlan}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: isSelected ? "#16a34a" : "#22c55e" },
              (pressed || !!processingPlan) && { opacity: 0.85 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Chọn gói này</Text>
            )}
          </Pressable>
        </Pressable>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconBox}>
            <Ionicons name="star" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Chọn gói Premium</Text>
            <Text style={styles.headerSub}>
              Mua càng dài, tiết kiệm càng nhiều
            </Text>
          </View>
          <Pressable
            onPress={fetchData}
            style={({ pressed }) => [
              styles.refreshBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="refresh" size={18} color={COLORS.text} />
          </Pressable>
        </View>

        {isTrial ? (
          <View style={styles.trialBanner}>
            <Text style={styles.trialTitle}>🎁 Bạn đang dùng thử miễn phí</Text>
            <Text style={styles.trialSub}>
              Còn{" "}
              <Text style={styles.bold}>
                {currentSub?.days_remaining ?? 0} ngày
              </Text>{" "}
              dùng thử. Nâng cấp ngay để không bị gián đoạn!
            </Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 12, marginTop: 12 }}>
          <FlatList
            data={plans}
            keyExtractor={(it) => String(it.duration)}
            renderItem={renderPlan}
            numColumns={numColumns}
            scrollEnabled={false}
            key={numColumns}
            columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
            contentContainerStyle={{ gap: 12 }}
          />
        </View>

        <View style={{ paddingHorizontal: 12, marginTop: 16 }}>
          <View style={styles.faqHeader}>
            <MaterialCommunityIcons
              name="comment-question-outline"
              size={18}
              color={COLORS.text}
            />
            <Text style={styles.faqTitle}>Câu hỏi thường gặp</Text>
          </View>

          {[
            {
              q: "💳 Thanh toán như thế nào?",
              a: "Chuyển khoản ngân hàng qua QR Code PayOS, nhanh chóng và an toàn.",
            },
            {
              q: "🔄 Có tự động gia hạn không?",
              a: "Không, bạn cần gia hạn thủ công khi hết hạn.",
            },
            {
              q: "🎁 Trial có đầy đủ tính năng không?",
              a: "Có! Bạn được dùng thử TẤT CẢ tính năng Premium trong 14 ngày.",
            },
            {
              q: "🔐 Dữ liệu có an toàn không?",
              a: "Hoàn toàn! Dữ liệu được mã hóa và backup tự động hàng ngày.",
            },
          ].map((x, i) => (
            <View key={i} style={styles.faqCard}>
              <Text style={styles.faqQ}>{x.q}</Text>
              <Text style={styles.faqA}>{x.a}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfirmOpen(false)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Xác nhận chọn gói</Text>

            {confirmPlan ? (
              <View style={{ marginTop: 10, gap: 10 }}>
                <View style={styles.modalRowBetween}>
                  <Text style={styles.modalLabel}>Gói</Text>
                  <Text style={styles.modalValue}>
                    {confirmPlan.duration} tháng
                  </Text>
                </View>

                {currentSub?.status === "ACTIVE" ? (
                  <View style={styles.renewBox}>
                    <Pill text="Gia hạn" tone="success" />
                    <Text style={styles.renewText}>
                      Thời gian sẽ được cộng thêm{" "}
                      <Text style={styles.bold}>
                        {confirmPlan.duration} tháng
                      </Text>
                      .
                    </Text>
                    <Text style={styles.renewSub}>
                      Gói hiện tại còn:{" "}
                      <Text style={styles.bold}>
                        {currentSub?.days_remaining ?? 0} ngày
                      </Text>
                    </Text>
                  </View>
                ) : null}

                <View style={styles.modalRowBetween}>
                  <Text style={styles.modalLabel}>Giá</Text>
                  <Text style={[styles.modalValue, { color: COLORS.ok }]}>
                    {formatCurrency(confirmPlan.price)}đ
                  </Text>
                </View>

                <Text style={styles.modalHint}>
                  Sau khi xác nhận, sẽ mở trang thanh toán PayOS trong app.
                </Text>

                <View style={styles.modalBtnRow}>
                  <Pressable
                    onPress={() => setConfirmOpen(false)}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnOutline,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnOutlineText}>Hủy</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                      styles.btn,
                      styles.btnPrimary,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={styles.btnPrimaryText}>Xác nhận</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default PricingScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { marginTop: 10, color: COLORS.sub, fontWeight: "700" },
  bold: { fontWeight: "900" },

  headerCard: {
    marginTop: 10,
    marginHorizontal: 12,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.warn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  headerSub: { marginTop: 2, color: COLORS.sub, fontWeight: "700" },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  trialBanner: {
    marginTop: 12,
    marginHorizontal: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#91d5ff",
    backgroundColor: "#e6f7ff",
  },
  trialTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  trialSub: { marginTop: 6, color: COLORS.text, fontWeight: "700" },

  planWrap: {},
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  planBadge: {
    position: "absolute",
    top: -10,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  planBadgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  planIcon: { alignItems: "center", marginTop: 10 },
  planTitle: {
    textAlign: "center",
    marginTop: 10,
    fontWeight: "900",
    fontSize: 16,
  },

  planOldPrice: {
    color: "#94a3b8",
    fontWeight: "800",
    textDecorationLine: "line-through",
  },
  planPrice: {
    marginTop: 2,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 28,
  },
  planPerMonth: { marginTop: 4, color: COLORS.sub, fontWeight: "700" },

  discountPill: {
    marginTop: 8,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  discountPillText: { color: "#166534", fontWeight: "900", fontSize: 12 },

  featureBox: { marginTop: 12, gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { color: COLORS.text, fontWeight: "700", flex: 1 },

  ctaBtn: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  faqTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  faqCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  faqQ: { color: COLORS.text, fontWeight: "900" },
  faqA: { marginTop: 6, color: COLORS.sub, fontWeight: "700" },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  pillText: { fontWeight: "900", fontSize: 12 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    justifyContent: "center",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  modalTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  modalRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalLabel: { color: COLORS.sub, fontWeight: "800" },
  modalValue: { color: COLORS.text, fontWeight: "900" },
  modalHint: { marginTop: 6, color: COLORS.sub, fontWeight: "700" },
  modalBtnRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },

  renewBox: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#ecfdf5",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  renewText: { color: COLORS.text, fontWeight: "700" },
  renewSub: { color: COLORS.sub, fontWeight: "700" },

  btn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 110,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnOutlineText: { color: COLORS.text, fontWeight: "900" },
});
