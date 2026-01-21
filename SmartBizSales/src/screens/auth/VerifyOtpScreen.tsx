// src/screens/auth/VerifyOtpScreen.tsx
/**
 * Trang: Xác thực OTP
 *
 * Mục đích:
 * - Người dùng nhập email + OTP (được gửi từ backend khi đăng ký/forgot-password)
 * - Gọi API verifyOtp thông qua userApi.verifyOtp (typed)
 * - Hiển thị trạng thái loading / lỗi rõ ràng
 */

import React, { JSX, useEffect, useMemo, useState, useRef } from "react";
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
  Keyboard,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { userApi } from "../../api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type RouteParams = {
  email?: string;
};

export default function VerifyOtpScreen(): JSX.Element {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const initialEmail = (route.params as RouteParams)?.email || "";

  const [email, setEmail] = useState<string>(initialEmail);
  const [otp, setOtp] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isResendAttempt, setIsResendAttempt] = useState<boolean>(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const emailRef = useRef<TextInput | null>(null);
  const otpRef = useRef<TextInput | null>(null);

  const otpExpireMinutes = useMemo(() => {
    const expoVal = (Constants?.manifest as any)?.extra
      ?.VITE_OTP_EXPIRE_MINUTES;
    const envVal = (process?.env?.VITE_OTP_EXPIRE_MINUTES as any) || undefined;
    const n = Number(expoVal ?? envVal ?? 5);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
  }, []);

  const [countdown, setCountdown] = useState<number>(60 * otpExpireMinutes);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!countdown || countdown <= 0) return undefined;
    const id = setInterval(() => setCountdown((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const formatTime = (sec: number) => {
    if (!sec || sec <= 0) return "00:00";
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const validateInputs = (): string | null => {
    if (!email || !email.trim()) return "Vui lòng nhập email.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Email không hợp lệ.";
    if (!otp || !otp.trim()) return "Vui lòng nhập mã OTP.";
    return null;
  };

  const handleVerify = async () => {
    const v = validateInputs();
    if (v) {
      Alert.alert("Thiếu thông tin", v);
      return;
    }

    setIsVerifying(true);
    try {
      const payload = { email: email.trim(), otp: otp.trim() };
      const res = await userApi.verifyOtp(payload);

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
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Xác thực thất bại — mã OTP không hợp lệ hoặc đã hết hạn.";
      Alert.alert("Lỗi xác thực", msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = () => {
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.containerWrap,
          keyboardVisible && styles.containerKeyboardVisible,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {!keyboardVisible && (
            <View style={styles.logoContainer}>
              <Ionicons name="mail-open" size={50} color="#2e7d32" />
            </View>
          )}

          <Text style={styles.title}>Xác thực tài khoản</Text>
          <Text style={styles.subtitle}>
            Nhập mã OTP được gửi tới email để hoàn tất đăng ký.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="mail"
                size={20}
                color="#9ca3af"
                style={styles.inputIcon}
              />
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="email@domain.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isVerifying}
                returnKeyType="next"
                onSubmitEditing={() => otpRef.current?.focus()}
                blurOnSubmit={false}
                style={[styles.input, styles.inputWithPadding]}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mã OTP</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons
                name="key"
                size={20}
                color="#9ca3af"
                style={styles.inputIcon}
              />
              <TextInput
                ref={otpRef}
                value={otp}
                onChangeText={setOtp}
                placeholder="Nhập mã OTP"
                keyboardType="number-pad"
                autoCapitalize="none"
                editable={!isVerifying}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                style={[styles.input, styles.inputWithPadding]}
              />
            </View>
          </View>

          <View style={styles.timerCard}>
            <Ionicons name="time" size={20} color="#2e7d32" />
            <View style={styles.timerContent}>
              <Text style={styles.smallLabel}>Hết hạn sau</Text>
              <Text style={styles.countdown}>{formatTime(countdown)}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register" as any, { email })}
              style={[styles.secondaryBtn, styles.flexBtn]}
              disabled={isVerifying}
            >
              <Ionicons name="create-outline" size={18} color="#2e7d32" />
              <Text style={styles.secondaryText}>Chỉnh email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              style={[
                styles.secondaryBtn,
                styles.flexBtn,
                styles.ml8,
                (countdown > 0 || isResendAttempt) && styles.disabledBtn,
              ]}
              disabled={countdown > 0 || isResendAttempt || isVerifying}
            >
              <Ionicons name="refresh" size={18} color="#2e7d32" />
              <Text style={styles.secondaryText}>
                {countdown > 0 ? "Chờ..." : "Gửi lại"}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleVerify}
            style={[styles.primaryBtn, isVerifying && styles.disabledBtn]}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.primaryText}>Xác nhận</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login" as any)}
              disabled={isVerifying}
            >
              <Text style={styles.link}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
            {!keyboardVisible && (
              <Text style={styles.copyright}>© 2025 Smallbiz-Sales</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  containerWrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  containerKeyboardVisible: {
    justifyContent: "flex-start",
    paddingTop: 20,
  },
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
  logoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2e7d32",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    color: "#4b5563",
    marginBottom: 16,
    textAlign: "center",
  },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: "#374151", marginBottom: 6, fontWeight: "600" },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  inputIcon: {
    position: "absolute",
    left: 14,
    zIndex: 1,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    borderWidth: 1,
    borderColor: "#a5d6a7",
    fontSize: 15,
    flex: 1,
  },
  inputWithPadding: {
    paddingLeft: 44,
  },
  timerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },
  timerContent: {
    marginLeft: 12,
    flex: 1,
  },
  smallLabel: { color: "#4b5563", fontSize: 12, marginBottom: 2 },
  countdown: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    fontWeight: "700",
    color: "#2e7d32",
  },
  buttonRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  flexBtn: {
    flex: 1,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    gap: 6,
  },
  secondaryText: {
    color: "#2e7d32",
    fontWeight: "700",
    fontSize: 14,
  },
  ml8: { marginLeft: 8 },
  disabledBtn: { opacity: 0.6 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: { color: "#2e7d32", fontWeight: "700" },
  copyright: { color: "#9ca3af", fontSize: 12 },
});
