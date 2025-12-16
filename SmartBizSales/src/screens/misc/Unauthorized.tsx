// src/screens/misc/Unauthorized.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

export default function Unauthorized() {
  const navigation = useNavigation();
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={80} color="#ef4444" />
      <Text style={styles.title}>Không có quyền truy cập</Text>
      <Text style={styles.message}>
        Bạn không có quyền truy cập vào màn hình này. Vui lòng liên hệ quản trị
        viên nếu cần.
      </Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.navigate("Dashboard" as never)}
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Về Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.logoutBtn]}
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ef4444",
    marginTop: 20,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
    marginTop: 10,
  },
  buttons: {
    flexDirection: "row",
    marginTop: 30,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b84ff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    margin: 5,
  },
  logoutBtn: {
    backgroundColor: "#ef4444",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
  },
});
