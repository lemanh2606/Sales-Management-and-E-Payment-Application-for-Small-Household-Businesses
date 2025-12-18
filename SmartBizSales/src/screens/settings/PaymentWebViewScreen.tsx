import React, { useState, useRef } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
  Pressable,
  Text,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import subscriptionApi from "../../api/subscriptionApi";
type RouteParams = { checkoutUrl: string };

// 🛠 Hàm tiện ích lấy param từ URL
function getQueryParam(url: string, key: string) {
  try {
    // Hack nhẹ để hỗ trợ URL không chuẩn
    const cleanUrl = url.replace("#", "?");
    const u = new URL(cleanUrl);
    return u.searchParams.get(key);
  } catch {
    const m = url.match(new RegExp(`[?&]${key}=([^&]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export default function PaymentWebViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { checkoutUrl } = (route.params || {}) as RouteParams;

  const [loading, setLoading] = useState(true);
  // ✅ HÀM XỬ LÝ HỦY: Gọi API trước khi chuyển trang
  const handleCancelProcess = async (orderCode: string | null) => {
    try {
      console.log("⏳ Đang gọi API hủy đơn:", orderCode);
      setLoading(true); // Hiện loading xoay xoay

      // 👇 GỌI API CLEAR PAYMENT TẠI ĐÂY
      if (subscriptionApi && subscriptionApi.clearPendingPayment) {
        await subscriptionApi.clearPendingPayment(orderCode);
      } else {
        console.warn(
          "⚠️ Chưa import subscriptionApi hoặc thiếu hàm clearPendingPayment"
        );
      }

      console.log("✅ Đã hủy thành công trên Server");
    } catch (error) {
      console.error("❌ Lỗi khi gọi API hủy:", error);
      // Có thể Alert lỗi nếu muốn, hoặc cứ cho qua để về trang Cancel
    } finally {
      setLoading(false);
      // 👇 SAU KHI GỌI API XONG MỚI ĐIỀU HƯỚNG
      Alert.alert(
        "Đã hủy thanh toán",
        `Đơn hàng ${orderCode || ""} đã được hủy.`,
        [
          {
            text: "OK",
            onPress: () => {
              navigation.replace("SubscriptionCancel", { orderCode });
            },
          },
        ]
      );
    }
  };
  //  LOGIC QUAN TRỌNG NHẤT: BẮT SỰ KIỆN URL
  const handleShouldStartLoadWithRequest = (request: any) => {
    const { url } = request;
    console.log("🌐 Web Navigation:", url);

    // Chuẩn hóa URL về chữ thường để dễ so sánh
    const lowerUrl = url.toLowerCase();

    // 1️⃣ TRƯỜNG HỢP HỦY THANH TOÁN
    // PayOS thường trả về URL chứa: /cancel hoặc status=CANCELLED
    if (
      lowerUrl.includes("status=cancelled") ||
      lowerUrl.includes("/cancel") ||
      lowerUrl.includes("posapp://subscription/cancel") // Deep link nếu có
    ) {
      const orderCode = getQueryParam(url, "orderCode");
      console.log("🛑 Phát hiện HỦY, Order:", orderCode);
      // ⚡️ Kích hoạt hàm xử lý bất đồng bộ (Fire & Forget logic)
      handleCancelProcess(orderCode);
      // Hiển thị thông báo trước khi thoát
      Alert.alert(
        "Đã hủy thanh toán",
        `Đơn hàng ${orderCode || ""} chưa được thanh toán.`,
        [
          {
            text: "Về màn hình đăng ký",
            onPress: () => {
              // Điều hướng về màn hình Cancel/Đăng ký của bạn
              navigation.replace("SubscriptionCancel", { orderCode });
            },
          },
        ]
      );
      return false; // CHẶN KHÔNG CHO LOAD TIẾP
    }

    // 2️⃣ TRƯỜNG HỢP THANH TOÁN THÀNH CÔNG
    // PayOS thường trả về URL chứa: /success hoặc status=PAID
    if (
      lowerUrl.includes("status=paid") ||
      lowerUrl.includes("/success") ||
      lowerUrl.includes("posapp://subscription/success") // Deep link nếu có
    ) {
      const orderCode = getQueryParam(url, "orderCode");
      const status = getQueryParam(url, "status");
      console.log("✅ Phát hiện THÀNH CÔNG, Order:", orderCode);

      navigation.replace("SubscriptionSuccess", {
        orderCode,
        status,
        checkoutUrl,
      });
      return false; // CHẶN KHÔNG CHO LOAD TIẾP
    }

    // 3️⃣ Các link nội bộ của PayOS (CSS, JS, API...) -> Cho phép load
    return true;
  };

  // Nếu không có link thanh toán -> báo lỗi
  if (!checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.err}>Lỗi: Không tìm thấy link thanh toán</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.btn}>
            <Text style={styles.btnText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Hủy/Đóng</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Thanh toán PayOS</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* WEBVIEW HIỂN THỊ QR VÀ TRANG THANH TOÁN */}
      <WebView
        source={{ uri: checkoutUrl }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        // Hàm chặn URL xử lý logic
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        // Cấu hình chuẩn cho WebView
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />

      {/* LOADING INDICATOR */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={{ marginTop: 10, color: "#64748b" }}>Đang tải...</Text>
        </View>
      )}
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
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  headerBtnText: { fontWeight: "600", color: "#334155", fontSize: 14 },
  headerTitle: { fontWeight: "bold", color: "#0f172a", fontSize: 16 },
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff", // Che hoàn toàn để tránh nháy
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  err: { fontWeight: "bold", color: "#ef4444" },
  btn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "bold" },
});
