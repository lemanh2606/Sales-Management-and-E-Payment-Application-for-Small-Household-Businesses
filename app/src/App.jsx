import React from "react";
import { StatusBar, View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Import hai stack điều hướng chính của bạn
import AuthNavigator from "./navigation/AuthNavigator";
import AppNavigator from "./navigation/AppNavigator";

/**
 * Màn hình Loading
 * Hiển thị trong khi AuthContext đang đọc AsyncStorage
 */
const LoadingScreen = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#007AFF" />
  </View>
);

/**
 * Bộ điều hướng gốc
 * Quyết định hiển thị App hay Auth dựa trên Context
 */
const RootNavigator = () => {
  // Lấy state từ AuthContext
  const { loading, token } = useAuth();

  // 1. Nếu đang loading (đọc AsyncStorage), hiển thị màn hình chờ
  if (loading) {
    return <LoadingScreen />;
  }

  // 2. Nếu đã load xong, kiểm tra token
  // Nếu có token -> vào App
  // Nếu không có token -> ở lại màn hình Auth (Login)
  return token ? <AppNavigator /> : <AuthNavigator />;
};

/**
 * Component App chính
 * Bọc toàn bộ app trong các providers
 */
const App = () => {
  return (
    <NavigationContainer>
      <AuthProvider>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});

export default App;
