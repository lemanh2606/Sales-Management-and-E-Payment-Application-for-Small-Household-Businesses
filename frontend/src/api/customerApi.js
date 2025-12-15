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
export const createCustomer = async (data) => (await apiClient.post("/customers", data)).data;

// UPDATE - PUT /api/customers/:id
export const updateCustomer = async (id, data) => (await apiClient.put(`/customers/${id}`, data)).data;

// SOFT DELETE - DELETE /api/customers/:id
export const softDeleteCustomer = async (id) => (await apiClient.delete(`/customers/${id}`)).data;

// 🆕 RESTORE - PUT /api/customers/:id/restore (khôi phục khách hàng đã bị xóa)
export const restoreCustomer = async (id) => (await apiClient.put(`/customers/${id}/restore`)).data;

// 🆕 GET BY STORE - GET /api/customers/store/:storeId?page=1&limit=10&query=abc&deleted=false
export const getCustomersByStore = async (storeId, params = {}) => {
  const { page = 1, limit = 10, query = "", deleted = false } = params;
  return (
    await apiClient.get(`/customers/store/${storeId}`, {
      params: { page, limit, query, deleted: deleted ? "true" : "false" },
    })
  ).data;
};

// 🆕 EXPORT EXCEL - GET /api/customers/store/:storeId/export
export const exportCustomers = async (storeId) => {
  if (!storeId) throw new Error("Thiếu storeId khi xuất danh sách khách hàng");
  const res = await apiClient.get(`/customers/store/${storeId}/export`, {
    responseType: "blob", // 👈 quan trọng để nhận file
  });
  return res.data;
};

export default {
  searchCustomers,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  restoreCustomer,
  getCustomersByStore,
  exportCustomers,
};
