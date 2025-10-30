// src/screens/auth/VerifyOtpScreen.js
import React, { useEffect, useState } from "react";
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
import * as userApi from "../../api/userApi";

export default function VerifyOtpScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const emailFromParams = route.params?.email || "";

  const [email, setEmail] = useState(emailFromParams);
  const [otp, setOtp] = useState("");
  const otpExpireMinutes = Number(
    (Constants?.manifest?.extra?.VITE_OTP_EXPIRE_MINUTES) ||
      (process?.env?.VITE_OTP_EXPIRE_MINUTES) ||
      5
  );
  const [timer, setTimer] = useState(60 * otpExpireMinutes);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // countdown
  useEffect(() => {
    if (!timer || timer <= 0) return;
    const id = setInterval(() => setTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // If arrived without email but want to start timer only after first send,
  // you could set timer to 0 initially. Here we assume OTP was already sent.
  useEffect(() => {
    // no-op for now
  }, []);

  const formatTime = (sec) => {
    if (!sec || sec <= 0) return "00:00";
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const handleVerify = async () => {
    if (!email?.trim()) {
      Alert.alert("Thiếu email", "Vui lòng nhập email trước khi xác thực.");
      return;
    }
    if (!otp?.trim()) {
      Alert.alert("Thiếu OTP", "Vui lòng nhập mã OTP.");
      return;
    }

    setIsVerifying(true);
    try {
      const payload = { email: email.trim(), otp: otp.trim() };
      const res = await userApi.verifyOtp(payload);

      Alert.alert(
        "Xác thực thành công",
        res?.message || "Tài khoản đã được xác thực. Vui lòng đăng nhập.",
        [
          {
            text: "Đăng nhập",
            onPress: () => navigation.navigate("Login"),
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      console.error("verifyOtp error", err);
      const msg = err?.response?.data?.message || err?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.";
      Alert.alert("Lỗi xác thực", msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) {
      // shouldn't happen because button will be disabled, but just in case
      return;
    }
    if (!email?.trim()) {
      Alert.alert("Thiếu email", "Vui lòng nhập / kiểm tra email trước khi gửi lại mã OTP.");
      return;
    }

    setIsResending(true);
    try {
      // Prefer explicit resend endpoint if backend provides it
      if (typeof userApi.resendRegisterOtp === "function") {
        await userApi.resendRegisterOtp({ email: email.trim() });
      } else {
        // FALLBACK (CAUTION): some backends may not accept this; prefer implementing resendRegisterOtp on server.
        // We attempt to call registerManager as last resort — this may create duplicate user or be rejected.
        // If your backend DOES NOT support this fallback, remove the block below and implement resendRegisterOtp server-side.
        await userApi.registerManager({
          // dummy values — backend should ideally handle this route specially for resend only
          username: `resend_${Date.now()}`,
          email: email.trim(),
          password: `Temp!${Date.now() % 10000}`,
        });
      }

      Alert.alert(
        "Đã gửi lại OTP",
        `Mã OTP đã được gửi tới ${email.trim()}. Kiểm tra hộp thư (hoặc thư mục Spam).`,
        [{ text: "OK" }],
        { cancelable: false }
      );

      // reset timer
      setTimer(60 * otpExpireMinutes);
    } catch (err) {
      console.error("resend error", err);
      const msg = err?.response?.data?.message || err?.message || "Đã xảy ra lỗi khi gửi lại mã OTP.";
      Alert.alert("Không thể gửi lại OTP", msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Xác thực tài khoản</Text>
          <Text style={styles.subtitle}>Nhập mã OTP được gửi tới email để hoàn tất đăng ký.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              editable={!isVerifying && !isResending}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mã OTP</Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="Nhập mã 6 chữ số"
              keyboardType="number-pad"
              style={styles.input}
              editable={!isVerifying && !isResending}
            />
          </View>

          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.smallLabel}>Hết hạn sau</Text>
              <Text style={styles.mono}>{formatTime(timer)}</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => navigation.navigate("Register", { email })}
                style={styles.ghostBtn}
                disabled={isVerifying || isResending}
              >
                <Text style={styles.ghostText}>Chỉnh email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResend}
                style={[styles.ghostBtn, (timer > 0 || isResending) && styles.btnDisabled]}
                disabled={timer > 0 || isResending || isVerifying}
              >
                {isResending ? <ActivityIndicator /> : (
                  <Text style={styles.ghostText}>
                    {timer > 0 ? "Chờ gửi lại" : "Gửi lại mã OTP"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleVerify}
            style={[styles.primaryBtn, (isVerifying || isResending) && styles.btnDisabled]}
            disabled={isVerifying || isResending}
          >
            {isVerifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Xác nhận</Text>}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} disabled={isVerifying || isResending}>
              <Text style={styles.link}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
            <Text style={styles.copy}>© 2025 Smallbiz-Sales</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  wrap: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    elevation: 6,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  subtitle: { color: "#6b7280", marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: "#374151", marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    borderWidth: 1,
    borderColor: "#e6eef8",
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  smallLabel: { color: "#6b7280", fontSize: 12 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 18, fontWeight: "700", color: "#0f172a" },
  actions: { flexDirection: "row", gap: 8 },
  ghostBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "#0b84ff", fontWeight: "700" },
  primaryBtn: { backgroundColor: "#10b981", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },
  footerRow: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { color: "#0b84ff", fontWeight: "700" },
  copy: { color: "#9ca3af", fontSize: 12 },
});
