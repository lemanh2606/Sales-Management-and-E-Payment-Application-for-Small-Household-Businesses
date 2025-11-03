import React, { JSX } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../context/AuthContext";
import DashboardScreen from "../screens/home/DashboardScreen";
import SelectStoreScreen from "../screens/store/SelectStoreScreen";
import Unauthorized from "../screens/misc/Unauthorized"; // màn tạm thời
import Profile from "../screens/user/Profile";

const Drawer = createDrawerNavigator();

// --- Check quyền menu chuẩn ---
function hasPermission(menu: string[] = [], required?: string | string[]) {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((r) => menu.includes(r));
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc muốn đăng xuất không?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đăng xuất", style: "destructive", onPress: logout },
      ],
      { cancelable: true }
    );
  };

  const nameLabel = user?.username || "Người dùng";
  const roleLabel = user?.role || "—";

  // Chỉ filter SelectStore theo role (như trước)
  const filteredRoutes = props.state.routes.filter((r) => {
    if (r.name === "SelectStore" && user?.role !== "MANAGER") return false;
    return true;
  });

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.name}>{nameLabel}</Text>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <DrawerItemList
          {...props}
          state={{ ...props.state, routes: filteredRoutes }}
        />
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

export default function AppNavigator(): JSX.Element {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0b84ff" />
        <Text style={{ marginTop: 10 }}>Đang tải dữ liệu người dùng...</Text>
      </View>
    );
  }

  const menu = user?.menu || [];

  // Wrapper kiểm tra quyền menu
  const ProtectedScreen =
    (Screen: JSX.Element, requiredPermission?: string | string[]) => () => {
      if (!hasPermission(menu, requiredPermission)) {
        return <Unauthorized />; // nếu không có quyền -> màn tạm thời
      }
      return Screen;
    };

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: "#10b981" }, // header xanh lá
        headerTintColor: "#ffffff",
        drawerActiveTintColor: "#10b981", // highlight menu
        drawerInactiveTintColor: "#374151",
        drawerLabelStyle: { fontSize: 15, fontWeight: "600" },
      }}
    >
      <Drawer.Screen
        name="Dashboard"
        component={ProtectedScreen(<DashboardScreen />)}
        options={{
          title: "Dashboard",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="speedometer-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProtectedScreen(<Profile />)}
        options={{
          title: "Hồ sơ cá nhân",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      {user?.role === "MANAGER" && (
        <Drawer.Screen
          name="SelectStore"
          component={ProtectedScreen(<SelectStoreScreen />)}
          options={{
            title: "Chọn cửa hàng",
            drawerIcon: ({ color, size }) => (
              <Ionicons name="storefront-outline" size={size} color={color} />
            ),
          }}
        />
      )}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#10b981", // xanh lá tươi
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#059669", // xanh lá đậm
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  role: { color: "#d1fae5", fontSize: 12, marginTop: 2 },
  menu: { flex: 1, paddingTop: 8 },
  bottom: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  logoutText: { color: "#ef4444", fontWeight: "700" },
  copy: { marginTop: 12, fontSize: 12, color: "#9ca3af" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff", // nền trắng
  },
});
