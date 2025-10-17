import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import LoginPage from "./pages/auth/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SelectStorePage from "./pages/store/SelectStorePage";
import SupplierListPage from "./pages/supplier/SupplierListPage";
import ProductListPage from "./pages/product/ProductListPage";
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
            <DashboardPage />{" "}
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

      {/* Default */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
