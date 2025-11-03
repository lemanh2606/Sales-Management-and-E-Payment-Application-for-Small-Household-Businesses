// src/screens/auth/VerifyOtpScreen.tsx
/**
 * Trang: Xác thực OTP
 *
 * Mục đích:
 * - Người dùng nhập email + OTP (được gửi từ backend khi đăng ký/forgot-password)
 * - Gọi API verifyOtp thông qua userApi.verifyOtp (typed)
 * - Hiển thị trạng thái loading / lỗi rõ ràng
 *
 * Ghi chú:
 * - Không gọi resendRegisterOtp ở đây (backend chưa có) — nếu muốn bật resend, thêm endpoint /users/resend-otp và gọi userApi.resendRegisterOtp
 */

import React, { JSX, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { userApi } from "../../api"; // import từ API hub
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

/* -----------------------
   Kiểu route / navigation
   (dùng any tạm nếu bạn chưa định nghĩa RootStackParamList)
   ----------------------- */
type RouteParams = {
  email?: string;
};

export default function VerifyOtpScreen(): JSX.Element {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const initialEmail = (route.params as RouteParams)?.email || "";

  // Form state
  const [email, setEmail] = useState<string>(initialEmail);
  const [otp, setOtp] = useState<string>("");

  // Lấy thời lượng OTP (phút) từ Expo Constants hoặc env, default = 5 phút
  const otpExpireMinutes = useMemo(() => {
    const expoVal = (Constants?.manifest as any)?.extra
      ?.VITE_OTP_EXPIRE_MINUTES;
    const envVal = (process?.env?.VITE_OTP_EXPIRE_MINUTES as any) || undefined;
    const n = Number(expoVal ?? envVal ?? 5);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
  }, []);

  // countdown in seconds
  const [countdown, setCountdown] = useState<number>(60 * otpExpireMinutes);

  // UI flags
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResendAttempt, setIsResendAttempt] = useState<boolean>(false); // currently just shows message

  // Timer effect
  useEffect(() => {
    if (!countdown || countdown <= 0) return undefined;
    const id = setInterval(() => setCountdown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Format time mm:ss
  const formatTime = (sec: number) => {
    if (!sec || sec <= 0) return "00:00";
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // Validate basic inputs
  const validateInputs = (): string | null => {
    if (!email || !email.trim()) return "Vui lòng nhập email.";
    // rudimentary email check
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Email không hợp lệ.";
    if (!otp || !otp.trim()) return "Vui lòng nhập mã OTP.";
    return null;
  };

  // Xác nhận OTP
  const handleVerify = async () => {
    const v = validateInputs();
    if (v) {
      Alert.alert("Thiếu thông tin", v);
      return;
    }

    setIsVerifying(true);
    try {
      const payload = { email: email.trim(), otp: otp.trim() };
      // userApi.verifyOtp typed returns GenericResponse
      const res = await userApi.verifyOtp(payload);

      // giả sử backend trả { message: string }
      Alert.alert(
        "Xác thực thành công",
        (res && (res.message as string)) ||
          "Tài khoản đã được xác thực. Vui lòng đăng nhập.",
        [
          {
            text: "Đăng nhập",
            onPress: () => navigation.navigate("Login" as any),
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      console.error("verifyOtp error:", err);
      // Lấy message từ axios error nếu có
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Xác thực thất bại — mã OTP không hợp lệ hoặc đã hết hạn.";
      Alert.alert("Lỗi xác thực", msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Nút gửi lại OTP (hiện tạm: thông báo chưa hỗ trợ)
  const handleResend = () => {
    // Nếu muốn bật resend thật sự, xóa phần dưới và gọi userApi.resend... khi backend có endpoint
    if (countdown > 0) return;
    setIsResendAttempt(true);
    Alert.alert(
      "Gửi lại OTP",
      "Chức năng gửi lại OTP hiện tại chưa được cấu hình. Bạn có thể đăng ký lại hoặc kiểm tra hộp thư (Spam).",
      [{ text: "Đóng", onPress: () => setIsResendAttempt(false) }],
      { cancelable: true }
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.containerWrap}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Xác thực tài khoản</Text>
          <Text style={styles.subtitle}>
            Nhập mã OTP được gửi tới email để hoàn tất đăng ký.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isVerifying}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mã OTP</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="Nhập mã OTP"
              keyboardType="number-pad"
              autoCapitalize="none"
              editable={!isVerifying}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View>
              <Text style={styles.smallLabel}>Hết hạn sau</Text>
              <Text style={styles.countdown}>{formatTime(countdown)}</Text>
            </View>

            <View style={styles.rowActions}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("Register" as any, { email })
                }
                style={styles.ghostBtn}
                disabled={isVerifying}
              >
                <Text style={styles.ghostText}>Chỉnh email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResend}
                style={[
                  styles.ghostBtn,
                  (countdown > 0 || isResendAttempt) && styles.disabledBtn,
                ]}
                disabled={countdown > 0 || isResendAttempt || isVerifying}
              >
                <Text style={styles.ghostText}>
                  {countdown > 0 ? "Chờ gửi lại" : "Gửi lại mã OTP"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleVerify}
            style={[styles.primaryBtn, isVerifying && styles.disabledBtn]}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Xác nhận</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login" as any)}
              disabled={isVerifying}
            >
              <Text style={styles.link}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
            <Text style={styles.copyright}>© 2025 Smallbiz-Sales</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* -----------------------
   Styles
   ----------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" }, // nền trắng
  containerWrap: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#2e7d32", marginBottom: 6 },
  subtitle: { color: "#4b5563", marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: "#374151", marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    borderWidth: 1,
    borderColor: "#a5d6a7",
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  smallLabel: { color: "#4b5563", fontSize: 12 },
  countdown: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    fontWeight: "700",
    color: "#2e7d32",
  },
  rowActions: { flexDirection: "row" },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "#2e7d32", fontWeight: "700" },
  disabledBtn: { opacity: 0.6 },
  primaryBtn: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: { color: "#2e7d32", fontWeight: "700" },
  copyright: { color: "#9ca3af", fontSize: 12 },
});
