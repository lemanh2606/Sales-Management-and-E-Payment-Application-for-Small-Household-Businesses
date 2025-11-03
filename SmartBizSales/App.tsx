import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AuthNavigator from "./src/navigation/AuthNavigator";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { navigationRef } from "./src/navigation/RootNavigation";
import Toast from "react-native-toast-message";
import FlashMessage from "react-native-flash-message";

function RootNavigator() {
  const { user } = useAuth();
  return user ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
          <FlashMessage position="top" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
