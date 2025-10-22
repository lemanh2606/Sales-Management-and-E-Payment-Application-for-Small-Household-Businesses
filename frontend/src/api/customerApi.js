// src/api/customerApi.js
// Dùng apiClient chung để gọi API khách hàng
import apiClient from "./apiClient";

/*
  CUSTOMER API
  - Tìm kiếm, cập nhật, và xóa mềm khách hàng
  - Tự động thêm token nhờ apiClient interceptor
*/

// ===================== CUSTOMER ROUTES =====================

//  SEARCH - Tìm kiếm khách hàng theo số điện thoại hoặc tên
// GET /api/customers/search?keyword=abc
export const searchCustomers = async (keyword) =>
  (await apiClient.get("/customers/search", { params: { keyword } })).data;

//  UPDATE - Cập nhật thông tin khách hàng
// PUT /api/customers/:id
export const updateCustomer = async (id, data) =>
  (await apiClient.put(`/customers/${id}`, data)).data;

//  SOFT DELETE - Xóa mềm khách hàng (chuyển trạng thái “đã xóa”)
// DELETE /api/customers/:id
export const softDeleteCustomer = async (id) =>
  (await apiClient.delete(`/customers/${id}`)).data;

// ===================== EXPORT =====================
export default {
  searchCustomers,
  updateCustomer,
  softDeleteCustomer,
};
