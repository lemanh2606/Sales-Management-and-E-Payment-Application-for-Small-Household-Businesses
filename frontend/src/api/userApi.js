// src/api/userApi.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// ✅ Tạo 1 instance axios duy nhất
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // cho phép gửi cookie
});

// Interceptor để tự động thêm token từ localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------ User API ------------------
export const registerManager = async (data) => (await api.post("/users/register", data)).data;
export const verifyOtp = async (data) => (await api.post("/users/verify-otp", data)).data;
export const loginUser = async (data) => (await api.post("/users/login", data)).data;
export const getProfile = async () => (await api.get("/users/profile")).data;

// ------------------ Store API ------------------
export const ensureStore = async () => (await api.post("/stores/ensure-store")).data;
export const getStores = async () => (await api.get("/stores")).data;
export const selectStore = async (storeId) => (await api.post(`/stores/select/${storeId}`)).data;
export const getStoreDashboard = async (storeId) => (await api.get(`/stores/${storeId}/dashboard`)).data;

export const createStore = async (data) => (await api.post("/stores", data)).data;
export const updateStore = async (storeId, data) => (await api.put(`/stores/${storeId}`, data)).data;
export const deleteStore = async (storeId) => (await api.delete(`/stores/${storeId}`)).data;

export default api;
