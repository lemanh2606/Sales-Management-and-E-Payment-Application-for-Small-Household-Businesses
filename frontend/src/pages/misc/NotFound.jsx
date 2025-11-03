// src/pages/misc/NotFound.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiAlertTriangle, FiHome } from "react-icons/fi";
import Layout from "../../components/Layout";

export default function NotFound() {
  const currentStore = JSON.parse(localStorage.getItem("currentStore") || "{}");
  const navigate = useNavigate();

  const storeId = currentStore?._id; // ✅ Lấy ID của store từ localStorage

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center bg-transparent p-6">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-2xl w-full text-center border border-gray-100"
        >
          <div className="flex justify-center mb-6">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="inline-block"
            >
              <FiAlertTriangle className="text-yellow-500 text-6xl" />
            </motion.div>
          </div>

          <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 mb-2">404</h1>
          <h2 className="text-2xl md:text-3xl font-semibold mb-4">Trang chưa được tạo</h2>
          <p className="text-gray-600 mb-8 leading-relaxed px-4">
            Có vẻ bạn đang đi lạc — trang này hiện chưa được phát triển hoặc không tồn tại.
            Nếu bạn nghĩ đây là sai sót, liên hệ admin hoặc quay về trang chính.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() =>
                storeId ? navigate(`/dashboard/${storeId}`) : navigate("/dashboard")
              }
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-3 rounded-xl shadow-md transition-all"
            >
              <FiHome /> Quay về Trang chính
            </button>

            <button
              onClick={() => navigate(-1)}
              className="px-5 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition"
            >
              Quay lại
            </button>
          </div>
        </motion.div>
      </div>

      <footer className="text-center text-sm text-gray-400 py-6">
        © {new Date().getFullYear()} — Hệ thống quản lý bán hàng
      </footer>
    </Layout>
  );
}
