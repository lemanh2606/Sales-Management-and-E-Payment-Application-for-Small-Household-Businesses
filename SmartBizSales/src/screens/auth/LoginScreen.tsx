// src/screens/auth/LoginScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput as RNTextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type LoginForm = { username: string; password: string };

export default function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation<any>();
  const [form, setForm] = useState<LoginForm>({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const userRef = useRef<RNTextInput | null>(null);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem("remember_session");
      setRemember(!!v);
    })();
  }, []);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const handleChange = (key: keyof LoginForm, value: string) =>
    setForm((s) => ({ ...s, [key]: value }));

  const handleSubmit = async () => {
    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập username và mật khẩu.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await userApi.loginUser(form);
      if (!data?.token || !data?.user) {
        setError("Server phản hồi thiếu token hoặc user.");
        setLoading(false);
        return;
      }

      await login(data.user, data.token);

      if (remember) await AsyncStorage.setItem("remember_session", "1");
      else await AsyncStorage.removeItem("remember_session");

      setLoading(false);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Đăng nhập thất bại — kiểm tra kết nối hoặc thông tin.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo / Brand */}
          <View style={styles.logoContainer}>
            <Ionicons name="business" size={60} color="#2e7d32" />
            <Text style={styles.brand}>Smallbiz-Sales</Text>
          </View>

          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để quản lý cửa hàng của bạn.
          </Text>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              ref={userRef}
              value={form.username}
              onChangeText={(t) => handleChange("username", t)}
              placeholder="Username hoặc email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              style={styles.input}
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={form.password}
                onChangeText={(t) => handleChange("password", t)}
                placeholder="Mật khẩu"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                style={[styles.input, styles.inputPassword]}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                style={styles.toggleBtn}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={22}
                  color="#2e7d32"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember + Forgot */}
          <View style={styles.rowBetween}>
            <TouchableOpacity
              onPress={() => setRemember((r) => !r)}
              style={styles.rememberRow}
              disabled={loading}
            >
              <View
                style={[styles.checkbox, remember && styles.checkboxChecked]}
              >
                {remember && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword" as any)}
              disabled={loading}
            >
              <Text style={styles.forgot}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          {/* Register */}
          <View style={styles.bottom}>
            <Text style={styles.small}>Chưa có tài khoản? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register" as any)}
              disabled={loading}
            >
              <Text style={styles.link}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.copyright}>© 2025 Smallbiz-Sales</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
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
    marginBottom: 20,
  },
  brand: { fontSize: 20, fontWeight: "900", color: "#2e7d32", marginTop: 6 },
  title: { fontSize: 24, fontWeight: "800", color: "#2e7d32", marginBottom: 6 },
  subtitle: { color: "#4b5563", marginBottom: 16, textAlign: "center" },
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
  inputPassword: { flex: 1 },
  toggleBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 10,
    backgroundColor: "#d9f7be",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rememberRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#c8e6c9",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: "#2e7d32", borderColor: "#2e7d32" },
  checkboxMark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  rememberText: { color: "#374151" },
  forgot: { color: "#2e7d32", fontWeight: "700" },
  primaryBtn: {
    backgroundColor: "#2e7d32",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  bottom: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
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
