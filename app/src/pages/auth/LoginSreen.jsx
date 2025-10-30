import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/index"; // Giả sử userApi chứa hàm loginUser
// Hoặc import { loginUser } from '../../api/userService'; // Tùy cách bạn cấu trúc

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth(); // Lấy hàm login từ Context

  const [email, setEmail] = useState(""); // Hoặc 'username'
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Gọi API để lấy token và user data
      // (Giả sử bạn dùng email, đổi 'email' thành 'username' nếu cần)
      const response = await userApi.loginUser({ email, password });

      // 2. Nếu thành công, gọi hàm login của Context
      // Hàm login trong context sẽ xử lý lưu trữ và điều hướng
      if (response && response.user && response.token) {
        await login(response.user, response.token);
      } else {
        throw new Error("Dữ liệu đăng nhập không hợp lệ");
      }
    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      const message =
        err.response?.data?.message || "Email hoặc mật khẩu không đúng.";
      setError(message);
      Alert.alert("Đăng nhập thất bại", message);
      setLoading(false);
    }
    // không cần setLoading(false) ở đây, vì hàm login sẽ điều hướng đi
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <Text style={styles.title}>Đăng nhập</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#888"
        />

        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          value={password}
          onChangeText={setPassword}
          secureTextEntry // Ẩn mật khẩu
          placeholderTextColor="#888"
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading} // Vô hiệu hóa khi đang tải
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Đăng nhập</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.linkText}>Chưa có tài khoản? Đăng ký</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={styles.linkText}>Quên mật khẩu?</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#333",
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: "#333",
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#007AFF", // Màu xanh dương
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  linkText: {
    color: "#007AFF",
    marginTop: 20,
    fontSize: 16,
  },
});

export default LoginScreen;
