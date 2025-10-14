import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";  // Giả sử path đúng
import RegisterPage from "./pages/RegisterPage"
import DashboardPage from "./pages/DashboardPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import SelectStorePage from "./pages/SelectStorePage";
import { useAuth } from "./context/AuthContext";  // Import để dùng cho ProtectedRoute

// Định nghĩa ProtectedRoute inline hoặc giữ riêng (em suggest giữ riêng dưới đây)
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/select-store"
        element={
          <ProtectedRoute>
            <SelectStorePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;