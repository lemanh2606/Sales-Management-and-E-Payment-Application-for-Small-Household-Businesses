import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import api from "../api/userApi";

export default function DashboardPage() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalSales: 0, newUsers: 0, ordersToday: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchDemo() {
      try {
        // Example: call protected endpoint using token + cookie
        // Replace with your real API path
        // const res = await api.get("/me");
        // setMessage(`Hello ${res.data.username}`)
        setMessage(`Welcome back, ${user?.username || "Manager"}`);
        setStats({ totalSales: 1250, newUsers: 12, ordersToday: 34 });
      } catch (err) {
        console.error(err);
      }
    }
    fetchDemo();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <nav className="bg-white shadow rounded-xl p-4 flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-600">Smallbiz-Sales</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            Hi, <b>{user?.username}</b>
          </div>
          <Button onClick={handleLogout} className="bg-red-500 hover:bg-red-600">
            Đăng xuất
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <section className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h3 className="font-semibold mb-3">Đơn hàng gần đây</h3>
          <ul className="text-gray-600 space-y-2">
            <li>#001 — Đã hoàn thành</li>
            <li>#002 — Chưa xử lý</li>
            <li>#003 — Đang xử lý</li>
          </ul>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow">
          <h3 className="font-semibold mb-3">Sản phẩm hàng đầu</h3>
          <ul className="text-gray-600 space-y-2">
            <li>Sản phẩm A — 50 lượt bán</li>
            <li>Sản phẩm B — 35 lượt bán</li>
            <li>Sản phẩm C — 20 lượt bán</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
