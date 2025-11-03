import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function DashboardScreen() {
  const { logout, user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Xin chào, {user?.fullname || "Người dùng"} 👋
      </Text>
      <TouchableOpacity onPress={logout} style={styles.btn}>
        <Text style={styles.btnText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  btn: {
    backgroundColor: "#ff4444",
    padding: 10,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
