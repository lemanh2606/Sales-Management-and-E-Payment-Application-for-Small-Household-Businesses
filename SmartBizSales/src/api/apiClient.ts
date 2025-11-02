/**
 * 📁 File: src/api/apiClient.ts
 * ------------------------------------------------------
 * Cấu hình Axios client dùng trong toàn bộ dự án React Native (Expo)
 * - Tự động thêm token từ AsyncStorage vào header Authorization
 * - Có thể mở rộng để xử lý refresh token khi gặp 401
 * ------------------------------------------------------
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL =
    process.env.API_URL ||
    'http://192.168.1.104:9999/api';

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 15000,
});

// Gắn token vào header cho mọi request
(apiClient.interceptors.request as any).use(async (config: any) => {
    try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (err) {
        console.warn('⚠️ Lỗi khi đọc token từ AsyncStorage:', (err as any)?.message || err);
    }
    return config;
});

// Xử lý lỗi response chung (ví dụ: 401, 403)
apiClient.interceptors.response.use(
    (res) => res,
    (err) => Promise.reject(err)
);

export default apiClient;
