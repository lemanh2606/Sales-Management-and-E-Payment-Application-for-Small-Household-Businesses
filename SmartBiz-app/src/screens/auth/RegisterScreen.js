// src/screens/auth/RegisterScreen.js
import React, { useState } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as userApi from "../../api/userApi";

export default function RegisterScreen() {
  const navigation = useNavigation();

  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (key, value) => setForm((s) => ({ ...s, [key]: value }));

  const validate = () => {
    if (!form.username.trim()) return "Vui lòng nhập tên đăng nhập";
    if (!form.email.trim()) return "Vui lòng nhập email";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Email không hợp lệ";
    if (!form.password) return "Vui lòng nhập mật khẩu";
    if (form.password.length < 6) return "Mật khẩu phải ít nhất 6 ký tự";
    if (form.password !== form.confirmPassword)
      return "Mật khẩu nhập lại không trùng khớp";
    return null;
  };

  const handleSubmit = async () => {
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
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      };

      const res = await userApi.registerManager(payload);

      // Hiện alert thành công (Swal -> Alert)
      Alert.alert(
        "🎉 Đăng ký thành công",
        res?.message || "Vui lòng kiểm tra email để lấy mã OTP xác thực.",
        [
          {
            text: "Tiếp tục",
            onPress: () =>
              navigation.navigate("VerifyOtp", {
                email: form.email.trim().toLowerCase(),
              }),
          },
        ],
        { cancelable: false }
      );
    } catch (err) {
      console.error("Register error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Đã có lỗi xảy ra, thử lại sau.";
      // dùng Alert cho lỗi
      Alert.alert("Lỗi", msg, [{ text: "Đóng" }], { cancelable: true });
    } finally {
      setIsLoading(false);
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
          <Text style={styles.title}>Tạo tài khoản Manager</Text>
          <Text style={styles.subtitle}>
            Đăng ký nhanh, xác thực bằng email. Sau khi xác minh bằng OTP, bạn
            sẽ quản lý cửa hàng, nhân viên và báo cáo.
          </Text>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              value={form.username}
              onChangeText={(t) => handleChange("username", t)}
              placeholder="ví dụ: nguyenvana123"
              autoCapitalize="none"
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={form.email}
              onChangeText={(t) => handleChange("email", t)}
              placeholder="example@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
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
              value={form.phone}
              onChangeText={(t) => handleChange("phone", t)}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              value={form.password}
              onChangeText={(t) => handleChange("password", t)}
              placeholder="Ít nhất 6 ký tự"
              secureTextEntry
              style={styles.input}
              editable={!isLoading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Xác nhận mật khẩu</Text>
            <TextInput
              value={form.confirmPassword}
              onChangeText={(t) => handleChange("confirmPassword", t)}
              placeholder="Nhập lại mật khẩu"
              secureTextEntry
              style={styles.input}
              editable={!isLoading}
            />
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
              onPress={() => navigation.navigate("Login")}
              disabled={isLoading}
            >
              <Text style={styles.link}>Đăng nhập</Text>
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
  brand: { fontSize: 18, fontWeight: "800", color: "#10b981", marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
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
  note: { color: "#075985", fontSize: 12, marginTop: 6 },
  primaryBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
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
  link: { color: "#10b981", fontWeight: "700" },
  copyright: {
    textAlign: "center",
    marginTop: 14,
    color: "#9ca3af",
    fontSize: 12,
  },
});
