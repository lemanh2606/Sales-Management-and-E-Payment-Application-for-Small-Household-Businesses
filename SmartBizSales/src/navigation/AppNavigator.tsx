// src/navigation/AppNavigator.tsx
/**
 * Trình điều hướng chính (Drawer) của app.
 * - Drawer có header show user info, list screens và nút logout ở dưới.
 * - File đã chuyển sang TypeScript, dùng typing của @react-navigation/drawer.
 */

import React, { JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import DashboardScreen from "../screens/home/DashboardScreen";

import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { User } from "../type/user";
import SelectStoreScreen from "../screens/store/SelectStoreScreen";

const Drawer = createDrawerNavigator();

/**
 * Tùy chỉnh nội dung drawer (header user, list, logout...)
 */
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc muốn đăng xuất không?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
            } catch (e) {
              console.warn("Logout failed", e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Lấy hiển thị tên (ưu tiên fullName/username)
  const nameLabel =
    (user && ((user as User).username || (user as any).name)) || "Người dùng";
  const roleLabel = (user && (user as User).role) || "—";

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {/* Nếu có avatar url, bạn có thể thay bằng <Image source={{ uri: avatar }} /> */}
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.name}>{nameLabel}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <DrawerItemList {...props} />
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={18}
            color="#ef4444"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
        <Text style={styles.copy}>© 2025 Smallbiz-Sales</Text>
      </View>
    </DrawerContentScrollView>
  );
}

/**
 * App navigator (Drawer)
 */
export default function AppNavigator(): JSX.Element {
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        drawerType: "front",
        drawerActiveTintColor: "#0b84ff",
        drawerLabelStyle: { fontSize: 15 },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Dashboard",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="SelectStore"
        component={SelectStoreScreen}
        options={{
          title: "Chọn cửa hàng",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#0b84ff",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#0b6fe0",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: "#fff", fontWeight: "700", fontSize: 16 },
  role: { color: "#e6f2ff", fontSize: 12, marginTop: 2 },
  menu: { flex: 1, paddingTop: 8 },
  bottom: { padding: 16, borderTopWidth: 1, borderColor: "#f0f0f0" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  logoutText: { color: "#ef4444", fontWeight: "700" },
  copy: { marginTop: 12, fontSize: 12, color: "#9ca3af" },
});
