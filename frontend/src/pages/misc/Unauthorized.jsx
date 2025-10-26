// src/pages/misc/Unauthorized.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FiLock } from "react-icons/fi";

export default function Unauthorized() {
    const navigate = useNavigate();
    const { logout, user } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-6">
            <div className="max-w-3xl w-full bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                <div className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-shrink-0 w-32 h-32 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
                        <FiLock size={44} className="text-emerald-600" />
                    </div>

                    <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Không có quyền truy cập</h1>
                        <p className="text-gray-600 mb-4">
                            Bạn đang đăng nhập với tài khoản <span className="font-medium text-gray-800">{user?.username ?? "—"}</span>.
                            Trang bạn đang cố truy cập yêu cầu quyền khác. Nếu bạn nghĩ đây là lỗi, liên hệ admin hoặc đăng xuất và thử lại.
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl shadow hover:scale-105 transform transition"
                            >
                                Về Dashboard
                            </button>

                            <button
                                onClick={() => { logout(); navigate("/login"); }}
                                className="inline-flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                            >
                                Đăng xuất
                            </button>

                            <button
                                onClick={() => navigate(-1)}
                                className="inline-flex items-center gap-2 px-4 py-3 text-sm text-gray-500 rounded-lg hover:bg-gray-50 transition"
                            >
                                Quay lại
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-white p-4 text-sm text-gray-500 text-center border-t border-gray-100">
                    Nếu bạn cần quyền truy cập, xin vui lòng liên hệ quản trị hệ thống để được cấp quyền.
                </div>
            </div>
        </div>
    );
}
