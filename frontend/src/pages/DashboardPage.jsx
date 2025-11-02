import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Layout from "../components/Layout";
import { useParams } from "react-router-dom";


export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalSales: 0, newUsers: 0, ordersToday: 0 });
  const [message, setMessage] = useState("");
  const { storeId } = useParams();

  useEffect(() => {
    
    setMessage(`Welcome back, ${user?.username || "Manager"}`);
    setStats({ totalSales: 1250, newUsers: 12, ordersToday: 34 });
  }, [user]);

  useEffect(() => {
    console.log("Đang xem dashboard của store:", storeId);
  }, [storeId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Tổng doanh số</p>
          <p className="text-3xl font-bold text-green-600">{stats.totalSales}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Người dùng mới</p>
          <p className="text-3xl font-bold text-green-600">{stats.newUsers}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Đơn hàng hôm nay</p>
          <p className="text-3xl font-bold text-green-600">{stats.ordersToday}</p>
        </div>
      </div>
    </Layout>
  );
}
