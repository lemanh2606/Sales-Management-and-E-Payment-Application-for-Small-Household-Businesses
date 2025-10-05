import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import DashboardPage from "../pages/DashboardPage";
import { useAuth } from "../context/AuthContext";
import VerifyOtpPage from "../pages/VerifyOtpPage";

import SelectStorePage from "../pages/SelectStorePage";

const ProtectedRoute = ({ children }) => {
    const { token } = useAuth();
    if (!token) return <Navigate to="/login" replace />;
    return children;
};
function AppRoutes() {
    const { user } = useAuth();

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
            <Route path="/select-store" element={
                <ProtectedRoute>
                    <SelectStorePage />
                </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}

export default AppRoutes;
