// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import LoginPage from "./pages/auth/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SelectStorePage from "./pages/store/SelectStorePage";
import SupplierListPage from "./pages/supplier/SupplierListPage";
import ProductListPage from "./pages/product/ProductListPage";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Profile from "./pages/user/Profile";
import LoyaltySetting from "./pages/loyalty/LoyaltySetting"; // 👈 Import mới cho Loyalty
import { useAuth } from "./context/AuthContext"; // Import để dùng cho ProtectedRoute

// ProtectedRoute component (gộp inline từ ProtectedRoute.jsx)
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { token, user, loading } = useAuth();

  if (loading) return <div className="text-center mt-20 text-gray-500">Đang kiểm tra quyền...</div>;

  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />; // Lưu ý: Chưa có route /unauthorized, có thể add sau

  return children;
};

function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Dashboard & Store selection */}
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

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Suppliers (consistent routes with storeId) */}
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute>
            <SupplierListPage />
          </ProtectedRoute>
        }
      />
      {/* Products */}
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <ProductListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/loyalty/config"
        element={
          <ProtectedRoute allowedRoles={["MANAGER", "STAFF"]}>
            <LoyaltySetting />
          </ProtectedRoute>
        }
      />

      {/* Mặc định */}
      <Route path="*" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}

export default App;
