import apiClient from "./apiClient";

// ------------------ SUPPLIER API ------------------

// Lấy danh sách nhà cung cấp theo cửa hàng
export const getSuppliers = async (storeId) =>
  (await apiClient.get(`/suppliers/stores/${storeId}`)).data;

// Lấy chi tiết 1 nhà cung cấp
export const getSupplierById = async (supplierId) =>
  (await apiClient.get(`/suppliers/${supplierId}`)).data;

// Tạo nhà cung cấp mới
export const createSupplier = async (storeId, data) =>
  (await apiClient.post(`/suppliers/stores/${storeId}`, data)).data;

// Cập nhật nhà cung cấp
export const updateSupplier = async (supplierId, data) =>
  (await apiClient.put(`/suppliers/${supplierId}`, data)).data;

// Xoá nhà cung cấp
export const deleteSupplier = async (supplierId) =>
  (await apiClient.delete(`/suppliers/${supplierId}`)).data;
