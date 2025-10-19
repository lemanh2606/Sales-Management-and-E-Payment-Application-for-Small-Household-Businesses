import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// Tạo 1 instance axios duy nhất
const userApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // cho phép gửi cookie
});

//  Interceptor để tự động thêm token từ localStorage
userApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------ USER API ------------------
export const registerManager = async (data) =>
  (await userApi.post("/users/register", data)).data;

export const verifyOtp = async (data) =>
  (await userApi.post("/users/verify-otp", data)).data;

export const loginUser = async (data) =>
  (await userApi.post("/users/login", data)).data;

export const getProfile = async () =>
  (await userApi.get("/users/profile")).data;

export default userApi;
