import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth(); // lấy token từ context
  return token ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
