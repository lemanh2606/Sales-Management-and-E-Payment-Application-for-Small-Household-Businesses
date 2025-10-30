// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ImageBackground, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useAuth } from "../../context/AuthContext";
import * as userApi from "../../api/userApi";

export default function LoginPage({ navigation }) {
    const { login } = useAuth();
    const [form, setForm] = useState({ username: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => {
        setForm((s) => ({ ...s, [field]: value }));
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            const data = await userApi.loginUser(form);
            if (!data?.token || !data?.user) {
                setError("Server trả thiếu token hoặc user");
                setLoading(false);
                return;
            }
            await login(data.user, data.token);
            setLoading(false);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Lỗi server");
            setLoading(false);
        }
    };

    return (
        <ImageBackground
            source={{ uri: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80" }}
            style={styles.bg}
            blurRadius={2}
        >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
                <View style={styles.card}>
                    <Text style={styles.title}>Chào mừng trở lại</Text>
                    <Text style={styles.subtitle}>Đăng nhập để quản lý cửa hàng của bạn</Text>

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="Tên đăng nhập hoặc email"
                        value={form.username}
                        onChangeText={(text) => handleChange("username", text)}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <View style={styles.passwordWrapper}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Mật khẩu"
                            value={form.password}
                            onChangeText={(text) => handleChange("password", text)}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
                            <Text style={{ color: "#4ade80", fontWeight: "bold" }}>{showPassword ? "Ẩn" : "Hiện"}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleSubmit} style={styles.button} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Đăng nhập</Text>}
                    </TouchableOpacity>

                    <View style={styles.bottomText}>
                        <Text style={{ color: "#888" }}>Chưa có tài khoản? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
                            <Text style={{ color: "#16a34a", fontWeight: "bold" }}>Đăng ký ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1, justifyContent: "center", alignItems: "center" },
    container: { flex: 1, justifyContent: "center", width: "100%" },
    card: {
        backgroundColor: "rgba(255,255,255,0.95)",
        padding: 24,
        marginHorizontal: 20,
        borderRadius: 24,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    title: { fontSize: 28, fontWeight: "bold", color: "#111", marginBottom: 6 },
    subtitle: { fontSize: 14, color: "#666", marginBottom: 16 },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        backgroundColor: "#fff",
    },
    passwordWrapper: { flexDirection: "row", alignItems: "center" },
    showButton: { paddingHorizontal: 10 },
    button: {
        backgroundColor: "#16a34a",
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: "center",
        marginTop: 12,
    },
    buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    error: { color: "#b91c1c", marginBottom: 8, fontSize: 14 },
    bottomText: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
});
