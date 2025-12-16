import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Lấy host động cho API:
 * - Trên Expo Go (LAN hoặc tunnel)
 * - Trên Emulator Android/iOS
 * - Fallback localhost
 */
function getDevHost(): string {
    // EAS Build / Expo Go mới
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) return hostUri.split(":")[0];

    // Legacy Expo CLI
    const debuggerHost = Constants.manifest?.debuggerHost;
    if (debuggerHost) return debuggerHost.split(":")[0];

    // Fallback localhost (chỉ chạy trên dev machine)
    return "localhost";
}

// 🚀 Lấy API URL: Ưu tiên .env, fallback về auto-detect
const API_PORT = 9999;
const API_URL =
    // process.env.EXPO_PUBLIC_API_URL
    // ||
    `http://${getDevHost()}:${API_PORT}/api`
    ;

console.log("🔥 API_URL động:", API_URL);

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 15000,
});

// Gắn token cho mọi request
apiClient.interceptors.request.use(async (config: any) => {
    try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (err: any) {
        console.warn("⚠️ Lỗi khi đọc token từ AsyncStorage:", err?.message || err);
    }
    return config;
});

// Xử lý lỗi response
apiClient.interceptors.response.use(
    (res) => res,
    (err) => Promise.reject(err)
);

export default apiClient;
