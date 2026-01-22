// src/screens/auth/RegisterScreen.tsx
/**
 * Trang đăng ký Manager (TypeScript)
 * - Gọi API registerManager
 * - Sau khi đăng ký thành công chuyển sang màn VerifyOtp với email
 */

import React, { JSX, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
  TextInput as RNTextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { userApi } from "../../api";

type RegisterForm = {
  username: string;
  fullname: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterScreen(): JSX.Element {
  const navigation = useNavigation<any>();

  const [form, setForm] = useState<RegisterForm>({
    username: "",
    fullname: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Refs for input navigation
  const usernameRef = useRef<RNTextInput | null>(null);
  const fullnameRef = useRef<RNTextInput | null>(null);
  const emailRef = useRef<RNTextInput | null>(null);
  const phoneRef = useRef<RNTextInput | null>(null);
  const passwordRef = useRef<RNTextInput | null>(null);
  const confirmPasswordRef = useRef<RNTextInput | null>(null);

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

  const handleChange = (key: keyof RegisterForm, value: string) =>
    setForm((s) => ({ ...s, [key]: value }));

  const validate = (): string | null => {
    if (!form.username.trim()) return "Vui lòng nhập tên đăng nhập";
    if (!form.email.trim()) return "Vui lòng nhập email";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Email không hợp lệ";
    if (!form.password) return "Vui lòng nhập mật khẩu";
    if (form.password.length < 6) return "Mật khẩu phải ít nhất 6 ký tự";
    if (form.password !== form.confirmPassword)
      return "Mật khẩu nhập lại không trùng khớp";
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        username: form.username.trim(),
        fullname: form.fullname.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      };

      const res = await userApi.registerManager(payload);

      Alert.alert(
        "Đăng ký thành công",
        (res && (res.message as string)) ||
          "Vui lòng kiểm tra email để lấy mã OTP xác thực.",
        [
          {
            text: "Tiếp tục",
            onPress: () =>
              navigation.navigate("VerifyOtp" as any, {
                email: form.email.trim().toLowerCase(),
              }),
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      console.error("Register error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Đã có lỗi xảy ra, thử lại sau.";
      Alert.alert("Lỗi", msg, [{ text: "Đóng" }], { cancelable: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          keyboardVisible && styles.scrollKeyboardVisible,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {!keyboardVisible && (
            <>
              <View style={styles.logoContainer}>
                <Ionicons name="business" size={50} color="#2e7d32" />
              </View>
              <Text style={styles.brand}>Smallbiz-Sales</Text>
            </>
          )}

          <Text style={styles.title}>Tạo tài khoản Manager</Text>
          <Text style={styles.subtitle}>
            Đăng ký nhanh, xác thực bằng email.
          </Text>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              ref={usernameRef}
              value={form.username}
              onChangeText={(t) => handleChange("username", t)}
              placeholder="ví dụ: nguyenvana123"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => fullnameRef.current?.focus()}
              blurOnSubmit={false}
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Họ và tên (tùy chọn)</Text>
            <TextInput
              ref={fullnameRef}
              value={form.fullname}
              onChangeText={(t) => handleChange("fullname", t)}
              placeholder="ví dụ: Nguyễn Văn A"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              ref={emailRef}
              value={form.email}
              onChangeText={(t) => handleChange("email", t)}
              placeholder="example@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              blurOnSubmit={false}
              style={styles.input}
              editable={!isLoading}
            />
            <Text style={styles.note}>
              * Hãy nhập email chính xác để nhận mã OTP.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Số điện thoại (tùy chọn)</Text>
            <TextInput
              ref={phoneRef}
              value={form.phone}
              onChangeText={(t) => handleChange("phone", t)}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                value={form.password}
                onChangeText={(t) => handleChange("password", t)}
                placeholder="Ít nhất 6 ký tự"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="password-new"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                blurOnSubmit={false}
                style={[styles.input, styles.inputPassword]}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                style={styles.toggleBtn}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color="#2e7d32"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={confirmPasswordRef}
                value={form.confirmPassword}
                onChangeText={(t) => handleChange("confirmPassword", t)}
                placeholder="Nhập lại mật khẩu"
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                autoComplete="password-new"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                style={[styles.input, styles.inputPassword]}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((s) => !s)}
                style={styles.toggleBtn}
                disabled={isLoading}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={22}
                  color="#2e7d32"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Đăng ký</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottom}>
            <Text style={styles.small}>Đã có tài khoản? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login" as any)}
              disabled={isLoading}
            >
              <Text style={styles.link}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>

          {!keyboardVisible && (
            <Text style={styles.copyright}>© 2025 Smallbiz-Sales</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  scrollKeyboardVisible: {
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
    marginBottom: 10,
  },
  brand: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2e7d32",
    marginBottom: 6,
    textAlign: "center",
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
  errorBox: {
    backgroundColor: "#fdecea",
    color: "#991b1b",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 14,
    textAlign: "center",
  },
  field: { marginBottom: 16 },
  label: { fontSize: 14, color: "#374151", marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    borderWidth: 1,
    borderColor: "#a5d6a7",
    fontSize: 15,
  },
  passwordRow: { flexDirection: "row", alignItems: "center" },
  inputPassword: {
    flex: 1,
    paddingRight: 8,
  },
  toggleBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#d9f7be",
  },
  note: { color: "#2e7d32", fontSize: 12, marginTop: 6 },
  primaryBtn: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  bottom: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  small: { color: "#4b5563" },
  link: { color: "#2e7d32", fontWeight: "700" },
  copyright: {
    textAlign: "center",
    marginTop: 14,
    color: "#9ca3af",
    fontSize: 12,
  },
});
