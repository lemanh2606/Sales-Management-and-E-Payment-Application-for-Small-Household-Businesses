import React, { useEffect, useState } from "react";
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
};

const SubscriptionSuccessScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderCode, status } = (route.params || {}) as RouteParams;

  const [message, setMessage] = useState("Đang xác nhận thanh toán…");
  const [attempt, setAttempt] = useState(0);
  const [uiStatus, setUiStatus] = useState<"loading" | "success" | "pending">(
    "loading"
  );

  const goSubscription = () => {
    // MainNavigator: name="App" -> AppNavigator (Drawer)
    // AppNavigator: Drawer screen name="Subscription"
    navigation.navigate("App", { screen: "Subscription" });
  };

  const goPricing = () => {
    navigation.navigate("App", { screen: "SubscriptionPricing" });
  };

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await subscriptionApi.getCurrentSubscription();
        const sub = (res as any)?.data?.data || (res as any)?.data;

        if (!cancelled && sub && sub.status === "ACTIVE") {
          setMessage("Thanh toán thành công! Đang chuyển hướng...");
          setUiStatus("success");

          // ✅ Điều hướng đúng nested drawer screen
          setTimeout(() => goSubscription(), 900);
          return;
        }

        if (!cancelled) {
          if (attempt < 4) {
            setAttempt((prev) => prev + 1);
            setMessage(`Đang xác nhận thanh toán... (${attempt + 1}/5)`);
          } else {
            setMessage(
              "Thanh toán thành công. Hệ thống đang cập nhật, vui lòng thử lại sau ít phút."
            );
            setUiStatus("pending");
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (attempt < 5) {
            setAttempt((prev) => prev + 1);
            setMessage(`Đang xác nhận thanh toán... (${attempt + 1}/5)`);
          } else {
            setMessage("Không thể xác nhận giao dịch. Vui lòng thử lại sau.");
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
  }, [attempt]); // không cần đưa navigation vào dependency vì hàm goSubscription/goPricing stable theo render

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.icon}>{uiStatus === "success" ? "✔" : "⏳"}</Text>
        <Text style={styles.title}>
          {uiStatus === "success" ? "Thanh toán thành công" : "Đang xử lý"}
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
          <View style={styles.row}>
            <Pressable
              onPress={goSubscription}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
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
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
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
});
