// src/api/apiClient.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants"; // nếu bạn không dùng Expo, có thể bỏ import này

// Lấy API_URL: ưu tiên biến môi trường, fallback từ Expo config, rồi fallback tạm.
const API_URL =
  (typeof process !== "undefined" && process.env.API_URL) ||
  Constants?.manifest?.extra?.API_URL ||
  "http://localhost:9999/api";

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  // note: withCredentials (cookie) trong React Native KHÔNG hoạt động như trên browser
  // vớiCredentials: true, // nếu muốn, nhưng cần setup cookie manager (xem chú thích dưới)
});

// Interceptor request: gắn Authorization Bearer token nếu có trong AsyncStorage
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // không block request nếu đọc token thất bại
      console.warn("Error reading token from storage:", e?.message || e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// (Optional) bạn có thể xử lý response 401 ở đây để redirect logout/refresh token
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    // ví dụ: if (error.response?.status === 401) { // handle logout/refresh }
    return Promise.reject(error);
  }
);

export default apiClient;
