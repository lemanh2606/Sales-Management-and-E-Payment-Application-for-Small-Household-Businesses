// src/api/storeApi.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

//  Tạo 1 instance axios duy nhất
const storeApi = axios.create({
  baseURL: API_URL,
  withCredentials: true, // cho phép gửi cookie nếu cần
});

// ✅ Interceptor: tự động thêm token vào header
storeApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ------------------------- STORE ROUTES -------------------------

// Tạo store mới (MANAGER)
export const createStore = async (data) =>
  (await storeApi.post("api/stores", data)).data;

// Lấy danh sách store thuộc người quản lý
export const getStoresByManager = async () =>
  (await storeApi.get("/stores")).data;

// Lấy chi tiết 1 store cụ thể
export const getStoreById = async (storeId) =>
  (await storeApi.get(`/stores/${storeId}`)).data;

// Cập nhật store
export const updateStore = async (storeId, data) =>
  (await storeApi.put(`/stores/${storeId}`, data)).data;

// Xóa (hoặc soft-delete) store
export const deleteStore = async (storeId) =>
  (await storeApi.delete(`/stores/${storeId}`)).data;

// ------------------------- SELECT / DASHBOARD -------------------------

// Đảm bảo có store mặc định
export const ensureStore = async () =>
  (await storeApi.post("/stores/ensure-store")).data;

// Chọn store hiện tại (lưu vào session)
export const selectStore = async (storeId) =>
  (await storeApi.post(`/stores/select/${storeId}`)).data;

// Lấy dữ liệu dashboard của 1 store
export const getStoreDashboard = async (storeId) =>
  (await storeApi.get(`/stores/${storeId}/dashboard`)).data;

// ------------------------- STAFF ASSIGNMENT -------------------------

// Gán nhân viên vào store
export const assignStaffToStore = async (storeId, staffId) =>
  (
    await storeApi.post(`/stores/${storeId}/assign-staff`, {
      staffId,
    })
  ).data;

// ------------------------- EMPLOYEE ROUTES -------------------------

// Tạo nhân viên mới trong store
export const createEmployee = async (storeId, data) =>
  (await storeApi.post(`/stores/${storeId}/employees`, data)).data;

// Lấy danh sách nhân viên của store
export const getEmployeesByStore = async (storeId) =>
  (await storeApi.get(`/stores/${storeId}/employees`)).data;

// Lấy thông tin chi tiết 1 nhân viên
export const getEmployeeById = async (storeId, employeeId) =>
  (await storeApi.get(`/stores/${storeId}/employees/${employeeId}`)).data;

// Cập nhật thông tin nhân viên
export const updateEmployee = async (storeId, employeeId, data) =>
  (await storeApi.put(`/stores/${storeId}/employees/${employeeId}`, data)).data;

//  Nếu muốn có API xóa nhân viên (soft-delete hoặc hard-delete), bật dòng sau:
// export const deleteEmployee = async (storeId, employeeId) =>
//   (await storeApi.delete(`/stores/${storeId}/employees/${employeeId}`)).data;

export default storeApi;
