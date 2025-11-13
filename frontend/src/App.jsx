// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, Spin, message } from "antd";
import viVN from "antd/locale/vi_VN";

// Context
import { useAuth } from "./context/AuthContext";

// Loading Component
import LoadingSpinner from "./components/LoadingSpinner";

// Subscription Components
import SubscriptionExpiredOverlay from "./components/subscription/SubscriptionExpiredOverlay";
import ManagerSubscriptionCheck from "./components/subscription/ManagerSubscriptionCheck";

// Common Pages
import NotFound from "./pages/misc/NotFound";
import Unauthorized from "./pages/misc/Unauthorized";
import DashboardPage from "./pages/DashboardPage";

// Auth Pages
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPassword from "./pages/auth/ForgotPassword";

// Store & Employees
import SelectStorePage from "./pages/store/SelectStorePage";
import EmployeesPage from "./pages/store/EmployeesPage";
import InformationStore from "./pages/store/InformationStore";

// Product & Supplier
import ProductListPage from "./pages/product/ProductListPage";
import ProductGroupsPage from "./pages/productGroup/ProductGroupsPage";
import SupplierListPage from "./pages/supplier/SupplierListPage";

// Customer
import CustomerListPage from "./pages/customer/CustomerListPage";
import TopCustomer from "./pages/customer/TopCustomer";

// Reports
import ReportDashboard from "./pages/report/ReportDashboard";
import RevenueReport from "./pages/report/RevenueReport";
import TaxDeclaration from "./pages/report/TaxDeclaration";
import TopProductsReport from "./pages/report/TopProductsReport";
import InventoryReport from "./pages/report/InventoryReport";

// Settings
import Profile from "./pages/setting/Profile";
import PricingPage from "./pages/setting/PricingPage";
import SubscriptionPage from "./pages/setting/SubscriptionPage";
import ActivityLog from "./pages/setting/ActivityLog";
import FileManager from "./pages/setting/FileManager";
import Notification from "./pages/setting/Notification";
import Term from "./pages/setting/Term";
import Privacy from "./pages/setting/Privacy";

// Loyalty
import LoyaltySetting from "./pages/loyalty/LoyaltySetting";

// Orders
import SidebarPOS from "./pages/order/SidebarPOS";
import ListAllOrder from "./pages/order/ListAllOrder";
import ListPendingOrders from "./pages/order/ListPendingOrders";

/** Utility: Read user from localStorage */
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

/** Utility: Check permissions (ANY logic) */
function hasPermission(menu = [], required) {
  if (!required) return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.some((r) => menu.includes(r));
}

/** Protected Route Component */
const ProtectedRoute = ({ children, allowedRoles = [], allowedPermissions = null }) => {
  const { token, user: ctxUser, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <LoadingSpinner size="large" iconColor="#52c41a" tip="🔐 Đang xác thực quyền truy cập..." tipColor="#52c41a" />
      </div>
    );
  }

  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null;

  const isAuthenticated = Boolean(token) || Boolean(user);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (allowedRoles.length > 0) {
    const role = (user && user.role) || null;
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Permissions check
  if (allowedPermissions) {
    const menu = (user && user.menu) || [];
    if (!hasPermission(menu, allowedPermissions)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

/** Public Route Component */
const PublicRoute = ({ children, allowWhenAuth = false }) => {
  const { token, user: ctxUser, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <LoadingSpinner
          size="large"
          iconColor="#52c41a"
          tip="🚀 Đang vào hệ thống - Smallbiz Sales"
          tipColor="#52c41a"
        />
      </div>
    );
  }

  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null;

  if (user && !allowWhenAuth) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
};

/** App Init - Clear localStorage at root */
function AppInit() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/") {
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

function App() {
  // Message API cho toàn app
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: "#52c41a",
          colorSuccess: "#52c41a",
          colorInfo: "#1890ff",
          colorWarning: "#faad14",
          colorError: "#f5222d",
          borderRadius: 8,
          fontSize: 14,
        },
        components: {
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            fontWeight: 600,
          },
          Card: {
            borderRadiusLG: 12,
          },
          Input: {
            borderRadius: 8,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 8,
            controlHeight: 40,
          },
        },
      }}
    >
      {/* Message context holder */}
      {contextHolder}

      <AppInit />
      <ManagerSubscriptionCheck />
      <SubscriptionExpiredOverlay />

      <Routes>
        {/* ==================== Auth Routes ==================== */}
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

        {/* ==================== Dashboard & Store ==================== */}
        <Route
          path="/dashboard/:storeId"
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
          path="/update/store"
          element={
            <ProtectedRoute>
              <InformationStore />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:storeId/employees"
          element={
            <ProtectedRoute>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        {/* ==================== Products & Suppliers ==================== */}
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
        <Route
          path="/product-groups"
          element={
            <ProtectedRoute allowedPermissions="products:view">
              <ProductGroupsPage />
            </ProtectedRoute>
          }
        />

        {/* ==================== Customers ==================== */}
        <Route
          path="/customers-list"
          element={
            <ProtectedRoute allowedPermissions="customers:search">
              <CustomerListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/top-customers"
          element={
            <ProtectedRoute allowedPermissions="customers:search">
              <TopCustomer />
            </ProtectedRoute>
          }
        />

        {/* ==================== Loyalty ==================== */}
        <Route
          path="/loyalty/config"
          element={
            <ProtectedRoute allowedRoles={["MANAGER", "STAFF"]}>
              <LoyaltySetting />
            </ProtectedRoute>
          }
        />

        {/* ==================== Reports ==================== */}
        <Route
          path="/reports/dashboard"
          element={
            <ProtectedRoute allowedPermissions="reports:financial:view">
              <ReportDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/revenue"
          element={
            <ProtectedRoute allowedPermissions="reports:revenue:view">
              <RevenueReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/tax"
          element={
            <ProtectedRoute allowedPermissions="tax:preview">
              <TaxDeclaration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/top-products"
          element={
            <ProtectedRoute allowedPermissions="reports:top-products">
              <TopProductsReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/inventory-reports"
          element={
            <ProtectedRoute allowedPermissions="inventory:stock-check:view">
              <InventoryReport />
            </ProtectedRoute>
          }
        />

        {/* ==================== Settings ==================== */}
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notification"
          element={
            <ProtectedRoute>
              <Notification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/activity-log"
          element={
            <ProtectedRoute allowedPermissions="settings:activity-log">
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/file"
          element={
            <ProtectedRoute allowedPermissions="file:view">
              <FileManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/subscription/pricing"
          element={
            <ProtectedRoute allowedPermissions="subscription:view">
              <PricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/subscription"
          element={
            <ProtectedRoute allowedPermissions="subscription:view">
              <SubscriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/terms"
          element={
            <ProtectedRoute>
              <Term />
            </ProtectedRoute>
          }
        />
        <Route
          path="/privacy"
          element={
            <ProtectedRoute>
              <Privacy />
            </ProtectedRoute>
          }
        />

        {/* ==================== Orders ==================== */}
        <Route
          path="/orders/pos"
          element={
            <ProtectedRoute allowedPermissions="orders:create">
              <SidebarPOS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/list"
          element={
            <ProtectedRoute allowedPermissions="orders:view">
              <ListAllOrder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/list-pending"
          element={
            <ProtectedRoute allowedPermissions="orders:view">
              <ListPendingOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/notification"
          element={
            <ProtectedRoute>
              <Notification />
            </ProtectedRoute>
          }
        />
        {/* Unauthorized */}

        {/* ==================== Error Pages ==================== */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
