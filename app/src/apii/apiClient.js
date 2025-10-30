import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- CÁCH LẤY API_URL (Chọn 1 trong 2) ---

// Cách 1: Hardcode (đơn giản nhất)
// const API_URL = 'https://api.cua-ban.com/api/v1';

// Cách 2: Dùng react-native-dotenv (khuyên dùng)
// (Bạn cần tạo file .env ở gốc dự án)
import { API_URL } from '@env'; 
// ---

const apiClient = axios.create({
 baseURL: API_URL,
  // 'withCredentials: true' đã được bỏ
});

// Phải dùng 'async' vì AsyncStorage là bất đồng bộ
apiClient.interceptors.request.use(
async (config) => { 
 try {
      // Dùng AsyncStorage.getItem và 'await'
 const token = await AsyncStorage.getItem('token'); 
 if (token) {
    config.headers.Authorization = `Bearer ${token}`;
   }
  } catch (e) {
   console.error('Lỗi khi lấy token từ AsyncStorage:', e);
  }
  return config;
 },
 (error) => Promise.reject(error)
);

export default apiClient;