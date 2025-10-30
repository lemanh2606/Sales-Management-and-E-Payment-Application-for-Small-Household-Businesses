import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text, View, Button } from "react-native";
import { useAuth } from "../context/AuthContext"; // Import useAuth

// Màn hình Dashboard (Giữ chỗ)
const DashboardScreen = () => {
  const { logout, user } = useAuth(); // Lấy hàm logout và user
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Chào mừng bạn quay trở lại, {user?.fullName || "User"}!</Text>
      <Text>Đây là màn hình Dashboard chính.</Text>
      <Button title="Đăng xuất" onPress={logout} />
    </View>
  );
};

// (Bạn sẽ import các màn hình khác ở đây)
// import ProfileScreen from '../screens/ProfileScreen';
// import SelectStoreScreen from '../pages/store/SelectStoreScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Trang chủ" }}
      />
      {/* <Stack.Screen name="SelectStore" component={SelectStoreScreen} /> */}
      {/* <Stack.Screen name="Profile" component={ProfileScreen} /> */}
      {/* (Thêm các màn hình khác của app ở đây) */}
    </Stack.Navigator>
  );
};

export default AppNavigator;
