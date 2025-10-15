import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import VerifyOtpPage from "../pages/VerifyOtpPage";
import SelectStorePage from "../pages/SelectStorePage";
import ProtectedRoute from "./ProtectedRoute";
import SupplierListPage from "../pages/supplier/SupplierListPage";
import SupplierCreatePage from "../pages/supplier/SupplierCreatePage";
import SupplierEditPage from "../pages/supplier/SupplierEditPage";
import ProductListPage from "../pages/product/ProductListPage";
import ProductCreatePage from "../pages/product/ProductCreatePage";
function AppRoutes() {
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
<Route path="/suppliers/:supplierId/edit" element={<SupplierEditPage />} />
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

      

    </Routes>
    
  );
}

export default AppRoutes;
