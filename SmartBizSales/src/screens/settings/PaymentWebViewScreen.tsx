// ===========================
// 1. IMPORT CÁC THƯ VIỆN CẦN THIẾT
// ===========================

import React, { useState, useRef, useCallback } from "react";
// - useState: quản lý state (trạng thái loading, text hiển thị)
// - useRef: tạo reference để truy cập WebView và theo dõi trạng thái đã xử lý
// - useCallback: tối ưu performance bằng cách cache function, tránh tạo lại function mỗi lần render

import {
  ActivityIndicator, // Hiệu ứng loading (vòng tròn xoay)
  SafeAreaView, // Tránh nội dung bị che bởi notch/status bar
  StyleSheet, // Định nghĩa CSS cho React Native
  View, // Container cơ bản
  Pressable, // Button có thể bấm (thay TouchableOpacity)
  Text, // Hiển thị text
  Alert, // Popup thông báo
} from "react-native";

import { useNavigation, useRoute } from "@react-navigation/native";
// - useNavigation: điều hướng giữa các màn hình
// - useRoute: lấy params được truyền từ màn hình trước

import { WebView } from "react-native-webview";
// Component hiển thị trang web bên trong app

import subscriptionApi from "../../api/subscriptionApi";
// API để xử lý subscription (hủy thanh toán, xóa pending payment)

// ===========================
// 2. ĐỊNH NGHĨA KIỂU DỮ LIỆU
// ===========================

type RouteParams = { checkoutUrl: string };
// TypeScript type: params nhận từ màn hình trước phải có checkoutUrl (link thanh toán)

// ===========================
// 3. HÀM TIỆN ÍCH - PARSE URL PARAMETERS
// ===========================

