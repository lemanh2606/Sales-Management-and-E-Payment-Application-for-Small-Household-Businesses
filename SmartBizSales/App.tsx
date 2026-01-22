import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { NotificationProvider } from "./src/context/NotificationContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AuthNavigator from "./src/navigation/AuthNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  navigationRef,
  setNavigationReady,
} from "./src/navigation/RootNavigation";
import FlashMessage from "react-native-flash-message";
import Toast, {
  BaseToast,
  ErrorToast,
  ToastConfig,
} from "react-native-toast-message";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import MemoryMonitor from "./src/components/MemoryMonitor";
import MainNavigator from "@/navigation/MainNavigator";
import { Ionicons } from "@expo/vector-icons";

// Custom Toast configuration với thiết kế đẹp hơn
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: "#52c41a",
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: "#1f2937",
      }}
      text2Style={{
        fontSize: 13,
        color: "#6b7280",
      }}
      text2NumberOfLines={2}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: "#ff4d4f",
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: "#1f2937",
      }}
      text2Style={{
        fontSize: 13,
        color: "#6b7280",
      }}
      text2NumberOfLines={2}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: "#1890ff",
        backgroundColor: "#fff",
        borderRadius: 12,
        marginHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: "#1f2937",
      }}
      text2Style={{
        fontSize: 13,
        color: "#6b7280",
      }}
      text2NumberOfLines={2}
    />
  ),
};

// Màn hình loading khi đang kiểm tra đăng nhập
function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}

// Component quyết định hiển thị màn hình nào dựa trên trạng thái đăng nhập
function RootNavigator(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  // Hiển thị màn hình loading khi đang kiểm tra trạng thái đăng nhập
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Hiển thị màn hình chính nếu đã đăng nhập, ngược lại hiển thị màn hình đăng nhập
  return user ? <AppNavigator /> : <AuthNavigator />;
}

// Component chính của ứng dụng
export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              console.log(" Navigation is ready");
              setNavigationReady();
            }}
          >
            {/* <RootNavigator /> */}
            <MainNavigator />
            <FlashMessage position="top" />
          </NavigationContainer>
          {/* Toast component phải ở trong NotificationProvider */}
          <Toast config={toastConfig} />
        </NotificationProvider>
        {/* {__DEV__ && <MemoryMonitor />} */}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
