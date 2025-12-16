/**
 * SubscriptionScreen.tsx
 * Màn hình quản lý gói đăng ký (Mobile - React Native / Expo)
 *
 * Tính năng:
 * - Xem trạng thái gói (Trial / Premium / Expired)
 * - Hiển thị pending payment (PayOS): mở link, copy mã, refresh trạng thái
 * - Xem lịch sử thanh toán (phân trang client-side)
 * - Xem thống kê sử dụng (nếu API trả về)
 * - Hủy tự động gia hạn (nếu có API)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import * as Clipboard from "expo-clipboard";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import subscriptionApi from "../../api/subscriptionApi";
import type { RootStackParamList } from "../../navigation/RootNavigation";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED" | string;

type PendingPayment = {
  order_code: string;
  amount: number;
  plan_duration: number; // tháng
  checkout_url?: string | null;
  qr_data_url?: string | null;
  created_at?: string | null;
  status?: "PENDING" | "SUCCESS" | "FAILED" | string;
};

type TrialInfo = {
  ends_at: string; // ISO
};

type PremiumInfo = {
  plan_duration: number; // tháng
  started_at: string; // ISO
  expires_at: string; // ISO
  auto_renew?: boolean;
};

type SubscriptionData = {
  status: SubscriptionStatus;
  days_remaining?: number;
  expires_at?: string | null;

  trial?: TrialInfo | null;
  trial_ends_at?: string | null;

  premium?: PremiumInfo | null;

  pending_payment?: PendingPayment | null;
};

type PaymentHistoryItem = {
  plan_duration: number; // tháng
  amount: number;
  paid_at?: string | null;
  transaction_id?: string | null;
  status?: "SUCCESS" | "PENDING" | "FAILED" | string;
};

type UsageStats = {
  total_orders: number;
  total_revenue: number;
  total_products: number;
};

type NavProp = NativeStackNavigationProp<RootStackParamList>;

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
};

const formatCurrency = (value: unknown) => {
  const n = Number(value || 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("vi-VN") + "đ";
};

const getProgressColor = (daysRemaining: number) => {
  if (daysRemaining > 7) return COLORS.ok;
  if (daysRemaining > 3) return COLORS.warn;
  return COLORS.danger;
};

const getStatusMeta = (status: SubscriptionStatus) => {
  switch (status) {
    case "TRIAL":
      return {
        label: "Dùng thử",
        tone: "info" as const,
        color: COLORS.info,
        icon: "gift-outline" as const,
      };
    case "ACTIVE":
      return {
        label: "Premium",
        tone: "success" as const,
        color: COLORS.ok,
        icon: "sparkles-outline" as const,
      };
    case "CANCELLED":
      return {
        label: "Đã hủy",
        tone: "warning" as const,
        color: COLORS.warn,
        icon: "time-outline" as const,
      };
    case "EXPIRED":
    default:
      return {
        label: "Hết hạn",
        tone: "danger" as const,
        color: COLORS.danger,
        icon: "alert-circle-outline" as const,
      };
  }
};

const Badge: React.FC<{
  text: string;
  tone?: "success" | "danger" | "warning" | "info";
}> = ({ text, tone = "info" }) => {
  const bg =
    tone === "success"
      ? "#dcfce7"
      : tone === "danger"
        ? "#fee2e2"
        : tone === "warning"
          ? "#ffedd5"
          : "#dbeafe";
  const fg =
    tone === "success"
      ? "#166534"
      : tone === "danger"
        ? "#b91c1c"
        : tone === "warning"
          ? "#9a3412"
          : "#1d4ed8";

  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderColor: fg + "33" }]}
    >
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
};

const Card: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => <View style={[styles.card, style]}>{children}</View>;

const RowBetween: React.FC<{
  left: React.ReactNode;
  right: React.ReactNode;
  style?: any;
}> = ({ left, right, style }) => (
  <View style={[styles.rowBetween, style]}>
    <View style={{ flex: 1 }}>{left}</View>
    <View style={{ alignItems: "flex-end" }}>{right}</View>
  </View>
);

const Divider: React.FC = () => <View style={styles.hr} />;

const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  );
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>(
    []
  );
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 6;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [subRes, historyRes, usageRes]: any = await Promise.all([
        subscriptionApi.getCurrentSubscription().catch(() => ({ data: null })),
        subscriptionApi.getPaymentHistory().catch(() => ({ data: [] })),
        subscriptionApi.getUsageStats().catch(() => ({ data: null })),
      ]);

      const sub: SubscriptionData | null = subRes?.data || null;
      const historyArray: PaymentHistoryItem[] =
        (historyRes?.data?.data as PaymentHistoryItem[]) ||
        (historyRes?.data as PaymentHistoryItem[]) ||
        [];

      setSubscription(sub);
      setPaymentHistory(Array.isArray(historyArray) ? historyArray : []);
      setUsageStats(usageRes?.data || null);
      setHistoryPage(1);
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể tải thông tin gói đăng ký");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const computed = useMemo(() => {
    const status = subscription?.status;
    const isTrial = status === "TRIAL";
    const isPremium = status === "ACTIVE";
    const isExpired = status === "EXPIRED" || !status;

    const daysRemaining = Number(subscription?.days_remaining || 0);
    const totalDays = isTrial
      ? 14
      : Math.max(1, Number(subscription?.premium?.plan_duration || 1)) * 30;
    const progressPercent =
      totalDays > 0 ? Math.round((daysRemaining / totalDays) * 100) : 0;

    const pendingPayment = subscription?.pending_payment || null;

    return {
      status,
      isTrial,
      isPremium,
      isExpired,
      daysRemaining,
      totalDays,
      progressPercent,
      pendingPayment,
    };
  }, [subscription]);

  const paginatedHistory = useMemo(() => {
    const total = paymentHistory.length;
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    const end = Math.min(start + HISTORY_PAGE_SIZE, total);
    return {
      total,
      start,
      end,
      items: paymentHistory.slice(start, end),
      canNext: end < total,
      canPrev: historyPage > 1,
    };
  }, [paymentHistory, historyPage]);

  const onUpgrade = useCallback(() => {
    navigation.navigate("SubscriptionPricing");
  }, [navigation]);

  const copyText = useCallback(
    async (value?: string | null, label = "thông tin") => {
      if (!value) return;
      await Clipboard.setStringAsync(value);
      Alert.alert("Đã sao chép", `Đã sao chép ${label}`);
    },
    []
  );

  // MỞ LẠI LINK THANH TOÁN TRONG APP (PaymentWebView)
  const openPendingInApp = useCallback(() => {
    const url = computed.pendingPayment?.checkout_url;
    if (!url) {
      Alert.alert("Không có link", "Không tìm thấy link thanh toán.");
      return;
    }
    navigation.navigate("PaymentWebView", { checkoutUrl: url });
  }, [navigation, computed.pendingPayment]);

  const confirmCancelAutoRenew = useCallback(() => {
    Alert.alert(
      "Hủy tự động gia hạn",
      "Bạn có chắc muốn hủy tự động gia hạn? Gói sẽ hết hạn sau khi kết thúc chu kỳ.",
      [
        { text: "Giữ nguyên", style: "cancel" },
        {
          text: "Hủy gia hạn",
          style: "destructive",
          onPress: async () => {
            try {
              await subscriptionApi.cancelAutoRenew();
              Alert.alert("Thành công", "Đã hủy tự động gia hạn.");
              fetchData();
            } catch (e: any) {
              Alert.alert("Thất bại", e?.message || "Không thể hủy gia hạn.");
            }
          },
        },
      ]
    );
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Chưa có gói
  if (!subscription || !subscription.status) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Gói đăng ký</Text>
            <Text style={styles.heroSub}>Quản lý gói và thanh toán</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={fetchData}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
          <Card style={{ alignItems: "center" }}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.warn}
            />
            <Text style={[styles.h2, { marginTop: 10 }]}>
              Chưa có gói dịch vụ
            </Text>
            <Text style={[styles.p, { textAlign: "center" }]}>
              Nâng cấp lên Premium để sử dụng đầy đủ tính năng.
            </Text>

            <Pressable
              style={[styles.btn, styles.btnPrimary, { marginTop: 14 }]}
              onPress={onUpgrade}
            >
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Xem gói Premium</Text>
            </Pressable>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const meta = getStatusMeta(subscription.status);
  const tone =
    meta.tone === "success"
      ? "success"
      : meta.tone === "danger"
        ? "danger"
        : meta.tone === "warning"
          ? "warning"
          : "info";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Gói đăng ký</Text>
          <Text style={styles.heroSub}>Quản lý gói và thanh toán</Text>
        </View>

        <Pressable style={styles.iconBtn} onPress={fetchData}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
        {/* Pending payment */}
        {computed.pendingPayment ? (
          <Card style={{ borderColor: "#fed7aa" }}>
            <RowBetween
              left={
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={[
                      styles.circleIcon,
                      { backgroundColor: "#ffedd5", borderColor: "#fdba74" },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={COLORS.warn}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Đang chờ thanh toán</Text>
                    <Text style={styles.subText}>
                      Mã GD: {computed.pendingPayment.order_code}
                    </Text>
                  </View>
                </View>
              }
              right={<Badge text="PENDING" tone="warning" />}
            />

            <Divider />

            <Text style={styles.p}>
              Số tiền:{" "}
              <Text style={styles.pStrong}>
                {formatCurrency(computed.pendingPayment.amount)}
              </Text>{" "}
              • Gói{" "}
              <Text style={styles.pStrong}>
                {computed.pendingPayment.plan_duration}
              </Text>{" "}
              tháng
            </Text>

            {computed.pendingPayment.created_at ? (
              <Text style={styles.subText}>
                Tạo lúc{" "}
                {dayjs(computed.pendingPayment.created_at).format(
                  "DD/MM/YYYY HH:mm"
                )}
              </Text>
            ) : null}

            {computed.pendingPayment.qr_data_url ? (
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <Image
                  source={{ uri: computed.pendingPayment.qr_data_url }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <Text style={[styles.subText, { marginTop: 8 }]}>
                  Quét QR để thanh toán
                </Text>
              </View>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 12,
                flexWrap: "wrap",
              }}
            >
              <Pressable
                style={[styles.btn, styles.btnPrimary, { flexGrow: 1 }]}
                onPress={openPendingInApp}
              >
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Mở trong app</Text>
              </Pressable>

              <Pressable
                style={[styles.btn, styles.btnOutline, { flexGrow: 1 }]}
                onPress={() =>
                  copyText(computed.pendingPayment?.order_code, "mã giao dịch")
                }
              >
                <Ionicons name="copy-outline" size={18} color={COLORS.text} />
                <Text style={styles.btnOutlineText}>Sao chép mã</Text>
              </Pressable>

              <Pressable
                style={[styles.btn, styles.btnOutline, { flexGrow: 1 }]}
                onPress={fetchData}
              >
                <Ionicons name="reload-outline" size={18} color={COLORS.text} />
                <Text style={styles.btnOutlineText}>Tôi đã thanh toán</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Current subscription */}
        <Card>
          <View style={styles.rowBetween}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                flex: 1,
              }}
            >
              <View
                style={[
                  styles.circleIcon,
                  { backgroundColor: "#ecfdf5", borderColor: "#86efac" },
                ]}
              >
                <Ionicons name={meta.icon} size={18} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Gói hiện tại</Text>
                <Text style={styles.subText}>Trạng thái gói đăng ký</Text>
              </View>
            </View>
            <Badge text={meta.label} tone={tone} />
          </View>

          <Divider />

          {/* Trial */}
          {computed.isTrial && subscription.trial?.ends_at ? (
            <View style={{ gap: 10 }}>
              <RowBetween
                left={<Text style={styles.pStrong}>🎁 Dùng thử miễn phí</Text>}
                right={
                  <Text style={styles.subText}>
                    Hết hạn:{" "}
                    {dayjs(subscription.trial.ends_at).format("DD/MM/YYYY")}
                  </Text>
                }
              />
              <View style={styles.progressOuter}>
                <View
                  style={[
                    styles.progressInner,
                    {
                      width: `${Math.max(0, Math.min(100, computed.progressPercent))}%`,
                      backgroundColor: getProgressColor(computed.daysRemaining),
                    },
                  ]}
                />
              </View>
              <Text style={styles.subText}>
                {computed.daysRemaining} ngày còn lại
              </Text>

              <View
                style={[
                  styles.noticeBox,
                  {
                    backgroundColor:
                      computed.daysRemaining <= 3 ? "#fff1f0" : "#e6f7ff",
                    borderColor:
                      computed.daysRemaining <= 3 ? "#ffccc7" : "#91d5ff",
                  },
                ]}
              >
                <Text style={styles.pStrong}>
                  {computed.daysRemaining <= 3
                    ? "⚠️ Gói dùng thử sắp hết hạn!"
                    : "ℹ️ Thông tin dùng thử"}
                </Text>
                <Text style={[styles.p, { marginTop: 6 }]}>
                  Có thể sử dụng tất cả tính năng Premium trong thời gian dùng
                  thử.
                </Text>
                {computed.daysRemaining <= 3 ? (
                  <Text
                    style={[
                      styles.p,
                      { marginTop: 6, color: COLORS.danger, fontWeight: "800" },
                    ]}
                  >
                    Nâng cấp ngay để không bị gián đoạn dịch vụ!
                  </Text>
                ) : null}
              </View>

              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={onUpgrade}
              >
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Nâng cấp Premium</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Premium */}
          {computed.isPremium && subscription.premium ? (
            <View style={{ gap: 10 }}>
              <View style={styles.kpiRow}>
                <View
                  style={[
                    styles.kpiCard,
                    { backgroundColor: "#f6ffed", borderColor: "#b7eb8f" },
                  ]}
                >
                  <Text style={styles.kpiLabel}>Gói Premium</Text>
                  <Text style={styles.kpiValue}>
                    {subscription.premium.plan_duration} tháng
                  </Text>
                </View>
                <View
                  style={[
                    styles.kpiCard,
                    { backgroundColor: "#fff7e6", borderColor: "#ffd591" },
                  ]}
                >
                  <Text style={styles.kpiLabel}>Còn lại</Text>
                  <Text
                    style={[
                      styles.kpiValue,
                      { color: getProgressColor(computed.daysRemaining) },
                    ]}
                  >
                    {computed.daysRemaining} ngày
                  </Text>
                </View>
              </View>

              <RowBetween
                left={<Text style={styles.p}>Bắt đầu</Text>}
                right={
                  <Text style={styles.pStrong}>
                    {dayjs(subscription.premium.started_at).format(
                      "DD/MM/YYYY"
                    )}
                  </Text>
                }
              />
              <RowBetween
                left={<Text style={styles.p}>Hết hạn</Text>}
                right={
                  <Text style={[styles.pStrong, { color: COLORS.danger }]}>
                    {dayjs(subscription.premium.expires_at).format(
                      "DD/MM/YYYY"
                    )}
                  </Text>
                }
              />

              <View style={styles.progressOuter}>
                <View
                  style={[
                    styles.progressInner,
                    {
                      width: `${Math.max(0, Math.min(100, computed.progressPercent))}%`,
                      backgroundColor: getProgressColor(computed.daysRemaining),
                    },
                  ]}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                <Pressable
                  style={[styles.btn, styles.btnPrimary, { flexGrow: 1 }]}
                  onPress={onUpgrade}
                >
                  <Ionicons name="reload-outline" size={18} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Gia hạn gói</Text>
                </Pressable>

                <Pressable
                  style={[styles.btn, styles.btnOutline, { flexGrow: 1 }]}
                  onPress={confirmCancelAutoRenew}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={18}
                    color={COLORS.text}
                  />
                  <Text style={styles.btnOutlineText}>Hủy tự động gia hạn</Text>
                </Pressable>
              </View>

              {computed.daysRemaining <= 7 ? (
                <View
                  style={[
                    styles.noticeBox,
                    { backgroundColor: "#fff1f0", borderColor: "#ffccc7" },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="warning-outline"
                      size={18}
                      color={COLORS.danger}
                    />
                    <Text style={[styles.pStrong, { color: COLORS.danger }]}>
                      Gói Premium sắp hết hạn
                    </Text>
                  </View>
                  <Text style={[styles.p, { marginTop: 6 }]}>
                    Gia hạn để không bị gián đoạn dịch vụ.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Expired */}
          {computed.isExpired ? (
            <View style={{ gap: 10 }}>
              <View
                style={[
                  styles.noticeBox,
                  { backgroundColor: "#fff1f0", borderColor: "#ffccc7" },
                ]}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={COLORS.danger}
                  />
                  <Text style={[styles.pStrong, { color: COLORS.danger }]}>
                    Gói đăng ký đã hết hạn
                  </Text>
                </View>
                <Text style={[styles.p, { marginTop: 6 }]}>
                  Gia hạn ngay để tiếp tục sử dụng đầy đủ tính năng Premium.
                </Text>
              </View>

              <Pressable
                style={[styles.btn, styles.btnDanger]}
                onPress={onUpgrade}
              >
                <Ionicons name="reload-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Gia hạn ngay</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>

        {/* Payment history */}
        <Card>
          <View style={styles.rowBetween}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={[
                  styles.circleIcon,
                  { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
                ]}
              >
                <Ionicons name="card-outline" size={18} color={COLORS.info} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Lịch sử thanh toán</Text>
                <Text style={styles.subText}>
                  {paymentHistory.length} giao dịch
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.smallBtn}
              onPress={() => setHistoryPage(1)}
            >
              <Text style={styles.smallBtnText}>Về đầu</Text>
            </Pressable>
          </View>

          <Divider />

          {paymentHistory.length ? (
            <View style={{ gap: 10 }}>
              {paginatedHistory.items.map((p, idx) => {
                const s = p.status || "—";
                const toneStatus =
                  s === "SUCCESS"
                    ? "success"
                    : s === "PENDING"
                      ? "warning"
                      : s === "FAILED"
                        ? "danger"
                        : "info";

                return (
                  <View
                    key={`${p.transaction_id || "tx"}:${idx}`}
                    style={styles.historyRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pStrong}>
                        Gói {p.plan_duration} tháng • {formatCurrency(p.amount)}
                      </Text>
                      <Text style={styles.subText}>
                        {p.paid_at
                          ? dayjs(p.paid_at).format("DD/MM/YYYY HH:mm")
                          : "Đang xử lý"}
                      </Text>
                      <Text style={styles.subText}>
                        Mã GD: {p.transaction_id || "—"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <Badge text={s} tone={toneStatus as any} />
                      {p.transaction_id ? (
                        <Pressable
                          onPress={() =>
                            copyText(p.transaction_id, "mã giao dịch")
                          }
                          style={styles.iconSquare}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={16}
                            color={COLORS.text}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[
                    styles.btn,
                    styles.btnOutline,
                    { flex: 1, opacity: paginatedHistory.canPrev ? 1 : 0.5 },
                  ]}
                  disabled={!paginatedHistory.canPrev}
                  onPress={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons name="chevron-back" size={18} color={COLORS.text} />
                  <Text style={styles.btnOutlineText}>Trước</Text>
                </Pressable>

                <View style={[styles.pagePill, { flex: 1 }]}>
                  <Text style={styles.pagePillText}>
                    {paginatedHistory.total
                      ? `${paginatedHistory.start + 1}-${paginatedHistory.end}/${paginatedHistory.total}`
                      : "0"}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.btn,
                    styles.btnOutline,
                    { flex: 1, opacity: paginatedHistory.canNext ? 1 : 0.5 },
                  ]}
                  disabled={!paginatedHistory.canNext}
                  onPress={() => setHistoryPage((p) => p + 1)}
                >
                  <Text style={styles.btnOutlineText}>Sau</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.text}
                  />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons
                name="cash-remove"
                size={22}
                color={COLORS.sub}
              />
              <Text style={styles.emptyText}>Chưa có lịch sử thanh toán</Text>
            </View>
          )}
        </Card>

        {/* Usage stats */}
        {usageStats ? (
          <Card>
            <View style={styles.rowBetween}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={[
                    styles.circleIcon,
                    { backgroundColor: "#f0f5ff", borderColor: "#adc6ff" },
                  ]}
                >
                  <Ionicons
                    name="stats-chart-outline"
                    size={18}
                    color={COLORS.info}
                  />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Thống kê sử dụng</Text>
                  <Text style={styles.subText}>Dữ liệu tổng quan</Text>
                </View>
              </View>
            </View>

            <Divider />

            <View style={styles.kpiRow}>
              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: "#f0f5ff", borderColor: "#adc6ff" },
                ]}
              >
                <Text style={styles.kpiLabel}>Tổng đơn hàng</Text>
                <Text style={styles.kpiValue}>{usageStats.total_orders}</Text>
              </View>
              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: "#fff7e6", borderColor: "#ffd591" },
                ]}
              >
                <Text style={styles.kpiLabel}>Doanh thu</Text>
                <Text style={styles.kpiValue}>
                  {Number(usageStats.total_revenue || 0).toLocaleString(
                    "vi-VN"
                  )}
                  đ
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <View
                style={[
                  styles.kpiCard,
                  { backgroundColor: "#f6ffed", borderColor: "#b7eb8f" },
                ]}
              >
                <Text style={styles.kpiLabel}>Sản phẩm</Text>
                <Text style={styles.kpiValue}>{usageStats.total_products}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Premium benefits */}
        <Card>
          <Text style={styles.cardTitle}>Quyền lợi Premium</Text>
          <Text style={[styles.subText, { marginTop: 2 }]}>
            Tóm tắt những gì bạn nhận được
          </Text>

          <Divider />

          {[
            "Không giới hạn sản phẩm",
            "Không giới hạn đơn hàng",
            "Báo cáo & thống kê",
            "Quản lý kho nâng cao",
            "Hỗ trợ 24/7",
          ].map((t) => (
            <View key={t} style={styles.benefitRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={COLORS.ok}
              />
              <Text style={styles.p}>{t}</Text>
            </View>
          ))}
        </Card>

        <View style={{ height: 6 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SubscriptionScreen;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  heroSub: { marginTop: 2, color: "rgba(255,255,255,0.92)", fontWeight: "800" },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: COLORS.sub, fontWeight: "700", marginTop: 8 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 2 },
      default: {},
    }),
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  subText: { marginTop: 3, color: COLORS.sub, fontWeight: "700", fontSize: 12 },

  h2: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  p: { color: COLORS.text, fontWeight: "700", fontSize: 12, lineHeight: 18 },
  pStrong: { color: COLORS.text, fontWeight: "900", fontSize: 12 },

  hr: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: "900", fontSize: 12 },

  circleIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDanger: { backgroundColor: COLORS.danger },
  btnOutline: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnOutlineText: { color: COLORS.text, fontWeight: "900" },

  qrImage: {
    width: 240,
    height: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },

  noticeBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },

  progressOuter: {
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressInner: {
    height: 10,
    borderRadius: 999,
  },

  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  kpiLabel: { color: COLORS.sub, fontWeight: "900", fontSize: 12 },
  kpiValue: {
    marginTop: 6,
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },

  historyRow: {
    flexDirection: "row",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
  },

  iconSquare: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },

  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
  },
  smallBtnText: { fontWeight: "900", color: COLORS.text, fontSize: 12 },

  pagePill: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  pagePillText: { color: COLORS.primaryDark, fontWeight: "900" },

  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#f8fafc",
  },
  emptyText: { color: COLORS.sub, fontWeight: "800" },

  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
});