function getQueryParam(url: string, key: string): string | null {
  try {
    // PayOS trả về URL dạng: https://app.com/success#orderCode=123&status=PAID
    // Thay # bằng ? để parse được bằng URLSearchParams
    const cleanUrl = url.replace("#", "?");
    const u = new URL(cleanUrl, "https://example.com");
    return u.searchParams.get(key); // Lấy giá trị của key (vd: orderCode=123 → "123")
  } catch {
    // Fallback: dùng regex nếu URL.parse lỗi
    const match = url.match(new RegExp(`[?&]${key}=([^&#]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }
}

// ===========================
// 4. COMPONENT CHÍNH
// ===========================

export default function PaymentWebViewScreen() {
  // 4.1. KHỞI TẠO NAVIGATION & ROUTE
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { checkoutUrl } = (route.params || {}) as RouteParams;
  // Lấy checkoutUrl từ params (màn hình trước truyền vào khi navigate)

  // 4.2. STATE MANAGEMENT
  const [loading, setLoading] = useState(true);
  // Trạng thái loading - hiển thị ActivityIndicator khi đang tải

  const [loadingText, setLoadingText] = useState(
    "Đang tải trang thanh toán..."
  );
  // Text hiển thị dưới vòng loading

  const [showWebView, setShowWebView] = useState(true);
  // Điều khiển hiển thị WebView (ẩn khi đã xử lý xong success/cancel)

  // 4.3. REFS (THAM CHIẾU)
  const webViewRef = useRef<WebView>(null);
  // Tham chiếu tới WebView để có thể gọi webViewRef.current.stopLoading()

  const handledRef = useRef(false);
  // Flag để đảm bảo chỉ xử lý success/cancel MỘT LẦN
  // Vì WebView có thể trigger nhiều lần → dùng ref thay vì state vì không cần re-render

  // ===========================
  // 5. NAVIGATION FUNCTIONS (DÙNG useCallback ĐỂ TỐI ƯU)
  // ===========================

  // 5.1. ĐI THẲNG ĐẾN MÀN HÌNH SUBSCRIPTION
  const navigateToSubscription = useCallback(
    (orderCode: string, status: string) => {
      // navigation.reset() xóa toàn bộ navigation stack và tạo stack mới
      // Cấu trúc: App (root) → Drawer → Subscription
      navigation.reset({
        index: 0, // Chỉ có 1 màn hình trong stack
        routes: [
          {
            name: "App", // Màn hình root
            params: { screen: "Subscription" }, // Nested navigation: vào luôn tab Subscription
          },
        ],
      });
    },
    [navigation] // dependency: chỉ tạo lại function khi navigation thay đổi
  );

  // 5.2. ĐI ĐẾN MÀN HÌNH HỦY THANH TOÁN
  const navigateToCancel = useCallback(
    (orderCode: string | null) => {
      // replace: thay màn hình hiện tại, không thể back lại
      navigation.replace("SubscriptionCancel", { orderCode });
    },
    [navigation]
  );

  // ===========================
  // 6. XỬ LÝ HỦY THANH TOÁN
  // ===========================

  const handleCancelProcess = useCallback(
    async (orderCode: string | null) => {
      // 6.1. KIỂM TRA ĐÃ XỬ LÝ CHƯA (tránh gọi nhiều lần)
      if (handledRef.current) return;
      handledRef.current = true; // Đánh dấu đã xử lý
      setShowWebView(false); // Ẩn WebView ngay lập tức

      try {
        console.log("🛑 HỦY - Order:", orderCode);

        // 6.2. GỌI API HỦY THANH TOÁN (nếu API tồn tại)
        if (subscriptionApi?.clearPendingPayment) {
          await subscriptionApi.clearPendingPayment(orderCode);
        }
      } catch (error) {
        console.error("❌ Lỗi hủy:", error);
      } finally {
        // 6.3. HIỂN THỊ ALERT VÀ CHUYỂN HƯỚNG
        Alert.alert(
          "Đã hủy thanh toán", // Tiêu đề
          `Đơn hàng ${orderCode || "N/A"} đã được hủy.`, // Nội dung
          [{ text: "OK", onPress: () => navigateToCancel(orderCode) }] // Button
        );
      }
    },
    [navigateToCancel, subscriptionApi] // dependencies
  );

  // ===========================
  // 7. XỬ LÝ NAVIGATION CỦA WEBVIEW (CORE LOGIC)
  // ===========================

  const handleShouldStartLoadWithRequest = useCallback(
    (request: any) => {
      const { url } = request;
      if (!url) return true; // Không có URL → cho phép load

      // 7.1. LOG ĐỂ DEBUG (chỉ log nếu chưa xử lý)
      if (!handledRef.current) {
        console.log("🔍 ShouldStartLoad:", url);
      }

      const lowerUrl = url.toLowerCase();

      // ===========================
      // 7.2. TRƯỜNG HỢP: USER HỦY THANH TOÁN
      // ===========================
      if (
        lowerUrl.includes("status=cancelled") ||
        lowerUrl.includes("/cancel")
      ) {
        const orderCode = getQueryParam(url, "orderCode");
        handleCancelProcess(orderCode);
        return false; // CHẶN không cho WebView load URL này
      }

      // ===========================
      // 7.3. TRƯỜNG HỢP: THANH TOÁN THÀNH CÔNG
      // ===========================
      if (lowerUrl.includes("/success")) {
        // 7.3.1. NẾU ĐÃ XỬ LÝ → SILENT BLOCK (không làm gì, chặn luôn)
        if (handledRef.current) {
          return false;
        }

        // 7.3.2. LẤY THÔNG TIN TỪ URL
        const orderCode = getQueryParam(url, "orderCode");
        const status = getQueryParam(url, "status");

        console.log("🎯 SUCCESS → SUBSCRIPTION NGAY:", { orderCode, status });

        // 7.3.3. TRIPLE KILL: 3 BƯỚC QUAN TRỌNG
        handledRef.current = true; // ① Đánh dấu đã xử lý
        setShowWebView(false); // ② Ẩn WebView
        webViewRef.current?.stopLoading(); // ③ Dừng loading của WebView

        // 7.3.4. CẬP NHẬT TEXT LOADING
        setLoadingText("Thanh toán thành công! Về Subscription...");

        // 7.3.5. CHUYỂN THẲNG ĐẾN SUBSCRIPTION (không qua màn hình success)
        setTimeout(() => {
          navigateToSubscription(orderCode || "N/A", status || "PAID");
        }, 500); // Delay 0.5s để user thấy text "Thanh toán thành công"

        return false; // CHẶN không cho WebView load URL /success
      }

      // ===========================
      // 7.4. TRƯỜNG HỢP: EXTERNAL LINKS (deep links, phone, email)
      // ===========================
      if (
        lowerUrl.includes("posapp://") || // Deep link của app khác
        lowerUrl.includes("tel:") || // Số điện thoại
        lowerUrl.includes("mailto:") // Email
      ) {
        return false; // CHẶN không cho WebView load (tránh crash)
      }

      // 7.5. MẶC ĐỊNH: CHO PHÉP LOAD
      return true; // Cho phép WebView load URL bình thường
    },
    [handleCancelProcess, navigateToSubscription] // dependencies
  );

  // ===========================
  // 8. XỬ LÝ NÚT HỦY Ở HEADER
  // ===========================

  const handleHeaderPress = useCallback(() => {
    if (handledRef.current) return; // Đã xử lý rồi → không làm gì
    handleCancelProcess(null); // Hủy với orderCode = null (vì user tự bấm hủy)
  }, [handleCancelProcess]);

  // ===========================
  // 9. KIỂM TRA KHÔNG CÓ CHECKOUT URL
  // ===========================

  if (!checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.err}>❌ Không tìm thấy link thanh toán</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.btn}>
            <Text style={styles.btnText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ===========================
  // 10. RENDER GIAO DIỆN CHÍNH
  // ===========================

  return (
    <SafeAreaView style={styles.safe}>
      {/* 10.1. HEADER VỚI NÚT HỦY */}
      <View style={styles.header}>
        <Pressable onPress={handleHeaderPress} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Hủy</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Thanh toán đăng ký</Text>
        <View style={{ width: 60 }} /> {/* Spacer để center title */}
      </View>

      {/* 10.2. WEBVIEW CONTAINER */}
      <View style={styles.webviewContainer}>
        {showWebView && ( // Chỉ hiển thị khi showWebView = true
          <WebView
            ref={webViewRef} // Gán ref để có thể gọi stopLoading()
            source={{ uri: checkoutUrl }} // URL cần load
            /* ===== LIFECYCLE EVENTS ===== */
            onLoadStart={() => {
              // Khi bắt đầu load → hiển thị loading
              if (!handledRef.current && showWebView) {
                setLoading(true);
                setLoadingText("Đang tải trang thanh toán...");
              }
            }}
            onLoadEnd={() => {
              // Khi load xong → ẩn loading
              if (!handledRef.current && showWebView) {
                setLoading(false);
              }
            }}
            /* ===== NAVIGATION CONTROL ===== */
            onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
            // ĐÂY LÀ HÀM QUAN TRỌNG NHẤT: quyết định có cho phép load URL không
            // return true → load, return false → chặn

            /* ===== WEBVIEW SETTINGS ===== */
            javaScriptEnabled={true} // Cho phép chạy JavaScript
            domStorageEnabled={true} // Cho phép localStorage
            startInLoadingState={true} // Hiển thị loading khi khởi động
            scalesPageToFit={true} // Tự động scale trang web cho vừa màn hình
            allowsBackForwardNavigationGestures={false} // Không cho swipe back
            sharedCookiesEnabled={true} // Share cookies với browser hệ thống
          />
        )}
      </View>

      {/* 10.3. LOADING OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ===========================
// 11. STYLES
// ===========================

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
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#fee2e2", // Màu đỏ nhạt
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  headerBtnText: { fontWeight: "700", color: "#dc2626", fontSize: 14 },
  headerTitle: { fontWeight: "bold", color: "#0f172a", fontSize: 16 },
  webviewContainer: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, // Phủ toàn màn hình
    top: 52, // Bắt đầu từ dưới header
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.98)", // Nền trắng mờ
  },
  loadingText: {
    marginTop: 12,
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  err: {
    fontWeight: "bold",
    color: "#ef4444",
    fontSize: 18,
    textAlign: "center",
  },
  btn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
