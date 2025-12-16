// frontend/src/api/apiClient.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor để handle Manager subscription expired cho STAFF
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error.response;
    
    // Check nếu là 403 và Manager subscription expired
    if (response?.status === 403 && response?.data) {
      const { manager_expired, is_staff, subscription_status } = response.data;
      
      if (manager_expired || (is_staff && subscription_status === "EXPIRED")) {
        // Dispatch custom event để SubscriptionExpiredOverlay catch
        window.dispatchEvent(new CustomEvent("manager-subscription-expired", {
          detail: response.data
        }));
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
