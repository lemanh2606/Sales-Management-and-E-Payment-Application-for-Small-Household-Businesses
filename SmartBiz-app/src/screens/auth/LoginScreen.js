// src/screens/auth/LoginScreen.js
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
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";
import * as userApi from "../../api/userApi";
import { useNavigation } from "@react-navigation/native";

export default function LoginScreen() {
  const { login } = useAuth();
  const navigation = useNavigation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const userRef = useRef(null);
  useEffect(() => {
    // autofocus
    if (userRef.current && typeof userRef.current.focus === "function") {
      userRef.current.focus();
    }
  }, []);

  const handleChange = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      // call login API
      const data = await userApi.loginUser(form); // expects { token, user, ... }
      if (!data?.token || !data?.user) {
        setError("Server phản hồi thiếu token hoặc user.");
        setLoading(false);
        return;
      }

      // call AuthContext.login (AuthContext sẽ xử lý persist + navigate)
      await login(data.user, data.token);

      // remember flag (chỉ lưu cờ, logic lưu token do AuthContext xử lý)
      try {
        if (remember) {
          await AsyncStorage.setItem("remember_session", "1");
        } else {
          await AsyncStorage.removeItem("remember_session");
        }
      } catch (e) {
        console.warn("remember flag write failed:", e);
      }

      setLoading(false);
      // AuthContext sẽ navigate to Dashboard / SelectStore
    } catch (err) {
      console.error("Login error:", err);
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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.brand}>Smallbiz-Sales</Text>
          <Text style={styles.title}>Chào mừng trở lại</Text>
          <Text style={styles.subtitle}>
            Đăng nhập để quản lý cửa hàng của bạn.
          </Text>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

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
              onSubmitEditing={() => {
                // focus password if available
                // passwordRef not declared to keep it simple
              }}
            />
          </View>

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
                <Text style={styles.toggleText}>
                  {showPassword ? "Ẩn" : "Hiện"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <TouchableOpacity
              onPress={() => setRemember((r) => !r)}
              style={styles.rememberRow}
              disabled={loading}
            >
              <View
                style={[styles.checkbox, remember && styles.checkboxChecked]}
              >
                {remember ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={loading}
            >
              <Text style={styles.forgot}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.primaryText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottom}>
            <Text style={styles.small}>Chưa có tài khoản? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Register")}
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
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 20,
    elevation: 6,
  },
  brand: { fontSize: 18, fontWeight: "800", color: "#0b84ff", marginBottom: 6 },
  title: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#6b7280", marginBottom: 12 },
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
  passwordRow: { flexDirection: "row", alignItems: "center" },
  inputPassword: { flex: 1 },
  toggleBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  toggleText: { color: "#374151", fontWeight: "600" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rememberRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: { backgroundColor: "#0b84ff", borderColor: "#0b84ff" },
  checkboxMark: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rememberText: { color: "#374151" },
  forgot: { color: "#0b844f", fontWeight: "700" },
  primaryBtn: {
    backgroundColor: "#0b84ff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: "#fff", fontWeight: "800" },
  bottom: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  small: { color: "#6b7280" },
  link: { color: "#0b84ff", fontWeight: "700" },
  copyright: {
    textAlign: "center",
    marginTop: 14,
    color: "#9ca3af",
    fontSize: 12,
  },
});
