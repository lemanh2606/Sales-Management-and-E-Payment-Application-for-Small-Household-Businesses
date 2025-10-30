import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Import các màn hình Auth
import LoginScreen from "../pages/auth/LoginSreen";
// (Bạn có thể tạo và import thêm các màn hình khác ở đây)
// import RegisterScreen from '../pages/auth/RegisterScreen';
// import ForgotPasswordScreen from '../pages/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // Ẩn header cho các màn hình auth
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      {/* <Stack.Screen name="Register" component={RegisterScreen} /> */}
      {/* <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} /> */}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
