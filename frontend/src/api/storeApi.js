// src/api/storeApi.js
// Sử dụng apiClient chung (src/api/apiClient.js)
import apiClient from "./apiClient";

/*
  STORE API
  - Tất cả request đều dùng apiClient (baseURL + interceptor đã cấu hình ở apiClient)
  - Các hàm trả về `.data` để component dùng trực tiếp
  - Nếu backend path khác, chỉnh BASE_PATH / route tương ứng
*/

// ========================= STORE CRUD =========================

// Tạo store mới (MANAGER)
export const createStore = async (data) =>
  (await apiClient.post("/stores", data)).data;

// Lấy danh sách store của manager hiện tại
export const getStoresByManager = async (params) =>
  // params optional: { page, limit, q, ... }
  (await apiClient.get("/stores", { params })).data;

// Lấy chi tiết 1 store
export const getStoreById = async (storeId) =>
  (await apiClient.get(`/stores/${storeId}`)).data;

// Cập nhật store
export const updateStore = async (storeId, data) =>
  (await apiClient.put(`/stores/${storeId}`, data)).data;

// Xóa store (soft/hard tuỳ backend)
export const deleteStore = async (storeId) =>
  (await apiClient.delete(`/stores/${storeId}`)).data;

// ========================= SELECT / DASHBOARD =========================

// Đảm bảo có store mặc định (create if not exists)
export const ensureStore = async () =>
  (await apiClient.post("/stores/ensure-store")).data;

// Chọn store hiện tại (lưu session/server-side)
export const selectStore = async (storeId) =>
  (await apiClient.post(`/stores/select/${storeId}`)).data;

// Lấy dữ liệu dashboard cho store
export const getStoreDashboard = async (storeId, params) =>
  (await apiClient.get(`/stores/${storeId}/dashboard`, { params })).data;

// ========================= STAFF / EMPLOYEE =========================

// Gán nhân viên vào store
export const assignStaffToStore = async (storeId, staffId) =>
  (
    await apiClient.post(`/stores/${storeId}/assign-staff`, {
      staffId,
    })
  ).data;

// Tạo nhân viên mới trong store
export const createEmployee = async (storeId, data) =>
  (await apiClient.post(`/stores/${storeId}/employees`, data)).data;

// Lấy danh sách nhân viên của store
export const getEmployeesByStore = async (storeId, params) =>
  (await apiClient.get(`/stores/${storeId}/employees`, { params })).data;

// Lấy chi tiết 1 nhân viên
export const getEmployeeById = async (storeId, employeeId) =>
  (await apiClient.get(`/stores/${storeId}/employees/${employeeId}`)).data;

// Cập nhật nhân viên
export const updateEmployee = async (storeId, employeeId, data) =>
  (await apiClient.put(`/stores/${storeId}/employees/${employeeId}`, data)).data;

// (Tuỳ backend) Xóa nhân viên
export const deleteEmployee = async (storeId, employeeId) =>
  (await apiClient.delete(`/stores/${storeId}/employees/${employeeId}`)).data;

export default {
  createStore,
  getStoresByManager,
  getStoreById,
  updateStore,
  deleteStore,
  ensureStore,
  selectStore,
  getStoreDashboard,
  assignStaffToStore,
  createEmployee,
  getEmployeesByStore,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
