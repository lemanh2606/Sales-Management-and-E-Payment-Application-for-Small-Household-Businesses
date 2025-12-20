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
  checkoutUrl?: string | null; // ✅ thêm để quay lại webview
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

  // ✅ Reset về Drawer screen (App -> Drawer screen)
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
    // mở lại PaymentWebView để user thanh toán lại / kiểm tra
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
          setMessage("Hủy thanh toán Đang chuyển hướng...");
          setUiStatus("success");
          setTimeout(() => goSubscription(), 900);
          return;
        }

        if (!cancelled) {
          if (attempt < 4) {
            setAttempt((prev) => prev + 1);
            setMessage(`Đang Hủy... (${attempt + 1}/5)`);
          } else {
            setMessage(
              "Hệ thống đang cập nhật. Nếu chưa được kích hoạt, bạn có thể quay lại trang thanh toán để thử lại."
            );
            setUiStatus("pending");
          }
        }
      } catch {
        if (!cancelled) {
          if (attempt < 5) {
            setAttempt((prev) => prev + 1);
            setMessage(`Đang Hủy.. (${attempt + 1}/5)`);
          } else {
            setMessage(
              "Không thể xác nhận giao dịch. Bạn có thể quay lại trang thanh toán để thử lại."
            );
            setUiStatus("pending");
          }
        }
      }
    };

    const t = setTimeout(verify, 1200);
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
          {uiStatus === "success" ? "Hủy thành công" : "Đang xử lý"}
        </Text>
        <Text style={styles.sub}>{message}</Text>

        <View style={{ height: 10 }} />
        {orderCode ? (
          <Text style={styles.meta}>Mã giao dịch: {orderCode}</Text>
        ) : null}
        {status ? (
          <Text style={styles.meta}>Trạng thái PayOS: {status}</Text>
        ) : null}

        {uiStatus === "loading" ? (
          <View style={{ marginTop: 14, alignItems: "center", gap: 10 }}>
            <ActivityIndicator />
            <Text style={styles.muted}>
              Vui lòng không thoát app trong lúc xác nhận.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 14, gap: 10 }}>
            {/* Row 1 */}
            <View style={styles.row}>
              <Pressable
                onPress={goSubscription}
                style={({ pressed }) => [
                  styles.btn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnText}>Về gói đăng ký</Text>
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

            {/* Row 2: quay lại webview */}
            {checkoutUrl ? (
              <Pressable
                onPress={backToPayment}
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnGhostText}>
                  Quay lại trang thanh toán
                </Text>
              </Pressable>
            ) : null}
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
    padding: 12,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  icon: {
    fontSize: 44,
    textAlign: "center",
    color: "#16a34a",
    marginBottom: 8,
  },
  title: {
    fontWeight: "900",
    fontSize: 18,
    color: "#0f172a",
    textAlign: "center",
  },
  sub: {
    marginTop: 6,
    color: "#64748b",
    fontWeight: "700",
    textAlign: "center",
  },
  meta: {
    marginTop: 6,
    color: "#0f172a",
    fontWeight: "800",
    textAlign: "center",
  },
  muted: { color: "#64748b", fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "900" },
  btnOutline: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnOutlineText: { color: "#0f172a", fontWeight: "900" },
  btnGhost: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnGhostText: { color: "#0f172a", fontWeight: "900" },
});
