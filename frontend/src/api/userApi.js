import axios from "axios";
const API_URL = import.meta.env.VITE_API_URL + "/users"; // Lấy từ .env

// Cấu hình axios instance
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // 👈 cho phép gửi/nhận cookie
});

// Đăng ký
export const registerManager = async (data) => {
  const res = await api.post(`/register`, data);
  return res.data;
};

// Xác thực OTP
export const verifyOtp = async (data) => {
  const res = await api.post(`/verify-otp`, data);
  return res.data;
};

// Đăng nhập
export const loginUser = async (data) => {
  const res = await api.post(`/login`, data);
  return res.data;
};

// Ví dụ gọi API cần cookie (profile)
export const getProfile = async () => {
  const res = await api.get(`/profile`);
  return res.data;
};

// NEW: ensure user has store(s). Backend: POST /api/stores/ensure-store (note base is /api/stores)
export const ensureStore = async () => {
  // ensureStore endpoint is under /api/stores, so call full path
  const res = await axios.post(`${BASE}/stores/ensure-store`, {}, { withCredentials: true });
  return res.data;
};

// NEW: get list stores for manager
export const getStores = async () => {
  const res = await axios.get(`${BASE}/stores`, { withCredentials: true });
  return res.data;
};

// NEW: select a store (set user's current_store)
export const selectStore = async (storeId) => {
  const res = await axios.post(`${BASE}/stores/select/${storeId}`, {}, { withCredentials: true });
  return res.data;
};

// NEW: get dashboard data for a store
export const getStoreDashboard = async (storeId) => {
  const res = await axios.get(`${BASE}/stores/${storeId}/dashboard`, { withCredentials: true });
  return res.data;
};

export default api;