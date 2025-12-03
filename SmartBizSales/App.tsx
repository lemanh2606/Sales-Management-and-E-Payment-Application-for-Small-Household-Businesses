import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AuthNavigator from "./src/navigation/AuthNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  navigationRef,
  setNavigationReady,
} from "./src/navigation/RootNavigation";
import FlashMessage from "react-native-flash-message";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import MemoryMonitor from "./src/components/MemoryMonitor";

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
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            console.log("✅ Navigation is ready");
            setNavigationReady();
          }}
        >
          <RootNavigator />
          <FlashMessage position="top" />
        </NavigationContainer>
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
