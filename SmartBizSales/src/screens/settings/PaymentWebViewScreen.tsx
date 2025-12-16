// src/screens/settings/PaymentWebViewScreen.tsx
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
  Pressable,
  Text,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";

type RouteParams = { checkoutUrl: string };

function getQueryParam(url: string, key: string) {
  try {
    const u = new URL(url);
    return u.searchParams.get(key);
  } catch {
    // fallback nhẹ nếu URL() không parse được
    const m = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export default function PaymentWebViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { checkoutUrl } = (route.params || {}) as RouteParams;

  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  const handleIntercept = useCallback(
    (url: string) => {
      // Ví dụ deep link:
      // posapp://subscription/success?orderCode=...&status=...
      // posapp://subscription/cancel?orderCode=...
      const lower = String(url || "").toLowerCase();

      if (lower.startsWith("posapp://subscription/success")) {
        const orderCode = getQueryParam(url, "orderCode");
        const status = getQueryParam(url, "status");

        // ✅ replace trong CÙNG Main Stack: hợp lệ
        navigation.replace("SubscriptionSuccess", {
          orderCode,
          status,
          checkoutUrl,
        });
        return false;
      }

      if (lower.startsWith("posapp://subscription/cancel")) {
        const orderCode = getQueryParam(url, "orderCode");
        navigation.replace("SubscriptionCancel", { orderCode, checkoutUrl });
        return false;
      }

      return true;
    },
    [checkoutUrl, navigation]
  );

  if (!checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.err}>Thiếu checkoutUrl</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.btn}>
            <Text style={styles.btnText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Đóng</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={{ width: 60 }} />
      </View>

      <WebView
        ref={webRef}
        source={{ uri: checkoutUrl }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={(req) => handleIntercept(req.url)}
      />

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  headerBtnText: { fontWeight: "800", color: "#0f172a" },
  headerTitle: { fontWeight: "900", color: "#0f172a" },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  err: { fontWeight: "900", color: "#ef4444" },
  btn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "900" },
});
