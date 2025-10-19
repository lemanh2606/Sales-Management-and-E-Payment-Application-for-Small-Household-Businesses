import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
// Giả sử path đúng
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import DashboardPage from "./pages/DashboardPage";
import SelectStorePage from "./pages/store/SelectStorePage";
import LoginPage from "./pages/auth/LoginPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import SupplierListPage from "./pages/supplier/SupplierListPage";
import ProductListPage from "./pages/product/ProductListPage";



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