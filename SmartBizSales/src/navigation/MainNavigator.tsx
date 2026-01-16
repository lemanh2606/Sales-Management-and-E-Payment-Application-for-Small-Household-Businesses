import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AuthNavigator from "./AuthNavigator";
import AppNavigator from "./AppNavigator";

import PaymentWebViewScreen from "../screens/settings/PaymentWebViewScreen";

import SubscriptionCancelScreen from "../screens/settings/SubscriptionCancelScreen";

import { useAuth } from "../context/AuthContext";
import SubscriptionSuccessScreen from "../screens/settings/PaymentWebViewScreen";

export type MainStackParamList = {
  Auth: undefined;
  App: undefined;

  PaymentWebView: { checkoutUrl: string };
  SubscriptionSuccess:
    | { orderCode?: string | null; status?: string | null }
    | undefined;
  SubscriptionCancel: { orderCode?: string | null } | undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function MainNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/*  Mỗi navigator phải nằm trong 1 Screen riêng [web:1034] */}
      {!user ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <Stack.Screen name="App" component={AppNavigator} />
      )}

      {/*  Flow screens cũng là Stack.Screen */}
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} />
      <Stack.Screen
        name="SubscriptionSuccess"
        component={SubscriptionSuccessScreen}
      />
      <Stack.Screen
        name="SubscriptionCancel"
        component={SubscriptionCancelScreen}
      />
    </Stack.Navigator>
  );
}
