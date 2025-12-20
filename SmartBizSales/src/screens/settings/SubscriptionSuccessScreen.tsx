import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import subscriptionApi from "../../api/subscriptionApi";

type RouteParams = {
  orderCode?: string | null;
  status?: string | null;
  checkoutUrl?: string | null;
};

const SubscriptionSuccessScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderCode, status, checkoutUrl } = (route.params ||
    {}) as RouteParams;

  const [message, setMessage] = useState("Đang xác nhận thanh toán…");
  const [attempt, setAttempt] = useState(0);
  const [uiStatus, setUiStatus] = useState<"loading" | "success" | "pending">(
    "loading"
  );

  const resetToDrawerScreen = useMemo(
    () => (drawerScreen: "Subscription" | "SubscriptionPricing") => {
      navigation.reset({
        index: 0,
        routes: [{ name: "App", params: { screen: drawerScreen } }],
      });
    },
    [navigation]
  );

  const goSubscription = () => resetToDrawerScreen("Subscription");
  const goPricing = () => resetToDrawerScreen("SubscriptionPricing");

  const backToPayment = () => {
    if (!checkoutUrl) return;
    navigation.reset({
      index: 0,
      routes: [{ name: "PaymentWebView", params: { checkoutUrl } }],
    });
  };

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await subscriptionApi.getCurrentSubscription();
        const sub = (res as any)?.data?.data || (res as any)?.data;

        if (!cancelled && sub && sub.status === "ACTIVE") {
          setMessage("✅ Thanh toán thành công! Đang về trang đăng ký...");
          setUiStatus("success");
          setTimeout(() => goSubscription(), 1200); // ✅ VỀ SUBSCRIPTION NGAY
          return;
        }

        if (!cancelled) {
          if (attempt < 5) {
            // ✅ Tăng lên 5 lần
            setAttempt((prev) => prev + 1);
            setMessage(`Đang xác nhận... (${attempt + 1}/6)`);
          } else {
            setMessage(
              "Hệ thống đang cập nhật. Bạn có thể nhấn 'Về gói đăng ký'."
            );
            setUiStatus("pending");
          }
        }
      } catch {
        if (!cancelled && attempt < 6) {
          setAttempt((prev) => prev + 1);
          setMessage(`Đang xác nhận... (${attempt + 1}/6)`);
        } else {
          setMessage(
            "Không thể xác nhận ngay. Nhấn 'Về gói đăng ký' để tiếp tục."
          );
          setUiStatus("pending");
        }
      }
    };

    const t = setTimeout(verify, 1000); // ✅ Giảm delay
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [attempt, goSubscription]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.icon}>{uiStatus === "success" ? "✔" : "⏳"}</Text>
        <Text style={styles.title}>
          {uiStatus === "success" ? "Thanh toán thành công" : "Đang xử lý"}
        </Text>
        <Text style={styles.sub}>{message}</Text>

        <View style={{ height: 12 }} />
        {orderCode && <Text style={styles.meta}>Mã GD: {orderCode}</Text>}
        {status && <Text style={styles.meta}>PayOS: {status}</Text>}

        {uiStatus === "loading" ? (
          <View style={{ marginTop: 20, alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.muted}>Đừng thoát app nhé!</Text>
          </View>
        ) : (
          <View style={{ marginTop: 20, gap: 12 }}>
            <View style={styles.row}>
              <Pressable
                onPress={goSubscription}
                style={({ pressed }) => [
                  styles.btn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnText}>✅ Về gói đăng ký</Text>
              </Pressable>

              <Pressable
                onPress={goPricing}
                style={({ pressed }) => [
                  styles.btnOutline,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnOutlineText}>Chọn gói khác</Text>
              </Pressable>
            </View>

            {checkoutUrl && (
              <Pressable
                onPress={backToPayment}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>🔄 Thử lại thanh toán</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SubscriptionSuccessScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 24,
  },
  icon: {
    fontSize: 48,
    textAlign: "center",
    color: "#16a34a",
    marginBottom: 12,
  },
  title: {
    fontWeight: "900",
    fontSize: 20,
    color: "#0f172a",
    textAlign: "center",
  },
  sub: {
    marginTop: 8,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 15,
  },
  meta: {
    marginTop: 8,
    color: "#0f172a",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 14,
  },
  muted: {
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btnOutline: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnOutlineText: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
  btnGhost: {
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnGhostText: { color: "#0f172a", fontWeight: "900", fontSize: 16 },
});
