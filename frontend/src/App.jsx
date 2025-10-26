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
import LoyaltySetting from "./pages/loyalty/LoyaltySetting";

// 👉 Customer page bạn đã tạo
import CustomerListPage from "./pages/customer/CustomerListPage";

import { useAuth } from "./context/AuthContext";

import Unauthorized from "./pages/misc/Unauthorized";

import NotFound from "./pages/misc/NotFound";


/** Utility: đọc user từ localStorage (fallback) */
function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Invalid user in localStorage", err);
    return null;
  }
}

/** Utility: kiểm tra permission (ANY logic: có ít nhất 1 permission) */
function hasPermission(menu = [], required) {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((r) => menu.includes(r));
}

/**
 * ProtectedRoute
 * - Props:
 *    allowedRoles: array of roles (optional)
 *    allowedPermissions: string or array of permissions (optional)
 *
 * Logic:
 * - If loading -> show loading
 * - If not authenticated (no token && no stored user) -> redirect /login
 * - If role mismatch -> redirect /unauthorized
 * - If permissions provided and user.menu không chứa -> redirect /unauthorized
 */
const ProtectedRoute = ({ children, allowedRoles = [], allowedPermissions = null }) => {
  const { token, user: ctxUser, loading } = useAuth();

  if (loading) return <div className="text-center mt-20 text-gray-500">Đang kiểm tra quyền...</div>;

  // prefer context user, fallback to localStorage
  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null;

  const isAuthenticated = Boolean(token) || Boolean(user);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role check if provided
  if (allowedRoles.length > 0) {
    const role = (user && user.role) || null;
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Permissions check if provided
  if (allowedPermissions) {
    const menu = (user && user.menu) || [];
    if (!hasPermission(menu, allowedPermissions)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

/**
 * PublicRoute
 * - Dùng cho trang auth (login/register/verify)
 * - Nếu đã login -> redirect /unauthorized (theo yêu cầu)
 * - allowWhenAuth: nếu true sẽ cho phép truy cập trang public ngay cả khi đã đăng nhập
 */
const PublicRoute = ({ children, allowWhenAuth = false }) => {
  const { token, user: ctxUser, loading } = useAuth();

  if (loading) return <div className="text-center mt-20 text-gray-500">Đang kiểm tra...</div>;

  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null;

  if (user && !allowWhenAuth) {
    return <Navigate to="/unauthorized" replace />;
  }

  // also if token exists but no user in context/storage, still allow public pages
  // (you can change this behavior if you prefer token-only redirect)
  return children;
};

function App() {
  return (
    <Routes>
      {/* Public (Auth) routes - bọc PublicRoute */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/verify-otp"
        element={
          <PublicRoute>
            <VerifyOtpPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
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

      <Route
        path="/suppliers"
        element={
          <ProtectedRoute allowedPermissions="supplier:view">
            <SupplierListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute allowedPermissions="products:view">
            <ProductListPage />
          </ProtectedRoute>
        }
      />

      {/* Customer page (ví dụ yêu cầu permission customers:search) */}
      <Route
        path="/customers"
        element={
          <ProtectedRoute allowedPermissions="customers:search">
            <CustomerListPage />
          </ProtectedRoute>
        }
      />

      {/* Loyalty (ví dụ check role) */}
      <Route
        path="/loyalty/config"
        element={
          <ProtectedRoute allowedRoles={["MANAGER", "STAFF"]}>
            <LoyaltySetting />
          </ProtectedRoute>
        }
      />

      {/* Unauthorized */}
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Default: điều hướng tới dashboard (ProtectedRoute sẽ xử lý redirect tới /login nếu chưa auth) */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
