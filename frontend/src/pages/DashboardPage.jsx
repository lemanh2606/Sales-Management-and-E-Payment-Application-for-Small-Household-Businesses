import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { storeId: paramStoreId } = useParams(); // ✅ lấy từ URL nếu có

  // ✅ Nếu không có param thì lấy từ localStorage
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const storeId = paramStoreId || currentStore?._id;

  const [stats, setStats] = useState({ totalSales: 0, newUsers: 0, ordersToday: 0 });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!storeId) {
      console.warn("⚠️ Không tìm thấy storeId! Điều hướng về trang chọn cửa hàng...");
      navigate("/stores");
      return;
    }

    setMessage(`Welcome back, ${user?.username || "Manager"}`);
    // Giả lập fetch dữ liệu dashboard
    setStats({ totalSales: 1250, newUsers: 12, ordersToday: 34 });
  }, [user, storeId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Layout>
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">{message}</h2>
        <p className="text-gray-500 mb-6">Đang xem Dashboard của cửa hàng: <b>{storeId}</b></p>

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

        <button
          onClick={handleLogout}
          className="mt-8 px-5 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition"
        >
          Đăng xuất
        </button>
      </div>
    </Layout>
  );
}
