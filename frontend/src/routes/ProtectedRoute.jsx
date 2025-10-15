import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { token, user, loading } = useAuth();

  if (loading) return <div className="text-center mt-20 text-gray-500">Đang kiểm tra quyền...</div>;

  if (!token || !user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role))
    return <Navigate to="/unauthorized" replace />;

  return children;
};

export default ProtectedRoute;
