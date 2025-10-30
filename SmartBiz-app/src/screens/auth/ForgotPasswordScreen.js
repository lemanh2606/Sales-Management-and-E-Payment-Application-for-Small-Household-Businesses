// src/screens/auth/ForgotPasswordScreen.js
import React, { useEffect, useRef, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import * as userApi from "../../api/userApi";

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const emailRef = useRef(null);

  // 1 = gửi OTP, 2 = nhập OTP + password
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    // autofocus email on mount (if ref supports focus)
    if (emailRef.current?.focus) {
      setTimeout(() => emailRef.current.focus(), 300);
    }
  }, []);

  // countdown for resend button
  useEffect(() => {
    let t;
    if (resendTimer > 0) {
      t = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    }
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ---------------- STEP 1: send OTP ----------------
  const handleSendOtp = async () => {
    setError("");
    setMessage("");

    if (!email || !email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }

    setLoading(true);
    try {
      const payload = { email: email.trim().toLowerCase() };
      const res = await userApi.sendForgotPasswordOTP(payload);
      setMessage(res?.message || "Mã OTP đã gửi tới email. Kiểm tra hộp thư.");
      setStep(2);
      setResendTimer(60);
    } catch (err) {
      console.error("sendForgotPasswordOTP error", err);
      setError(
        err?.response?.data?.message || err?.message || "Gửi OTP thất bại"
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------- resend OTP ----------------
  const handleResend = async () => {
    if (resendTimer > 0) return;
    if (!email || !email.trim()) {
      Alert.alert("Thiếu email", "Vui lòng nhập email trước khi gửi lại OTP.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await userApi.sendForgotPasswordOTP({
        email: email.trim().toLowerCase(),
      });
      setMessage("Mã OTP đã gửi lại. Kiểm tra email.");
      setResendTimer(60);
    } catch (err) {
      console.error("resend OTP error", err);
      setError(
        err?.response?.data?.message || err?.message || "Gửi lại OTP thất bại"
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------- STEP 2: submit OTP + new password ----------------
  const handleResetPassword = async () => {
    setError("");
    setMessage("");

    if (!email || !otp || !password || !confirmPassword) {
      setError("Thiếu thông tin email, OTP hoặc mật khẩu");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu và xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password,
        confirmPassword,
      };
      const res = await userApi.forgotChangePassword(payload);
      const successMsg =
        res?.message || "Đổi mật khẩu thành công. Chuyển về trang đăng nhập...";
      setMessage(successMsg);
      // show alert and navigate to Login
      Alert.alert("Thành công", successMsg, [
        {
          text: "Đăng nhập",
          onPress: () => navigation.navigate("Login"),
        },
      ]);
    } catch (err) {
      console.error("forgotChangePassword error", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đặt lại mật khẩu thất bại"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.wrapper}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            Nhập email để nhận mã xác thực và đặt mật khẩu mới.
          </Text>

          {message ? <Text style={styles.messageBox}>{message}</Text> : null}
          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          {step === 1 && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  ref={emailRef}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@domain.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  editable={!loading}
                  returnKeyType="send"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  onPress={handleSendOtp}
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Gửi mã OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate("Login")}
                  style={[styles.ghostBtn, styles.ml8]}
                >
                  <Text style={styles.ghostText}>Quay lại</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Mã OTP</Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="Nhập mã OTP"
                  keyboardType="number-pad"
                  style={styles.input}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Mật khẩu mới</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Ít nhất 6 ký tự"
                  secureTextEntry
                  style={styles.input}
                  editable={!loading}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Xác nhận mật khẩu</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu"
                  secureTextEntry
                  style={styles.input}
                  editable={!loading}
                />
              </View>

              <View style={styles.row}>
                <TouchableOpacity
                  onPress={handleResetPassword}
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Đặt lại mật khẩu</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResend}
                  style={[
                    styles.ghostBtn,
                    styles.ml8,
                    (resendTimer > 0 || loading) && styles.btnDisabled,
                  ]}
                  disabled={resendTimer > 0 || loading}
                >
                  <Text style={styles.ghostText}>
                    {resendTimer > 0
                      ? `Gửi lại (${resendTimer}s)`
                      : "Gửi lại OTP"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rowBetween}>
                <Text style={styles.note}>Mật khẩu tối thiểu 6 ký tự.</Text>
                <TouchableOpacity onPress={() => setStep(1)}>
                  <Text style={styles.link}>Thay đổi email</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
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
  wrapper: { flex: 1, backgroundColor: "#0f172a" },
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    elevation: 6,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#0b84ff", marginBottom: 6 },
  subtitle: { color: "#6b7280", marginBottom: 12 },
  messageBox: {
    backgroundColor: "#ecfdf5",
    color: "#065f46",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 13,
  },
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
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtn: {
    backgroundColor: "#0b84ff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "#f1f5f9",
  },
  ghostText: { color: "#0b84ff", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
  ml8: { marginLeft: 8 },
  note: { color: "#6b7280", fontSize: 12 },
  link: { color: "#0b84ff", fontWeight: "700" },
  footer: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  copy: { color: "#9ca3af", fontSize: 12 },
});
