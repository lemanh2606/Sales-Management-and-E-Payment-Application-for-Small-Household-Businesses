// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
// 🧩 Context
import { useAuth } from "./context/AuthContext";
// 🎨 UI & Ant Design
import { ConfigProvider, Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import viVN from "antd/locale/vi_VN";
// 🔔 Subscription Overlay
import SubscriptionExpiredOverlay from "./components/subscription/SubscriptionExpiredOverlay";
import ManagerSubscriptionCheck from "./components/subscription/ManagerSubscriptionCheck";
// 🧭 Common Pages
import NotFound from "./pages/misc/NotFound";
import Unauthorized from "./pages/misc/Unauthorized";
import DashboardPage from "./pages/DashboardPage";
// 👤 Auth Pages
import RegisterPage from "./pages/auth/RegisterPage";
import VerifyOtpPage from "./pages/auth/VerifyOtpPage";
import LoginPage from "./pages/auth/LoginPage";
import ForgotPassword from "./pages/auth/ForgotPassword";
// 🏬 Store & Employees
import SelectStorePage from "./pages/store/SelectStorePage";
import EmployeesPage from "./pages/store/EmployeesPage";
import InformationStore from "./pages/store/InformationStore";
// 📦 Product & Supplier
import ProductListPage from "./pages/product/ProductListPage";
import ProductGroupsPage from "./pages/productGroup/ProductGroupsPage";
import SupplierListPage from "./pages/supplier/SupplierListPage";
// 🧍‍♂️ Customer
import CustomerListPage from "./pages/customer/CustomerListPage";
import TopCustomer from "./pages/customer/TopCustomer";
// 🧾 Reports
import ReportDashboard from "./pages/report/ReportDashboard";
import RevenueReport from "./pages/report/RevenueReport";
import TaxDeclaration from "./pages/report/TaxDeclaration";
import TopProductsReport from "./pages/report/TopProductsReport";
// ⚙️ Settings
import Profile from "./pages/setting/Profile";
import PricingPage from "./pages/setting/PricingPage";
import SubscriptionPage from "./pages/setting/SubscriptionPage";
import ActivityLog from "./pages/setting/ActivityLog";
import FileManager from "./pages/setting/FileManager";
import LoyaltySetting from "./pages/loyalty/LoyaltySetting";
// 🛒 Orders
import SidebarPOS from "./pages/order/SidebarPOS";
import ListAllOrder from "./pages/order/ListAllOrder";
import ListPendingOrders from "./pages/order/ListPendingOrders";
import Notification from "./pages/setting/Notification";

const loadingIcon = <LoadingOutlined style={{ fontSize: 40 }} spin />;

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

// 👉 FIX: Tweak ProtectedRoute - ưu tiên ctxUser hơn storedUser, và chỉ check role/permission nếu !loading
// (nhưng vì loading đã handle ở đầu, nên an toàn hơn, tránh flicker nếu state lag)
const ProtectedRoute = ({ children, allowedRoles = [], allowedPermissions = null }) => {
  const { token, user: ctxUser, loading } = useAuth();

  if (loading) {
    return (
      <Spin spinning size="large" indicator={loadingIcon} tip="Đang xác thực quyền truy cập...">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center p-4"></div>
        </div>
      </Spin>
    );
  }

  // 👉 FIX: Prefer context user FIRST, fallback to localStorage (vì sau login, ctxUser set trước)
  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null; // Đã tốt, nhưng comment rõ

  const isAuthenticated = Boolean(token) || Boolean(user);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 👉 FIX: Chỉ check role/permission nếu user đầy đủ (có role/menu), tránh null crash
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

  if (loading) {
    return (
      <Spin spinning size="large" indicator={loadingIcon} tip="Vui lòng đợi, đang vào hệ thống...">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center p-4"></div>
        </div>
      </Spin>
    );
  }

  // 👉 FIX: Tương tự, prefer ctxUser
  const storedUser = getStoredUser();
  const user = ctxUser || storedUser || null;

  if (user && !allowWhenAuth) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
};

//xóa localStorage + redirect /login khi người dùng vào / lần đầu
function AppInit() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname === "/") {
      // ✅ Chỉ chạy khi đang ở root '/'
      localStorage.clear();
      navigate("/login", { replace: true });
    }
  }, [location.pathname, navigate]);
  return null; // component này chỉ để handle init
}

function App() {
  return (
    <ConfigProvider locale={viVN}>
      <AppInit />
      {/* Check subscription cho MANAGER - redirect + ẩn menu */}
      <ManagerSubscriptionCheck />
      {/* Overlay thông báo hết hạn cho STAFF - làm mờ + modal */}
      <SubscriptionExpiredOverlay />
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
        <Route
          path="/settings/profile"
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
        {/* Customer page */}
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
        <Route
          path="/product-groups"
          element={
            <ProtectedRoute allowedPermissions="products:view">
              <ProductGroupsPage />
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
        {/* ======================================================================= */}
        {/* ====================== Báo cáo - Routes ====================== */}
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
        {/* ======================================================================= */}
        {/* ====================== Cấu hình - Routes ====================== */}
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
        {/* ======================================================================= */}
        {/* ====================== Subscription - Routes ====================== */}
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
        {/* ======================================================================= */}
        {/* ====================== ORDER - Routes ====================== */}
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
        <Route path="/unauthorized" element={<Unauthorized />} />
        {/* Default: điều hướng tới dashboard (ProtectedRoute sẽ xử lý redirect tới /login nếu chưa auth) */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
