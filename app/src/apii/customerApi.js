import apiClient from "./apiClient";

/*
  CUSTOMER API
  - Tìm kiếm, tạo, cập nhật, xóa mềm khách hàng
  - apiClient sẽ tự thêm token nếu cấu hình interceptor
*/

// SEARCH - GET /api/customers/search?query=abc
export const searchCustomers = async (keyword, limit = 10) =>
  (
    await apiClient.get("/customers/search", {
      params: { query: keyword, limit },
    })
  ).data;

// CREATE - POST /api/customers
export const createCustomer = async (data) =>
  (await apiClient.post("/customers", data)).data;

// UPDATE - PUT /api/customers/:id
export const updateCustomer = async (id, data) =>
  (await apiClient.put(`/customers/${id}`, data)).data;

// SOFT DELETE - DELETE /api/customers/:id
export const softDeleteCustomer = async (id) =>
  (await apiClient.delete(`/customers/${id}`)).data;

// 🆕 GET BY STORE - GET /api/customers/store/:storeId
export const getCustomersByStore = async (storeId) =>
  (await apiClient.get(`/customers/store/${storeId}`)).data;

export default {
  searchCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  getCustomersByStore, // 👈 thêm export mới
};
