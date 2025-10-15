import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RegisterPage from "../pages/auth/RegisterPage";
import VerifyOtpPage from "../pages/auth/VerifyOtpPage";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import SelectStorePage from "../pages/store/SelectStorePage";
import SupplierListPage from "../pages/supplier/SupplierListPage";
import SupplierCreatePage from "../pages/supplier/SupplierCreatePage";
import SupplierEditPage from "../pages/supplier/SupplierEditPage";
import ProductListPage from "../pages/product/ProductListPage";
import ProductCreatePage from "../pages/product/ProductCreatePage";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
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
        path="/stores/:storeId/suppliers"
        element={
          <ProtectedRoute>
            <SupplierListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stores/:storeId/suppliers/create"
        element={
          <ProtectedRoute>
            <SupplierCreatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers/:supplierId/edit"
        element={
          <ProtectedRoute>
            <SupplierEditPage />
          </ProtectedRoute>
        }
      />

      {/* Products */}
      <Route
        path="/stores/:storeId/products"
        element={
          <ProtectedRoute>
            <ProductListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stores/:storeId/products/create"
        element={
          <ProtectedRoute>
            <ProductCreatePage />
          </ProtectedRoute>
        }
      />

      {/* Default */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
